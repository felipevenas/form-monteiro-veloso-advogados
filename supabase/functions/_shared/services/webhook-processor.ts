/**
 * Processamento síncrono dos webhooks de assinatura e pagamento.
 *
 * A outbox continua existindo para integrações lentas (Drive, mensageria),
 * mas a liberação das etapas do formulário precisa refletir o evento assim que
 * ele chega. O handler é idempotente: repetir o mesmo evento não duplica
 * efeitos porque os estados são recalculados a partir das linhas atuais.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { DbProcess, DbSignature } from '../db/types.ts'
import { runInBackground } from '../http/background.ts'
import { sendCompletionEmail } from './email-service.ts'
import { ensureAlert, recordEvent } from './process-service.ts'

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
  const signedAt =
    payload.signer_who_signed?.signed_at ??
    payload.signers?.find((signer) => signer.signed_at)?.signed_at ??
    new Date().toISOString()

  if (eventType === 'doc_signed' || payload.status === 'signed') {
    await supabase
      .from('signatures')
      .update({
        status: 'ASSINADA_CLIENTE',
        signed_at: signedAt,
        last_event_at: new Date().toISOString(),
      })
      .eq('id', signature.id)
  } else if (eventType === 'doc_refused') {
    await supabase
      .from('signatures')
      .update({ status: 'RECUSADA', last_event_at: new Date().toISOString() })
      .eq('id', signature.id)
  } else if (eventType === 'doc_deleted') {
    await supabase
      .from('signatures')
      .update({ status: 'CANCELADA', last_event_at: new Date().toISOString() })
      .eq('id', signature.id)
  } else {
    return
  }

  const { data: rows } = await supabase
    .from('signatures')
    .select('*')
    .eq('contract_process_id', processId)

  const signatures = (rows ?? []) as DbSignature[]
  const allSigned =
    signatures.length > 0 &&
    signatures.every((row) =>
      ['ASSINADA_CLIENTE', 'ASSINADA_COMPLETA'].includes(row.status),
    )

  if (allSigned) {
    await supabase
      .from('signatures')
      .update({ status: 'ASSINADA_COMPLETA' })
      .eq('contract_process_id', processId)
  }

  const refused = signatures.some((row) => row.status === 'RECUSADA')

  if (refused) {
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

  if (!allSigned) {
    await supabase
      .from('contract_processes')
      .update({
        signature_status: 'ASSINADA_CLIENTE',
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
    return
  }

  const process = await loadProcess(supabase, processId)
  if (!process) return

  const completed = new Set(process.completed_steps)
  completed.add('assinatura')

  await supabase
    .from('contract_processes')
    .update({
      signature_status: 'ASSINADA_COMPLETA',
      general_status: 'AGUARDANDO_PAGAMENTO',
      current_step: 'pagamento',
      completed_steps: [...completed],
      version: process.version + 1,
    })
    .eq('id', processId)

  await recordEvent(supabase, processId, {
    type: 'SIGNATURE_COMPLETED',
    title: 'Assinatura concluída',
    description: 'Todos os documentos foram assinados. O pagamento foi liberado.',
    actorType: 'CLIENT',
  })
}

const PAID_EVENTS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_RECEIVED_IN_CASH',
  'CHECKOUT_PAID',
])

const CANCELED_EVENTS = new Set(['PAYMENT_REFUNDED', 'PAYMENT_DELETED'])
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE', 'CHECKOUT_EXPIRED'])

export async function processAsaasEvent(
  supabase: SupabaseClient,
  payload: AsaasPayload,
): Promise<void> {
  const eventType = payload.event ?? ''
  const checkout = payload.checkout
  const payment = payload.payment
  const externalReference = checkout?.externalReference ?? payment?.externalReference ?? ''

  let processId: string | null = null

  if (/^[0-9a-f-]{36}$/i.test(externalReference)) {
    const { data } = await supabase
      .from('contract_processes')
      .select('id')
      .eq('id', externalReference)
      .maybeSingle<{ id: string }>()
    processId = data?.id ?? null
  }

  if (!processId && checkout?.id) {
    const { data } = await supabase
      .from('payments')
      .select('contract_process_id')
      .eq('external_charge_id', checkout.id)
      .maybeSingle<{ contract_process_id: string }>()
    processId = data?.contract_process_id ?? null
  }

  if (!processId && payment?.id) {
    const { data } = await supabase
      .from('payments')
      .select('contract_process_id')
      .eq('external_charge_id', payment.id)
      .maybeSingle<{ contract_process_id: string }>()
    processId = data?.contract_process_id ?? null
  }

  if (!processId) {
    console.warn('[asaas] processo não encontrado para o evento')
    return
  }

  const process = await loadProcess(supabase, processId)
  if (!process) return

  if (PAID_EVENTS.has(eventType) || checkout?.status === 'PAID') {
    await markPaid(supabase, process)
    return
  }

  if (CANCELED_EVENTS.has(eventType) || checkout?.status === 'CANCELED') {
    await supabase
      .from('payments')
      .update({ status: 'CANCELADO' })
      .eq('contract_process_id', processId)

    await supabase
      .from('contract_processes')
      .update({ payment_status: 'CANCELADO', general_status: 'AGUARDANDO_PAGAMENTO' })
      .eq('id', processId)

    await recordEvent(supabase, processId, {
      type: 'PAYMENT_CANCELED',
      title: 'Pagamento cancelado',
      description: 'O checkout foi cancelado. Um novo pagamento pode ser gerado.',
      actorType: 'SYSTEM',
    })
    return
  }

  if (OVERDUE_EVENTS.has(eventType) || checkout?.status === 'EXPIRED') {
    await supabase
      .from('payments')
      .update({ status: 'VENCIDO' })
      .eq('contract_process_id', processId)

    await supabase
      .from('contract_processes')
      .update({ payment_status: 'VENCIDO', general_status: 'AGUARDANDO_PAGAMENTO' })
      .eq('id', processId)

    await recordEvent(supabase, processId, {
      type: 'PAYMENT_EXPIRED',
      title: 'Pagamento expirado',
      description: 'O checkout expirou. Gere um novo pagamento para continuar.',
      actorType: 'SYSTEM',
    })
  }
}

async function markPaid(supabase: SupabaseClient, process: DbProcess): Promise<void> {
  const paidAt = new Date().toISOString()

  await supabase
    .from('payments')
    .update({ status: 'PAGO', paid_at: paidAt })
    .eq('contract_process_id', process.id)

  const completed = new Set(process.completed_steps)
  completed.add('assinatura')
  completed.add('pagamento')

  const documentsDone = process.documents_status === 'COMPLETA'

  if (documentsDone) completed.add('documentos')

  await supabase
    .from('contract_processes')
    .update({
      payment_status: 'PAGO',
      general_status: documentsDone ? 'CONCLUIDO' : 'AGUARDANDO_DOCUMENTOS',
      current_step: 'documentos',
      completed_steps: [...completed],
      ...(documentsDone ? { completed_at: paidAt } : {}),
      version: process.version + 1,
    })
    .eq('id', process.id)

  await recordEvent(supabase, process.id, {
    type: 'PAYMENT_CONFIRMED',
    title: 'Pagamento confirmado',
    description: 'O Asaas confirmou o pagamento. Os documentos foram liberados.',
    actorType: 'SYSTEM',
    payload: { paidAt },
  })

  // Documentos já estavam completos: este evento fecha o processo. Se a
  // conclusão vier pelo upload, quem dispara é `refreshDocumentsStatus`.
  if (documentsDone && process.general_status !== 'CONCLUIDO') {
    runInBackground(sendCompletionEmail(supabase, process.id))
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
