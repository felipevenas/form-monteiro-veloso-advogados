import { todayInSaoPaulo } from '@/shared/utils/dates'
import { normalizeCpf } from '@/shared/utils/cpf'
import { normalizePhone } from '@/shared/utils/phone'
import { mergeDeep } from '@/shared/lib/merge'
import { buildSnapshotFromPlan } from '../domain/financial'
import type {
  ClientData,
  ContractProcess,
  DocumentsStatus,
  FinancialSnapshot,
  PaymentCharge,
  PaymentStatus,
  ProcessEvent,
  SignatureDocumentState,
  SignatureStatus,
  WizardStepId,
} from '../types'
import { areDocumentsUnlocked, isProcessFrozen } from '../domain/workflow'
import { ApiError } from './apiError'
import type { ProcessRepository } from '../types'
import {
  createDocumentStates,
  pilotProduct,
  WIZARD_STEP_ORDER,
} from './mockFixtures'

const STORAGE_PREFIX = 'mv:mock:process:'

export interface MockProcessRepository extends ProcessRepository {
  simulate(token: string, event: 'sign' | 'pay'): Promise<ContractProcess>
}

function assertEditable(process: ContractProcess): void {
  if (isProcessFrozen(process)) {
    throw new ApiError(
      'PROCESS_FROZEN',
      'Este processo já foi enviado para assinatura e não pode mais ser alterado pelo formulário.',
      409,
    )
  }
}

