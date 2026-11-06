import { describe, expect, it } from 'vitest'
import { buildStepSchema } from './buildStepSchema'
import type { FormStep } from '@/features/process-core'

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

const contract: FormStep = {
  id: 'contrato',
  title: 'Contrato',
  description: '',
  fields: [
    {
      name: 'extra.banco_instituicao_financeira',
      label: 'Banco / instituição financeira',
      type: 'text',
      required: true,
      visibleWhen: { objectType: 'BANK' },
    },
    {
      name: 'extra.ente_federativo_e_lei_aplicavel',
      label: 'Ente federativo e lei aplicável',
      type: 'text',
      required: true,
      visibleWhen: { objectType: 'PUBLIC_ENTITY' },
    },
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

  it('exige apenas o campo condicional do tipo de objeto informado', () => {
    const bank = buildStepSchema(contract, { objectType: 'BANK' })
    const publicEntity = buildStepSchema(contract, { objectType: 'PUBLIC_ENTITY' })

    expect(
      bank.safeParse({ extra: { banco_instituicao_financeira: 'Banco Itaú' } }).success,
    ).toBe(true)
    expect(
      bank.safeParse({ extra: { ente_federativo_e_lei_aplicavel: 'União' } }).success,
    ).toBe(false)

    expect(
      publicEntity.safeParse({ extra: { ente_federativo_e_lei_aplicavel: 'União' } }).success,
    ).toBe(true)
    expect(
      publicEntity.safeParse({ extra: { banco_instituicao_financeira: 'Banco Itaú' } }).success,
    ).toBe(false)
  })

  it('não exige campos condicionais quando não há contexto de objeto', () => {
    const withoutContext = buildStepSchema(contract)

    expect(withoutContext.safeParse({}).success).toBe(true)
    expect(withoutContext.safeParse({ extra: {} }).success).toBe(true)
    expect(
      withoutContext.safeParse({ extra: { banco_instituicao_financeira: '' } }).success,
    ).toBe(true)
  })
})
