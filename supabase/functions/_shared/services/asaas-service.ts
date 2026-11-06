/**
 * Ordem de cobrança do Asaas.
 *
 * 1. Etapa 2: cria apenas o cliente no Asaas.
 * 2. Assinatura completa (cliente + Dra. Roberta): cria sinal/entrada.
 * 3. Sinal/entrada pago: cria as parcelas restantes e libera documentos.
 *
 * Nenhuma função aqui marca todas as cobranças como pagas: o webhook sempre
 * aponta para uma cobrança específica (`external_charge_id` ou
 * `external_reference`).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { loadProcessBundle } from '../db/queries.ts'
import type { DbClient, DbPayment, DbPaymentPlan, ProcessBundle } from '../db/types.ts'
import { computePaymentStatus } from '../domain/workflow.ts'
import type { PaymentStatus } from '../domain/types.ts'
import { todayInSaoPaulo } from '../domain/dates.ts'
import { ensureAlert, recordEvent } from './process-log.ts'
import {
  createAsaasCustomer,
  createAsaasPayment,
  findAsaasCustomerByCpf,
  isAsaasConfigured,
} from './asaas-client.ts'

export async function ensureAsaasCustomer(
  supabase: SupabaseClient,
  processId: string,
  client: DbClient | null,
): Promise<string | null> {
  if (!client) return null
  if (client.external_asaas_customer_id) return client.external_asaas_customer_id
  if (!isAsaasConfigured()) return null

  const address = asObject(client.address)

  try {
    const existing = await findAsaasCustomerByCpf(client.cpf)
    const customerId =
      existing?.id ??
      (
        await createAsaasCustomer({
          name: client.full_name,
          cpfCnpj: client.cpf,
          email: client.email,
          mobilePhone: client.phone_e164?.replace(/\D+/g, '') ?? null,
          postalCode: stringValue(address.cep),
          address: stringValue(address.logradouro),
          addressNumber: stringValue(address.numero),
          complement: stringValue(address.complemento),
          province: stringValue(address.bairro),
          externalReference: processId,
        })
      ).id

    const { error } = await supabase
      .from('clients')
      .update({ external_asaas_customer_id: customerId })
      .eq('id', client.id)

    if (error) {
      console.error('[asaas] falha ao salvar cliente no cadastro:', error.message)
      throw new Error('ASAAS_CUSTOMER_SAVE_FAILED')
    }

    await recordEvent(supabase, processId, {
      type: 'ASAAS_CUSTOMER_READY',
      title: 'Cliente criado no Asaas',
      description: 'O cadastro do cliente foi criado/reutilizado no Asaas.',
      actorType: 'SYSTEM',
    })

    return customerId
  } catch (cause) {
    console.error('[asaas] falha ao garantir cliente:', cause)
    await ensureAlert(supabase, {
      key: `asaas-customer-failed:${processId}`,
      title: 'Falha ao criar cliente no Asaas',
      description:
        'Não foi possível criar o cliente no Asaas. Verifique a API key e os dados cadastrais.',
      processId,
      severity: 'CRITICAL',
    })
    return null
  }
}

/**
 * Cria as cobranças de sinal/entrada (ou a primeira parcela quando não há
 * sinal nem entrada). Chamado quando o contrato está completamente assinado.
 */
export async function createUpfrontCharges(
  supabase: SupabaseClient,
  processId: string,
): Promise<void> {
  const bundle = await loadProcessBundle(supabase, processId)
  if (!bundle) return

  const target = upfrontPayments(bundle)
  if (target.length === 0) return

  if (!isAsaasConfigured()) {
    await ensureAlert(supabase, {
      key: `asaas-not-configured:${processId}`,
      title: 'Asaas não configurado',
      description: 'Cadastre ASAAS_API_KEY para criar a cobrança de sinal/entrada.',
      processId,
      severity: 'CRITICAL',
    })
    return
  }

  const customerId = await ensureAsaasCustomer(supabase, processId, bundle.client)
  if (!customerId) return

  const plan = bundle.plans.find((item) => item.id === bundle.process.selected_plan_id)
  const service = bundle.services.find(
    (item) =>
      item.id ===
      (bundle.process.selected_service_id ?? plan?.service_id ?? ''),
  )

  for (const payment of target) {
    if (payment.external_charge_id) continue

    await createChargeForPayment(supabase, processId, payment, plan, customerId, service?.name)
  }

  await recordEvent(supabase, processId, {
    type: 'ASAAS_UPFRONT_CREATED',
    title: 'Cobrança inicial criada',
    description: 'Sinal/entrada foi criado no Asaas após a assinatura completa.',
    actorType: 'SYSTEM',
    payload: { payments: target.map((payment) => payment.installment_number) },
  })
}

