/**
 * Tipos de domínio compartilhados pelas Edge Functions.
 *
 * Espelha o contrato consumido pelo frontend (src/features/process/domain/types.ts).
 * O DTO público deve permanecer idêntico a `ContractProcess`.
 */

export type GeneralStatus =
  | 'INICIADO'
  | 'DADOS_PENDENTES'
  | 'VALIDANDO_DADOS'
  | 'DADOS_INVALIDOS'
  | 'PRONTO_PARA_CONTRATO'
  | 'CONTRATO_EM_GERACAO'
  | 'AGUARDANDO_ASSINATURA_CLIENTE'
  | 'AGUARDANDO_ASSINATURA_INTERNA'
  | 'AGUARDANDO_PAGAMENTO'
  | 'AGUARDANDO_DOCUMENTOS'
  | 'DOCUMENTOS_EM_PROCESSAMENTO'
  | 'DOCUMENTACAO_CONCLUIDA'
  | 'CONCLUIDO'
  | 'CANCELADO'
  | 'ERRO_REQUER_INTERVENCAO'

export type SignatureStatus =
  | 'NAO_GERADA'
  | 'PENDENTE'
  | 'ASSINADA_CLIENTE'
  | 'ASSINADA_COMPLETA'
  | 'RECUSADA'
  | 'CANCELADA'

export type PaymentStatus =
  | 'NAO_CRIADO'
  | 'PENDENTE'
  | 'PARCIAL'
  | 'PAGO'
  | 'VENCIDO'
  | 'CANCELADO'
  | 'ESTORNADO'

export type DocumentsStatus =
  | 'NAO_INICIADA'
  | 'PENDENTE'
  | 'EM_ENVIO'
  | 'PARCIAL'
  | 'COMPLETA'
  | 'ERRO'

export type UnlockCondition =
  | 'IMMEDIATE'
  | 'AFTER_SIGNATURE'
  | 'AFTER_PAYMENT'
  | 'AFTER_BOTH'

export type WizardStepId =
  | 'dados'
  | 'contrato'
  | 'assinatura'
  | 'pagamento'
  | 'documentos'

export type PaymentMethod = 'PIX' | 'BOLETO' | 'CARD'

export type DueDateRule =
  | { type: 'LAST_DAY_OF_MONTH' }
  | { type: 'FIRST_BUSINESS_DAY' }
  | { type: 'LAST_BUSINESS_DAY' }
  | { type: 'FIXED_DAY'; day: number }

export interface Address {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export interface ClientData {
  fullName: string
  cpf: string
  email: string
  phone: string
  maritalStatus: string
  profession: string
  nationality: string
  address: Address
  extra: Record<string, string>
}

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'cpf'
  | 'date'
  | 'select'
  | 'textarea'

export interface FormFieldOption {
  value: string
  label: string
}

/** Objeto do contrato. Define campos visíveis e variáveis do template. */
export type ServiceObjectType = 'BANK' | 'PUBLIC_ENTITY' | 'NONE'

/** Cláusula de êxito aplicável ao serviço contratado. */
export type ServiceSuccessMode = 'REDUCAO' | 'CLAUSULA_BRANCA' | 'CLAUSULA_ADMINISTRATIVA'

/** Condição declarativa de exibição de um campo (hoje, o objeto do serviço). */
export interface FormFieldVisibility {
  objectType?: ServiceObjectType | ServiceObjectType[]
}

export interface FormField {
  name: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  hint?: string
  autoComplete?: string
  maxLength?: number
  options?: FormFieldOption[]
  defaultValue?: string
  colSpan?: 1 | 2
  visibleWhen?: FormFieldVisibility
}

export interface FormStep {
  id: WizardStepId
  title: string
  description: string
  fields: FormField[]
}

export interface ProductService {
  id: string
  code: string
  name: string
  description: string
  totalCents: number
  groupNumber: number
  objectType: ServiceObjectType
  successMode: ServiceSuccessMode
  /** Código lógico do kit documental; '' quando não configurado. */
  kitCode: string
  requiresVehicleData: boolean
}

export interface PaymentPlan {
  id: string
  serviceId: string | null
  label: string
  description: string
  method: PaymentMethod
  mode: 'AVISTA' | 'PARCELADO'
  totalCents: number
  signalCents: number
  entryCents: number
  installmentCount: number
  dueDateRule: DueDateRule
}

export interface ProductSnapshot {
  id: string
  slug: string
  name: string
  shortName: string
  description: string
  version: number
  contractLabel: string
  unlockCondition: UnlockCondition
  formSchema: FormStep[]
  services: ProductService[]
  paymentPlans: PaymentPlan[]
}

export interface FinancialInstallment {
  number: number
  dueDate: string
  amountCents: number
}

export interface FinancialSnapshot {
  planId: string
  method: PaymentMethod
  totalCents: number
  signalCents: number
  entryCents: number
  installments: FinancialInstallment[]
  dueDateRule: DueDateRule
  computedAt: string
}

export interface SignatureDocumentState {
  id: string
  name: string
  status: SignatureStatus
  signUrl: string | null
  signedAt: string | null
}

export interface SignatureSummary {
  status: SignatureStatus
  documents: SignatureDocumentState[]
}

export interface PaymentCharge {
  id: string
  number: number
  label: string
  amountCents: number
  dueDate: string
  status: PaymentStatus
  invoiceUrl: string | null
}

export interface PaymentSummary {
  status: PaymentStatus
  charges: PaymentCharge[]
  checkoutUrl: string | null
}

export interface DocumentRequirement {
  id: string
  label: string
  description: string
  required: boolean
  acceptedMimeTypes: readonly string[]
  maxSizeBytes: number
}

export interface DocumentState extends DocumentRequirement {
  status: 'PENDENTE' | 'ENVIADO' | 'PROCESSANDO' | 'ERRO'
  filename: string | null
  uploadedAt: string | null
}

export interface ConsentRecord {
  version: string
  acceptedAt: string
}

export interface ProcessEvent {
  id: string
  type: string
  title: string
  description: string
  createdAt: string
}

export interface ContractProcess {
  id: string
  publicCode: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  product: ProductSnapshot
  client: Partial<ClientData>
  generalStatus: GeneralStatus
  signatureStatus: SignatureStatus
  paymentStatus: PaymentStatus
  documentsStatus: DocumentsStatus
  financial: FinancialSnapshot | null
  selectedPlanId: string | null
  selectedServiceId: string | null
  currentStep: WizardStepId
  completedSteps: WizardStepId[]
  signature: SignatureSummary | null
  payment: PaymentSummary | null
  documents: DocumentState[]
  consent: ConsentRecord | null
  attribution: Record<string, string>
  events: ProcessEvent[]
}

export interface AdminProcessSummary {
  id: string
  publicCode: string
  clientName: string
  cpfMasked: string
  productName: string
  generalStatus: GeneralStatus
  signatureStatus: SignatureStatus
  paymentStatus: PaymentStatus
  documentsStatus: DocumentsStatus
  createdAt: string
  updatedAt: string
}

/** Ordem canônica do wizard. Também define a sequência aceita pela API. */
export const WIZARD_STEP_ORDER: readonly WizardStepId[] = [
  'dados',
  'contrato',
  'assinatura',
  'pagamento',
  'documentos',
]

export function isWizardStep(value: string): value is WizardStepId {
  return (WIZARD_STEP_ORDER as readonly string[]).includes(value)
}
