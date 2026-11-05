/** CEP (cópia de src/shared/domain/cep.ts). */

export function normalizeCep(value: string): string {
  return value.replace(/\D+/g, '').slice(0, 8)
}

export function isValidCep(value: string): boolean {
  return normalizeCep(value).length === 8
}
