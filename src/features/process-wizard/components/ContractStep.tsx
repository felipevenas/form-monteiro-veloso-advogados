import { useState } from 'react'
import type { FormStep, PaymentPlan, ProductService } from '@/features/process'
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
  const validPlan = plans.some((plan) => plan.id === planId)
  const validService = services.some((service) => service.id === serviceId)

  return (
    <StepForm
      step={step}
      draft={draft}
      onNext={(values) => onNext(values, planId, consent)}
      onDraftChange={onDraftChange}
      onBack={onBack}
      canGoBack={canGoBack}
      submitting={submitting}
      error={error}
      submitLabel="Continuar para assinatura"
      submitDisabled={!consent || !validPlan || !validService}
      footer={
        <div className="flex flex-col gap-5 border-t border-border pt-6">
          <ServiceSelector
            services={services}
            value={serviceId}
            onChange={onServiceChange}
          />

          <PlanSelector plans={plans} planId={planId} onChange={onPlanChange} />

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
                prestação do serviço. O contrato será enviado automaticamente para o WhatsApp
                informado.
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
  )
}
