import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { adminRepository } from '@/features/admin-processes'
import { ProcessTable } from '@/features/admin-processes/ui/ProcessTable'
import { generalStatusMeta, type GeneralStatus } from '@/features/process'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { LoadingBlock } from '@/shared/ui/Spinner'
import { Alert } from '@/shared/ui/Alert'

const statusOptions = Object.entries(generalStatusMeta).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

export function AdminProcessesPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const status = (params.get('status') ?? '') as GeneralStatus | ''

  const query = useQuery({
    queryKey: ['admin-processes'],
    queryFn: () => adminRepository.list(),
  })

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()
    return (query.data ?? []).filter((process) => {
      const matchesStatus = !status || process.generalStatus === status
      const matchesTerm =
        !term ||
        process.clientName.toLowerCase().includes(term) ||
        process.publicCode.toLowerCase().includes(term) ||
        process.productName.toLowerCase().includes(term)

      return matchesStatus && matchesTerm
    })
  }, [query.data, deferredSearch, status])

  if (query.isLoading) {
    return <LoadingBlock label="Carregando processos…" />
  }

  if (query.isError) {
    return (
      <Alert tone="danger" title="Falha ao carregar processos">
        {query.error instanceof Error ? query.error.message : 'Tente novamente em instantes.'}
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="label-caps text-blue-600">Processos</p>
        <h1 className="mt-2 text-[2.2rem] leading-tight text-ink">Clientes e contratações</h1>
        <p className="mt-1 max-w-[62ch] text-[0.88rem] text-text-2">
          Busque por nome, protocolo ou produto. Os dados sensíveis são mascarados nesta listagem.
        </p>
      </header>

      <div className="flex flex-col gap-3 border border-border bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="admin-search" className="text-[0.72rem] font-bold text-text-2">
            Buscar
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-field"
              aria-hidden="true"
            />
            <Input
              id="admin-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, protocolo ou produto"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <label htmlFor="admin-status" className="text-[0.72rem] font-bold text-text-2">
            Etapa
          </label>
          <Select
            id="admin-status"
            options={statusOptions}
            placeholder="Todas as etapas"
            value={status}
            onChange={(event) => {
              const next = new URLSearchParams(params)
              if (event.target.value) next.set('status', event.target.value)
              else next.delete('status')
              setParams(next, { replace: true })
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.78rem] text-text-2">
          {filtered.length} de {(query.data ?? []).length} processos
        </p>
        {status || search ? (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setParams({}, { replace: true })
            }}
            className="text-[0.76rem] font-bold text-brand underline underline-offset-4"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      {filtered.length ? (
        <div className="border border-border bg-white">
          <ProcessTable processes={filtered} />
        </div>
      ) : (
        <div className="border border-border bg-white px-5 py-12 text-center">
          <p className="font-display text-xl text-ink">Nenhum processo encontrado.</p>
          <p className="mt-1 text-[0.84rem] text-text-2">
            Ajuste os filtros ou inicie uma nova contratação.
          </p>
        </div>
      )}
    </div>
  )
}
