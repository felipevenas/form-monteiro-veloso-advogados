import type {
  DocumentsStatus,
  GeneralStatus,
  PaymentStatus,
  SignatureStatus,
  TrackTone,
  UnlockCondition,
} from './types'

interface StatusMeta {
  label: string
  tone: TrackTone
}

export const generalStatusMeta: Record<GeneralStatus, StatusMeta> = {
  INICIADO: { label: 'Iniciado', tone: 'info' },
  DADOS_PENDENTES: { label: 'Dados pendentes', tone: 'info' },
  VALIDANDO_DADOS: { label: 'Validando dados', tone: 'info' },
  DADOS_INVALIDOS: { label: 'Dados inválidos', tone: 'danger' },
  PRONTO_PARA_CONTRATO: { label: 'Pronto para contrato', tone: 'info' },
  CONTRATO_EM_GERACAO: { label: 'Contrato em geração', tone: 'info' },
  AGUARDANDO_ASSINATURA_CLIENTE: { label: 'Aguardando sua assinatura', tone: 'warning' },
  AGUARDANDO_ASSINATURA_INTERNA: { label: 'Aguardando assinatura interna', tone: 'warning' },
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando pagamento', tone: 'warning' },
  AGUARDANDO_DOCUMENTOS: { label: 'Aguardando documentos', tone: 'warning' },
  DOCUMENTOS_EM_PROCESSAMENTO: { label: 'Processando documentos', tone: 'info' },
  DOCUMENTACAO_CONCLUIDA: { label: 'Documentação concluída', tone: 'success' },
  CONCLUIDO: { label: 'Concluído', tone: 'success' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
  ERRO_REQUER_INTERVENCAO: { label: 'Requer intervenção', tone: 'danger' },
}

export const signatureStatusMeta: Record<SignatureStatus, StatusMeta> = {
  NAO_GERADA: { label: 'Não gerada', tone: 'neutral' },
  PENDENTE: { label: 'Pendente', tone: 'warning' },
  ASSINADA_CLIENTE: { label: 'Assinada pelo cliente', tone: 'info' },
  ASSINADA_COMPLETA: { label: 'Assinatura completa', tone: 'success' },
  RECUSADA: { label: 'Recusada', tone: 'danger' },
  CANCELADA: { label: 'Cancelada', tone: 'danger' },
}

export const paymentStatusMeta: Record<PaymentStatus, StatusMeta> = {
  NAO_CRIADO: { label: 'Não criado', tone: 'neutral' },
  PENDENTE: { label: 'Pendente', tone: 'warning' },
  PARCIAL: { label: 'Parcial', tone: 'warning' },
  PAGO: { label: 'Pago', tone: 'success' },
  VENCIDO: { label: 'Vencido', tone: 'danger' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
  ESTORNADO: { label: 'Estornado', tone: 'danger' },
}

export const documentsStatusMeta: Record<DocumentsStatus, StatusMeta> = {
  NAO_INICIADA: { label: 'Não iniciada', tone: 'neutral' },
  PENDENTE: { label: 'Pendente', tone: 'warning' },
  EM_ENVIO: { label: 'Em envio', tone: 'info' },
  PARCIAL: { label: 'Parcial', tone: 'warning' },
  COMPLETA: { label: 'Completa', tone: 'success' },
  ERRO: { label: 'Erro', tone: 'danger' },
}

export const unlockConditionLabel: Record<UnlockCondition, string> = {
  IMMEDIATE: 'Documentos liberados após o preenchimento',
  AFTER_SIGNATURE: 'Documentos liberados após a assinatura',
  AFTER_PAYMENT: 'Documentos liberados após o pagamento',
  AFTER_BOTH: 'Documentos liberados após assinatura e pagamento',
}