export function createMockProcessRepository(): MockProcessRepository {
  return {
    async start(input) {
      const token = generateToken()
      const now = new Date().toISOString()
      const process: ContractProcess = {
        id: crypto.randomUUID(),
        publicCode: generatePublicCode(),
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        product: pilotProduct,
        client: { nationality: 'Brasileira', extra: {} },
        generalStatus: 'DADOS_PENDENTES',
        signatureStatus: 'NAO_GERADA',
        paymentStatus: 'NAO_CRIADO',
        documentsStatus: 'NAO_INICIADA',
        financial: null,
        selectedServiceId: null,
        selectedPlanId: null,
        currentStep: 'dados',
        completedSteps: [],
        signature: null,
        payment: null,
        documents: createDocumentStates(),
        consent: null,
        attribution: input.attribution ?? {},
        events: [
          event(
            'PROCESS_STARTED',
            'Processo iniciado',
            'Seu processo de contratação foi criado.',
          ),
        ],
      }

      save(token, process)
      return { token, process }
    },

    async get(token) {
      return load(token)
    },

    async saveStep(token, step, values) {
      const process = load(token)
      assertEditable(process)
      let stepValues = values
      let selectedServiceId = process.selectedServiceId

      if (step === 'contrato') {
        const serviceCode = String(values.produto ?? '').trim()
        if (!serviceCode) {
          throw new ApiError(
            'SERVICE_REQUIRED',
            'Escolha o serviço contratado.',
            422,
          )
        }

        const service = process.product.services.find((item) => item.code === serviceCode)
        if (!service) {
          throw new ApiError(
            'SERVICE_NOT_FOUND',
            'Serviço inválido para este produto.',
            422,
          )
        }

        const { produto: _produto, ...rest } = values
        void _produto
        stepValues = rest
        selectedServiceId = service.id
      }

      const client = mergeDeep(process.client, stepValues) as Partial<ClientData>
      const completedSteps = addUnique(process.completedSteps, step)
      const currentStep = nextStepAfter(step, process.currentStep)

      const updated = touch(process, {
        client,
        selectedServiceId,
        completedSteps,
        currentStep,
        generalStatus: process.generalStatus === 'DADOS_PENDENTES' ? 'DADOS_PENDENTES' : process.generalStatus,
        events: [
          ...process.events,
          event('STEP_SAVED', 'Etapa salva', `Etapa "${step}" atualizada.`),
        ],
      })

      save(token, updated)
      return updated
    },

    async saveDraft(token, step, values) {
      const process = load(token)
      assertEditable(process)

      if (step !== 'dados' && step !== 'contrato') {
        throw new ApiError(
          'INVALID_STEP',
          'Esta etapa não aceita rascunho pelo formulário.',
          422,
        )
      }

      let stepValues = values
      let selectedServiceId = process.selectedServiceId

      if (step === 'contrato') {
        const serviceCode = String(values.produto ?? '').trim()
        if (!serviceCode) {
          throw new ApiError('SERVICE_REQUIRED', 'Escolha o serviço contratado.', 422)
        }

        const service = process.product.services.find((item) => item.code === serviceCode)
        if (!service) {
          throw new ApiError('SERVICE_NOT_FOUND', 'Serviço inválido para este produto.', 422)
        }

        const { produto: _produto, ...rest } = values
        void _produto
        stepValues = rest
        selectedServiceId = service.id
      }

      const client = mergeDeep(process.client, stepValues) as Partial<ClientData>
      const updated = touch(process, { client, selectedServiceId })
      save(token, updated)
      return { savedAt: updated.updatedAt }
    },

    async savePlan(token, planId) {
      const process = load(token)
      assertEditable(process)

      const plan = process.product.paymentPlans.find((item) => item.id === planId)

      if (!plan) {
        throw new ApiError('PLAN_NOT_FOUND', 'Escolha uma forma de pagamento válida.', 422)
      }

      if (!process.completedSteps.includes('contrato')) {
        throw new ApiError(
          'CONTRACT_STEP_REQUIRED',
          'Salve os dados do contrato antes de escolher o plano.',
          422,
        )
      }

      if (!process.selectedServiceId) {
        throw new ApiError('SERVICE_REQUIRED', 'Escolha o serviço contratado.', 422)
      }

      if (!plan.serviceId || plan.serviceId !== process.selectedServiceId) {
        throw new ApiError(
          'PLAN_SERVICE_MISMATCH',
          'Escolha um plano do serviço selecionado.',
          422,
        )
      }

      const updated = touch(process, {
        selectedPlanId: plan.id,
        completedSteps: addUnique(process.completedSteps, 'contrato'),
        currentStep: 'assinatura',
        generalStatus: 'PRONTO_PARA_CONTRATO',
        events: [
          ...process.events,
          event('PLAN_SELECTED', 'Plano selecionado', `Plano "${plan.label}" escolhido.`),
        ],
      })

      save(token, updated)
      return updated
    },

    async startSignature(token, input) {
      const process = load(token)
      if (!input.consentAccepted) {
        throw new ApiError('CONSENT_REQUIRED', 'É necessário aceitar o aviso de privacidade.', 422)
      }

      const requiredSteps: WizardStepId[] = ['dados', 'contrato']

      const missing = requiredSteps.filter((step) => !process.completedSteps.includes(step))
      if (missing.length > 0) {
        throw new ApiError('INCOMPLETE_STEPS', 'Ainda faltam etapas obrigatórias.', 422, {
          missing,
        })
      }

      const plan = process.product.paymentPlans.find((item) => item.id === input.planId)
      if (!plan) {
        throw new ApiError('PLAN_NOT_FOUND', 'Escolha uma forma de pagamento válida.', 422)
      }

      const financial = buildSnapshotFromPlan(plan, todayInSaoPaulo())
      if (!financial.ok) {
        throw new ApiError('FINANCIAL_VALIDATION', financial.error, 422)
      }

      const signature =
        process.signature ?? createSignatureSummary()
      const payment =
        process.payment ?? createPaymentSummary(financial.value)
      const now = new Date().toISOString()

      const updated = touch(process, {
        client: normalizeClient(process.client),
        financial: financial.value,
        selectedPlanId: plan.id,
        signature,
        signatureStatus: 'PENDENTE',
        payment,
        paymentStatus: 'PENDENTE',
        generalStatus: 'AGUARDANDO_ASSINATURA_CLIENTE',
        completedSteps: addUnique(addUnique(process.completedSteps, 'dados'), 'contrato'),
        currentStep: 'assinatura',
        consent: process.consent ?? {
          version: input.consentVersion,
          acceptedAt: now,
        },
        events: [
          ...process.events,
          event(
            'FINANCIAL_VALIDATED',
            'Valores validados',
            `Plano "${plan.label}" validado e congelado no processo.`,
          ),
          event(
            'CONTRACT_SENT',
            'Contrato enviado',
            'O contrato foi enviado para o WhatsApp informado.',
          ),
        ],
      })

      save(token, updated)
      return updated
    },

    async createCheckout(token) {
      const process = load(token)

      if (
        process.signatureStatus !== 'ASSINADA_CLIENTE' &&
        process.signatureStatus !== 'ASSINADA_COMPLETA'
      ) {
        throw new ApiError(
          'SIGNATURE_REQUIRED',
          'Conclua a assinatura antes de pagar.',
          409,
        )
      }

      const checkoutUrl = process.payment?.checkoutUrl ?? 'mock:checkout'
      const charges = process.payment?.charges.map((charge) => ({
        ...charge,
        invoiceUrl: checkoutUrl,
      }))
      const updated = touch(process, {
        payment: process.payment
          ? { ...process.payment, checkoutUrl, charges: charges ?? [] }
          : null,
        currentStep: 'pagamento',
        completedSteps: addUnique(process.completedSteps, 'assinatura'),
        generalStatus: 'AGUARDANDO_PAGAMENTO',
      })

      save(token, updated)
      return { checkoutUrl }
    },

    async uploadDocument(token, requirementId, file) {
      const process = load(token)

      if (!areDocumentsUnlocked(process)) {
        throw new ApiError('DOCUMENTS_LOCKED', 'Os documentos ainda não estão liberados.', 409)
      }

      const document = process.documents.find((item) => item.id === requirementId)
      if (!document) {
        throw new ApiError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.', 404)
      }

      if (!document.acceptedMimeTypes.includes(file.type)) {
        throw new ApiError('INVALID_FILE_TYPE', 'Formato de arquivo não aceito.', 422)
      }

      if (file.size > document.maxSizeBytes) {
        throw new ApiError('FILE_TOO_LARGE', 'Arquivo acima do tamanho permitido.', 422)
      }

      const documents = process.documents.map((item) =>
        item.id === requirementId
          ? {
              ...item,
              status: 'ENVIADO' as const,
              filename: file.name,
              uploadedAt: new Date().toISOString(),
            }
          : item,
      )

      const updated = refresh(
        touch(process, {
          documents,
          events: [
            ...process.events,
            event('DOCUMENT_UPLOADED', 'Documento enviado', `${document.label} recebido.`),
          ],
        }),
      )

      save(token, updated)
      return updated
    },

    async removeDocument(token, requirementId) {
      const process = load(token)
      const documents = process.documents.map((item) =>
        item.id === requirementId
          ? { ...item, status: 'PENDENTE' as const, filename: null, uploadedAt: null }
          : item,
      )

      const updated = refresh(
        touch(process, {
          documents,
          events: [
            ...process.events,
            event('DOCUMENT_REMOVED', 'Documento removido', 'O arquivo foi marcado como pendente.'),
          ],
        }),
      )

      save(token, updated)
      return updated
    },

    async simulate(token, type) {
      const process = load(token)
      const now = new Date().toISOString()

      if (type === 'sign') {
        const documents = process.signature?.documents.map((document) => ({
          ...document,
          status: 'ASSINADA_COMPLETA' as const,
          signedAt: now,
        }))

        const updated = refresh(
          touch(process, {
            signature: process.signature
              ? { status: 'ASSINADA_COMPLETA', documents: documents ?? [] }
              : null,
            signatureStatus: 'ASSINADA_COMPLETA',
            currentStep: 'pagamento',
            completedSteps: addUnique(process.completedSteps, 'assinatura'),
            events: [
              ...process.events,
              event('SIGNATURE_COMPLETED', 'Assinaturas concluídas', 'Todos os documentos foram assinados.'),
            ],
          }),
        )

        save(token, updated)
        return updated
      }

      const charges = process.payment?.charges.map((charge) => ({
        ...charge,
        status: 'PAGO' as const,
      }))

      const updated = refresh(
        touch(process, {
          payment: process.payment
            ? { ...process.payment, status: 'PAGO', charges: charges ?? [] }
            : null,
          paymentStatus: 'PAGO',
          currentStep: 'documentos',
          completedSteps: addUnique(process.completedSteps, 'pagamento'),
          events: [
            ...process.events,
            event('PAYMENT_CONFIRMED', 'Pagamento confirmado', 'O Asaas confirmou o pagamento.'),
          ],
        }),
      )

      save(token, updated)
      return updated
    },
  }
}

