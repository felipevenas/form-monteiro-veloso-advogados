import { useEffect, useRef } from 'react'
import { env } from '@/shared/config/env'
import { isMockMode } from '@/shared/config/env'
import { useTheme } from '@/shared/theme/theme-context'

interface TurnstileWidgetProps {
  onToken: (token: string) => void
  resetKey?: number
}

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function TurnstileWidget({ onToken, resetKey = 0 }: TurnstileWidgetProps) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const callbackRef = useRef(onToken)

  useEffect(() => {
    callbackRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (isMockMode || !env.turnstileSiteKey) {
      callbackRef.current('')
      return
    }

    let cancelled = false

    function render() {
      if (cancelled || !containerRef.current || !window.turnstile) return

      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: env.turnstileSiteKey,
        theme: theme === 'dark' ? 'dark' : 'light',
        language: 'pt-br',
        appearance: 'interaction-only',
        size: 'flexible',
        callback: (token) => callbackRef.current(token),
        'expired-callback': () => callbackRef.current(''),
        'error-callback': () => callbackRef.current(''),
      })
    }

    if (window.turnstile) {
      render()
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null

      if (!script) {
        script = document.createElement('script')
        script.id = SCRIPT_ID
        script.src = SCRIPT_URL
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }

      script.addEventListener('load', render, { once: true })
    }

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [theme])

  useEffect(() => {
    if (resetKey <= 0) return
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current)
    }
  }, [resetKey])

  if (isMockMode || !env.turnstileSiteKey) {
    return null
  }

  return <div ref={containerRef} className="min-h-0" aria-label="Verificação de segurança" />
}
