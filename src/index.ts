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

import { test as base, Page } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { inspectorScript } from './inspector-script';
import type { SmartInspectorFixtures, LocatorCandidate, HealingReport } from './types';

// ─── Вспомогательные функции Node-side ──────────────────────────────────────

/**
 * Извлекает селектор из текста ошибки Playwright.
 * Playwright формирует сообщения вида:
 *   "locator('button[data-testid="submit"]').click: ..."
 *   "Locator: locator('.my-class')"
 *
 * Стратегия: берём первый фрагмент в одиночных кавычках из сообщения.
 * Regex /'([^']+)'/ захватывает содержимое между первой парой одиночных кавычек.
 */
function extractFailedSelector(errorMessage: string): string | null {
  const match = (/'([^']+)'/).exec(errorMessage);
  return match ? match[1] : null;
}

/**
 * Форматирует и выводит Self-Healing отчёт в консоль Node.js.
 * Каждый кандидат выводится отдельной строкой с emoji-маркерами.
 */
function printHealingReport(report: HealingReport): void {
  console.log('\n' + '─'.repeat(60));
  console.log(`[Self-Healing] ❌ Locator failed: '${report.failedSelector}'`);

  if (report.candidates.length === 0) {
    console.log('[Self-Healing] ⚠️  No similar elements found in the page.');
  } else {
    report.candidates.forEach((candidate, index) => {
      console.log(`\n[Self-Healing] 💡 Suggested fix #${index + 1}: '${candidate.selector}'`);
      console.log(`[Self-Healing] 🛠  Reason: ${candidate.reason}`);
      console.log(`[Self-Healing] 📊 Score: ${candidate.score}/100`);
    });
  }

  console.log('─'.repeat(60) + '\n');
}

// ─── Self-Healing: поиск кандидатов через page.evaluate() ───────────────────

/**
 * Запускает DOM-анализ через page.evaluate() для поиска альтернативных локаторов.
 *
 * Стратегия скоринга:
 *   - 100: точное совпадение текста с failedSelector
 *   - 60:  частичное совпадение (подстрока)
 *   - 40:  совпадение атрибута (data-testid, placeholder, aria-label и т.д.)
 *
 * Возвращает top-3 кандидата, отсортированных по score DESC.
 */