function createSignatureSummary() {
  const names = ['Contrato de prestação de serviços', 'Procuração']

  const documents: SignatureDocumentState[] = names.map((name, index) => ({
    id: `doc-${index + 1}`,
    name,
    status: 'PENDENTE',
    signUrl: `mock:sign:${index + 1}`,
    signedAt: null,
  }))

  return { status: 'PENDENTE' as const, documents }
}

function createPaymentSummary(financial: FinancialSnapshot) {
  const charges: PaymentCharge[] = []

  if (financial.signalCents > 0) {
    charges.push({
      id: crypto.randomUUID(),
      number: 0,
      label: 'Sinal',
      amountCents: financial.signalCents,
      dueDate: todayInSaoPaulo(),
      status: 'PENDENTE',
      invoiceUrl: 'mock:pay',
    })
  }

  if (financial.entryCents > 0) {
    charges.push({
      id: crypto.randomUUID(),
      number: 0,
      label: 'Entrada',
      amountCents: financial.entryCents,
      dueDate: todayInSaoPaulo(),
      status: 'PENDENTE',
      invoiceUrl: 'mock:pay',
    })
  }

  for (const installment of financial.installments) {
    charges.push({
      id: crypto.randomUUID(),
      number: installment.number,
      label: `Parcela ${installment.number}`,
      amountCents: installment.amountCents,
      dueDate: installment.dueDate,
      status: 'PENDENTE',
      invoiceUrl: 'mock:pay',
    })
  }

  return { status: 'PENDENTE' as const, charges, checkoutUrl: null }
}

