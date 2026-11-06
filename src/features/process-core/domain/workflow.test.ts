import { describe, expect, it } from 'vitest'
import {
  areDocumentsUnlocked,
  deriveNextAction,
  deriveTracks,
  isProcessComplete,
} from './workflow'
import type { ContractProcess, DocumentState } from '../types'

const documents: DocumentState[] = [
  {
    id: 'rg',
    label: 'RG',
    description: '',
    required: true,
    acceptedMimeTypes: ['application/pdf'],
    maxSizeBytes: 1000,
    status: 'PENDENTE',
    filename: null,
    uploadedAt: null,
  },
  {
    id: 'opcional',
    label: 'Opcional',
    description: '',
    required: false,
    acceptedMimeTypes: ['application/pdf'],
    maxSizeBytes: 1000,
    status: 'PENDENTE',
    filename: null,
    uploadedAt: null,
  },
]

function makeProcess(overrides: Partial<ContractProcess> = {}): ContractProcess {
  return {
    id: 'p1',
    publicCode: 'MV-TEST-0001',
    createdAt: '2026-10-28T10:00:00.000Z',
    updatedAt: '2026-10-28T10:00:00.000Z',
    completedAt: null,
    product: {
      id: 'prod',
      slug: 'teste',
      name: 'Teste',
      shortName: 'Teste',
      description: '',
      version: 1,
      contractLabel: 'Contrato',
      unlockCondition: 'AFTER_BOTH',
      formSchema: [],
      services: [],
      paymentPlans: [],
    },
    client: { fullName: 'Ana' },
    generalStatus: 'AGUARDANDO_ASSINATURA_CLIENTE',
    signatureStatus: 'NAO_GERADA',
    paymentStatus: 'NAO_CRIADO',
    documentsStatus: 'NAO_INICIADA',
    financial: {
      planId: 'plano',
      method: 'PIX',
      totalCents: 350000,
      signalCents: 50000,
      entryCents: 0,
      installments: [{ number: 1, dueDate: '2026-11-10', amountCents: 300000 }],
      dueDateRule: { type: 'FIXED_DAY', day: 10 },
      computedAt: '2026-10-28T10:00:00.000Z',
    },
    selectedServiceId: null,
    selectedPlanId: 'plano',
    currentStep: 'assinatura',
    completedSteps: ['dados', 'contrato'],
    signature: null,
    payment: null,
    documents,
    consent: { version: '2026-10', acceptedAt: '2026-10-28T10:00:00.000Z' },
    attribution: {},
    events: [],
    ...overrides,
  }
}

describe('areDocumentsUnlocked', () => {
  it('mantém bloqueado até assinatura e pagamento no AFTER_BOTH', () => {
    expect(areDocumentsUnlocked(makeProcess())).toBe(false)

    expect(
      areDocumentsUnlocked(
        makeProcess({
          signatureStatus: 'ASSINADA_COMPLETA',
          paymentStatus: 'PENDENTE',
          completedSteps: ['dados', 'contrato', 'assinatura'],
        }),
      ),
    ).toBe(false)

    expect(
      areDocumentsUnlocked(
        makeProcess({
          signatureStatus: 'ASSINADA_COMPLETA',
          paymentStatus: 'PAGO',
          completedSteps: ['dados', 'contrato', 'assinatura', 'pagamento'],
          currentStep: 'documentos',
        }),
      ),
    ).toBe(true)
  })

  it('libera parcialmente quando o sinal foi pago', () => {
    expect(
      areDocumentsUnlocked(
        makeProcess({
          product: { ...makeProcess().product, unlockCondition: 'AFTER_PAYMENT' },
          paymentStatus: 'PARCIAL',
          completedSteps: ['dados', 'contrato', 'assinatura', 'pagamento'],
          currentStep: 'documentos',
        }),
      ),
    ).toBe(true)
  })

  it('não libera com dados incompletos', () => {
    expect(
      areDocumentsUnlocked(
        makeProcess({
          product: { ...makeProcess().product, unlockCondition: 'IMMEDIATE' },
          completedSteps: ['dados'],
        }),
      ),
    ).toBe(false)
  })
})

describe('deriveNextAction', () => {
  it('pede para continuar o formulário', () => {
    const action = deriveNextAction(
      makeProcess({ completedSteps: ['dados'], currentStep: 'dados' }),
    )
    expect(action.kind).toBe('FORM')
  })

  it('pede assinatura quando há link', () => {
    const action = deriveNextAction(
      makeProcess({
        signatureStatus: 'PENDENTE',
        signature: {
          status: 'PENDENTE',
          documents: [
            { id: 'd1', name: 'Contrato', status: 'PENDENTE', signUrl: 'https://x', signedAt: null },
          ],
        },
      }),
    )

    expect(action.kind).toBe('SIGN')
  })

  it('aguarda quando os documentos ainda estão sendo gerados', () => {
    const action = deriveNextAction(
      makeProcess({
        signatureStatus: 'NAO_GERADA',
        generalStatus: 'CONTRATO_EM_GERACAO',
      }),
    )
    expect(action.kind).toBe('WAIT')
  })

  it('pede pagamento após assinatura completa', () => {
    const action = deriveNextAction(
      makeProcess({
        signatureStatus: 'ASSINADA_COMPLETA',
        paymentStatus: 'PENDENTE',
        completedSteps: ['dados', 'contrato', 'assinatura'],
      }),
    )
    expect(action.kind).toBe('PAY')
  })

  it('pede documentos após assinatura e pagamento', () => {
    const action = deriveNextAction(
      makeProcess({
        signatureStatus: 'ASSINADA_COMPLETA',
        paymentStatus: 'PAGO',
        completedSteps: ['dados', 'contrato', 'assinatura', 'pagamento'],
        currentStep: 'documentos',
      }),
    )
    expect(action.kind).toBe('UPLOAD')
  })

  it('conclui quando tudo foi confirmado', () => {
    const process = makeProcess({
      signatureStatus: 'ASSINADA_COMPLETA',
      paymentStatus: 'PAGO',
      documentsStatus: 'COMPLETA',
      documents: documents.map((document) => ({ ...document, status: 'ENVIADO' })),
      completedSteps: ['dados', 'contrato', 'assinatura', 'pagamento', 'documentos'],
      currentStep: 'documentos',
      generalStatus: 'CONCLUIDO',
    })

    expect(deriveNextAction(process).kind).toBe('DONE')
    expect(isProcessComplete(process)).toBe(true)
  })
})

describe('deriveTracks', () => {
  it('conta apenas documentos obrigatórios', () => {
    const process = makeProcess({
      documents: [
        { ...documents[0]!, status: 'ENVIADO', filename: 'rg.pdf' },
        documents[1]!,
      ],
    })

    const track = deriveTracks(process).find((item) => item.key === 'documentos')
    expect(track?.detail).toBe('1 de 1 obrigatórios enviados')
  })
})
