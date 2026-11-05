/** Datas date-only e calendário de dias úteis (cópia de src/shared/domain/dates.ts). */

export type IsoDate = string

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function parseIsoDate(value: IsoDate): Date {
  if (!isValidIsoDate(value)) {
    throw new Error(`Data inválida: ${value}`)
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day))
}

export function toIsoDate(date: Date): IsoDate {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Data de hoje no fuso de São Paulo (UTC-3, sem horário de verão desde 2019). */
export function todayInSaoPaulo(now: Date = new Date()): IsoDate {
  const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function addMonthsClamped(value: IsoDate, months: number): IsoDate {
  const date = parseIsoDate(value)
  const targetYear = date.getUTCFullYear()
  const targetMonth = date.getUTCMonth() + months
  const day = Math.min(date.getUTCDate(), lastDayOfMonth(targetYear, targetMonth))
  return toIsoDate(new Date(Date.UTC(targetYear, targetMonth, day)))
}

export function dayOfWeek(value: IsoDate): number {
  return parseIsoDate(value).getUTCDay()
}

export function isWeekend(value: IsoDate): boolean {
  const day = dayOfWeek(value)
  return day === 0 || day === 6
}

export type HolidayCalendar = ReadonlySet<IsoDate>

export function isBusinessDay(value: IsoDate, holidays: HolidayCalendar = new Set()): boolean {
  return !isWeekend(value) && !holidays.has(value)
}

export function nextBusinessDay(value: IsoDate, holidays: HolidayCalendar = new Set()): IsoDate {
  let current = value
  while (!isBusinessDay(current, holidays)) {
    current = addDays(current, 1)
  }
  return current
}

export function previousBusinessDay(value: IsoDate, holidays: HolidayCalendar = new Set()): IsoDate {
  let current = value
  while (!isBusinessDay(current, holidays)) {
    current = addDays(current, -1)
  }
  return current
}

export function firstBusinessDayOfMonth(
  year: number,
  monthIndex: number,
  holidays: HolidayCalendar = new Set(),
): IsoDate {
  return nextBusinessDay(toIsoDate(new Date(Date.UTC(year, monthIndex, 1))), holidays)
}

export function lastBusinessDayOfMonth(
  year: number,
  monthIndex: number,
  holidays: HolidayCalendar = new Set(),
): IsoDate {
  const last = lastDayOfMonth(year, monthIndex)
  return previousBusinessDay(toIsoDate(new Date(Date.UTC(year, monthIndex, last))), holidays)
}
