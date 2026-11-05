
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alerts": {
                  Row: {
                    "alert_key": string,"contract_process_id": string | null,"created_at": string,"description": string,"id": string,"last_sent_at": string | null,"resolved_at": string | null,"severity": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_key": string,"contract_process_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"last_sent_at"?: string | null,"resolved_at"?: string | null,"severity"?: string,"status"?: string,"title": string
                  }
                  Update: {
                    "alert_key"?: string,"contract_process_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"last_sent_at"?: string | null,"resolved_at"?: string | null,"severity"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_type": string,"contract_process_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": string,"metadata": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_type": string,"contract_process_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_type"?: string,"contract_process_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "address": NonNullable<Json>,"cpf": string,"created_at": string,"email": string | null,"external_asaas_customer_id": string | null,"full_name": string,"id": string,"infinitum_record_id": string | null,"phone_e164": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: NonNullable<Json>,"cpf": string,"created_at"?: string,"email"?: string | null,"external_asaas_customer_id"?: string | null,"full_name": string,"id"?: string,"infinitum_record_id"?: string | null,"phone_e164"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: NonNullable<Json>,"cpf"?: string,"created_at"?: string,"email"?: string | null,"external_asaas_customer_id"?: string | null,"full_name"?: string,"id"?: string,"infinitum_record_id"?: string | null,"phone_e164"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consent_records": {
                  Row: {
                    "accepted": boolean,"accepted_at": string | null,"consent_type": string,"contract_process_id": string,"created_at": string,"id": string,"ip_hash": string | null,"user_agent": string | null,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted"?: boolean,"accepted_at"?: string | null,"consent_type": string,"contract_process_id": string,"created_at"?: string,"id"?: string,"ip_hash"?: string | null,"user_agent"?: string | null,"version": string
                  }
                  Update: {
                    "accepted"?: boolean,"accepted_at"?: string | null,"consent_type"?: string,"contract_process_id"?: string,"created_at"?: string,"id"?: string,"ip_hash"?: string | null,"user_agent"?: string | null,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_records_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_processes": {
                  Row: {
                    "attribution": NonNullable<Json>,"client_id": string | null,"completed_at": string | null,"completed_steps": (string)[],"created_at": string,"current_step": string,"documents_status": string,"financial_snapshot": Json | null,"form_data": NonNullable<Json>,"general_status": string,"id": string,"payment_status": string,"product_id": string,"product_version_id": string,"public_code": string,"signature_status": string,"started_at": string,"unlock_condition": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attribution"?: NonNullable<Json>,"client_id"?: string | null,"completed_at"?: string | null,"completed_steps"?: (string)[],"created_at"?: string,"current_step"?: string,"documents_status"?: string,"financial_snapshot"?: Json | null,"form_data"?: NonNullable<Json>,"general_status"?: string,"id"?: string,"payment_status"?: string,"product_id": string,"product_version_id": string,"public_code": string,"signature_status"?: string,"started_at"?: string,"unlock_condition"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "attribution"?: NonNullable<Json>,"client_id"?: string | null,"completed_at"?: string | null,"completed_steps"?: (string)[],"created_at"?: string,"current_step"?: string,"documents_status"?: string,"financial_snapshot"?: Json | null,"form_data"?: NonNullable<Json>,"general_status"?: string,"id"?: string,"payment_status"?: string,"product_id"?: string,"product_version_id"?: string,"public_code"?: string,"signature_status"?: string,"started_at"?: string,"unlock_condition"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_processes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_processes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients_safe"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_processes_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_processes_product_version_id_fkey"
      columns: ["product_version_id"]
isOneToOne: false
      referencedRelation: "product_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_templates": {
                  Row: {
                    "approval_status": string,"approved_at": string | null,"approved_by": string | null,"created_at": string,"external_template_id": string | null,"id": string,"name": string,"required_variables": NonNullable<Json>,"template_type": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_status"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"external_template_id"?: string | null,"id"?: string,"name": string,"required_variables"?: NonNullable<Json>,"template_type": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "approval_status"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"external_template_id"?: string | null,"id"?: string,"name"?: string,"required_variables"?: NonNullable<Json>,"template_type"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"document_requirements": {
                  Row: {
                    "accepted_mime_types": (string)[],"code": string,"created_at": string,"description": string,"id": string,"label": string,"max_size_bytes": number,"product_version_id": string,"required": boolean,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_mime_types"?: (string)[],"code": string,"created_at"?: string,"description"?: string,"id"?: string,"label": string,"max_size_bytes"?: number,"product_version_id": string,"required"?: boolean,"sort_order"?: number
                  }
                  Update: {
                    "accepted_mime_types"?: (string)[],"code"?: string,"created_at"?: string,"description"?: string,"id"?: string,"label"?: string,"max_size_bytes"?: number,"product_version_id"?: string,"required"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_requirements_product_version_id_fkey"
      columns: ["product_version_id"]
isOneToOne: false
      referencedRelation: "product_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "contract_process_id": string,"created_at": string,"document_requirement_id": string,"document_type": string | null,"drive_file_id": string | null,"drive_folder_id": string | null,"id": string,"mime_type": string | null,"original_filename": string | null,"required": boolean,"sha256": string | null,"size_bytes": number | null,"storage_path": string | null,"storage_status": string,"stored_at": string | null,"updated_at": string,"uploaded_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_process_id": string,"created_at"?: string,"document_requirement_id": string,"document_type"?: string | null,"drive_file_id"?: string | null,"drive_folder_id"?: string | null,"id"?: string,"mime_type"?: string | null,"original_filename"?: string | null,"required"?: boolean,"sha256"?: string | null,"size_bytes"?: number | null,"storage_path"?: string | null,"storage_status"?: string,"stored_at"?: string | null,"updated_at"?: string,"uploaded_at"?: string | null
                  }
                  Update: {
                    "contract_process_id"?: string,"created_at"?: string,"document_requirement_id"?: string,"document_type"?: string | null,"drive_file_id"?: string | null,"drive_folder_id"?: string | null,"id"?: string,"mime_type"?: string | null,"original_filename"?: string | null,"required"?: boolean,"sha256"?: string | null,"size_bytes"?: number | null,"storage_path"?: string | null,"storage_status"?: string,"stored_at"?: string | null,"updated_at"?: string,"uploaded_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_document_requirement_id_fkey"
      columns: ["document_requirement_id"]
isOneToOne: false
      referencedRelation: "document_requirements"
      referencedColumns: ["id"]
    }
                  ]
                },"holidays": {
                  Row: {
                    "created_at": string,"date": string,"name": string,"scope": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"name": string,"scope"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"name"?: string,"scope"?: string
                  }
                  Relationships: [
                    
                  ]
                },"human_tasks": {
                  Row: {
                    "assigned_to": string | null,"completed_at": string | null,"contract_process_id": string | null,"created_at": string,"description": string,"id": string,"priority": number,"status": string,"task_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"completed_at"?: string | null,"contract_process_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"priority"?: number,"status"?: string,"task_type": string
                  }
                  Update: {
                    "assigned_to"?: string | null,"completed_at"?: string | null,"contract_process_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"priority"?: number,"status"?: string,"task_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "human_tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "human_tasks_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_configurations": {
                  Row: {
                    "active": boolean,"configuration": NonNullable<Json>,"created_at": string,"id": string,"integration_name": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"configuration"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"integration_name": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"configuration"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"integration_name"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_configurations_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_events": {
                  Row: {
                    "contract_process_id": string | null,"created_at": string,"error_code": string | null,"event_hash": string,"event_type": string | null,"external_event_id": string | null,"id": string,"processed_at": string | null,"provider": string,"raw_payload": NonNullable<Json>,"received_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_process_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"event_hash": string,"event_type"?: string | null,"external_event_id"?: string | null,"id"?: string,"processed_at"?: string | null,"provider": string,"raw_payload"?: NonNullable<Json>,"received_at"?: string,"status"?: string
                  }
                  Update: {
                    "contract_process_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"event_hash"?: string,"event_type"?: string | null,"external_event_id"?: string | null,"id"?: string,"processed_at"?: string | null,"provider"?: string,"raw_payload"?: NonNullable<Json>,"received_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_events_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"kit_items": {
                  Row: {
                    "contract_template_id": string,"created_at": string,"id": string,"product_version_id": string,"required": boolean,"signer_role": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_template_id": string,"created_at"?: string,"id"?: string,"product_version_id": string,"required"?: boolean,"signer_role"?: string,"sort_order"?: number
                  }
                  Update: {
                    "contract_template_id"?: string,"created_at"?: string,"id"?: string,"product_version_id"?: string,"required"?: boolean,"signer_role"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "kit_items_contract_template_id_fkey"
      columns: ["contract_template_id"]
isOneToOne: false
      referencedRelation: "contract_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kit_items_product_version_id_fkey"
      columns: ["product_version_id"]
isOneToOne: false
      referencedRelation: "product_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"message_logs": {
                  Row: {
                    "contract_process_id": string | null,"created_at": string,"error_code": string | null,"external_message_id": string | null,"id": string,"idempotency_key": string | null,"message_type": string,"provider": string,"recipient": string,"scheduled_at": string | null,"sent_at": string | null,"status": string,"template_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_process_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"external_message_id"?: string | null,"id"?: string,"idempotency_key"?: string | null,"message_type": string,"provider": string,"recipient": string,"scheduled_at"?: string | null,"sent_at"?: string | null,"status"?: string,"template_id"?: string | null
                  }
                  Update: {
                    "contract_process_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"external_message_id"?: string | null,"id"?: string,"idempotency_key"?: string | null,"message_type"?: string,"provider"?: string,"recipient"?: string,"scheduled_at"?: string | null,"sent_at"?: string | null,"status"?: string,"template_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_logs_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"otp_codes": {
                  Row: {
                    "attempts": number,"code_hash": string,"consumed_at": string | null,"created_at": string,"expires_at": string,"id": string,"process_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"code_hash": string,"consumed_at"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"process_id": string
                  }
                  Update: {
                    "attempts"?: number,"code_hash"?: string,"consumed_at"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"process_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "otp_codes_process_id_fkey"
      columns: ["process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"outbox_jobs": {
                  Row: {
                    "attempt_count": number,"contract_process_id": string | null,"created_at": string,"id": string,"idempotency_key": string,"job_type": string,"last_error": string | null,"locked_at": string | null,"locked_by": string | null,"max_attempts": number,"next_attempt_at": string | null,"payload": NonNullable<Json>,"run_at": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_count"?: number,"contract_process_id"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key": string,"job_type": string,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"next_attempt_at"?: string | null,"payload"?: NonNullable<Json>,"run_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempt_count"?: number,"contract_process_id"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key"?: string,"job_type"?: string,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"next_attempt_at"?: string | null,"payload"?: NonNullable<Json>,"run_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outbox_jobs_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_plans": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string,"due_date_rule": NonNullable<Json>,"entry_cents": number,"id": string,"installment_count": number,"label": string,"method": string,"mode": string,"product_version_id": string,"signal_cents": number,"total_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"due_date_rule"?: NonNullable<Json>,"entry_cents"?: number,"id"?: string,"installment_count"?: number,"label": string,"method": string,"mode": string,"product_version_id": string,"signal_cents"?: number,"total_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"due_date_rule"?: NonNullable<Json>,"entry_cents"?: number,"id"?: string,"installment_count"?: number,"label"?: string,"method"?: string,"mode"?: string,"product_version_id"?: string,"signal_cents"?: number,"total_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_plans_product_version_id_fkey"
      columns: ["product_version_id"]
isOneToOne: false
      referencedRelation: "product_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"barcode_url": string | null,"contract_process_id": string,"created_at": string,"due_date": string,"external_charge_id": string | null,"external_customer_id": string | null,"external_installment_id": string | null,"external_reference": string | null,"id": string,"installment_number": number,"invoice_url": string | null,"paid_at": string | null,"pix_payload": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"barcode_url"?: string | null,"contract_process_id": string,"created_at"?: string,"due_date": string,"external_charge_id"?: string | null,"external_customer_id"?: string | null,"external_installment_id"?: string | null,"external_reference"?: string | null,"id"?: string,"installment_number"?: number,"invoice_url"?: string | null,"paid_at"?: string | null,"pix_payload"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"barcode_url"?: string | null,"contract_process_id"?: string,"created_at"?: string,"due_date"?: string,"external_charge_id"?: string | null,"external_customer_id"?: string | null,"external_installment_id"?: string | null,"external_reference"?: string | null,"id"?: string,"installment_number"?: number,"invoice_url"?: string | null,"paid_at"?: string | null,"pix_payload"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"process_events": {
                  Row: {
                    "actor_id": string | null,"actor_type": string,"contract_process_id": string,"created_at": string,"description": string,"event_type": string,"id": string,"payload": NonNullable<Json>,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"actor_type"?: string,"contract_process_id": string,"created_at"?: string,"description"?: string,"event_type": string,"id"?: string,"payload"?: NonNullable<Json>,"title": string
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_type"?: string,"contract_process_id"?: string,"created_at"?: string,"description"?: string,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "process_events_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"product_versions": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"contract_label": string,"created_at": string,"form_schema": NonNullable<Json>,"id": string,"product_id": string,"status": string,"unlock_condition": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"contract_label"?: string,"created_at"?: string,"form_schema": NonNullable<Json>,"id"?: string,"product_id": string,"status"?: string,"unlock_condition"?: string,"version": number
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"contract_label"?: string,"created_at"?: string,"form_schema"?: NonNullable<Json>,"id"?: string,"product_id"?: string,"status"?: string,"unlock_condition"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_versions_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string,"id": string,"name": string,"short_name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"id"?: string,"name": string,"short_name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"id"?: string,"name"?: string,"short_name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"created_at": string,"email": string,"full_name": string,"id": string,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"role"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sessions": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"ip_hash": string | null,"last_seen_at": string,"process_id": string,"revoked_at": string | null,"token_hash": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"id"?: string,"ip_hash"?: string | null,"last_seen_at"?: string,"process_id": string,"revoked_at"?: string | null,"token_hash": string,"user_agent"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"ip_hash"?: string | null,"last_seen_at"?: string,"process_id"?: string,"revoked_at"?: string | null,"token_hash"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_process_id_fkey"
      columns: ["process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    }
                  ]
                },"signatures": {
                  Row: {
                    "contract_process_id": string,"created_at": string,"external_document_id": string | null,"id": string,"last_event_at": string | null,"provider": string,"signature_url": string | null,"signed_at": string | null,"status": string,"template_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_process_id": string,"created_at"?: string,"external_document_id"?: string | null,"id"?: string,"last_event_at"?: string | null,"provider"?: string,"signature_url"?: string | null,"signed_at"?: string | null,"status"?: string,"template_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "contract_process_id"?: string,"created_at"?: string,"external_document_id"?: string | null,"id"?: string,"last_event_at"?: string | null,"provider"?: string,"signature_url"?: string | null,"signed_at"?: string | null,"status"?: string,"template_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "signatures_contract_process_id_fkey"
      columns: ["contract_process_id"]
isOneToOne: false
      referencedRelation: "contract_processes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "signatures_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "contract_templates"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "clients_safe": {
                  Row: {
                    "address": Json | null,"cpf": string | null,"created_at": string,"email": string | null,"full_name": string,"id": string,"phone_e164": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                           "address"?: never,"cpf"?: never,"created_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string | null,"phone_e164"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "address"?: never,"cpf"?: never,"created_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string | null,"phone_e164"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "claim_outbox_jobs":
{ Args: { "p_limit"?: number,"p_worker_id"?: string }; Returns: {
              "attempt_count": number,
"contract_process_id": string | null,
"created_at": string,
"id": string,
"idempotency_key": string,
"job_type": string,
"last_error": string | null,
"locked_at": string | null,
"locked_by": string | null,
"max_attempts": number,
"next_attempt_at": string | null,
"payload": NonNullable<Json>,
"run_at": string,
"status": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "outbox_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"consume_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: {
              "allowed": boolean,"remaining": number,"reset_at": string
            }[]
                           },
"current_role_name":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"has_role":
{ Args: { "roles": (string)[] }; Returns: boolean
                           },
"has_sensitive_access":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
