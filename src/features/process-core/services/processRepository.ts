import { env } from '@/shared/config/env'
import type { ContractProcess, WizardStepId } from '../types'
import type {
  CheckoutResult,
  ProcessRepository,
  StartProcessInput,
  StartProcessResult,
  StartSignatureInput,
} from '../types'
import { ApiError } from './apiError'

const API_BASE = env.supabaseUrl ? `${env.supabaseUrl}/functions/v1` : '/api'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  token?: string
  body?: unknown
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.token) {
    headers['X-Process-Token'] = options.token
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'omit',
    signal: options.signal,
  })

  const payload = await parseJson(response)

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mv:session-expired'))
    }

    const error = extractError(payload)
    throw new ApiError(
      error.code,
      error.message,
      response.status,
      error.details,
    )
  }

  return payload as T
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function extractError(payload: unknown): {
  code: string
  message: string
  details?: unknown
} {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object'
  ) {
    const error = payload.error as Record<string, unknown>
    return {
      code: typeof error.code === 'string' ? error.code : 'UNKNOWN',
      message:
        typeof error.message === 'string'
          ? error.message
          : 'Não foi possível concluir a operação.',
      details: error.details,
    }
  }

  return {
    code: 'UNKNOWN',
    message: 'Não foi possível concluir a operação.',
  }
}

export function createHttpProcessRepository(): ProcessRepository {
  return {
    async start(input: StartProcessInput): Promise<StartProcessResult> {
      return request<StartProcessResult>('/api-public/session/start', {
        method: 'POST',
        body: input,
      })
    },

    async get(token: string): Promise<ContractProcess> {
      return request<ContractProcess>('/api-public/process', { token })
    },

    async saveStep(
      token: string,
      step: WizardStepId,
      values: Record<string, unknown>,
    ): Promise<ContractProcess> {
      return request<ContractProcess>(`/api-public/process/steps/${step}`, {
        method: 'PUT',
        token,
        body: { values },
      })
    },

    async saveDraft(
      token: string,
      step: WizardStepId,
      values: Record<string, unknown>,
    ): Promise<{ savedAt: string }> {
      return request<{ savedAt: string }>(`/api-public/process/steps/${step}/draft`, {
        method: 'PUT',
        token,
        body: { values },
      })
    },

    async savePlan(token: string, planId: string): Promise<ContractProcess> {      return request<ContractProcess>('/api-public/process/plan', {
        method: 'PUT',
        token,
        body: { planId },
      })
    },

    async startSignature(
      token: string,
      input: StartSignatureInput,
    ): Promise<ContractProcess> {
      return request<ContractProcess>('/api-public/process/signature/start', {
        method: 'POST',
        token,
        body: input,
      })
    },

    async createCheckout(token: string): Promise<CheckoutResult> {
      return request<CheckoutResult>('/api-public/process/payment/checkout', {
        method: 'POST',
        token,
      })
    },

    async uploadDocument(
      token: string,
      requirementId: string,
      file: File,
    ): Promise<ContractProcess> {
      const upload = await request<{
        uploadUrl: string
        path: string
      }>('/api-public/process/documents/upload-url', {
        method: 'POST',
        token,
        body: {
          requirementId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      })

      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!response.ok) {
        throw new ApiError(
          'UPLOAD_FAILED',
          'Não foi possível enviar o arquivo. Tente novamente.',
          response.status,
        )
      }

      return request<ContractProcess>('/api-public/process/documents/complete', {
        method: 'POST',
        token,
        body: {
          requirementId,
          path: upload.path,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      })
    },

    async removeDocument(token: string, requirementId: string): Promise<ContractProcess> {
      return request<ContractProcess>(`/api-public/process/documents/${requirementId}`, {
        method: 'DELETE',
        token,
      })
    },
  }
}
