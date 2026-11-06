/** Linhas do banco usadas pelas funções (subset tipado do schema public). */

import type { DueDateRule } from '../domain/types.ts'

export interface ProcessSession {
  id: string
  process_id: string
  token_hash: string
  expires_at: string
  revoked_at: string | null
}

export interface AdminActor {
  id: string
  email: string
  fullName: string
  role: string
}

export interface DbFormField {
  name: string
  label: string
  type: string
  required?: boolean
  placeholder?: string
  hint?: string
  autocomplete?: string
  autoComplete?: string
  maxLength?: number
  colSpan?: 1 | 2
  options?: Array<string | { value: string; label: string }>
  mask?: string
  default?: string
  inputmode?: string
  consent_type?: string
  consent_version?: string
  visibleWhen?: { objectType?: string | string[] }
}

export interface DbFormStep {
  id: string
  title: string
  description?: string
  fields: DbFormField[]
}

export interface DbFormSchema {
  version?: number
  steps: DbFormStep[]
}

export interface DbProduct {
  id: string
  slug: string
  name: string
  short_name: string
  description: string
  active: boolean
}

export interface DbProductVersion {
  id: string
  product_id: string
  version: number
  status: string
  form_schema: DbFormSchema
  unlock_condition: string
  contract_label: string
}

export interface DbPaymentPlan {
  id: string
  product_version_id: string
  service_id: string | null
  label: string
  description: string
  method: 'PIX' | 'BOLETO' | 'CARD'
  mode: 'AVISTA' | 'PARCELADO'
  total_cents: number
  signal_cents: number
  entry_cents: number
  installment_count: number
  due_date_rule: DueDateRule
  active: boolean
}

export interface DbProductService {
  id: string
  product_version_id: string
  code: string
  name: string
  description: string
  total_cents: number
  active: boolean
  sort_order: number
  group_number: number
  object_type: string
  success_mode: string
  kit_code: string | null
  requires_vehicle_data: boolean
}

export interface DbDocumentRequirement {
  id: string
  product_version_id: string
  code: string
  label: string
  description: string
  required: boolean
  accepted_mime_types: string[]
  max_size_bytes: number
  sort_order: number
}

export interface DbProcess {
  id: string
  public_code: string
  client_id: string | null
  product_id: string
  product_version_id: string
  general_status: string
  signature_status: string
  payment_status: string
  documents_status: string
  current_step: string
  completed_steps: string[]
  form_data: Record<string, unknown>
  financial_snapshot: Record<string, unknown> | null
  unlock_condition: string
  attribution: Record<string, string>
  selected_plan_id: string | null
  selected_service_id: string | null
  automation_paused_at: string | null
  version: number
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DbClient {
  id: string
  full_name: string
  cpf: string
  email: string | null
  phone_e164: string | null
  address: Record<string, unknown>
  marital_status: string | null
  profession: string | null
  nationality: string | null
}

export interface DbTemplate {
  id: string
  external_template_id: string | null
  name: string
  template_type: string
  approval_status: string
  required_variables: string[]
}

export interface DbKitItem {
  id: string
  product_version_id: string
  contract_template_id: string
  service_id: string | null
  sort_order: number
  required: boolean
  signer_role: string
}

export interface DbSignature {
  id: string
  contract_process_id: string
  provider: string
  external_document_id: string | null
  template_id: string | null
  status: string
  signature_url: string | null
  signed_at: string | null
  last_event_at: string | null
  created_at: string
}

export interface DbPayment {
  id: string
  contract_process_id: string
  external_customer_id: string | null
  external_charge_id: string | null
  external_installment_id: string | null
  installment_number: number
  amount_cents: number
  due_date: string
  status: string
  paid_at: string | null
  invoice_url: string | null
  barcode_url: string | null
  pix_payload: string | null
  external_reference: string | null
}

export interface DbDocument {
  id: string
  contract_process_id: string
  document_requirement_id: string
  document_type: string | null
  required: boolean
  original_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  sha256: string | null
  storage_path: string | null
  storage_status: 'PENDING' | 'UPLOADED' | 'TRANSFERRED' | 'ERROR'
  drive_file_id: string | null
  drive_folder_id: string | null
  uploaded_at: string | null
  created_at: string
}

export interface DbProcessEvent {
  id: string
  contract_process_id: string
  event_type: string
  title: string
  description: string
  payload: Record<string, unknown>
  actor_type: string
  actor_id: string | null
  created_at: string
}

export interface DbConsent {
  id: string
  contract_process_id: string
  consent_type: string
  version: string
  accepted: boolean
  accepted_at: string | null
  created_at: string
}

export interface DbOutboxJob {
  id: string
  contract_process_id: string | null
  job_type: string
  payload: Record<string, unknown>
  idempotency_key: string
  status: string
  attempt_count: number
  max_attempts: number
  run_at: string
  next_attempt_at: string | null
  locked_at: string | null
  locked_by: string | null
  last_error: string | null
}

export interface DbIntegrationEvent {
  id: string
  provider: string
  external_event_id: string | null
  event_hash: string
  event_type: string | null
  contract_process_id: string | null
  status: string
  raw_payload: Record<string, unknown>
  error_code: string | null
  received_at: string
}

export interface DbSignatureWithTemplate extends DbSignature {
  contract_templates?: { name: string } | null
}

export interface ProcessBundle {
  process: DbProcess
  product: DbProduct
  version: DbProductVersion
  plans: DbPaymentPlan[]
  services: DbProductService[]
  requirements: DbDocumentRequirement[]
  kitItems: DbKitItem[]
  templates: DbTemplate[]
  client: DbClient | null
  signatures: DbSignature[]
  payments: DbPayment[]
  documents: DbDocument[]
  events: DbProcessEvent[]
  consent: DbConsent | null
}
