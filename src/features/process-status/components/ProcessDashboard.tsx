import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileSignature,
  FileText,
  LockKeyhole,
  MessageCircle,
  PenLine,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import type { ContractProcess, NextActionKind } from '@/features/process'
import {
  areDocumentsUnlocked,
  deriveNextAction,
  deriveTracks,
  generalStatusLabel,
  mockProcessRepository,
  unlockConditionLabel,
} from '@/features/process'
import { isMockMode } from '@/shared/config/env'
import { brand } from '@/shared/config/brand'
import { formatBRL } from '@/shared/utils/money'
import { formatDateBr, formatDateTimeBr } from '@/shared/utils/dates'
import { cn } from '@/shared/lib/cn'
import { Alert } from '@/shared/ui/Alert'
import { Button, LinkButton } from '@/shared/ui/Button'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import type { Tone } from '@/shared/ui/StatusBadge'
import { DocumentUpload } from './DocumentUpload'

interface ProcessDashboardProps {
  token: string
  process: ContractProcess
  onUpdated: (process: ContractProcess) => void
}

const actionIcon: Record<NextActionKind, typeof FileText> = {
  FORM: FileText,
  SIGN: PenLine,
  PAY: CreditCard,
  UPLOAD: Upload,
  WAIT: Clock3,
  DONE: CheckCircle2,
  CONTACT: MessageCircle,
}

