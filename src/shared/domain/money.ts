const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Formata centavos como moeda brasileira. */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100)
}

/** Formata centavos sem símbolo, para inputs. Ex.: 123456 -> "1.234,56". */
export function formatCentsForInput(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Converte texto digitado em centavos.
 * Aceita "1.234,56", "1234,56", "1234.56" e "1234".
 * Retorna null quando não há número válido.
 */
export function parseBRLToCents(value: string): number | null {
  const raw = value.trim()
  if (!raw) return null

  const hasComma = raw.includes(',')
  let normalized = raw.replace(/[^\d,.-]/g, '')

  if (hasComma) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '')
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null

  return Math.round(parsed * 100)
}

/** Soma valores em centavos sem ponto flutuante. */
export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + Math.trunc(value), 0)
}

/**
 * Divide um total em N parcelas iguais, jogando o resto na última.
 * Alinhado ao comportamento do Asaas.
 */
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
