/**
 * Casos de uso do processo de contratação.
 *
 * A API só responde depois de persistir. Operações externas são enfileiradas;
 * nenhuma tela marca uma etapa como concluída.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { loadHolidays, loadProcessBundle, findProductContext } from '../db/queries.ts'
import { mapFormSchema, mapProcessBundle } from '../db/mappers.ts'
import type { DbClient, DbProcess, DbProductService, ProcessBundle } from '../db/types.ts'
import { fail } from '../http/errors.ts'
import { todayInSaoPaulo } from '../domain/dates.ts'
import { buildFinancialSnapshot } from '../domain/financial.ts'
import { isValidCpf } from '../domain/cpf.ts'
import { toE164Br } from '../domain/phone.ts'
import { mergeDeep } from '../domain/merge.ts'
import {
  createZapSignDocument,
  isZapSignConfigured,
} from './zapsign-client.ts'
import { createAsaasCheckout, isAsaasConfigured } from './asaas-client.ts'
import { ensureAlert, recordEvent } from './process-log.ts'
import { createSession } from './session-service.ts'
import { sendSubmissionEmails } from './email-service.ts'
import { runInBackground } from '../http/background.ts'
import { normalizeStepValues, validateStep } from '../domain/form-validation.ts'
import {
  WIZARD_STEP_ORDER,
  type ContractProcess,
  type FinancialSnapshot,
  type FormStep,
  type ServiceObjectType,
  type WizardStepId,
} from '../domain/types.ts'

/**
 * Depois que o contrato entra em geração/assinatura, os dados do cliente e a
 * escolha de serviço/plano ficam congelados. Reabertura é operação de admin.
 */
const FROZEN_STATUSES = new Set([
  'CONTRATO_EM_GERACAO',
  'AGUARDANDO_ASSINATURA_CLIENTE',
  'AGUARDANDO_ASSINATURA_INTERNA',
  'AGUARDANDO_PAGAMENTO',
  'AGUARDANDO_DOCUMENTOS',
  'DOCUMENTOS_EM_PROCESSAMENTO',
  'DOCUMENTACAO_CONCLUIDA',
  'CONCLUIDO',
  'CANCELADO',
  'ERRO_REQUER_INTERVENCAO',
])

function isProcessFrozen(process: DbProcess): boolean {
  return (
    FROZEN_STATUSES.has(process.general_status) ||
    process.signature_status !== 'NAO_GERADA'
  )
}

function assertProcessEditable(process: DbProcess): void {
  if (isProcessFrozen(process)) {
    throw fail.conflict(
      'PROCESS_FROZEN',
      'Este processo já foi enviado para assinatura e não pode mais ser alterado pelo formulário.',
    )
  }
}

export interface StartInput {
  productSlug?: string
  attribution?: Record<string, string>
}

export interface StartResult {
  token: string
  processId: string
}

export async function startProcess(
  supabase: SupabaseClient,
  input: StartInput,
): Promise<StartResult> {
  const context = await findProductContext(supabase, input.productSlug)
  if (!context) {
    throw fail.unprocessable(
      'PRODUCT_NOT_AVAILABLE',
      'Este produto não está disponível para contratação no momento.',
    )
  }

  let process: DbProcess | null = null
  let lastError: string | null = null

  for (let attempt = 0; attempt < 5 && !process; attempt += 1) {
    const publicCode = generatePublicCode()

    const { data, error } = await supabase
      .from('contract_processes')
      .insert({
        public_code: publicCode,
        product_id: context.product.id,
        product_version_id: context.version.id,
        general_status: 'DADOS_PENDENTES',
        current_step: 'identificacao',
        completed_steps: [],
        form_data: {},
        unlock_condition: context.version.unlock_condition,
        attribution: input.attribution ?? {},
      })
      .select('*')
      .single<DbProcess>()

    if (error) {
      lastError = error.message
      // 23505 = unique_violation do public_code; tenta outro código.
      if (error.code !== '23505') {
        console.error('[process] falha ao criar processo:', error.message)
        throw fail.internal()
      }
      continue
    }

    process = data
  }

  if (!process) {
    console.error('[process] não foi possível gerar código único:', lastError)
    throw fail.internal()
  }

  const token = await createSession(supabase, process.id)

  await recordEvent(supabase, process.id, {
    type: 'PROCESS_STARTED',
    title: 'Processo iniciado',
    description: 'Seu processo de contratação foi criado.',
  })

  return { token, processId: process.id }
}

export { createSession }

