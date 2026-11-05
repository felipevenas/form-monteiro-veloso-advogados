import { describe, expect, it } from 'vitest'
import { buildStepSchema } from './build-step-schema'
import type { FormStep } from '@/features/process'

const identification: FormStep = {
  id: 'dados',
  title: 'Identificação',
  description: '',
  fields: [
    { name: 'fullName', label: 'Nome completo', type: 'text', required: true },
    { name: 'cpf', label: 'CPF', type: 'cpf', required: true },
    { name: 'email', label: 'E-mail', type: 'email', required: true },
    { name: 'phone', label: 'WhatsApp', type: 'tel', required: true },
  ],
}

const address: FormStep = {
  id: 'dados',
  title: 'Endereço',
  description: '',
  fields: [
    { name: 'address.cep', label: 'CEP', type: 'text', required: true, maxLength: 9 },
    { name: 'address.complement', label: 'Complemento', type: 'text', required: false },
  ],
}

describe('buildStepSchema', () => {
  it('aceita dados válidos', () => {
    const result = buildStepSchema(identification).safeParse({
      fullName: 'Ana Paula',
      cpf: '529.982.247-25',
      email: 'ana@example.com',
      phone: '(71) 99999-9999',
    })

    expect(result.success).toBe(true)
  })

  it('rejeita CPF e e-mail inválidos', () => {
    const result = buildStepSchema(identification).safeParse({
      fullName: 'Ana',
      cpf: '111.111.111-11',
      email: 'nao-e-email',
      phone: '(71) 99999-9999',
    })

    expect(result.success).toBe(false)
  })

  it('exige campos obrigatórios', () => {
    const result = buildStepSchema(identification).safeParse({
      fullName: '',
      cpf: '',
      email: '',
      phone: '',
    })

    expect(result.success).toBe(false)
  })

  it('aceita complemento vazio e valida caminho aninhado', () => {
    const withAddress = buildStepSchema(address).safeParse({
      address: { cep: '40015-000', complement: '' },
    })
    const withoutCep = buildStepSchema(address).safeParse({
      address: { cep: '', complement: '' },
    })

    expect(withAddress.success).toBe(true)
    expect(withoutCep.success).toBe(false)
  })
})
