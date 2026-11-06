import type { PaymentPlan, ProductService } from '@/features/process-core'
import { buildSnapshotFromPlan } from '@/features/process-core'
import { formatCpf } from '@/shared/utils/cpf'
import { formatPhone } from '@/shared/utils/phone'
import { formatCep } from '@/shared/utils/cep'
import { formatBRL } from '@/shared/utils/money'
import { formatDateBr, todayInSaoPaulo } from '@/shared/utils/dates'
import { getByPath } from '../utils/formUtils'

interface ContractReviewProps {
  draft: Record<string, unknown>
  service?: ProductService
  plan?: PaymentPlan
}

interface ReviewRow {
  label: string
  value: string
}

const MARITAL_STATUS_LABELS: Record<string, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
  uniao_estavel: 'União estável',
  'uniao-estavel': 'União estável',
}

export function ContractReview({ draft, service, plan }: ContractReviewProps) {
  const fullName = readText(draft, 'fullName')
  const cpf = readText(draft, 'cpf')
  const maritalStatus = readText(draft, 'maritalStatus')
  const profession = readText(draft, 'profession')
  const nationality = readText(draft, 'nationality')
  const email = readText(draft, 'email')
  const phone = readText(draft, 'phone')

  const street = readText(draft, 'address.street')
  const number = readText(draft, 'address.number')
  const complement = readText(draft, 'address.complement')
  const neighborhood = readText(draft, 'address.neighborhood')
  const city = readText(draft, 'address.city')
  const state = readText(draft, 'address.state')
  const cep = readText(draft, 'address.cep')

  const bank = readText(draft, 'extra.banco_instituicao_financeira')
  const publicEntity = readText(draft, 'extra.ente_federativo_e_lei_aplicavel')
  const additionalObject = readText(draft, 'extra.descricao_adicional_do_objeto')

  const snapshot = plan ? buildSnapshotFromPlan(plan, todayInSaoPaulo()) : null
  const firstDueDate = snapshot?.ok ? snapshot.value.installments[0]?.dueDate : undefined

  const personalRows: ReviewRow[] = [
    { label: 'Nome', value: orDash(fullName) },
    { label: 'CPF', value: cpf ? formatCpf(cpf) : '—' },
    { label: 'Estado civil', value: maritalStatus ? maritalLabel(maritalStatus) : '—' },
    { label: 'Profissão', value: orDash(profession) },
    { label: 'Nacionalidade', value: orDash(nationality) },
  ]

  const contactRows: ReviewRow[] = [
    { label: 'E-mail', value: orDash(email) },
    { label: 'WhatsApp', value: phone ? formatPhone(phone) : '—' },
  ]

  const addressRows: ReviewRow[] = [
    { label: 'Rua / avenida', value: orDash(street) },
    { label: 'Número', value: orDash(number) },
    { label: 'Complemento', value: complement || 'sem complemento' },
    { label: 'Bairro', value: orDash(neighborhood) },
    { label: 'Cidade/UF', value: city || state ? `${city || '—'}/${state || '—'}` : '—' },
    { label: 'CEP', value: cep ? formatCep(cep) : '—' },
  ]

  const serviceRows: ReviewRow[] = [
    { label: 'Serviço', value: orDash(service?.name ?? '') },
  ]

  if (service?.objectType === 'BANK') {
    serviceRows.push({
      label: 'Banco / instituição financeira',
      value: orDash(bank),
    })
  }

  if (service?.objectType === 'PUBLIC_ENTITY') {
    serviceRows.push({
      label: 'Ente federativo e lei aplicável',
      value: orDash(publicEntity),
    })
  }

  if (additionalObject) {
    serviceRows.push({ label: 'Descrição adicional', value: additionalObject })
  }

  const paymentRows: ReviewRow[] = [
    { label: 'Plano', value: orDash(plan?.label ?? '') },
    { label: 'Valor total', value: plan ? formatBRL(plan.totalCents) : '—' },
  ]

  if (plan && plan.signalCents > 0) {
    paymentRows.push({ label: 'Sinal', value: formatBRL(plan.signalCents) })
  }

  if (plan && plan.entryCents > 0) {
    paymentRows.push({ label: 'Entrada', value: formatBRL(plan.entryCents) })
  }

  if (plan) {
    paymentRows.push({
      label: 'Parcelas',
      value: plan.installmentCount > 1 ? `${plan.installmentCount} parcelas` : 'À vista',
    })
  }

  paymentRows.push({
    label: 'Primeiro vencimento',
    value: firstDueDate ? formatDateBr(firstDueDate) : '—',
  })

  return (
    <section aria-label="Resumo da contratação" className="border border-border bg-paper-alt/40 p-4">
      <p className="label-caps text-field">Resumo da contratação</p>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <ReviewBlock title="Dados pessoais" rows={personalRows} />
        <ReviewBlock title="Contato" rows={contactRows} />
        <ReviewBlock title="Endereço" rows={addressRows} />
        <ReviewBlock title="Serviço" rows={serviceRows} />
        <ReviewBlock title="Pagamento" rows={paymentRows} />
      </div>

      {snapshot && !snapshot.ok ? (
        <p className="mt-3 text-[0.75rem] font-semibold text-danger">{snapshot.error}</p>
      ) : null}

      <p className="mt-4 border-t border-border pt-3 text-[0.72rem] leading-relaxed text-field">
        Os honorários de êxito, descontos e condições específicas serão definidos pela equipe na
        confecção do contrato.
      </p>
    </section>
  )
}

function ReviewBlock({ title, rows }: { title: string; rows: ReviewRow[] }) {
  return (
    <div>
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-field">{title}</p>
      <dl className="mt-1.5 flex flex-col gap-1 text-[0.78rem] leading-relaxed">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
            <dt className="text-text-2">{row.label}</dt>
            <dd className="text-right font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function readText(source: Record<string, unknown>, path: string): string {
  const value = getByPath(source, path)
  return typeof value === 'string' ? value.trim() : ''
}

function orDash(value: string): string {
  return value || '—'
}

function maritalLabel(value: string): string {
  return MARITAL_STATUS_LABELS[value] ?? value
}
