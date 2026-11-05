/** Regras de liberação e estado do processo (cópia de src/features/process/domain/workflow.ts). */

import type {
  ContractProcess,
  DocumentState,
  DocumentsStatus,
  PaymentStatus,
  SignatureStatus,
} from './types.ts'

export function areDocumentsUnlocked(process: {
  generalStatus: string
  completedSteps: string[]
  signatureStatus: SignatureStatus
  paymentStatus: PaymentStatus
  unlockCondition: string
  financialSignalCents: number
}): boolean {
  if (process.generalStatus === 'CANCELADO') return false
  if (!process.completedSteps.includes('pagamento')) return false

  const signatureComplete =
    process.signatureStatus === 'ASSINADA_CLIENTE' ||
    process.signatureStatus === 'ASSINADA_COMPLETA'
  const paymentSatisfied =
    process.paymentStatus === 'PAGO' ||
    (process.paymentStatus === 'PARCIAL' && process.financialSignalCents > 0)

  switch (process.unlockCondition) {
    case 'IMMEDIATE':
      return true
    case 'AFTER_SIGNATURE':
      return signatureComplete
    case 'AFTER_PAYMENT':
      return paymentSatisfied
    case 'AFTER_BOTH':
      return signatureComplete && paymentSatisfied
    default:
      return false
  }
}

export function areDocumentsUnlockedForDto(process: ContractProcess): boolean {
  return areDocumentsUnlocked({
    generalStatus: process.generalStatus,
    completedSteps: process.completedSteps,
    signatureStatus: process.signatureStatus,
    paymentStatus: process.paymentStatus,
    unlockCondition: process.product.unlockCondition,
    financialSignalCents: process.financial?.signalCents ?? 0,
  })
}

export function computeSignatureStatus(
  documents: ReadonlyArray<{ status: SignatureStatus }>,
): SignatureStatus {
  if (documents.length === 0) return 'NAO_GERADA'
  if (documents.some((document) => document.status === 'RECUSADA')) return 'RECUSADA'
  if (documents.every((document) => document.status === 'ASSINADA_COMPLETA')) {
    return 'ASSINADA_COMPLETA'
  }
  if (
    documents.some(
      (document) =>
        document.status === 'ASSINADA_CLIENTE' || document.status === 'ASSINADA_COMPLETA',
    )
  ) {
    return 'ASSINADA_CLIENTE'
  }
  if (documents.every((document) => document.status === 'CANCELADA')) return 'CANCELADA'
  return 'PENDENTE'
}

export function computePaymentStatus(
  charges: ReadonlyArray<{ status: PaymentStatus }>,
): PaymentStatus {
  if (charges.length === 0) return 'NAO_CRIADO'
  if (charges.every((charge) => charge.status === 'PAGO')) return 'PAGO'
  if (charges.some((charge) => charge.status === 'PAGO')) return 'PARCIAL'
  if (charges.some((charge) => charge.status === 'VENCIDO')) return 'VENCIDO'
  if (charges.every((charge) => charge.status === 'ESTORNADO')) return 'ESTORNADO'
  if (charges.every((charge) => charge.status === 'CANCELADO')) return 'CANCELADO'
  return 'PENDENTE'
}

export function computeDocumentsStatus(
  documents: ReadonlyArray<DocumentState>,
): DocumentsStatus {
  const required = documents.filter((document) => document.required)
  if (required.length === 0) return 'NAO_INICIADA'

  const uploaded = required.filter((document) =>
    document.status === 'ENVIADO' || document.status === 'PROCESSANDO'
  )

  if (uploaded.length === required.length) return 'COMPLETA'
  if (uploaded.length > 0) return 'PARCIAL'
  if (documents.some((document) => document.status === 'ERRO')) return 'ERRO'
  return 'PENDENTE'
}
