import { isMockMode } from '@/shared/config/env'
import type { ProcessRepository } from './types'
import { createHttpProcessRepository } from './services/processRepository'
import {
  createMockProcessRepository,
  type MockProcessRepository,
} from './services/mockProcessRepository'

const mockRepository: MockProcessRepository | null = isMockMode
  ? createMockProcessRepository()
  : null

export const processRepository: ProcessRepository =
  mockRepository ?? createHttpProcessRepository()

export const mockProcessRepository = mockRepository

export * from './domain'
export * from './types'
export { ApiError } from './services/apiError'
export {
  findMockProcessById,
  findMockProcessToken,
  listMockProcesses,
} from './services/mockProcessRepository'