export async function saveStep(
  supabase: SupabaseClient,
  process: DbProcess,
  stepId: string,
  values: unknown,
): Promise<ContractProcess> {
  if (!isWizardStep(stepId)) {
    throw fail.unprocessable('INVALID_STEP', 'Etapa inválida.')
  }

  if (stepId !== 'dados' && stepId !== 'contrato') {
    throw fail.unprocessable('INVALID_STEP', 'Esta etapa não é editável pelo formulário.')
  }

  assertProcessEditable(process)

  const bundle = await loadProcessBundle(supabase, process.id)
  if (!bundle) throw fail.notFound('Processo não encontrado.')

  const steps = mapFormSchema(bundle.version.form_schema)
  const step = steps.find((item) => item.id === stepId)
  if (!step) throw fail.unprocessable('STEP_NOT_FOUND', 'Etapa não configurada para este produto.')

  const currentIndex = WIZARD_STEP_ORDER.indexOf(process.current_step as WizardStepId)
  const requestedIndex = WIZARD_STEP_ORDER.indexOf(stepId)
  const completed = new Set(process.completed_steps)

  if (requestedIndex > currentIndex + 1) {
    throw fail.conflict('STEP_OUT_OF_ORDER', 'Conclua a etapa anterior antes de avançar.')
  }

  if (!isRecord(values)) {
    throw fail.invalidInput('Envie os valores da etapa.')
  }

  const service = stepId === 'contrato' ? resolveContractService(bundle, values) : null
  const context = service
    ? { objectType: service.object_type as ServiceObjectType }
    : undefined

  let normalized = normalizeStepValues(step, values, context)
  const issues = validateStep(step, normalized, context)

  if (issues.length > 0) {
    throw fail.unprocessable('VALIDATION_FAILED', 'Revise os campos destacados.', issues)
  }

  if (service) {
    normalized = applyServiceToValues(normalized, step, service)
  }

  let clientId = process.client_id

  if (stepId === 'dados') {
    const client = await ensureClient(supabase, process, normalized)
    clientId = client.id
    if (client.shouldUpdateAddress) {
      await updateClientAddress(supabase, client.id, normalized)
    }
  }

  const formData = mergeDeep(process.form_data, normalized)
  completed.add(stepId)

  const nextStep = stepId === 'dados' ? 'contrato' : 'assinatura'
  const nextGeneralStatus =
    stepId === 'contrato'
      ? 'PRONTO_PARA_CONTRATO'
      : process.general_status === 'INICIADO'
        ? 'DADOS_PENDENTES'
        : process.general_status

  const { data: updated, error } = await supabase
    .from('contract_processes')
    .update({
      client_id: clientId,
      form_data: formData,
      selected_service_id: service?.id ?? process.selected_service_id,
      completed_steps: [...completed],
      current_step: nextStep,
      general_status: nextGeneralStatus,
    })
    .eq('id', process.id)
    .select('*')
    .single<DbProcess>()

  if (error) {
    console.error('[process] falha ao salvar etapa:', error.message)
    throw fail.internal()
  }

  await recordEvent(supabase, process.id, {
    type: 'STEP_SAVED',
    title: 'Etapa salva',
    description: `Etapa "${step.title}" atualizada.`,
    actorType: 'CLIENT',
    payload: { step: stepId },
  })

  return loadDto(supabase, updated.id)
}

/**
 * O formulário v1 não escolhe serviço na etapa `contrato` — o plano é que
 * aponta o serviço. A partir da v2 a escolha é explícita e cada serviço tem
 * kit próprio, então `produto` passa a ser obrigatório.
 */
function resolveContractService(
  bundle: ProcessBundle,
  values: Record<string, unknown>,
): DbProductService | null {
  const serviceCode = stringValue(values.produto)
  const requiresService =
    bundle.version.version >= 2 || bundle.services.some((item) => Boolean(item.kit_code))

  if (!serviceCode) {
    if (requiresService) {
      throw fail.unprocessable('SERVICE_REQUIRED', 'Escolha o serviço contratado.')
    }
    return null
  }

  const service = bundle.services.find((item) => item.code === serviceCode) ?? null
  if (!service) {
    throw fail.unprocessable('SERVICE_NOT_FOUND', 'Serviço inválido para este produto.')
  }

  return service
}

/** Fixa o serviço no form_data e apaga o objeto que não se aplica. */
function applyServiceToValues(
  normalized: Record<string, unknown>,
  step: FormStep,
  service: DbProductService,
): Record<string, unknown> {
  let result = mergeDeep(normalized, { produto: service.code })

  if (service.object_type !== 'BANK') {
    result = clearStepField(result, step, 'banco_instituicao_financeira')
  }

  if (service.object_type !== 'PUBLIC_ENTITY') {
    result = clearStepField(result, step, 'ente_federativo_e_lei_aplicavel')
  }

  return result
}

/**
 * Zera o campo no caminho mapeado (ex.: `extra.banco_instituicao_financeira`),
 * para que um objeto informado antes da troca de serviço não sobreviva.
 */
function clearStepField(
  values: Record<string, unknown>,
  step: FormStep,
  dbFieldName: string,
): Record<string, unknown> {
  const field = step.fields.find(
    (item) => item.name === dbFieldName || item.name.endsWith(`.${dbFieldName}`),
  )

  if (!field) return values

  return mergeDeep(values, buildValuePath(field.name, ''))
}

function buildValuePath(path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.')
  const root: Record<string, unknown> = {}
  let current = root

  for (const part of parts.slice(0, -1)) {
    const next: Record<string, unknown> = {}
    current[part] = next
    current = next
  }

  const leaf = parts[parts.length - 1]
  if (leaf) current[leaf] = value

  return root
}

