import { isMockMode } from '@/shared/config/env'
import { env } from '@/shared/config/env'
import { ApiError } from '@/features/process'

export async function requestResumeLink(email: string, turnstileToken?: string): Promise<void> {
  if (isMockMode) {
    await new Promise((resolve) => window.setTimeout(resolve, 700))
    return
  }

  const base = env.supabaseUrl ? `${env.supabaseUrl}/functions/v1` : '/api'
  const response = await fetch(`${base}/api-public/session/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, turnstileToken }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null

    throw new ApiError(
      payload?.error?.code ?? 'RESUME_FAILED',
      payload?.error?.message ?? 'Não foi possível enviar o link agora.',
      response.status,
    )
  }
}
