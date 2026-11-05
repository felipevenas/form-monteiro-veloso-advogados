import { describe, expect, it } from 'vitest'
import {
  firstNameOf,
  formatBRL,
  renderAccessLinkEmail,
  renderClientCompletedEmail,
  renderClientSubmissionEmail,
  renderTeamSubmissionEmail,
} from '../supabase/functions/_shared/services/email-templates'

const base = {
  firstName: 'Ana',
  publicCode: 'MVABCD1234',
  testMode: false,
}

describe('email-templates', () => {
  it('usa o primeiro nome e trata nome ausente', () => {
    expect(firstNameOf('Ana Paula Souza')).toBe('Ana')
    expect(firstNameOf('  ')).toBe('')
    expect(firstNameOf(null)).toBe('')
  })

  it('formata centavos em reais', () => {
    expect(formatBRL(123456)).toContain('1.234,56')
  })

  it('monta a confirmação de cadastro com resumo e link', () => {
    const email = renderClientSubmissionEmail({
      ...base,
      serviceName: 'Defesa em busca e apreensão',
      planLabel: 'Entrada + 5 parcelas',
      totalCents: 250000,
      processUrl: 'https://form.monteiroveloso.com/processo/mv_abc',
    })

    expect(email.subject).toContain('MVABCD1234')
    expect(email.html).toContain('https://form.monteiroveloso.com/processo/mv_abc')
    expect(email.html).toContain('Defesa em busca e apreensão')
    expect(email.html).toContain('2.500,00')
    expect(email.text).toContain('Assinatura do contrato')
    expect(email.text).toContain('https://form.monteiroveloso.com/processo/mv_abc')
  })

  it('escapa HTML vindo do cadastro', () => {
    const email = renderClientSubmissionEmail({
      ...base,
      firstName: '<script>alert(1)</script>',
      serviceName: null,
      planLabel: null,
      totalCents: null,
      processUrl: 'https://example.com/processo/x',
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it('mostra a faixa de teste apenas no modo test', () => {
    const live = renderClientCompletedEmail({
      ...base,
      serviceName: null,
      processUrl: 'https://example.com/processo/x',
    })
    const test = renderClientCompletedEmail({
      ...base,
      testMode: true,
      serviceName: null,
      processUrl: 'https://example.com/processo/x',
    })

    expect(live.html).not.toContain('Modo de teste')
    expect(test.html).toContain('Modo de teste')
  })

  it('inclui o link pessoal no e-mail de retomada', () => {
    const email = renderAccessLinkEmail({
      ...base,
      accessUrl: 'https://form.monteiroveloso.com/processo/mv_123',
    })

    expect(email.html).toContain('https://form.monteiroveloso.com/processo/mv_123')
    expect(email.text).toContain('Não compartilhe')
  })

  it('notifica a equipe com o link do painel e sem CPF', () => {
    const email = renderTeamSubmissionEmail({
      clientName: 'Ana Paula Souza',
      publicCode: 'MVABCD1234',
      email: 'ana@example.com',
      phone: '+5571999999999',
      serviceName: 'Defesa em busca e apreensão',
      planLabel: 'Entrada + 5 parcelas',
      totalCents: 250000,
      adminUrl: 'https://form.monteiroveloso.com/admin/processos/abc',
      testMode: false,
    })

    expect(email.subject).toContain('Ana Paula Souza')
    expect(email.html).toContain('/admin/processos/abc')
    expect(email.text).not.toContain('CPF:')
  })
})
