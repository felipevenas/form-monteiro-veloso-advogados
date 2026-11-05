import { forwardRef } from 'react'

export interface ErrorSummaryItem {
  fieldId: string
  label: string
  message: string
}

interface ErrorSummaryProps {
  errors: ErrorSummaryItem[]
}

export const ErrorSummary = forwardRef<HTMLDivElement, ErrorSummaryProps>(
  function ErrorSummary({ errors }, ref) {
    if (errors.length === 0) return null

    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        aria-labelledby="error-summary-title"
        className="border border-danger bg-danger-soft p-4 text-danger outline-none"
      >
        <p id="error-summary-title" className="text-[0.86rem] font-bold">
          Revise os campos abaixo para continuar.
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[0.8rem] leading-relaxed">
          {errors.map((error) => (
            <li key={error.fieldId}>
              <a
                href={`#${error.fieldId}`}
                className="underline underline-offset-4"
                onClick={(event) => {
                  event.preventDefault()
                  const element = document.getElementById(error.fieldId)
                  element?.focus()
                  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
              >
                {error.label}: {error.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  },
)
