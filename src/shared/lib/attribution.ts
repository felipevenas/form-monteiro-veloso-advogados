const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
] as const

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number] | 'landing_page' | 'referrer', string>>

export function readAttribution(search: string = window.location.search): Attribution {
  const params = new URLSearchParams(search)
  const result: Attribution = {}

  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key)
    if (value) result[key] = value.slice(0, 300)
  }

  const product = params.get('produto')
  if (product) result.landing_page = `produto:${product.slice(0, 80)}`

  result.referrer = document.referrer ? document.referrer.slice(0, 300) : ''
  return result
}

export function readProductSlug(search: string = window.location.search): string | undefined {
  return new URLSearchParams(search).get('produto') ?? undefined
}
