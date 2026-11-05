import type { ContractProcess, WizardStepId } from '../domain/types'

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

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown

  constructor(code: string, message: string, status = 500, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}
