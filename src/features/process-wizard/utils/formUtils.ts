import type { FormStep } from '@/features/process'

export function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part]
    }
    return undefined
  }, source)
}

export function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.')
  let current = target

  for (const part of parts.slice(0, -1)) {
    const next = current[part]
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  const leaf = parts[parts.length - 1]
  if (leaf) current[leaf] = value
}

/** Extrai apenas os campos da etapa, preservando o default do draft. */
export function pickStepValues(
  step: FormStep,
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}

  for (const field of step.fields) {
    const value = getByPath(draft, field.name)
    setByPath(values, field.name, value ?? field.defaultValue ?? '')
  }

  return values
}

export function getFieldError(errors: unknown, path: string): string | undefined {
  const error = getByPath(errors, path)
  if (!error || typeof error !== 'object') return undefined
  if ('message' in error && typeof error.message === 'string') return error.message
  return undefined
}
