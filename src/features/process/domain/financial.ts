import { calculateDueDates } from '@/shared/domain/due-date'
import type { HolidayCalendar } from '@/shared/domain/dates'
import { distributeCents, sumCents } from '@/shared/domain/money'
import type {
  DueDateRule,
  FinancialSnapshot,
  PaymentMethod,
  PaymentPlan,
} from './types'

export type FinancialResult =
  | { ok: true; value: FinancialSnapshot }
  | { ok: false; error: string }

export interface BuildFinancialInput {
  planId: string
  method: PaymentMethod
  totalCents: number
  signalCents: number
  entryCents: number
  installmentCount: number
  dueDateRule: DueDateRule
}

/**
 * Monta o snapshot financeiro e valida a identidade:
 * total = sinal + entrada + soma das parcelas.
 */
export function buildFinancialSnapshot(
  input: BuildFinancialInput,
  referenceDate: string,
  holidays: HolidayCalendar = new Set(),
  now: Date = new Date(),
): FinancialResult {
  const {
    planId,
    method,
    totalCents,
    signalCents,
    entryCents,
    installmentCount,
    dueDateRule,
  } = input

  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    return { ok: false, error: 'O valor total deve ser maior que zero.' }
  }

  if (!Number.isInteger(signalCents) || signalCents < 0) {
    return { ok: false, error: 'O sinal não pode ser negativo.' }
  }

  if (!Number.isInteger(entryCents) || entryCents < 0) {
    return { ok: false, error: 'A entrada não pode ser negativa.' }
  }

  if (!Number.isInteger(installmentCount) || installmentCount < 1) {
    return { ok: false, error: 'Informe ao menos uma parcela.' }
  }

  if (dueDateRule.type === 'FIXED_DAY' && (dueDateRule.day < 1 || dueDateRule.day > 28)) {
    return { ok: false, error: 'O dia fixo deve estar entre 1 e 28.' }
  }

  const financedCents = totalCents - signalCents - entryCents
  if (financedCents <= 0) {
    return {
      ok: false,
      error: 'Sinal e entrada consomem o valor total. Ajuste o plano financeiro.',
    }
  }

  const schedule = calculateDueDates(dueDateRule, referenceDate, installmentCount, holidays)
  const amounts = distributeCents(financedCents, installmentCount)

  const installments = schedule.map((item, index) => ({
    number: item.number,
    dueDate: item.dueDate,
    amountCents: amounts[index] ?? 0,
  }))

  const checkedTotal = signalCents + entryCents + sumCents(amounts)
  if (checkedTotal !== totalCents) {
    return {
      ok: false,
      error: 'A soma de sinal, entrada e parcelas não fecha com o valor total.',
    }
  }

  return {
    ok: true,
    value: {
      planId,
      method,
      totalCents,
      signalCents,
      entryCents,
      installments,
      dueDateRule,
      computedAt: now.toISOString(),
    },
  }
}

/** Reprojeta um plano publicado para a data de hoje. */
export function buildSnapshotFromPlan(
  plan: PaymentPlan,
  referenceDate: string,
  holidays: HolidayCalendar = new Set(),
  now: Date = new Date(),
): FinancialResult {
  return buildFinancialSnapshot(
    {
      planId: plan.id,
      method: plan.method,
      totalCents: plan.totalCents,
      signalCents: plan.signalCents,
      entryCents: plan.entryCents,
      installmentCount: plan.installmentCount,
      dueDateRule: plan.dueDateRule,
    },
    referenceDate,
    holidays,
    now,
  )
}
