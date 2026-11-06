import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { ContractProcess, FormStep } from '@/features/process-core'
import { areDocumentsUnlocked, isProcessFrozen, processRepository } from '@/features/process-core'
import { formatTimeBr } from '@/shared/utils/dates'
import { mergeDeep } from '@/shared/lib/merge'
import { Alert } from '@/shared/ui/Alert'
import { useAutosave } from '../hooks/useAutosave'
import { ContractStep } from './ContractStep'
import { DocumentsStep } from './DocumentsStep'
import { PaymentStep } from './PaymentStep'
import { SignatureStep } from './SignatureStep'
import { StepForm } from './StepForm'
import { WizardFlow } from './WizardFlow'

interface ProcessWizardProps {
  token: string
  process: ContractProcess
  onUpdated: (process: ContractProcess) => void
  returnedFromCheckout: boolean
}

const CONSENT_VERSION = '2026-01'

export function ProcessWizard({
  token,
  process,
  onUpdated,
  returnedFromCheckout,
}: ProcessWizardProps) {
  const steps = process.product.formSchema
  const plans = process.product.paymentPlans
  const services = process.product.services
  const initialPlan =
    plans.find((plan) => plan.id === process.selectedPlanId) ?? plans[0]
  const [stepIndex, setStepIndex] = useState(() => resolveStepIndex(process, steps))
  const [draft, setDraft] = useState<Record<string, unknown>>(
    process.client as Record<string, unknown>,
  )
  const [serviceId, setServiceId] = useState(
    process.selectedServiceId ?? initialPlan?.serviceId ?? services[0]?.id ?? '',
  )
  const [planId, setPlanId] = useState(initialPlan?.id ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [signatureError, setSignatureError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)

  const step = steps[stepIndex]
  const frozen = isProcessFrozen(process)
  const editable = !frozen && (step?.id === 'dados' || step?.id === 'contrato')

  const plansForService = plans.filter((plan) => plan.serviceId === serviceId)
  const activePlanId = plansForService.some((plan) => plan.id === planId)
    ? planId
    : (plansForService[0]?.id ?? '')

  const autosave = useAutosave({
    token,
    stepId: editable ? (step?.id ?? 'dados') : 'dados',
  })
  const {
    schedule: scheduleAutosave,
    flush: flushAutosave,
    cancel: cancelAutosave,
    status: autosaveStatus,
    savedAt,
  } = autosave

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }

    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    stepHeadingRef.current?.focus({ preventScroll: true })
  }, [stepIndex])

  const handleDraftChange = useCallback(
    (values: Record<string, unknown>) => {
      setDraft((current) => mergeDeep(current, values))
      scheduleAutosave(values)
    },
    [scheduleAutosave],
  )

  const goBack = useCallback(() => {
    void flushAutosave()
    setStepIndex((index) => Math.max(0, index - 1))
  }, [flushAutosave])

  const saveStep = useMutation({
    mutationFn: ({ step: current, values }: { step: FormStep; values: Record<string, unknown> }) =>
      processRepository.saveStep(token, current.id, values),
  })

  const savePlan = useMutation({
    mutationFn: (nextPlanId: string) => processRepository.savePlan(token, nextPlanId),
  })

  const startSignature = useMutation({
    mutationFn: ({ nextPlanId, accepted }: { nextPlanId: string; accepted: boolean }) =>
      processRepository.startSignature(token, {
        planId: nextPlanId,
        consentVersion: CONSENT_VERSION,
        consentAccepted: accepted,
      }),
  })

  if (!step) {
    return <Alert tone="danger">O formulário deste produto não está configurado.</Alert>
  }

  const isSaving = saveStep.isPending || savePlan.isPending || startSignature.isPending

  async function handleDataNext(values: Record<string, unknown>) {
    if (!step) return
    setSaveError(null)
    cancelAutosave()

    try {
      const merged = mergeDeep(draft, values)
      const updated = await saveStep.mutateAsync({ step, values })
      setDraft(merged)
      onUpdated(updated)
      setStepIndex((index) => Math.min(index + 1, steps.length - 1))
    } catch (cause) {
      setSaveError(errorMessage(cause))
    }
  }

  async function handleContractNext(
    values: Record<string, unknown>,
    nextPlanId: string,
    consentAccepted: boolean,
  ) {
    if (!step) return
    setSaveError(null)
    setSignatureError(null)
    cancelAutosave()

    try {
      const merged = mergeDeep(draft, values)
      await saveStep.mutateAsync({ step, values })
      await savePlan.mutateAsync(nextPlanId)
      const updated = await startSignature.mutateAsync({
        nextPlanId,
        accepted: consentAccepted,
      })
      const plan = plans.find((item) => item.id === nextPlanId)
      setDraft(merged)
      setPlanId(nextPlanId)
      if (plan?.serviceId) setServiceId(plan.serviceId)
      onUpdated(updated)
      setStepIndex(indexOfStep(steps, 'assinatura'))
    } catch (cause) {
      setSaveError(errorMessage(cause))
    }
  }

  function handleServiceChange(nextServiceId: string) {
    setServiceId(nextServiceId)
    const firstPlan = plans.find((plan) => plan.serviceId === nextServiceId)
    if (firstPlan) setPlanId(firstPlan.id)
  }

  async function handleRetrySignature() {
    setSignatureError(null)

    try {
      const updated = await startSignature.mutateAsync({
        nextPlanId: activePlanId,
        accepted: true,
      })
      onUpdated(updated)
    } catch (cause) {
      setSignatureError(errorMessage(cause))
    }
  }

  function handleSignatureContinue() {
    setSignatureError(null)
    setStepIndex(indexOfStep(steps, 'pagamento'))
  }

  const autosaveMessage =
    autosaveStatus === 'saving'
      ? 'Salvando…'
      : autosaveStatus === 'expired'
        ? 'Sessão expirada. Recarregue a página para continuar.'
        : autosaveStatus === 'error'
          ? 'Não foi possível salvar. Tentaremos na próxima alteração.'
          : savedAt
            ? `Salvo às ${formatTimeBr(savedAt)}`
            : 'Suas respostas são salvas automaticamente.'

  return (
    <div id="wizard" ref={containerRef} className="scroll-mt-24">
      <div className="mx-auto w-full max-w-[760px]">
        <WizardFlow
          steps={steps}
          currentIndex={stepIndex}
          completedSteps={process.completedSteps}
          lockedSteps={frozen ? ['dados', 'contrato'] : []}
          onSelect={(index) => {
            const target = steps[index]
            if (frozen && (target?.id === 'dados' || target?.id === 'contrato')) return

            void flushAutosave()
            setStepIndex(index)
            setSaveError(null)
            setSignatureError(null)
          }}
        />

        <section className="mt-5 border border-border bg-paper">
          <div className="border-b border-border p-6 sm:p-8">
            <h1
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-[1.75rem] leading-tight text-ink outline-none sm:text-[2rem]"
            >
              {step.title}
            </h1>
            <p className="mt-2 max-w-[58ch] text-[0.9rem] leading-relaxed text-text-2">
              {step.description}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {step.id === 'dados' ? (
              <StepForm
                key={step.id}
                step={step}
                draft={draft}
                onNext={handleDataNext}
                onDraftChange={handleDraftChange}
                onBack={goBack}
                canGoBack={false}
                submitting={isSaving}
                error={saveError}
              />
            ) : step.id === 'contrato' ? (
              <ContractStep
                step={step}
                draft={draft}
                services={services}
                plans={plansForService}
                serviceId={serviceId}
                planId={activePlanId}
                onServiceChange={handleServiceChange}
                onPlanChange={setPlanId}
                onDraftChange={handleDraftChange}
                onNext={handleContractNext}
                onBack={goBack}
                canGoBack
                submitting={isSaving}
                error={saveError}
              />
            ) : step.id === 'assinatura' ? (
              <SignatureStep
                token={token}
                process={process}
                onUpdated={onUpdated}
                onContinue={handleSignatureContinue}
                onBack={goBack}
                canGoBack={false}
                onRetry={() => void handleRetrySignature()}
                retrying={startSignature.isPending}
                error={signatureError}
              />
            ) : step.id === 'pagamento' ? (
              <PaymentStep
                token={token}
                process={process}
                onUpdated={onUpdated}
                onContinue={() => setStepIndex(indexOfStep(steps, 'documentos'))}
                onBack={goBack}
                canGoBack={false}
                returnedFromCheckout={returnedFromCheckout}
              />
            ) : (
              <DocumentsStep
                token={token}
                process={process}
                onUpdated={onUpdated}
                onBack={goBack}
                canGoBack={false}
              />
            )}
          </div>
        </section>

        {editable ? (
          <p
            className="mt-4 text-center text-[0.7rem] leading-relaxed text-field"
            role="status"
            aria-live="polite"
          >
            {autosaveMessage}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function resolveStepIndex(process: ContractProcess, steps: FormStep[]): number {
  if (process.completedSteps.includes('dados') && !process.selectedPlanId) {
    return indexOfStep(steps, 'contrato')
  }

  if (areDocumentsUnlocked(process) || process.documentsStatus === 'COMPLETA') {
    return indexOfStep(steps, 'documentos')
  }

  if (process.signatureStatus === 'ASSINADA_COMPLETA') {
    return indexOfStep(steps, 'pagamento')
  }

  if (
    process.currentStep === 'assinatura' ||
    process.currentStep === 'pagamento' ||
    process.currentStep === 'documentos' ||
    (process.signature?.documents.length ?? 0) > 0
  ) {
    return indexOfStep(steps, 'assinatura')
  }

  return Math.max(0, steps.findIndex((step) => step.id === process.currentStep))
}

function indexOfStep(steps: FormStep[], id: FormStep['id']): number {
  const index = steps.findIndex((step) => step.id === id)
  return index >= 0 ? index : 0
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return 'Não foi possível salvar agora. Tente novamente.'
}
