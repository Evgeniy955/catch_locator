"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * playwright.config.ts — основной конфиг, подхватывается IDE (WebStorm/VS Code)
 * при запуске тестов кнопкой ▶ напрямую из редактора.
 *
 * Для запуска из терминала:
 *   npm run test:manual
 */
exports.default = (0, test_1.defineConfig)({
    testDir: './tests',
    testMatch: '**/manual-inspector.spec.ts',
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
