import { describe, expect, it } from 'vitest'
import { buildFinancialSnapshot, buildSnapshotFromPlan } from './financial'
import type { PaymentPlan } from './types'

const plan: PaymentPlan = {
  id: 'parcelado',
  serviceId: 'srv-teste',
  label: 'Sinal + 6 parcelas',
  description: 'Teste',
  method: 'PIX',
  mode: 'PARCELADO',
  totalCents: 350000,
  signalCents: 50000,
  entryCents: 0,
  installmentCount: 6,
  dueDateRule: { type: 'FIXED_DAY', day: 10 },
}

describe('buildFinancialSnapshot', () => {
  it('fecha a soma e gera a agenda', () => {
    const result = buildSnapshotFromPlan(plan, '2026-10-28', new Set(), new Date('2026-10-28'))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.totalCents).toBe(350000)
    expect(result.value.installments).toHaveLength(6)
    expect(result.value.installments[0]?.amountCents).toBe(50000)
    expect(result.value.installments.reduce((sum, item) => sum + item.amountCents, 0)).toBe(
      300000,
    )
    expect(result.value.installments[0]?.dueDate).toBe('2026-11-10')
  })

  it('bloqueia quando sinal e entrada consomem o total', () => {
    const result = buildFinancialSnapshot(
      {
        planId: 'x',
        method: 'PIX',
        totalCents: 100000,
        signalCents: 60000,
        entryCents: 50000,
        installmentCount: 2,
        dueDateRule: { type: 'FIXED_DAY', day: 10 },
      },
      '2026-10-28',
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/consomem/)
    }
  })

  it('rejeita total inválido', () => {
    const result = buildFinancialSnapshot(
      {
        planId: 'x',
        method: 'PIX',
        totalCents: 0,
        signalCents: 0,
        entryCents: 0,
        installmentCount: 1,
        dueDateRule: { type: 'FIXED_DAY', day: 10 },
      },
      '2026-10-28',
    )

    expect(result.ok).toBe(false)
  })
})
