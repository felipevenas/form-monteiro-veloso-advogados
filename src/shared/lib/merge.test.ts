import { describe, expect, it } from 'vitest'
import { mergeDeep } from './merge'

describe('mergeDeep', () => {
  it('mescla objetos aninhados sem apagar o que já existia', () => {
    const base = {
      fullName: 'Ana',
      address: { street: 'Rua A', city: 'Salvador' },
      extra: { plate: 'ABC1D23' },
    }

    const result = mergeDeep(base, {
      address: { number: '17' },
      extra: { model: 'Argo' },
    })

    expect(result).toEqual({
      fullName: 'Ana',
      address: { street: 'Rua A', city: 'Salvador', number: '17' },
      extra: { plate: 'ABC1D23', model: 'Argo' },
    })
  })

  it('substitui arrays e primitivos', () => {
    expect(mergeDeep({ list: [1, 2] }, { list: [3] })).toEqual({ list: [3] })
    expect(mergeDeep({ name: 'Ana' }, { name: 'Bia' })).toEqual({ name: 'Bia' })
  })

  it('ignora patch undefined', () => {
    expect(mergeDeep({ name: 'Ana' }, { name: undefined })).toEqual({ name: 'Ana' })
  })
})
