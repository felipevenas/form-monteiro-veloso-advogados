import { isMockMode } from '@/shared/config/env'
import type { ProcessRepository } from './application/process-repository'
import { createHttpProcessRepository } from './infrastructure/http-process-repository'
import {
  createMockProcessRepository,
  type MockProcessRepository,
} from './infrastructure/mock/mock-process-repository'

const mockRepository: MockProcessRepository | null = isMockMode
  ? createMockProcessRepository()
  : null

export const processRepository: ProcessRepository =
  mockRepository ?? createHttpProcessRepository()

export const mockProcessRepository = mockRepository

export * from './domain'
export type {
  CheckoutResult,
  ProcessRepository,
  StartProcessInput,
  StartProcessResult,
  StartSignatureInput,
} from './application/process-repository'
export { ApiError } from './application/process-repository'
export {
  findMockProcessById,
  findMockProcessToken,
  listMockProcesses,
} from './infrastructure/mock/mock-process-repository'
