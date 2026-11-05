/**
 * Timeline do processo e alertas internos.
 *
 * Fica separado de `process-service` para que adaptadores (e-mail, por exemplo)
 * registrem eventos e alertas sem criar import circular com os casos de uso.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function recordEvent(
  supabase: SupabaseClient,
  processId: string,
  input: {
    type: string
    title: string
    description: string
    actorType?: 'SYSTEM' | 'CLIENT' | 'ADMIN'
    actorId?: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await supabase.from('process_events').insert({
    contract_process_id: processId,
    event_type: input.type,
    title: input.title,
    description: input.description,
    actor_type: input.actorType ?? 'SYSTEM',
    actor_id: input.actorId ?? null,
    payload: input.payload ?? {},
  })

  if (error) {
    console.error('[events] falha ao registrar evento:', error.message)
  }
}

export async function ensureAlert(
  supabase: SupabaseClient,
  input: {
    key: string
    title: string
    description: string
    processId?: string | null
    severity?: 'INFO' | 'WARNING' | 'CRITICAL'
  },
): Promise<void> {
  const { data: open } = await supabase
    .from('alerts')
    .select('id')
    .eq('alert_key', input.key)
    .eq('status', 'OPEN')
    .maybeSingle<{ id: string }>()

  if (open) return

  await supabase.from('alerts').insert({
    alert_key: input.key,
    title: input.title,
    description: input.description,
    severity: input.severity ?? 'WARNING',
    contract_process_id: input.processId ?? null,
  })
}
