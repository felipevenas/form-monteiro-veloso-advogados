/**
 * Textos gerados para o contrato.
 *
 * O template DOCX recebe variáveis prontas (`data_extenso`,
 * `valor_total_extenso`, `clausula_pagamento`, `clausula_desconto`,
 * `clausula_exito` e `exito_reducao_*`). Nada aqui depende do navegador: a
 * Edge Function é a única fonte desses textos.
 */

import type { DueDateRule, FinancialSnapshot } from './types.ts'

const UNITS = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
]

const TENS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
]

const HUNDREDS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
]

function underHundred(value: number): string {
  if (value < 20) return UNITS[value] ?? ''
  const ten = Math.floor(value / 10)
  const unit = value % 10
  return unit === 0
    ? (TENS[ten] ?? '')
    : `${TENS[ten] ?? ''} e ${UNITS[unit] ?? ''}`
}

function underThousand(value: number): string {
  if (value === 100) return 'cem'
  if (value < 100) return underHundred(value)

  const hundred = Math.floor(value / 100)
  const rest = value % 100
  return rest === 0
    ? (HUNDREDS[hundred] ?? '')
    : `${HUNDREDS[hundred] ?? ''} e ${underHundred(rest)}`
}

/** Converte inteiros não negativos para português (até bilhões). */
export function integerToWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return ''
  if (!Number.isInteger(value)) return integerToWords(Math.trunc(value))
  if (value === 0) return 'zero'
  if (value < 1000) return underThousand(value)

  const groups: Array<{ divisor: number; singular: string; plural: string }> = [
    { divisor: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
    { divisor: 1_000_000, singular: 'milhão', plural: 'milhões' },
    { divisor: 1_000, singular: 'mil', plural: 'mil' },
  ]

  let remaining = value
  const parts: string[] = []

  for (const group of groups) {
    if (remaining < group.divisor) continue
    const count = Math.floor(remaining / group.divisor)
    remaining %= group.divisor

    if (group.divisor === 1_000 && count === 1) {
      parts.push('mil')
    } else {
      const label = count === 1 ? group.singular : group.plural
      parts.push(`${integerToWords(count)} ${label}`)
    }
  }

  if (remaining > 0) {
    const connector =
      remaining < 100 || remaining % 100 === 0 ? ' e ' : ' '
    parts.push(`${connector}${underThousand(remaining)}`)
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** Valor em centavos por extenso (ex.: 420000 → "quatro mil e duzentos reais"). */
export function moneyToWords(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.trunc(cents)) : 0
  const reais = Math.floor(safe / 100)
  const centavos = safe % 100

  const reaisText =
    reais === 1
      ? 'um real'
      : `${integerToWords(reais)} reais`

  if (centavos === 0) return reaisText

  const centavosText =
    centavos === 1
      ? 'um centavo'
      : `${integerToWords(centavos)} centavos`

  return reais === 0 ? centavosText : `${reaisText} e ${centavosText}`
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number.isFinite(cents) ? cents : 0) / 100)
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12))
}

/** Ex.: "5 de novembro de 2026". */
export function formatDateExtenso(value: string | Date): string {
  const date = value instanceof Date ? value : parseIsoDate(value)
  if (!date || Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: value instanceof Date ? 'America/Sao_Paulo' : 'UTC',
  }).format(date)
}

export function dueDateRuleText(rule: DueDateRule): string {
  switch (rule.type) {
    case 'LAST_DAY_OF_MONTH':
      return 'no último dia de cada mês'
    case 'FIRST_BUSINESS_DAY':
      return 'no primeiro dia útil de cada mês'
    case 'LAST_BUSINESS_DAY':
      return 'no último dia útil de cada mês'
    case 'FIXED_DAY':
      return `todo dia ${rule.day} de cada mês`
  }
}

export interface PaymentClauseInput {
  financial: FinancialSnapshot
  planLabel: string
  discountPercent?: number | null
}

/**
 * Parágrafo de pagamento com valores por extenso e a agenda completa.
 * A identidade total = sinal + entrada + parcelas já foi validada antes.
 */
