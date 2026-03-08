"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.expect = exports.test = void 0;
const test_1 = require("@playwright/test");
const inspector_script_1 = require("./inspector-script");
// Дефолтные атрибуты P1 — используются если locatorAttributes не задан в опциях
const DEFAULT_LOCATOR_ATTRS = ['data-testid', 'data-test-id', 'data-e2e', 'test-id'];
// ─── Вспомогательные функции Node-side ──────────────────────────────────────
function extractFailedSelector(errorMessage) {
    const match = (/'([^']+)'/).exec(errorMessage);
    return match ? match[1] : null;
}
function printHealingReport(report) {
    console.log('\n' + '─'.repeat(60));
    console.log(`[Self-Healing] ❌ Locator failed: '${report.failedSelector}'`);
    if (report.candidates.length === 0) {
        console.log('[Self-Healing] ⚠️  No similar elements found in the page.');
    }
    else {
        report.candidates.forEach((c, i) => {
            console.log(`\n[Self-Healing] 💡 Suggested fix #${i + 1}: '${c.selector}'`);
            console.log(`[Self-Healing] 🛠  Reason: ${c.reason}`);
            console.log(`[Self-Healing] 📊 Score: ${c.score}/100`);
        });
    }
    console.log('─'.repeat(60) + '\n');
}
// ─── Self-Healing: DOM-анализ через page.evaluate() ──────────────────────────
async function findHealingCandidates(page, failedSelector) {
    try {
        return page.evaluate((sel) => {
            const results = [];
            const searchText = sel
                .replace(/\[.*?]/g, '')
                .replaceAll(/[#.>~+]/g, ' ')
                .replaceAll(/\s+/g, ' ')
                .trim().toLowerCase();
            const searchAttrs = ['data-testid', 'data-test-id', 'data-e2e', 'test-id', 'id', 'name', 'aria-label', 'placeholder', 'class'];
            const allElements = Array.from(document.querySelectorAll('button, a, input, textarea, select, [role], [data-testid], [data-test-id], [data-e2e], label, h1, h2, h3, h4, h5, h6, span, p, div'));
            for (const el of allElements) {
                const element = el;
                const elText = (element.innerText || element.textContent || '').replaceAll(/\s+/g, ' ').trim().toLowerCase();
                const elTextShort = elText.slice(0, 80);
                // Score 100: точное совпадение текста
                if (elText && elText === searchText) {
                    const testId = element.dataset['testid'];
                    results.push({
                        selector: testId ? `[data-testid="${testId}"]` : `text=${elTextShort}`,
                        reason: `Element with exact matching text "${elTextShort.slice(0, 30)}" found but selector attributes differ.`,
                        score: 100
                    });
                    continue;
                }
                // Score 60: частичное совпадение текста
                if (searchText.length > 2 && elText.length > 0 && (elText.includes(searchText) || searchText.includes(elText.slice(0, 20)))) {
                    const testId = element.dataset['testid'];
                    results.push({
                        selector: testId ? `[data-testid="${testId}"]` : `text=${elTextShort.slice(0, 40)}`,
                        reason: `Element with similar text content found. Text: "${elTextShort.slice(0, 30)}..."`,
                        score: 60
                    });
                    continue;
                }
                // Score 40: совпадение атрибута
                for (const attr of searchAttrs) {
                    const attrVal = element.getAttribute(attr);
                    if (!attrVal)
                        continue;
                    if (sel.toLowerCase().includes(attrVal.toLowerCase()) || attrVal.toLowerCase().includes(searchText.slice(0, 15))) {
                        let s;
                        if (attr === 'id')
                            s = `#${attrVal}`;
                        else if (attr === 'class')
                            s = `.${attrVal.split(' ')[0]}`;
                        else
                            s = `[${attr}="${attrVal}"]`;
                        results.push({ selector: s, reason: `Element with matching attribute ${attr}="${attrVal}" found but selector structure changed.`, score: 40 });
                        break;
                    }
                }
            }
            const seen = new Set();
            return results
                .filter(r => { if (seen.has(r.selector))
                return false; seen.add(r.selector); return true; })
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);
        }, failedSelector);
    }
    catch {
        return [];
    }
}
// ─── Расширение test через Playwright Fixtures ───────────────────────────────
exports.test = test_1.test.extend({
    smartInspector: [{ enabled: true }, { option: true }],
    page: async ({ page, smartInspector }, use, testInfo) => {
        if (smartInspector.enabled) {
            const locatorAttributes = smartInspector.locatorAttributes ?? DEFAULT_LOCATOR_ATTRS;
            // Авто-определение клавиши-модификатора по платформе:
            //   macOS (darwin) → 'ctrl'  (Alt/Option перехватывается системой на Mac)
            //   Windows/Linux  → 'alt'
            // Явно заданный activationKey всегда имеет приоритет.
            const activationKey = smartInspector.activationKey ??
                (process.platform === 'darwin' ? 'ctrl' : 'alt');
            // Инъекция 1: передаём конфиг в браузер ДО загрузки inspector-скрипта.
            // Скрипт читает window.__smartInspectorConfig при инициализации.
            await page.addInitScript(`window.__smartInspectorConfig = ${JSON.stringify({ locatorAttributes, activationKey })};`);
            // Инъекция 2: exposeFunction — мост Browser → Node.js.
            // Когда браузер вызывает window.onLocatorGenerated(payload),
            // Playwright перенаправляет вызов в эту Node.js-функцию.
            // activationKey замыкается из внешнего scope — используется в подсказке.
            const keyLabel = activationKey.charAt(0).toUpperCase() + activationKey.slice(1);
            await page.exposeFunction('onLocatorGenerated', (payload) => {
                console.log('\n' + '═'.repeat(62));
                console.log(`[Inspector] 📍 Element: <${payload.tagName}>  Strategy: ${payload.strategy}`);
                console.log('─'.repeat(62));
                console.log(`  Playwright  : ${payload.playwrightLocator}`);
                console.log(`  CSS         : ${payload.cssSelector}`);
                if (payload.xpath) {
                    console.log(`  XPath       : ${payload.xpath}`);
                }
                else {
                    console.log(`  XPath       : (no stable anchor — use Playwright or CSS locator)`);
                }
                console.log('─'.repeat(62));
                console.log(`  📋 Copied   : ${payload.playwrightLocator}`);
                console.log(`  💡 Tip      : ${keyLabel}+Click to inspect next element`);
                console.log('═'.repeat(62) + '\n');
            });
            // Инъекция 3: сам inspector-скрипт (переинжектируется при каждой навигации).
            await page.addInitScript(inspector_script_1.inspectorScript);
        }
        await use(page);
        // ── Self-Healing: после завершения теста ─────────────────────────────────
        if (!smartInspector.enabled)
            return;
        const status = testInfo.status;
        if (status !== 'failed' && status !== 'timedOut')
            return;
        const errorMessage = testInfo.error?.message;
        if (!errorMessage)
            return;
        const failedSelector = extractFailedSelector(errorMessage);
        if (!failedSelector) {
            console.log('[Self-Healing] ⚠️  Could not extract selector from:', errorMessage.slice(0, 200));
            return;
        }
        const candidates = await findHealingCandidates(page, failedSelector);
        printHealingReport({ failedSelector, candidates });
    },
});
// ─── Реэкспорт ───────────────────────────────────────────────────────────────
var test_2 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_2.expect; } });
