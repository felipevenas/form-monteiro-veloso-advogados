export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '')
}

/** Remove máscara e normaliza o CPF para 11 dígitos. */
export function normalizeCpf(value: string): string {
  return onlyDigits(value).slice(0, 11)
}

/** Validação de CPF com dígitos verificadores. */
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

/** Aplica máscara 000.000.000-00 progressivamente, sem alterar os dígitos. */
export function formatCpf(value: string): string {
  const digits = normalizeCpf(value)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

/** Mascara um CPF para logs e listagens. Ex.: 123.456.789-00 -> ***.456.789-** */
export function maskCpf(value: string): string {
  const digits = normalizeCpf(value)
  if (digits.length !== 11) return '***'
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}
