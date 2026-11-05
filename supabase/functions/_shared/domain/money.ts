/** Aritmética de centavos (cópia de src/shared/domain/money.ts). */

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + Math.trunc(value), 0)
}

/** Divide um total em N parcelas iguais, jogando o resto na última. */
export function distributeCents(totalCents: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('A quantidade de parcelas deve ser um inteiro maior que zero.')
  }

  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count

  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? base + remainder : base,
  )
}

export function centsToDecimal(cents: number): number {
  return Math.round(cents) / 100
}