export function ProcessDashboard({ token, process, onUpdated }: ProcessDashboardProps) {
  const next = deriveNextAction(process)
  const tracks = deriveTracks(process)
  const unlocked = areDocumentsUnlocked(process)
  const [simulating, setSimulating] = useState<'sign' | 'pay' | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)

  const ActionIcon = actionIcon[next.kind]
  const plan = process.product.paymentPlans.find((item) => item.id === process.financial?.planId)
  const requiredDocuments = process.documents.filter((document) => document.required)
  const receivedDocuments = requiredDocuments.filter((document) =>
    ['ENVIADO', 'PROCESSANDO'].includes(document.status),
  )

  async function simulate(kind: 'sign' | 'pay') {
    if (!mockProcessRepository) return
    setSimulating(kind)
    setSimulationError(null)

    try {
      const updated = await mockProcessRepository.simulate(token, kind)
      onUpdated(updated)
    } catch (cause) {
      setSimulationError(cause instanceof Error ? cause.message : 'Falha na simulação.')
    } finally {
      setSimulating(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[2px] bg-ink p-6 text-white sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" aria-hidden="true" />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-[2px] border border-white/20 text-sky-300">
              <ActionIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="label-caps text-white/45">Próximo passo</p>
              <h2 className="mt-1 font-display text-[1.65rem] leading-tight text-white">
                {next.title}
              </h2>
              <p className="mt-1 max-w-[52ch] text-[0.88rem] leading-relaxed text-white/65">
                {next.description}
              </p>
            </div>
          </div>

          {next.kind === 'SIGN' ? (
            <a
              href="#assinatura"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[2px] bg-white px-5 text-sm font-bold text-ink transition hover:bg-blue-50"
            >
              {next.cta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          ) : next.kind === 'PAY' ? (
            <a
              href="#pagamento"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[2px] bg-white px-5 text-sm font-bold text-ink transition hover:bg-blue-50"
            >
              {next.cta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          ) : next.kind === 'UPLOAD' ? (
            <a
              href="#documentos"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[2px] bg-white px-5 text-sm font-bold text-ink transition hover:bg-blue-50"
            >
              {next.cta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          ) : next.kind === 'CONTACT' ? (
            <a
              href={brand.phone.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[2px] bg-white px-5 text-sm font-bold text-ink transition hover:bg-blue-50"
            >
              Falar com a equipe
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </section>

      {isMockMode ? (
        <div className="flex flex-col gap-3 rounded-[2px] border border-dashed border-[#e2c46b] bg-warning-soft p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-warning" aria-hidden="true" />
            <p className="text-[0.78rem] font-bold text-warning">
              Modo demonstração — simule os webhooks
            </p>
          </div>
          <p className="text-[0.76rem] leading-relaxed text-warning/90">
            Em produção, estes eventos chegam do ZapSign e do Asaas. Aqui eles são simulados para
            você percorrer o fluxo completo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={simulating === 'sign'}
              disabled={process.signatureStatus === 'ASSINADA_COMPLETA'}
              onClick={() => void simulate('sign')}
            >
              Simular assinatura
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={simulating === 'pay'}
              disabled={process.paymentStatus === 'PAGO'}
              onClick={() => void simulate('pay')}
            >
              Simular pagamento
            </Button>
          </div>
          {simulationError ? <p className="text-[0.78rem] text-danger">{simulationError}</p> : null}
        </div>
      ) : null}

      <section aria-label="Andamento do processo">
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {tracks.map((track) => (
            <div key={track.key} className="flex flex-col gap-2 bg-white p-4">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-field">
                {track.label}
              </p>
              <StatusBadge tone={track.tone}>{track.status}</StatusBadge>
              <p className="text-[0.74rem] leading-relaxed text-text-2">{track.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
        <div className="flex flex-col gap-8">
          <section id="assinatura" className="scroll-mt-28 border border-border bg-white">
            <SectionHeader
              title="Assinatura"
              description="Os documentos são gerados e assinados no ZapSign. O status abaixo é atualizado pelo webhook, não pelo navegador."
              status={process.signatureStatus === 'ASSINADA_COMPLETA' ? 'Completa' : 'Pendente'}
              tone={process.signatureStatus === 'ASSINADA_COMPLETA' ? 'success' : 'warning'}
            />

            <ul className="divide-y divide-border">
              {(process.signature?.documents ?? []).map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <FileSignature className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    <div>
                      <p className="text-[0.88rem] font-semibold text-ink">{document.name}</p>
                      <p className="text-[0.72rem] text-text-2">
                        {document.status === 'ASSINADA_COMPLETA'
                          ? document.signedAt
                            ? `Assinado em ${formatDateTimeBr(document.signedAt)}`
                            : 'Assinado'
                          : 'Aguardando assinatura'}
                      </p>
                    </div>
                  </div>

                  {document.status === 'ASSINADA_COMPLETA' ? (
                    <StatusBadge tone="success">Assinado</StatusBadge>
                  ) : document.signUrl?.startsWith('mock:') && isMockMode ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={simulating === 'sign'}
                      onClick={() => void simulate('sign')}
                    >
                      Simular assinatura
                    </Button>
                  ) : document.signUrl ? (
                    <LinkButton
                      href={document.signUrl}
                      size="sm"
                      variant="outline"
                      rel="noreferrer"
                    >
                      Abrir documento
                    </LinkButton>
                  ) : (
                    <StatusBadge tone="neutral">Gerando</StatusBadge>
                  )}
                </li>
              ))}

              {!process.signature?.documents.length ? (
                <li className="px-5 py-6 text-[0.84rem] text-text-2">
                  Os documentos ainda não foram gerados.
                </li>
              ) : null}
            </ul>
          </section>

          <section id="pagamento" className="scroll-mt-28 border border-border bg-white">
            <SectionHeader
              title="Pagamento"
              description="A confirmação vem do webhook do Asaas. A tela de retorno do checkout não é prova de pagamento."
              status={process.paymentStatus === 'PAGO' ? 'Pago' : 'Pendente'}
              tone={process.paymentStatus === 'PAGO' ? 'success' : 'warning'}
            />

            {process.payment?.charges.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[0.84rem]">
                  <thead className="bg-paper-alt text-[0.68rem] uppercase tracking-[0.08em] text-text-2">
                    <tr>
                      <th className="px-5 py-2.5 font-bold">Cobrança</th>
                      <th className="px-5 py-2.5 font-bold">Vencimento</th>
                      <th className="px-5 py-2.5 text-right font-bold">Valor</th>
                      <th className="px-5 py-2.5 text-right font-bold">Status</th>
                      <th className="px-5 py-2.5 text-right font-bold">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {process.payment.charges.map((charge) => (
                      <tr key={charge.id} className="border-t border-border">
                        <td className="px-5 py-3 font-semibold text-ink">{charge.label}</td>
                        <td className="px-5 py-3 text-text-2">{formatDateBr(charge.dueDate)}</td>
                        <td className="px-5 py-3 text-right text-text-2">
                          {formatBRL(charge.amountCents)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <StatusBadge tone={charge.status === 'PAGO' ? 'success' : 'warning'}>
                            {charge.status === 'PAGO' ? 'Pago' : 'Pendente'}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {charge.status === 'PAGO' ? (
                            <span className="text-[0.72rem] text-text-2">—</span>
                          ) : charge.invoiceUrl?.startsWith('mock:') && isMockMode ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={simulating === 'pay'}
                              onClick={() => void simulate('pay')}
                            >
                              Simular
                            </Button>
                          ) : charge.invoiceUrl ? (
                            <a
                              href={charge.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[0.76rem] font-bold text-brand underline underline-offset-4"
                            >
                              Abrir
                            </a>
                          ) : (
                            <span className="text-[0.72rem] text-text-2">Gerando</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-[0.84rem] text-text-2">
                As cobranças ainda não foram criadas.
              </p>
            )}
          </section>

          <section id="documentos" className="scroll-mt-28 border border-border bg-white">
            <SectionHeader
              title="Documentos"
              description="Os arquivos são enviados para armazenamento privado e organizados na pasta do seu processo no Google Drive."
              status={`${receivedDocuments.length}/${requiredDocuments.length}`}
              tone={process.documentsStatus === 'COMPLETA' ? 'success' : 'warning'}
            />

            <div className="p-5">
              <DocumentUpload
                token={token}
                process={process}
                onUpdated={onUpdated}
                locked={!unlocked}
                unlockMessage={unlockConditionLabel[process.product.unlockCondition]}
              />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-28">
          <section className="border border-border bg-paper-alt p-5">
            <p className="label-caps text-field">Resumo financeiro</p>
            {process.financial ? (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="font-display text-2xl text-ink">
                    {formatBRL(process.financial.totalCents)}
                  </p>
                  <StatusBadge tone={process.paymentStatus === 'PAGO' ? 'success' : 'warning'}>
                    {process.paymentStatus === 'PAGO' ? 'Pago' : 'Pendente'}
                  </StatusBadge>
                </div>
                <dl className="flex flex-col gap-2 text-[0.8rem]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-2">Plano</dt>
                    <dd className="text-right font-semibold text-ink">{plan?.label ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-2">Sinal</dt>
                    <dd className="font-semibold text-ink">
                      {formatBRL(process.financial.signalCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-2">Parcelas</dt>
                    <dd className="font-semibold text-ink">
                      {process.financial.installments.length}x
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-2">1º vencimento</dt>
                    <dd className="font-semibold text-ink">
                      {process.financial.installments[0]
                        ? formatDateBr(process.financial.installments[0].dueDate)
                        : '—'}
                    </dd>
                  </div>
                </dl>
                <p className="flex items-start gap-2 border-t border-border pt-3 text-[0.7rem] leading-relaxed text-text-2">
                  <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Valores congelados no processo. Alterações exigem correção autorizada.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[0.82rem] text-text-2">O plano ainda não foi calculado.</p>
            )}
          </section>

          <section className="border border-border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="label-caps text-field">Histórico</p>
              <StatusBadge tone="info">{generalStatusLabel(process.generalStatus)}</StatusBadge>
            </div>
            <ol className="mt-4 flex flex-col gap-0">
              {process.events
                .slice()
                .reverse()
                .slice(0, 8)
                .map((event, index) => (
                  <li key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'mt-1 size-2 rounded-full',
                          index === 0 ? 'bg-brand' : 'bg-border-interactive',
                        )}
                        aria-hidden="true"
                      />
                      {index < Math.min(process.events.length, 8) - 1 ? (
                        <span className="w-px flex-1 bg-border" aria-hidden="true" />
                      ) : null}
                    </div>
                    <div className="pb-4">
                      <p className="text-[0.8rem] font-semibold text-ink">{event.title}</p>
                      <p className="text-[0.72rem] leading-relaxed text-text-2">
                        {event.description}
                      </p>
                      <p className="mt-0.5 text-[0.66rem] text-field">
                        {formatDateTimeBr(event.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          </section>

          <Alert tone="info" title="Precisa de ajuda?">
            Fale com a equipe pelo WhatsApp. Tenha o protocolo {process.publicCode} em mãos.
            <div className="mt-3">
              <LinkButton
                href={brand.phone.whatsapp}
                size="sm"
                variant="outline"
                leftIcon={<MessageCircle className="size-4" aria-hidden="true" />}
              >
                Falar com a equipe
              </LinkButton>
            </div>
          </Alert>
        </aside>
      </div>
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  description: string
  status: string
  tone: Tone
}

function SectionHeader({ title, description, status, tone }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="font-display text-xl text-ink">{title}</h3>
        <p className="mt-1 max-w-[62ch] text-[0.78rem] leading-relaxed text-text-2">
          {description}
        </p>
      </div>
      <StatusBadge tone={tone}>{status}</StatusBadge>
    </div>
  )
}