export async function saveDraft(
  supabase: SupabaseClient,
  process: DbProcess,
  stepId: string,
  values: unknown,
): Promise<{ savedAt: string }> {
  if (!isWizardStep(stepId)) {
    throw fail.unprocessable('INVALID_STEP', 'Etapa inválida.')
  }

  if (stepId !== 'dados' && stepId !== 'contrato') {
    throw fail.unprocessable('INVALID_STEP', 'Esta etapa não aceita rascunho pelo formulário.')
  }

  assertProcessEditable(process)

  if (!isRecord(values)) {
    throw fail.invalidInput('Envie os valores do rascunho.')
  }

  const bundle = await loadProcessBundle(supabase, process.id)
  if (!bundle) throw fail.notFound('Processo não encontrado.')

  const steps = mapFormSchema(bundle.version.form_schema)
  const step = steps.find((item) => item.id === stepId)
  if (!step) throw fail.unprocessable('STEP_NOT_FOUND', 'Etapa não configurada para este produto.')

  const service = stepId === 'contrato' ? resolveContractService(bundle, values) : null
  const context = service
    ? { objectType: service.object_type as ServiceObjectType }
    : undefined

  // Rascunho usa o mesmo allowlist/normalização do submit, mas aceita campos
  // incompletos. Assim o autosave não serve de canal para injetar chaves
  // arbitrárias, objetos ou textos acima do limite no form_data.
  let normalized = normalizeStepValues(step, values, context)
  const issues = validateStep(step, normalized, context, {
    requireFields: false,
    checkFormat: false,
  })

  if (issues.length > 0) {
    throw fail.unprocessable('VALIDATION_FAILED', 'Revise os campos destacados.', issues)
  }

  if (service) {
    normalized = applyServiceToValues(normalized, step, service)
  }

  const formData = mergeDeep(process.form_data, normalized)
  const savedAt = new Date().toISOString()

  const { error } = await supabase
    .from('contract_processes')
    .update({
      form_data: formData,
      ...(service ? { selected_service_id: service.id } : {}),
    })
    .eq('id', process.id)

  if (error) {
    console.error('[process] falha ao salvar rascunho:', error.message)
    throw fail.internal()
  }

  return { savedAt }
}

export async function savePlan(
  supabase: SupabaseClient,
  process: DbProcess,
  planId: string,
): Promise<ContractProcess> {
  assertProcessEditable(process)

  const bundle = await loadProcessBundle(supabase, process.id)
  if (!bundle) throw fail.notFound('Processo não encontrado.')

  const plan = bundle.plans.find((item) => item.id === planId && item.active)
  if (!plan) throw fail.unprocessable('PLAN_NOT_FOUND', 'Escolha uma forma de pagamento válida.')

  if (!process.completed_steps.includes('contrato')) {
    throw fail.unprocessable(
      'CONTRACT_STEP_REQUIRED',
      'Salve os dados do contrato antes de escolher o plano.',
    )
  }

  const requiresService =
    bundle.version.version >= 2 || bundle.services.some((item) => Boolean(item.kit_code))

  if (requiresService) {
    if (!process.selected_service_id) {
      throw fail.unprocessable('SERVICE_REQUIRED', 'Escolha o serviço contratado.')
    }

    if (!plan.service_id || plan.service_id !== process.selected_service_id) {
      throw fail.unprocessable(
        'PLAN_SERVICE_MISMATCH',
        'Escolha um plano do serviço selecionado.',
      )
    }
  } else if (
    process.selected_service_id &&
    plan.service_id &&
    process.selected_service_id !== plan.service_id
  ) {
    throw fail.unprocessable(
      'PLAN_SERVICE_MISMATCH',
      'Escolha um plano do serviço selecionado.',
    )
  }

  const completed = new Set(process.completed_steps)
  completed.add('contrato')

  const { data: updated, error } = await supabase
    .from('contract_processes')
    .update({
      selected_plan_id: planId,
      completed_steps: [...completed],
      current_step: 'assinatura',
      general_status: 'PRONTO_PARA_CONTRATO',
    })
    .eq('id', process.id)
    .select('*')
    .single<DbProcess>()

  if (error) {
    console.error('[process] falha ao salvar plano:', error.message)
    throw fail.internal()
  }

  await recordEvent(supabase, process.id, {
    type: 'PLAN_SELECTED',
    title: 'Plano selecionado',
    description: `Plano "${plan.label}" escolhido.`,
    actorType: 'CLIENT',
    payload: { planId },
  })

  return loadDto(supabase, updated.id)
}

export interface StartSignatureInput {
  planId?: string
  consentVersion: string
  consentAccepted: boolean
}

/**
 * Fecha os dados, congela o financeiro e dispara o contrato para assinatura.
 * É idempotente: chamar de novo apenas tenta reenviar o que ainda não foi gerado.
 */
