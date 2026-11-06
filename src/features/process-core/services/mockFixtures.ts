import type {
  DocumentRequirement,
  DocumentState,
  FormStep,
  PaymentPlan,
  ProductService,
  ProductSnapshot,
  ServiceObjectType,
  ServiceSuccessMode,
  WizardStepId,
} from '../types'
import { formatBRL } from '@/shared/utils/money'

export const WIZARD_STEP_ORDER: readonly WizardStepId[] = [
  'dados',
  'contrato',
  'assinatura',
  'pagamento',
  'documentos',
]

const ufOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
].map((uf) => ({ value: uf, label: uf }))

export const pilotFormSchema: FormStep[] = [
  {
    id: 'dados',
    title: 'Seus dados',
    description: 'Dados pessoais, contato e endereço usados no contrato e nos documentos.',
    fields: [
      {
        name: 'fullName',
        label: 'Nome completo',
        type: 'text',
        required: true,
        autoComplete: 'name',
        placeholder: 'Como está no seu documento',
        maxLength: 160,
        colSpan: 2,
      },
      {
        name: 'cpf',
        label: 'CPF',
        type: 'cpf',
        required: true,
        autoComplete: 'off',
        placeholder: '000.000.000-00',
        maxLength: 14,
      },
      {
        name: 'phone',
        label: 'WhatsApp',
        type: 'tel',
        required: true,
        autoComplete: 'tel',
        placeholder: '(71) 99999-9999',
        hint: 'O contrato será enviado para este número.',
        maxLength: 20,
      },
      {
        name: 'email',
        label: 'E-mail',
        type: 'email',
        required: true,
        autoComplete: 'email',
        placeholder: 'voce@email.com',
        maxLength: 254,
        colSpan: 2,
      },
      {
        name: 'maritalStatus',
        label: 'Estado civil',
        type: 'select',
        required: true,
        options: [
          { value: 'solteiro', label: 'Solteiro(a)' },
          { value: 'casado', label: 'Casado(a)' },
          { value: 'divorciado', label: 'Divorciado(a)' },
          { value: 'viuvo', label: 'Viúvo(a)' },
          { value: 'uniao-estavel', label: 'União estável' },
        ],
      },
      {
        name: 'profession',
        label: 'Profissão',
        type: 'text',
        required: true,
        autoComplete: 'organization-title',
        placeholder: 'Ex.: Motorista de aplicativo',
        maxLength: 120,
      },
      {
        name: 'nationality',
        label: 'Nacionalidade',
        type: 'text',
        required: true,
        placeholder: 'Brasileira',
        maxLength: 80,
        colSpan: 2,
      },
      {
        name: 'address.cep',
        label: 'CEP',
        type: 'text',
        required: true,
        autoComplete: 'postal-code',
        placeholder: '00000-000',
        maxLength: 9,
      },
      {
        name: 'address.state',
        label: 'UF',
        type: 'select',
        required: true,
        options: ufOptions,
      },
      {
        name: 'address.street',
        label: 'Rua / avenida',
        type: 'text',
        required: true,
        autoComplete: 'address-line1',
        placeholder: 'Rua, avenida...',
        maxLength: 200,
        colSpan: 2,
      },
      {
        name: 'address.number',
        label: 'Número',
        type: 'text',
        required: true,
        placeholder: '17',
        maxLength: 20,
      },
      {
        name: 'address.complement',
        label: 'Complemento',
        type: 'text',
        required: false,
        placeholder: 'Apto, bloco, sala (opcional)',
        maxLength: 120,
      },
      {
        name: 'address.neighborhood',
        label: 'Bairro',
        type: 'text',
        required: true,
        placeholder: 'Bairro',
        maxLength: 120,
      },
      {
        name: 'address.city',
        label: 'Cidade',
        type: 'text',
        required: true,
        autoComplete: 'address-level2',
        placeholder: 'Salvador',
        maxLength: 120,
      },
    ],
  },
  {
    id: 'contrato',
    title: 'Contrato e pagamento',
    description: 'Informe o objeto do serviço e escolha o plano. O contrato sai com essas informações.',
    fields: [
      {
        name: 'extra.banco_instituicao_financeira',
        label: 'Banco / instituição financeira',
        type: 'text',
        required: true,
        placeholder: 'Ex.: Banco Itaú',
        maxLength: 160,
        visibleWhen: { objectType: 'BANK' },
        colSpan: 2,
      },
      {
        name: 'extra.ente_federativo_e_lei_aplicavel',
        label: 'Ente federativo e lei aplicável',
        type: 'text',
        required: true,
        placeholder: 'Ex.: União — Lei 14.431/2022',
        maxLength: 200,
        visibleWhen: { objectType: 'PUBLIC_ENTITY' },
        colSpan: 2,
      },
      {
        name: 'extra.descricao_adicional_do_objeto',
        label: 'Descrição adicional do objeto',
        type: 'textarea',
        required: false,
        placeholder: 'Detalhes que ajudem a equipe a preparar o contrato (opcional)',
        maxLength: 2000,
        colSpan: 2,
      },
    ],
  },
  {
    id: 'assinatura',
    title: 'Assinatura do contrato',
    description: 'Enviamos o contrato para o seu WhatsApp. O avanço é liberado após a assinatura.',
    fields: [],
  },
  {
    id: 'pagamento',
    title: 'Pagamento',
    description: 'Pague no checkout do Asaas. A confirmação é automática e você volta para o formulário.',
    fields: [],
  },
  {
    id: 'documentos',
    title: 'Documentos',
    description: 'Anexe os documentos obrigatórios para concluir o processo.',
    fields: [],
  },
]

