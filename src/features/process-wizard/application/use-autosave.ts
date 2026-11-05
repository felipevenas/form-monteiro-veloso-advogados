import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, processRepository, type WizardStepId } from '@/features/process'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'expired'

interface UseAutosaveOptions {
  token: string
  stepId: WizardStepId
  debounceMs?: number
}

export interface AutosaveController {
  status: AutosaveStatus
  savedAt: string | null
  schedule: (values: Record<string, unknown>) => void
  flush: () => Promise<void>
  cancel: () => void
}

interface PendingDraft {
  stepId: WizardStepId
  values: Record<string, unknown>
}

export function useAutosave({
  token,
  stepId,
  debounceMs = 900,
}: UseAutosaveOptions): AutosaveController {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const timer = useRef<number | null>(null)
  const pending = useRef<PendingDraft | null>(null)
  const running = useRef(false)
  const alive = useRef(true)
  const expired = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const flush = useCallback(async () => {
    if (expired.current) return

    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }

    if (running.current) return
    running.current = true

    try {
      while (pending.current) {
        const job = pending.current
        pending.current = null

        if (alive.current) setStatus('saving')

        try {
          const result = await processRepository.saveDraft(token, job.stepId, job.values)
          if (!alive.current) return
          setSavedAt(result.savedAt)
          setStatus('saved')
        } catch (cause) {
          if (!alive.current) return

          if (cause instanceof ApiError && cause.status === 401) {
            expired.current = true
            pending.current = null
            setStatus('expired')
            break
          }

          setStatus('error')
          // Mantém o job para uma próxima tentativa manual/nova alteração.
          pending.current ??= job
          break
        }
      }
    } finally {
      running.current = false
    }
  }, [token])

  const schedule = useCallback(
    (values: Record<string, unknown>) => {
      if (expired.current) return

      pending.current = { stepId, values }
      setStatus('saving')

      if (timer.current !== null) window.clearTimeout(timer.current)

      timer.current = window.setTimeout(() => {
        void flush()
      }, debounceMs)
    },
    [debounceMs, flush, stepId],
  )

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    pending.current = null
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }

      const job = pending.current
      if (job && !expired.current) {
        void processRepository.saveDraft(token, job.stepId, job.values).catch(() => {
          // Sem UI no unmount; o rascunho será recuperado na próxima sessão.
        })
      }
    }
  }, [token])

  return { status, savedAt, schedule, flush, cancel }
}
