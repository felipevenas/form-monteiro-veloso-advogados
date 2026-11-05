import { useRef, useState } from 'react'
import { Check, FileText, Loader2, LockKeyhole, Trash2, Upload } from 'lucide-react'
import type { ContractProcess, DocumentState } from '@/features/process'
import { processRepository } from '@/features/process'
import { formatBytes } from '@/shared/lib/bytes'
import { formatTimestampDateBr } from '@/shared/utils/dates'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Alert } from '@/shared/ui/Alert'
import { cn } from '@/shared/lib/cn'

interface DocumentUploadProps {
  token: string
  process: ContractProcess
  onUpdated: (process: ContractProcess) => void
  locked: boolean
  unlockMessage: string
}

const statusMeta = {
  PENDENTE: { label: 'Pendente', tone: 'warning' as const },
  ENVIADO: { label: 'Recebido', tone: 'success' as const },
  PROCESSANDO: { label: 'Processando', tone: 'info' as const },
  ERRO: { label: 'Erro', tone: 'danger' as const },
}

export function DocumentUpload({
  token,
  process,
  onUpdated,
  locked,
  unlockMessage,
}: DocumentUploadProps) {
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleFile(document: DocumentState, file: File) {
    setError(null)

    if (!document.acceptedMimeTypes.includes(file.type)) {
      setError(`${document.label}: formato não aceito. Envie PDF, JPG ou PNG.`)
      return
    }

    if (file.size > document.maxSizeBytes) {
      setError(`${document.label}: o arquivo passa de ${formatBytes(document.maxSizeBytes)}.`)
      return
    }

    setUploadingId(document.id)

    try {
      const updated = await processRepository.uploadDocument(token, document.id, file)
      onUpdated(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o arquivo.')
    } finally {
      setUploadingId(null)
      const input = inputs.current[document.id]
      if (input) input.value = ''
    }
  }

  async function handleRemove(document: DocumentState) {
    setError(null)
    setRemovingId(document.id)

    try {
      const updated = await processRepository.removeDocument(token, document.id)
      onUpdated(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover o arquivo.')
    } finally {
      setRemovingId(null)
    }
  }

  if (locked) {
    return (
      <Alert tone="info" title="Documentos ainda bloqueados">
        <span className="flex items-center gap-2">
          <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
          {unlockMessage}
        </span>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <ul className="flex flex-col gap-3">
        {process.documents.map((document) => {
          const meta = statusMeta[document.status]
          const uploading = uploadingId === document.id
          const removing = removingId === document.id

          return (
            <li
              key={document.id}
              className={cn(
                'flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between',
                document.status === 'ENVIADO' ? 'border-[#bfe3d0] bg-success-soft/40' : 'border-border',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 grid size-9 shrink-0 place-items-center rounded-[2px] border',
                    document.status === 'ENVIADO'
                      ? 'border-success/30 bg-paper text-success'
                      : 'border-border bg-paper-alt text-text-2',
                  )}
                >
                  {document.status === 'ENVIADO' ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <FileText className="size-4" aria-hidden="true" />
                  )}
                </span>

                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[0.9rem] font-bold text-ink">{document.label}</p>
                    {document.required ? (
                      <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-danger">
                        obrigatório
                      </span>
                    ) : (
                      <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-field">
                        opcional
                      </span>
                    )}
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  </div>

                  {document.filename ? (
                    <p className="text-[0.76rem] text-text-2">
                      {document.filename}
                      {document.uploadedAt ? ` · ${formatTimestampDateBr(document.uploadedAt)}` : ''}
                    </p>
                  ) : (
                    <p className="max-w-[52ch] text-[0.78rem] leading-relaxed text-text-2">
                      {document.description} · até {formatBytes(document.maxSizeBytes)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
                {document.filename ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(document)}
                    disabled={removing || uploading}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-[2px] px-3 text-[0.76rem] font-bold text-danger transition hover:bg-danger-soft disabled:opacity-50"
                  >
                    {removing ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    )}
                    Remover
                  </button>
                ) : null}

                <label
                  className={cn(
                    'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[2px] border border-border-interactive px-3 text-[0.76rem] font-bold text-brand transition hover:bg-blue-50',
                    (uploading || removing) && 'pointer-events-none opacity-60',
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="size-3.5" aria-hidden="true" />
                  )}
                  {uploading ? 'Enviando…' : document.filename ? 'Substituir' : 'Anexar'}
                  <input
                    ref={(element) => {
                      inputs.current[document.id] = element
                    }}
                    type="file"
                    className="sr-only"
                    accept={document.acceptedMimeTypes.join(',')}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void handleFile(document, file)
                    }}
                  />
                </label>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
