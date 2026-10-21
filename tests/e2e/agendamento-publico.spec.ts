import { expect, test, type Page } from '@playwright/test';

const SLUG = '/studio-beleza-natural';

/** Escolhe o primeiro dia com horários livres (pula hoje e dias sem expediente). */
async function escolherDiaEHora(page: Page): Promise<string> {
  const horarios = page.getByRole('button', { name: /^\d{2}:\d{2}$/ });
  const dias = page.locator('.pub-calendario button.rdp-day_button:not([disabled])').filter({ hasText: /^\d{1,2}$/ });
  await expect(dias.first()).toBeVisible({ timeout: 15_000 }); // calendário entra sob demanda
  const totalDias = await dias.count();
  for (let i = 1; i < Math.min(totalDias, 14); i++) {
    await dias.nth(i).click();
    try {
      await horarios.first().waitFor({ state: 'visible', timeout: 2500 });
      const texto = (await horarios.first().innerText()).trim();
      await horarios.first().click();
      return texto;
    } catch {
      /* dia sem vagas: tenta o próximo */
    }
  }
  throw new Error('Nenhum horário livre encontrado nos próximos dias (demonstração).');
}

async function preencherDados(page: Page) {
  await page.getByLabel('Seu nome', { exact: true }).fill('Cliente Teste E2E');
  await page.getByLabel('WhatsApp', { exact: true }).fill('(81) 99999-0001');
  await page.getByLabel('E-mail (para receber a confirmação)', { exact: true }).fill('cliente.teste@exemplo.com.br');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Ver resumo/ }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu agendamento' })).toBeVisible();
}

async function reservar(page: Page, servico: string, profissional = 'Qualquer profissional') {
  await page.goto(SLUG);
  await page.getByRole('button', { name: new RegExp(servico) }).click();
  await expect(page.getByRole('heading', { name: /Com quem/ })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(profissional) }).click();
  await expect(page.getByRole('heading', { name: 'Escolha o dia e o horário' })).toBeVisible();
  const hora = await escolherDiaEHora(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await preencherDados(page);
  await page.getByRole('button', { name: /Confirmar agendamento/ }).click();
  return hora;
}

test.describe('Página pública de agendamento (demonstração)', () => {
  test('agenda um serviço sem sinal e abre o link do cliente', async ({ page }) => {
    await reservar(page, 'Corte feminino');
    await expect(page.getByRole('heading', { name: /Agendamento confirmado/ })).toBeVisible();

    await page.getByRole('link', { name: /Ver \/ remarcar \/ cancelar/ }).click();
    await expect(page).toHaveURL(/\/agendamento\//);
    await expect(page.getByRole('button', { name: /Remarcar horário/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancelar agendamento/ })).toBeVisible();
  });

  test('serviço com sinal: Pix simulado confirma o agendamento', async ({ page }) => {
    await reservar(page, 'Coloração completa');
    await expect(page.getByText(/Pix/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Já paguei \(simular\)/ }).click();
    await expect(page.getByRole('heading', { name: /Agendamento confirmado/ })).toBeVisible();
  });

  test('serviço com sinal: Pix expirado libera o horário', async ({ page }) => {
    const hora = await reservar(page, 'Coloração completa');
    await page.getByRole('button', { name: /Simular expiração/ }).click();

    // Volta ao início: o mesmo horário deve estar livre de novo
    await page.goto(SLUG);
    await page.getByRole('button', { name: /Coloração completa/ }).click();
    await page.getByRole('button', { name: /Qualquer profissional/ }).click();
    const dias = page.locator('.pub-calendario button.rdp-day_button:not([disabled])').filter({ hasText: /^\d{1,2}$/ });
    await expect(dias.first()).toBeVisible({ timeout: 15_000 });
    let reapareceu = false;
    for (let i = 0; i < Math.min(await dias.count(), 10) && !reapareceu; i++) {
      await dias.nth(i).click();
      reapareceu = await page.getByRole('button', { name: hora, exact: true })
        .isVisible({ timeout: 1500 }).catch(() => false);
    }
    expect(reapareceu, 'o horário expirado deveria voltar a ficar disponível').toBe(true);
  });

  test('sem double-booking: horário reservado some da vitrine', async ({ page }) => {
    // Com uma profissional específica: o horário dela não pode ser vendido 2x.
    // (Com "qualquer profissional" o mesmo horário seguiria livre com outra
    //  pessoa — correto. A garantia sob concorrência real é a constraint
    //  EXCLUDE do Postgres; aqui validamos a regra na interface demo.)
    const hora = await reservar(page, 'Corte feminino', 'Camila Santos');
    await expect(page.getByRole('heading', { name: /Agendamento confirmado/ })).toBeVisible();

    await page.goto(SLUG);
    await page.getByRole('button', { name: /Corte feminino/ }).click();
    await page.getByRole('button', { name: /Camila Santos/ }).click();
    const dias = page.locator('.pub-calendario button.rdp-day_button:not([disabled])').filter({ hasText: /^\d{1,2}$/ });
    await expect(dias.first()).toBeVisible({ timeout: 15_000 });
    let aindaAparece = false;
    // O dia reservado foi o primeiro com vagas a partir de amanhã:
    // varremos os dias próximos procurando o vazamento.
    for (let i = 1; i < Math.min(await dias.count(), 8); i++) {
      await dias.nth(i).click();
      const presente = await page.getByRole('button', { name: hora, exact: true })
        .isVisible({ timeout: 1500 }).catch(() => false);
      if (presente) { aindaAparece = true; break; }
    }
    expect(aindaAparece, 'o horário já reservado não deveria ser oferecido outra vez').toBe(false);
  });

  test('slug inexistente mostra pagina amigável na demonstração', async ({ page }) => {
    await page.goto('/negocio-que-nao-existe-e2e');
    await expect(page.getByText(/Negócio não encontrado/)).toBeVisible();
  });
});
