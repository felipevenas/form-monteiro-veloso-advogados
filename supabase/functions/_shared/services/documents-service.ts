/** Upload de documentos: URL assinada, validação e transferência para o Drive. */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { loadProcessBundle } from '../db/queries.ts'
import { mapProcessBundle } from '../db/mappers.ts'
import type { DbProcess } from '../db/types.ts'
import { areDocumentsUnlockedForDto } from '../domain/workflow.ts'
import { runInBackground } from '../http/background.ts'
import { sha256HexBytes } from '../http/auth.ts'
import { fail } from '../http/errors.ts'
import { sendCompletionEmail } from './email-service.ts'
import { enqueueJob, recordEvent } from './process-service.ts'

const BUCKET = 'client-documents'
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_BYTES = 10 * 1024 * 1024

export interface UploadUrlInput {
  requirementId: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface UploadUrlResult {
  uploadUrl: string
  path: string
}

export async function createDocumentUploadUrl(
  supabase: SupabaseClient,
  process: DbProcess,
  input: UploadUrlInput,
): Promise<UploadUrlResult> {
  const bundle = await loadProcessBundle(supabase, process.id)
  if (!bundle) throw fail.notFound('Processo não encontrado.')

  const dto = mapProcessBundle(bundle)
  if (!areDocumentsUnlockedForDto(dto)) {
    throw fail.conflict('DOCUMENTS_LOCKED', 'Os documentos ainda não estão liberados.')
  }

  const requirement = dto.documents.find((document) => document.id === input.requirementId)
  if (!requirement) {
    throw fail.notFound('Requisito de documento não encontrado.')
  }

  validateFile(input, requirement.acceptedMimeTypes, requirement.maxSizeBytes)

  const extension = extensionFor(input.mimeType)
  const path = `${process.id}/${crypto.randomUUID()}.${extension}`

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[documents] falha ao criar URL de upload:', error?.message)
    throw fail.unavailable('Não foi possível preparar o envio do arquivo.')
  }

  return { uploadUrl: data.signedUrl, path }
}

export interface CompleteUploadInput {
  requirementId: string
  path: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export async function completeDocumentUpload(
  supabase: SupabaseClient,
  process: DbProcess,
  input: CompleteUploadInput,
  options: { token?: string | null } = {},
): Promise<void> {
  if (!input.path.startsWith(`${process.id}/`)) {
    throw fail.forbidden('Caminho de arquivo inválido para este processo.')
  }

  const bundle = await loadProcessBundle(supabase, process.id)
  if (!bundle) throw fail.notFound('Processo não encontrado.')

  const dto = mapProcessBundle(bundle)
  if (!areDocumentsUnlockedForDto(dto)) {
    throw fail.conflict('DOCUMENTS_LOCKED', 'Os documentos ainda não estão liberados.')
  }

  const requirement = dto.documents.find((document) => document.id === input.requirementId)
  if (!requirement) throw fail.notFound('Requisito de documento não encontrado.')

  validateFile(input, requirement.acceptedMimeTypes, requirement.maxSizeBytes)

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(input.path)

  if (downloadError || !blob) {
    console.error('[documents] arquivo não encontrado no Storage:', downloadError?.message)
    throw fail.notFound('Arquivo não encontrado. Envie novamente.')
  }

  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.byteLength === 0 || bytes.byteLength > requirement.maxSizeBytes) {
    throw fail.unprocessable('INVALID_FILE_SIZE', 'Arquivo vazio ou acima do limite.')
  }

  if (!hasValidMagicBytes(bytes, input.mimeType)) {
    throw fail.unprocessable('INVALID_FILE_TYPE', 'O conteúdo do arquivo não corresponde ao formato.')
  }

