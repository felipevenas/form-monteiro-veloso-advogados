/** Chave de idempotência opcional enviada pelo cliente. */

import { fail } from './errors.ts'

const KEY_PATTERN = /^[A-Za-z0-9:_\-.]{8,128}$/

export function readIdempotencyKey(request: Request): string | null {
  const value = request.headers.get('idempotency-key')?.trim()
  if (!value) return null
  if (!KEY_PATTERN.test(value)) {
    throw fail.invalidInput('Idempotency-Key inválida.')
  }
  return value
}

/** Chave determinística para operações derivadas de um evento de domínio. */
export function deterministicKey(...parts: Array<string | number>): string {
  return parts.map((part) => String(part)).join(':')
}
