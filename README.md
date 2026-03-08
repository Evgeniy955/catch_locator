# playwright-smart-inspector

> Расширение `@playwright/test` с интерактивным браузерным инспектором локаторов и механизмом **Self-Healing** — автоматического предложения альтернативных локаторов при падении тестов.

---

## Содержание

- [Возможности](#возможности)
- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Interactive Inspector](#interactive-inspector)
- [Self-Healing](#self-healing)
- [Конфигурация](#конфигурация)
- [API](#api)
- [Архитектура](#архитектура)
- [Структура проекта](#структура-проекта)

---

## Возможности

| Компонент | Описание |
|---|---|
| 🔍 **Interactive Inspector** | Зажмите модификатор и кликните на элемент — библиотека сгенерирует Playwright-локатор, CSS и XPath, скопирует лучший вариант в буфер обмена |
| 🛠 **Self-Healing** | При падении теста анализирует DOM и предлагает до 3 альтернативных локаторов с оценкой релевантности |
| 🌑 **Shadow DOM** | Корректно определяет элементы внутри Shadow DOM через `composedPath()` |
| ⚡ **Zero config** | Работает из коробки — просто замените импорт `test` |
| 🔧 **Управляемый** | Отключается per-test через `test.use({ smartInspector: { enabled: false } })` |
| 🏷 **Кастомные атрибуты** | Настройте свои `data-*` атрибуты (`data-cy`, `data-qa`, `data-e2e`) — они будут проверяться первыми |
| 🖥 **Кросс-платформенный** | `Alt+Click` на Windows/Linux, `Cmd+Click` на macOS — определяется автоматически |

---

## Установка

### Из GitHub (рекомендуется)

```bash
# HTTPS
npm install --save-dev https://github.com/Evgeniy955/catch_locator

# SSH
npm install --save-dev git+ssh://git@github.com:Evgeniy955/catch_locator.git

# Конкретная ветка
npm install --save-dev github:Evgeniy955/catch_locator#master
```

> **Peer dependency:** требуется `@playwright/test >= 1.40.0`

---

## Быстрый старт

### 1. Замените импорт в тест-файле

```typescript
// ❌ Было:
import { test, expect } from '@playwright/test';

// ✅ Стало:
import { test, expect } from 'playwright-smart-inspector';
```

Больше никаких изменений не требуется. Фикстура активируется автоматически.

### 2. Опционально — настройте кастомные атрибуты

Если в вашем проекте используются нестандартные `data-*` атрибуты:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    smartInspector: {
      enabled: true,
      locatorAttributes: ['data-cy', 'data-qa', 'data-testid', 'data-e2e'],
    },
  },
});
```

### 3. Запустите инспектор

**Вариант А — мини-тест `inspect.spec.ts` (рекомендуется):**

```bash
npm run inspect
```

Откроется браузер только с одним тестом-инспектором. Не затрагивает остальные тесты проекта.

**Вариант Б — конкретный тест из вашего проекта:**

```bash
# Запустить один файл с тестом
npx playwright test tests/my-test.spec.ts --headed

# Запустить один тест по названию
npx playwright test --headed --grep "название теста"

# Запустить один тест по названию в конкретном файле
npx playwright test tests/my-test.spec.ts --headed --grep "название теста"
```

Зажмите клавишу-модификатор и кликните на любой элемент — локаторы появятся в терминале.

---

## Interactive Inspector

### Клавиша активации по платформе

| Платформа | Клавиша | Причина |
|---|---|---|
| **Windows / Linux** | `Alt+Click` | Стандартная работа |
| **macOS** | `Cmd+Click` | На Mac `Ctrl+Click` часто открывает контекстное меню |

Клавиша определяется **автоматически** по `process.platform`. Можно переопределить явно через `activationKey` (см. [Конфигурация](#конфигурация)).

### Как использовать

1. Запустите тест в **headed-режиме**: `npx playwright test --headed`
2. В браузере зажмите нужную клавишу (`Alt` или `Cmd`) и кликните на элемент
3. Элемент подсветится красной рамкой на 1.5 секунды
4. В терминале появятся все варианты локаторов
5. Playwright-локатор **автоматически скопируется** в буфер обмена

### Пример вывода в терминале

```
══════════════════════════════════════════════════════════════
[Inspector] 📍 Element: <textarea>  Strategy: placeholder
──────────────────────────────────────────────────────────────
  Playwright  : page.getByPlaceholder("Введите ваш текст здесь...")
  CSS         : textarea[placeholder="Введите ваш текст здесь..."]
  XPath       : //textarea[@placeholder="Введите ваш текст здесь..."]
──────────────────────────────────────────────────────────────
  📋 Copied   : page.getByPlaceholder("Введите ваш текст здесь...")
  💡 Tip      : Alt+Click to inspect next element
══════════════════════════════════════════════════════════════
```

### Если вывод дублируется

Если блоки `[Inspector]` печатаются по 2 раза, обычно проблема в запуске теста из IDE (двойной процесс/раннер), а не в генерации локаторов.

```bash
npm run inspect -- --list
npm run inspect -- --project=chromium-manual --workers=1 --retries=0 --repeat-each=1
```

Проверьте, что:

- используется один run config (или запуск через `npm run inspect`)
- в IDE не включены несколько `project`
- тест не запускается с повторениями

В библиотеке уже есть dedupe-защита на двух уровнях: Browser-side (`PAYLOAD_DEDUPE_WINDOW_MS` в `src/inspector-script.ts`) и Node-side (`shouldPrintLocatorEvent()` в `src/index.ts`).

### Приоритеты генерации локаторов

#### Playwright-локатор (нативные методы)

| Приоритет | Стратегия | Пример |
|---|---|---|
| **P1** | `getByTestId()` / кастомный атрибут / `id` | `page.getByTestId("submit-btn")` |
| **P2** | `getByRole()` | `page.getByRole("button", { name: "Submit" })` |
| **P3** | `getByLabel()` / `getByPlaceholder()` / `getByAltText()` / `getByTitle()` / `getByText()` | `page.getByPlaceholder("Email")` |
| **P4** | `locator([name=])` | `page.locator("[name=\"email\"]")` |
| **P5** | `locator(tag.semantic-class)` | `page.locator("button.submit-btn")` |

#### CSS-селектор

| Приоритет | Пример |
|---|---|
| Кастомный атрибут | `[data-testid="submit"]` |
| Stable `id` | `button#submit-btn` |
| Семантический класс | `button.submit-btn` |
| `name` / `placeholder` / `aria-label` | `input[placeholder="Email"]` |
| Тег с текстом | `button:has-text("Submit")` |
| Предок с якорем + тег | `div.form-card input` |

#### XPath

| Приоритет | Пример |
|---|---|
| Кастомный атрибут | `//*[@data-testid="submit"]` |
| Stable `id` | `//button[@id="submit-btn"]` |
| `placeholder` | `//textarea[@placeholder="Введите текст"]` |
| `aria-label` | `//input[@aria-label="Email"]` |
| `name` | `//input[@name="email"]` |
| Видимый текст | `//button[normalize-space()="Submit"]` |
| Семантический класс | `//div[contains(@class,"form-card")]//input` |

> ⚠️ **Позиционные XPath** (`//div/main/div[4]/textarea`) **не генерируются**.
> Если стабильный якорь не найден в 8 уровнях — XPath возвращается пустым.

---

## Self-Healing

При падении теста (`failed` или `timedOut`) механизм автоматически:

1. Извлекает упавший селектор из текста ошибки Playwright
2. Выполняет DOM-анализ через `page.evaluate()`
3. Ищет элементы с похожим текстом или атрибутами
4. Выводит топ-3 кандидата с оценкой релевантности

### Пример вывода

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
| **100** | Точное совпадение текста элемента |
| **60** | Частичное совпадение текста (подстрока) |
| **40** | Совпадение атрибута (`data-testid`, `id`, `aria-label`, `placeholder`, `class`) |

---

## Конфигурация

### `SmartInspectorOptions`

```typescript
interface SmartInspectorOptions {
  /** Включить/выключить инспектор и Self-Healing. По умолчанию: true */
  enabled: boolean;

  /** Кастомные data-атрибуты — Priority 1.
   *  По умолчанию: ['data-testid', 'data-test-id', 'data-e2e', 'test-id'] */
  locatorAttributes?: string[];

  /**
   * Клавиша-модификатор для активации инспектора.
   *
   * Если не задана — определяется автоматически:
   *   macOS  → 'meta'  (Cmd+Click)
   *   другие → 'alt'   (Alt+Click)
   *
   * Переопределить явно:
   *   'alt' | 'ctrl' | 'shift' | 'meta'
   */
  activationKey?: 'alt' | 'ctrl' | 'shift' | 'meta';
}
```

### Глобально в `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    smartInspector: {
      enabled: true,
      locatorAttributes: ['data-cy', 'data-qa', 'data-testid'],
      // activationKey не указан → определяется автоматически по платформе
    },
  },
});
```

### Явно указать клавишу (переопределение)

```typescript
// Принудительно Cmd+Click на любой платформе
test.use({
  smartInspector: {
    enabled: true,
    activationKey: 'meta',
  },
});
```

### Отключить для конкретного файла или группы

```typescript
import { test } from 'playwright-smart-inspector';

