import { z } from 'zod'
import { isValidCpf } from '@/shared/domain/cpf'
import { isValidPhone } from '@/shared/domain/phone'
import { isValidIsoDate } from '@/shared/domain/dates'
import type { FormField, FormStep } from '@/features/process'

type SchemaNode = {
  leaf?: z.ZodTypeAny
  children: Record<string, SchemaNode>
}

function createNode(): SchemaNode {
  return { children: {} }
}

function fieldSchema(field: FormField): z.ZodTypeAny {
  const requiredMessage = `Informe ${field.label.toLowerCase()}.`

  switch (field.type) {
    case 'email':
      return z
        .string()
        .trim()
        .min(1, requiredMessage)
        .email('Informe um e-mail válido.')
    case 'tel':
      return z
        .string()
        .trim()
        .min(1, requiredMessage)
        .refine((value) => isValidPhone(value), 'Informe um WhatsApp válido com DDD.')
    case 'cpf':
      return z
        .string()
        .trim()
        .min(1, requiredMessage)
        .refine((value) => isValidCpf(value), 'Informe um CPF válido.')
    case 'date':
      return z
        .string()
        .trim()
        .min(1, requiredMessage)
        .refine((value) => isValidIsoDate(value), 'Informe uma data válida.')
    case 'select':
      return z
        .string()
        .trim()
        .min(1, requiredMessage)
        .refine(
          (value) => !field.options || field.options.some((option) => option.value === value),
          'Selecione uma opção válida.',
        )
    case 'textarea':
    case 'text':
    default: {
      let schema = z.string().trim().min(1, requiredMessage)
      if (field.maxLength) {
        schema = schema.max(field.maxLength, `Use no máximo ${field.maxLength} caracteres.`)
      }
      return schema
    }
  }
}

/** Gera o schema Zod de uma etapa a partir do schema declarativo do produto. */
export function buildStepSchema(
  step: FormStep,
): z.ZodType<Record<string, unknown>, Record<string, unknown>> {
  const root = createNode()

  for (const field of step.fields) {
    const parts = field.name.split('.')
    let node = root

    for (const part of parts.slice(0, -1)) {
      node.children[part] ??= createNode()
      node = node.children[part] as SchemaNode
    }

    const leaf = parts[parts.length - 1]
    if (!leaf) continue

    const base = fieldSchema(field)
    node.children[leaf] = {
      children: {},
      leaf: field.required ? base : z.union([base, z.literal('')]).optional(),
    }
  }

  return z.object(toZodShape(root)).passthrough() as z.ZodType<
    Record<string, unknown>,
    Record<string, unknown>
  >
}

function toZodShape(node: SchemaNode): Record<string, z.ZodTypeAny> {
  return Object.fromEntries(
    Object.entries(node.children).map(([key, child]) => [
      key,
      child.leaf ?? z.object(toZodShape(child)).passthrough(),
    ]),
  )
}
