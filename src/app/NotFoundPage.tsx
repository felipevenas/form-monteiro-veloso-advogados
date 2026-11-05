import { Link } from 'react-router-dom'
import { Container } from '@/shared/ui/Container'
import { SectionHeading } from '@/shared/ui/SectionHeading'
import { LinkButton } from '@/shared/ui/Button'

export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <Container size="narrow" className="flex flex-col items-start gap-6">
        <p className="label-caps text-blue-600">Erro 404</p>
        <SectionHeading
          as="h1"
          title="Esta página não existe."
          description="O link pode ter expirado ou sido digitado incorretamente. Se você está no meio de uma contratação, volte pelo link enviado para o seu e-mail ou WhatsApp."
        />
        <div className="flex flex-wrap gap-3">
          <LinkButton to="/">Voltar ao início</LinkButton>
          <LinkButton to="/continuar" variant="outline">
            Continuar processo
          </LinkButton>
        </div>
        <Link to="/privacidade" className="text-sm text-text-2 underline underline-offset-4">
          Política de privacidade
        </Link>
      </Container>
    </main>
  )
}
