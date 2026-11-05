/**
 * E-mails transacionais do processo de contratação.
 *
 * Regras:
 * - nada aqui derruba o fluxo do cliente: toda falha vira log + alerta;
 * - `EMAIL_MODE=off` desliga tudo; `test` redireciona para um único endereço;
 *   `live` envia ao destinatário real;
 * - a chave de idempotência em `message_logs` evita duplicidade em retry,
 *   duplo clique e replay de webhook.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { loadProcessBundle } from '../db/queries.ts'
import { mapProcessBundle } from '../db/mappers.ts'
import type { ContractProcess } from '../domain/types.ts'
import { ensureAlert } from './process-log.ts'
import { createSession } from './session-service.ts'
import { ResendError, isResendConfigured, sendResendEmail } from './resend-client.ts'
import {
  emailBrand,
  firstNameOf,
  renderAccessLinkEmail,
  renderClientCompletedEmail,
  renderClientSubmissionEmail,
  renderTeamSubmissionEmail,
  type RenderedEmail,
} from './email-templates.ts'

type EmailMode = 'off' | 'test' | 'live'

const PROVIDER = 'resend'
const STALE_PLANNED_MS = 10 * 60 * 1000
const MESSAGE_TYPES = {
  submissionClient: 'CLIENT_SUBMISSION',
  submissionTeam: 'TEAM_SUBMISSION',
  completedClient: 'CLIENT_COMPLETED',
  accessLink: 'ACCESS_LINK',
} as const

function readMode(): EmailMode {
  const raw = (Deno.env.get('EMAIL_MODE') ?? '').trim().toLowerCase()
  if (raw === 'off' || raw === 'test' || raw === 'live') return raw

  // Sem a variável, envia quando a chave existe. Em staging, use `test`.
  return isResendConfigured() ? 'live' : 'off'
}

function appUrl(): string {
  return (
    (Deno.env.get('APP_URL') ?? '').split(',')[0]?.trim() || 'https://form.monteiroveloso.com'
  )
}

function fromAddress(): string {
  const configured = Deno.env.get('EMAIL_FROM')?.trim()
  if (configured) return configured

  const domain = emailBrand.email.split('@')[1] ?? 'monteiroveloso.com'
  return `${emailBrand.name} <contato@${domain}>`
}

function replyToAddress(): string {
  return Deno.env.get('EMAIL_REPLY_TO')?.trim() || emailBrand.email
}

function teamAddresses(): string[] {
  const raw =
    Deno.env.get('EMAIL_TEAM_RECIPIENTS')?.trim() ||
    Deno.env.get('EMAIL_REPLY_TO')?.trim() ||
    emailBrand.email

  return raw
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
}

let warnedMissingTestRecipient = false

function recipientsFor(
  addresses: Array<string | null | undefined>,
  mode: EmailMode,
): string[] {
  if (mode === 'off') return []

  if (mode === 'test') {
    const test = Deno.env.get('EMAIL_TEST_RECIPIENT')?.trim()
    if (!test) {
      if (!warnedMissingTestRecipient) {
        warnedMissingTestRecipient = true
        console.warn(
          '[email] EMAIL_TEST_RECIPIENT ausente: nenhum e-mail será enviado no modo test.',
        )
      }
      return []
    }
    return [test]
  }

  return [
    ...new Set(
      addresses
        .map((address) => address?.trim())
        .filter((address): address is string => Boolean(address)),
    ),
  ]
}

function processUrl(token: string | null | undefined): string {
  return token ? `${appUrl()}/processo/${token}` : `${appUrl()}/continuar`
}

/**
 * Link para o processo. Quando o gatilho vem de webhook (sem token na mão),
 * cria uma sessão nova para o e-mail não apontar para uma página genérica.
 */
async function processUrlFor(
  supabase: SupabaseClient,
  processId: string,
  token: string | null | undefined,
): Promise<string> {
  if (token) return processUrl(token)

  try {
    const created = await createSession(supabase, processId)
    return processUrl(created)
  } catch {
    return `${appUrl()}/continuar`
  }
}

function selectionOf(dto: ContractProcess): {
  planLabel: string | null
  serviceName: string | null
  totalCents: number | null
} {
  const plan =
    dto.product.paymentPlans.find((item) => item.id === dto.selectedPlanId) ?? null
  const service = plan?.serviceId
    ? (dto.product.services.find((item) => item.id === plan.serviceId) ?? null)
    : null

  return {
    planLabel: plan?.label ?? null,
    serviceName: service?.name ?? null,
    totalCents: dto.financial?.totalCents ?? plan?.totalCents ?? null,
  }
}

