/**
 * Mapeamento banco ↔ DTO.
 *
 * O formulário publicado usa nomes em camelCase e caminhos aninhados
 * (`address.cep`, `extra.vehicle_plate`). O seed guarda os campos em snake_case
 * (`nome_completo`, `logradouro`). Este módulo é a única fronteira de tradução.
 */

import { normalizePhone } from '../domain/phone.ts'
import type {
  AdminProcessSummary,
  ClientData,
  ContractProcess,
  DocumentState,
  DocumentsStatus,
  DueDateRule,
  FinancialSnapshot,
  FormField,
  FormFieldOption,
  FormStep,
  GeneralStatus,
  PaymentCharge,
  PaymentMethod,
  PaymentPlan,
  PaymentStatus,
  ProductService,
  SignatureDocumentState,
  SignatureStatus,
  UnlockCondition,
  WizardStepId,
} from '../domain/types.ts'
import type {
  DbClient,
  DbDocument,
  DbDocumentRequirement,
  DbFormField,
  DbFormSchema,
  DbPayment,
  DbPaymentPlan,
  DbProcess,
  DbProcessEvent,
  DbProduct,
  DbProductService,
  DbProductVersion,
  DbSignature,
  ProcessBundle,
} from './types.ts'

const FIELD_NAME_MAP: Record<string, string> = {
  nome_completo: 'fullName',
  cpf: 'cpf',
  email: 'email',
  telefone: 'phone',
  phone: 'phone',
  estado_civil: 'maritalStatus',
  profissao: 'profession',
  nacionalidade: 'nationality',
  cep: 'address.cep',
  logradouro: 'address.street',
  numero: 'address.number',
  complemento: 'address.complement',
  bairro: 'address.neighborhood',
  cidade: 'address.city',
  uf: 'address.state',
  placa_veiculo: 'extra.vehicle_plate',
  modelo_veiculo: 'extra.vehicle_model',
  instituicao_financeira: 'extra.finance_institution',
  numero_contrato: 'extra.contract_number',
}

const MARITAL_LABELS: Record<string, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  uniao_estavel: 'União estável',
  'uniao-estavel': 'União estável',
}

const WIDE_FIELDS = new Set([
  'nome_completo',
  'fullName',
  'email',
  'logradouro',
  'street',
  'complemento',
  'complement',
  'instituicao_financeira',
  'finance_institution',
  'numero_contrato',
  'contract_number',
])

export function mapFormSchema(schema: unknown): FormStep[] {
  const source = schema as DbFormSchema | FormStep[] | null
  const steps: Array<DbFormSchema['steps'][number] | FormStep> = Array.isArray(source)
    ? source
    : (source?.steps ?? [])

  return steps.map((step) => ({
    id: step.id as WizardStepId,
    title: step.title,
    description: step.description ?? '',
    fields: step.fields.map(mapField),
  }))
}

function mapField(field: DbFormField | FormField): FormField {
  const dbField = field as DbFormField
  const name = FIELD_NAME_MAP[field.name] ?? field.name
  const type = resolveFieldType(field)
  const options = field.options?.map((option) => mapOption(field.name, option))
  const autoComplete = dbField.autocomplete ?? field.autoComplete
  const defaultValue = dbField.default

  return {
    name,
    label: field.label,
    type,
    required: field.required ?? false,
    ...(field.placeholder ? { placeholder: field.placeholder } : {}),
    ...(field.hint ? { hint: field.hint } : {}),
    ...(autoComplete ? { autoComplete } : {}),
    ...(field.maxLength ? { maxLength: field.maxLength } : {}),
    ...(defaultValue ? { defaultValue } : {}),
    ...(options ? { options } : {}),
    ...(field.colSpan ?? (WIDE_FIELDS.has(field.name) ? 2 : 1)
      ? { colSpan: (field.colSpan ?? (WIDE_FIELDS.has(field.name) ? 2 : 1)) as 1 | 2 }
      : {}),
  }
}

function resolveFieldType(field: DbFormField | FormField): FormField['type'] {
  if ('mask' in field && field.mask === 'cpf') return 'cpf'
  if ('mask' in field && field.mask === 'phone') return 'tel'

  if (
    field.type === 'text' ||
    field.type === 'email' ||
    field.type === 'tel' ||
    field.type === 'cpf' ||
    field.type === 'date' ||
    field.type === 'select' ||
    field.type === 'textarea'
  ) {
    return field.type
  }

  return 'text'
}

