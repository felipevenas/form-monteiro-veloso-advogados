/**
 * API administrativa. Exige JWT do Supabase + profile ativo.
 * Toda escrita é auditada; a lista mascara CPF por padrão.
 */

import { createServiceClient } from '../_shared/http/auth.ts'
import { preflightResponse } from '../_shared/http/cors.ts'
import { fail } from '../_shared/http/errors.ts'
import { errorResponse, jsonResponse, readJsonBody } from '../_shared/http/json.ts'
import { matchParam, normalizePath, routePath } from '../_shared/http/router.ts'
import { requireAdmin } from '../_shared/http/auth.ts'
import { mapAdminSummary } from '../_shared/db/mappers.ts'
import { loadDto, enqueueJob, recordEvent } from '../_shared/services/process-service.ts'

const SENSITIVE_ROLES = new Set(['owner', 'admin', 'juridico', 'financeiro'])

Deno.serve(async (request) => {
  try {
    const preflight = preflightResponse(request)
    if (preflight) return preflight

    const supabase = createServiceClient()
    const path = normalizePath(routePath(request, 'api-admin'))

    const actor = await requireAdmin(supabase, request)

    if (path === '/processes' && request.method === 'GET') {
      return await listProcesses(request, supabase, actor.role)
    }

    if (path.startsWith('/processes/') && request.method === 'GET') {
      const id = matchParam(path, /^\/processes\/([^/]+)$/)
      if (!id) throw fail.notFound('Processo não encontrado.')
      return await getProcess(request, supabase, id, actor.role)
    }

    if (path.startsWith('/processes/') && path.endsWith('/actions') && request.method === 'POST') {
      const id = matchParam(path, /^\/processes\/([^/]+)\/actions$/)
      if (!id) throw fail.notFound('Processo não encontrado.')
      return await runAction(request, supabase, id, actor)
    }

    if (path === '/jobs' && request.method === 'GET') {
      return await listJobs(request, supabase)
    }

    if (path.startsWith('/jobs/') && path.endsWith('/retry') && request.method === 'POST') {
      const id = matchParam(path, /^\/jobs\/([^/]+)\/retry$/)
      if (!id) throw fail.notFound('Job não encontrado.')
      return await retryJob(request, supabase, id, actor)
    }

    if (path === '/alerts' && request.method === 'GET') {
      return await listAlerts(request, supabase)
    }

    return jsonResponse(
      request,
      { error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } },
      404,
    )
  } catch (error) {
    return errorResponse(request, error)
  }
})