export async function startSignature(
  supabase: SupabaseClient,
  process: DbProcess,
  input: StartSignatureInput,
  requestMeta: { ipHash: string; userAgent: string | null; token?: string | null },
): Promise<ContractProcess> {
  if (!input.consentAccepted) {
    throw fail.unprocessable('CONSENT_REQUIRED', 'É necessário aceitar o aviso de privacidade.')
  }

  if (!input.consentVersion?.trim()) {
    throw fail.unprocessable('CONSENT_VERSION_REQUIRED', 'Versão do consentimento ausente.')
  }

  const requiredSteps: WizardStepId[] = ['dados', 'contrato']
  const completed = new Set(process.completed_steps)
  const missing = requiredSteps.filter((step) => !completed.has(step))

  if (missing.length > 0) {
    throw fail.unprocessable('INCOMPLETE_STEPS', 'Ainda faltam etapas obrigatórias.', {
      missing,
    })
  }

  const bundle = await loadProcessBundle(supabase, process.id)
  if (!bundle) throw fail.notFound('Processo não encontrado.')

  const planId = input.planId ?? process.selected_plan_id
  if (!planId) {
    throw fail.unprocessable('PLAN_NOT_FOUND', 'Escolha uma forma de pagamento válida.')
  }

  const plan = bundle.plans.find((item) => item.id === planId && item.active)
  if (!plan) throw fail.unprocessable('PLAN_NOT_FOUND', 'Escolha uma forma de pagamento válida.')

  if (
    isProcessFrozen(process) &&
    process.selected_plan_id &&
    input.planId &&
    input.planId !== process.selected_plan_id
  ) {
    throw fail.conflict(
      'PROCESS_FROZEN',
      'O plano deste processo já foi congelado e não pode ser trocado.',
    )
  }

  const requiresService =
    bundle.version.version >= 2 || bundle.services.some((item) => Boolean(item.kit_code))

  if (requiresService) {
    if (!process.selected_service_id) {
      throw fail.unprocessable('SERVICE_REQUIRED', 'Escolha o serviço contratado.')
    }

    if (!plan.service_id || plan.service_id !== process.selected_service_id) {
      throw fail.unprocessable(
        'PLAN_SERVICE_MISMATCH',
        'Escolha um plano do serviço selecionado.',
      )
    }

    const kit = bundle.kitItems.filter(
      (item) => item.service_id === process.selected_service_id,
    )
    if (kit.length === 0) {
      throw fail.unprocessable(
        'KIT_NOT_CONFIGURED',
        'O kit documental deste serviço ainda não está configurado.',
      )
    }
  } else if (
    process.selected_service_id &&
    plan.service_id &&
    process.selected_service_id !== plan.service_id
  ) {
    throw fail.unprocessable(
      'PLAN_SERVICE_MISMATCH',
      'Escolha um plano do serviço selecionado.',
    )
  }

  const existingFinancial = (process.financial_snapshot as
    | { planId?: string }
    | null) ?? null

  let financial: FinancialSnapshot

  if (existingFinancial?.planId === plan.id) {
    financial = existingFinancial as FinancialSnapshot
  } else {
    const holidays = await loadHolidays(supabase)
    const result = buildFinancialSnapshot(
      {
        planId: plan.id,
        method: plan.method,
        totalCents: plan.total_cents,
        signalCents: plan.signal_cents,
        entryCents: plan.entry_cents,
        installmentCount: plan.installment_count,
        dueDateRule: plan.due_date_rule,
      },
      todayInSaoPaulo(),
      holidays,
    )

    if (!result.ok) {
      await markFinancialDivergence(supabase, process.id, result.error)
      throw fail.unprocessable('FINANCIAL_VALIDATION', result.error)
    }

    financial = result.value
  }

  await ensureSignatureRows(supabase, process.id, bundle)
  await ensurePaymentRows(supabase, process.id, financial)

  if (!bundle.consent || bundle.consent.version !== input.consentVersion) {
    const { error: consentError } = await supabase.from('consent_records').insert({
      contract_process_id: process.id,
      consent_type: 'PRIVACY',
      version: input.consentVersion,
      accepted: true,
      accepted_at: new Date().toISOString(),
      ip_hash: requestMeta.ipHash,
      user_agent: requestMeta.userAgent,
    })

    if (consentError) {
      console.error('[process] falha ao registrar consentimento:', consentError.message)
      throw fail.internal()
    }
  }

  const signatureDone =
    process.signature_status === 'ASSINADA_CLIENTE' ||
    process.signature_status === 'ASSINADA_COMPLETA'
  const paymentDone = process.payment_status === 'PAGO'

  const frozenSteps = new Set(completed)
  frozenSteps.add('dados')
  frozenSteps.add('contrato')

  const { data: updated, error } = await supabase
    .from('contract_processes')
    .update({
      financial_snapshot: financial,
      selected_plan_id: plan.id,
      general_status: signatureDone
        ? paymentDone
          ? 'AGUARDANDO_DOCUMENTOS'
          : 'AGUARDANDO_PAGAMENTO'
        : 'CONTRATO_EM_GERACAO',
      signature_status: signatureDone ? process.signature_status : 'PENDENTE',
      payment_status: paymentDone
        ? 'PAGO'
        : process.payment_status === 'NAO_CRIADO'
          ? 'PENDENTE'
          : process.payment_status,
      current_step: paymentDone
        ? 'documentos'
        : signatureDone
          ? 'pagamento'
          : 'assinatura',
      completed_steps: [...frozenSteps],
      version: process.version + 1,
    })
    .eq('id', process.id)
    .eq('version', process.version)
    .select('*')
    .single<DbProcess>()

  if (error) {
    console.error('[process] falha ao congelar processo:', error.message)
    throw fail.conflict(
      'PROCESS_CONFLICT',
      'O processo foi atualizado em outra aba. Recarregue e tente novamente.',
    )
  }

  await recordEvent(supabase, process.id, {
    type: 'FINANCIAL_VALIDATED',
    title: 'Valores validados',
    description: `Plano "${plan.label}" validado e congelado no processo.`,
    actorType: 'CLIENT',
    payload: { planId: plan.id, totalCents: financial.totalCents },
  })

  if (!signatureDone) {
    const contracted = await sendContractToSigners(supabase, updated.id)

    if (!contracted) {
      await enqueueJob(supabase, {
        processId: process.id,
        jobType: 'GENERATE_CONTRACT',
        idempotencyKey: `generate-contract:${process.id}:${updated.version}`,
        payload: { planId: plan.id },
      })
    }
  }

  // Confirmação para o cliente e aviso para a equipe. Roda em background para
  // não atrasar a resposta e nunca derruba o fluxo em caso de falha do provedor.
  runInBackground(
    sendSubmissionEmails(supabase, updated.id, { token: requestMeta.token }),
  )

  return loadDto(supabase, updated.id)
}

