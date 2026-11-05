import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { ContractProcess } from '@/features/process'
import { processRepository } from '@/features/process'
import { formatPhone } from '@/shared/domain/phone'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'

interface SignatureStepProps {
  token: string
  process: ContractProcess
  onUpdated: (process: ContractProcess) => void
  onContinue: () => void
  onBack: () => void
  canGoBack: boolean
  onRetry: () => void
  retrying: boolean
  error: string | null
}

export function SignatureStep({
  token,
  process,
  onUpdated,
  onContinue,
  onBack,
  canGoBack,
  onRetry,
  retrying,
  error,
}: SignatureStepProps) {
  const [simulating, setSimulating] = useState(false)
  const documents = process.signature?.documents ?? []
  const signed =
    process.signatureStatus === 'ASSINADA_CLIENTE' ||
    process.signatureStatus === 'ASSINADA_COMPLETA'
  const generating =
    process.generalStatus === 'CONTRATO_EM_GERACAO' || documents.length === 0
  const refused = process.signatureStatus === 'RECUSADA'
  const canSimulate = Boolean(processRepository.simulate) && !signed && !refused

  async function handleSimulate() {
    if (!processRepository.simulate) return
    setSimulating(true)
    try {
      onUpdated(await processRepository.simulate(token, 'sign'))
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className={cn(
          'flex items-start gap-3 border p-4',
          signed
            ? 'border-success/40 bg-success-soft/40'
            : 'border-border bg-paper-alt/40',
        )}
      >
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full',
            signed ? 'bg-success-soft text-success' : 'bg-blue-50 text-brand',
          )}
          aria-hidden="true"
        >
          {signed ? (
            <CheckCircle2 className="size-4" />
          ) : generating || refused ? (
            <MessageCircle className="size-4" />
          ) : (
            <Loader2 className="size-4 animate-spin" />
          )}
        </span>

        <div className="flex flex-col gap-1">
          <p className="text-[0.9rem] font-bold text-ink" role="status" aria-live="polite">
            {signed
              ? 'Contrato assinado'
              : refused
                ? 'Assinatura recusada'
                : generating
                  ? 'Preparando e enviando seu contrato…'
                  : 'Aguardando sua assinatura'}
          </p>
          <p className="text-[0.8rem] leading-relaxed text-text-2">
            {signed
              ? 'A próxima etapa é o pagamento no checkout do Asaas.'
              : refused
                ? 'Fale com a equipe para revisar o contrato e reenviar.'
                : generating
                  ? 'Assim que o contrato for gerado, o link chega no seu WhatsApp e fica disponível abaixo.'
                  : `Enviamos o contrato para ${formatPhone(process.client.phone ?? '')}. Abra o link no WhatsApp e conclua a assinatura.`}
          </p>
        </div>
      </div>

      {documents.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border border border-border">
          {documents.map((document) => {
            const done =
              document.status === 'ASSINADA_CLIENTE' ||
              document.status === 'ASSINADA_COMPLETA'
            return (
              <li
                key={document.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full border text-[0.62rem] font-bold',
                      done
                        ? 'border-success/40 bg-success-soft text-success'
                        : 'border-border-interactive text-field',
                    )}
                    aria-hidden="true"
                  >
                    {done ? <CheckCircle2 className="size-3.5" /> : null}
                  </span>
                  <span className="text-[0.84rem] font-semibold text-ink">{document.name}</span>
                </div>

                {document.signUrl && !done ? (
                  <a
                    href={document.signUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-[2px] px-2 text-[0.78rem] font-bold text-brand underline underline-offset-4 sm:self-auto"
                  >
                    Abrir assinatura
                  </a>
                ) : (
                  <span className="text-[0.72rem] font-semibold text-text-2">
                    {done ? 'Assinado' : 'Aguardando'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {generating ? (
        <Alert tone="info" title="Contrato em preparação">
          <p>
            Estamos gerando os documentos e enviando o link pelo WhatsApp. Se demorar, use o botão
            abaixo para tentar novamente.
          </p>
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {canSimulate ? (
        <div className="border border-dashed border-border-interactive p-3">
          <p className="text-[0.7rem] text-field">
            Modo de demonstração: simule a assinatura para testar a liberação do pagamento.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void handleSimulate()}
            loading={simulating}
          >
            Simular assinatura
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        {canGoBack ? (
          <Button variant="ghost" onClick={onBack} leftIcon={<ArrowLeft className="size-4" />}>
            Voltar
          </Button>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!signed ? (
            <Button
              variant="outline"
              onClick={onRetry}
              loading={retrying}
              leftIcon={<RefreshCw className="size-4" />}
            >
              Reenviar contrato
            </Button>
          ) : null}

          <Button
            onClick={onContinue}
            disabled={!signed}
            rightIcon={<ArrowRight className="size-4" />}
          >
            Prosseguir para pagamento
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-field">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        A assinatura é feita no ambiente seguro do ZapSign. A equipe nunca pede senha ou código por
        WhatsApp.
      </p>
    </div>
  )
}
