import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useAdminSession } from '../application/use-admin-session'
import { isMockMode } from '@/shared/config/env'
import { supabase } from '@/shared/supabase/client'
import { brand } from '@/shared/config/brand'
import { routes } from '@/shared/config/routes'
import { Logo } from '@/shared/ui/Logo'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { Alert } from '@/shared/ui/Alert'

export function AdminLoginPage() {
  const { status } = useAdminSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authenticated') {
    return <Navigate to={routes.admin.dashboard} replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (isMockMode) {
      navigate(routes.admin.dashboard)
      return
    }

    if (!supabase) {
      setError('Supabase não configurado neste ambiente.')
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (authError) {
      setError('E-mail ou senha inválidos.')
      return
    }

    navigate(routes.admin.dashboard)
  }

  return (
    <main className="grid min-h-dvh bg-paper lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" aria-hidden="true" />
        <Logo light to="/" />
        <div className="max-w-[40ch]">
          <p className="label-caps text-sky-300">Operação</p>
          <p className="mt-4 font-display text-[2.8rem] leading-[1.02]">
            O processo inteiro em uma única mesa.
          </p>
          <p className="mt-5 text-[0.9rem] leading-relaxed text-white/60">
            Acompanhe assinaturas, pagamentos, documentos e falhas de integração. Cada ação
            administrativa deixa rastro de auditoria.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[0.72rem] text-white/50">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Acesso restrito à equipe de {brand.shortName}.
        </div>
      </aside>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Logo to="/" />
          </div>

          <p className="label-caps text-blue-600">Área da equipe</p>
          <h1 className="mt-3 text-[2.2rem] leading-tight text-ink">Entrar no painel</h1>
          <p className="mt-2 text-[0.88rem] leading-relaxed text-text-2">
            Use o e-mail corporativo autorizado. O acesso é individual e auditado.
          </p>

          {isMockMode ? (
            <div className="mt-8 flex flex-col gap-4 border border-dashed border-[#e2c46b] bg-warning-soft p-5">
              <p className="text-[0.82rem] font-bold text-warning">Ambiente de demonstração</p>
              <p className="text-[0.78rem] leading-relaxed text-warning/90">
                A autenticação real usa Supabase Auth. Neste ambiente, o painel abre sem
                credenciais.
              </p>
              <Button
                onClick={() => navigate(routes.admin.dashboard)}
                rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                Entrar no modo demonstração
              </Button>
            </div>
          ) : (
            <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
              <Field id="admin-email" label="E-mail" required>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@monteiroveloso.com"
                />
              </Field>

              <Field id="admin-password" label="Senha" required>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </Field>

              {error ? <Alert tone="danger">{error}</Alert> : null}

              <Button type="submit" loading={loading} leftIcon={<LockKeyhole className="size-4" />}>
                Entrar
              </Button>

              <p className="text-[0.72rem] leading-relaxed text-text-2">
                Esqueceu a senha? Fale com o responsável técnico para redefinir o acesso. Não
                enviamos credenciais por WhatsApp.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
