import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function openForm(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible({
    timeout: 20_000,
  })
}

async function continueStep(page: Page) {
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
}

async function mockCep(page: Page) {
  await page.route('https://viacep.com.br/ws/40015000/json/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cep: '40015-000',
        logradouro: 'Rua Portugal',
        complemento: '',
        bairro: 'Comércio',
        localidade: 'Salvador',
        uf: 'BA',
      }),
    }),
  )
}

async function fillDados(page: Page, name = 'Ana Paula Souza') {
  await mockCep(page)

  await page.getByLabel(/Nome completo/).fill(name)
  await page.getByLabel(/CPF/).fill('52998224725')
  await page.getByLabel(/WhatsApp/).fill('71999990001')
  await page.getByLabel(/E-mail/).fill('ana.souza@example.com')
  await page.getByLabel(/Estado civil/).selectOption('solteiro')
  await page.getByLabel(/Profissão/).fill('Professora')
  await page.getByLabel(/Nacionalidade/).fill('Brasileira')

  await page.getByLabel(/CEP/).fill('40015000')
  await expect(page.getByLabel(/Logradouro/)).toHaveValue('Rua Portugal')
  await expect(page.getByLabel(/Cidade/)).toHaveValue('Salvador')
  await expect(page.getByLabel(/UF/)).toHaveValue('BA')

  await page.getByLabel(/Número/).fill('17')
  await page.getByLabel(/Complemento/).fill('Apto 302')

  await continueStep(page)
  await expect(page.getByRole('heading', { name: 'Contrato e pagamento' })).toBeVisible()
}

async function fillContract(page: Page) {
  await page.getByLabel(/Placa do veículo/).fill('ABC1D23')
  await page.getByLabel(/Modelo do veículo/).fill('Fiat Argo 1.0')
  await page.getByLabel(/Banco ou financeira/).fill('Banco Itaú')
  await page.getByLabel(/Número do contrato/).fill('IT-2025-99881')

  await page
    .getByRole('radio', { name: /Sinal \+ 6 parcelas/ })
    .check({ force: true })
  await page.getByRole('checkbox', { name: /Li e concordo/ }).check()
  await page.getByRole('button', { name: 'Continuar para assinatura' }).click()

  await expect(page.getByRole('heading', { name: 'Assinatura do contrato' })).toBeVisible()
}

async function signContract(page: Page) {
  await expect(page.getByText('Aguardando sua assinatura')).toBeVisible()
  await page.getByRole('button', { name: 'Simular assinatura' }).click()
  await expect(page.getByText('Contrato assinado')).toBeVisible()
  await page.getByRole('button', { name: 'Prosseguir para pagamento' }).click()
  await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
}

async function pay(page: Page) {
  await expect(page.getByText('Pagamento pendente')).toBeVisible()
  await page.getByRole('button', { name: 'Simular pagamento' }).click()
  await expect(page.getByText('Pagamento confirmado')).toBeVisible()
  await page.getByRole('button', { name: 'Prosseguir para documentos' }).click()
  await expect(page.getByRole('heading', { name: 'Documentos' })).toBeVisible()
}

async function uploadRequiredDocuments(page: Page) {
  const pdf = Buffer.from('%PDF-1.4\n% documento de teste\n%%EOF\n')
  const inputs = page.locator('input[type="file"]')

  for (let index = 0; index < 3; index += 1) {
    await inputs.nth(index).setInputFiles({
      name: `documento-${index + 1}.pdf`,
      mimeType: 'application/pdf',
      buffer: pdf,
    })
  }

  await expect(page.getByRole('heading', { name: /Processo concluído/ })).toBeVisible({
    timeout: 20_000,
  })
}

test.describe('Formulário público', () => {
  test('fluxo completo até a confirmação', async ({ page }) => {
    await openForm(page)
    await fillDados(page)
    await fillContract(page)
    await signContract(page)
    await pay(page)
    await uploadRequiredDocuments(page)

    await expect(page.getByRole('heading', { name: /Processo concluído/ })).toBeVisible()
    await expect(page.getByText('O que já foi concluído')).toBeVisible()
  })

  test('mostra erros e foca o resumo de validação', async ({ page }) => {
    await openForm(page)
    await continueStep(page)

    await expect(page.getByText('Revise os campos abaixo para continuar.')).toBeVisible()
    await expect(page.getByText('Informe nome completo.', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Revise os campos abaixo' }),
    ).toBeFocused()
  })

  test('preserva o rascunho após recarregar', async ({ page }) => {
    await openForm(page)
    await page.getByLabel(/Nome completo/).fill('Teste Autosave')

    await page.waitForTimeout(1600)
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByLabel(/Nome completo/)).toHaveValue('Teste Autosave')
  })

  test('preenche o endereço pelo CEP', async ({ page }) => {
    await openForm(page)
    await mockCep(page)

    await page.getByLabel(/CEP/).fill('40015000')
    await expect(page.getByLabel(/Logradouro/)).toHaveValue('Rua Portugal')
    await expect(page.getByLabel(/Bairro/)).toHaveValue('Comércio')
    await expect(page.getByLabel(/Cidade/)).toHaveValue('Salvador')
    await expect(page.getByLabel(/UF/)).toHaveValue('BA')
  })

  test('alterna e persiste o tema escuro', async ({ page }) => {
    await openForm(page)
    await page.getByRole('button', { name: 'Ativar tema escuro' }).click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe('dark')

    await page.reload()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe('dark')
    await expect(page.getByRole('button', { name: 'Ativar tema claro' })).toBeVisible()
  })

  test('mostra o fluxograma de etapas', async ({ page }) => {
    await openForm(page)
    const flow = page.getByRole('navigation', { name: 'Etapas da contratação' })
    await expect(flow).toBeVisible()
    await expect(flow.getByRole('button')).toHaveCount(5)
    await expect(flow.locator('[aria-current="step"]')).toContainText('Seus dados')
  })

  test('não tem violações de acessibilidade na primeira etapa', async ({ page }) => {
    await openForm(page)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('funciona em viewport mobile sem overflow horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openForm(page)

    await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible()
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(hasOverflow).toBe(false)
  })
})
