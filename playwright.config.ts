import { defineConfig } from '@playwright/test';

/**
 * playwright.config.ts — конфиг для ручного тестирования библиотеки.
 *
 * Запуск конкретного теста:
 *   npm run inspect                        — мини-тест поиска локаторов
 *   npm run test:manual                    — полный ручной тест
 *   npm run test:manual:demo               — только Demo-тест
 *
 * Запуск с произвольным URL (без изменения файла):
 *   INSPECT_URL=https://example.com npm run inspect
 *
 * Запуск конкретного теста по имени из любого проекта:
 *   npx playwright test --headed --grep "название теста"
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 0,

  reporter: [['list']],

  use: {
    headless: false,
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    {
      name: 'chromium-manual',
    },
  ],
});
