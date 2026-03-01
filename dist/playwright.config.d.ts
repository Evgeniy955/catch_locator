/**
 * playwright.config.ts — основной конфиг, подхватывается IDE (WebStorm/VS Code)
 * при запуске тестов кнопкой ▶ напрямую из редактора.
 *
 * Для запуска из терминала:
 *   npm run test:manual
 */
declare const _default: import("@playwright/test").PlaywrightTestConfig<{}, {}>;
export default _default;
