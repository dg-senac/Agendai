import { expect, test } from '@playwright/test';

test.describe('Painel do negócio (demonstração)', () => {
  test('dashboard carrega e a navegação entre seções funciona', async ({ page }) => {
    await page.goto('/painel');
    await expect(page.getByRole('heading', { name: /Visão geral|Olá/ }).first()).toBeVisible();
    await page.goto('/painel/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
    await page.goto('/painel/clientes');
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  });

  test('Ctrl+K abre a paleta e navega para o Financeiro', async ({ page }) => {
    await page.goto('/painel');
    await page.keyboard.press('Control+K');
    const entrada = page.getByPlaceholder(/Para onde você quer ir/);
    await expect(entrada).toBeVisible();
    await entrada.fill('Financeiro');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/painel\/financeiro/);
  });

  test('relatórios mostram o upsell Premium no trial Pro', async ({ page }) => {
    await page.goto('/painel/relatorios');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await expect(page.getByText(/Premium/).first()).toBeVisible();
  });

  test('admin em demonstração explica o pré-requisito', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/Supabase configurado/)).toBeVisible();
  });
});
