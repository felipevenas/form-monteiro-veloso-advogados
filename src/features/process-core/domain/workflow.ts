import {
  documentsStatusMeta,
  generalStatusMeta,
  paymentStatusMeta,
  signatureStatusMeta,
  unlockConditionLabel,
} from './status'
import type {
  ContractProcess,
  NextAction,
  ProcessTrack,
} from '../types'

const FROZEN_STATUSES = new Set([
  'CONTRATO_EM_GERACAO',
  'AGUARDANDO_ASSINATURA_CLIENTE',
  'AGUARDANDO_ASSINATURA_INTERNA',
  'AGUARDANDO_PAGAMENTO',
  'AGUARDANDO_DOCUMENTOS',
  'DOCUMENTOS_EM_PROCESSAMENTO',
  'DOCUMENTACAO_CONCLUIDA',
  'CONCLUIDO',
  'CANCELADO',
  'ERRO_REQUER_INTERVENCAO',
])

/** Depois do envio para assinatura, dados e contrato não são mais editáveis. */
export function isProcessFrozen(process: ContractProcess): boolean {
  return (
    FROZEN_STATUSES.has(process.generalStatus) ||
    process.signatureStatus !== 'NAO_GERADA'
  )
}

export function areDocumentsUnlocked(process: ContractProcess): boolean {
  if (process.generalStatus === 'CANCELADO') return false
  if (!process.completedSteps.includes('pagamento')) return false

  const signatureComplete = process.signatureStatus === 'ASSINADA_COMPLETA'
  const upfrontCents =
    (process.financial?.signalCents ?? 0) + (process.financial?.entryCents ?? 0)
  const paymentSatisfied =
    process.paymentStatus === 'PAGO' ||
    (process.paymentStatus === 'PARCIAL' && upfrontCents > 0)

  switch (process.product.unlockCondition) {
    case 'IMMEDIATE':
      return true
    case 'AFTER_SIGNATURE':
      return signatureComplete
    case 'AFTER_PAYMENT':
      return paymentSatisfied
    case 'AFTER_BOTH':
      return signatureComplete && paymentSatisfied
  }
}

export function deriveTracks(process: ContractProcess): ProcessTrack[] {
  const requiredDocs = process.documents.filter((document) => document.required)
  const storedRequiredDocs = requiredDocs.filter(
    (document) => document.status === 'ENVIADO' || document.status === 'PROCESSANDO',
  )
  const signedDocs = process.signature?.documents.filter((document) =>
    ['ASSINADA_CLIENTE', 'ASSINADA_COMPLETA'].includes(document.status),
  ).length

  const dataDone = process.completedSteps.includes('contrato')

  return [
    {
      key: 'dados',
      label: 'Dados',
      status: dataDone ? 'Concluído' : 'Em preenchimento',
      detail: dataDone ? 'Informações validadas' : 'Faltam informações',
      tone: dataDone ? 'success' : 'info',
    },
    {
      key: 'contrato',
      label: 'Contrato',
      status:
        process.signatureStatus === 'ASSINADA_COMPLETA'
          ? 'Assinado'
          : process.signature?.documents.length
            ? 'Gerado'
            : 'Aguardando',
      detail:
        process.signature?.documents.length
          ? `${signedDocs ?? 0} de ${process.signature.documents.length} documentos assinados`
          : 'Será gerado após a validação',
      tone:
        process.signatureStatus === 'ASSINADA_COMPLETA'
          ? 'success'
          : process.signature?.documents.length
            ? 'info'
            : 'neutral',
    },
    {
      key: 'assinatura',
      label: 'Assinatura',
      status: signatureStatusMeta[process.signatureStatus].label,
      detail:
        process.signatureStatus === 'ASSINADA_COMPLETA'
          ? 'Todas as assinaturas recebidas'
          : 'Acompanhe os links de assinatura',
      tone: signatureStatusMeta[process.signatureStatus].tone,
    },
    {
      key: 'pagamento',
      label: 'Pagamento',
      status: paymentStatusMeta[process.paymentStatus].label,
      detail:
        process.paymentStatus === 'PAGO'
          ? 'Pagamento confirmado'
          : 'Confirmação somente após o Asaas',
      tone: paymentStatusMeta[process.paymentStatus].tone,
    },
    {
      key: 'documentos',
      label: 'Documentos',
      status: documentsStatusMeta[process.documentsStatus].label,
      detail: requiredDocs.length
        ? `${storedRequiredDocs.length} de ${requiredDocs.length} obrigatórios enviados`
        : 'Nenhum documento exigido',
      tone: documentsStatusMeta[process.documentsStatus].tone,
    },
  ]
}

