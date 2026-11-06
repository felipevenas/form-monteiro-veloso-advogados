import { useMemo } from 'react'
import { CalendarDays, Check } from 'lucide-react'
import type { PaymentPlan } from '@/features/process-core'
import { buildSnapshotFromPlan } from '@/features/process-core'
import { formatBRL } from '@/shared/utils/money'
import { formatDateBr, todayInSaoPaulo } from '@/shared/utils/dates'
import { cn } from '@/shared/lib/cn'

interface PlanSelectorProps {
  plans: PaymentPlan[]
  planId: string
  onChange: (planId: string) => void
}

export function PlanSelector({ plans, planId, onChange }: PlanSelectorProps) {
  const referenceDate = todayInSaoPaulo()
  const snapshots = useMemo(
    () =>
      plans.map((plan) => ({
        plan,
        result: buildSnapshotFromPlan(plan, referenceDate),
      })),
    [plans, referenceDate],
  )

  const selected = snapshots.find((item) => item.plan.id === planId)

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="label-caps mb-2 text-field">Forma de pagamento</legend>

        {snapshots.map(({ plan, result }) => {
          const active = plan.id === planId
          return (
            <label
              key={plan.id}
              className={cn(
                'flex cursor-pointer flex-col gap-3 rounded-[2px] border p-4 transition sm:flex-row sm:items-center sm:justify-between',
                active
                  ? 'border-brand bg-blue-50'
                  : 'border-border-interactive bg-paper hover:border-brand/60',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                    active ? 'border-brand bg-brand text-white' : 'border-border-interactive',
                  )}
                  aria-hidden="true"
                >
                  {active ? <Check className="size-3" /> : null}
                </span>
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  checked={active}
                  onChange={() => onChange(plan.id)}
                  className="sr-only"
                />
                <div>
                  <p className="text-[0.92rem] font-bold text-ink">{plan.label}</p>
                  <p className="text-[0.8rem] leading-relaxed text-text-2">{plan.description}</p>
                  {!result.ok ? (
                    <p className="mt-1 text-[0.78rem] font-semibold text-danger">{result.error}</p>
                  ) : null}
                </div>
              </div>

              <div className="pl-8 text-left sm:pl-0 sm:text-right">
                <p className="font-display text-xl text-ink">{formatBRL(plan.totalCents)}</p>
                <p className="text-[0.72rem] text-text-2">
                  {plan.signalCents > 0 ? `Sinal de ${formatBRL(plan.signalCents)}` : 'Sem sinal'}
                  {plan.entryCents > 0 ? ` · Entrada de ${formatBRL(plan.entryCents)}` : ''}
                  {plan.installmentCount > 1
                    ? ` · ${plan.installmentCount} parcelas`
                    : ' · à vista'}
                </p>
              </div>
            </label>
          )
        })}
      </fieldset>

      {selected?.result.ok ? (
        <section className="border border-border bg-paper-alt/40 p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-brand" aria-hidden="true" />
            <p className="label-caps text-field">Agenda prevista</p>
          </div>

          <ul className="mt-2 divide-y divide-border text-[0.8rem]">
            {selected.result.value.signalCents > 0 ? (
              <li className="flex items-center justify-between py-2">
                <span className="text-text-2">Sinal na assinatura</span>
                <span className="font-semibold text-ink">
                  {formatBRL(selected.result.value.signalCents)}
                </span>
              </li>
            ) : null}
            {selected.result.value.entryCents > 0 ? (
              <li className="flex items-center justify-between py-2">
                <span className="text-text-2">Entrada</span>
                <span className="font-semibold text-ink">
                  {formatBRL(selected.result.value.entryCents)}
                </span>
              </li>
            ) : null}
            {selected.result.value.installments.map((installment) => (
              <li key={installment.number} className="flex items-center justify-between py-2">
                <span className="text-text-2">
                  Parcela {installment.number} · {formatDateBr(installment.dueDate)}
                </span>
                <span className="font-semibold text-ink">
                  {formatBRL(installment.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
