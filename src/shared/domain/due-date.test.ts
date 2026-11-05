import { describe, expect, it } from 'vitest'
import { calculateDueDates, monthlySchedule, requiresIndividualCharges } from './due-date'
import type { HolidayCalendar } from './dates'

const holidays: HolidayCalendar = new Set([
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-04-03',
  '2026-04-21',
  '2026-05-01',
  '2026-06-04',
  '2026-09-07',
  '2026-10-12',
  '2026-11-02',
  '2026-11-15',
  '2026-11-20',
  '2026-12-25',
])

describe('calculateDueDates', () => {
  it('dia fixo cai no mês seguinte quando o dia já passou', () => {
    const dates = calculateDueDates({ type: 'FIXED_DAY', day: 10 }, '2026-10-28', 2, holidays)
    expect(dates.map((item) => item.dueDate)).toEqual(['2026-11-10', '2026-12-10'])
  })

  it('dia fixo usa o mês corrente quando ainda não passou', () => {
    const dates = calculateDueDates({ type: 'FIXED_DAY', day: 10 }, '2026-10-05', 1, holidays)
    expect(dates[0]?.dueDate).toBe('2026-10-10')
  })

  it('último dia do mês', () => {
    const dates = calculateDueDates({ type: 'LAST_DAY_OF_MONTH' }, '2026-10-28', 2, holidays)
    expect(dates.map((item) => item.dueDate)).toEqual(['2026-10-31', '2026-11-30'])
  })

  it('primeiro dia útil pula fim de semana e feriado', () => {
    const dates = calculateDueDates({ type: 'FIRST_BUSINESS_DAY' }, '2026-10-28', 1, holidays)
    expect(dates[0]?.dueDate).toBe('2026-11-03')
  })

  it('último dia útil', () => {
    const dates = calculateDueDates({ type: 'LAST_BUSINESS_DAY' }, '2026-10-28', 1, holidays)
    expect(dates[0]?.dueDate).toBe('2026-10-30')
  })

  it('respeita ano bissexto', () => {
    const dates = calculateDueDates({ type: 'LAST_DAY_OF_MONTH' }, '2028-02-01', 1, holidays)
    expect(dates[0]?.dueDate).toBe('2028-02-29')
  })

  it('rejeita dia fixo fora de 1..28', () => {
    expect(() => calculateDueDates({ type: 'FIXED_DAY', day: 31 }, '2026-10-28', 1)).toThrow()
  })
})

describe('monthlySchedule', () => {
  it('mantém o dia e ajusta meses curtos', () => {
    expect(monthlySchedule('2027-01-31', 3).map((item) => item.dueDate)).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
    ])
  })
})

describe('requiresIndividualCharges', () => {
  it('só o dia fixo usa parcelamento nativo', () => {
    expect(requiresIndividualCharges({ type: 'FIXED_DAY', day: 10 })).toBe(false)
    expect(requiresIndividualCharges({ type: 'LAST_BUSINESS_DAY' })).toBe(true)
  })
})