async function listProcesses(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  role: string,
): Promise<Response> {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')?.trim() ?? ''
  const query = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const limit = clamp(Number(url.searchParams.get('limit') ?? 100), 1, 200)

  let dbQuery = supabase
    .from('contract_processes')
    .select(
      'id, public_code, general_status, signature_status, payment_status, documents_status, created_at, updated_at, clients(full_name, cpf), products(name)',
    )
    .order('updated_at', { ascending: false })
    .limit(200)

  if (status) dbQuery = dbQuery.eq('general_status', status)

  const { data, error } = await dbQuery

  if (error) {
    console.error('[admin] falha ao listar processos:', error.message)
    throw fail.internal()
  }

  const rows = (data ?? []) as unknown as Array<Parameters<typeof mapAdminSummary>[0]>
  const filtered = query
    ? rows.filter((row) => {
        const haystack = [
          row.public_code,
          row.clients?.full_name ?? '',
          row.products?.name ?? '',
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })
    : rows

  // A lista nunca devolve CPF completo, mesmo para papéis sensíveis.
  const summaries = filtered.slice(0, limit).map((row) => mapAdminSummary(row))
  void role

  return jsonResponse(request, summaries)
}

async function getProcess(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  id: string,
  role: string,
): Promise<Response> {
  const dto = await loadDto(supabase, id)
  const sensitive = SENSITIVE_ROLES.has(role)

  if (!sensitive) {
    dto.client = {
      ...dto.client,
      cpf: '',
      address: {
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
      },
    }
  }

  return jsonResponse(request, dto)
}

async function runAction(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  processId: string,
  actor: { id: string; role: string },
): Promise<Response> {
  const body = asObject(await readJsonBody(request))
  const action = String(body.action ?? '')
  const payload = asObject(body.payload)
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null

  if (!action) throw fail.invalidInput('Informe a ação.')

  if (action === 'RETRY_JOB') {
    const jobId = typeof payload.jobId === 'string' ? payload.jobId : ''
    if (!jobId) throw fail.invalidInput('Informe o job.')

    const { data, error } = await supabase
      .from('outbox_jobs')
      .update({
        status: 'PENDING',
        attempt_count: 0,
        next_attempt_at: null,
        locked_at: null,
        locked_by: null,
        last_error: null,
      })
      .eq('id', jobId)
      .eq('contract_process_id', processId)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (error) throw fail.internal()
    if (!data) throw fail.notFound('Job não encontrado para este processo.')
  } else if (action === 'PAUSE_AUTOMATION' || action === 'RESUME_AUTOMATION') {
    const paused = action === 'PAUSE_AUTOMATION' ? new Date().toISOString() : null
    const { error } = await supabase
      .from('contract_processes')
      .update({ automation_paused_at: paused })
      .eq('id', processId)

    if (error) throw fail.internal()
  } else if (action === 'CANCEL_PROCESS') {
    const { error } = await supabase
      .from('contract_processes')
      .update({ general_status: 'CANCELADO' })
      .eq('id', processId)

    if (error) throw fail.internal()
  } else if (action === 'RESEND_SIGNATURE') {
    await enqueueJob(supabase, {
      processId,
      jobType: 'SEND_SIGNATURE_LINK',
      idempotencyKey: `send-signature:${processId}:${Date.now()}`,
      payload: {},
    })
  } else {
    throw fail.unprocessable('ACTION_NOT_SUPPORTED', 'Ação não suportada nesta versão.')
  }

  await supabase.from('audit_logs').insert({
    actor_type: 'ADMIN',
    actor_id: actor.id,
    contract_process_id: processId,
    action,
    entity_type: 'contract_process',
    entity_id: processId,
    metadata: { reason, payload, role: actor.role },
  })

  await recordEvent(supabase, processId, {
    type: `ADMIN_${action}`,
    title: 'Ação administrativa',
    description: reason ?? `Ação ${action} executada pela equipe.`,
    actorType: 'ADMIN',
    actorId: actor.id,
    payload: { action },
  })

  return jsonResponse(request, { status: 'ok', action })
}

async function listJobs(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')?.trim() ?? ''

  let query = supabase
    .from('outbox_jobs')
    .select('id, contract_process_id, job_type, status, attempt_count, max_attempts, run_at, next_attempt_at, last_error, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw fail.internal()
  return jsonResponse(request, data ?? [])
}

async function retryJob(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
  id: string,
  actor: { id: string; role: string },
): Promise<Response> {
  const { data, error } = await supabase
    .from('outbox_jobs')
    .update({
      status: 'PENDING',
      attempt_count: 0,
      next_attempt_at: null,
      locked_at: null,
      locked_by: null,
      last_error: null,
    })
    .eq('id', id)
    .select('id, contract_process_id')
    .maybeSingle<{ id: string; contract_process_id: string | null }>()

  if (error) throw fail.internal()
  if (!data) throw fail.notFound('Job não encontrado.')

  await supabase.from('audit_logs').insert({
    actor_type: 'ADMIN',
    actor_id: actor.id,
    contract_process_id: data.contract_process_id,
    action: 'RETRY_JOB',
    entity_type: 'outbox_job',
    entity_id: id,
    metadata: { role: actor.role },
  })

  return jsonResponse(request, { status: 'ok' })
}

async function listAlerts(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<Response> {
  const { data, error } = await supabase
    .from('alerts')
    .select('id, alert_key, severity, title, description, contract_process_id, status, created_at')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw fail.internal()
  return jsonResponse(request, data ?? [])
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.trunc(value), min), max)
}
