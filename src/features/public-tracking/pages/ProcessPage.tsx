import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  ApiError,
  processRepository,
  type ContractProcess,
} from '@/features/process-core'
import { ProcessWizard } from '@/features/public-form/components/ProcessWizard'
import { ProcessConfirmation } from '../components/ProcessConfirmation'
import { Container } from '@/shared/ui/Container'
import { LoadingBlock } from '@/shared/ui/Spinner'
import { Alert } from '@/shared/ui/Alert'
import { LinkButton } from '@/shared/ui/Button'

export function ProcessPage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const returnedFromCheckout = searchParams.get('pagamento') === 'retorno'
  const [sessionExpired, setSessionExpired] = useState(false)

  const query = useQuery({
    queryKey: ['process', token],
    queryFn: () => processRepository.get(token ?? ''),
    enabled: Boolean(token) && !sessionExpired,
    refetchInterval: (current) => {
      const data = current.state.data as ContractProcess | undefined
      if (!data) return false

      const done =
        data.documentsStatus === 'COMPLETA' ||
        data.completedSteps.includes('documentos')
      if (done) return false

      const waiting =
        data.currentStep === 'assinatura' ||
        data.currentStep === 'pagamento' ||
        data.signatureStatus === 'PENDENTE'

      return waiting ? 5000 : false
    },
  })

  useEffect(() => {
    if (returnedFromCheckout && token) {
      void queryClient.invalidateQueries({ queryKey: ['process', token] })
    }
  }, [returnedFromCheckout, queryClient, token])

  useEffect(() => {
    function handleSessionExpired() {
      setSessionExpired(true)
      if (token) void queryClient.cancelQueries({ queryKey: ['process', token] })
    }

    window.addEventListener('mv:session-expired', handleSessionExpired)
    return () => window.removeEventListener('mv:session-expired', handleSessionExpired)
  }, [queryClient, token])

  if (!token) {
    return <ProcessError message="Link inválido." />
  }

  if (sessionExpired) {
    return (
      <ProcessError
        title="Sessão expirada"
        message="Este link expirou ou o processo foi encerrado. Suas respostas não podem mais ser salvas por este endereço."
      />
    )
  }

  if (query.isLoading) {
    return <LoadingBlock label="Carregando seu processo…" />
  }

  if (query.isError || !query.data) {
    const error = query.error
    const notFound = error instanceof ApiError && error.status === 404
    const unauthorized = error instanceof ApiError && error.status === 401

    if (unauthorized) {
      return (
        <ProcessError
          title="Sessão expirada"
          message="Este link expirou ou o processo foi encerrado. Comece uma nova contratação para continuar."
        />
      )
    }

    return (
      <ProcessError
        message={
          notFound
            ? 'Este link expirou ou não existe mais. Solicite um novo link de acesso.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível carregar o processo.'
        }
      />
    )
  }

  const process = query.data
  const isDone =
    process.documentsStatus === 'COMPLETA' ||
    process.completedSteps.includes('documentos')

  function handleUpdated(updated: ContractProcess) {
    queryClient.setQueryData(['process', token], updated)

    if (
      updated.completedSteps.includes('documentos') &&
      !process.completedSteps.includes('documentos')
    ) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (isDone) {
    return (
      <Container size="narrow" className="py-8 sm:py-12">
        <ProcessConfirmation process={process} />
      </Container>
    )
  }

  return (
    <Container size="narrow" className="py-8 sm:py-12">
      <ProcessWizard
        token={token}
        process={process}
        onUpdated={handleUpdated}
        returnedFromCheckout={returnedFromCheckout}
      />
    </Container>
  )
}

function ProcessError({
  title = 'Não foi possível abrir o processo',
  message,
}: {
  title?: string
  message: string
}) {
  return (
    <Container size="narrow" className="py-16">
      <Alert tone="warning" title={title}>
        {message}
      </Alert>
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton to="/">Começar nova contratação</LinkButton>
        <LinkButton to="/continuar" variant="outline">
          Solicitar novo link
        </LinkButton>
      </div>
    </Container>
  )
}