export interface CheckoutInput {
  token: string
}

/** Cria (ou reutiliza) o checkout hospedado do Asaas para o plano escolhido. */
export async function createPaymentCheckout(
  supabase: SupabaseClient,
  process: DbProcess,
  input: CheckoutInput,
): Promise<{ checkoutUrl: string }> {
  const signed =
    process.signature_status === 'ASSINADA_CLIENTE' ||
    process.signature_status === 'ASSINADA_COMPLETA'

  if (!signed) {
    throw fail.conflict('SIGNATURE_REQUIRED', 'Conclua a assinatura antes de pagar.')
  }

  if (process.payment_status === 'PAGO') {
    const bundle = await loadProcessBundle(supabase, process.id)
    const link = bundle?.payments.find((payment) => payment.invoice_url)?.invoice_url
    return { checkoutUrl: link ?? '' }
  }

  const bundle = await loadProcessBundle(supabase, process.id)
  if (!bundle) throw fail.notFound('Processo não encontrado.')

  const existing = bundle.payments.find(
    (payment) => payment.external_charge_id && payment.invoice_url,
  )
  if (existing?.invoice_url) {
    return { checkoutUrl: existing.invoice_url }
  }

  if (!isAsaasConfigured()) {
    await ensureAlert(supabase, {
      key: `asaas-not-configured:${process.id}`,
      title: 'Checkout do Asaas não configurado',
      description:
        'Cadastre ASAAS_API_KEY nas secrets da Edge Function para liberar o pagamento.',
      processId: process.id,
      severity: 'CRITICAL',
    })

    throw fail.unavailable(
      'O pagamento ainda não está configurado. Fale com a equipe para concluir.',
    )
  }

  const planId = process.selected_plan_id
  const plan = bundle.plans.find((item) => item.id === planId && item.active)
  if (!plan) throw fail.unprocessable('PLAN_NOT_FOUND', 'Escolha uma forma de pagamento válida.')

  const financial = process.financial_snapshot as
    | { totalCents?: number }
    | null
  const totalCents = financial?.totalCents ?? plan.total_cents
  const client = bundle.client
  const address = (client?.address as Record<string, unknown> | null) ?? {}
  const appUrl = (Deno.env.get('APP_URL') ?? '').split(',')[0]?.trim() || 'https://form.monteiroveloso.com'
  const returnUrl = `${appUrl}/processo/${input.token}?pagamento=retorno`

  let checkout: { id: string; link: string }
  try {
    checkout = await createAsaasCheckout({
      billingType: plan.method === 'CARD' ? 'CREDIT_CARD' : 'PIX',
      installmentCount: plan.installment_count,
      totalCents,
      description: plan.label,
      itemName: bundle.product.short_name,
      externalReference: process.id,
      successUrl: returnUrl,
      cancelUrl: returnUrl,
      expiredUrl: returnUrl,
      customer: {
        name: client?.full_name ?? 'Cliente',
        cpfCnpj: client?.cpf ?? '',
        email: client?.email ?? null,
        phone: client?.phone_e164?.replace(/\D+/g, '') ?? null,
        postalCode: stringValue(address.cep),
        address: stringValue(address.logradouro),
        addressNumber: stringValue(address.numero),
        complement: stringValue(address.complemento),
        province: stringValue(address.bairro),
      },
    })
  } catch (cause) {
    console.error('[process] falha ao criar checkout:', cause)
    await ensureAlert(supabase, {
      key: `asaas-checkout-failed:${process.id}`,
      title: 'Falha ao criar checkout',
      description: 'O Asaas não respondeu como esperado. Verifique a API key e tente novamente.',
      processId: process.id,
      severity: 'CRITICAL',
    })
    throw fail.unavailable('Não foi possível abrir o pagamento agora. Tente novamente.')
  }

  const firstPayment = bundle.payments[0]
  if (firstPayment) {
    await supabase
      .from('payments')
      .update({
        external_charge_id: checkout.id,
        invoice_url: checkout.link,
        status: 'PENDENTE',
      })
      .eq('id', firstPayment.id)

    await supabase
      .from('payments')
      .update({ invoice_url: checkout.link, status: 'PENDENTE' })
      .eq('contract_process_id', process.id)
      .neq('id', firstPayment.id)
  }

  const completed = new Set(process.completed_steps)
  completed.add('assinatura')

  await supabase
    .from('contract_processes')
    .update({
      payment_status: 'PENDENTE',
      general_status: 'AGUARDANDO_PAGAMENTO',
      current_step: 'pagamento',
      completed_steps: [...completed],
      version: process.version + 1,
    })
    .eq('id', process.id)

  await recordEvent(supabase, process.id, {
    type: 'CHECKOUT_CREATED',
    title: 'Checkout criado',
    description: `Checkout do Asaas criado para o plano "${plan.label}".`,
    actorType: 'CLIENT',
    payload: { checkoutId: checkout.id, planId: plan.id },
  })

  return { checkoutUrl: checkout.link }
}