export function buildPaymentClause(input: PaymentClauseInput): string {
  const { financial } = input
  const parts: string[] = []

  parts.push(
    `O valor total dos honorários é de ${formatBRL(financial.totalCents)} (${moneyToWords(
      financial.totalCents,
    )}).`,
  )

  if (financial.signalCents > 0) {
    parts.push(
      `O sinal de ${formatBRL(financial.signalCents)} (${moneyToWords(
        financial.signalCents,
      )}) será pago na assinatura deste contrato.`,
    )
  }

  if (financial.entryCents > 0) {
    parts.push(
      `A entrada de ${formatBRL(financial.entryCents)} (${moneyToWords(
        financial.entryCents,
      )}) será paga na assinatura deste contrato, além do sinal.`,
    )
  }

  const installmentTotal = financial.installments.reduce(
    (sum, installment) => sum + installment.amountCents,
    0,
  )

  if (financial.installments.length > 0) {
    const count = financial.installments.length
    const countText = `${count} ${count === 1 ? 'parcela' : 'parcelas'}`
    const rule = dueDateRuleText(financial.dueDateRule)

    const schedule = financial.installments
      .map((installment) => {
        const date = formatDateExtenso(installment.dueDate)
        return `${installment.number}ª parcela de ${formatBRL(
          installment.amountCents,
        )} (${moneyToWords(installment.amountCents)})${date ? ` em ${date}` : ''}`
      })
      .join('; ')

    parts.push(
      `O saldo de ${formatBRL(installmentTotal)} (${moneyToWords(
        installmentTotal,
      )}) será pago em ${countText} mensais, com vencimento ${rule}, conforme a agenda prevista: ${schedule}.`,
    )
  }

  if (input.discountPercent && input.discountPercent > 0) {
    parts.push(
      `Havendo quitação antecipada, aplica-se o desconto previsto na cláusula de desconto deste contrato.`,
    )
  }

  return parts.join(' ')
}

export function buildDiscountClause(percent: number | null | undefined): string {
  if (!percent || percent <= 0) return ''

  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(percent)

  return `O cliente fará jus a desconto de ${formatted}% sobre o saldo devedor caso opte pela quitação antecipada, nos termos deste contrato.`
}

export interface SuccessConfig {
  successMode: string
  successPercent: number | null
  successMonths: number | null
  successConditions: string | null
  successClause: string | null
}

export interface SuccessValues {
  exito_reducao_percentual: string
  exito_reducao_meses: string
  exito_reducao_condicoes: string
  clausula_exito: string
}

/** Variáveis de êxito conforme o modo do serviço no catálogo. */
export function buildSuccessValues(service: SuccessConfig): SuccessValues {
  if (service.successMode === 'REDUCAO') {
    const percent =
      service.successPercent && service.successPercent > 0
        ? service.successPercent
        : null
    const months =
      service.successMonths && service.successMonths > 0
        ? service.successMonths
        : null
    const conditions = service.successConditions?.trim() ?? ''

    const percentText = percent
      ? `${new Intl.NumberFormat('pt-BR', {
          maximumFractionDigits: 2,
        }).format(percent)}%`
      : ''
    const monthsText = months
      ? `${months} (${integerToWords(months)}) ${months === 1 ? 'mês' : 'meses'}`
      : ''

    const clauseParts: string[] = []
    if (percentText) {
      clauseParts.push(
        `O êxito da redução corresponde a ${percentText} sobre o proveito econômico obtido`,
      )
    }
    if (monthsText) {
      clauseParts.push(`no prazo de ${monthsText}`)
    }
    if (conditions) {
      clauseParts.push(`observadas as seguintes condições: ${conditions}`)
    }

    return {
      exito_reducao_percentual: percentText,
      exito_reducao_meses: monthsText,
      exito_reducao_condicoes: conditions,
      clausula_exito: clauseParts.length > 0 ? `${clauseParts.join(', ')}.` : '',
    }
  }

  return {
    exito_reducao_percentual: '',
    exito_reducao_meses: '',
    exito_reducao_condicoes: '',
    clausula_exito: service.successClause?.trim() ?? '',
  }
}
