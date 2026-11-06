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

export type UnlockCondition = 'IMMEDIATE' | 'AFTER_SIGNATURE' | 'AFTER_PAYMENT' | 'AFTER_BOTH'

export type WizardStepId =
  | 'dados'
  | 'contrato'
  | 'assinatura'
  | 'pagamento'
  | 'documentos'

export type PaymentMethod = 'PIX' | 'BOLETO' | 'CARD'

export type ServiceObjectType = 'BANK' | 'PUBLIC_ENTITY' | 'NONE'

export type ServiceSuccessMode =
  | 'REDUCAO'
  | 'CLAUSULA_BRANCA'
  | 'CLAUSULA_ADMINISTRATIVA'

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
  address: Partial<Address>
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
  visibleWhen?: FormFieldVisibility
  /** 2 = ocupa a linha inteira no desktop. */
  colSpan?: 1 | 2
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
  kitCode: string
  requiresVehicleData: boolean
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
  selectedServiceId: string | null
  selectedPlanId: string | null
  currentStep: WizardStepId
  completedSteps: WizardStepId[]
  signature: SignatureSummary | null
  payment: PaymentSummary | null
  documents: DocumentState[]
  consent: ConsentRecord | null
  attribution: Record<string, string>
  events: ProcessEvent[]
}

export type TrackKey = 'dados' | 'contrato' | 'assinatura' | 'pagamento' | 'documentos'

export type TrackTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface ProcessTrack {
  key: TrackKey
  label: string
  status: string
  detail: string
  tone: TrackTone
}

export type NextActionKind = 'FORM' | 'SIGN' | 'PAY' | 'UPLOAD' | 'WAIT' | 'DONE' | 'CONTACT'

export interface NextAction {
  kind: NextActionKind
  title: string
  description: string
  cta: string | null
}

export interface StartProcessInput {
  productSlug?: string
  attribution?: Record<string, string>
  turnstileToken?: string
}

export interface StartSignatureInput {
  planId: string
  consentVersion: string
  consentAccepted: boolean
}

export interface CheckoutResult {
  checkoutUrl: string
}

export interface StartProcessResult {
  token: string
  process: ContractProcess
}

export interface ProcessRepository {
  start(input: StartProcessInput): Promise<StartProcessResult>
  get(token: string): Promise<ContractProcess>
  saveStep(
    token: string,
    step: WizardStepId,
    values: Record<string, unknown>,
  ): Promise<ContractProcess>
  saveDraft(
    token: string,
    step: WizardStepId,
    values: Record<string, unknown>,
  ): Promise<{ savedAt: string }>
  savePlan(token: string, planId: string): Promise<ContractProcess>
  startSignature(token: string, input: StartSignatureInput): Promise<ContractProcess>
  createCheckout(token: string): Promise<CheckoutResult>
  uploadDocument(token: string, requirementId: string, file: File): Promise<ContractProcess>
  removeDocument(token: string, requirementId: string): Promise<ContractProcess>
  /** Disponível apenas no modo mock, para demonstração e testes E2E. */
  simulate?: (token: string, event: 'sign' | 'pay') => Promise<ContractProcess>
}
