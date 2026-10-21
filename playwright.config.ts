import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do Agendaí — rodam contra o build de produção (modo demonstração,
 * sem Supabase): `npm run build && npm run test:e2e`.
 * No CI (GitHub Actions) os navegadores são instalados no job dedicado.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'resultado-e2e.json' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
});
