/**
 * inspector.config.ts
 *
 * Конфиг для ручного тестирования playwright-smart-inspector.
 * Укажите URL и кастомные атрибуты вашего проекта.
 *
 * Запуск: npm run test:manual
 */

export const INSPECTOR_CONFIG = {
  // URL целевой страницы
  targetUrl: 'https://www.onlytests.io/ru/tools/text-generator',

  // Кастомные data-атрибуты вашего проекта (Priority 1).
  // Inspector проверяет их в порядке массива — первый найденный побеждает.
  // Примеры: 'data-cy' (Cypress), 'data-qa', 'data-test', 'data-e2e'
  locatorAttributes: [
    'data-testid',
    'data-test-id',
    'data-e2e',
    'test-id',
    // 'data-cy',
    // 'data-qa',
    // 'data-test',
  ],
};

