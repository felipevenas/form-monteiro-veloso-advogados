import { useState } from 'react'
import type { FormStep, PaymentPlan, ProductService } from '@/features/process-core'
import { ContractReview } from './ContractReview'
import { StepForm } from './StepForm'
import { PlanSelector } from './PlanSelector'
import { ServiceSelector } from './ServiceSelector'

interface ContractStepProps {
  step: FormStep
  draft: Record<string, unknown>
  services: ProductService[]
  plans: PaymentPlan[]
  serviceId: string
  planId: string
  onServiceChange: (serviceId: string) => void
  onPlanChange: (planId: string) => void
  onDraftChange: (values: Record<string, unknown>) => void
  onNext: (
    values: Record<string, unknown>,
    planId: string,
    consentAccepted: boolean,
  ) => void
  onBack: () => void
  canGoBack: boolean
  submitting: boolean
  error: string | null
}

export function ContractStep({
  step,
  draft,
  services,
  plans,
  serviceId,
  planId,
  onServiceChange,
  onPlanChange,
  onDraftChange,
  onNext,
  onBack,
  canGoBack,
  submitting,
  error,
}: ContractStepProps) {
  const [consent, setConsent] = useState(false)
  const selectedService = services.find((service) => service.id === serviceId)
  const selectedPlan = plans.find((plan) => plan.id === planId)
  const validPlan = Boolean(selectedPlan)

  return (
    <div className="flex flex-col gap-6">
      {/* Fora do <form>: o serviço define quais campos condicionais aparecem. */}
      <ServiceSelector services={services} value={serviceId} onChange={onServiceChange} />

      <StepForm
        key={`${step.id}-${selectedService?.objectType ?? 'NONE'}`}
        step={step}
        draft={draft}
        objectType={selectedService?.objectType}
        onNext={(values) =>
          onNext({ ...values, produto: selectedService?.code }, planId, consent)
        }
        onDraftChange={(values) =>
          onDraftChange({ ...values, produto: selectedService?.code })
        }
        onBack={onBack}
        canGoBack={canGoBack}
        submitting={submitting}
        error={error}
        submitLabel="Continuar para assinatura"
        submitDisabled={!consent || !validPlan || !selectedService}
        footer={
          <div className="flex flex-col gap-5 border-t border-border pt-6">
            <PlanSelector plans={plans} planId={planId} onChange={onPlanChange} />

            {selectedService?.kitCode ? (
              <ContractReview draft={draft} service={selectedService} plan={selectedPlan} />
            ) : null}

            <div className="border border-border bg-paper-alt/40 p-4">
              <label className="flex cursor-pointer items-start gap-3 text-[0.82rem] leading-relaxed text-text-2">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
                />
                <span>
                  Li e concordo com o contrato e autorizo o tratamento dos meus dados para a
                  prestação do serviço. Após a confirmação, o escritório preparará seu contrato e
                  enviará o link de assinatura pelo WhatsApp informado.
                </span>
              </label>

              <p className="mt-3 text-[0.72rem] leading-relaxed text-field">
                Você poderá revisar e assinar pelo celular antes de pagar. Nenhuma cobrança é feita
                nesta etapa.
              </p>
            </div>
          </div>
        }
      />
    </div>
  )
}
