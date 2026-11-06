import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { FormField, FormStep, ServiceObjectType } from '@/features/process-core'
import { formatCpf } from '@/shared/utils/cpf'
import { formatPhone } from '@/shared/utils/phone'
import { formatCep } from '@/shared/utils/cep'
import { lookupCep } from '@/shared/lib/cep'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { Button } from '@/shared/ui/Button'
import { Alert } from '@/shared/ui/Alert'
import { ErrorSummary } from '@/shared/ui/ErrorSummary'
import { buildStepSchema } from '../services/buildStepSchema'
import { getFieldError, isFieldVisible, pickStepValues } from '../utils/formUtils'

interface StepFormProps {
  step: FormStep
  draft: Record<string, unknown>
  objectType?: ServiceObjectType
  onNext: (values: Record<string, unknown>) => void
  onDraftChange: (values: Record<string, unknown>) => void
  onBack: () => void
  canGoBack: boolean
  submitting: boolean
  error: string | null
  footer?: ReactNode
  submitLabel?: string
  submitDisabled?: boolean
}

export function StepForm({
  step,
  draft,
  objectType,
  onNext,
  onDraftChange,
  onBack,
  canGoBack,
  submitting,
  error,
  footer,
  submitLabel = 'Continuar',
  submitDisabled = false,
}: StepFormProps) {
  const visibleFields = useMemo(
    () => step.fields.filter((field) => isFieldVisible(field, { objectType })),
    [step, objectType],
  )
  const schema = useMemo(
    () => buildStepSchema(step, { objectType }),
    [step, objectType],
  )
  const defaultValues = useMemo(() => pickStepValues(step, draft), [step, draft])

  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  })

  const [showSummary, setShowSummary] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const onDraftChangeRef = useRef(onDraftChange)
  useEffect(() => {
    onDraftChangeRef.current = onDraftChange
  }, [onDraftChange])

  const watchedValues = useWatch({ control: form.control })
  const lastWatch = useRef(JSON.stringify(watchedValues))

  useEffect(() => {
    const serialized = JSON.stringify(watchedValues)
    if (serialized === lastWatch.current) return

    lastWatch.current = serialized
    onDraftChangeRef.current(watchedValues as Record<string, unknown>)
  }, [watchedValues])

  const summaryErrors = showSummary
    ? visibleFields.flatMap((field) => {
        const message = getFieldError(form.formState.errors, field.name)
        if (!message) return []
        return [
          {
            fieldId: `${step.id}-${field.name.replace(/\./g, '-')}`,
            label: field.label,
            message,
          },
        ]
      })
    : []

  useEffect(() => {
    if (showSummary && summaryErrors.length > 0) {
      summaryRef.current?.focus()
    }
  }, [showSummary, summaryErrors.length])

  const submit = form.handleSubmit(
    (values) => onNext(values),
    () => {
      setShowSummary(true)
    },
  )

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      <ErrorSummary ref={summaryRef} errors={summaryErrors} />

      <div className="grid gap-5 sm:grid-cols-2">
        {visibleFields.map((field) => (
          <div key={field.name} className={field.colSpan === 2 ? 'sm:col-span-2' : undefined}>
            <FieldRenderer field={field} form={form} stepId={step.id} />
          </div>
        ))}
      </div>

      {footer}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        {canGoBack ? (
          <Button
            variant="ghost"
            onClick={onBack}
            leftIcon={<ArrowLeft className="size-4" aria-hidden="true" />}
          >
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          loading={submitting}
          disabled={submitDisabled}
          rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

interface FieldRendererProps {
  field: FormField
  stepId: string
  form: UseFormReturn<Record<string, unknown>>
}

function FieldRenderer({ field, stepId, form }: FieldRendererProps) {
  const id = `${stepId}-${field.name.replace(/\./g, '-')}`
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'found' | 'not-found' | 'error'>('idle')
  const lastCep = useRef('')
  const isCep = field.name.endsWith('cep')

  async function handleCep(value: string) {
    const digits = value.replace(/\D+/g, '')
    if (digits.length !== 8 || digits === lastCep.current) return

    lastCep.current = digits
    setCepStatus('loading')

    try {
      const address = await lookupCep(digits)
      if (!address) {
        setCepStatus('not-found')
        return
      }

      setCepStatus('found')
      const setValue = form.setValue as unknown as (
        name: string,
        value: string,
        options: { shouldDirty: boolean; shouldValidate: boolean },
      ) => void

      setValue('address.street', address.street, {
        shouldDirty: true,
        shouldValidate: true,
      })
      setValue('address.neighborhood', address.neighborhood, {
        shouldDirty: true,
        shouldValidate: true,
      })
      setValue('address.city', address.city, {
        shouldDirty: true,
        shouldValidate: true,
      })
      setValue('address.state', address.state, {
        shouldDirty: true,
        shouldValidate: true,
      })
      form.setFocus('address.number')
    } catch {
      setCepStatus('error')
    }
  }

  function cepHint(): string | undefined {
    if (cepStatus === 'loading') return 'Buscando CEP…'
    if (cepStatus === 'not-found') return 'CEP não encontrado. Preencha o endereço manualmente.'
    if (cepStatus === 'error') return 'Não foi possível buscar o CEP. Preencha manualmente.'
    if (cepStatus === 'found') return 'Endereço preenchido pelo CEP. Confira o número.'
    return field.hint
  }

  return (
    <Controller
      name={field.name}
      control={form.control}
      render={({ field: controlled, fieldState }) => (
        <Field
          id={id}
          label={field.label}
          required={field.required}
          hint={cepHint()}
          error={fieldState.error?.message}
        >
          {field.type === 'select' ? (
            <Select
              id={id}
              options={field.options ?? []}
              placeholder={field.placeholder ?? 'Selecione'}
              value={String(controlled.value ?? '')}
              onChange={controlled.onChange}
              onBlur={controlled.onBlur}
              invalid={Boolean(fieldState.error)}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
            />
          ) : field.type === 'textarea' ? (
            <Textarea
              id={id}
              value={String(controlled.value ?? '')}
              onChange={controlled.onChange}
              onBlur={controlled.onBlur}
              invalid={Boolean(fieldState.error)}
              placeholder={field.placeholder}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
            />
          ) : (
            <Input
              id={id}
              type={inputType(field.type)}
              inputMode={inputMode(field.type)}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              value={String(controlled.value ?? '')}
              onChange={(event) => {
                const next = maskValue(field, event.target.value)
                controlled.onChange(next)
                if (isCep) void handleCep(next)
              }}
              onBlur={() => {
                controlled.onBlur()
                if (isCep) void handleCep(String(controlled.value ?? ''))
              }}
              invalid={Boolean(fieldState.error)}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
            />
          )}
        </Field>
      )}
    />
  )
}

function inputType(type: FormField['type']): string {
  switch (type) {
    case 'email':
      return 'email'
    case 'tel':
      return 'tel'
    case 'date':
      return 'date'
    default:
      return 'text'
  }
}

function inputMode(type: FormField['type']): 'text' | 'tel' | 'numeric' | 'email' {
  switch (type) {
    case 'tel':
      return 'tel'
    case 'cpf':
    case 'date':
      return 'numeric'
    case 'email':
      return 'email'
    default:
      return 'text'
  }
}

function maskValue(field: FormField, value: string): string {
  if (field.type === 'cpf') return formatCpf(value)
  if (field.type === 'tel') return formatPhone(value)
  if (field.name.endsWith('cep')) return formatCep(value)
  if (field.name.endsWith('vehicle_plate')) {
    return value.replace(/[\s-]/g, '').toUpperCase().slice(0, 8)
  }
  return value
}
