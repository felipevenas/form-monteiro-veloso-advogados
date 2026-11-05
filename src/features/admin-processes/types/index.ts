import type {
  ContractProcess,
  DocumentsStatus,
  GeneralStatus,
  PaymentStatus,
  SignatureStatus,
} from '@/features/process'

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

export interface AdminMetrics {
  total: number
  awaitingSignature: number
  awaitingPayment: number
  pendingDocuments: number
  completed: number
  errors: number
}

export interface AdminRepository {
  list(): Promise<AdminProcessSummary[]>
  get(id: string): Promise<ContractProcess | null>
}
