/**
 * manual-inspector.spec.ts
 *
 * Тест для РУЧНОГО тестирования библиотеки playwright-smart-inspector
 * на реальном сайте https://www.onlytests.io/ru/tools/text-generator
 *
 * ─── Запуск ──────────────────────────────────────────────────────────────────
 *
 *   npm run test:manual
 *
 * ─── Что произойдёт ──────────────────────────────────────────────────────────
 *
 *   1. Откроется браузер Chromium с сайтом
 *   2. В терминале появится инструкция
 *   3. Зажмите Alt и кликайте на элементы — локаторы появятся в терминале
 *   4. Закройте браузер или нажмите Ctrl+C для завершения
 *
 * ─── Как тестировать Inspector (Alt+Click) ───────────────────────────────────
 *
 *   • Зажмите Alt и кликните на любой элемент страницы
 *   • В терминале появится блок:
 *       [Inspector] 📍 Locator generated:
 *         Selector : [data-testid="..."] / role=button[name="..."] / text=...
 *         Strategy : data-testid / role / label / placeholder / text / xpath-fallback
 *         XPath    : //*[@id="..."]/...
 *         Tag      : <button>
 *         Copied to clipboard ✅
 *
 * ─── Завершение ──────────────────────────────────────────────────────────────
 *
 *   • Закройте браузер вручную
 *   • Или нажмите Ctrl+C в терминале
 */

import { test, expect } from '../src';
import { INSPECTOR_CONFIG } from './inspector.config';

const TARGET_URL = INSPECTOR_CONFIG.targetUrl;

// Передаём locatorAttributes из конфига в фикстуру — применяется для всего файла
test.use({
  smartInspector: {
    enabled: true,
    locatorAttributes: INSPECTOR_CONFIG.locatorAttributes,
  },
});

// ─── Основной тест: открываем сайт и ждём ручного взаимодействия ─────────────

test('🔍 Manual Inspector — onlytests.io text-generator', async ({ page }) => {


  console.log('\n' + '═'.repeat(62));
  console.log('  🚀 Открываем:', TARGET_URL);
  console.log('  🔑 Атрибуты P1:', INSPECTOR_CONFIG.locatorAttributes.join(', '));
  console.log('═'.repeat(62));

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(TARGET_URL);

  const inspectorReady = await page.evaluate(
    () => typeof (window as any).onLocatorGenerated === 'function'
  );

  console.log(inspectorReady
    ? '\n  ✅ Smart Inspector активирован!'
    : '\n  ⚠️  Inspector не активирован (возможно, CSP блокирует скрипт)'
  );

  console.log('\n' + '─'.repeat(62));
  console.log('  📖 ИНСТРУКЦИЯ:');
  console.log('  • Зажмите Alt и кликайте на элементы страницы');
  console.log('  • В терминале появятся ВСЕ варианты локаторов:');
  console.log('      Playwright  : [data-testid="..."] / role=... / text=...');
  console.log('      CSS         : button.submit-btn / #form-id input');
  console.log('      XPath       : //button[contains(@class,"submit")]');
  console.log('  • Playwright-локатор копируется в буфер обмена автоматически');
  console.log('─'.repeat(62));
  console.log('  ⏹  Закройте браузер или Ctrl+C для завершения');
  console.log('─'.repeat(62) + '\n');

  await page.waitForEvent('close', { timeout: 0 });
});

// ─── Демо-тест: разведка интерактивных элементов страницы ────────────────────

test('📝 Demo — разведка элементов onlytests.io', async ({ page }) => {


  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  console.log('\n' + '─'.repeat(62));
  console.log('  🧪 Demo: собираем интерактивные элементы страницы');
  console.log('─'.repeat(62));

  const elements = await page.evaluate((attrs: string[]) => {
    const selectors = ['button', 'input', 'textarea', 'select', 'a[href]', '[role="button"]'];
    const found: Array<{
      tag: string; text: string;
      customAttr: string | null; attrName: string | null;
      id: string | null; role: string | null; cls: string | null;
    }> = [];

    for (const sel of selectors) {
      for (const el of Array.from(document.querySelectorAll(sel)).slice(0, 5)) {
        const e = el as HTMLElement;
        let customAttr: string | null = null;
        let attrName: string | null = null;
        for (const a of attrs) {
          const v = e.getAttribute(a);
          if (v) { customAttr = v; attrName = a; break; }
        }
        found.push({
          tag: e.tagName.toLowerCase(),
          text: (e.innerText || e.getAttribute('placeholder') || e.getAttribute('aria-label') || '').trim().slice(0, 50),
          customAttr, attrName,
          id: e.getAttribute('id'),
          role: e.getAttribute('role'),
          cls: (e.className || '').toString().split(/\s+/).filter(c => c.length >= 3)[0] || null,
        });
      }
    }
    return found.slice(0, 20);
  }, INSPECTOR_CONFIG.locatorAttributes);

  console.log('\n  📋 Найденные интерактивные элементы:');
  elements.forEach((el, i) => {
    const parts: string[] = [`<${el.tag}>`];
    if (el.customAttr && el.attrName) parts.push(`[${el.attrName}="${el.customAttr}"]  ← P1`);
    else if (el.id)   parts.push(`#${el.id}  ← P1 (id)`);
    else if (el.role) parts.push(`role="${el.role}"  ← P2`);
    else if (el.text) parts.push(`"${el.text}"  ← P3`);
    else if (el.cls)  parts.push(`.${el.cls}  ← P5`);
    console.log(`  ${String(i + 1).padStart(2)}. ${parts.join(' ')}`);
  });

  console.log('\n' + '─'.repeat(62));
  console.log('  ✅ Разведка завершена. Браузер открыт для ручного тестирования.');
  console.log('  ⏹  Закройте браузер или Ctrl+C для завершения.');
  console.log('─'.repeat(62) + '\n');

  await page.waitForEvent('close', { timeout: 0 });
});

// ─── Демо Self-Healing (раскомментируйте для проверки) ───────────────────────
//
// test('🛠 Demo Self-Healing — намеренно неверный локатор', async ({ page }) => {
//   await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
//
//   // Укажите намеренно неверный локатор (с опечаткой или устаревший).
