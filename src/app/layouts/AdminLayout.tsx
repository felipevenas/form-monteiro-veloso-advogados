import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  Boxes,
  LayoutDashboard,
  LogOut,
  PlugZap,
  Users,
} from 'lucide-react'
import { useAdminSession } from '@/features/admin-auth/hooks/useAdminSession'
import { isMockMode } from '@/shared/config/env'
import { supabase } from '@/shared/api/supabase'
import { routes } from '@/shared/config/routes'
import { brand } from '@/shared/config/brand'
import { cn } from '@/shared/lib/cn'
import { Logo } from '@/shared/ui/Logo'
import { LoadingBlock } from '@/shared/ui/Spinner'
import { StatusBadge } from '@/shared/ui/StatusBadge'

const navItems = [
  { to: routes.admin.dashboard, label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: routes.admin.processes, label: 'Processos', icon: Users, end: false },
]

const futureItems = [
  { label: 'Produtos e modelos', icon: Boxes },
  { label: 'Integrações', icon: PlugZap },
  { label: 'Operações', icon: Activity },
]

export function AdminLayout() {
  const { status, user } = useAdminSession()
  const navigate = useNavigate()

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper-alt">
        <LoadingBlock label="Verificando acesso…" />
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to={routes.admin.login} replace />
  }

  async function handleLogout() {
    if (isMockMode) {
      navigate('/')
      return
    }

    if (supabase) {
      await supabase.auth.signOut()
    }
    navigate(routes.admin.login)
  }

  return (
    <div className="min-h-dvh bg-paper-alt lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-white/10 bg-ink text-white lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-6 py-6">
          <Logo light to="/admin" />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-5" aria-label="Navegação do painel">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-[2px] px-3 text-[0.84rem] font-semibold transition',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}

          <p className="mt-6 px-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/30">
            Em breve
          </p>
          {futureItems.map((item) => {
            const Icon = item.icon
            return (
              <span
                key={item.label}
                className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-[2px] px-3 text-[0.84rem] font-semibold text-white/25"
                title="Disponível em uma próxima fase"
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </span>
            )
          })}
        </nav>

        <div className="border-t border-white/10 px-6 py-5">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/35">
            Sessão
          </p>
          <p className="mt-1 truncate text-[0.78rem] text-white/75">{user?.email}</p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-3 inline-flex min-h-9 items-center gap-2 text-[0.76rem] font-semibold text-white/55 transition hover:text-white"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-paper px-5 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo to="/admin" />
          </div>
          <div className="hidden items-center gap-2 text-[0.74rem] text-text-2 lg:flex">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Painel operacional · {brand.shortName}
          </div>

          <div className="flex items-center gap-3">
            {isMockMode ? <StatusBadge tone="warning">Demonstração</StatusBadge> : null}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex min-h-9 items-center gap-1.5 text-[0.74rem] font-semibold text-text-2 transition hover:text-brand lg:hidden"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sair
            </button>
          </div>
        </header>

        <nav
          className="flex gap-1 overflow-x-auto border-b border-border bg-paper px-4 py-2 lg:hidden"
          aria-label="Navegação do painel"
        >
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[2px] px-3 text-[0.78rem] font-semibold',
                    isActive ? 'bg-blue-50 text-brand' : 'text-text-2',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <main className="flex-1 px-5 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