function mapOption(
  fieldName: string,
  option: string | FormFieldOption,
): FormFieldOption {
  if (typeof option !== 'string') return option

  if (fieldName === 'estado_civil' || fieldName === 'maritalStatus') {
    return {
      value: option,
      label: MARITAL_LABELS[option] ?? capitalize(option),
    }
  }

  return { value: option, label: option }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function mapPlan(plan: DbPaymentPlan): PaymentPlan {
  return {
    id: plan.id,
    serviceId: plan.service_id,
    label: plan.label,
    description: plan.description,
    method: plan.method as PaymentMethod,
    mode: plan.mode,
    totalCents: plan.total_cents,
    signalCents: plan.signal_cents,
    entryCents: plan.entry_cents,
    installmentCount: plan.installment_count,
    dueDateRule: plan.due_date_rule as DueDateRule,
  }
}

export function mapService(service: DbProductService): ProductService {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    description: service.description,
    totalCents: service.total_cents,
  }
}

export function mapClient(
  process: DbProcess,
  client: DbClient | null,
): Partial<ClientData> {
  const form = asObject(process.form_data)
  const dbAddress = client ? asObject(client.address) : {}
  const formAddress = asObject(form.address)
  const extra = asObject(form.extra)

  const address = {
    cep: pickString(formAddress.cep, dbAddress.cep) ?? '',
    street: pickString(formAddress.street, dbAddress.logradouro, dbAddress.street) ?? '',
    number: pickString(formAddress.number, dbAddress.numero, dbAddress.number) ?? '',
    complement:
      pickString(formAddress.complement, dbAddress.complemento, dbAddress.complement) ?? '',
    neighborhood:
      pickString(formAddress.neighborhood, dbAddress.bairro, dbAddress.neighborhood) ?? '',
    city: pickString(formAddress.city, dbAddress.cidade, dbAddress.city) ?? '',
    state: pickString(formAddress.state, dbAddress.uf, dbAddress.state) ?? '',
  }

  return {
    fullName: pickString(form.fullName, client?.full_name) ?? '',
    cpf: pickString(form.cpf, client?.cpf) ?? '',
    email: pickString(form.email, client?.email) ?? '',
    phone: normalizePhone(pickString(form.phone, client?.phone_e164) ?? ''),
    maritalStatus: pickString(form.maritalStatus) ?? '',
    profession: pickString(form.profession) ?? '',
    nationality: pickString(form.nationality) ?? 'Brasileira',
    address,
    extra: Object.fromEntries(
      Object.entries(extra)
        .map(([key, value]) => [key, typeof value === 'string' ? value : ''])
        .filter(([, value]) => value !== ''),
    ),
  }
}

export function mapProcessBundle(bundle: ProcessBundle): ContractProcess {
  const { process, product, version, plans, services, requirements, signatures, payments, documents } = bundle
  const signatureDocuments = mapSignatureDocuments(bundle)
  const charges = mapPayments(payments)
  const financial = (process.financial_snapshot as FinancialSnapshot | null) ?? null
  const signatureStatus = process.signature_status as SignatureStatus
  const paymentStatus = process.payment_status as PaymentStatus

  return {
    id: process.id,
    publicCode: process.public_code,
    createdAt: process.created_at,
    updatedAt: process.updated_at,
    completedAt: process.completed_at,
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      shortName: product.short_name,
      description: product.description,
      version: version.version,
      contractLabel: version.contract_label,
      unlockCondition: process.unlock_condition as UnlockCondition,
      formSchema: mapFormSchema(version.form_schema),
      services: services.map(mapService),
      paymentPlans: plans.map(mapPlan),
    },
    client: mapClient(process, bundle.client),
    generalStatus: process.general_status as GeneralStatus,
    signatureStatus,
    paymentStatus,
    documentsStatus: process.documents_status as DocumentsStatus,
    financial,
    selectedPlanId: process.selected_plan_id,
    currentStep: process.current_step as WizardStepId,
    completedSteps: process.completed_steps as WizardStepId[],
    signature:
      signatureDocuments.length > 0
        ? { status: signatureStatus, documents: signatureDocuments }
        : null,
    payment: charges.length > 0
      ? {
          status: paymentStatus,
          charges,
          checkoutUrl: charges.find((charge) => charge.invoiceUrl)?.invoiceUrl ?? null,
        }
      : null,
    documents: mapDocuments(requirements, documents),
    consent: bundle.consent
      ? {
          version: bundle.consent.version,
          acceptedAt: bundle.consent.accepted_at ?? bundle.consent.created_at,
        }
      : null,
    attribution: process.attribution,
    events: bundle.events
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(mapEvent),
  }
}

