import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { isMockMode } from '@/shared/config/env'
import { supabase } from '@/shared/api/supabase'

export type AdminSessionStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AdminSession {
  status: AdminSessionStatus
  user: Pick<User, 'id' | 'email'> | null
}

const demoUser = {
  id: 'demo-admin',
  email: 'equipe@monteiroveloso.com',
} as Pick<User, 'id' | 'email'>

export function useAdminSession(): AdminSession {
  const [session, setSession] = useState<AdminSession>(() => {
    if (isMockMode) {
      return { status: 'authenticated', user: demoUser }
    }

    if (!supabase) {
      return { status: 'anonymous', user: null }
    }

    return { status: 'loading', user: null }
  })

  useEffect(() => {
    if (isMockMode || !supabase) return

    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(
        data.session
          ? { status: 'authenticated', user: data.session.user }
          : { status: 'anonymous', user: null },
      )
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(
        nextSession
          ? { status: 'authenticated', user: nextSession.user }
          : { status: 'anonymous', user: null },
      )
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return session
}