interface DeliverInput {
  processId: string | null
  messageType: string
  templateId: string
  recipients: string[]
  idempotencyKey: string
  email: RenderedEmail
}

async function deliver(supabase: SupabaseClient, input: DeliverInput): Promise<void> {
  if (input.recipients.length === 0) return

  if (!isResendConfigured()) {
    console.warn('[email] RESEND_API_KEY ausente: envio ignorado.')
    return
  }

  const logId = await claimMessage(supabase, input)
  if (!logId) return

  try {
    const result = await sendResendEmail({
      from: fromAddress(),
      to: input.recipients,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      replyTo: replyToAddress(),
      idempotencyKey: input.idempotencyKey,
      tags: [
        {
          name: 'tipo',
          value: input.messageType.toLowerCase().replace(/_/g, '-'),
        },
      ],
    })

    await supabase
      .from('message_logs')
      .update({
        status: 'SENT',
        external_message_id: result.id,
        sent_at: new Date().toISOString(),
        error_code: null,
      })
      .eq('id', logId)

    if (input.processId) {
      // Se havia falha anterior, o alerta deixa de estar aberto.
      await supabase
        .from('alerts')
        .update({ status: 'RESOLVED', resolved_at: new Date().toISOString() })
        .eq('alert_key', `email-failed:${input.processId}:${input.messageType}`)
        .eq('status', 'OPEN')
    }
  } catch (cause) {
    const code = cause instanceof ResendError ? cause.code : 'EMAIL_SEND_FAILED'
    const detail = cause instanceof Error ? cause.message : ''
    const stored = detail && detail !== code ? `${code}: ${detail}`.slice(0, 240) : code

    console.error(`[email] falha ao enviar ${input.messageType}:`, stored)

    await supabase
      .from('message_logs')
      .update({ status: 'FAILED', error_code: stored })
      .eq('id', logId)

    if (input.processId) {
      await ensureAlert(supabase, {
        key: `email-failed:${input.processId}:${input.messageType}`,
        title: 'Falha no envio de e-mail',
        description: `O e-mail "${input.email.subject}" não foi aceito pelo Resend (${stored}). Verifique a configuração e reenvie.`,
        processId: input.processId,
        severity: 'WARNING',
      })
    }
  }
}

/**
 * Reserva a linha em `message_logs`. Devolve `null` quando já foi enviada
 * (ou está em andamento). `FAILED` e `PLANNED` antigo (função interrompida)
 * podem ser reabertos.
 */
