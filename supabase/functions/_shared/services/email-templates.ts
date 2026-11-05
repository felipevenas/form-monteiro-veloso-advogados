/**
 * Templates dos e-mails transacionais.
 *
 * HTML de tabela, CSS inline e 600 px: o que sobrevive a Outlook, Gmail e
 * Apple Mail. A versão em texto puro acompanha sempre (melhora entrega e
 * acessibilidade). Nenhum dado sensível além do necessário para o assunto.
 */

const BRAND = {
  name: 'Monteiro Veloso Advogados',
  legalName: 'MONTEIRO VELOSO SOCIEDADE INDIVIDUAL DE ADVOCACIA',
  oab: 'OAB/BA 78.424',
  site: 'https://monteiroveloso.com',
  form: 'https://form.monteiroveloso.com',
  email: 'roberta@monteiroveloso.com',
  whatsapp: 'https://wa.me/message/FHOA2RTRCH7ON1',
  phone: '+55 71 92006-4621',
  address: 'Rua Portugal, 17, Ed. Regente Feijó — Comércio, Salvador/BA — 40015-000',
  hours: 'Segunda a sexta, das 8h às 16h30',
} as const

const COLORS = {
  ink: '#0a1628',
  brand: '#1a3b6f',
  blue: '#2e63a8',
  text: '#3f4e62',
  field: '#5f7186',
  border: '#dce3ec',
  paperAlt: '#f7f9fc',
  canvas: '#eef2f7',
  success: '#157347',
  successSoft: '#e7f5ee',
} as const

const FONT_BODY = "Arial, Helvetica, sans-serif"
const FONT_SERIF = "Georgia, 'Times New Roman', serif"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

export function firstNameOf(fullName: string | null | undefined): string {
  const first = fullName?.trim().split(/\s+/)[0]
  return first && first.length >= 2 ? first : ''
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

interface LayoutInput {
  title: string
  preheader: string
  content: string
  testMode: boolean
  footerNote?: string
}

function layout(input: LayoutInput): string {
  const testBanner = input.testMode
    ? `<tr><td style="padding:10px 28px;background:#fff6e0;border-bottom:1px solid #f0dcae;font-family:${FONT_BODY};font-size:12px;color:#9a6700;">
         <strong>Modo de teste:</strong> em produção, este e-mail iria para o destinatário real.
       </td></tr>`
    : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.canvas};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${COLORS.border};">
        <tr>
          <td style="padding:22px 28px 18px;border-bottom:1px solid ${COLORS.border};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:12px;vertical-align:middle;">
                  <img src="${BRAND.form}/apple-touch-icon.png" width="44" height="44" alt="${escapeHtml(BRAND.name)}" style="display:block;border:0;border-radius:2px;">
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-family:${FONT_SERIF};font-size:17px;line-height:1.2;letter-spacing:0.12em;color:${COLORS.brand};font-weight:bold;">MONTEIRO VELOSO</div>
                  <div style="margin-top:3px;font-family:${FONT_BODY};font-size:10px;line-height:1.2;letter-spacing:0.26em;color:${COLORS.field};">ADVOGADOS</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${testBanner}
        <tr>
          <td style="padding:28px;">
            ${input.content}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 24px;border-top:1px solid ${COLORS.border};background:${COLORS.paperAlt};">
            <p style="margin:0 0 5px;font-family:${FONT_BODY};font-size:11px;line-height:1.6;color:${COLORS.field};">
              ${escapeHtml(BRAND.legalName)} · ${escapeHtml(BRAND.oab)}
            </p>
            <p style="margin:0 0 5px;font-family:${FONT_BODY};font-size:11px;line-height:1.6;color:${COLORS.field};">
              ${escapeHtml(BRAND.address)}
            </p>
            <p style="margin:0 0 10px;font-family:${FONT_BODY};font-size:11px;line-height:1.6;color:${COLORS.field};">
              ${escapeHtml(BRAND.hours)} · ${escapeHtml(BRAND.phone)}
            </p>
            <p style="margin:0;font-family:${FONT_BODY};font-size:11px;line-height:1.6;color:${COLORS.field};">
              <a href="${BRAND.site}" style="color:${COLORS.blue};text-decoration:none;">monteiroveloso.com</a> ·
              <a href="${BRAND.whatsapp}" style="color:${COLORS.blue};text-decoration:none;">WhatsApp</a> ·
              <a href="${BRAND.form}/privacidade" style="color:${COLORS.blue};text-decoration:none;">Aviso de privacidade</a>
            </p>
            <p style="margin:12px 0 0;font-family:${FONT_BODY};font-size:10px;line-height:1.6;color:#7b8fa6;">
              ${escapeHtml(
                input.footerNote ??
                  'Este é um e-mail automático sobre o seu processo de contratação. Se precisar falar com a equipe, responda esta mensagem.',
              )}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${COLORS.text};">${text}</p>`
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${FONT_SERIF};font-size:26px;line-height:1.25;font-weight:normal;color:${COLORS.ink};">${text}</h1>`
}

