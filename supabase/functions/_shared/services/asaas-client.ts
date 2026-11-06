/**
 * Cliente HTTP do Asaas Checkout.
 *
 * O checkout hospedado recebe Pix/cartão e devolve o pagador para o formulário
 * via `callback.successUrl`. A confirmação nunca vem do redirect: vem do
 * webhook `CHECKOUT_PAID`.
 */

const DEFAULT_BASE_URL = 'https://api.asaas.com/v3'

function baseUrl(): string {
  return Deno.env.get('ASAAS_BASE_URL') ?? DEFAULT_BASE_URL
}

function apiHeaders(apiKey: string): Record<string, string> {
  return {
    access_token: apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'MonteiroVelosoForm/1.0',
  }
}

function apiKey(): string {
  const key = Deno.env.get('ASAAS_API_KEY') ?? ''
  if (!key) throw new Error('ASAAS_NOT_CONFIGURED')
  return key
}

export interface AsaasCustomerInput {
  name: string
  cpfCnpj: string
  email?: string | null
  mobilePhone?: string | null
  postalCode?: string | null
  address?: string | null
  addressNumber?: string | null
  complement?: string | null
  province?: string | null
  externalReference?: string | null
}

export interface AsaasCustomerResult {
  id: string
}

export async function findAsaasCustomerByCpf(
  cpfCnpj: string,
): Promise<AsaasCustomerResult | null> {
  const key = apiKey()
  const url = new URL(`${baseUrl()}/customers`)
  url.searchParams.set('cpfCnpj', cpfCnpj.replace(/\D+/g, ''))
  url.searchParams.set('limit', '1')

  const response = await fetch(url, {
    headers: apiHeaders(key),
    signal: AbortSignal.timeout(20_000),
  })
  const payload = await readJson(response)

  if (!response.ok) {
    console.error('[asaas] falha ao buscar cliente:', response.status, safeMessage(payload))
    throw new Error('ASAAS_REQUEST_FAILED')
  }

  const body = asObject(payload)
  const rows = Array.isArray(body.data) ? body.data : []
  const first = asObject(rows[0])
  const id = stringValue(first.id)
  return id ? { id } : null
}

