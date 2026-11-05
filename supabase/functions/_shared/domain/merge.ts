/** Merge profundo de objetos simples (mesma semântica do frontend). */
export function mergeDeep<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch === undefined ? base : (patch as T))
  }

  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(patch)) {
    const current = result[key]

    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = mergeDeep(current, value)
      continue
    }

    if (value !== undefined) {
      result[key] = value
    }
  }

  return result as T
}

export function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part]
    }
    return undefined
  }, source)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
