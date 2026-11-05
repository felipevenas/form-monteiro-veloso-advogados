import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { processRepository } from '@/features/process'
import { readAttribution, readProductSlug } from '@/shared/lib/attribution'
import { routes } from '@/shared/config/routes'
import { env, isMockMode } from '@/shared/config/env'
import { Container } from '@/shared/ui/Container'
import { Alert } from '@/shared/ui/Alert'
import { Button, LinkButton } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { TurnstileWidget } from '@/shared/ui/TurnstileWidget'

const LAST_PROCESS_KEY = 'mv:last-process'

export function StartProcessPage() {
  const navigate = useNavigate()
  const started = useRef(false)
  const [phase, setPhase] = useState<'preparing' | 'error'>('preparing')
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [ready, setReady] = useState(isMockMode || !env.turnstileSiteKey)

  const boot = useCallback(async () => {
    setPhase('preparing')
    setError(null)

    const stored = readStoredToken()
    if (stored) {
      try {
        await processRepository.get(stored)
        navigate(routes.process(stored), { replace: true })
        return
      } catch {
        // Token antigo inválido/expirado: cria um novo processo.
        clearStoredToken()
      }
    }

    try {
      const { token } = await processRepository.start({
        productSlug: readProductSlug(),
        attribution: readAttribution(),
        turnstileToken,
      })

      writeStoredToken(token)
      navigate(routes.process(token), { replace: true })
    } catch (cause) {
      setPhase('error')
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível abrir o formulário. Tente novamente.',
      )
    }
  }, [navigate, turnstileToken])

  useEffect(() => {
    if (!ready || started.current) return
    started.current = true
    void boot()
  }, [ready, boot, attempt])

  function retry() {
    started.current = false
    setReady(isMockMode || !env.turnstileSiteKey)
    setTurnstileToken('')
    setAttempt((value) => value + 1)
  }

  if (phase === 'error') {
    return (
      <Container size="narrow" className="py-16 sm:py-24">
        <div className="flex flex-col items-start gap-6">
          <h1 className="text-[2rem] leading-tight text-ink">Vamos começar.</h1>
          <Alert tone="danger" title="Não foi possível abrir o formulário">
            {error}
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button onClick={retry} leftIcon={<RotateCcw className="size-4" />}>
              Tentar novamente
            </Button>
            <LinkButton to={routes.resume} variant="outline">
              Já comecei
            </LinkButton>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container size="narrow" className="flex min-h-[70dvh] flex-col items-center justify-center py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner className="size-6" />
        <p className="text-[0.9rem] text-text-2">Preparando seu formulário…</p>
        <p className="max-w-[38ch] text-[0.78rem] leading-relaxed text-field">
          Você vai preencher seus dados, escolher o pagamento e assinar os documentos.
        </p>
      </div>

      {!isMockMode && env.turnstileSiteKey ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          <TurnstileWidget
            resetKey={attempt}
            onToken={(token) => {
              setTurnstileToken(token)
              setReady(Boolean(token))
            }}
          />
          {!ready ? (
            <button
              type="button"
              onClick={retry}
              className="text-[0.72rem] font-semibold text-text-2 underline underline-offset-4 hover:text-brand"
            >
              A verificação não carregou? Tentar novamente
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-10">
        <LinkButton
          to={routes.resume}
          variant="ghost"
          size="sm"
          rightIcon={<ArrowRight className="size-3.5" />}
        >
          Já comecei uma contratação
        </LinkButton>
      </div>
    </Container>
  )
}

function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_PROCESS_KEY)
  } catch {
    return null
  }
}

function writeStoredToken(token: string): void {
  try {
    window.sessionStorage.setItem(LAST_PROCESS_KEY, token)
  } catch {
    // Sem sessionStorage: o link do processo continua sendo a fonte de retomada.
  }
}

function clearStoredToken(): void {
  try {
    window.sessionStorage.removeItem(LAST_PROCESS_KEY)
  } catch {
    // Ignora.
  }
}
