/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_API_MODE?: 'mock' | 'http'
  readonly VITE_EMAIL_CONFIRMATION?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
