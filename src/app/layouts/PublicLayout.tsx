import { Link, Outlet } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { brand } from '@/shared/config/brand'
import { routes } from '@/shared/config/routes'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'
import { Container } from '@/shared/ui/Container'
import { Logo } from '@/shared/ui/Logo'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { ScrollToTop } from '@/app/ScrollToTop'

export function PublicLayout() {
  return (
    <ThemeProvider>
      <div className="public-shell flex min-h-dvh flex-col bg-paper">
        <ScrollToTop />

        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[2px] focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Pular para o conteúdo
        </a>

        <header className="sticky top-0 z-30 border-b border-border bg-paper/95 backdrop-blur">
          <Container className="flex min-h-[3.75rem] items-center justify-between gap-4">
            <Logo />
            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <Link
                to={routes.resume}
                className="hidden min-h-10 items-center px-2 text-[0.78rem] font-semibold text-text-2 transition hover:text-brand sm:inline-flex"
              >
                Já comecei
              </Link>
              <a
                href={brand.phone.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-[2px] px-2.5 text-[0.78rem] font-bold text-brand transition hover:bg-blue-50"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Ajuda
              </a>
            </div>
          </Container>
        </header>

        <main id="conteudo" className="flex-1">
          <Outlet />
        </main>

        <footer className="border-t border-border">
          <Container className="flex flex-col gap-2 py-5 text-[0.7rem] leading-relaxed text-text-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {brand.shortName} · CNPJ {brand.cnpj} · {brand.lawyer.oab}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link to="/privacidade" className="transition hover:text-brand">
                Política de privacidade
              </Link>
              <Link to={routes.resume} className="transition hover:text-brand">
                Continuar processo
              </Link>
            </div>
          </Container>
        </footer>
      </div>
    </ThemeProvider>
  )
}
