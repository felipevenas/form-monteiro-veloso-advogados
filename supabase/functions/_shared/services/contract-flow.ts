/**
 * Assinatura interna e arquivamento dos documentos assinados.
 *
 * O cliente assina primeiro. Quando todos os documentos têm a assinatura do
 * cliente, a Edge Function pede a assinatura em lote da Dra. Roberta. Só
 * depois de todas as assinaturas o PDF final é copiado para o Storage/Drive e
 * a cobrança de sinal/entrada é criada no Asaas.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { loadProcessBundle } from '../db/queries.ts'
import type { DbSignature } from '../db/types.ts'
import { ensureAlert, recordEvent } from './process-log.ts'
import {
  addZapSignSigner,
  getZapSignDocument,
  isInternalSigningConfigured,
  signZapSignDocuments,
} from './zapsign-client.ts'
import { createUpfrontCharges } from './asaas-service.ts'
import { ensureProcessFolder, isDriveConfigured, uploadToDrive } from './drive-client.ts'

const SIGNED_BUCKET = 'client-documents'

export async function addInternalSignerToSignature(
  supabase: SupabaseClient,
  processId: string,
  signature: DbSignature,
): Promise<void> {
  if (signature.external_internal_signer_id) return
  if (!signature.external_document_id) return

  if (!isInternalSigningConfigured()) {
    await ensureAlert(supabase, {
      key: `zapsign-internal-not-configured:${processId}`,
      title: 'Assinatura interna não configurada',
      description:
        'Cadastre ZAPSIGN_INTERNAL_USER_TOKEN e ZAPSIGN_INTERNAL_SIGNER_EMAIL para a Dra. Roberta assinar pelo ZapSign.',
      processId,
      severity: 'CRITICAL',
    })
    return
  }

  const name = Deno.env.get('ZAPSIGN_INTERNAL_SIGNER_NAME') ?? 'Roberta Monteiro Veloso'
  const email = Deno.env.get('ZAPSIGN_INTERNAL_SIGNER_EMAIL') ?? ''
  const cpf = Deno.env.get('ZAPSIGN_INTERNAL_SIGNER_CPF') ?? ''
  const phoneCountry = Deno.env.get('ZAPSIGN_INTERNAL_SIGNER_PHONE_COUNTRY') ?? '55'
  const phoneNumber = Deno.env.get('ZAPSIGN_INTERNAL_SIGNER_PHONE') ?? ''

  try {
    const signer = await addZapSignSigner(signature.external_document_id, {
      name,
      email,
      cpf: cpf || undefined,
      phoneCountry,
      phoneNumber: phoneNumber || undefined,
      qualification: 'advogada',
    })

    await supabase
      .from('signatures')
      .update({ external_internal_signer_id: signer.token })
      .eq('id', signature.id)
  } catch (cause) {
    console.error('[contract] falha ao adicionar signatária interna:', cause)
    await ensureAlert(supabase, {
      key: `zapsign-internal-signer-failed:${processId}:${signature.id}`,
      title: 'Falha ao adicionar a assinatura da advogada',
      description: 'O ZapSign não aceitou a signatária interna. Confira o usuário e os tokens.',
      processId,
      severity: 'CRITICAL',
    })
    throw cause
  }
}

export async function requestInternalSignatures(
  supabase: SupabaseClient,
  processId: string,
): Promise<boolean> {
  const bundle = await loadProcessBundle(supabase, processId)
  if (!bundle) return false
  if (bundle.process.signature_status === 'ASSINADA_COMPLETA') return true
  if (bundle.process.general_status === 'AGUARDANDO_ASSINATURA_INTERNA') return true

  const tokens = bundle.signatures
    .map((signature) => signature.external_internal_signer_id)
    .filter((token): token is string => Boolean(token))

  if (tokens.length !== bundle.signatures.length || tokens.length === 0) {
    await ensureAlert(supabase, {
      key: `zapsign-internal-signer-missing:${processId}`,
      title: 'Assinatura interna incompleta',
      description:
        'Um ou mais documentos não têm a signatária interna vinculada. Reenvie o contrato pela tela do processo.',
      processId,
      severity: 'CRITICAL',
    })
    return false
  }

  try {
    await signZapSignDocuments(tokens)
  } catch (cause) {
    console.error('[contract] falha ao solicitar assinatura interna:', cause)
    await ensureAlert(supabase, {
      key: `zapsign-internal-sign-failed:${processId}`,
      title: 'Falha na assinatura da advogada',
      description:
        'O ZapSign não aceitou a assinatura em lote. Verifique o plano API, o add-on e o user_token.',
      processId,
      severity: 'CRITICAL',
    })
    throw cause
  }

  await supabase
    .from('contract_processes')
    .update({
      general_status: 'AGUARDANDO_ASSINATURA_INTERNA',
      signature_status: 'ASSINADA_CLIENTE',
      current_step: 'assinatura',
    })
    .eq('id', processId)

  await recordEvent(supabase, processId, {
    type: 'INTERNAL_SIGNATURE_REQUESTED',
    title: 'Assinatura da advogada solicitada',
    description: 'Todas as assinaturas do cliente foram recebidas; a Dra. Roberta assinará em lote.',
    actorType: 'SYSTEM',
    payload: { documents: tokens.length },
  })

  return true
}

export async function finalizeSignedDocuments(
  supabase: SupabaseClient,
  processId: string,
): Promise<void> {
  const bundle = await loadProcessBundle(supabase, processId)
  if (!bundle) return

  const folderId = isDriveConfigured()
    ? await ensureProcessFolder(bundle.process.public_code).catch(() => null)
    : null

  let pendingFiles = 0

  for (const signature of bundle.signatures) {
    if (!signature.external_document_id) continue

    let signedFileUrl = signature.signed_file_url

    try {
      if (!signedFileUrl) {
        const document = await getZapSignDocument(signature.external_document_id)
        signedFileUrl = document.signedFileUrl
      }

      if (!signedFileUrl) {
        pendingFiles += 1
        await ensureAlert(supabase, {
          key: `zapsign-signed-file-missing:${processId}:${signature.id}`,
          title: 'PDF assinado indisponível',
          description: 'O ZapSign ainda não disponibilizou o arquivo assinado deste documento.',
          processId,
          severity: 'WARNING',
        })
        continue
      }

      const response = await fetch(signedFileUrl, { signal: AbortSignal.timeout(60_000) })
      if (!response.ok) throw new Error(`SIGNED_FILE_HTTP_${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())

      const storagePath = `${processId}/assinados/${signature.id}.pdf`
      const storage = await supabase.storage
        .from(SIGNED_BUCKET)
        .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true })

      if (storage.error) {
        console.error('[contract] falha ao copiar PDF para o Storage:', storage.error.message)
      }

      let driveFileId = signature.drive_file_id
      let driveFolderId = signature.drive_folder_id

      if (isDriveConfigured()) {
        try {
          const uploaded = await uploadToDrive({
            name: `${bundle.process.public_code}-${signature.template_id ?? signature.id}.pdf`,
            mimeType: 'application/pdf',
            bytes,
            folderId: folderId ?? undefined,
          })
          driveFileId = uploaded.fileId
          driveFolderId = uploaded.folderId
        } catch (cause) {
          console.error('[contract] falha ao enviar PDF ao Drive:', cause)
          await ensureAlert(supabase, {
            key: `drive-signed-upload-failed:${processId}:${signature.id}`,
            title: 'Falha ao salvar contrato no Drive',
            description: 'O PDF assinado permanece no Storage privado e será reenviado.',
            processId,
            severity: 'WARNING',
          })
        }
      }

      await supabase
        .from('signatures')
        .update({
          status: 'ASSINADA_COMPLETA',
          signed_at: signature.signed_at ?? new Date().toISOString(),
          signed_file_url: signedFileUrl,
          drive_file_id: driveFileId,
          drive_folder_id: driveFolderId,
          last_event_at: new Date().toISOString(),
        })
        .eq('id', signature.id)
    } catch (cause) {
      console.error('[contract] falha ao finalizar documento assinado:', cause)
      await ensureAlert(supabase, {
        key: `signed-document-failed:${processId}:${signature.id}`,
        title: 'Falha ao arquivar contrato assinado',
        description: 'O contrato foi assinado, mas o PDF ainda não foi copiado. Tente novamente.',
        processId,
        severity: 'CRITICAL',
      })
      throw cause
    }
  }

  if (pendingFiles > 0) {
    await ensureAlert(supabase, {
      key: `signed-files-pending:${processId}`,
      title: 'Contrato assinado aguardando PDF',
      description:
        'A assinatura foi concluída, mas um ou mais PDFs ainda não estão disponíveis. A cobrança não foi criada.',
      processId,
      severity: 'CRITICAL',
    })
    return
  }

  const now = new Date().toISOString()
  const completed = new Set(bundle.process.completed_steps)
  completed.add('assinatura')

  await supabase
    .from('contract_processes')
    .update({
      signature_status: 'ASSINADA_COMPLETA',
      general_status: 'AGUARDANDO_PAGAMENTO',
      current_step: 'pagamento',
      completed_steps: [...completed],
      version: bundle.process.version + 1,
    })
    .eq('id', processId)

  await recordEvent(supabase, processId, {
    type: 'SIGNATURE_COMPLETED',
    title: 'Assinatura concluída',
    description: 'Cliente e advogada assinaram todos os documentos. O pagamento foi liberado.',
    actorType: 'SYSTEM',
    payload: { signedAt: now },
  })

  await createUpfrontCharges(supabase, processId)
}
