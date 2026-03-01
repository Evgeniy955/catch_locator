/**
 * inspect.spec.ts — Мини-тест для быстрого поиска локаторов на любой странице.
 *
 * ─── Как использовать ────────────────────────────────────────────────────────
 *
 *   1. Укажите URL страницы в переменной TARGET_URL ниже
 *   2. Запустите:
 *        npm run inspect
 *   3. В браузере зажмите Alt и кликайте на элементы
 *   4. Локаторы появятся в терминале и скопируются в буфер обмена
 *
 * ─── В рабочем проекте ───────────────────────────────────────────────────────
 *
 *   Скопируйте этот файл в свой проект и замените импорт:
 *     import { test, expect } from 'playwright-smart-inspector';
 *
 *   Запуск конкретного теста из вашего проекта:
 *     npx playwright test inspect.spec.ts --headed
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test, expect } from '../src';

// ↓↓↓ УКАЖИТЕ URL СТРАНИЦЫ КОТОРУЮ ХОТИТЕ ИССЛЕДОВАТЬ ↓↓↓
const TARGET_URL = 'https://www.onlytests.io/ru/tools/text-generator';

// ↓↓↓ УКАЖИТЕ КАСТОМНЫЕ data-* АТРИБУТЫ ВАШЕГО ПРОЕКТА (Priority 1) ↓↓↓
const LOCATOR_ATTRIBUTES = [
  'data-testid',
  'data-test-id',
  'data-e2e',
  'test-id',
  // 'data-cy',
  // 'data-qa',
];

// ─────────────────────────────────────────────────────────────────────────────

test.use({
  smartInspector: {
    enabled: true,
    locatorAttributes: LOCATOR_ATTRIBUTES,
  },
});

test('🔍 Inspect — поиск локаторов', async ({ page }) => {
  console.log('\n' + '═'.repeat(62));
  console.log('  🚀 URL    :', TARGET_URL);
  console.log('  🏷  Attrs  :', LOCATOR_ATTRIBUTES.join(', '));
  console.log('═'.repeat(62));
  console.log('  📖 Зажмите Alt и кликайте на элементы страницы');
  console.log('  📋 Playwright-локатор скопируется в буфер обмена');
  console.log('  ⏹  Закройте браузер для завершения');
  console.log('═'.repeat(62) + '\n');

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(TARGET_URL);

  // Ждём пока пользователь закроет браузер
  await page.waitForEvent('close', { timeout: 0 });
});

