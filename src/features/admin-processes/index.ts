import { isMockMode } from '@/shared/config/env'
import type { AdminRepository } from './types'
import { createHttpAdminRepository } from './services/adminRepository'
import { createMockAdminRepository } from './services/mockAdminRepository'

export const adminRepository: AdminRepository = isMockMode
  ? createMockAdminRepository()
  : createHttpAdminRepository()

export type { AdminMetrics, AdminProcessSummary, AdminRepository } from './types'
