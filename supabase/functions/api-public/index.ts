/**
 * API pública do cliente. Sem JWT: a sessão é um token opaco `mv_...`.
 *
 * O navegador chama esta função via `X-Process-Token`; o token é um link secreto
 * e nunca é gravado em localStorage. Todas as escritas são idempotentes por
 * sessão + rate limit.
 */

import { createServiceClient, clientIp, hashIp, requireProcessSession } from '../_shared/http/auth.ts'
import { preflightResponse } from '../_shared/http/cors.ts'
import { fail } from '../_shared/http/errors.ts'
import {
  errorResponse,
  jsonResponse,
  readJsonBody,
} from '../_shared/http/json.ts'
import { enforceRateLimit } from '../_shared/http/rate-limit.ts'
import { verifyTurnstile } from '../_shared/http/turnstile.ts'
import { matchParam, normalizePath, routePath } from '../_shared/http/router.ts'
import {
  createPaymentCheckout,
  createSession,
  loadDto,
  saveDraft,
  savePlan,
  saveStep,
  startProcess,
  startSignature,
} from '../_shared/services/process-service.ts'
import {
  completeDocumentUpload,
  createDocumentUploadUrl,
  removeDocument,
} from '../_shared/services/documents-service.ts'
import { sendAccessLinkEmail } from '../_shared/services/email-service.ts'
import { runInBackground } from '../_shared/http/background.ts'
import { loadProcess } from '../_shared/db/queries.ts'

Deno.serve(async (request) => {
  try {
    const preflight = preflightResponse(request)
    if (preflight) return preflight

    const supabase = createServiceClient()
    const path = normalizePath(routePath(request, 'api-public'))

    if (path === '/session/start' && request.method === 'POST') {
      return await handleStart(request, supabase)
    }

    if (path === '/session/resume' && request.method === 'POST') {
      return await handleResume(request, supabase)
    }

    if (path === '/process' && request.method === 'GET') {
      return await handleGetProcess(request, supabase)
    }

    if (path.startsWith('/process/steps/') && path.endsWith('/draft') && request.method === 'PUT') {
      return await handleSaveDraft(request, supabase, path)
    }

    if (path.startsWith('/process/steps/') && request.method === 'PUT') {
      return await handleSaveStep(request, supabase, path)
    }

    if (path === '/process/plan' && request.method === 'PUT') {
      return await handleSavePlan(request, supabase)
    }

    if (path === '/process/signature/start' && request.method === 'POST') {
      return await handleStartSignature(request, supabase)
    }

    // Alias antigo: mantém compatibilidade com abas abertas antes do deploy.
    if (path === '/process/submit' && request.method === 'POST') {
      return await handleStartSignature(request, supabase)
    }

    if (path === '/process/payment/checkout' && request.method === 'POST') {
      return await handlePaymentCheckout(request, supabase)
    }

    if (path === '/process/documents/upload-url' && request.method === 'POST') {
      return await handleUploadUrl(request, supabase)
    }

    if (path === '/process/documents/complete' && request.method === 'POST') {
      return await handleCompleteUpload(request, supabase)
    }

    if (path.startsWith('/process/documents/') && request.method === 'DELETE') {
      return await handleRemoveDocument(request, supabase, path)
    }

    return jsonResponse(
      request,
      { error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } },
      404,
    )
  } catch (error) {
    return errorResponse(request, error)
  }
})

async function handleStart(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const body = await readJsonBody(request)
  const input = asObject(body)

  const ip = clientIp(request)
  await enforceRateLimit(supabase, `start:ip:${ip}`, 10, 3600)
  await verifyTurnstile(stringValue(input.turnstileToken) ?? undefined, ip)

  const attribution = isRecord(input.attribution)
    ? Object.fromEntries(
        Object.entries(input.attribution)
          .filter(([, value]) => typeof value === 'string')
          .slice(0, 20)
          .map(([key, value]) => [key.slice(0, 40), String(value).slice(0, 300)]),
      )
    : {}

  const result = await startProcess(supabase, {
    productSlug: stringValue(input.productSlug) ?? undefined,
    attribution,
  })

  const process = await loadDto(supabase, result.processId)
  return jsonResponse(request, { token: result.token, process }, 201)
}

async function handleResume(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const body = await readJsonBody(request)
  const input = asObject(body)
  const email = stringValue(input.email)?.toLowerCase()
  const ip = clientIp(request)

  await enforceRateLimit(supabase, `resume:ip:${ip}`, 5, 3600)
  await verifyTurnstile(stringValue(input.turnstileToken) ?? undefined, ip)

  if (email && email.length <= 254) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (client) {
      const { data: process } = await supabase
        .from('contract_processes')
        .select('id')
        .eq('client_id', client.id)
        .in('general_status', [
          'INICIADO',
          'DADOS_PENDENTES',
          'VALIDANDO_DADOS',
          'DADOS_INVALIDOS',
          'PRONTO_PARA_CONTRATO',
          'CONTRATO_EM_GERACAO',
          'AGUARDANDO_ASSINATURA_CLIENTE',
          'AGUARDANDO_ASSINATURA_INTERNA',
          'AGUARDANDO_PAGAMENTO',
          'AGUARDANDO_DOCUMENTOS',
          'DOCUMENTOS_EM_PROCESSAMENTO',
          'DOCUMENTACAO_CONCLUIDA',
        ])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>()

      if (process) {
        const token = await createSession(supabase, process.id)

        // O e-mail é registrado em `message_logs` (idempotente) e enviado em
        // background. Não vai para o outbox para não duplicar quando o worker
        // de jobs existir.
        runInBackground(
          sendAccessLinkEmail(supabase, {
            processId: process.id,
            email,
            token,
          }),
        )
      }
    }
  }

  // Sempre a mesma resposta: não revela se o e-mail existe na base.
  return jsonResponse(request, { status: 'accepted' }, 202)
}

