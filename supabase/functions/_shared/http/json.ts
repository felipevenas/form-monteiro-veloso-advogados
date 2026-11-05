/** Respostas JSON e tratamento uniforme de erros. */

import { corsHeaders } from './cors.ts'
import { ApiError, isApiError } from './errors.ts'
import { getRequestId } from './request-id.ts'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request),
      'X-Request-Id': getRequestId(request),
      ...extraHeaders,
    },
  })
}

export function errorResponse(request: Request, error: unknown): Response {
  const requestId = getRequestId(request)

  if (isApiError(error)) {
    if (!error.expose) {
      console.error(`[${requestId}] ${error.code}:`, error.message)
    }

    return jsonResponse(
      request,
      {
        error: {
          code: error.code,
          message: error.expose ? error.message : 'Não foi possível concluir a operação.',
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      error.status,
    )
  }

  console.error(`[${requestId}] erro inesperado:`, error instanceof Error ? error.message : error)
  return jsonResponse(
    request,
    { error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação.' } },
    500,
  )
}

export function methodNotAllowed(request: Request, allowed: readonly string[]): Response {
  return jsonResponse(
    request,
    {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Método não permitido para esta rota.',
        details: { allowed },
      },
    },
    405,
    { Allow: allowed.join(', ') },
  )
}

/** Lê e limita o corpo JSON (evita payloads gigantes em função pública). */
export async function readJsonBody(request: Request, maxBytes = 256 * 1024): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError('INVALID_INPUT', 'Envie o corpo como application/json.', 422)
  }

  const raw = await request.text()
  if (raw.length > maxBytes) {
    throw new ApiError('INVALID_INPUT', 'Corpo da requisição muito grande.', 413)
  }

  if (!raw.trim()) return {}

  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new ApiError('INVALID_INPUT', 'Corpo JSON inválido.', 422)
  }
}
