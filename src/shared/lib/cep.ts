import { normalizeCep } from '@/shared/domain/cep'

export interface CepAddress {
  street: string
  neighborhood: string
  city: string
  state: string
}

interface ViaCepResponse {
  erro?: boolean | string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

/**
 * Consulta o ViaCEP. Retorna null quando o CEP não existe e lança erro
 * quando o serviço está indisponível. O formulário nunca é bloqueado por isso.
 */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = normalizeCep(cep)
  if (digits.length !== 8) return null

  let response: Response
  try {
    response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new Error('CEP_UNAVAILABLE')
  }

  if (!response.ok) throw new Error('CEP_UNAVAILABLE')

  const data = (await response.json()) as ViaCepResponse
  if (data.erro) return null

  return {
    street: data.logradouro ?? '',
    neighborhood: data.bairro ?? '',
    city: data.localidade ?? '',
    state: data.uf ?? '',
  }
}