function normalizeClient(client: Partial<ClientData>): Partial<ClientData> {
  return {
    ...client,
    fullName: client.fullName?.trim(),
    cpf: client.cpf ? normalizeCpf(client.cpf) : client.cpf,
    email: client.email?.trim().toLowerCase(),
    phone: client.phone ? normalizePhone(client.phone) : client.phone,
    maritalStatus: client.maritalStatus?.trim(),
    profession: client.profession?.trim(),
    nationality: client.nationality?.trim(),
    address: client.address
      ? {
          ...client.address,
          cep: client.address.cep?.replace(/\D+/g, ''),
          state: client.address.state?.toUpperCase(),
          city: client.address.city?.trim(),
          street: client.address.street?.trim(),
          neighborhood: client.address.neighborhood?.trim(),
        }
      : client.address,
    extra: client.extra ? { ...client.extra } : client.extra,
  }
}

function refresh(process: ContractProcess): ContractProcess {
  const requiredDocs = process.documents.filter((document) => document.required)
  const uploadedRequired = requiredDocs.filter((document) =>
    ['ENVIADO', 'PROCESSANDO'].includes(document.status),
  )
  const anyUploaded = process.documents.some((document) => document.status === 'ENVIADO')

  const documentsStatus: DocumentsStatus =
    requiredDocs.length > 0 && uploadedRequired.length === requiredDocs.length
      ? 'COMPLETA'
      : anyUploaded
        ? 'PARCIAL'
        : 'PENDENTE'

  const signatureComplete =
    process.signature?.documents.length !== undefined &&
    process.signature.documents.length > 0 &&
    process.signature.documents.every((document) => document.status === 'ASSINADA_COMPLETA')

  const paymentPaid =
    process.payment?.charges.length !== undefined &&
    process.payment.charges.length > 0 &&
    process.payment.charges.every((charge) => charge.status === 'PAGO')

  const signatureStatus: SignatureStatus = signatureComplete
    ? 'ASSINADA_COMPLETA'
    : process.signature?.documents.some((document) => document.status === 'ASSINADA_COMPLETA')
      ? 'ASSINADA_CLIENTE'
      : process.signature
        ? 'PENDENTE'
        : 'NAO_GERADA'

  const paymentStatus: PaymentStatus = paymentPaid
    ? 'PAGO'
    : process.payment?.charges.some((charge) => charge.status === 'PAGO')
      ? 'PARCIAL'
      : process.payment
        ? 'PENDENTE'
        : 'NAO_CRIADO'

  const next: ContractProcess = {
    ...process,
    signatureStatus,
    paymentStatus,
    documentsStatus,
    signature: process.signature ? { ...process.signature, status: signatureStatus } : null,
    payment: process.payment ? { ...process.payment, status: paymentStatus } : null,
  }

  if (signatureComplete && paymentPaid && documentsStatus === 'COMPLETA') {
    return {
      ...next,
      generalStatus: 'CONCLUIDO',
      completedAt: new Date().toISOString(),
    } as ContractProcess
  }

  if (!signatureComplete) {
    return { ...next, completedAt: null, generalStatus: 'AGUARDANDO_ASSINATURA_CLIENTE' }
  }

  if (!paymentPaid) {
    return { ...next, completedAt: null, generalStatus: 'AGUARDANDO_PAGAMENTO' }
  }

  return { ...next, completedAt: null, generalStatus: 'AGUARDANDO_DOCUMENTOS' }
}

