import { describe, expect, it } from 'vitest'
import {
  distributeCents,
  formatBRL,
  formatCentsForInput,
  parseBRLToCents,
  sumCents,
} from './money'

describe('money', () => {
  it('converte texto em centavos', () => {
    expect(parseBRLToCents('1.234,56')).toBe(123456)
    expect(parseBRLToCents('1234,56')).toBe(123456)
    expect(parseBRLToCents('1234.56')).toBe(123456)
    expect(parseBRLToCents('R$ 500,00')).toBe(50000)
    expect(parseBRLToCents('')).toBeNull()
  })

  it('formata em reais', () => {
    expect(formatBRL(350000).replace(/\u00a0/g, ' ')).toBe('R$ 3.500,00')
    expect(formatCentsForInput(123456)).toBe('1.234,56')
  })

  it('soma inteiros', () => {
    expect(sumCents([50000, 50000, 50000])).toBe(150000)
  })

  it('distribui o resto na última parcela', () => {
    expect(distributeCents(100000, 3)).toEqual([33333, 33333, 33334])
    expect(distributeCents(300000, 6)).toEqual([50000, 50000, 50000, 50000, 50000, 50000])
  })

  it('rejeita quantidade inválida', () => {
    expect(() => distributeCents(100, 0)).toThrow()
  })
})
