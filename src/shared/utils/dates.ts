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

/** Data de hoje no fuso de São Paulo, independente do fuso do runtime. */
export function todayInSaoPaulo(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Exibe uma data date-only sem risco de deslocamento de fuso. */
export function formatDateBr(value: IsoDate): string {
  const date = parseIsoDate(value)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatDateLongBr(value: IsoDate): string {
  const date = parseIsoDate(value)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatDateTimeBr(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatTimeBr(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

/** Data de um timestamp ISO no fuso de São Paulo. */
export function formatTimestampDateBr(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/** Soma meses preservando o dia quando possível e ajustando para o último dia do mês. */
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