function mapSignatureDocuments(bundle: ProcessBundle): SignatureDocumentState[] {
  const templateNames = new Map(
    bundle.templates.map((template) => [template.id, template.name]),
  )
  const kitByTemplate = new Map(
    bundle.kitItems.map((item) => [item.contract_template_id, item]),
  )

  return bundle.signatures
    .slice()
    .sort((a, b) => {
      const orderA = kitByTemplate.get(a.template_id ?? '')?.sort_order ?? 0
      const orderB = kitByTemplate.get(b.template_id ?? '')?.sort_order ?? 0
      return orderA - orderB
    })
    .map((signature) => ({
      id: signature.id,
      name:
        (signature.template_id ? templateNames.get(signature.template_id) : null) ??
        'Documento',
      status: signature.status as SignatureStatus,
      signUrl: signature.signature_url,
      signedAt: signature.signed_at,
    }))
}

function mapPayments(payments: DbPayment[]): PaymentCharge[] {
  return payments
    .slice()
    .sort((a, b) => a.installment_number - b.installment_number)
    .map((payment) => ({
      id: payment.id,
      number: payment.installment_number,
      label: paymentLabel(payment),
      amountCents: payment.amount_cents,
      dueDate: payment.due_date,
      status: payment.status as PaymentStatus,
      invoiceUrl: payment.invoice_url,
    }))
}

function paymentLabel(payment: DbPayment & { payment_type?: string }): string {
  if (payment.payment_type === 'SIGNAL') return 'Sinal'
  if (payment.payment_type === 'ENTRY') return 'Entrada'
  return `Parcela ${payment.installment_number}`
}

function mapDocuments(
  requirements: DbDocumentRequirement[],
  documents: DbDocument[],
): DocumentState[] {
  return requirements
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((requirement) => {
      const latest = documents
        .filter((document) => document.document_requirement_id === requirement.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

      const status: DocumentState['status'] = !latest
        ? 'PENDENTE'
        : latest.storage_status === 'TRANSFERRED'
          ? 'ENVIADO'
          : latest.storage_status === 'ERROR'
            ? 'ERRO'
            : 'PROCESSANDO'

      return {
        id: requirement.id,
        label: requirement.label,
        description: requirement.description,
        required: requirement.required,
        acceptedMimeTypes: requirement.accepted_mime_types,
        maxSizeBytes: requirement.max_size_bytes,
        status,
        filename: latest?.original_filename ?? null,
        uploadedAt: latest?.uploaded_at ?? null,
      }
    })
}

function mapEvent(event: DbProcessEvent): ContractProcess['events'][number] {
  return {
    id: event.id,
    type: event.event_type,
    title: event.title,
    description: event.description,
    createdAt: event.created_at,
  }
}

export function mapAdminSummary(row: {
  id: string
  public_code: string
  general_status: string
  signature_status: string
  payment_status: string
  documents_status: string
  created_at: string
  updated_at: string
  clients: { full_name: string; cpf: string } | null
  products: { name: string } | null
}): AdminProcessSummary {
  return {
    id: row.id,
    publicCode: row.public_code,
    clientName: row.clients?.full_name ?? 'Sem nome',
    cpfMasked: maskCpf(row.clients?.cpf ?? ''),
    productName: row.products?.name ?? '—',
    generalStatus: row.general_status as GeneralStatus,
    signatureStatus: row.signature_status as SignatureStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    documentsStatus: row.documents_status as DocumentsStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D+/g, '')
  if (digits.length !== 11) return '—'
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return undefined
}