async function ensureSignatureRows(
  supabase: SupabaseClient,
  processId: string,
  bundle: ProcessBundle,
): Promise<void> {
  if (bundle.signatures.length > 0) return

  const selectedServiceId = bundle.process.selected_service_id
  // v1 usa o kit da versão (service_id nulo); v2 assina só o kit do serviço.
  const applicableItems = bundle.kitItems.filter(
    (item) => item.service_id === null || item.service_id === selectedServiceId,
  )

  const kitRows = applicableItems.map((item) => ({
    contract_process_id: processId,
    provider: 'zapsign',
    template_id: item.contract_template_id,
    status: 'NAO_GERADA',
  }))

  if (kitRows.length === 0) return

  const { error } = await supabase.from('signatures').insert(kitRows)
  if (error) {
    console.error('[process] falha ao criar assinaturas:', error.message)
    throw fail.internal()
  }
}

async function ensurePaymentRows(
  supabase: SupabaseClient,
  processId: string,
  financial: {
    signalCents: number
    entryCents: number
    installments: Array<{ number: number; dueDate: string; amountCents: number }>
  },
): Promise<void> {
  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('contract_process_id', processId)

  if ((count ?? 0) > 0) return

  const { error } = await supabase.from('payments').insert(buildPaymentRows(processId, financial))
  if (error) {
    console.error('[process] falha ao criar cobranças:', error.message)
    throw fail.internal()
  }
}

/**
 * Gera os documentos no ZapSign e deixa o próprio ZapSign enviar o link por
 * e-mail e WhatsApp. Retorna false quando falta configuração/template, para
 * que o processo continue em CONTRATO_EM_GERACAO e a equipe seja alertada.
 */
async function sendContractToSigners(
  supabase: SupabaseClient,
  processId: string,
): Promise<boolean> {
  const bundle = await loadProcessBundle(supabase, processId)
  if (!bundle) return false

  if (!isZapSignConfigured()) {
    await ensureAlert(supabase, {
      key: `zapsign-not-configured:${processId}`,
      title: 'ZapSign não configurado',
      description:
        'Cadastre ZAPSIGN_API_TOKEN e o ID real do template para enviar o contrato pelo WhatsApp.',
      processId,
      severity: 'CRITICAL',
    })
    await recordEvent(supabase, processId, {
      type: 'CONTRACT_PENDING_CONFIGURATION',
      title: 'Contrato aguardando configuração',
      description: 'O envio automático pelo ZapSign ainda não está configurado.',
      actorType: 'SYSTEM',
    })
    return false
  }

  const templateById = new Map(bundle.templates.map((template) => [template.id, template]))
  const pending = bundle.signatures.filter((signature) => !signature.external_document_id)

  if (pending.length === 0 && bundle.signatures.length > 0) {
    await supabase
      .from('contract_processes')
      .update({
        general_status: 'AGUARDANDO_ASSINATURA_CLIENTE',
        current_step: 'assinatura',
      })
      .eq('id', processId)
    return true
  }

  const data = buildTemplateData(bundle)
  const signer = {
    name: bundle.client?.full_name ?? 'Cliente',
    email: bundle.client?.email ?? null,
    phoneCountry: '55',
    phoneNumber: (bundle.client?.phone_e164 ?? '').replace(/\D+/g, '').replace(/^55/, ''),
  }

  let generated = 0

  for (const signature of pending) {
    const template = signature.template_id ? templateById.get(signature.template_id) : null
    const externalTemplateId = template?.external_template_id?.trim() ?? ''

    // Placeholders do catálogo (`PREENCHER_CONTRATO`, `PREENCHER_CONTRATO_01`...)
    // nunca podem virar chamada real no provedor.
    if (!externalTemplateId || externalTemplateId.startsWith('PREENCHER_')) {
      await ensureAlert(supabase, {
        key: `zapsign-template-missing:${processId}:${signature.template_id ?? 'none'}`,
        title: 'Template do contrato não configurado',
        description:
          'Substitua o ID PREENCHER_* pelo token real do template no ZapSign.',
        processId,
        severity: 'CRITICAL',
      })
      continue
    }

    // Um template com ID real mas ainda em DRAFT não pode ser usado: o jurídico
    // precisa aprovar o modelo antes de qualquer geração automática.
    if (template?.approval_status !== 'APPROVED') {
      await ensureAlert(supabase, {
        key: `zapsign-template-draft:${processId}:${signature.template_id ?? 'none'}`,
        title: 'Template do contrato não aprovado',
        description:
          'O template tem ID no ZapSign, mas ainda está em DRAFT. Aprove o modelo antes de gerar o contrato.',
        processId,
        severity: 'CRITICAL',
      })
      continue
    }

    try {
      const result = await createZapSignDocument({
        templateId: externalTemplateId,
        signer,
        data,
        externalId: signature.id,
        brandName: 'Monteiro Veloso Advogados',
      })

      if (!result.token) throw new Error('ZAPSIGN_EMPTY_TOKEN')

      const { error } = await supabase
        .from('signatures')
        .update({
          external_document_id: result.token,
          signature_url: result.signerUrl,
          status: 'PENDENTE',
          last_event_at: new Date().toISOString(),
        })
        .eq('id', signature.id)

      if (error) throw new Error(error.message)
      generated += 1
    } catch (cause) {
      console.error('[process] falha ao gerar contrato:', cause)
      await ensureAlert(supabase, {
        key: `zapsign-generate-failed:${processId}:${signature.id}`,
        title: 'Falha ao gerar contrato',
        description: 'O ZapSign não respondeu como esperado. Reenvie pela tela do processo.',
        processId,
        severity: 'CRITICAL',
      })
    }
  }

  if (generated === 0) return false

  if (generated < pending.length) {
    await ensureAlert(supabase, {
      key: `zapsign-partial:${processId}`,
      title: 'Contrato parcialmente gerado',
      description: 'Um ou mais documentos não foram criados. Use “Reenviar contrato”.',
      processId,
      severity: 'WARNING',
    })
    return false
  }

  await supabase
    .from('contract_processes')
    .update({
      general_status: 'AGUARDANDO_ASSINATURA_CLIENTE',
      signature_status: 'PENDENTE',
      current_step: 'assinatura',
    })
    .eq('id', processId)

  await recordEvent(supabase, processId, {
    type: 'CONTRACT_SENT',
    title: 'Contrato enviado',
    description: 'O contrato foi enviado para o WhatsApp e o e-mail do cliente.',
    actorType: 'SYSTEM',
    payload: { documents: generated },
  })

  return true
}

