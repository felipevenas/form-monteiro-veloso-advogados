import { onlyDigits } from './cpf'

/** Normaliza um telefone brasileiro para dígitos (DDD + número). */
export function normalizePhone(value: string): string {
  let digits = onlyDigits(value)

  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2)
  }

  return digits.slice(0, 11)
}

/** Valida DDD + telefone fixo (10) ou celular (11, iniciando em 9). */
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

/** Formata progressivamente: (71) 99999-9999 ou (71) 3333-4444. */
export function formatPhone(value: string): string {
  const digits = normalizePhone(value)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`

  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (rest.length <= 4) return `(${ddd}) ${rest}`
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
}

/** Converte para E.164 brasileiro. Ex.: +5571999999999 */
export function toE164Br(value: string): string | null {
  const digits = normalizePhone(value)
  if (!isValidPhone(digits)) return null
  return `+55${digits}`
}
