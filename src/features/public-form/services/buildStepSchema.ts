import { z } from 'zod'
import { isValidCpf } from '@/shared/utils/cpf'
import { isValidPhone } from '@/shared/utils/phone'
import { isValidIsoDate } from '@/shared/utils/dates'
import type { FormField, FormStep } from '@/features/process-core'
import { isFieldVisible, type FormContext } from '../utils/formUtils'

type SchemaNode = {
  leaf?: z.ZodTypeAny
  required: boolean
  children: Record<string, SchemaNode>
}

function createNode(): SchemaNode {
  return { required: false, children: {} }
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
  context?: FormContext,
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

    const visible = isFieldVisible(field, context)

    if (!visible) {
      node.children[leaf] = {
        required: false,
        children: {},
        leaf: z.unknown().optional(),
      }
      continue
    }

    const base = fieldSchema(field)
    const required = field.required

    node.children[leaf] = {
      required,
      children: {},
      leaf: required ? base : z.union([base, z.literal('')]).optional(),
    }
  }

  return z.object(toZodShape(root)).passthrough() as z.ZodType<
    Record<string, unknown>,
    Record<string, unknown>
  >
}

function toZodShape(node: SchemaNode): Record<string, z.ZodTypeAny> {
  return Object.fromEntries(
    Object.entries(node.children).map(([key, child]) => {
      if (child.leaf) return [key, child.leaf]

      const objectSchema = z.object(toZodShape(child)).passthrough()
      const hasRequiredDescendant = Object.values(child.children).some(hasRequiredLeaf)

      return [key, hasRequiredDescendant ? objectSchema : objectSchema.optional()]
    }),
  )
}

function hasRequiredLeaf(node: SchemaNode): boolean {
  if (node.required) return true
  return Object.values(node.children).some(hasRequiredLeaf)
}