async function claimMessage(
  supabase: SupabaseClient,
  input: DeliverInput,
): Promise<string | null> {
  const { data: existing, error: lookupError } = await supabase
    .from('message_logs')
    .select('id, status, scheduled_at')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle<{ id: string; status: string; scheduled_at: string | null }>()

  if (lookupError) {
    console.error('[email] falha ao consultar idempotência:', lookupError.message)
    return null
  }

  if (existing) {
    const plannedAt = existing.scheduled_at ? new Date(existing.scheduled_at).getTime() : 0
    const abandoned =
      existing.status === 'PLANNED' && Date.now() - plannedAt > STALE_PLANNED_MS

    if (existing.status !== 'FAILED' && !abandoned) return null

    const { data: reopened, error: reopenError } = await supabase
      .from('message_logs')
      .update({
        status: 'PLANNED',
        error_code: null,
        scheduled_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('status', existing.status)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (reopenError) {
      console.error('[email] falha ao reabrir mensagem:', reopenError.message)
      return null
    }

    return reopened?.id ?? null
  }

  const { data: created, error: insertError } = await supabase
    .from('message_logs')
    .insert({
      contract_process_id: input.processId,
      provider: PROVIDER,
      message_type: input.messageType,
      recipient: input.recipients.join(', '),
      template_id: input.templateId,
      status: 'PLANNED',
      idempotency_key: input.idempotencyKey,
      scheduled_at: new Date().toISOString(),
    })
    .select('id')
    .single<{ id: string }>()

  if (insertError) {
    // 23505: outra requisição já reservou a mesma chave.
    if (insertError.code !== '23505') {
      console.error('[email] falha ao registrar mensagem:', insertError.message)
    }
    return null
  }

  return created.id
}

export interface EmailOptions {
  token?: string | null
}

/** Confirmação para o cliente + aviso interno, após dados/contrato validados. */
export async function sendSubmissionEmails(
  supabase: SupabaseClient,
  processId: string,
  options: EmailOptions = {},
): Promise<void> {
  const mode = readMode()
  if (mode === 'off') return

  try {
    const bundle = await loadProcessBundle(supabase, processId)
    if (!bundle) return

    const dto = mapProcessBundle(bundle)
    const selected = selectionOf(dto)
    const url = await processUrlFor(supabase, processId, options.token)
    const testMode = mode === 'test'

    const clientEmail = bundle.client?.email?.trim() ?? null

    if (clientEmail) {
      await deliver(supabase, {
        processId,
        messageType: MESSAGE_TYPES.submissionClient,
        templateId: 'client-submission-v1',
        recipients: recipientsFor([clientEmail], mode),
        idempotencyKey: `submission-client:${processId}`,
        email: renderClientSubmissionEmail({
          firstName: firstNameOf(dto.client.fullName),
          publicCode: dto.publicCode,
          serviceName: selected.serviceName,
          planLabel: selected.planLabel,
          totalCents: selected.totalCents,
          processUrl: url,
          testMode,
        }),
      })
    }

    await deliver(supabase, {
      processId,
      messageType: MESSAGE_TYPES.submissionTeam,
      templateId: 'team-submission-v1',
      recipients: recipientsFor(teamAddresses(), mode),
      idempotencyKey: `submission-team:${processId}`,
      email: renderTeamSubmissionEmail({
        clientName: dto.client.fullName?.trim() || 'Cliente',
        publicCode: dto.publicCode,
        email: clientEmail,
        phone: bundle.client?.phone_e164 ?? null,
        serviceName: selected.serviceName,
        planLabel: selected.planLabel,
        totalCents: selected.totalCents,
        adminUrl: `${appUrl()}/admin/processos/${processId}`,
        testMode,
      }),
    })
  } catch (cause) {
    console.error('[email] falha ao montar confirmação de cadastro:', cause)
  }
}

/** Confirmação final, quando assinatura, pagamento e documentos estão completos. */
export async function sendCompletionEmail(
  supabase: SupabaseClient,
  processId: string,
  options: EmailOptions = {},
): Promise<void> {
  const mode = readMode()
  if (mode === 'off') return

  try {
    const bundle = await loadProcessBundle(supabase, processId)
    if (!bundle) return

    const dto = mapProcessBundle(bundle)
    const clientEmail = bundle.client?.email?.trim() ?? null
    if (!clientEmail) return

    const selected = selectionOf(dto)
    const url = await processUrlFor(supabase, processId, options.token)

    await deliver(supabase, {
      processId,
      messageType: MESSAGE_TYPES.completedClient,
      templateId: 'client-completed-v1',
      recipients: recipientsFor([clientEmail], mode),
      idempotencyKey: `completion-client:${processId}`,
      email: renderClientCompletedEmail({
        firstName: firstNameOf(dto.client.fullName),
        publicCode: dto.publicCode,
        serviceName: selected.serviceName,
        processUrl: url,
        testMode: mode === 'test',
      }),
    })
  } catch (cause) {
    console.error('[email] falha ao montar confirmação de conclusão:', cause)
  }
}

/** Link de retomada pedido em `/continuar`. */
export async function sendAccessLinkEmail(
  supabase: SupabaseClient,
  input: { processId: string; email: string; token: string },
): Promise<void> {
  const mode = readMode()
  if (mode === 'off') return

  try {
    const bundle = await loadProcessBundle(supabase, input.processId)
    if (!bundle) return

    const dto = mapProcessBundle(bundle)

    await deliver(supabase, {
      processId: input.processId,
      messageType: MESSAGE_TYPES.accessLink,
      templateId: 'access-link-v1',
      recipients: recipientsFor([input.email], mode),
      idempotencyKey: `access-link:${input.processId}:${input.token.slice(-10)}`,
      email: renderAccessLinkEmail({
        firstName: firstNameOf(dto.client.fullName),
        publicCode: dto.publicCode,
        accessUrl: processUrl(input.token),
        testMode: mode === 'test',
      }),
    })
  } catch (cause) {
    console.error('[email] falha ao montar link de acesso:', cause)
  }
}
