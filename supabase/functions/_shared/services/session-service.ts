/**
 * Sessão pública do cliente (`mv_...`).
 *
 * O token em claro só existe no navegador (ou no link enviado por e-mail); o
 * banco guarda apenas o SHA-256. Fica fora de `process-service` para que o
 * serviço de e-mail possa criar um link de acesso sem import circular.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { sha256Hex } from '../http/auth.ts'
import { fail } from '../http/errors.ts'

const TOKEN_PREFIX = 'mv_'
const SESSION_DAYS = 30

export async function createSession(
  supabase: SupabaseClient,
  processId: string,
): Promise<string> {
  const token = generateToken()
  const tokenHash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('sessions').insert({
    process_id: processId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })

  if (error) {
    console.error('[session] falha ao criar sessão:', error.message)
    throw fail.internal()
  }

  return token
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `${TOKEN_PREFIX}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
