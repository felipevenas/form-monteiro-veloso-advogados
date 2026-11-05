/** Agenda de vencimentos (cópia de src/shared/domain/due-date.ts). */

import {
  addMonthsClamped,
  firstBusinessDayOfMonth,
  lastBusinessDayOfMonth,
  lastDayOfMonth,
  parseIsoDate,
  toIsoDate,
  type HolidayCalendar,
  type IsoDate,
} from './dates.ts'

export type DueDateRule =
  | { type: 'LAST_DAY_OF_MONTH' }
  | { type: 'FIRST_BUSINESS_DAY' }
  | { type: 'LAST_BUSINESS_DAY' }
  | { type: 'FIXED_DAY'; day: number }

export interface InstallmentScheduleItem {
  number: number
  dueDate: IsoDate
}

/**
 * Calcula a agenda de vencimentos a partir de uma data de referência.
 * Se o vencimento do mês corrente já passou, a primeira parcela cai no mês seguinte.
 */
export function calculateDueDates(
  rule: DueDateRule,
  referenceDate: IsoDate,
  count: number,
  holidays: HolidayCalendar = new Set(),
): InstallmentScheduleItem[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('A quantidade de parcelas deve ser um inteiro maior que zero.')
  }

  if (rule.type === 'FIXED_DAY' && (rule.day < 1 || rule.day > 28)) {
    throw new Error('O dia fixo deve estar entre 1 e 28.')
  }

  const reference = parseIsoDate(referenceDate)
  const referenceYear = reference.getUTCFullYear()
  const referenceMonth = reference.getUTCMonth()

  const dueDateForMonth = (year: number, monthIndex: number): IsoDate => {
    switch (rule.type) {
      case 'LAST_DAY_OF_MONTH':
        return toIsoDate(new Date(Date.UTC(year, monthIndex, lastDayOfMonth(year, monthIndex))))
      case 'FIRST_BUSINESS_DAY':
        return firstBusinessDayOfMonth(year, monthIndex, holidays)
      case 'LAST_BUSINESS_DAY':
        return lastBusinessDayOfMonth(year, monthIndex, holidays)
      case 'FIXED_DAY':
        return toIsoDate(new Date(Date.UTC(year, monthIndex, rule.day)))
    }
  }

  const firstCandidate = dueDateForMonth(referenceYear, referenceMonth)
  const firstMonthOffset = firstCandidate < referenceDate ? 1 : 0

  return Array.from({ length: count }, (_, index) => {
    const offset = firstMonthOffset + index
    const year = referenceYear + Math.floor((referenceMonth + offset) / 12)
    const monthIndex = (referenceMonth + offset) % 12
    return {
      number: index + 1,
      dueDate: dueDateForMonth(year, monthIndex),
    }
  })
}

export function requiresIndividualCharges(rule: DueDateRule): boolean {
  return rule.type !== 'FIXED_DAY'
}

export function monthlySchedule(firstDueDate: IsoDate, count: number): InstallmentScheduleItem[] {
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    dueDate: addMonthsClamped(firstDueDate, index),
  }))
}
