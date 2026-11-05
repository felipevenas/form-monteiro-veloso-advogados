/** Identificador de correlação: reaproveita X-Request-Id ou gera um novo. */

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,80}$/

export function getRequestId(request: Request): string {
  const incoming = request.headers.get('x-request-id')
  if (incoming && REQUEST_ID_PATTERN.test(incoming)) return incoming
  return crypto.randomUUID()
}