  const hash = await sha256HexBytes(bytes)

  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('contract_process_id', process.id)
    .eq('document_requirement_id', requirement.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  const payload = {
    contract_process_id: process.id,
    document_requirement_id: requirement.id,
    document_type: requirement.label,
    required: requirement.required,
    original_filename: sanitizeFilename(input.filename),
    mime_type: input.mimeType,
    size_bytes: bytes.byteLength,
    sha256: hash,
    storage_path: input.path,
    storage_status: 'UPLOADED' as const,
    uploaded_at: new Date().toISOString(),
  }

  const { data: saved, error: saveError } = existing
    ? await supabase
        .from('documents')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single<{ id: string }>()
    : await supabase.from('documents').insert(payload).select('id').single<{ id: string }>()

  if (saveError || !saved) {
    console.error('[documents] falha ao salvar metadados:', saveError?.message)
    if (saveError?.code === '23505') {
      throw fail.conflict('DOCUMENT_DUPLICATE', 'Este arquivo já foi enviado neste processo.')
    }
    throw fail.internal()
  }

  await refreshDocumentsStatus(supabase, process.id, options)

  await enqueueJob(supabase, {
    processId: process.id,
    jobType: 'DRIVE_UPLOAD',
    idempotencyKey: `drive-upload:${saved.id}`,
    payload: { documentId: saved.id, path: input.path },
  })

  await recordEvent(supabase, process.id, {
    type: 'DOCUMENT_UPLOADED',
    title: 'Documento enviado',
    description: `${requirement.label} recebido.`,
    actorType: 'CLIENT',
    payload: { documentId: saved.id, requirementId: requirement.id },
  })
}

export async function removeDocument(
  supabase: SupabaseClient,
  process: DbProcess,
  requirementId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('documents')
    .select('id, storage_path')
    .eq('contract_process_id', process.id)
    .eq('document_requirement_id', requirementId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; storage_path: string | null }>()

  if (!existing) return

  if (existing.storage_path) {
    await supabase.storage.from(BUCKET).remove([existing.storage_path])
  }

  const { error } = await supabase.from('documents').delete().eq('id', existing.id)
  if (error) {
    console.error('[documents] falha ao remover metadados:', error.message)
    throw fail.internal()
  }

  await refreshDocumentsStatus(supabase, process.id)

  await recordEvent(supabase, process.id, {
    type: 'DOCUMENT_REMOVED',
    title: 'Documento removido',
    description: 'O arquivo foi marcado como pendente.',
    actorType: 'CLIENT',
    payload: { requirementId },
  })
}

export async function refreshDocumentsStatus(
  supabase: SupabaseClient,
  processId: string,
  options: { token?: string | null } = {},
): Promise<void> {
  const bundle = await loadProcessBundle(supabase, processId)
  if (!bundle) return

  const wasComplete = bundle.process.general_status === 'CONCLUIDO'

  const dto = mapProcessBundle(bundle)
  const required = dto.documents.filter((document) => document.required)
  const uploaded = required.filter((document) =>
    ['ENVIADO', 'PROCESSANDO'].includes(document.status),
  )

  const documentsStatus =
    required.length > 0 && uploaded.length === required.length
      ? 'COMPLETA'
      : uploaded.length > 0
        ? 'PARCIAL'
        : 'PENDENTE'

  const complete =
    documentsStatus === 'COMPLETA' &&
    (dto.signatureStatus === 'ASSINADA_CLIENTE' ||
      dto.signatureStatus === 'ASSINADA_COMPLETA') &&
    dto.paymentStatus === 'PAGO'

  const completed = new Set(bundle.process.completed_steps)
  if (complete) completed.add('documentos')

  const { error } = await supabase
    .from('contract_processes')
    .update({
      documents_status: documentsStatus,
      completed_steps: [...completed],
      ...(complete
        ? { general_status: 'CONCLUIDO', completed_at: new Date().toISOString() }
        : documentsStatus === 'COMPLETA'
          ? { general_status: 'DOCUMENTACAO_CONCLUIDA' }
          : { general_status: 'AGUARDANDO_DOCUMENTOS' }),
    })
    .eq('id', processId)

  if (error) {
    console.error('[documents] falha ao atualizar status:', error.message)
  }

  if (complete) {
    await recordEvent(supabase, processId, {
      type: 'PROCESS_COMPLETED',
      title: 'Processo concluído',
      description: 'Assinaturas, pagamento e documentos foram confirmados.',
      actorType: 'SYSTEM',
    })
  }

  // Só na transição para concluído (e em background, depois de persistir).
  if (complete && !wasComplete) {
    runInBackground(sendCompletionEmail(supabase, processId, options))
  }
}

function validateFile(
  input: { filename: string; mimeType: string; sizeBytes: number },
  accepted: readonly string[],
  maxSizeBytes: number,
): void {
  if (!input.filename || input.filename.length > 180) {
    throw fail.unprocessable('INVALID_FILENAME', 'Nome de arquivo inválido.')
  }

  if (!ALLOWED_MIME.has(input.mimeType) || !accepted.includes(input.mimeType)) {
    throw fail.unprocessable('INVALID_FILE_TYPE', 'Formato de arquivo não aceito.')
  }

  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw fail.unprocessable('INVALID_FILE_SIZE', 'Arquivo vazio.')
  }

  if (input.sizeBytes > Math.min(maxSizeBytes, MAX_BYTES)) {
    throw fail.unprocessable('FILE_TOO_LARGE', 'Arquivo acima do tamanho permitido.')
  }
}

function hasValidMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'application/pdf') {
    return (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    )
  }

  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }

  if (mimeType === 'image/png') {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    )
  }

  return false
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  return 'bin'
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.\- ()]/g, '_').slice(0, 180)
}