function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT_BODY};font-size:11px;font-weight:bold;letter-spacing:0.15em;text-transform:uppercase;color:${COLORS.blue};">${escapeHtml(text)}</p>`
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
    <tr>
      <td style="background:${COLORS.brand};">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONT_BODY};font-size:14px;font-weight:bold;line-height:1.2;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`
}

function summary(rows: Array<{ label: string; value: string }>): string {
  const body = rows
    .map(
      (row) => `<tr>
        <td style="padding:7px 0;font-family:${FONT_BODY};font-size:12px;line-height:1.5;color:${COLORS.field};width:44%;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:7px 0;font-family:${FONT_BODY};font-size:13px;line-height:1.5;color:${COLORS.ink};font-weight:bold;vertical-align:top;">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;background:${COLORS.paperAlt};border:1px solid ${COLORS.border};">
    <tr>
      <td style="padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
      </td>
    </tr>
  </table>`
}

function note(title: string, text: string, tone: 'info' | 'success' = 'info'): string {
  const background = tone === 'success' ? COLORS.successSoft : COLORS.paperAlt
  const border = tone === 'success' ? '#bfe3d1' : COLORS.border
  const titleColor = tone === 'success' ? COLORS.success : COLORS.ink

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;background:${background};border:1px solid ${border};">
    <tr>
      <td style="padding:14px 18px;font-family:${FONT_BODY};font-size:13px;line-height:1.65;color:${COLORS.text};">
        <strong style="color:${titleColor};">${escapeHtml(title)}</strong><br>
        ${escapeHtml(text)}
      </td>
    </tr>
  </table>`
}

function orderedSteps(steps: Array<{ title: string; description: string }>): string {
  const items = steps
    .map(
      (step, index) => `<tr>
        <td style="padding:0 12px 14px 0;vertical-align:top;width:26px;">
          <span style="display:inline-block;width:24px;height:24px;border-radius:12px;background:${COLORS.paperAlt};border:1px solid ${COLORS.border};font-family:${FONT_BODY};font-size:12px;line-height:24px;text-align:center;color:${COLORS.brand};font-weight:bold;">${index + 1}</span>
        </td>
        <td style="padding:0 0 14px;vertical-align:top;">
          <p style="margin:0 0 2px;font-family:${FONT_BODY};font-size:13px;font-weight:bold;color:${COLORS.ink};">${escapeHtml(step.title)}</p>
          <p style="margin:0;font-family:${FONT_BODY};font-size:13px;line-height:1.6;color:${COLORS.text};">${escapeHtml(step.description)}</p>
        </td>
      </tr>`,
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">${items}</table>`
}

function checklist(items: string[]): string {
  const rows = items
    .map(
      (item) => `<p style="margin:0 0 8px;font-family:${FONT_BODY};font-size:13px;line-height:1.6;color:${COLORS.text};">
        <span style="color:${COLORS.success};font-weight:bold;">&#10003;</span>&nbsp; ${escapeHtml(item)}
      </p>`,
    )
    .join('')

  return `<div style="margin:0 0 22px;">${rows}</div>`
}

export interface ClientSubmissionInput {
  firstName: string
  publicCode: string
  serviceName: string | null
  planLabel: string | null
  totalCents: number | null
  processUrl: string
  testMode: boolean
}

export function renderClientSubmissionEmail(input: ClientSubmissionInput): RenderedEmail {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Código do processo', value: input.publicCode },
  ]

  if (input.serviceName) rows.push({ label: 'Serviço', value: input.serviceName })
  if (input.planLabel) rows.push({ label: 'Forma de pagamento', value: input.planLabel })
  if (input.totalCents !== null) {
    rows.push({ label: 'Valor total', value: formatBRL(input.totalCents) })
  }

  const content = `
    ${eyebrow(`Processo ${input.publicCode}`)}
    ${heading(
      input.firstName
        ? `Recebemos seus dados, ${escapeHtml(input.firstName)}.`
        : 'Recebemos seus dados.',
    )}
    ${paragraph('Seu cadastro na Monteiro Veloso Advogados está registrado. A equipe já tem acesso às informações e acompanha cada etapa com você.')}
    ${summary(rows)}
    ${paragraph('<strong style="color:#0a1628;">Próximos passos</strong>')}
    ${orderedSteps([
      {
        title: 'Assinatura do contrato',
        description:
          'O contrato chega por e-mail e WhatsApp. Se ainda não chegou, aguarde alguns minutos antes de falar com a equipe.',
      },
      {
        title: 'Pagamento',
        description:
          'Depois da assinatura, você recebe o link do checkout seguro. A confirmação é automática.',
      },
      {
        title: 'Documentos',
        description:
          'Por último, envie os documentos obrigatórios direto pelo formulário, sem sair da página.',
      },
    ])}
    ${button(input.processUrl, 'Acompanhar meu processo')}
    ${note(
      'Guarde este link',
      'Ele dá acesso direto ao seu processo e é pessoal. Não compartilhe com ninguém.',
    )}
  `

  const text = [
    input.firstName
      ? `Recebemos seus dados, ${input.firstName}.`
      : 'Recebemos seus dados.',
    '',
    `Processo ${input.publicCode}`,
    ...(input.serviceName ? [`Serviço: ${input.serviceName}`] : []),
    ...(input.planLabel ? [`Forma de pagamento: ${input.planLabel}`] : []),
    ...(input.totalCents !== null ? [`Valor total: ${formatBRL(input.totalCents)}`] : []),
    '',
    'Próximos passos:',
    '1. Assinatura do contrato — chega por e-mail e WhatsApp.',
    '2. Pagamento — link do checkout após a assinatura.',
    '3. Documentos — envio pelo formulário.',
    '',
    `Acompanhe seu processo: ${input.processUrl}`,
    '',
    'O link é pessoal. Não compartilhe.',
    '',
    `${BRAND.legalName} · ${BRAND.oab}`,
    BRAND.address,
    `${BRAND.hours} · ${BRAND.phone}`,
    BRAND.site,
  ].join('\n')

  return {
    subject: `Recebemos seu cadastro · processo ${input.publicCode}`,
    html: layout({
      title: `Recebemos seu cadastro · processo ${input.publicCode}`,
      preheader: `Processo ${input.publicCode} registrado. Próximo passo: assinatura do contrato.`,
      content,
      testMode: input.testMode,
    }),
    text,
  }
}

