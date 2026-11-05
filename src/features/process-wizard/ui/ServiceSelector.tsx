import { Check } from 'lucide-react'
import type { ProductService } from '@/features/process'
import { formatBRL } from '@/shared/domain/money'
import { cn } from '@/shared/lib/cn'

interface ServiceSelectorProps {
  services: ProductService[]
  value: string
  onChange: (serviceId: string) => void
}

export function ServiceSelector({ services, value, onChange }: ServiceSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="label-caps mb-2 text-field">Serviço contratado</legend>

      {services.map((service) => {
        const active = service.id === value

        return (
          <label
            key={service.id}
            className={cn(
              'flex cursor-pointer flex-col gap-3 rounded-[2px] border p-4 transition sm:flex-row sm:items-start sm:justify-between',
              active
                ? 'border-brand bg-blue-50'
                : 'border-border-interactive bg-paper hover:border-brand/60',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                  active ? 'border-brand bg-brand text-white' : 'border-border-interactive',
                )}
                aria-hidden="true"
              >
                {active ? <Check className="size-3" /> : null}
              </span>
              <input
                type="radio"
                name="service"
                value={service.id}
                checked={active}
                onChange={() => onChange(service.id)}
                className="sr-only"
              />
              <div>
                <p className="text-[0.92rem] font-bold text-ink">{service.name}</p>
                <p className="mt-1 max-w-[52ch] text-[0.8rem] leading-relaxed text-text-2">
                  {service.description}
                </p>
              </div>
            </div>

            <div className="pl-8 text-left sm:pl-0 sm:text-right">
              <p className="font-display text-xl text-ink">{formatBRL(service.totalCents)}</p>
              <p className="text-[0.7rem] text-text-2">valor do serviço</p>
            </div>
          </label>
        )
      })}
    </fieldset>
  )
}