/**
 * Cria as parcelas restantes. Chamado quando o sinal/entrada é confirmado.
 */
export async function createRemainingCharges(
  supabase: SupabaseClient,
  processId: string,
): Promise<void> {
  const bundle = await loadProcessBundle(supabase, processId)
  if (!bundle) return

  const upfrontIds = new Set(upfrontPayments(bundle).map((payment) => payment.id))
  const remaining = bundle.payments.filter(
    (payment) => !upfrontIds.has(payment.id) && !payment.external_charge_id,
  )

  if (remaining.length === 0) return
  if (!isAsaasConfigured()) return

  const customerId = await ensureAsaasCustomer(supabase, processId, bundle.client)
  if (!customerId) return

  const plan = bundle.plans.find((item) => item.id === bundle.process.selected_plan_id)
  const service = bundle.services.find((item) => item.id === bundle.process.selected_service_id)

  for (const payment of remaining) {
    await createChargeForPayment(supabase, processId, payment, plan, customerId, service?.name)
  }

  await recordEvent(supabase, processId, {
    type: 'ASAAS_INSTALLMENTS_CREATED',
    title: 'Parcelas criadas',
    description: 'As parcelas restantes foram criadas no Asaas após o pagamento do sinal/entrada.',
    actorType: 'SYSTEM',
    payload: { payments: remaining.map((payment) => payment.installment_number) },
  })
}

async function createChargeForPayment(
  supabase: SupabaseClient,
  processId: string,
  payment: DbPayment,
  plan: DbPaymentPlan | undefined,
  customerId: string,
  serviceName: string | undefined,
): Promise<void> {
  const billingType = billingTypeFor(plan)
  const label =
    payment.payment_type === 'SIGNAL'
      ? 'Sinal'
      : payment.payment_type === 'ENTRY'
        ? 'Entrada'
        : `Parcela ${payment.installment_number}`

  try {
    const charge = await createAsaasPayment({
      customerId,
      billingType,
      valueCents: payment.amount_cents,
      dueDate: payment.due_date,
      description: `${serviceName ?? 'Honorários'} - ${label}`,
      externalReference: payment.external_reference ?? `${processId}:${payment.id}`,
    })

    const { error } = await supabase
      .from('payments')
      .update({
        external_customer_id: customerId,
        external_charge_id: charge.id,
        external_installment_id: charge.installmentId,
        invoice_url: charge.invoiceUrl,
        status: 'PENDENTE',
      })
      .eq('id', payment.id)

    if (error) {
      console.error('[asaas] falha ao salvar cobrança:', error.message)
      throw new Error('ASAAS_PAYMENT_SAVE_FAILED')
    }
  } catch (cause) {
    console.error('[asaas] falha ao criar cobrança:', cause)
    await ensureAlert(supabase, {
      key: `asaas-charge-failed:${processId}:${payment.id}`,
      title: 'Falha ao criar cobrança',
      description: 'O Asaas não respondeu como esperado. A cobrança será tentada novamente.',
      processId,
      severity: 'CRITICAL',
    })
    throw cause
  }
}

/**
 * Marca uma cobrança específica como paga e recalcula o processo. Retorna o
 * status consolidado para o webhook decidir se libera documentos.
 */
export async function markPaymentPaid(
  supabase: SupabaseClient,
  processId: string,
  payment: DbPayment,
  paidAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'PAGO', paid_at: paidAt })
    .eq('id', payment.id)

  if (error) {
    console.error('[asaas] falha ao marcar cobrança paga:', error.message)
    throw new Error('ASAAS_PAYMENT_UPDATE_FAILED')
  }

  await refreshProcessPaymentState(supabase, processId)

  await recordEvent(supabase, processId, {
    type: 'PAYMENT_CONFIRMED',
    title: 'Pagamento confirmado',
    description:
      payment.payment_type === 'SIGNAL'
        ? 'O Asaas confirmou o pagamento do sinal.'
        : payment.payment_type === 'ENTRY'
          ? 'O Asaas confirmou o pagamento da entrada.'
          : `O Asaas confirmou o pagamento da parcela ${payment.installment_number}.`,
    actorType: 'SYSTEM',
    payload: { paymentId: payment.id, paidAt },
  })
}

