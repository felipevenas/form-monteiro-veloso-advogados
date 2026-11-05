/**
 * Cliente HTTP do Resend.
 *
 * Sem SDK: uma chamada `POST /emails` com timeout curto. A idempotência é
 * feita em duas camadas — `Idempotency-Key` no provedor (24 h) e a chave em
 * `message_logs` (permanente).
 */

const DEFAULT_BASE_URL = 'https://api.resend.com'
const TIMEOUT_MS = 10_000

export type EmailErrorClass = 'RETRYABLE' | 'PERMANENT'

export class ResendError extends Error {
  readonly classification: EmailErrorClass
  readonly code: string
  readonly status: number | null

  constructor(
    message: string,
    options: { classification: EmailErrorClass; code: string; status?: number | null },
  ) {
    super(message)
    this.name = 'ResendError'
    this.classification = options.classification
    this.code = options.code
    this.status = options.status ?? null
  }
}

export interface ResendEmailInput {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string | null
  idempotencyKey: string
  tags?: Array<{ name: string; value: string }>
}

export interface ResendEmailResult {
  id: string
}

export function isResendConfigured(): boolean {
  return Boolean(Deno.env.get('RESEND_API_KEY')?.trim())
}

export async function sendResendEmail(input: ResendEmailInput): Promise<ResendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim() ?? ''
  if (!apiKey) {
    throw new ResendError('RESEND_NOT_CONFIGURED', {
      classification: 'PERMANENT',
      code: 'RESEND_NOT_CONFIGURED',
    })
  }

  if (input.to.length === 0) {
    throw new ResendError('RESEND_EMPTY_RECIPIENT', {
      classification: 'PERMANENT',
      code: 'RESEND_EMPTY_RECIPIENT',
    })
  }

  const baseUrl = Deno.env.get('RESEND_BASE_URL')?.trim() || DEFAULT_BASE_URL

  let response: Response
  try {
    response = await fetch(`${baseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MonteiroVelosoForm/1.0',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.tags?.length ? { tags: input.tags } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (cause) {
    // Timeout, DNS, TLS ou rede indisponível: vale tentar de novo.
    throw new ResendError(`RESEND_NETWORK: ${describe(cause)}`, {
      classification: 'RETRYABLE',
      code: 'RESEND_NETWORK',
    })
  }

  const payload = await readPayload(response)

  if (!response.ok) {
    const code = typeof payload?.name === 'string' ? payload.name : `HTTP_${response.status}`
    const message =
      typeof payload?.message === 'string' ? payload.message : `Resend respondeu ${response.status}.`

    throw new ResendError(message, {
      classification: classify(response.status, code),
      code,
      status: response.status,
    })
  }

  const id = typeof payload?.id === 'string' ? payload.id : ''
  if (!id) {
    throw new ResendError('RESEND_MISSING_ID', {
      classification: 'RETRYABLE',
      code: 'RESEND_MISSING_ID',
      status: response.status,
    })
  }

  return { id }
}

function classify(status: number, code: string): EmailErrorClass {
  if (status === 429) return 'RETRYABLE'
  if (status >= 500) return 'RETRYABLE'
  if (status === 409 && code === 'concurrent_idempotent_requests') return 'RETRYABLE'
  return 'PERMANENT'
}

async function readPayload(
  response: Response,
): Promise<{ name?: unknown; message?: unknown; id?: unknown } | null> {
  try {
    const parsed = (await response.json()) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as { name?: unknown; message?: unknown; id?: unknown })
      : null
  } catch {
    return null
  }
}

function describe(cause: unknown): string {
  if (cause instanceof Error) return cause.name
  return 'erro desconhecido'
}
