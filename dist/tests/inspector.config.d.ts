/**
 * inspector.config.ts
 *
 * Конфиг для ручного тестирования playwright-smart-inspector.
 * Укажите URL и кастомные атрибуты вашего проекта.
 *
 * Запуск: npm run test:manual
 */
export declare const INSPECTOR_CONFIG: {
    targetUrl: string;
    locatorAttributes: string[];
};