export async function markPaymentStatus(
  supabase: SupabaseClient,
  processId: string,
  payment: DbPayment,
  status: 'VENCIDO' | 'CANCELADO' | 'ESTORNADO',
): Promise<void> {
  await supabase.from('payments').update({ status }).eq('id', payment.id)
  await refreshProcessPaymentState(supabase, processId)

  await recordEvent(supabase, processId, {
    type: `PAYMENT_${status}`,
    title: 'Atualização de pagamento',
    description: `A cobrança ${payment.installment_number} foi atualizada para ${status}.`,
    actorType: 'SYSTEM',
    payload: { paymentId: payment.id },
  })
}

export async function refreshProcessPaymentState(
  supabase: SupabaseClient,
  processId: string,
): Promise<void> {
  const bundle = await loadProcessBundle(supabase, processId)
  if (!bundle) return

  const paymentStatus = computePaymentStatus(
    bundle.payments.map((payment) => ({ status: payment.status as PaymentStatus })),
  )

  const upfront = upfrontPayments(bundle)
  const upfrontPaid =
    upfront.length > 0 && upfront.every((payment) => payment.status === 'PAGO')
  const documentsDone = bundle.process.documents_status === 'COMPLETA'
  const completed = new Set(bundle.process.completed_steps)

  if (upfrontPaid) {
    completed.add('assinatura')
    completed.add('pagamento')
  }

  if (documentsDone && paymentStatus === 'PAGO') completed.add('documentos')

  let generalStatus = bundle.process.general_status
  let currentStep = bundle.process.current_step

  if (documentsDone && paymentStatus === 'PAGO') {
    generalStatus = 'CONCLUIDO'
    currentStep = 'documentos'
  } else if (upfrontPaid) {
    generalStatus = 'AGUARDANDO_DOCUMENTOS'
    currentStep = 'documentos'
  } else if (paymentStatus === 'PENDENTE' || paymentStatus === 'PARCIAL') {
    generalStatus = 'AGUARDANDO_PAGAMENTO'
    currentStep = 'pagamento'
  }

  const { error } = await supabase
    .from('contract_processes')
    .update({
      payment_status: paymentStatus,
      general_status: generalStatus,
      current_step: currentStep,
      completed_steps: [...completed],
      ...(documentsDone && paymentStatus === 'PAGO'
        ? { completed_at: bundle.process.completed_at ?? new Date().toISOString() }
        : {}),
    })
    .eq('id', processId)

  if (error) {
    console.error('[asaas] falha ao atualizar processo:', error.message)
    throw new Error('ASAAS_PROCESS_UPDATE_FAILED')
  }

  if (upfrontPaid) {
    await createRemainingCharges(supabase, processId)
  }
}

/** Cobranças iniciais: sinal + entrada ou, sem elas, a primeira parcela. */
export function upfrontPayments(bundle: ProcessBundle): DbPayment[] {
  const ordered = bundle.payments
    .slice()
    .sort((a, b) => a.installment_number - b.installment_number)
  const explicit = ordered.filter(
    (payment) => payment.payment_type === 'SIGNAL' || payment.payment_type === 'ENTRY',
  )

  if (explicit.length > 0) return explicit
  const first = ordered[0]
  return first ? [first] : []
}

function billingTypeFor(plan: DbPaymentPlan | undefined): 'PIX' | 'BOLETO' | 'CREDIT_CARD' {
  if (plan?.method === 'CARD') return 'CREDIT_CARD'
  if (plan?.method === 'BOLETO') return 'BOLETO'
  return 'PIX'
}

export function paymentReference(processId: string, payment: DbPayment): string {
  return payment.external_reference ?? `${processId}:${payment.payment_type}:${payment.installment_number}`
}

export function todayIso(): string {
  return todayInSaoPaulo()
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}