export interface ClientCompletedInput {
  firstName: string
  publicCode: string
  serviceName: string | null
  processUrl: string
  testMode: boolean
}

export function renderClientCompletedEmail(input: ClientCompletedInput): RenderedEmail {
  const content = `
    ${eyebrow(`Processo ${input.publicCode}`)}
    ${heading(
      input.firstName ? `Tudo certo, ${escapeHtml(input.firstName)}.` : 'Tudo certo.',
    )}
    ${paragraph('Seu processo de contratação foi concluído. A partir de agora, a equipe assume o caso e dá sequência ao atendimento.')}
    ${checklist([
      'Dados e contrato validados',
      'Contrato assinado',
      'Pagamento confirmado',
      'Documentos recebidos',
    ])}
    ${input.serviceName ? summary([{ label: 'Serviço', value: input.serviceName }]) : ''}
    ${note(
      'O que acontece agora',
      'A equipe jurídica analisa os documentos e entra em contato pelo WhatsApp para alinhar os próximos passos do caso. Você pode acompanhar tudo pelo link abaixo.',
    )}
    ${button(input.processUrl, 'Ver meu processo')}
    ${paragraph(`<span style="font-size:13px;color:${COLORS.field};">Dúvidas? Fale com a equipe pelo WhatsApp ${escapeHtml(BRAND.phone)} ou responda esta mensagem.</span>`)}
  `

  const text = [
    input.firstName
      ? `Tudo certo, ${input.firstName}. Seu processo está concluído.`
      : 'Seu processo está concluído.',
    '',
    `Processo ${input.publicCode}`,
    ...(input.serviceName ? [`Serviço: ${input.serviceName}`] : []),
    '',
    'Concluído:',
    '- Dados e contrato validados',
    '- Contrato assinado',
    '- Pagamento confirmado',
    '- Documentos recebidos',
    '',
    'A equipe jurídica analisa os documentos e entra em contato pelo WhatsApp.',
    `Acompanhe pelo link: ${input.processUrl}`,
    '',
    `Dúvidas? ${BRAND.phone} · ${BRAND.email}`,
    '',
    `${BRAND.legalName} · ${BRAND.oab}`,
  ].join('\n')

  return {
    subject: `Processo ${input.publicCode} concluído`,
    html: layout({
      title: `Processo ${input.publicCode} concluído`,
      preheader: 'Recebemos seus dados, assinatura, pagamento e documentos. Veja o que acontece agora.',
      content,
      testMode: input.testMode,
    }),
    text,
  }
}

