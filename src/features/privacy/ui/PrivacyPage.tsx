import { Container } from '@/shared/ui/Container'
import { SectionHeading } from '@/shared/ui/SectionHeading'
import { brand } from '@/shared/config/brand'

const sections = [
  {
    title: '1. Quem trata seus dados',
    body: [
      `O controlador dos dados pessoais é ${brand.legalName}, CNPJ ${brand.cnpj}, com endereço em ${brand.address.street}, ${brand.address.complement}, ${brand.address.district}, ${brand.address.city}–${brand.address.state}, CEP ${brand.address.postalCode}.`,
      `Contato do responsável pelo tratamento: ${brand.email}.`,
    ],
  },
  {
    title: '2. Quais dados coletamos',
    body: [
      'Dados de identificação e contato: nome completo, CPF, e-mail, telefone/WhatsApp, estado civil, profissão, nacionalidade e endereço.',
      'Dados do contrato: produto contratado, informações do financiamento, veículo, valores, forma e datas de pagamento.',
      'Documentos enviados: RG/CNH, comprovante de residência, contrato de financiamento, documento do veículo e demais arquivos exigidos pelo produto.',
      'Dados de uso e segurança: endereço IP (armazenado de forma protegida), identificadores de sessão, data e hora de acesso, registros de aceite e eventos do processo.',
      'Dados de pagamento: identificadores de cobrança e status retornados pelo Asaas. Não coletamos nem armazenamos o número completo do cartão.',
    ],
  },
  {
    title: '3. Para que usamos',
    body: [
      'Executar a contratação e a prestação dos serviços advocatícios, incluindo a elaboração e a assinatura de contratos, procurações e declarações.',
      'Gerar cobranças, confirmar pagamentos e manter o histórico financeiro do contrato.',
      'Organizar os documentos do cliente em ambiente privado e cumprir obrigações legais, regulatórias e de prestação de contas.',
      'Enviar comunicações operacionais sobre assinatura, pagamento, pendências e andamento do processo.',
      'Prevenir fraudes, abusos, acessos indevidos e uso excessivo das integrações.',
      'Atender solicitações de titulares e exercer direitos em processos administrativos ou judiciais.',
    ],
  },
  {
    title: '4. Bases legais',
    body: [
      'Execução de contrato e procedimentos preliminares (art. 7º, V, da LGPD).',
      'Cumprimento de obrigação legal ou regulatória (art. 7º, II).',
      'Exercício regular de direitos em processo judicial, administrativo ou arbitral (art. 7º, VI).',
      'Legítimo interesse para segurança, prevenção a fraudes e melhoria operacional, sempre com avaliação de impacto e respeito às expectativas do titular (art. 7º, IX).',
      'Consentimento, quando exigido para comunicações promocionais ou finalidades específicas (art. 7º, I).',
    ],
  },
  {
    title: '5. Com quem compartilhamos',
    body: [
      'Operadores de tecnologia que atuam em nosso nome e sob contrato: Supabase (banco de dados e funções), Vercel (hospedagem do frontend), ZapSign (assinatura eletrônica), Asaas (cobranças e pagamentos), Google Drive (armazenamento privado de documentos) e provedores de e-mail e mensagens.',
      'Autoridades públicas, quando houver obrigação legal, ordem judicial ou requisição administrativa válida.',
      'Não vendemos dados pessoais e não os utilizamos para publicidade de terceiros.',
      'Alguns provedores podem processar dados fora do Brasil. Nesses casos, buscamos garantias contratuais e verificamos o nível de proteção exigido pela LGPD.',
    ],
  },
  {
    title: '6. Por quanto tempo guardamos',
    body: [
      'Dados e documentos necessários ao contrato são mantidos pelo prazo legal aplicável à prestação de serviços advocatícios e à guarda de documentos, além dos prazos prescricionais e de defesa do escritório.',
      'Registros de segurança e logs são mantidos pelo período necessário à prevenção de fraudes e à auditoria, e depois descartados ou anonimizados.',
      'Arquivos temporários de upload são removidos após a confirmação do armazenamento definitivo no Google Drive.',
      'Quando não houver base legal ou contratual para a manutenção, os dados são eliminados ou anonimizados de forma segura.',
    ],
  },
  {
    title: '7. Seus direitos',
    body: [
      'Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas, nos limites da lei.',
      `Para exercer seus direitos, escreva para ${brand.email}. Podemos pedir confirmação de identidade para evitar acesso indevido a dados de terceiros.`,
      'Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).',
    ],
  },
  {
    title: '8. Segurança',
    body: [
      'Adotamos controles técnicos e administrativos como acesso restrito por perfil, autenticação da equipe, registro de auditoria, criptografia em trânsito, links assinados de curta duração, limites de requisição e validação de webhooks.',
      'Nenhum sistema é totalmente imune a incidentes. Em caso de incidente relevante, seguimos o plano de resposta, avaliamos o risco aos titulares e comunicamos as partes e a ANPD quando exigido.',
    ],
  },
  {
    title: '9. Cookies e tecnologias similares',
    body: [
      'Usamos apenas recursos essenciais ao funcionamento do formulário, como proteção antiabuso (Cloudflare Turnstile) e manutenção da sessão. Não utilizamos cookies de publicidade neste ambiente.',
      'O Cloudflare Turnstile pode processar sinais técnicos do navegador para distinguir pessoas de automações. Consulte a política do Cloudflare para mais informações.',
    ],
  },
  {
    title: '10. Atualizações',
    body: [
      'Esta política pode ser atualizada para refletir mudanças no processo, nos fornecedores ou na legislação. A versão vigente e a data de atualização ficam sempre nesta página.',
      'Alterações relevantes que afetem a base legal ou os direitos do titular serão comunicadas pelos canais de contato disponíveis.',
    ],
  },
]

export function PrivacyPage() {
  return (
    <Container size="narrow" className="py-14 lg:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Privacidade e LGPD"
        title="Como tratamos seus dados."
        description="Esta política explica quais dados coletamos, por quê, com quem compartilhamos e como você pode exercer seus direitos."
      />

      <p className="mt-6 text-[0.8rem] font-semibold text-text-2">
        Última atualização: 28 de outubro de 2026.
      </p>

      <div className="mt-10 flex flex-col gap-9">
        {sections.map((section) => (
          <section key={section.title} className="border-t border-border pt-6">
            <h2 className="font-display text-[1.4rem] text-ink">{section.title}</h2>
            <div className="mt-3 flex flex-col gap-3">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-[0.9rem] leading-relaxed text-text-2">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Container>
  )
}