function touch(process: ContractProcess, patch: Partial<ContractProcess>): ContractProcess {
  return {
    ...process,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
}

function event(type: string, title: string, description: string): ProcessEvent {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    description,
    createdAt: new Date().toISOString(),
  }
}

function addUnique<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items : [...items, item]
}

function nextStepAfter(step: WizardStepId, fallback: WizardStepId): WizardStepId {
  const index = WIZARD_STEP_ORDER.indexOf(step)
  return WIZARD_STEP_ORDER[index + 1] ?? fallback
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `mv_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function generatePublicCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length] ?? 'A')
  return `MV-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

function save(token: string, process: ContractProcess): void {
  window.localStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify(process))
}

export function listMockProcesses(): ContractProcess[] {
  const processes: ContractProcess[] = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(STORAGE_PREFIX)) continue

    const raw = window.localStorage.getItem(key)
    if (!raw) continue

    try {
      processes.push(JSON.parse(raw) as ContractProcess)
    } catch {
      // Registro corrompido é ignorado na listagem.
    }
  }

  return processes.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function findMockProcessById(id: string): ContractProcess | null {
  return listMockProcesses().find((process) => process.id === id) ?? null
}

export function findMockProcessToken(id: string): string | null {
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(STORAGE_PREFIX)) continue

    const raw = window.localStorage.getItem(key)
    if (!raw) continue

    try {
      const process = JSON.parse(raw) as ContractProcess
      if (process.id === id) return key.slice(STORAGE_PREFIX.length)
    } catch {
      // Ignora.
    }
  }

  return null
}

function load(token: string): ContractProcess {
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${token}`)
  if (!raw) {
    throw new ApiError('PROCESS_NOT_FOUND', 'Processo não encontrado ou expirado.', 404)
  }

  try {
    return JSON.parse(raw) as ContractProcess
  } catch {
    throw new ApiError('PROCESS_CORRUPTED', 'Não foi possível ler o processo.', 500)
  }
}
