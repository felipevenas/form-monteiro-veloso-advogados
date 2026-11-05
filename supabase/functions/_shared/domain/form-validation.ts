/** Validação server-side do schema declarativo do produto. */

import { isValidCpf } from './cpf.ts'
import { isValidPhone } from './phone.ts'
import { isValidIsoDate } from './dates.ts'
import { getByPath, mergeDeep } from './merge.ts'
import type { FormField, FormStep } from './types.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface ValidationIssue {
  field: string
  message: string
}

export function validateStep(step: FormStep, values: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const field of step.fields) {
    const value = getByPath(values, field.name)
    const text = typeof value === 'string' ? value.trim() : ''

    if (field.required && text === '') {
      issues.push({ field: field.name, message: `Informe ${field.label.toLowerCase()}.` })
      continue
    }

    if (text === '') continue

    if (field.maxLength && text.length > field.maxLength) {
      issues.push({
        field: field.name,
        message: `Use no máximo ${field.maxLength} caracteres.`,
      })
      continue
    }

    switch (field.type) {
      case 'cpf':
        if (!isValidCpf(text)) {
          issues.push({ field: field.name, message: 'Informe um CPF válido.' })
        }
        break
      case 'email':
        if (!EMAIL_PATTERN.test(text)) {
          issues.push({ field: field.name, message: 'Informe um e-mail válido.' })
        }
        break
      case 'tel':
        if (!isValidPhone(text)) {
          issues.push({ field: field.name, message: 'Informe um WhatsApp válido com DDD.' })
        }
        break
      case 'date':
        if (!isValidIsoDate(text)) {
          issues.push({ field: field.name, message: 'Informe uma data válida.' })
        }
        break
      case 'select':
        if (field.options && !field.options.some((option) => option.value === text)) {
          issues.push({ field: field.name, message: 'Selecione uma opção válida.' })
        }
        break
      default:
        break
    }
  }

  return issues
}

/** Normaliza valores antes de persistir (CPF, telefone, CEP, UF, placa). */
export function normalizeStepValues(
  step: FormStep,
  values: Record<string, unknown>,
): Record<string, unknown> {
  let result: Record<string, unknown> = {}

  for (const field of step.fields) {
    const value = getByPath(values, field.name) ?? field.defaultValue
    if (value === undefined) continue

    const normalized = normalizeField(field, value)
    result = mergeDeep(result, buildPath(field.name, normalized))
  }

  return result
}

function normalizeField(field: FormField, value: unknown): unknown {
  if (typeof value !== 'string') return value

  const text = value.trim()

  if (field.type === 'cpf') return text.replace(/\D+/g, '')
  if (field.type === 'tel') return text.replace(/\D+/g, '')
  if (field.name.endsWith('cep')) return text.replace(/\D+/g, '')
  if (field.name.endsWith('state')) return text.toUpperCase()
  if (field.name.endsWith('vehicle_plate')) {
    return text.replace(/[\s-]/g, '').toUpperCase()
  }

  return text
}

function buildPath(path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.')
  const root: Record<string, unknown> = {}
  let current = root

  for (const part of parts.slice(0, -1)) {
    const next: Record<string, unknown> = {}
    current[part] = next
    current = next
  }

  const leaf = parts[parts.length - 1]
  if (leaf) current[leaf] = value

  return root
}
