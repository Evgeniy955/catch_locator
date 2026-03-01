/**
 * index.ts — Главный модуль библиотеки playwright-smart-inspector.
 *
 * Экспортирует расширенный `test` (через test.extend<T>()) с двумя компонентами:
 *   1. Interactive Inspector — браузерный инспектор локаторов (Alt+Click)
 *   2. Self-Healing         — автоматический поиск альтернативных локаторов при падении теста
 *
 * Использование:
 *   import { test, expect } from 'playwright-smart-inspector';
 *
 *   test('my test', async ({ page, smartInspector }) => { ... });
 *
 *   // Отключить для конкретного теста:
 *   test.use({ smartInspector: { enabled: false } });
 */
import type { SmartInspectorFixtures } from './types';
export declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & SmartInspectorFixtures, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
export { expect } from '@playwright/test';
export type { SmartInspectorOptions, SmartInspectorFixtures, LocatorCandidate, HealingReport } from './types';