async function findHealingCandidates(
  page: Page,
  failedSelector: string
): Promise<LocatorCandidate[]> {
  try {
    // Передаём selector в браузер и выполняем DOM-анализ
    return page.evaluate((sel: string): Array<{
      selector: string;
      reason: string;
      score: number;
    }> => {
      const results: Array<{ selector: string; reason: string; score: number }> = [];

      // Нормализуем искомый текст: убираем CSS/XPath-синтаксис, оставляем чистый текст
      const searchText = sel
        .replace(/\[.*?]/g, '')    // убираем [attr=value]
        .replaceAll(/[#.>~+]/g, ' ')  // убираем CSS-операторы
        .replaceAll(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      // Атрибуты для поиска частичных совпадений
      const searchAttrs = ['data-testid', 'id', 'name', 'aria-label', 'placeholder', 'class'];

      // Перебираем все интерактивные и текстовые элементы на странице
      const allElements = Array.from(
        document.querySelectorAll(
          'button, a, input, textarea, select, [role], [data-testid], label, h1, h2, h3, h4, h5, h6, span, p, div'
        )
      );

      for (const el of allElements) {
        const element = el as HTMLElement;

        // Получаем видимый текст элемента
        const elText = (element.innerText || element.textContent || '')
          .replaceAll(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        const elTextShort = elText.slice(0, 80);

        // ── Стратегия 1: точное совпадение текста (score=100) ──
        if (elText && elText === searchText) {
          const testId = element.dataset['testid'];
          const suggestedSelector = testId
            ? `[data-testid="${testId}"]`
            : `text=${elTextShort}`;

          results.push({
            selector: suggestedSelector,
            reason: `Element with exact matching text "${elTextShort.slice(0, 30)}" found but selector attributes differ.`,
            score: 100
          });
          continue;
        }

        // ── Стратегия 2: частичное совпадение текста (score=60) ──
        if (
          searchText.length > 2 &&
          elText.length > 0 &&
          (elText.includes(searchText) || searchText.includes(elText.slice(0, 20)))
        ) {
          const testId = element.dataset['testid'];
          const suggestedSelector = testId
            ? `[data-testid="${testId}"]`
            : `text=${elTextShort.slice(0, 40)}`;

          results.push({
            selector: suggestedSelector,
            reason: `Element with similar text content found. Text: "${elTextShort.slice(0, 30)}..."`,
            score: 60
          });
          continue;
        }

        // ── Стратегия 3: совпадение по атрибутам (score=40) ──
        for (const attr of searchAttrs) {
          const attrVal = element.getAttribute(attr);
          if (!attrVal) continue;

          const attrLower = attrVal.toLowerCase();
          const selLower = sel.toLowerCase();

          // Проверяем, содержит ли оригинальный селектор значение этого атрибута
          if (selLower.includes(attrLower) || attrLower.includes(searchText.slice(0, 15))) {
          // Строим предлагаемый селектор по имени атрибута
          let suggestedSelector: string;
          if (attr === 'data-testid') {
            suggestedSelector = `[data-testid="${attrVal}"]`;
          } else if (attr === 'id') {
            suggestedSelector = `#${attrVal}`;
          } else {
            suggestedSelector = `[${attr}="${attrVal}"]`;
          }

            results.push({
              selector: suggestedSelector,
              reason: `Element with matching attribute ${attr}="${attrVal}" found but selector structure changed.`,
              score: 40
            });
            break;
          }
        }
      }

      // Дедупликация по selector, сортировка по score DESC, top-3
      const seen = new Set<string>();
      return results
        .filter(r => {
          if (seen.has(r.selector)) return false;
          seen.add(r.selector);
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    }, failedSelector);
  } catch {
    // page может быть закрыта после падения теста — возвращаем пустой массив
    return [];
  }
}

// ─── Расширение test через Playwright Fixtures ───────────────────────────────

/**
 * Расширяем базовый test из @playwright/test, добавляя фикстуру `smartInspector`.
 *
 * Фикстура работает как "setup/teardown wrapper":
 *   - В setup: инжектирует браузерный inspector-script (если enabled=true)
 *   - В teardown: (не используется, afterEach логика встроена в page-фикстуру)
 *
 * Флаг { option: true } позволяет переопределять значения через test.use():
 *   test.use({ smartInspector: { enabled: false } });
 */
export const test = base.extend<SmartInspectorFixtures>({
  // Объявляем smartInspector как конфигурируемую опцию с дефолтом { enabled: true }
  // { option: true } означает, что значение задаётся через test.use(), а не как scope=test фикстура
  smartInspector: [{ enabled: true }, { option: true }],

  // Переопределяем встроенную фикстуру page, оборачивая её нашей логикой
  page: async ({ page, smartInspector }, use, testInfo: TestInfo) => {
    if (smartInspector.enabled) {
      /**
       * Инъекция 1: exposeFunction
       * Регистрирует window.onLocatorGenerated как мост между браузером и Node.js.
       * Когда браузерный скрипт вызывает window.onLocatorGenerated(payload),
       * Playwright перенаправляет вызов в эту Node.js-функцию.
       */
      await page.exposeFunction(
        'onLocatorGenerated',
        (payload: { selector: string; strategy: string; xpath: string; tagName: string }) => {
          console.log('\n[Inspector] 📍 Locator generated:');
          console.log(`  Selector : ${payload.selector}`);
          console.log(`  Strategy : ${payload.strategy}`);
          console.log(`  XPath    : ${payload.xpath}`);
          console.log(`  Tag      : <${payload.tagName}>`);
          console.log(`  Copied to clipboard ✅\n`);
        }
      );

      /**
       * Инъекция 2: addInitScript
       * Добавляет браузерный inspector-script в контекст страницы.
       * Playwright автоматически переинжектирует скрипт при каждой навигации,
       * поэтому дополнительных вызовов не требуется.
       */
      await page.addInitScript(inspectorScript);
    }

    // Передаём управление тесту
    await use(page);

    // ── Self-Healing: послетестовая логика ────────────────────────────────────
    // Выполняется после завершения теста (до teardown следующего теста)
    if (!smartInspector.enabled) return;

    const status = testInfo.status;

    // Запускаем Self-Healing только при реальных падениях
    if (status !== 'failed' && status !== 'timedOut') return;

    // Извлекаем текст ошибки из testInfo
    const errorMessage = testInfo.error?.message;
    if (!errorMessage) return;

    // Парсим упавший селектор из текста ошибки через regex /'([^']+)'/
    const failedSelector = extractFailedSelector(errorMessage);
    if (!failedSelector) {
      console.log('[Self-Healing] ⚠️  Could not extract failed selector from error message.');
      console.log('[Self-Healing]    Error:', errorMessage.slice(0, 200));
      return;
    }

    // Ищем кандидатов через DOM-анализ в браузере (page.evaluate + DOM queries)
    const candidates = await findHealingCandidates(page, failedSelector);

    // Формируем и выводим отчёт
    const report: HealingReport = { failedSelector, candidates };
    printHealingReport(report);
  },
});

// ─── Реэкспорт expect из @playwright/test ────────────────────────────────────
// Пользователь импортирует и test, и expect из одного места
export { expect } from '@playwright/test';

// Реэкспорт типов для удобства потребителей библиотеки
export type { SmartInspectorOptions, SmartInspectorFixtures, LocatorCandidate, HealingReport } from './types';