interface ServiceSeed {
  id: string
  code: string
  name: string
  description: string
  totalCents: number
  groupNumber: number
  objectType: ServiceObjectType
  successMode: ServiceSuccessMode
  kitCode: string
}

const serviceSeeds: ServiceSeed[] = [
  {
    id: 'srv-01',
    code: 'revisional-contrato-veiculo',
    name: 'Revisional de Contrato de Veículo',
    description:
      'Auditoria de juros, tarifas e seguros do contrato de veículo, com pedido de revisão das cláusulas abusivas.',
    totalCents: 420_000,
    groupNumber: 1,
    objectType: 'BANK',
    successMode: 'REDUCAO',
    kitCode: 'ZAPSIGN_CONTRATO_01',
  },
  {
    id: 'srv-02',
    code: 'defesa-busca-apreensao',
    name: 'Defesa de Busca e Apreensão',
    description:
      'Defesa em ação de busca e apreensão, com análise do contrato e das cláusulas de mora.',
    totalCents: 350_000,
    groupNumber: 1,
    objectType: 'BANK',
    successMode: 'CLAUSULA_BRANCA',
    kitCode: 'ZAPSIGN_CONTRATO_02',
  },
  {
    id: 'srv-03',
    code: 'defesa-execucao-monitoria',
    name: 'Defesa em Execução ou Monitória',
    description:
      'Defesa em execução ou ação monitória, com revisão do título e dos valores cobrados.',
    totalCents: 380_000,
    groupNumber: 1,
    objectType: 'BANK',
    successMode: 'CLAUSULA_BRANCA',
    kitCode: 'ZAPSIGN_CONTRATO_03',
  },
  {
    id: 'srv-04',
    code: 'revisional-produtos-conta-corrente',
    name: 'Revisional de Produtos de Conta Corrente',
    description: 'Revisão de tarifas, juros e encargos cobrados em conta corrente.',
    totalCents: 400_000,
    groupNumber: 1,
    objectType: 'BANK',
    successMode: 'REDUCAO',
    kitCode: 'ZAPSIGN_CONTRATO_04',
  },
  {
    id: 'srv-05',
    code: 'limitacao-consignados',
    name: 'Limitação dos Consignados',
    description:
      'Ação para limitar descontos de empréstimo consignado ao limite legal do contracheque.',
    totalCents: 450_000,
    groupNumber: 2,
    objectType: 'PUBLIC_ENTITY',
    successMode: 'REDUCAO',
    kitCode: 'ZAPSIGN_CONTRATO_05',
  },
  {
    id: 'srv-06',
    code: 'superendividamento',
    name: 'Superendividamento',
    description:
      'Reorganização de dívidas e negociação com credores para preservar o mínimo existencial.',
    totalCents: 500_000,
    groupNumber: 2,
    objectType: 'NONE',
    successMode: 'REDUCAO',
    kitCode: 'ZAPSIGN_CONTRATO_06',
  },
  {
    id: 'srv-07',
    code: 'desbloqueio-conta-bancaria',
    name: 'Desbloqueio de Conta Bancária',
    description: 'Pedido de desbloqueio de conta e restituição de valores retidos indevidamente.',
    totalCents: 300_000,
    groupNumber: 3,
    objectType: 'BANK',
    successMode: 'CLAUSULA_BRANCA',
    kitCode: 'ZAPSIGN_CONTRATO_07',
  },
  {
    id: 'srv-08',
    code: 'acao-indenizatoria-geral',
    name: 'Ação Indenizatória Geral',
    description:
      'Ação de indenização por dano moral ou material em relações de consumo e bancárias.',
    totalCents: 350_000,
    groupNumber: 3,
    objectType: 'BANK',
    successMode: 'CLAUSULA_BRANCA',
    kitCode: 'ZAPSIGN_CONTRATO_08',
  },
  {
    id: 'srv-09',
    code: 'solicitacoes-bacen-procon',
    name: 'Solicitações Administrativas no BACEN e PROCON',
    description: 'Solicitações e reclamações administrativas contra instituições financeiras.',
    totalCents: 250_000,
    groupNumber: 4,
    objectType: 'BANK',
    successMode: 'CLAUSULA_ADMINISTRATIVA',
    kitCode: 'ZAPSIGN_CONTRATO_09',
  },
  {
    id: 'srv-10',
    code: 'laudo-tecnico-contrato',
    name: 'Laudo Técnico do Contrato + Solicitação de Contrato',
    description: 'Elaboração de laudo técnico e solicitação das vias do contrato ao banco.',
    totalCents: 200_000,
    groupNumber: 4,
    objectType: 'BANK',
    successMode: 'CLAUSULA_ADMINISTRATIVA',
    kitCode: 'ZAPSIGN_CONTRATO_10',
  },
  {
    id: 'srv-11',
    code: 'cancelamento-debito-automatico',
    name: 'Cancelamento de Débito Automático + Solicitação dos Contratos',
    description: 'Cancelamento de débito automático e pedido das vias contratuais.',
    totalCents: 220_000,
    groupNumber: 4,
    objectType: 'BANK',
    successMode: 'CLAUSULA_ADMINISTRATIVA',
    kitCode: 'ZAPSIGN_CONTRATO_11',
  },
  {
    id: 'srv-12',
    code: 'cancelamento-associacoes',
    name: 'Cancelamento de Associações',
    description: 'Cancelamento de associações e cobranças não autorizadas vinculadas ao contrato.',
    totalCents: 240_000,
    groupNumber: 4,
    objectType: 'BANK',
    successMode: 'CLAUSULA_ADMINISTRATIVA',
    kitCode: 'ZAPSIGN_CONTRATO_12',
  },
]

