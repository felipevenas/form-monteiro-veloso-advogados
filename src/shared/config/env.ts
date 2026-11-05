export const env = {
  appUrl: import.meta.env.VITE_APP_URL ?? window.location.origin,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '',
  apiMode: import.meta.env.VITE_API_MODE === 'http' ? 'http' : 'mock',
  emailConfirmation: import.meta.env.VITE_EMAIL_CONFIRMATION === 'true',
} as const

export const isMockMode = env.apiMode === 'mock'