function buildTemplateData(bundle: ProcessBundle): Array<{ de: string; para: string }> {
  const form = isRecord(bundle.process.form_data) ? bundle.process.form_data : {}
  const client = bundle.client
  const address = isRecord(client?.address) ? client.address : {}
  const extra = isRecord(form.extra) ? form.extra : {}
  const addressLine = [
    stringValue(address.logradouro),
    stringValue(address.numero),
    stringValue(address.complemento),
    stringValue(address.bairro),
    stringValue(address.cidade),
    stringValue(address.uf),
  ]
    .filter(Boolean)
    .join(', ')

  const plan = bundle.plans.find((item) => item.id === bundle.process.selected_plan_id)
  const service = bundle.services.find((item) => item.id === plan?.service_id)

  const values: Record<string, string> = {
    SERVICO: service?.name ?? '',
    SERVIÇO: service?.name ?? '',
    NOME_COMPLETO: client?.full_name ?? '',
    NOME: client?.full_name ?? '',
    CPF: client?.cpf ?? '',
    EMAIL: client?.email ?? '',
    TELEFONE: client?.phone_e164 ?? '',
    ESTADO_CIVIL: stringValue(form.maritalStatus) ?? '',
    PROFISSAO: stringValue(form.profession) ?? '',
    NACIONALIDADE: stringValue(form.nationality) ?? 'Brasileira',
    ENDERECO: addressLine,
    ENDERECO_COMPLETO: addressLine,
    CEP: stringValue(address.cep) ?? '',
    CIDADE: stringValue(address.cidade) ?? '',
    UF: stringValue(address.uf) ?? '',
    PLACA: stringValue(extra.vehicle_plate) ?? '',
    PLACA_VEICULO: stringValue(extra.vehicle_plate) ?? '',
    MODELO: stringValue(extra.vehicle_model) ?? '',
    MODELO_VEICULO: stringValue(extra.vehicle_model) ?? '',
    FINANCEIRA: stringValue(extra.finance_institution) ?? '',
    INSTITUICAO_FINANCEIRA: stringValue(extra.finance_institution) ?? '',
    NUMERO_CONTRATO: stringValue(extra.contract_number) ?? '',
    VALOR_TOTAL: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(
      (plan?.total_cents ??
        ((bundle.process.financial_snapshot as { totalCents?: number } | null)?.totalCents ?? 0)) /
        100,
    ),
    FORMA_PAGAMENTO: plan?.label ?? '',
    DATA_CONTRATO: new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date()),
  }

  return Object.entries(values).map(([key, value]) => ({
    de: `{{${key}}}`,
    para: value,
  }))
}

export async function loadDto(
  supabase: SupabaseClient,
  processId: string,
): Promise<ContractProcess> {
  const bundle = await loadProcessBundle(supabase, processId)
  if (!bundle) throw fail.notFound('Processo não encontrado.')
  return mapProcessBundle(bundle)
}

async function ensureClient(
  supabase: SupabaseClient,
  process: DbProcess,
  values: Record<string, unknown>,
): Promise<{ id: string; shouldUpdateAddress: boolean }> {
  const fullName = stringValue(values.fullName)
  const cpf = stringValue(values.cpf)?.replace(/\D+/g, '') ?? ''
  const email = stringValue(values.email)?.toLowerCase() ?? null
  const phone = stringValue(values.phone)
  const phoneE164 = phone ? toE164Br(phone) : null
  const maritalStatus = stringValue(values.maritalStatus)
  const profession = stringValue(values.profession)
  const nationality = stringValue(values.nationality) ?? 'Brasileira'

  if (!fullName || !cpf || !isValidCpf(cpf)) {
    throw fail.unprocessable('VALIDATION_FAILED', 'Nome e CPF válidos são obrigatórios.')
  }

  const { data: existing, error: lookupError } = await supabase
    .from('clients')
    .select('*')
    .eq('cpf', cpf)
    .maybeSingle<DbClient>()

  if (lookupError) {
    console.error('[process] falha ao buscar cliente:', lookupError.message)
    throw fail.internal()
  }

  if (existing) {
    // O formulário público não pode sobrescrever o contato de um cliente já
    // cadastrado: sem prova de titularidade, isso permitiria sequestrar um
    // processo trocando o e-mail/WhatsApp da vítima. Preenchemos apenas campos
    // vazios e sinalizamos divergência para revisão humana.
    const patch: Record<string, unknown> = {}

    if (!existing.email && email) patch.email = email
    if (!existing.phone_e164 && phoneE164) patch.phone_e164 = phoneE164
    if (!existing.marital_status && maritalStatus) patch.marital_status = maritalStatus
    if (!existing.profession && profession) patch.profession = profession
    if (!existing.nationality && nationality) patch.nationality = nationality

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from('clients')
        .update(patch)
        .eq('id', existing.id)

      if (error) {
        console.error('[process] falha ao completar cliente:', error.message)
        throw fail.internal()
      }
    }

    const emailChanged = Boolean(
      existing.email && email && existing.email.toLowerCase() !== email,
    )
    const phoneChanged = Boolean(
      existing.phone_e164 && phoneE164 && existing.phone_e164 !== phoneE164,
    )

    if (emailChanged || phoneChanged) {
      await ensureAlert(supabase, {
        key: `client-contact-divergence:${process.id}`,
        title: 'CPF já cadastrado com contato diferente',
        description:
          'O formulário informou e-mail ou WhatsApp diferente do cadastro existente. Os dados originais foram preservados; confira antes de gerar o contrato.',
        processId: process.id,
        severity: 'WARNING',
      })
    }

    return {
      id: existing.id,
      shouldUpdateAddress: !hasAddress(existing.address),
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      full_name: fullName,
      cpf,
      email,
      phone_e164: phoneE164,
      address: {},
      marital_status: maritalStatus,
      profession,
      nationality,
    })
    .select('id')
    .single<{ id: string }>()

  if (error) {
    console.error('[process] falha ao criar cliente:', error.message)
    throw fail.internal()
  }

  return { id: data.id, shouldUpdateAddress: true }
}

