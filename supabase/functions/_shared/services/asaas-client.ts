/**
 * Cliente HTTP do Asaas Checkout.
 *
 * O checkout hospedado recebe Pix/cartão e devolve o pagador para o formulário
 * via `callback.successUrl`. A confirmação nunca vem do redirect: vem do
 * webhook `CHECKOUT_PAID`.
 */

const DEFAULT_BASE_URL = 'https://api.asaas.com/v3'

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
  const apiKey = Deno.env.get('ASAAS_API_KEY') ?? ''
  if (!apiKey) {
    throw new Error('ASAAS_NOT_CONFIGURED')
  }

  const baseUrl = Deno.env.get('ASAAS_BASE_URL') ?? DEFAULT_BASE_URL
  const installments = Math.min(Math.max(input.installmentCount, 1), 21)

  const response = await fetch(`${baseUrl}/checkouts`, {
    method: 'POST',
    headers: {
      access_token: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MonteiroVelosoForm/1.0',
    },
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
