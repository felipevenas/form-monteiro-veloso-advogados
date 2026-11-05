import { useState } from 'react'
import {
  CheckCircle2,
  Copy,
  CreditCard,
  FileSignature,
  Mail,
  MessageCircle,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import type { ContractProcess } from '@/features/process'
import { brand } from '@/shared/config/brand'
import { env, isMockMode } from '@/shared/config/env'
import { formatBRL } from '@/shared/utils/money'
import { formatDateBr } from '@/shared/utils/dates'
import { Alert } from '@/shared/ui/Alert'
import { Button, LinkButton } from '@/shared/ui/Button'

interface ProcessConfirmationProps {
  process: ContractProcess
}

const steps = [
  {
    icon: ShieldCheck,
    title: 'Equipe assume o caso',
    description: 'A equipe confere os documentos e dá início à estratégia jurídica.',
  },
  {
    icon: FileSignature,
    title: 'Contrato assinado',
    description: 'O contrato e os documentos complementares já estão com você e com a equipe.',
  },
  {
    icon: CreditCard,
    title: 'Pagamento confirmado',
    description: 'O Asaas confirmou o pagamento conforme o plano escolhido.',
  },
  {
    icon: Upload,
    title: 'Documentos recebidos',
    description: 'Os anexos obrigatórios foram enviados e estão disponíveis para a equipe.',
  },
]

export function ProcessConfirmation({ process }: ProcessConfirmationProps) {
  const [copied, setCopied] = useState(false)
  const plan = process.product.paymentPlans.find(
    (item) => item.id === process.selectedPlanId,
  )
  const service = process.product.services.find((item) => item.id === plan?.serviceId)
  const firstName = process.client.fullName?.trim().split(/\s+/)[0]

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="label-caps text-blue-600">Processo {process.publicCode}</p>
          <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold text-success">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Concluído
          </span>
        </div>

        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[2rem] leading-tight text-ink sm:text-[2.4rem]">
              Processo concluído{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="mt-2 max-w-[58ch] text-[0.92rem] leading-relaxed text-text-2">
              Recebemos seus dados, a assinatura, o pagamento e os documentos. A equipe dará
              sequência ao caso e entrará em contato pelo WhatsApp.
            </p>
            {env.emailConfirmation && !isMockMode ? (
              <p className="mt-3 inline-flex items-start gap-2 text-[0.8rem] leading-relaxed text-text-2">
                <Mail className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                Enviamos uma confirmação para o e-mail informado no cadastro.
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="border border-border bg-paper p-6">
        <p className="label-caps text-field">Resumo do processo</p>
        <dl className="mt-4 grid gap-4 text-[0.86rem] sm:grid-cols-2">
          <div>
            <dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-field">
              Serviço
            </dt>
            <dd className="mt-1 font-semibold text-ink">{service?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-field">
              Plano
            </dt>
            <dd className="mt-1 font-semibold text-ink">{plan?.label ?? '—'}</dd>
          </div>
          {process.financial ? (
            <>
              <div>
                <dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-field">
                  Valor total
                </dt>
                <dd className="mt-1 font-semibold text-ink">
                  {formatBRL(process.financial.totalCents)}
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-field">
                  Primeiro vencimento
                </dt>
                <dd className="mt-1 font-semibold text-ink">
                  {process.financial.installments[0]
                    ? formatDateBr(process.financial.installments[0].dueDate)
                    : '—'}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      <section>
        <h2 className="text-[1.45rem] text-ink">O que já foi concluído</h2>
        <ol className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-2">
          {steps.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.title} className="flex gap-3 bg-paper p-5">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                  <p className="text-[0.88rem] font-bold text-ink">{item.title}</p>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-text-2">
                    {item.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <Alert tone="info" title="Guarde este link">
        <p>
          Você pode voltar a esta página para consultar o processo. O link é pessoal e não deve ser
          compartilhado.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void copyLink()}
            leftIcon={<Copy className="size-3.5" aria-hidden="true" />}
          >
            {copied ? 'Link copiado' : 'Copiar link do processo'}
          </Button>
          <LinkButton
            href={brand.phone.whatsapp}
            size="sm"
            variant="ghost"
            leftIcon={<MessageCircle className="size-3.5" aria-hidden="true" />}
          >
            Falar com a equipe
          </LinkButton>
        </div>
      </Alert>

      <p className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-text-2">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Seus dados são usados para a contratação e o atendimento jurídico. A equipe nunca pede
        senha ou código por WhatsApp.
      </p>
    </section>
  )
}