export const pilotServices: ProductService[] = serviceSeeds.map((seed) => ({
  ...seed,
  requiresVehicleData: false,
}))

const avistaPlans: PaymentPlan[] = pilotServices.map((service) => {
  const signalCents = Math.round(service.totalCents / 10)

  return {
    id: `${service.id}-avista`,
    serviceId: service.id,
    label: 'À vista no Pix',
    description: `Sinal de ${formatBRL(signalCents)} e saldo de ${formatBRL(
      service.totalCents - signalCents,
    )} no vencimento.`,
    method: 'PIX',
    mode: 'AVISTA',
    totalCents: service.totalCents,
    signalCents,
    entryCents: 0,
    installmentCount: 1,
    dueDateRule: { type: 'FIXED_DAY', day: 10 },
  }
})

const revisionalVeiculoSignalCents = 42_000
const revisionalVeiculoInstallments = 6
const revisionalVeiculoTotalCents = 420_000

export const pilotPaymentPlans: PaymentPlan[] = [
  ...avistaPlans,
  {
    id: 'srv-01-6x',
    serviceId: 'srv-01',
    label: 'Sinal + 6 parcelas',
    description: `Sinal de ${formatBRL(revisionalVeiculoSignalCents)} e ${revisionalVeiculoInstallments} parcelas de ${formatBRL(
      (revisionalVeiculoTotalCents - revisionalVeiculoSignalCents) /
        revisionalVeiculoInstallments,
    )}.`,
    method: 'PIX',
    mode: 'PARCELADO',
    totalCents: revisionalVeiculoTotalCents,
    signalCents: revisionalVeiculoSignalCents,
    entryCents: 0,
    installmentCount: revisionalVeiculoInstallments,
    dueDateRule: { type: 'FIXED_DAY', day: 10 },
  },
]

export const pilotDocumentRequirements: DocumentRequirement[] = [
  {
    id: 'rg-cnh',
    label: 'RG ou CNH',
    description: 'Documento de identidade com foto, legível e sem cortes.',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  {
    id: 'comprovante-residencia',
    label: 'Comprovante de residência',
    description: 'Conta de água, luz ou telefone dos últimos 90 dias.',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  {
    id: 'contrato-financiamento',
    label: 'Contrato de financiamento',
    description: 'Contrato do banco ou financeira, com todas as páginas.',
    required: true,
    acceptedMimeTypes: ['application/pdf'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  {
    id: 'documento-veiculo',
    label: 'Documento do veículo',
    description: 'CRLV ou documento equivalente. Opcional, mas ajuda na análise.',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeBytes: 10 * 1024 * 1024,
  },
]

export const pilotProduct: ProductSnapshot = {
  id: 'prod-pilot-assessoria-juridica',
  slug: 'assessoria-juridica',
  name: 'Assessoria Jurídica',
  shortName: 'Assessoria',
  description: 'Esteira de contratos da Monteiro Veloso Advogados.',
  version: 2,
  contractLabel: 'Contrato de prestação de serviços advocatícios',
  unlockCondition: 'AFTER_BOTH',
  formSchema: pilotFormSchema,
  services: pilotServices,
  paymentPlans: pilotPaymentPlans,
}

export function createDocumentStates(): DocumentState[] {
  return pilotDocumentRequirements.map((requirement) => ({
    ...requirement,
    status: 'PENDENTE',
    filename: null,
    uploadedAt: null,
  }))
}
