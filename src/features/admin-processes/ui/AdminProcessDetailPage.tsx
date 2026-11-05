import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  LockKeyhole,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react'
import { adminRepository } from '@/features/admin-processes'
import {
  deriveTracks,
  documentsStatusMeta,
  generalStatusMeta,
  paymentStatusMeta,
  signatureStatusMeta,
} from '@/features/process'
import { findMockProcessToken } from '@/features/process'
import { isMockMode } from '@/shared/config/env'
import { routes } from '@/shared/config/routes'
import { maskCpf } from '@/shared/domain/cpf'
import { formatPhone } from '@/shared/domain/phone'
import { formatBRL } from '@/shared/domain/money'
import { formatDateBr, formatDateTimeBr } from '@/shared/domain/dates'
import { Alert } from '@/shared/ui/Alert'
import { LinkButton } from '@/shared/ui/Button'
import { LoadingBlock } from '@/shared/ui/Spinner'
import { StatusBadge } from '@/shared/ui/StatusBadge'

export function AdminProcessDetailPage() {
  const { id } = useParams<{ id: string }>()

  const query = useQuery({
    queryKey: ['admin-process', id],
    queryFn: () => adminRepository.get(id ?? ''),
    enabled: Boolean(id),
  })

  if (query.isLoading) {
    return <LoadingBlock label="Carregando processo…" />
  }

  if (query.isError || !query.data) {
    return (
      <Alert tone="warning" title="Processo não encontrado">
        O processo pode ter sido removido ou o identificador está incorreto.
        <div className="mt-3">
          <LinkButton to={routes.admin.processes} variant="outline" size="sm">
            Voltar para a lista
          </LinkButton>
        </div>
      </Alert>
    )
  }

  const process = query.data
  const tracks = deriveTracks(process)
  const clientToken = isMockMode ? findMockProcessToken(process.id) : null

  return (
    <div className="flex flex-col gap-8">
      <Link
        to={routes.admin.processes}
        className="inline-flex items-center gap-2 text-[0.78rem] font-semibold text-text-2 transition hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Processos
      </Link>

      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-[0.74rem] text-text-2">{process.publicCode}</p>
            <StatusBadge tone={generalStatusMeta[process.generalStatus].tone}>
              {generalStatusMeta[process.generalStatus].label}
            </StatusBadge>
          </div>
          <h1 className="mt-2 text-[2.1rem] leading-tight text-ink">
            {process.client.fullName ?? 'Cliente sem nome'}
          </h1>
          <p className="mt-1 text-[0.84rem] text-text-2">
            {process.product.name} · iniciado em {formatDateTimeBr(process.createdAt)}
          </p>
        </div>

        {clientToken ? (
          <LinkButton
            to={routes.process(clientToken)}
            variant="outline"
            size="sm"
            rightIcon={<ExternalLink className="size-3.5" aria-hidden="true" />}
          >
            Ver como o cliente
          </LinkButton>
        ) : null}
      </header>

      <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
        {tracks.map((track) => (
          <div key={track.key} className="bg-white p-4">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-field">
              {track.label}
            </p>
            <div className="mt-2">
              <StatusBadge tone={track.tone}>{track.status}</StatusBadge>
            </div>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-text-2">{track.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <Section title="Dados do cliente" icon={UserRound}>
            <dl className="grid gap-4 text-[0.84rem] sm:grid-cols-2">
              <Info label="Nome" value={process.client.fullName} />
              <Info
                label="CPF"
                value={process.client.cpf ? maskCpf(process.client.cpf) : undefined}
              />
              <Info label="E-mail" value={process.client.email} />
              <Info
                label="WhatsApp"
                value={process.client.phone ? formatPhone(process.client.phone) : undefined}
              />
              <Info
                label="Endereço"
                value={
                  process.client.address?.street
                    ? `${process.client.address.street}, ${process.client.address.number ?? 's/n'}${
                        process.client.address.complement
                          ? ` — ${process.client.address.complement}`
                          : ''
                      }, ${process.client.address.neighborhood ?? ''}, ${process.client.address.city ?? ''}–${process.client.address.state ?? ''}`
                    : undefined
                }
              />
              <Info label="CEP" value={process.client.address?.cep} />
            </dl>
            <p className="mt-4 flex items-center gap-1.5 text-[0.7rem] text-text-2">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              CPF completo visível apenas para papéis autorizados. Esta listagem mascara o dado.
            </p>
          </Section>

          <Section title="Contrato e financeiro" icon={FileText}>
            {process.financial ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-field">
                      Plano
                    </p>
                    <p className="text-[0.9rem] font-semibold text-ink">
                      {process.product.paymentPlans.find(
                        (plan) => plan.id === process.financial?.planId,
                      )?.label ?? process.financial.planId}
                    </p>
                  </div>
                  <p className="font-display text-2xl text-ink">
                    {formatBRL(process.financial.totalCents)}
                  </p>
                </div>

                <div className="overflow-x-auto border border-border">
                  <table className="w-full min-w-[480px] text-left text-[0.8rem]">
                    <thead className="bg-paper-alt text-[0.64rem] uppercase tracking-[0.08em] text-text-2">
                      <tr>
                        <th className="px-3 py-2 font-bold">Parcela</th>
                        <th className="px-3 py-2 font-bold">Vencimento</th>
                        <th className="px-3 py-2 text-right font-bold">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {process.financial.signalCents > 0 ? (
                        <tr className="border-t border-border">
                          <td className="px-3 py-2 text-text-2">Sinal</td>
                          <td className="px-3 py-2 text-text-2">Na assinatura</td>
                          <td className="px-3 py-2 text-right font-semibold text-ink">
                            {formatBRL(process.financial.signalCents)}
                          </td>
                        </tr>
                      ) : null}
                      {process.financial.installments.map((installment) => (
                        <tr key={installment.number} className="border-t border-border">
                          <td className="px-3 py-2 text-text-2">
                            {installment.number}ª parcela
                          </td>
                          <td className="px-3 py-2 text-text-2">
                            {formatDateBr(installment.dueDate)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-ink">
                            {formatBRL(installment.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-[0.84rem] text-text-2">O plano financeiro ainda não foi gerado.</p>
            )}
          </Section>

          <Section title="Assinaturas" icon={CheckCircle2}>
            <div className="mb-3">
              <StatusBadge tone={signatureStatusMeta[process.signatureStatus].tone}>
                {signatureStatusMeta[process.signatureStatus].label}
              </StatusBadge>
            </div>
            <ul className="divide-y divide-border border border-border">
              {(process.signature?.documents ?? []).map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-[0.84rem] text-ink">{document.name}</span>
                  <StatusBadge
                    tone={document.status === 'ASSINADA_COMPLETA' ? 'success' : 'warning'}
                  >
                    {document.status === 'ASSINADA_COMPLETA' ? 'Assinado' : 'Pendente'}
                  </StatusBadge>
                </li>
              ))}
              {!process.signature?.documents.length ? (
                <li className="px-4 py-4 text-[0.82rem] text-text-2">Nenhum documento gerado.</li>
              ) : null}
            </ul>
          </Section>

          <Section title="Pagamentos" icon={CalendarDays}>
            <div className="mb-3">
              <StatusBadge tone={paymentStatusMeta[process.paymentStatus].tone}>
                {paymentStatusMeta[process.paymentStatus].label}
              </StatusBadge>
            </div>
            <div className="overflow-x-auto border border-border">
              <table className="w-full min-w-[520px] text-left text-[0.8rem]">
                <thead className="bg-paper-alt text-[0.64rem] uppercase tracking-[0.08em] text-text-2">
                  <tr>
                    <th className="px-3 py-2 font-bold">Cobrança</th>
                    <th className="px-3 py-2 font-bold">Vencimento</th>
                    <th className="px-3 py-2 text-right font-bold">Valor</th>
                    <th className="px-3 py-2 text-right font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(process.payment?.charges ?? []).map((charge) => (
                    <tr key={charge.id} className="border-t border-border">
                      <td className="px-3 py-2 text-text-2">{charge.label}</td>
                      <td className="px-3 py-2 text-text-2">{formatDateBr(charge.dueDate)}</td>
                      <td className="px-3 py-2 text-right text-text-2">
                        {formatBRL(charge.amountCents)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <StatusBadge tone={charge.status === 'PAGO' ? 'success' : 'warning'}>
                          {charge.status === 'PAGO' ? 'Pago' : 'Pendente'}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                  {!process.payment?.charges.length ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-text-2">
                        Nenhuma cobrança criada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Documentos" icon={FileText}>
            <div className="mb-3">
              <StatusBadge tone={documentsStatusMeta[process.documentsStatus].tone}>
                {documentsStatusMeta[process.documentsStatus].label}
              </StatusBadge>
            </div>
            <ul className="divide-y divide-border border border-border">
              {process.documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-[0.84rem] font-semibold text-ink">{document.label}</p>
                    <p className="text-[0.72rem] text-text-2">
                      {document.filename ?? 'Não enviado'}
                      {document.uploadedAt
                        ? ` · ${formatDateTimeBr(document.uploadedAt)}`
                        : ''}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      document.status === 'ENVIADO'
                        ? 'success'
                        : document.status === 'ERRO'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {document.status === 'ENVIADO' ? 'Recebido' : document.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Histórico" icon={CalendarDays}>
            <ol className="flex flex-col gap-3">
              {process.events
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    <div>
                      <p className="text-[0.82rem] font-semibold text-ink">{event.title}</p>
                      <p className="text-[0.74rem] leading-relaxed text-text-2">
                        {event.description}
                      </p>
                      <p className="text-[0.66rem] text-field">
                        {formatDateTimeBr(event.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          </Section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="border border-border bg-white p-5">
            <p className="label-caps text-field">Ações</p>
            <p className="mt-2 text-[0.76rem] leading-relaxed text-text-2">
              O reprocessamento assistido e a pausa de automação entram na Fase 4. Até lá, as ações
              abaixo ficam registradas como pendentes de implementação.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <ActionButton icon={RefreshCw} label="Reprocessar integração" />
              <ActionButton icon={Send} label="Reenviar link" />
              <ActionButton icon={LockKeyhole} label="Pausar automação" />
            </div>
          </div>

          <div className="border border-border bg-paper-alt p-5">
            <p className="label-caps text-field">Auditoria</p>
            <p className="mt-2 text-[0.76rem] leading-relaxed text-text-2">
              Última atualização em {formatDateTimeBr(process.updatedAt)}.
            </p>
            <p className="mt-2 text-[0.76rem] leading-relaxed text-text-2">
              CPF: {process.client.cpf ? maskCpf(process.client.cpf) : 'não informado'} — o dado
              completo é liberado apenas para papéis autorizados na API administrativa.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof FileText
  children: React.ReactNode
}) {
  return (
    <section className="border border-border bg-white">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Icon className="size-4 text-brand" aria-hidden="true" />
        <h2 className="font-display text-lg text-ink">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-field">{label}</dt>
      <dd className="mt-0.5 text-[0.84rem] text-ink">{value || '—'}</dd>
    </div>
  )
}

function ActionButton({ icon: Icon, label }: { icon: typeof RefreshCw; label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Disponível em uma próxima fase"
      className="inline-flex min-h-10 items-center justify-between gap-2 rounded-[2px] border border-border px-3 text-[0.78rem] font-semibold text-field"
    >
      <span className="flex items-center gap-2">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <span className="text-[0.62rem] uppercase tracking-[0.08em]">fase 4</span>
    </button>
  )
}
