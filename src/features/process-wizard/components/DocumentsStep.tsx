import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react'
import type { ContractProcess } from '@/features/process'
import { DocumentUpload } from '@/features/process-status/components/DocumentUpload'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'

interface DocumentsStepProps {
  token: string
  process: ContractProcess
  onUpdated: (process: ContractProcess) => void
  onBack: () => void
  canGoBack: boolean
}

export function DocumentsStep({
  token,
  process,
  onUpdated,
  onBack,
  canGoBack,
}: DocumentsStepProps) {
  const required = process.documents.filter((document) => document.required)
  const uploaded = required.filter((document) =>
    ['ENVIADO', 'PROCESSANDO'].includes(document.status),
  )
  const complete = process.documentsStatus === 'COMPLETA'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 border border-border bg-paper-alt/40 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
          <FileText className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[0.9rem] font-bold text-ink" role="status" aria-live="polite">
            {complete
              ? 'Documentos completos'
              : `${uploaded.length} de ${required.length} obrigatórios enviados`}
          </p>
          <p className="text-[0.8rem] leading-relaxed text-text-2">
            {complete
              ? 'Tudo certo. O processo foi concluído e a equipe dará sequência ao caso.'
              : 'Envie os arquivos abaixo. Você pode substituir ou remover antes de concluir.'}
          </p>
        </div>
      </div>

      <DocumentUpload
        token={token}
        process={process}
        onUpdated={onUpdated}
        locked={false}
        unlockMessage=""
      />

      {complete ? (
        <Alert tone="success" title="Processo concluído">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            Recebemos seus dados, a assinatura, o pagamento e os documentos.
          </span>
        </Alert>
      ) : null}

      {canGoBack ? (
        <div className="border-t border-border pt-6">
          <Button variant="ghost" onClick={onBack} leftIcon={<ArrowLeft className="size-4" />}>
            Voltar
          </Button>
        </div>
      ) : null}
    </div>
  )
}
