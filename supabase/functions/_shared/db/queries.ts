/** Consultas reutilizáveis das Edge Functions (sempre com service role). */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type {
  DbClient,
  DbConsent,
  DbDocument,
  DbDocumentRequirement,
  DbKitItem,
  DbPayment,
  DbPaymentPlan,
  DbProcess,
  DbProcessEvent,
  DbProduct,
  DbProductService,
  DbProductVersion,
  DbSignature,
  DbTemplate,
  ProcessBundle,
} from './types.ts'

export interface ProductContext {
  product: DbProduct
  version: DbProductVersion
}

export async function findProductContext(
  supabase: SupabaseClient,
  slug?: string,
): Promise<ProductContext | null> {
  let query = supabase
    .from('products')
    .select('id, slug, name, short_name, description, active')
    .eq('active', true)

  if (slug) {
    query = query.eq('slug', slug)
  }

  const { data: products, error } = await query
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) {
    console.error('[queries] falha ao buscar produto:', error.message)
    throw new Error('PRODUCT_LOOKUP_FAILED')
  }

  const product = (products?.[0] ?? null) as DbProduct | null
  if (!product) return null

  const { data: versions, error: versionError } = await supabase
    .from('product_versions')
    .select('*')
    .eq('product_id', product.id)
    .eq('status', 'APPROVED')
    .order('version', { ascending: false })
    .limit(1)

  if (versionError) {
    console.error('[queries] falha ao buscar versão:', versionError.message)
    throw new Error('VERSION_LOOKUP_FAILED')
  }

  const version = (versions?.[0] ?? null) as DbProductVersion | null
  if (!version) return null

  return { product, version }
}

export async function loadProcess(
  supabase: SupabaseClient,
  processId: string,
): Promise<DbProcess | null> {
  const { data, error } = await supabase
    .from('contract_processes')
    .select('*')
    .eq('id', processId)
    .maybeSingle<DbProcess>()

  if (error) {
    console.error('[queries] falha ao buscar processo:', error.message)
    throw new Error('PROCESS_LOOKUP_FAILED')
  }

  return data
}

export async function loadProcessBundle(
  supabase: SupabaseClient,
  processId: string,
): Promise<ProcessBundle | null> {
  const { data: process, error: processError } = await supabase
    .from('contract_processes')
    .select('*')
    .eq('id', processId)
    .maybeSingle<DbProcess>()

  if (processError) {
    console.error('[queries] falha ao buscar processo:', processError.message)
    throw new Error('PROCESS_LOOKUP_FAILED')
  }
  if (!process) return null

  const [productResult, versionResult, plansResult, servicesResult, requirementsResult, kitResult, clientResult] =
    await Promise.all([
      supabase.from('products').select('*').eq('id', process.product_id).maybeSingle<DbProduct>(),
      supabase
        .from('product_versions')
        .select('*')
        .eq('id', process.product_version_id)
        .maybeSingle<DbProductVersion>(),
      supabase
        .from('payment_plans')
        .select('*')
        .eq('product_version_id', process.product_version_id)
        .eq('active', true)
        .order('created_at', { ascending: true }),
      supabase
        .from('product_services')
        .select('*')
        .eq('product_version_id', process.product_version_id)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('document_requirements')
        .select('*')
        .eq('product_version_id', process.product_version_id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('kit_items')
        .select('*')
        .eq('product_version_id', process.product_version_id)
        .order('sort_order', { ascending: true }),
      process.client_id
        ? supabase.from('clients').select('*').eq('id', process.client_id).maybeSingle<DbClient>()
        : Promise.resolve({ data: null, error: null }),
    ])

  const firstError = [
    productResult.error,
    versionResult.error,
    plansResult.error,
    servicesResult.error,
    requirementsResult.error,
    kitResult.error,
    clientResult.error,
  ].find(Boolean)

  if (firstError) {
    console.error('[queries] falha ao montar bundle:', firstError.message)
    throw new Error('BUNDLE_LOOKUP_FAILED')
  }

  const kitItems = (kitResult.data ?? []) as DbKitItem[]
  const templateIds = [...new Set(kitItems.map((item) => item.contract_template_id))]

  const [templatesResult, signaturesResult, paymentsResult, documentsResult, eventsResult, consentResult] =
    await Promise.all([
      templateIds.length
        ? supabase.from('contract_templates').select('*').in('id', templateIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('signatures')
        .select('*')
        .eq('contract_process_id', process.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('payments')
        .select('*')
        .eq('contract_process_id', process.id)
        .order('installment_number', { ascending: true }),
      supabase
        .from('documents')
        .select('*')
        .eq('contract_process_id', process.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('process_events')
        .select('*')
        .eq('contract_process_id', process.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('consent_records')
        .select('*')
        .eq('contract_process_id', process.id)
        .eq('consent_type', 'PRIVACY')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<DbConsent>(),
    ])

  const secondError = [
    templatesResult.error,
    signaturesResult.error,
    paymentsResult.error,
    documentsResult.error,
    eventsResult.error,
    consentResult.error,
  ].find(Boolean)

  if (secondError) {
    console.error('[queries] falha ao carregar relacionados:', secondError.message)
    throw new Error('BUNDLE_RELATED_LOOKUP_FAILED')
  }

  return {
    process,
    product: productResult.data as DbProduct,
    version: versionResult.data as DbProductVersion,
    plans: (plansResult.data ?? []) as DbPaymentPlan[],
    services: (servicesResult.data ?? []) as DbProductService[],
    requirements: (requirementsResult.data ?? []) as DbDocumentRequirement[],
    kitItems,
    templates: (templatesResult.data ?? []) as DbTemplate[],
    client: (clientResult.data ?? null) as DbClient | null,
    signatures: (signaturesResult.data ?? []) as DbSignature[],
    payments: (paymentsResult.data ?? []) as DbPayment[],
    documents: (documentsResult.data ?? []) as DbDocument[],
    events: (eventsResult.data ?? []) as DbProcessEvent[],
    consent: (consentResult.data ?? null) as DbConsent | null,
  }
}

export async function loadHolidays(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('holidays').select('date')

  if (error) {
    console.error('[queries] falha ao carregar feriados:', error.message)
    return new Set()
  }

  return new Set((data ?? []).map((row) => String(row.date)))
}

export async function findProcessIdByPublicCode(
  supabase: SupabaseClient,
  publicCode: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('contract_processes')
    .select('id')
    .eq('public_code', publicCode)
    .maybeSingle<{ id: string }>()

  if (error) {
    console.error('[queries] falha ao buscar código público:', error.message)
    throw new Error('PROCESS_LOOKUP_FAILED')
  }

  return data?.id ?? null
}
