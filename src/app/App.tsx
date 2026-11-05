import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { StartProcessPage } from '@/features/start-process/pages/StartProcessPage'
import { ResumePage } from '@/features/start-process/pages/ResumePage'
import { LoadingBlock } from '@/shared/ui/Spinner'
import { NotFoundPage } from './NotFoundPage'

const AdminLayout = lazy(() =>
  import('./layouts/AdminLayout').then((module) => ({
    default: module.AdminLayout,
  })),
)

const ProcessPage = lazy(() =>
  import('@/features/process-status/pages/ProcessPage').then((module) => ({
    default: module.ProcessPage,
  })),
)

const PrivacyPage = lazy(() =>
  import('@/features/privacy/pages/PrivacyPage').then((module) => ({
    default: module.PrivacyPage,
  })),
)

const AdminLoginPage = lazy(() =>
  import('@/features/admin-auth/pages/AdminLoginPage').then((module) => ({
    default: module.AdminLoginPage,
  })),
)

const AdminDashboardPage = lazy(() =>
  import('@/features/admin-dashboard/pages/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  })),
)

const AdminProcessesPage = lazy(() =>
  import('@/features/admin-processes/pages/AdminProcessesPage').then((module) => ({
    default: module.AdminProcessesPage,
  })),
)

const AdminProcessDetailPage = lazy(() =>
  import('@/features/admin-processes/pages/AdminProcessDetailPage').then((module) => ({
    default: module.AdminProcessDetailPage,
  })),
)

export function App() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-paper">
          <LoadingBlock label="Carregando…" />
        </div>
      }
    >
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<StartProcessPage />} />
          <Route path="/continuar" element={<ResumePage />} />
          <Route path="/processo/:token" element={<ProcessPage />} />
          <Route path="/processo/:token/documentos" element={<ProcessPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
        </Route>

        <Route path="/admin/entrar" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="processos" element={<AdminProcessesPage />} />
          <Route path="processos/:id" element={<AdminProcessDetailPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