function hasAddress(address: Record<string, unknown> | null | undefined): boolean {
  if (!address) return false
  return Object.values(address).some(
    (value) => typeof value === 'string' && value.trim() !== '',
  )
}

async function updateClientAddress(
  supabase: SupabaseClient,
  clientId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const address = asRecord(values.address)
  if (!address) return

  const dbAddress = {
    cep: stringValue(address.cep) ?? '',
    logradouro: stringValue(address.street) ?? '',
    numero: stringValue(address.number) ?? '',
    complemento: stringValue(address.complement) ?? '',
    bairro: stringValue(address.neighborhood) ?? '',
    cidade: stringValue(address.city) ?? '',
    uf: stringValue(address.state)?.toUpperCase() ?? '',
  }

  const { error } = await supabase.from('clients').update({ address: dbAddress }).eq('id', clientId)
  if (error) {
    console.error('[process] falha ao atualizar endereço:', error.message)
    throw fail.internal()
  }
}

function buildPaymentRows(processId: string, financial: {
  signalCents: number
  entryCents: number
  installments: Array<{ number: number; dueDate: string; amountCents: number }>
}): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = []
  let sequence = 1

  if (financial.signalCents > 0) {
    rows.push({
      contract_process_id: processId,
      installment_number: sequence,
      payment_type: 'SIGNAL',
      amount_cents: financial.signalCents,
      due_date: todayInSaoPaulo(),
      status: 'PENDENTE',
      external_reference: `${processId}:SIGNAL`,
    })
    sequence += 1
  }

  if (financial.entryCents > 0) {
    rows.push({
      contract_process_id: processId,
      installment_number: sequence,
      payment_type: 'ENTRY',
      amount_cents: financial.entryCents,
      due_date: todayInSaoPaulo(),
      status: 'PENDENTE',
      external_reference: `${processId}:ENTRY`,
    })
    sequence += 1
  }

  for (const installment of financial.installments) {
    rows.push({
      contract_process_id: processId,
      installment_number: sequence,
      payment_type: 'INSTALLMENT',
      amount_cents: installment.amountCents,
      due_date: installment.dueDate,
      status: 'PENDENTE',
      external_reference: `${processId}:P${installment.number}`,
    })
    sequence += 1
  }

  return rows
}

async function markFinancialDivergence(
  supabase: SupabaseClient,
  processId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from('contract_processes')
    .update({ general_status: 'ERRO_REQUER_INTERVENCAO' })
    .eq('id', processId)

  await supabase.from('human_tasks').insert({
    contract_process_id: processId,
    task_type: 'FINANCIAL_DIVERGENCE',
    description: reason,
    priority: 10,
  })

  await recordEvent(supabase, processId, {
    type: 'FINANCIAL_DIVERGENCE',
    title: 'Divergência financeira',
    description: reason,
    actorType: 'SYSTEM',
  })

  await ensureAlert(supabase, {
    key: `financial-divergence:${processId}`,
    title: 'Divergência financeira',
    description: reason,
    processId,
    severity: 'CRITICAL',
  })
}

export async function enqueueJob(
  supabase: SupabaseClient,
  input: {
    processId: string | null
    jobType: string
    idempotencyKey: string
    payload?: Record<string, unknown>
    runAt?: string
  },
): Promise<void> {
  const { error } = await supabase.from('outbox_jobs').upsert(
    {
      contract_process_id: input.processId,
      job_type: input.jobType,
      idempotency_key: input.idempotencyKey,
      payload: input.payload ?? {},
      run_at: input.runAt ?? new Date().toISOString(),
      status: 'PENDING',
    },
    { onConflict: 'idempotency_key', ignoreDuplicates: true },
  )

  if (error) {
    console.error('[outbox] falha ao enfileirar:', error.message)
    throw fail.internal()
  }
}

// Reexportados para não quebrar os imports existentes (webhooks, admin e
// documentos). A implementação vive em `process-log.ts`.
export { ensureAlert, recordEvent }

function generatePublicCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length] ?? 'A')
  return `MV${chars.join('')}`
}

function isWizardStep(value: string): value is WizardStepId {
  return (WIZARD_STEP_ORDER as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}
