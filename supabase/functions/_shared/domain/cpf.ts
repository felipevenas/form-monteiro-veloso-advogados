/** Regras puras de CPF (cópia de src/shared/domain/cpf.ts). */

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '')
}

export function normalizeCpf(value: string): string {
  return onlyDigits(value).slice(0, 11)
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digits = cpf.split('').map(Number)

  const firstCheck = calculateCheckDigit(digits.slice(0, 9), 10)
  if (firstCheck !== digits[9]) return false

  const secondCheck = calculateCheckDigit(digits.slice(0, 10), 11)
  return secondCheck === digits[10]
}

function calculateCheckDigit(digits: number[], initialWeight: number): number {
  const sum = digits.reduce((total, digit, index) => total + digit * (initialWeight - index), 0)
  const remainder = (sum * 10) % 11
  return remainder === 10 ? 0 : remainder
}

export function maskCpf(value: string): string {
  const digits = normalizeCpf(value)
  if (digits.length !== 11) return '***'
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}
