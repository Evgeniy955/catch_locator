# playwright-smart-inspector

> Расширение `@playwright/test` с интерактивным браузерным инспектором локаторов и механизмом Self-Healing — автоматического предложения альтернативных локаторов при падении тестов.

---

## Содержание

- [Возможности](#возможности)
- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Interactive Inspector (Alt+Click)](#interactive-inspector-altclick)
- [Self-Healing](#self-healing)
- [API](#api)
- [Конфигурация](#конфигурация)
- [Архитектура](#архитектура)
- [Структура проекта](#структура-проекта)

---

## Возможности

| Компонент | Описание |
|---|---|
| 🔍 **Interactive Inspector** | Зажмите `Alt` и кликните на любой элемент — библиотека сгенерирует оптимальный Playwright-локатор и скопирует его в буфер обмена |
| 🛠 **Self-Healing** | При падении теста автоматически анализирует DOM и предлагает до 3 альтернативных локаторов с оценкой релевантности |
| 🌑 **Shadow DOM** | Корректно определяет элементы внутри Shadow DOM через `composedPath()` |
| ⚡ **Zero config** | Работает из коробки — просто замените импорт `test` из `@playwright/test` на импорт из этой библиотеки |
| 🔧 **Управляемый** | Инспектор и Self-Healing отключаются per-test через `test.use({ smartInspector: { enabled: false } })` |

---

## Установка

```bash
npm install --save-dev playwright-smart-inspector
```

> **Peer dependency:** требуется `@playwright/test >= 1.40.0`

---

## Быстрый старт

Замените стандартный импорт в тест-файле:

```typescript
// ❌ Было:
import { test, expect } from '@playwright/test';

// ✅ Стало:
import { test, expect } from 'playwright-smart-inspector';
```

Больше никаких изменений не требуется. Фикстура активируется автоматически.

```typescript
import { test, expect } from 'playwright-smart-inspector';

test('форма логина', async ({ page }) => {
  await page.goto('https://example.com/login');

  // Зажмите Alt и кликните на любой элемент во время отладки —
  // локатор появится в консоли терминала и скопируется в буфер обмена

  await page.locator('[data-testid="username"]').fill('user@example.com');
  await page.locator('[data-testid="password"]').fill('secret');
  await page.locator('[data-testid="submit-btn"]').click();

  await expect(page).toHaveURL('/dashboard');
});
```

---

## Interactive Inspector (Alt+Click)

### Как использовать

1. Запустите тест в **headed-режиме**: `npx playwright test --headed`
2. В браузере зажмите `Alt` и кликните на любой элемент
3. Результат появится в консоли терминала и автоматически скопируется в буфер обмена

### Пример вывода в терминале

```
[Inspector] 📍 Locator generated:
  Selector : [data-testid="submit-button"]
  Strategy : data-testid
  XPath    : //*[@data-testid="submit-button"]
  Tag      : <button>
  Copied to clipboard ✅
```

### Стратегия генерации локаторов (по приоритету)

| Приоритет | Стратегия | Пример |
|---|---|---|
| 1 | `data-testid` | `[data-testid="submit-btn"]` |
| 2 | ARIA role + name | `role=button[name="Submit"]` |
| 3 | Label | `label=Email address` |
| 4 | Placeholder | `[placeholder="Enter email"]` |
| 5 | Text | `text=Submit` |
| 6 | XPath fallback | `//*[@id="form"]/button` |

**XPath Fallback:** строится от ближайшего предка с `id` или `data-testid`, пропуская структурные `div/span` без атрибутов.

---

## Self-Healing

При падении теста (`failed` или `timedOut`) механизм Self-Healing автоматически:

1. Извлекает упавший селектор из текста ошибки Playwright
2. Выполняет DOM-анализ через `page.evaluate()` (не парсит HTML-строку)
3. Ищет элементы с похожим текстом или атрибутами
4. Выводит топ-3 кандидата с оценкой релевантности

### Пример вывода Self-Healing

```
────────────────────────────────────────────────────────────
[Self-Healing] ❌ Locator failed: '[data-testid="sumbit-btn"]'

[Self-Healing] 💡 Suggested fix #1: '[data-testid="submit-btn"]'
[Self-Healing] 🛠  Reason: Element with matching attribute data-testid="submit-btn" found but selector structure changed.
[Self-Healing] 📊 Score: 40/100

[Self-Healing] 💡 Suggested fix #2: 'text=Submit'
[Self-Healing] 🛠  Reason: Element with similar text content found. Text: "submit..."
[Self-Healing] 📊 Score: 60/100
────────────────────────────────────────────────────────────
```

### Система скоринга

| Score | Условие |
|---|---|
| **100** | Точное совпадение текста элемента с искомым |
| **60** | Частичное совпадение текста (подстрока) |
| **40** | Совпадение атрибута (`data-testid`, `id`, `aria-label`, `placeholder`, `class`) |

---

## API

### `test`

Расширенный `test` из `@playwright/test`. Поддерживает все стандартные методы: `test.describe`, `test.beforeEach`, `test.afterEach`, `test.use` и т.д.

```typescript
import { test } from 'playwright-smart-inspector';

test('название теста', async ({ page }) => { ... });
test.describe('группа', () => { ... });
test.beforeEach(async ({ page }) => { ... });
```

### `expect`

Реэкспорт стандартного `expect` из `@playwright/test` — без изменений.

```typescript
import { expect } from 'playwright-smart-inspector';
```

### Фикстура `smartInspector`

Доступна внутри тела теста. Содержит текущие опции.

```typescript
test('пример', async ({ page, smartInspector }) => {
  console.log(smartInspector.enabled); // true
});
```

---

## Конфигурация

### Отключить глобально (в `playwright.config.ts`)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Отключить Inspector и Self-Healing для всех тестов
    smartInspector: { enabled: false },
  },
});
```

### Отключить для файла или группы

```typescript
import { test } from 'playwright-smart-inspector';

test.use({ smartInspector: { enabled: false } });

test('этот тест без инспектора', async ({ page }) => { ... });
```

### Отключить для одного теста

```typescript
test('без инспектора', async ({ page }) => {
  test.use({ smartInspector: { enabled: false } });
  // ...
});
```

---

## Ручное тестирование на реальном сайте

Для проверки библиотеки вживую на https://www.onlytests.io/ru/tools/text-generator используется отдельный конфиг и тест-файл.

### Запуск

```bash
npm run test:manual
```

### Что произойдёт

1. Откроется браузер **Chromium** (headed-режим)
2. Загрузится страница `https://www.onlytests.io/ru/tools/text-generator`
3. В консоли браузера появится подтверждение активации:
   ```
   [SmartInspector] ✅ Activated. Hold Alt and click any element to inspect its locator.
   ```
4. Откроется панель **Playwright Inspector** с кнопкой Resume

### Тестирование Inspector (Alt+Click)

- Зажмите `Alt` и кликните на **любой элемент** страницы
- В терминале появится блок:
  ```
  [Inspector] 📍 Locator generated:
    Selector : [data-testid="generate-btn"]
    Strategy : data-testid
    XPath    : //*[@data-testid="generate-btn"]
    Tag      : <button>
    Copied to clipboard ✅
  ```
- Локатор **автоматически скопируется** в буфер обмена

### Тестирование Self-Healing

Раскомментируйте блок `Demo Self-Healing` в конце `tests/manual-inspector.spec.ts`, укажите намеренно неверный локатор и запустите тест повторно:

```typescript
await page.locator('[data-testid="generate-button-old"]').click({ timeout: 3000 });
```

В терминале появится Self-Healing отчёт:
```
────────────────────────────────────────────────────────────
[Self-Healing] ❌ Locator failed: '[data-testid="generate-button-old"]'

[Self-Healing] 💡 Suggested fix #1: '[data-testid="generate-btn"]'
[Self-Healing] 🛠  Reason: Element with matching attribute data-testid="generate-btn" found but selector structure changed.
[Self-Healing] 📊 Score: 40/100
────────────────────────────────────────────────────────────
```

### Demo-тест: разведка элементов страницы

```bash
# Запускает только Demo-тест с перечнем всех интерактивных элементов
npm run test:manual -- --grep "Demo"
```

В терминале выведется таблица найденных элементов:
```
  📋 Найденные интерактивные элементы на странице:
   1. <button> [data-testid="generate-btn"] "Сгенерировать"
   2. <input>  [placeholder="Введите тему..."]
   ...
```

### Файлы

| Файл | Назначение |
|---|---|
| `playwright.manual.config.ts` | Конфиг: headed, без таймаута, разрешения clipboard |
| `tests/manual-inspector.spec.ts` | Тест с `page.pause()` + Demo-тест разведки элементов |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Node.js (Playwright)                  │
│                                                         │
│  test.extend<SmartInspectorFixtures>()                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │  page fixture (wrapper)                         │    │
│  │                                                 │    │
│  │  setup:  page.exposeFunction('onLocatorGenerated')   │
│  │          page.addInitScript(inspectorScript)    │    │
│  │                                                 │    │
│  │  teardown: Self-Healing (если failed/timedOut)  │    │
│  │    └─ extractFailedSelector(error.message)      │    │
│  │    └─ page.evaluate() → DOM queries → candidates│    │
│  │    └─ printHealingReport(top-3 by score)        │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │ exposeFunction bridge
                     │ (window.onLocatorGenerated)
┌────────────────────▼────────────────────────────────────┐
│                   Browser (Vanilla JS IIFE)              │
│                                                         │
│  document.addEventListener('click', handler, capture)   │
│                                                         │
│  Alt+Click → composedPath()[0]  ← Shadow DOM support   │
│           → стратегии локаторов (data-testid/role/...)  │
│           → buildFallbackXPath()                        │
│           → window.onLocatorGenerated(payload)          │
│           → navigator.clipboard.writeText(selector)     │
│           → element.style.outline (подсветка 1.5s)      │
└─────────────────────────────────────────────────────────┘
```

### Ключевые технические решения

- **`test.extend<T>()`** — стандартный механизм Playwright Fixtures, не требует monkey-patching
- **`page.exposeFunction()`** — безопасный мост Node.js ↔ Browser без `evaluate`-хаков
- **`page.addInitScript()`** — скрипт переинжектируется автоматически при каждой навигации
- **`composedPath()[0]`** — единственный надёжный способ получить элемент внутри Shadow DOM
- **`page.evaluate()` для Self-Healing** — DOM-запросы в контексте браузера точнее и безопаснее, чем regex по HTML-строке
- **`{ option: true }`** — флаг Playwright, позволяющий переопределять значение через `test.use()`

---

## Структура проекта

```
src/
├── types.ts              — интерфейсы (SmartInspectorOptions, LocatorCandidate, HealingReport)
├── inspector-script.ts   — браузерный IIFE как TypeScript-строка
└── index.ts              — главный модуль (test.extend, exposeFunction, Self-Healing)

dist/                     — скомпилированный JS + .d.ts (генерируется через npm run build)
├── index.js / index.d.ts
├── inspector-script.js / inspector-script.d.ts
└── types.js / types.d.ts
```

### Сборка

```bash
npm run build
```

---

## Лицензия

Private — только для внутреннего использования.

