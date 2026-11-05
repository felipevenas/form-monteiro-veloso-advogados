/**
 * Cliente HTTP do ZapSign.
 *
 * O contrato é criado a partir de um template DOCX e o próprio ZapSign envia
 * o link de assinatura por e-mail e WhatsApp (`send_automatic_whatsapp`).
 * Nenhum segredo sai da Edge Function.
 */

const DEFAULT_BASE_URL = 'https://api.zapsign.com.br/api/v1'

export interface ZapSignSignerInput {
  name: string
  email: string | null
  phoneCountry: string
  phoneNumber: string
}

export interface ZapSignCreateInput {
  templateId: string
  signer: ZapSignSignerInput
  data: Array<{ de: string; para: string }>
  externalId: string
  brandName: string
  customMessage?: string
}

export interface ZapSignCreateResult {
  token: string
  signerUrl: string | null
  status: string
}

export function isZapSignConfigured(): boolean {
  return Boolean(Deno.env.get('ZAPSIGN_API_TOKEN'))
}

export async function createZapSignDocument(
  input: ZapSignCreateInput,
): Promise<ZapSignCreateResult> {
  const token = Deno.env.get('ZAPSIGN_API_TOKEN') ?? ''
  if (!token) {
    throw new Error('ZAPSIGN_NOT_CONFIGURED')
  }

  const baseUrl = Deno.env.get('ZAPSIGN_BASE_URL') ?? DEFAULT_BASE_URL

  const response = await fetch(`${baseUrl}/models/create-doc/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      template_id: input.templateId,
      signer_name: input.signer.name,
      signer_email: input.signer.email ?? '',
      signer_phone_country: input.signer.phoneCountry,
      signer_phone_number: input.signer.phoneNumber,
      send_automatic_email: true,
      send_automatic_whatsapp: true,
      custom_message:
        input.customMessage ??
        'Seu contrato está pronto para assinatura. O link é pessoal e não deve ser compartilhado.',
      external_id: input.externalId,
      lang: 'pt-br',
      brand_name: input.brandName,
      data: input.data,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    console.error('[zapsign] falha ao criar documento:', response.status, safeMessage(payload))
    throw new Error('ZAPSIGN_REQUEST_FAILED')
  }

  const body = asObject(payload)
  const signers = Array.isArray(body.signers) ? body.signers : []
  const firstSigner = asObject(signers[0])

  return {
    token: stringValue(body.token) ?? '',
    signerUrl: stringValue(firstSigner.sign_url) ?? null,
    status: stringValue(body.status) ?? 'pending',
  }
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
  return (
    stringValue(body.detail) ??
    stringValue(body.message) ??
    stringValue(body.error) ??
    'resposta inválida'
  ).slice(0, 200)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}
