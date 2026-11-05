/** Regras puras de telefone brasileiro (cópia de src/shared/domain/phone.ts). */

import { onlyDigits } from './cpf.ts'

export function normalizePhone(value: string): string {
  let digits = onlyDigits(value)

  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2)
  }

  return digits.slice(0, 11)
}

export function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value)
  if (digits.length !== 10 && digits.length !== 11) return false

  const ddd = Number(digits.slice(0, 2))
  if (ddd < 11 || ddd > 99) return false

  if (digits.length === 11) {
    return digits[2] === '9'
  }

  return /^[2-5]/.test(digits[2] ?? '')
}

export function toE164Br(value: string): string | null {
  const digits = normalizePhone(value)
  if (!isValidPhone(digits)) return null
  return `+55${digits}`
}
