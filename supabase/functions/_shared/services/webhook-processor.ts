/**
 * Processamento síncrono dos webhooks de assinatura e pagamento.
 *
 * A outbox continua existindo para integrações lentas (Drive, mensageria),
 * mas a liberação das etapas do formulário precisa refletir o evento assim que
 * ele chega. O handler é idempotente: repetir o mesmo evento não duplica
 * efeitos porque os estados são recalculados a partir das linhas atuais.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { DbPayment, DbProcess, DbSignature } from '../db/types.ts'
import { ensureAlert, recordEvent } from './process-log.ts'
import { getZapSignDocument } from './zapsign-client.ts'
import {
  finalizeSignedDocuments,
  requestInternalSignatures,
} from './contract-flow.ts'
import { markPaymentPaid, markPaymentStatus } from './asaas-service.ts'

export interface ZapSignPayload {
  event_type?: string
  token?: string
  external_id?: string
  status?: string
  signers?: Array<{ token?: string; status?: string; signed_at?: string }>
  signer_who_signed?: { token?: string; signed_at?: string }
}

export interface AsaasPayload {
  id?: string
  event?: string
  payment?: {
    id?: string
    externalReference?: string
    status?: string
    paymentDate?: string
    confirmedDate?: string
    clientPaymentDate?: string
  }
  checkout?: {
    id?: string
    status?: string
    externalReference?: string
  }
}

export async function processZapSignEvent(
  supabase: SupabaseClient,
  payload: ZapSignPayload,
): Promise<void> {
  const docToken = payload.token ?? ''
  const externalId = payload.external_id ?? ''

  let signature: DbSignature | null = null

  if (docToken) {
    const { data } = await supabase
      .from('signatures')
      .select('*')
      .eq('external_document_id', docToken)
      .maybeSingle<DbSignature>()
    signature = data
  }

  if (!signature && /^[0-9a-f-]{36}$/i.test(externalId)) {
    const { data } = await supabase
      .from('signatures')
      .select('*')
      .eq('id', externalId)
      .maybeSingle<DbSignature>()
    signature = data
  }

  if (!signature) {
    console.warn('[zapsign] assinatura não encontrada para o evento')
    return
  }

  const processId = signature.contract_process_id
  const eventType = payload.event_type ?? 'unknown'

  if (eventType === 'doc_refused') {
    await supabase
      .from('signatures')
      .update({ status: 'RECUSADA', last_event_at: new Date().toISOString() })
      .eq('id', signature.id)

    await supabase
      .from('contract_processes')
      .update({
        signature_status: 'RECUSADA',
        general_status: 'ERRO_REQUER_INTERVENCAO',
      })
      .eq('id', processId)

    await ensureAlert(supabase, {
      key: `signature-refused:${processId}`,
      title: 'Assinatura recusada',
      description: 'O cliente recusou a assinatura. Revise o contrato e reenvie.',
      processId,
      severity: 'CRITICAL',
    })

    await recordEvent(supabase, processId, {
      type: 'SIGNATURE_REFUSED',
      title: 'Assinatura recusada',
      description: 'O cliente recusou a assinatura do contrato.',
      actorType: 'CLIENT',
    })
    return
  }

  if (eventType === 'doc_deleted') {
    await supabase
      .from('signatures')
      .update({ status: 'CANCELADA', last_event_at: new Date().toISOString() })
      .eq('id', signature.id)
    return
  }

  if (eventType !== 'doc_signed' && payload.status !== 'signed') return

  const signerWhoSigned = payload.signer_who_signed?.token
  const payloadSignerToken =
    signerWhoSigned ??
    payload.signers?.find((signer) => signer.signed_at || signer.status === 'signed')?.token

  let signedFileUrl: string | null = signature.signed_file_url
  let clientSigned = false
  let internalSigned = false

  try {
    if (signature.external_document_id) {
      const document = await getZapSignDocument(signature.external_document_id)
      signedFileUrl = document.signedFileUrl ?? signedFileUrl

      const clientToken = signature.external_signer_id
      const internalToken = signature.external_internal_signer_id

      clientSigned = clientToken
        ? document.signers.some(
            (signer) => signer.token === clientToken && signer.status === 'signed',
          )
        : Boolean(payloadSignerToken && payloadSignerToken !== internalToken)

      internalSigned = internalToken
        ? document.signers.some(
            (signer) => signer.token === internalToken && signer.status === 'signed',
          )
        : false
    }
  } catch (cause) {
    // O payload ainda permite distinguir cliente e advogada pelo token.
    console.error('[zapsign] falha ao detalhar documento no webhook:', cause)
    clientSigned = Boolean(
      payloadSignerToken && payloadSignerToken !== signature.external_internal_signer_id,
    )
    internalSigned = Boolean(
      payloadSignerToken &&
        signature.external_internal_signer_id &&
        payloadSignerToken === signature.external_internal_signer_id,
    )
  }

  if (!clientSigned && !internalSigned) {
    // Alguns eventos chegam sem o token do signatário; usa a mudança de status
    // do documento como fallback para não travar o fluxo.
    clientSigned = true
  }

  const signedAt =
    payload.signer_who_signed?.signed_at ??
    payload.signers?.find((signer) => signer.signed_at)?.signed_at ??
    new Date().toISOString()

  await supabase
    .from('signatures')
    .update({
      status: internalSigned
        ? 'ASSINADA_COMPLETA'
        : clientSigned
          ? 'ASSINADA_CLIENTE'
          : 'PENDENTE',
      signed_at: signedAt,
      signed_file_url: signedFileUrl,
      last_event_at: new Date().toISOString(),
    })
    .eq('id', signature.id)

  const { data: rows } = await supabase
    .from('signatures')
    .select('*')
    .eq('contract_process_id', processId)

  const signatures = (rows ?? []) as DbSignature[]

  const refused = signatures.some((row) => row.status === 'RECUSADA')
  if (refused) return

  const allClientSigned =
    signatures.length > 0 &&
    signatures.every((row) =>
      ['ASSINADA_CLIENTE', 'ASSINADA_COMPLETA'].includes(row.status),
    )
  const allComplete =
    signatures.length > 0 &&
    signatures.every((row) => row.status === 'ASSINADA_COMPLETA')

  if (allComplete) {
    const process = await loadProcess(supabase, processId)
    if (process && process.signature_status !== 'ASSINADA_COMPLETA') {
      await finalizeSignedDocuments(supabase, processId)
    }
    return
  }

  if (allClientSigned) {
    await requestInternalSignatures(supabase, processId)
    return
  }

  await supabase
    .from('contract_processes')
    .update({
      signature_status: 'PENDENTE',
      general_status: 'AGUARDANDO_ASSINATURA_CLIENTE',
      current_step: 'assinatura',
    })
    .eq('id', processId)

  await recordEvent(supabase, processId, {
    type: 'SIGNATURE_PARTIAL',
    title: 'Assinatura recebida',
    description: 'Um dos documentos foi assinado. Aguardando os demais.',
    actorType: 'CLIENT',
  })
}

const PAID_EVENTS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_RECEIVED_IN_CASH',
  'CHECKOUT_PAID',
])

const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
const CANCELED_EVENTS = new Set(['PAYMENT_REFUNDED', 'PAYMENT_DELETED'])
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE', 'CHECKOUT_EXPIRED'])

export async function processAsaasEvent(
  supabase: SupabaseClient,
  payload: AsaasPayload,
): Promise<void> {
  const eventType = payload.event ?? ''
  const checkout = payload.checkout
  const paymentPayload = payload.payment
  const externalReference =
    checkout?.externalReference ?? paymentPayload?.externalReference ?? ''

  const payment = await findPaymentRow(
    supabase,
    paymentPayload?.id ?? null,
    externalReference,
    checkout?.id ?? null,
  )

  if (!payment) {
    console.warn('[asaas] cobrança não encontrada para o evento')
    return
  }

  const processId = payment.contract_process_id

  if (
    PAID_EVENTS.has(eventType) ||
    checkout?.status === 'PAID' ||
    (paymentPayload?.status ? PAID_STATUSES.has(paymentPayload.status) : false)
  ) {
    const paidAt =
      paymentPayload?.paymentDate ??
      paymentPayload?.confirmedDate ??
      paymentPayload?.clientPaymentDate ??
      new Date().toISOString()

    await markPaymentPaid(supabase, processId, payment, paidAt)
    return
  }

  if (
    CANCELED_EVENTS.has(eventType) ||
    checkout?.status === 'CANCELED' ||
    paymentPayload?.status === 'REFUNDED' ||
    paymentPayload?.status === 'REFUND_REQUESTED'
  ) {
    await markPaymentStatus(
      supabase,
      processId,
      payment,
      paymentPayload?.status === 'REFUNDED' ? 'ESTORNADO' : 'CANCELADO',
    )
    return
  }

  if (
    OVERDUE_EVENTS.has(eventType) ||
    checkout?.status === 'EXPIRED' ||
    paymentPayload?.status === 'OVERDUE'
  ) {
    await markPaymentStatus(supabase, processId, payment, 'VENCIDO')
  }
}

async function loadProcess(
  supabase: SupabaseClient,
  processId: string,
): Promise<DbProcess | null> {
  const { data } = await supabase
    .from('contract_processes')
    .select('*')
    .eq('id', processId)
    .maybeSingle<DbProcess>()

  return data
}

async function findPaymentRow(
  supabase: SupabaseClient,
  externalChargeId: string | null,
  externalReference: string,
  checkoutId: string | null,
): Promise<DbPayment | null> {
  if (externalChargeId) {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('external_charge_id', externalChargeId)
      .maybeSingle<DbPayment>()
    if (data) return data
  }

  if (externalReference) {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('external_reference', externalReference)
      .maybeSingle<DbPayment>()
    if (data) return data
  }

  if (checkoutId) {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('external_charge_id', checkoutId)
      .maybeSingle<DbPayment>()
    if (data) return data
  }

  const match = /^([0-9a-f-]{36})/i.exec(externalReference)
  const processId = match?.[1]
  if (processId) {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('contract_process_id', processId)
      .order('installment_number', { ascending: true })
      .limit(1)
      .maybeSingle<DbPayment>()
    if (data) return data
  }

  return null
}
