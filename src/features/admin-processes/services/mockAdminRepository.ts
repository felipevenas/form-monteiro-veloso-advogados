import { maskCpf } from '@/shared/utils/cpf'
import {
  findMockProcessById,
  listMockProcesses,
  mockProcessRepository,
  processRepository,
  type ContractProcess,
} from '@/features/process'
import type { AdminProcessSummary, AdminRepository } from '../types'

export function createMockAdminRepository(): AdminRepository {
  return {
    async list() {
      if (listMockProcesses().length === 0) {
        await seedDemoProcesses()
      }

      return listMockProcesses().map(toSummary)
    },

    async get(id) {
      return findMockProcessById(id)
    },
  }
}

function toSummary(process: ContractProcess): AdminProcessSummary {
  return {
    id: process.id,
    publicCode: process.publicCode,
    clientName: process.client.fullName ?? 'Sem nome',
    cpfMasked: process.client.cpf ? maskCpf(process.client.cpf) : '—',
    productName: process.product.name,
    generalStatus: process.generalStatus,
    signatureStatus: process.signatureStatus,
    paymentStatus: process.paymentStatus,
    documentsStatus: process.documentsStatus,
    createdAt: process.createdAt,
    updatedAt: process.updatedAt,
  }
}

interface DemoPersona {
  fullName: string
  cpf: string
  email: string
  phone: string
  planId: string
  stage: 0 | 1 | 2
  maritalStatus: string
  profession: string
  address: {
    cep: string
    state: string
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
  }
  vehicle: {
    plate: string
    model: string
    institution: string
    contract: string
  }
}

const personas: DemoPersona[] = [
  {
    fullName: 'Ana Paula Souza',
    cpf: '52998224725',
    email: 'ana.souza@example.com',
    phone: '71999990001',
    planId: 'parcelado-pix-6x',
    stage: 0,
    maritalStatus: 'solteiro',
    profession: 'Professora',
    address: {
      cep: '40015000',
      state: 'BA',
      street: 'Rua Portugal',
      number: '17',
      complement: 'Apto 302',
      neighborhood: 'Comércio',
      city: 'Salvador',
    },
    vehicle: {
      plate: 'ABC1D23',
      model: 'Fiat Argo 1.0',
      institution: 'Banco Itaú',
      contract: 'IT-2025-99881',
    },
  },
  {
    fullName: 'Carlos Eduardo Lima',
    cpf: '11144477735',
    email: 'carlos.lima@example.com',
    phone: '71999990002',
    planId: 'avista-pix',
    stage: 1,
    maritalStatus: 'casado',
    profession: 'Motorista de aplicativo',
    address: {
      cep: '41700000',
      state: 'BA',
      street: 'Avenida Otávio Mangabeira',
      number: '1200',
      complement: '',
      neighborhood: 'Boca do Rio',
      city: 'Salvador',
    },
    vehicle: {
      plate: 'XYZ9A88',
      model: 'Chevrolet Onix 1.0',
      institution: 'Banco Santander',
      contract: 'ST-2024-55120',
    },
  },
  {
    fullName: 'Mariana Alves dos Santos',
    cpf: '12345678909',
    email: 'mariana.santos@example.com',
    phone: '71999990003',
    planId: 'parcelado-pix-6x',
    stage: 2,
    maritalStatus: 'divorciado',
    profession: 'Analista administrativa',
    address: {
      cep: '40290000',
      state: 'BA',
      street: 'Rua Chile',
      number: '45',
      complement: 'Sala 8',
      neighborhood: 'Centro',
      city: 'Salvador',
    },
    vehicle: {
      plate: 'KJH7C45',
      model: 'Hyundai HB20 1.0',
      institution: 'BV Financeira',
      contract: 'BV-2023-77410',
    },
  },
]

async function seedDemoProcesses(): Promise<void> {
  if (!mockProcessRepository) return

  for (const persona of personas) {
    try {
      const { token } = await processRepository.start({
        attribution: { utm_source: 'demonstracao' },
      })

      await processRepository.saveStep(token, 'dados', {
        fullName: persona.fullName,
        cpf: persona.cpf,
        email: persona.email,
        phone: persona.phone,
        maritalStatus: persona.maritalStatus,
        profession: persona.profession,
        nationality: 'Brasileira',
        address: persona.address,
      })

      await processRepository.saveStep(token, 'contrato', {
        extra: {
          vehicle_plate: persona.vehicle.plate,
          vehicle_model: persona.vehicle.model,
          finance_institution: persona.vehicle.institution,
          contract_number: persona.vehicle.contract,
        },
      })

      await processRepository.savePlan(token, persona.planId)
      await processRepository.startSignature(token, {
        planId: persona.planId,
        consentVersion: '2026-01',
        consentAccepted: true,
      })

      if (persona.stage >= 1) {
        await mockProcessRepository.simulate(token, 'sign')
      }

      if (persona.stage >= 2) {
        await mockProcessRepository.simulate(token, 'pay')
      }
    } catch {
      // Um seed com falha não deve impedir os demais.
    }
  }
}
