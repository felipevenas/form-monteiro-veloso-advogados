import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Users,
} from 'lucide-react'
import { adminRepository } from '@/features/admin-processes'
import { ProcessTable } from '@/features/admin-processes/ui/ProcessTable'
import { routes } from '@/shared/config/routes'
import { Alert } from '@/shared/ui/Alert'
import { LinkButton } from '@/shared/ui/Button'
import { LoadingBlock } from '@/shared/ui/Spinner'

export function AdminDashboardPage() {
  const query = useQuery({
    queryKey: ['admin-processes'],
    queryFn: () => adminRepository.list(),
  })

  const metrics = useMemo(() => {
    const processes = query.data ?? []
    return {
      total: processes.length,
      awaitingSignature: processes.filter(
        (process) => process.signatureStatus !== 'ASSINADA_COMPLETA',
      ).length,
      awaitingPayment: processes.filter(
        (process) => process.paymentStatus !== 'PAGO' && process.paymentStatus !== 'NAO_CRIADO',
      ).length,
      pendingDocuments: processes.filter((process) => process.documentsStatus !== 'COMPLETA')
        .length,
      completed: processes.filter((process) => process.generalStatus === 'CONCLUIDO').length,
      errors: processes.filter(
        (process) =>
          process.generalStatus === 'ERRO_REQUER_INTERVENCAO' ||
          process.generalStatus === 'DADOS_INVALIDOS',
      ).length,
    }
  }, [query.data])

  if (query.isLoading) {
    return <LoadingBlock label="Carregando visão geral…" />
  }

  if (query.isError) {
    return (
      <Alert tone="danger" title="Falha ao carregar o painel">
        {query.error instanceof Error ? query.error.message : 'Tente novamente em instantes.'}
      </Alert>
    )
  }

  const recent = (query.data ?? []).slice(0, 6)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps text-blue-600">Visão geral</p>
          <h1 className="mt-2 text-[2.2rem] leading-tight text-ink">Operação de hoje</h1>
          <p className="mt-1 max-w-[62ch] text-[0.88rem] text-text-2">
            O que está travado, o que avançou e o que precisa de uma pessoa. Os números vêm do
            estado oficial do processo no Supabase.
          </p>
        </div>
        <LinkButton to={routes.admin.processes} variant="outline">
          Ver todos os processos
        </LinkButton>
      </header>

      {metrics.errors > 0 ? (
        <Alert tone="danger" title={`${metrics.errors} processo(s) com erro`}>
          Existem processos que exigem intervenção humana. Abra a lista filtrada para assumir o
          atendimento.
          <div className="mt-3">
            <Link
              to={`${routes.admin.processes}?status=ERRO_REQUER_INTERVENCAO`}
              className="text-[0.8rem] font-bold underline underline-offset-4"
            >
              Abrir processos com erro
            </Link>
          </div>
        </Alert>
      ) : null}

      <section className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="Processos ativos"
          value={metrics.total}
          hint="Iniciados nos últimos 90 dias"
        />
        <Metric
          icon={FileText}
          label="Aguardando assinatura"
          value={metrics.awaitingSignature}
          hint="Cliente ou responsável jurídica"
          tone="warning"
        />
        <Metric
          icon={Clock3}
          label="Pagamento pendente"
          value={metrics.awaitingPayment}
          hint="Confirmação depende do Asaas"
          tone="warning"
        />
        <Metric
          icon={CheckCircle2}
          label="Documentos pendentes"
          value={metrics.pendingDocuments}
          hint="Anexos obrigatórios em falta"
          tone="info"
        />
      </section>

      <section className="border border-border bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-ink">Processos recentes</h2>
            <p className="text-[0.76rem] text-text-2">Atualizados nos últimos dias.</p>
          </div>
          <Link
            to={routes.admin.processes}
            className="inline-flex items-center gap-1.5 text-[0.76rem] font-bold text-brand"
          >
            Ver todos
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recent.length ? (
          <ProcessTable processes={recent} compact />
        ) : (
          <div className="flex flex-col items-start gap-3 px-5 py-10">
            <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
            <p className="text-[0.88rem] text-text-2">
              Nenhum processo ainda. Inicie uma contratação pela página pública para ver os dados
              aqui.
            </p>
            <LinkButton to="/" variant="outline" size="sm">
              Abrir formulário
            </LinkButton>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="border border-border bg-white p-5">
          <p className="label-caps text-field">Concluídos</p>
          <p className="mt-2 font-display text-4xl text-ink">{metrics.completed}</p>
          <p className="mt-1 text-[0.78rem] text-text-2">
            Processos com assinatura, pagamento e documentos confirmados.
          </p>
        </div>
        <div className="border border-border bg-ink p-5 text-white">
          <p className="label-caps text-white/45">Próxima fase</p>
          <p className="mt-2 font-display text-2xl">Produtos, integrações e operações</p>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-white/60">
            A configuração de kits, a régua de follow-up e o reprocessamento assistido entram nas
            próximas fases. Nesta versão, o foco é o fluxo ponta a ponta do cliente.
          </p>
        </div>
      </section>
    </div>
  )
}

interface MetricProps {
  icon: typeof Users
  label: string
  value: number
  hint: string
  tone?: 'info' | 'warning' | 'success'
}

function Metric({ icon: Icon, label, value, hint, tone = 'info' }: MetricProps) {
  const color =
    tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-brand'

  return (
    <div className="bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-field">{label}</p>
        <Icon className={`size-4 ${color}`} aria-hidden="true" />
      </div>
      <p className="mt-3 font-display text-4xl text-ink">{value}</p>
      <p className="mt-1 text-[0.72rem] leading-relaxed text-text-2">{hint}</p>
    </div>
  )
}
