/** Validação server-side do Cloudflare Turnstile. */

import { fail } from '../http/errors.ts'

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string,
): Promise<void> {
  const secret = Deno.env.get('TURNSTILE_SECRET') ?? ''

  // Em desenvolvimento sem secret, não bloqueia. Em produção o secret é obrigatório.
  if (!secret) return

  if (!token) {
    throw fail.unprocessable('TURNSTILE_REQUIRED', 'Confirme a verificação de segurança.')
  }

  const body = new FormData()
  body.set('secret', secret)
  body.set('response', token)
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)

  let response: Response
  try {
    response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body, signal: AbortSignal.timeout(8000) },
    )
  } catch {
    throw fail.unavailable('Não foi possível validar a verificação de segurança.')
  }

  if (!response.ok) {
    throw fail.unavailable('Não foi possível validar a verificação de segurança.')
  }

  const result = (await response.json()) as TurnstileResponse
  if (!result.success) {
    console.warn('[turnstile] falha:', result['error-codes']?.join(',') ?? 'unknown')
    throw fail.unprocessable('TURNSTILE_FAILED', 'Verificação de segurança inválida. Tente novamente.')
  }
}