async function handleGetProcess(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `read:${session.process_id}`, 120, 60)
  const process = await loadDto(supabase, session.process_id)
  return jsonResponse(request, process)
}

async function handleSaveDraft(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  path: string,
): Promise<Response> {
  const step = matchParam(path, /^\/process\/steps\/([^/]+)\/draft$/)
  if (!step) throw fail.notFound('Etapa não encontrada.')

  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `draft:${session.process_id}`, 120, 60)

  const body = asObject(await readJsonBody(request))
  const process = await loadProcess(supabase, session.process_id)
  if (!process) throw fail.notFound('Processo não encontrado.')

  const result = await saveDraft(supabase, process, step, body.values)
  return jsonResponse(request, result)
}

async function handleSaveStep(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  path: string,
): Promise<Response> {  const step = matchParam(path, /^\/process\/steps\/([^/]+)$/)
  if (!step) throw fail.notFound('Etapa não encontrada.')

  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `write:${session.process_id}`, 120, 60)

  const body = asObject(await readJsonBody(request))
  const process = await loadProcess(supabase, session.process_id)
  if (!process) throw fail.notFound('Processo não encontrado.')

  const updated = await saveStep(supabase, process, step, body.values)
  return jsonResponse(request, updated)
}

async function handleSavePlan(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `write:${session.process_id}`, 120, 60)

  const body = asObject(await readJsonBody(request))
  const planId = stringValue(body.planId)
  if (!planId) throw fail.invalidInput('Informe o plano escolhido.')

  const process = await loadProcess(supabase, session.process_id)
  if (!process) throw fail.notFound('Processo não encontrado.')

  return jsonResponse(request, await savePlan(supabase, process, planId))
}

async function handleStartSignature(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `signature:${session.process_id}`, 10, 3600)

  const body = asObject(await readJsonBody(request))
  const planId = stringValue(body.planId)
  const consentVersion = stringValue(body.consentVersion)

  if (typeof body.consentAccepted !== 'boolean') {
    throw fail.invalidInput('Informe o consentimento.')
  }

  const process = await loadProcess(supabase, session.process_id)
  if (!process) throw fail.notFound('Processo não encontrado.')

  const updated = await startSignature(
    supabase,
    process,
    {
      planId: planId ?? undefined,
      consentVersion: consentVersion ?? '',
      consentAccepted: body.consentAccepted,
    },
    {
      ipHash: await hashIp(request),
      userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      token: request.headers.get('X-Process-Token'),
    },
  )

  return jsonResponse(request, updated)
}

async function handlePaymentCheckout(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `checkout:${session.process_id}`, 20, 3600)

  const process = await loadProcess(supabase, session.process_id)
  if (!process) throw fail.notFound('Processo não encontrado.')

  const token = request.headers.get('X-Process-Token') ?? ''
  const result = await createPaymentCheckout(supabase, process, { token })

  return jsonResponse(request, result)
}

async function handleUploadUrl(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `upload:${session.process_id}`, 20, 3600)

  const body = asObject(await readJsonBody(request))
  const process = await loadProcess(supabase, session.process_id)
  if (!process) throw fail.notFound('Processo não encontrado.')

  const result = await createDocumentUploadUrl(supabase, process, {
    requirementId: requireString(body.requirementId, 'Informe o documento.'),
    filename: requireString(body.filename, 'Informe o nome do arquivo.'),
    mimeType: requireString(body.mimeType, 'Informe o tipo do arquivo.'),
    sizeBytes: requireNumber(body.sizeBytes, 'Informe o tamanho do arquivo.'),
  })

  return jsonResponse(request, result)
}

async function handleCompleteUpload(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `upload:${session.process_id}`, 20, 3600)

  const body = asObject(await readJsonBody(request))
  const process = await loadProcess(supabase, session.process_id)
  if (!process) throw fail.notFound('Processo não encontrado.')

  await completeDocumentUpload(
    supabase,
    process,
    {
      requirementId: requireString(body.requirementId, 'Informe o documento.'),
      path: requireString(body.path, 'Informe o caminho do arquivo.'),
      filename: requireString(body.filename, 'Informe o nome do arquivo.'),
      mimeType: requireString(body.mimeType, 'Informe o tipo do arquivo.'),
      sizeBytes: requireNumber(body.sizeBytes, 'Informe o tamanho do arquivo.'),
    },
    { token: request.headers.get('X-Process-Token') },
  )

  return jsonResponse(request, await loadDto(supabase, process.id))
}

async function handleRemoveDocument(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  path: string,
): Promise<Response> {
  const requirementId = matchParam(path, /^\/process\/documents\/([^/]+)$/)
  if (!requirementId) throw fail.notFound('Documento não encontrado.')

  const session = await requireProcessSession(supabase, request)
  await enforceRateLimit(supabase, `upload:${session.process_id}`, 20, 3600)

  const process = await loadProcess(supabase, session.process_id)
  if (!process) throw fail.notFound('Processo não encontrado.')

  await removeDocument(supabase, process, requirementId)
  return jsonResponse(request, await loadDto(supabase, process.id))
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function requireString(value: unknown, message: string): string {
  const text = stringValue(value)
  if (!text) throw fail.invalidInput(message)
  return text
}

function requireNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw fail.invalidInput(message)
  }
  return value
}