export async function createAsaasCustomer(
  input: AsaasCustomerInput,
): Promise<AsaasCustomerResult> {
  const key = apiKey()
  const response = await fetch(`${baseUrl()}/customers`, {
    method: 'POST',
    headers: apiHeaders(key),
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj.replace(/\D+/g, ''),
      ...(input.email ? { email: input.email } : {}),
      ...(input.mobilePhone ? { mobilePhone: input.mobilePhone } : {}),
      ...(input.postalCode ? { postalCode: input.postalCode } : {}),
      ...(input.address ? { address: input.address } : {}),
      ...(input.addressNumber ? { addressNumber: input.addressNumber } : {}),
      ...(input.complement ? { complement: input.complement } : {}),
      ...(input.province ? { province: input.province } : {}),
      ...(input.externalReference ? { externalReference: input.externalReference } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    console.error('[asaas] falha ao criar cliente:', response.status, safeMessage(payload))
    throw new Error('ASAAS_REQUEST_FAILED')
  }

  const id = stringValue(asObject(payload).id)
  if (!id) {
    console.error('[asaas] resposta sem id do cliente')
    throw new Error('ASAAS_INVALID_RESPONSE')
  }

  return { id }
}

export interface AsaasPaymentInput {
  customerId: string
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED'
  valueCents: number
  dueDate: string
  description: string
  externalReference: string
  installmentCount?: number
  totalValueCents?: number
}

export interface AsaasPaymentResult {
  id: string
  status: string
  invoiceUrl: string | null
  dueDate: string | null
  installmentId: string | null
}

export async function createAsaasPayment(
  input: AsaasPaymentInput,
): Promise<AsaasPaymentResult> {
  const key = apiKey()
  const response = await fetch(`${baseUrl()}/payments`, {
    method: 'POST',
    headers: apiHeaders(key),
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.valueCents / 100,
      dueDate: input.dueDate,
      description: input.description.slice(0, 500),
      externalReference: input.externalReference,
      ...(input.installmentCount && input.installmentCount > 1
        ? {
            installmentCount: input.installmentCount,
            totalValue: (input.totalValueCents ?? input.valueCents) / 100,
          }
        : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    console.error('[asaas] falha ao criar cobrança:', response.status, safeMessage(payload))
    throw new Error('ASAAS_REQUEST_FAILED')
  }

  const body = asObject(payload)
  const id = stringValue(body.id)
  if (!id) {
    console.error('[asaas] resposta sem id da cobrança')
    throw new Error('ASAAS_INVALID_RESPONSE')
  }

  return {
    id,
    status: stringValue(body.status) ?? 'PENDING',
    invoiceUrl: stringValue(body.invoiceUrl),
    dueDate: stringValue(body.dueDate),
    installmentId: stringValue(body.installment),
  }
}

export interface AsaasCheckoutInput {
  billingType: 'PIX' | 'CREDIT_CARD'
  installmentCount: number
  totalCents: number
  description: string
  itemName: string
  externalReference: string
  successUrl: string
  cancelUrl: string
  expiredUrl: string
  customer: {
    name: string
    cpfCnpj: string
    email: string | null
    phone: string | null
    postalCode: string | null
    address: string | null
    addressNumber: string | null
    complement: string | null
    province: string | null
  }
}

export interface AsaasCheckoutResult {
  id: string
  link: string
}

export function isAsaasConfigured(): boolean {
  return Boolean(Deno.env.get('ASAAS_API_KEY'))
}

export async function createAsaasCheckout(
  input: AsaasCheckoutInput,
): Promise<AsaasCheckoutResult> {
  const token = apiKey()

  const checkoutBaseUrl = baseUrl()
  const installments = Math.min(Math.max(input.installmentCount, 1), 21)

  const response = await fetch(`${checkoutBaseUrl}/checkouts`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify({
      billingTypes: [input.billingType],
      chargeTypes: installments > 1 ? ['INSTALLMENT'] : ['DETACHED'],
      minutesToExpire: 1440,
      externalReference: input.externalReference,
      callback: {
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        expiredUrl: input.expiredUrl,
      },
      items: [
        {
          name: input.itemName.slice(0, 30),
          description: input.description.slice(0, 150),
          quantity: 1,
          value: input.totalCents / 100,
        },
      ],
      ...(installments > 1
        ? { installment: { maxInstallmentCount: installments } }
        : {}),
      customerData: {
        name: input.customer.name,
        cpfCnpj: input.customer.cpfCnpj,
        ...(input.customer.email ? { email: input.customer.email } : {}),
        ...(input.customer.phone ? { phone: input.customer.phone } : {}),
        ...(input.customer.postalCode ? { postalCode: input.customer.postalCode } : {}),
        ...(input.customer.address ? { address: input.customer.address } : {}),
        ...(input.customer.addressNumber
          ? { addressNumber: input.customer.addressNumber }
          : {}),
        ...(input.customer.complement ? { complement: input.customer.complement } : {}),
        ...(input.customer.province ? { province: input.customer.province } : {}),
      },
    }),
    signal: AbortSignal.timeout(20_000),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    console.error('[asaas] falha ao criar checkout:', response.status, safeMessage(payload))
    throw new Error('ASAAS_REQUEST_FAILED')
  }

  const body = asObject(payload)
  const id = stringValue(body.id)
  const link = stringValue(body.link)

  if (!id || !link) {
    console.error('[asaas] resposta sem id/link do checkout')
    throw new Error('ASAAS_INVALID_RESPONSE')
  }

  return { id, link }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function safeMessage(payload: unknown): string {
  const body = asObject(payload)
  const errors = Array.isArray(body.errors) ? body.errors : []
  const first = asObject(errors[0])
  return (stringValue(first.description) ?? stringValue(body.message) ?? 'resposta inválida').slice(
    0,
    200,
  )
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}
