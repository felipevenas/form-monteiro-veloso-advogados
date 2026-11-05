import { env } from '@/shared/config/env'
import { supabase } from '@/shared/api/supabase'
import type { ContractProcess } from '@/features/process'
import type { AdminProcessSummary, AdminRepository } from '../types'

const API_BASE = env.supabaseUrl ? `${env.supabaseUrl}/functions/v1` : '/api'

export function createHttpAdminRepository(): AdminRepository {
  return {
    async list() {
      return request<AdminProcessSummary[]>('/api-admin/processes')
    },

    async get(id) {
      return request<ContractProcess | null>(`/api-admin/processes/${id}`)
    },
  }
}

async function request<T>(path: string): Promise<T> {
  if (!supabase) {
    throw new Error('Supabase não configurado.')
  }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Sessão expirada. Entre novamente.')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Não foi possível carregar os dados do painel.')
  }

  return (await response.json()) as T
}