export interface AccessLinkInput {
  firstName: string
  publicCode: string
  accessUrl: string
  testMode: boolean
}

export function renderAccessLinkEmail(input: AccessLinkInput): RenderedEmail {
  const content = `
    ${eyebrow(`Processo ${input.publicCode}`)}
    ${heading('Seu link para continuar.')}
    ${paragraph(
      `${input.firstName ? `Olá, ${escapeHtml(input.firstName)}. ` : 'Olá. '}Recebemos um pedido para retomar o processo ${escapeHtml(input.publicCode)}. Use o botão abaixo para voltar de onde parou.`,
    )}
    ${button(input.accessUrl, 'Acessar meu processo')}
    ${note(
      'Não reconhece este pedido?',
      'Ignore este e-mail. Nenhuma alteração foi feita no seu processo.',
    )}
    ${paragraph(`<span style="font-size:13px;color:${COLORS.field};">O link é pessoal e não deve ser compartilhado. Se o botão não funcionar, copie e cole este endereço no navegador:</span>`)}
    ${paragraph(`<span style="font-size:12px;color:${COLORS.blue};word-break:break-all;">${escapeHtml(input.accessUrl)}</span>`)}
  `

  const text = [
    input.firstName ? `Olá, ${input.firstName}.` : 'Olá.',
    '',
    `Use o link abaixo para retomar o processo ${input.publicCode}:`,
    input.accessUrl,
    '',
    'O link é pessoal. Não compartilhe.',
    'Se você não pediu este acesso, ignore este e-mail.',
    '',
    `${BRAND.legalName} · ${BRAND.oab}`,
    `${BRAND.hours} · ${BRAND.phone}`,
  ].join('\n')

  return {
    subject: `Seu link de acesso · processo ${input.publicCode}`,
    html: layout({
      title: `Seu link de acesso · processo ${input.publicCode}`,
      preheader: `Link pessoal para retomar o processo ${input.publicCode}.`,
      content,
      testMode: input.testMode,
    }),
    text,
  }
}

export interface TeamSubmissionInput {
  clientName: string
  publicCode: string
  email: string | null
  phone: string | null
  serviceName: string | null
  planLabel: string | null
  totalCents: number | null
  adminUrl: string
  testMode: boolean
}

export function renderTeamSubmissionEmail(input: TeamSubmissionInput): RenderedEmail {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Processo', value: input.publicCode },
    { label: 'Cliente', value: input.clientName },
  ]

  if (input.email) rows.push({ label: 'E-mail', value: input.email })
  if (input.phone) rows.push({ label: 'Telefone', value: input.phone })
  if (input.serviceName) rows.push({ label: 'Serviço', value: input.serviceName })
  if (input.planLabel) rows.push({ label: 'Forma de pagamento', value: input.planLabel })
  if (input.totalCents !== null) {
    rows.push({ label: 'Valor total', value: formatBRL(input.totalCents) })
  }

  const content = `
    ${eyebrow('Novo cadastro')}
    ${heading('Um cliente concluiu o formulário.')}
    ${paragraph(`${escapeHtml(input.clientName)} finalizou o preenchimento e escolheu a forma de pagamento. O contrato segue para assinatura pelo ZapSign.`)}
    ${summary(rows)}
    ${button(input.adminUrl, 'Abrir no painel')}
    ${note(
      'Dados sensíveis',
      'CPF completo e documentos ficam disponíveis apenas no painel, para os papéis autorizados.',
    )}
  `

  const text = [
    'Novo cadastro recebido.',
    '',
    ...rows.map((row) => `${row.label}: ${row.value}`),
    '',
    `Abrir no painel: ${input.adminUrl}`,
    'CPF e documentos ficam apenas no painel.',
  ].join('\n')

  return {
    subject: `Novo processo · ${input.clientName} (${input.publicCode})`,
    html: layout({
      title: `Novo processo · ${input.publicCode}`,
      preheader: `${input.clientName} concluiu o preenchimento do formulário.`,
      content,
      testMode: input.testMode,
      footerNote:
        'Aviso interno do formulário de contratação. CPF e documentos não são enviados por e-mail.',
    }),
    text,
  }
}

export { BRAND as emailBrand }
