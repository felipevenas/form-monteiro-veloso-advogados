/**
 * Erros de aplicação. O código é estável e exibido ao cliente; a mensagem nunca
 * contém detalhe interno e `details` nunca contém PII.
 */

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown
  readonly expose: boolean

  constructor(code: string, message: string, status = 500, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
    this.expose = status < 500
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export const fail = {
  invalidInput: (message = 'Dados inválidos.', details?: unknown) =>
    new ApiError('INVALID_INPUT', message, 422, details),
  unauthorized: (message = 'Sessão inválida ou expirada.') =>
    new ApiError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Você não tem permissão para esta ação.') =>
    new ApiError('FORBIDDEN', message, 403),
  notFound: (message = 'Recurso não encontrado.') =>
    new ApiError('NOT_FOUND', message, 404),
  conflict: (code: string, message: string, details?: unknown) =>
    new ApiError(code, message, 409, details),
  unprocessable: (code: string, message: string, details?: unknown) =>
    new ApiError(code, message, 422, details),
  rateLimited: (resetAt: string) =>
    new ApiError('RATE_LIMITED', 'Muitas tentativas. Tente novamente em instantes.', 429, {
      resetAt,
    }),
  unavailable: (message = 'Serviço temporariamente indisponível.') =>
    new ApiError('PROVIDER_UNAVAILABLE', message, 503),
  internal: () => new ApiError('INTERNAL_ERROR', 'Não foi possível concluir a operação.', 500),
}