test.use({ smartInspector: { enabled: false } });

test('без инспектора', async ({ page }) => { ... });
```

---

## API

### `test`

Расширенный `test` из `@playwright/test`. Поддерживает все стандартные методы.

```typescript
import { test } from 'playwright-smart-inspector';

test('название', async ({ page }) => { ... });
test.describe('группа', () => { ... });
test.beforeEach(async ({ page }) => { ... });
test.use({ smartInspector: { enabled: false } });
```

### `expect`

Реэкспорт стандартного `expect` из `@playwright/test` без изменений.

```typescript
import { expect } from 'playwright-smart-inspector';
```

### Фикстура `smartInspector`

```typescript
test('пример', async ({ page, smartInspector }) => {
  console.log(smartInspector.enabled);           // true
  console.log(smartInspector.locatorAttributes); // ['data-testid', ...]
  console.log(smartInspector.activationKey);     // 'alt' | 'ctrl' | 'shift' | 'meta' | undefined
});
```

---

## Ручное тестирование

### Вариант 1 — мини-тест `inspect.spec.ts` (не затрагивает ваши тесты)

Скопируйте файл `tests/inspect.spec.ts` в свой проект, укажите URL и запустите:

```typescript
// inspect.spec.ts — меняйте только эти переменные:

const TARGET_URL = 'https://your-project.com/page-to-inspect';

