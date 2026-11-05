import { Link } from 'react-router-dom'
import type { AdminProcessSummary } from '@/features/admin-processes'
import {
  documentsStatusMeta,
  generalStatusMeta,
  paymentStatusMeta,
  signatureStatusMeta,
} from '@/features/process'
import { routes } from '@/shared/config/routes'
import { formatDateTimeBr } from '@/shared/domain/dates'
import { StatusBadge } from '@/shared/ui/StatusBadge'

interface ProcessTableProps {
  processes: AdminProcessSummary[]
  compact?: boolean
}

export function ProcessTable({ processes, compact = false }: ProcessTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] text-left text-[0.82rem]">
        <thead className="bg-paper-alt text-[0.64rem] uppercase tracking-[0.1em] text-text-2">
          <tr>
            <th className="px-4 py-3 font-bold">Cliente</th>
            <th className="px-4 py-3 font-bold">Protocolo</th>
            {!compact ? <th className="px-4 py-3 font-bold">Produto</th> : null}
            <th className="px-4 py-3 font-bold">Etapa</th>
            <th className="px-4 py-3 font-bold">Assinatura</th>
            <th className="px-4 py-3 font-bold">Pagamento</th>
            <th className="px-4 py-3 font-bold">Documentos</th>
            <th className="px-4 py-3 text-right font-bold">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {processes.map((process) => (
            <tr key={process.id} className="border-t border-border hover:bg-blue-50/40">
              <td className="px-4 py-3">
                <Link
                  to={routes.admin.process(process.id)}
                  className="font-semibold text-ink underline-offset-4 hover:underline"
                >
                  {process.clientName}
                </Link>
                <p className="text-[0.7rem] text-text-2">{process.cpfMasked}</p>
              </td>
              <td className="px-4 py-3 font-mono text-[0.72rem] text-text-2">
                {process.publicCode}
              </td>
              {!compact ? (
                <td className="max-w-[200px] px-4 py-3 text-text-2">{process.productName}</td>
              ) : null}
              <td className="px-4 py-3">
                <StatusBadge tone={generalStatusMeta[process.generalStatus].tone}>
                  {generalStatusMeta[process.generalStatus].label}
                </StatusBadge>
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={signatureStatusMeta[process.signatureStatus].tone}>
                  {signatureStatusMeta[process.signatureStatus].label}
                </StatusBadge>
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={paymentStatusMeta[process.paymentStatus].tone}>
                  {paymentStatusMeta[process.paymentStatus].label}
                </StatusBadge>
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={documentsStatusMeta[process.documentsStatus].tone}>
                  {documentsStatusMeta[process.documentsStatus].label}
                </StatusBadge>
              </td>
              <td className="px-4 py-3 text-right text-[0.72rem] text-text-2">
                {formatDateTimeBr(process.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
