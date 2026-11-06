import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { StartProcessPage } from '@/features/public-start/pages/StartProcessPage'
import { ResumePage } from '@/features/public-start/pages/ResumePage'
import { LoadingBlock } from '@/shared/ui/Spinner'
import { NotFoundPage } from './NotFoundPage'

const ProcessPage = lazy(() =>
  import('@/features/public-tracking/pages/ProcessPage').then((module) => ({
    default: module.ProcessPage,
  })),
)

const PrivacyPage = lazy(() =>
  import('@/features/privacy/pages/PrivacyPage').then((module) => ({
    default: module.PrivacyPage,
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

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
