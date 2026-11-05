import { isMockMode } from '@/shared/config/env'
import type { AdminRepository } from './application/admin-repository'
import { createHttpAdminRepository } from './infrastructure/http-admin-repository'
import { createMockAdminRepository } from './infrastructure/mock-admin-repository'

export const adminRepository: AdminRepository = isMockMode
  ? createMockAdminRepository()
  : createHttpAdminRepository()

export type { AdminMetrics, AdminProcessSummary, AdminRepository } from './application/admin-repository'
