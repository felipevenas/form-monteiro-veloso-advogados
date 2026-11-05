/**
 * Webhooks: persistir antes de processar e sempre responder 200 depois de
 * gravar. O processamento pesado fica na outbox.
 */

import {
  createServiceClient,
  requireBearerSecret,
  requireSecretHeader,
  sha256Hex,
} from '../_shared/http/auth.ts'
import { preflightResponse } from '../_shared/http/cors.ts'
import { fail } from '../_shared/http/errors.ts'
import { errorResponse, jsonResponse, readJsonBody } from '../_shared/http/json.ts'
import { normalizePath, routePath } from '../_shared/http/router.ts'
import {
  processAsaasEvent,
  processZapSignEvent,
  type AsaasPayload,
  type ZapSignPayload,
} from '../_shared/services/webhook-processor.ts'

Deno.serve(async (request) => {
  try {
    const preflight = preflightResponse(request)
    if (preflight) return preflight

    if (request.method !== 'POST') {
      return jsonResponse(
        request,
        { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } },
        405,
      )
    }

    const supabase = createServiceClient()
    const path = normalizePath(routePath(request, 'webhooks'))

    if (path === '/asaas') return await handleAsaas(request, supabase)
    if (path === '/zapsign') return await handleZapSign(request, supabase)
    if (path === '/vertisell') return await handleVertisell(request, supabase)

    return jsonResponse(
      request,
      { error: { code: 'NOT_FOUND', message: 'Webhook não encontrado.' } },
      404,
    )
  } catch (error) {
    return errorResponse(request, error)
  }
})

async function handleAsaas(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const expected = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? ''
  if (!expected) throw fail.unavailable('Webhook do Asaas não configurado.')
  requireSecretHeader(request, 'asaas-access-token', expected)

  const event = asObject(await readJsonBody(request, 1024 * 1024)) as AsaasPayload
  const externalEventId = typeof event.id === 'string' ? event.id : null
  const hash = externalEventId ?? (await sha256Hex(JSON.stringify(event)))

  const inserted = await insertEvent(supabase, {
    provider: 'asaas',
    externalEventId,
    hash,
    eventType: event.event ?? 'unknown',
    processId: null,
    payload: event as Record<string, unknown>,
  })

  try {
    await processAsaasEvent(supabase, event)
    await markProcessed(supabase, 'asaas', hash)
  } catch (cause) {
    console.error('[webhook] falha ao processar Asaas:', cause)
    await markFailed(supabase, 'asaas', hash, 'PROCESSING_FAILED')
    if (inserted) throw fail.internal()
  }

  return jsonResponse(request, { received: true })
}

async function handleZapSign(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const expected = Deno.env.get('ZAPSIGN_WEBHOOK_SECRET') ?? ''
  if (!expected) throw fail.unavailable('Webhook do ZapSign não configurado.')
  requireBearerSecret(request, expected)

  const event = asObject(await readJsonBody(request, 1024 * 1024)) as ZapSignPayload
  const signedAt = event.signer_who_signed?.signed_at ?? ''
  const signerToken = event.signer_who_signed?.token ?? ''
  const docToken = event.token ?? ''

  const hash = await sha256Hex(
    `${event.event_type ?? 'unknown'}:${docToken}:${signerToken}:${signedAt}`,
  )

  const inserted = await insertEvent(supabase, {
    provider: 'zapsign',
    externalEventId: docToken || null,
    hash,
    eventType: event.event_type ?? 'unknown',
    processId: null,
    payload: event as Record<string, unknown>,
  })

  try {
    await processZapSignEvent(supabase, event)
    await markProcessed(supabase, 'zapsign', hash)
  } catch (cause) {
    console.error('[webhook] falha ao processar ZapSign:', cause)
    await markFailed(supabase, 'zapsign', hash, 'PROCESSING_FAILED')
    if (inserted) throw fail.internal()
  }

  return jsonResponse(request, { received: true })
}

async function handleVertisell(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const expected = Deno.env.get('VERTISEL_WEBHOOK_SECRET') ?? ''
  if (!expected) throw fail.unavailable('Webhook da Vertisell não configurado.')
  requireSecretHeader(request, 'x-vertisell-signature', expected)

  const event = asObject(await readJsonBody(request, 1024 * 1024))
  const hash = await sha256Hex(JSON.stringify(event))

  await insertEvent(supabase, {
    provider: 'vertisell',
    externalEventId: typeof event.id === 'string' ? event.id : null,
    hash,
    eventType: typeof event.event === 'string' ? event.event : 'inbound',
    processId: null,
    payload: event,
  })

  return jsonResponse(request, { received: true })
}

async function insertEvent(
  supabase: ReturnType<typeof createServiceClient>,
  input: {
    provider: string
    externalEventId: string | null
    hash: string
    eventType: string
    processId: string | null
    payload: Record<string, unknown>
  },
): Promise<boolean> {
  const { error } = await supabase.from('integration_events').insert({
    provider: input.provider,
    external_event_id: input.externalEventId,
    event_hash: input.hash,
    event_type: input.eventType,
    contract_process_id: input.processId,
    status: 'RECEIVED',
    raw_payload: input.payload,
  })

  if (!error) return true
  if (error.code === '23505') return false

  console.error('[webhook] falha ao persistir evento:', error.message)
  throw fail.internal()
}

async function markProcessed(
  supabase: ReturnType<typeof createServiceClient>,
  provider: string,
  hash: string,
): Promise<void> {
  await supabase
    .from('integration_events')
    .update({ status: 'PROCESSED', processed_at: new Date().toISOString() })
    .eq('provider', provider)
    .eq('event_hash', hash)
}

async function markFailed(
  supabase: ReturnType<typeof createServiceClient>,
  provider: string,
  hash: string,
  code: string,
): Promise<void> {
  await supabase
    .from('integration_events')
    .update({ status: 'FAILED', error_code: code })
    .eq('provider', provider)
    .eq('event_hash', hash)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
