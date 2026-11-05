/** Roteamento simples por sufixo de path (Edge Functions têm um slug fixo). */

/**
 * Supabase expõe cada função em `/functions/v1/<slug>/...`. O roteador remove
 * tudo até o slug e devolve o restante normalizado (sempre começando com "/").
 */
export function routePath(request: Request, slug: string): string {
  const { pathname } = new URL(request.url)
  const marker = `/${slug}`
  const index = pathname.indexOf(marker)

  if (index < 0) return '/'

  const rest = pathname.slice(index + marker.length)
  if (!rest) return '/'
  return rest.startsWith('/') ? rest : `/${rest}`
}

/** Extrai o parâmetro de uma rota como `/steps/:step`. */
export function matchParam(path: string, pattern: RegExp): string | null {
  const match = pattern.exec(path)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}
