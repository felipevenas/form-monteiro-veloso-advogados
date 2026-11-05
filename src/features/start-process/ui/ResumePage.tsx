import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { Container } from '@/shared/ui/Container'
import { SectionHeading } from '@/shared/ui/SectionHeading'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { Alert } from '@/shared/ui/Alert'
import { TurnstileWidget } from '@/shared/ui/TurnstileWidget'
import { requestResumeLink } from '../application/request-resume'
import { isMockMode } from '@/shared/config/env'

export function ResumePage() {
  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('loading')
    setError(null)

    try {
      await requestResumeLink(email.trim(), turnstileToken)
      setStatus('sent')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o link.')
    }
  }

  return (
    <Container size="narrow" className="py-14 lg:py-20">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-[0.8rem] font-semibold text-text-2 transition hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar ao início
      </Link>

      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <SectionHeading
          as="h1"
          eyebrow="Continuar processo"
          title="Retome de onde parou."
          description="Informe o e-mail usado na contratação. Enviaremos um link pessoal para você voltar ao seu processo."
        />

        <div className="rounded-[2px] border border-border bg-paper-alt p-6 sm:p-8">
          {status === 'sent' ? (
            <div className="flex flex-col gap-4">
              <Alert tone="success" title="Link enviado">
                Se este e-mail estiver vinculado a um processo, você receberá um link em instantes.
                Por segurança, não informamos se o e-mail existe na base.
              </Alert>
              <p className="text-[0.85rem] leading-relaxed text-text-2">
                Verifique também a caixa de spam. O link é pessoal e não deve ser compartilhado.
              </p>
              <Button variant="outline" onClick={() => setStatus('idle')}>
                Enviar para outro e-mail
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <Field
                id="resume-email"
                label="E-mail da contratação"
                required
                hint="Use o mesmo e-mail informado no formulário."
              >
                <Input
                  id="resume-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@email.com"
                />
              </Field>

              {error ? <Alert tone="danger">{error}</Alert> : null}

              <TurnstileWidget onToken={setTurnstileToken} />

              <Button
                type="submit"
                loading={status === 'loading'}
                leftIcon={<Mail className="size-4" aria-hidden="true" />}
              >
                Enviar link de acesso
              </Button>

              {isMockMode ? (
                <p className="text-[0.74rem] leading-relaxed text-text-2">
                  Ambiente de demonstração: nenhum e-mail é enviado. Para testar, inicie um novo
                  processo na página inicial.
                </p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </Container>
  )
}