const LOCATOR_ATTRIBUTES = [
  'data-testid',
  'data-cy',     // если используете Cypress-атрибуты
  'data-qa',
];

// activationKey не нужен — определится автоматически
// macOS → Cmd+Click, Windows/Linux → Alt+Click
```

```bash
# Запустить мини-тест инспектора
npm run inspect

# Или напрямую через Playwright
npx playwright test tests/inspect.spec.ts --headed
```

---

### Вариант 2 — запустить конкретный тест из вашего проекта

```bash
# Один файл целиком
npx playwright test tests/checkout.spec.ts --headed

# Один тест по названию (частичное совпадение)
npx playwright test --headed --grep "checkout page"

# Один тест по названию в конкретном файле
npx playwright test tests/checkout.spec.ts --headed --grep "checkout page"

# С конкретным браузером
npx playwright test tests/checkout.spec.ts --headed --project=chromium
```

> 💡 Замените импорт в тест-файле на `playwright-smart-inspector` — инспектор активируется автоматически без других изменений.

---

### Доступные скрипты

```bash
npm run inspect            # мини-тест поиска локаторов (tests/inspect.spec.ts)
npm run test:manual        # полный ручной тест (tests/manual-inspector.spec.ts)
npm run test:manual:demo   # только Demo-тест (разведка элементов страницы)
```

### Обновление библиотеки

```bash
npm install --save-dev github:Evgeniy955/catch_locator#master
```

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
│  │  setup:  addInitScript(config)                  │    │
│  │            └─ locatorAttributes                 │    │
│  │            └─ activationKey (auto: darwin→meta, │    │
│  │                              other →alt)        │    │
│  │          exposeFunction('onLocatorGenerated')   │    │
│  │          addInitScript(inspectorScript)         │    │
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
│  window.__smartInspectorConfig                          │
│    └─ locatorAttributes, activationKey                  │
│                                                         │
│  document.addEventListener('pointerdown', handler, capture) │
│                                                         │
│  {Key}+Click → composedPath()[0] ← Shadow DOM support  │
│             → P1: getByTestId / id                      │
│             → P2: getByRole                             │
│             → P3: getByLabel/Placeholder/Text           │
│             → P4: locator([name=])                      │
│             → P5: locator(tag.semantic-class)           │
│             → buildCss()  ← без позиционных путей       │
│             → buildXPath() ← якорь: attr/id/placeholder │
│             → window.onLocatorGenerated(payload)        │
│             → navigator.clipboard.writeText(pw)         │
│             → element.style.outline (подсветка 1.5s)    │
└─────────────────────────────────────────────────────────┘
```

### Ключевые технические решения

| Решение | Зачем |
|---|---|
| `test.extend<T>()` | Стандартный механизм Playwright Fixtures, без monkey-patching |
| `page.exposeFunction()` | Безопасный мост Browser → Node.js |
| `page.addInitScript()` | Переинжектируется автоматически при каждой навигации |
| `composedPath()[0]` | Единственный надёжный способ получить элемент внутри Shadow DOM |
| `page.evaluate()` | DOM-запросы точнее regex по HTML-строке |
| `{ option: true }` | Флаг Playwright, позволяет переопределять через `test.use()` |
| `process.platform` | Авто-определение клавиши: `darwin` → `meta`, остальные → `alt` |

---

## Структура проекта

```
src/
├── types.ts                — интерфейсы (SmartInspectorOptions, LocatorPayload, HealingReport)
├── inspector-script.ts     — браузерный IIFE (Vanilla JS как TS-строка)
└── index.ts                — главный модуль (test.extend, exposeFunction, Self-Healing)

tests/
├── inspect.spec.ts         — ⭐ мини-тест для быстрого поиска локаторов (менять только URL)
└── manual-inspector.spec.ts — полный тест с разведкой интерактивных элементов

dist/                       — скомпилированный JS + .d.ts (коммитится в Git)
├── index.js / index.d.ts
├── inspector-script.js / inspector-script.d.ts
└── types.js / types.d.ts

tsconfig.json               — конфиг для IDE (noEmit, покрывает src/ + tests/)
tsconfig.build.json         — конфиг для сборки (только src/ → dist/)
playwright.config.ts        — конфиг для ручного тестирования
```

### Сборка

```bash
npm run build   # tsc -p tsconfig.build.json → генерирует dist/
```

---

## Лицензия

Private — только для внутреннего использования.

