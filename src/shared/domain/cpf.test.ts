import { describe, expect, it } from 'vitest'
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from './cpf'

describe('cpf', () => {
  it('normaliza para 11 dígitos', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725')
    expect(normalizeCpf('529982247251234')).toBe('52998224725')
  })

  it('aceita CPFs válidos', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('111.444.777-35')).toBe(true)
    expect(isValidCpf('123.456.789-09')).toBe(true)
  })

  it('rejeita CPFs inválidos', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })

  it('formata e mascara', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('52998224725')).toBe('***.982.247-**')
  })
})
