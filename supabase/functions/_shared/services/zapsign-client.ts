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

export interface ZapSignSignerResult {
  token: string
  signUrl: string | null
  status: string
}

export interface ZapSignCreateResult {
  token: string
  signerUrl: string | null
  status: string
  signers: ZapSignSignerResult[]
}

export interface ZapSignDocumentResult {
  token: string
  status: string
  signedFileUrl: string | null
  signers: Array<ZapSignSignerResult & { name: string | null; email: string | null }>
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
  const signers = mapSigners(body.signers)
  const firstSigner = signers[0]

  return {
    token: stringValue(body.token) ?? '',
    signerUrl: firstSigner?.signUrl ?? null,
    status: stringValue(body.status) ?? 'pending',
    signers,
  }
}

export interface ZapSignSignerInputInternal {
  name: string
  email: string
  phoneCountry?: string
  phoneNumber?: string
  cpf?: string
  qualification?: string
}

/**
 * Adiciona a signatária interna ao documento já criado. O cliente assina
 * primeiro; a Dra. Roberta assina depois, via assinatura em lote.
 */
export async function addZapSignSigner(
  documentToken: string,
  signer: ZapSignSignerInputInternal,
): Promise<ZapSignSignerResult> {
  const token = Deno.env.get('ZAPSIGN_API_TOKEN') ?? ''
  if (!token) throw new Error('ZAPSIGN_NOT_CONFIGURED')

  const baseUrl = Deno.env.get('ZAPSIGN_BASE_URL') ?? DEFAULT_BASE_URL

  const response = await fetch(
    `${baseUrl}/docs/${encodeURIComponent(documentToken)}/add-signer/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: signer.name,
        email: signer.email,
        ...(signer.phoneCountry ? { phone_country: signer.phoneCountry } : {}),
        ...(signer.phoneNumber ? { phone_number: signer.phoneNumber } : {}),
        ...(signer.cpf ? { cpf: signer.cpf } : {}),
        ...(signer.qualification ? { qualification: signer.qualification } : {}),
        auth_mode: 'assinaturaTela',
        send_automatic_email: false,
        send_automatic_whatsapp: false,
      }),
      signal: AbortSignal.timeout(20_000),
    },
  )

  const payload = await readJson(response)

  if (!response.ok) {
    console.error('[zapsign] falha ao adicionar signatário:', response.status, safeMessage(payload))
    throw new Error('ZAPSIGN_REQUEST_FAILED')
  }

  const body = asObject(payload)
  const signerToken = stringValue(body.token)
  if (!signerToken) throw new Error('ZAPSIGN_INVALID_RESPONSE')

  return {
    token: signerToken,
    signUrl: stringValue(body.sign_url),
    status: stringValue(body.status) ?? 'new',
  }
}

/**
 * Assinatura em lote pela usuária interna. Exige `ZAPSIGN_INTERNAL_USER_TOKEN`
 * (token pessoal da Dra. Roberta) e os tokens dos signatários internos.
 */
export async function signZapSignDocuments(signerTokens: string[]): Promise<void> {
  const token = Deno.env.get('ZAPSIGN_API_TOKEN') ?? ''
  const userToken = Deno.env.get('ZAPSIGN_INTERNAL_USER_TOKEN') ?? ''

  if (!token || !userToken) throw new Error('ZAPSIGN_INTERNAL_SIGNING_NOT_CONFIGURED')
  if (signerTokens.length === 0) return

  const baseUrl = Deno.env.get('ZAPSIGN_BASE_URL') ?? DEFAULT_BASE_URL

  const response = await fetch(`${baseUrl}/sign/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      user_token: userToken,
      signer_tokens: signerTokens,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    console.error('[zapsign] falha na assinatura interna:', response.status, safeMessage(payload))
    throw new Error('ZAPSIGN_REQUEST_FAILED')
  }
}

export async function getZapSignDocument(
  documentToken: string,
): Promise<ZapSignDocumentResult> {
  const token = Deno.env.get('ZAPSIGN_API_TOKEN') ?? ''
  if (!token) throw new Error('ZAPSIGN_NOT_CONFIGURED')

  const baseUrl = Deno.env.get('ZAPSIGN_BASE_URL') ?? DEFAULT_BASE_URL

  const response = await fetch(`${baseUrl}/docs/${encodeURIComponent(documentToken)}/`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
  })

  const payload = await readJson(response)

  if (!response.ok) {
    console.error('[zapsign] falha ao detalhar documento:', response.status, safeMessage(payload))
    throw new Error('ZAPSIGN_REQUEST_FAILED')
  }

  const body = asObject(payload)

  return {
    token: stringValue(body.token) ?? documentToken,
    status: stringValue(body.status) ?? 'pending',
    signedFileUrl: stringValue(body.signed_file),
    signers: signersRaw(body.signers).map((raw) => {
      const signer = asObject(raw)
      return {
        token: stringValue(signer.token) ?? '',
        signUrl: stringValue(signer.sign_url),
        status: stringValue(signer.status) ?? 'new',
        name: stringValue(signer.name),
        email: stringValue(signer.email),
      }
    }),
  }
}

export function isInternalSigningConfigured(): boolean {
  return Boolean(
    Deno.env.get('ZAPSIGN_INTERNAL_USER_TOKEN') &&
      Deno.env.get('ZAPSIGN_INTERNAL_SIGNER_EMAIL'),
  )
}

function signersRaw(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function mapSigners(value: unknown): ZapSignSignerResult[] {
  return signersRaw(value).map((raw) => {
    const signer = asObject(raw)
    return {
      token: stringValue(signer.token) ?? '',
      signUrl: stringValue(signer.sign_url),
      status: stringValue(signer.status) ?? 'new',
    }
  })
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