export function deriveNextAction(process: ContractProcess): NextAction {
  const status = process.generalStatus

  if (status === 'CANCELADO') {
    return {
      kind: 'CONTACT',
      title: 'Processo cancelado',
      description: 'Fale com a equipe para entender o que aconteceu e como retomar.',
      cta: null,
    }
  }

  if (status === 'ERRO_REQUER_INTERVENCAO' || status === 'DADOS_INVALIDOS') {
    return {
      kind: 'CONTACT',
      title: 'Precisamos falar com você',
      description: 'A equipe já foi avisada e vai entrar em contato para resolver a pendência.',
      cta: null,
    }
  }

  if (
    !process.completedSteps.includes('dados') ||
    !process.completedSteps.includes('contrato')
  ) {
    return {
      kind: 'FORM',
      title: 'Continue seu cadastro',
      description: 'Faltam informações para preparar o contrato.',
      cta: 'Continuar preenchimento',
    }
  }

  if (process.signatureStatus === 'RECUSADA' || process.signatureStatus === 'CANCELADA') {
    return {
      kind: 'CONTACT',
      title: 'Assinatura não concluída',
      description: 'Fale com a equipe para revisar o contrato e reenviar os documentos.',
      cta: null,
    }
  }

  if (process.signatureStatus === 'ASSINADA_CLIENTE') {
    return {
      kind: 'WAIT',
      title: 'Aguardando a assinatura da advogada',
      description:
        'Você já assinou. A Dra. Roberta assina em seguida e o pagamento é liberado automaticamente.',
      cta: null,
    }
  }

  const clientSigned = process.signatureStatus === 'ASSINADA_COMPLETA'

  if (!clientSigned) {
    const hasLink = process.signature?.documents.some((document) => document.signUrl)

    if (!hasLink || process.generalStatus === 'CONTRATO_EM_GERACAO') {
      return {
        kind: 'WAIT',
        title: 'Preparando seu contrato',
        description: 'Estamos gerando os documentos e enviando pelo WhatsApp. Esta página atualiza sozinha.',
        cta: null,
      }
    }

    return {
      kind: 'SIGN',
      title: 'Assine seu contrato',
      description: 'O contrato foi enviado para o seu WhatsApp. Conclua a assinatura para liberar o pagamento.',
      cta: 'Abrir assinatura',
    }
  }

  if (process.paymentStatus !== 'PAGO' && !areDocumentsUnlocked(process)) {
    return {
      kind: 'PAY',
      title: 'Conclua o pagamento',
      description: 'Pague no checkout do Asaas. A confirmação é automática e você volta para o formulário.',
      cta: 'Abrir checkout',
    }
  }

  if (!areDocumentsUnlocked(process)) {
    return {
      kind: 'WAIT',
      title: 'Documentos ainda bloqueados',
      description: unlockConditionLabel[process.product.unlockCondition],
      cta: null,
    }
  }

  if (process.documentsStatus !== 'COMPLETA') {
    return {
      kind: 'UPLOAD',
      title: 'Envie seus documentos',
      description: 'Anexe os arquivos obrigatórios para concluir o processo.',
      cta: 'Enviar documentos',
    }
  }

  return {
    kind: 'DONE',
    title: 'Processo concluído',
    description: 'Recebemos seus dados, assinaturas, pagamento e documentos.',
    cta: null,
  }
}

export function isProcessComplete(process: ContractProcess): boolean {
  return (
    (process.signatureStatus === 'ASSINADA_CLIENTE' ||
      process.signatureStatus === 'ASSINADA_COMPLETA') &&
    process.paymentStatus === 'PAGO' &&
    process.documentsStatus === 'COMPLETA'
  )
}

export function generalStatusLabel(status: ContractProcess['generalStatus']): string {
  return generalStatusMeta[status].label
}
