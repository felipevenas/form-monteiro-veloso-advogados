/**
 * CORS restrito. Em produção apenas APP_URL (aceita lista separada por vírgula)
 * recebe Access-Control-Allow-Origin; em desenvolvimento os dois endereços
 * usuais do Vite são aceitos.
 */

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

export function allowedOrigins(): string[] {
  const configured = Deno.env.get('APP_URL') ?? ''
  const list = configured
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return [...new Set([...list, ...DEV_ORIGINS])]
}

export function resolveAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  if (!origin) return null
  return allowedOrigins().includes(origin) ? origin : null
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = resolveAllowedOrigin(request)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, X-Process-Token, Idempotency-Key, X-Request-Id, X-Cron-Secret, asaas-access-token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

export function preflightResponse(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null

  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}
