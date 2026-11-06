import { Check } from 'lucide-react'
import type { FormStep } from '@/features/process-core'
import { cn } from '@/shared/lib/cn'

interface WizardFlowProps {
  steps: FormStep[]
  currentIndex: number
  completedSteps: readonly string[]
  onSelect: (index: number) => void
}

export function WizardFlow({
  steps,
  currentIndex,
  completedSteps,
  onSelect,
}: WizardFlowProps) {
  return (
    <>
      <nav aria-label="Progresso do formulário" className="sm:hidden">
        <div aria-hidden="true" className="flex items-center">
          {steps.map((step, index) => {
            const completed = index < currentIndex || completedSteps.includes(step.id)
            const active = index === currentIndex

            return (
              <div key={step.id} className="flex flex-1 items-center last:flex-none">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full transition',
                    completed
                      ? 'bg-brand'
                      : active
                        ? 'bg-blue-500 ring-2 ring-blue-200'
                        : 'bg-border-interactive/60',
                  )}
                />
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      'mx-1.5 h-px flex-1',
                      index < currentIndex ? 'bg-brand' : 'bg-border',
                    )}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[0.66rem] text-field">
          Etapa {currentIndex + 1} de {steps.length}
        </p>
      </nav>

      <nav aria-label="Etapas da contratação" className="hidden sm:block">
        <ol className="flex items-start">
          {steps.map((step, index) => {
            const completed = index < currentIndex || completedSteps.includes(step.id)
            const active = index === currentIndex
            const reachable = completed || active
            const status = active ? 'Em andamento' : completed ? 'Concluída' : 'Aguardando'

            return (
              <li key={step.id} className="flex flex-1 items-start last:flex-none">
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  disabled={!reachable}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'group relative flex w-full flex-col items-center gap-2 px-1 text-center',
                    reachable ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full border text-[0.7rem] font-bold transition',
                      completed
                        ? 'border-brand bg-brand text-white'
                        : active
                          ? 'border-brand bg-paper text-brand ring-4 ring-blue-50'
                          : 'border-border-interactive bg-paper text-field',
                    )}
                  >
                    {completed ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-[0.66rem] leading-tight',
                      active
                        ? 'font-bold text-ink'
                        : completed
                          ? 'font-semibold text-text-2'
                          : 'text-field',
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="sr-only"> — {status}</span>
                </button>

                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-4 h-px min-w-3 flex-1',
                      index < currentIndex ? 'bg-brand' : 'bg-border',
                    )}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
