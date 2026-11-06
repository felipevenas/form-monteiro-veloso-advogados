import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import type { ContractProcess } from '@/features/process-core'
import { processRepository } from '@/features/process-core'
import { formatBRL } from '@/shared/utils/money'
import { formatDateBr } from '@/shared/utils/dates'
import { Alert } from '@/shared/ui/Alert'
import { Button, LinkButton } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'

interface PaymentStepProps {
  token: string
  process: ContractProcess
  onUpdated: (process: ContractProcess) => void
  onContinue: () => void
  onBack: () => void
  canGoBack: boolean
  returnedFromCheckout: boolean
}

export function PaymentStep({
  token,
  process,
  onUpdated,
  onContinue,
  onBack,
  canGoBack,
  returnedFromCheckout,
}: PaymentStepProps) {
  const [redirecting, setRedirecting] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = process.product.paymentPlans.find(
    (item) => item.id === process.selectedPlanId,
  )
  const service = process.product.services.find((item) => item.id === plan?.serviceId)
  const paid = process.paymentStatus === 'PAGO'
  const checkoutUrl = process.payment?.checkoutUrl ?? null
  const canSimulate = Boolean(processRepository.simulate) && !paid

  async function handleCheckout() {
    setError(null)
    setRedirecting(true)

    try {
      const result = await processRepository.createCheckout(token)

      if (!result.checkoutUrl || result.checkoutUrl.startsWith('mock:')) {
        setError('Checkout de demonstração criado. Use o botão de simulação abaixo.')
        return
      }

      window.location.assign(result.checkoutUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o pagamento.')
    } finally {
      setRedirecting(false)
    }
  }

  async function handleSimulate() {
    if (!processRepository.simulate) return
    setSimulating(true)
    setError(null)
    try {
      onUpdated(await processRepository.simulate(token, 'pay'))
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className={cn(
          'flex items-start gap-3 border p-4',
          paid ? 'border-success/40 bg-success-soft/40' : 'border-border bg-paper-alt/40',
        )}
      >
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full',
            paid ? 'bg-success-soft text-success' : 'bg-blue-50 text-brand',
          )}
          aria-hidden="true"
        >
          {paid ? (
            <CheckCircle2 className="size-4" />
          ) : redirecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CreditCard className="size-4" />
          )}
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[0.9rem] font-bold text-ink" role="status" aria-live="polite">
            {paid
              ? 'Pagamento confirmado'
              : returnedFromCheckout
                ? 'Confirmando seu pagamento…'
                : 'Pagamento pendente'}
          </p>
          <p className="text-[0.8rem] leading-relaxed text-text-2">
            {paid
              ? 'A próxima etapa é o envio dos documentos.'
              : returnedFromCheckout
                ? 'O Asaas ainda está processando. Esta página atualiza sozinha em alguns segundos.'
                : 'Você será levado ao checkout seguro do Asaas. Após pagar, o botão de concluir traz você de volta ao formulário.'}
          </p>
        </div>
      </div>

      {plan ? (
        <section className="border border-border">
          <div className="border-b border-border bg-paper-alt/40 px-4 py-3">
            <p className="label-caps text-field">Resumo do pagamento</p>
          </div>
          <dl className="divide-y divide-border text-[0.84rem]">
            {service ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-text-2">Serviço</dt>
                <dd className="text-right font-semibold text-ink">{service.name}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-text-2">Plano</dt>
              <dd className="text-right font-semibold text-ink">{plan.label}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-text-2">Valor total</dt>
              <dd className="font-display text-xl text-ink">{formatBRL(plan.totalCents)}</dd>
            </div>
            {plan.signalCents > 0 ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-text-2">Sinal na assinatura</dt>
                <dd className="font-semibold text-ink">{formatBRL(plan.signalCents)}</dd>
              </div>
            ) : null}
            {plan.entryCents > 0 ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-text-2">Entrada</dt>
                <dd className="font-semibold text-ink">{formatBRL(plan.entryCents)}</dd>
              </div>
            ) : null}
            {process.financial?.installments.map((installment) => (
              <div
                key={installment.number}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <dt className="text-text-2">
                  Parcela {installment.number} · {formatDateBr(installment.dueDate)}
                </dt>
                <dd className="font-semibold text-ink">
                  {formatBRL(installment.amountCents)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {returnedFromCheckout && !paid ? (
        <Alert tone="info" title="Aguardando confirmação">
          <p>
            A confirmação vem direto do Asaas. Não feche esta página; ela é atualizada
            automaticamente.
          </p>
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {canSimulate ? (
        <div className="border border-dashed border-border-interactive p-3">
          <p className="text-[0.7rem] text-field">
            Modo de demonstração: simule o pagamento para testar a liberação dos documentos.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void handleSimulate()}
            loading={simulating}
          >
            Simular pagamento
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        {canGoBack ? (
          <Button variant="ghost" onClick={onBack} leftIcon={<ArrowLeft className="size-4" />}>
            Voltar
          </Button>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!paid && checkoutUrl && !checkoutUrl.startsWith('mock:') ? (
            <LinkButton
              href={checkoutUrl}
              variant="outline"
              leftIcon={<ExternalLink className="size-4" />}
            >
              Abrir checkout
            </LinkButton>
          ) : null}

          {paid ? (
            <Button onClick={onContinue} rightIcon={<ArrowRight className="size-4" />}>
              Prosseguir para documentos
            </Button>
          ) : (
            <Button
              onClick={() => void handleCheckout()}
              loading={redirecting}
              rightIcon={<ExternalLink className="size-4" />}
            >
              Ir para o checkout do Asaas
            </Button>
          )}
        </div>
      </div>

      <p className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-field">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        O pagamento é processado pelo Asaas. O formulário nunca vê nem armazena dados do cartão.
      </p>
    </div>
  )
}
