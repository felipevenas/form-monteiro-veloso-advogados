import { describe, expect, it } from 'vitest'
import { formatPhone, isValidPhone, normalizePhone, toE164Br } from './phone'

describe('phone', () => {
  it('normaliza e remove o código do país', () => {
    expect(normalizePhone('+55 (71) 99999-9999')).toBe('71999999999')
    expect(normalizePhone('(71) 3333-4444')).toBe('7133334444')
  })

  it('valida celular e fixo', () => {
    expect(isValidPhone('(71) 99999-9999')).toBe(true)
    expect(isValidPhone('(71) 3333-4444')).toBe(true)
    expect(isValidPhone('(71) 89999-9999')).toBe(false)
    expect(isValidPhone('(10) 99999-9999')).toBe(false)
  })

  it('formata progressivamente', () => {
    expect(formatPhone('71999999999')).toBe('(71) 99999-9999')
    expect(formatPhone('7133334444')).toBe('(71) 3333-4444')
  })

  it('converte para E.164', () => {
    expect(toE164Br('(71) 99999-9999')).toBe('+5571999999999')
    expect(toE164Br('123')).toBeNull()
  })
})
