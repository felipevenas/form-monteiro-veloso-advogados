/** Rate limit em Postgres (RPC consume_rate_limit, janela fixa e atômica). */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { fail } from './errors.ts'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: string
}

interface ConsumeRow {
  allowed: boolean
  remaining: number
  reset_at: string
}

export async function consumeRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error('[rate-limit] RPC falhou:', error.message)
    // Falha fechada: sem rate limit não liberamos escrita pública.
    throw fail.unavailable('Não foi possível validar o limite de uso.')
  }

  const row = (Array.isArray(data) ? data[0] : data) as ConsumeRow | undefined
  if (!row) {
    throw fail.unavailable('Não foi possível validar o limite de uso.')
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    resetAt: row.reset_at,
  }
}

export async function enforceRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(supabase, key, limit, windowSeconds)
  if (!result.allowed) {
    throw fail.rateLimited(result.resetAt)
  }
  return result
}
