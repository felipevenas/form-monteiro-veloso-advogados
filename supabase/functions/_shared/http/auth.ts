/**
 * Autenticação das superfícies:
 * - público: token opaco `mv_...` (hash SHA-256 em sessions.token_hash);
 * - admin: JWT do Supabase + profile ativo;
 * - jobs: X-Cron-Secret;
 * - webhooks: segredo no header.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { fail } from './errors.ts'
import type { AdminActor, ProcessSession } from '../db/types.ts'

const TOKEN_PATTERN = /^mv_[0-9a-f]{48}$/
const HASH_PATTERN = /^[0-9a-f]{64}$/
const SESSION_RENEW_MS = 30 * 24 * 60 * 60 * 1000

let cachedClient: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SERVICE_ROLE_KEY') ??
    ''

  if (!url || !key) {
    throw fail.internal()
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'mv-edge-functions' } },
  })

  return cachedClient
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * Hash do IP: nunca persistimos o IP em claro. O salt é opcional, mas
 * recomendado em produção (IP_HASH_SALT).
 */
export async function hashIp(request: Request): Promise<string> {
  const salt = Deno.env.get('IP_HASH_SALT') ?? 'mv'
  return sha256Hex(`${salt}:${clientIp(request)}`)
}

function readCookie(request: Request, names: readonly string[]): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null

  const jars = header.split(';').map((part) => part.trim())
  for (const entry of jars) {
    const separator = entry.indexOf('=')
    if (separator < 0) continue
    const name = entry.slice(0, separator)
    if (!names.some((candidate) => name === candidate || name.startsWith(`${candidate}.`))) {
      continue
    }
    return decodeURIComponent(entry.slice(separator + 1))
  }
  return null
}

export function readProcessToken(request: Request): string | null {
  const header = request.headers.get('x-process-token')
  if (header) return header.trim()

  return readCookie(request, ['mv_process_token', 'mv_process'])
}

/**
 * Valida o token público e devolve a sessão ativa, atualizando `last_seen_at`.
 * Token inválido, expirado ou revogado resulta em 401 (sem revelar qual regra).
 */
export async function requireProcessSession(
  supabase: SupabaseClient,
  request: Request,
): Promise<ProcessSession> {
  const token = readProcessToken(request)
  if (!token || !TOKEN_PATTERN.test(token)) {
    throw fail.unauthorized('Sessão inválida ou expirada.')
  }

  const tokenHash = await sha256Hex(token)
  if (!HASH_PATTERN.test(tokenHash)) {
    throw fail.unauthorized('Sessão inválida ou expirada.')
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('id, process_id, token_hash, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle<ProcessSession>()

  if (error) {
    console.error('[auth] falha ao consultar sessão:', error.message)
    throw fail.internal()
  }

  if (!data || data.revoked_at) {
    throw fail.unauthorized('Sessão inválida ou expirada.')
  }

  const now = Date.now()

  if (new Date(data.expires_at).getTime() <= now) {
    throw fail.unauthorized('Sessão inválida ou expirada.')
  }

  // Renovação deslizante: quem usa o formulário não perde a sessão no meio do
  // preenchimento por causa do prazo original de 30 dias.
  await supabase
    .from('sessions')
    .update({
      last_seen_at: new Date(now).toISOString(),
      expires_at: new Date(now + SESSION_RENEW_MS).toISOString(),
    })
    .eq('id', data.id)

  return data
}

function readAdminToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim()
    if (token) return token
  }

  const cookie = readCookie(request, ['sb-access-token', 'supabase-auth-token'])
  if (cookie) return cookie

  // Supabase grava `sb-<ref>-auth-token` (JSON ou base64-<json>).
  const raw = request.headers.get('cookie')
  if (!raw) return null

  for (const part of raw.split(';').map((entry) => entry.trim())) {
    if (!part.startsWith('sb-') || !part.includes('-auth-token')) continue
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const value = decodeURIComponent(part.slice(separator + 1))
    const json = value.startsWith('base64-')
      ? atob(value.slice('base64-'.length).replace(/-/g, '+').replace(/_/g, '/'))
      : value

    try {
      const parsed = JSON.parse(json) as { access_token?: unknown }
      if (typeof parsed.access_token === 'string') return parsed.access_token
    } catch {
      // Cookie em formato desconhecido: ignora.
    }
  }

  return null
}

const ADMIN_ROLES = ['owner', 'admin', 'juridico', 'financeiro', 'atendimento'] as const

export async function requireAdmin(
  supabase: SupabaseClient,
  request: Request,
): Promise<AdminActor> {
  const token = readAdminToken(request)
  if (!token) throw fail.unauthorized('Autenticação obrigatória.')

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    throw fail.unauthorized('Autenticação obrigatória.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, active')
    .eq('id', userData.user.id)
    .maybeSingle<{
      id: string
      email: string
      full_name: string
      role: string
      active: boolean
    }>()

  if (profileError) {
    console.error('[auth] falha ao consultar profile:', profileError.message)
    throw fail.internal()
  }

  if (!profile || !profile.active) {
    throw fail.forbidden('Usuário sem acesso ativo ao painel.')
  }

  if (!(ADMIN_ROLES as readonly string[]).includes(profile.role)) {
    throw fail.forbidden('Papel sem acesso ao painel.')
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  }
}

export function requireCronSecret(request: Request): void {
  const expected = Deno.env.get('CRON_SECRET') ?? ''
  if (!expected) {
    // Sem segredo configurado o worker não pode rodar: não aceitamos chamada anônima.
    throw fail.unavailable('Worker não configurado.')
  }

  const provided = request.headers.get('x-cron-secret')
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw fail.unauthorized('Credencial do worker inválida.')
  }
}

export function requireSecretHeader(
  request: Request,
  headerName: string,
  expected: string,
): void {
  const provided = request.headers.get(headerName)
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw fail.unauthorized('Assinatura do webhook inválida.')
  }
}

export function requireBearerSecret(request: Request, expected: string): void {
  const header = request.headers.get('authorization') ?? ''
  const provided = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw fail.unauthorized('Assinatura do webhook inválida.')
  }
}

/** Comparação em tempo constante para segredos de tamanho arbitrário. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return diff === 0
}
