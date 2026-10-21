import { expect, test } from '@playwright/test';

test.describe('Landing de marketing', () => {
  test('carrega, mostra os planos e o CTA leva ao cadastro', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Agendaí/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Seção de planos com os preços em reais
    await expect(page.getByText('R$ 29,90')).toBeVisible();
    await expect(page.getByText('R$ 59,90')).toBeVisible();

    // FAQ abre a primeira pergunta
    const primeiraPergunta = page.locator('.faq-item summary').first();
    await primeiraPergunta.click();

    // Rodapé com as páginas legais
    await expect(page.getByRole('link', { name: 'Privacidade' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Termos' })).toBeVisible();
  });

  test('páginas legais acessíveis (LGPD)', async ({ page }) => {
    await page.goto('/privacidade');
    await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible();
    await page.goto('/termos');
    await expect(page.getByRole('heading', { name: 'Termos de Uso' })).toBeVisible();
  });
});
