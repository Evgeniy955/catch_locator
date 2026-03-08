# 🔍 Как использовать инспектор локаторов

---

## Клавиша активации по платформе

| Платформа | Клавиша | Примечание |
|---|---|---|
| **Windows / Linux** | `Alt+Click` | Стандартная работа |
| **macOS** | `Cmd+Click` | На Mac `Ctrl+Click` обычно открывает контекстное меню |

Клавиша определяется **автоматически** — ничего настраивать не нужно.  
Для ручного переопределения используйте `activationKey` в опциях (см. ниже).

---

## Быстрый старт — `inspect.spec.ts`

Это мини-тест для поиска локаторов на любой странице.
Запускается **отдельно** от ваших тестов — ничего не ломает.

Инспектор работает не только в текущей вкладке: новые popups/tabs в этом же Playwright context тоже автоматически поддерживаются.

### 1. Настройте файл `tests/inspect.spec.ts`

Измените только две переменные в начале файла:

```typescript
// ↓↓↓ УКАЖИТЕ URL СТРАНИЦЫ КОТОРУЮ ХОТИТЕ ИССЛЕДОВАТЬ ↓↓↓
const TARGET_URL = 'https://your-project.com/page-to-inspect';

// ↓↓↓ УКАЖИТЕ КАСТОМНЫЕ data-* АТРИБУТЫ ВАШЕГО ПРОЕКТА ↓↓↓
const LOCATOR_ATTRIBUTES = [
  'data-testid',
  'data-cy',    // Cypress
  'data-qa',
  'data-e2e',
];

// activationKey не нужен — определится автоматически:
//   macOS        → Cmd+Click
//   Windows/Linux → Alt+Click
```

### 2. Запустите

```bash
npm run inspect
```

### 3. Используйте инспектор в браузере

- **Windows/Linux:** зажмите **`Alt`** и кликните на любой элемент
- **macOS:** зажмите **`Cmd`** и кликните на любой элемент
- Элемент подсветится красной рамкой
- В терминале появятся локаторы и URL текущей вкладки:

```
══════════════════════════════════════════════════════════════
[Inspector] 📍 Element: <button>  Strategy: role
──────────────────────────────────────────────────────────────
  URL         : https://demoqa.com/automation-practice-form
  Playwright  : page.getByRole("button", { name: "Submit" })
  By index    : page.locator("button").nth(0)
  CSS         : button:has-text("Submit")
  XPath       : //button[normalize-space()="Submit"]
──────────────────────────────────────────────────────────────
  📋 Copied   : page.getByRole("button", { name: "Submit" })
  💡 Tip      : Cmd+Click to inspect next element
══════════════════════════════════════════════════════════════
```

- Playwright-локатор **автоматически скопируется** в буфер обмена
- `By index` не использует `hasText`, поэтому текст удобно проверять отдельно в тесте
- Вставьте локатор в тест: `Ctrl+V` / `Cmd+V`

### 4. Завершение

Закройте браузер или нажмите `Ctrl+C` в терминале.

---

## Запуск конкретного теста из вашего проекта

Если хотите исследовать страницу в контексте существующего теста — замените импорт и запустите тест точечно.

### Шаг 1 — замените импорт в тест-файле

```typescript
// ❌ Было:
import { test, expect } from '@playwright/test';

// ✅ Стало:
import { test, expect } from 'playwright-smart-inspector';
```

### Шаг 2 — запустите только нужный тест

```bash
# Один файл целиком
npx playwright test tests/checkout.spec.ts --headed

# Один тест по названию (частичное совпадение)
npx playwright test --headed --grep "название теста"

# Файл + название теста
npx playwright test tests/checkout.spec.ts --headed --grep "checkout page"

# С конкретным браузером
npx playwright test tests/checkout.spec.ts --headed --project=chromium
```

---

## Все доступные скрипты

| Команда | Описание |
|---|---|
| `npm run inspect` | Мини-тест — открывает `inspect.spec.ts` |
| `npm run test:manual` | Полный ручной тест `manual-inspector.spec.ts` |
| `npm run test:manual:demo` | Только Demo-тест (разведка всех элементов страницы) |

---

## Использование в рабочем проекте

Скопируйте `tests/inspect.spec.ts` в свой проект, замените импорт:

```typescript
// inspect.spec.ts в вашем проекте
import { test, expect } from 'playwright-smart-inspector';

const TARGET_URL = 'https://your-project.com';
const LOCATOR_ATTRIBUTES = ['data-cy', 'data-testid'];

test.use({
  smartInspector: {
    enabled: true,
    locatorAttributes: LOCATOR_ATTRIBUTES,
    // activationKey не указан → определится автоматически:
    //   macOS         → 'meta'  (Cmd+Click)
    //   Windows/Linux → 'alt'   (Alt+Click)
    //
    // Переопределить явно (если нужно):
    // activationKey: 'meta',
  },
});

test('🔍 Inspect — поиск локаторов', async ({ page }) => {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.waitForEvent('close', { timeout: 0 });
});
```

Запуск:

```bash
npx playwright test tests/inspect.spec.ts --headed
```

---

## Приоритеты локаторов

| Приоритет | Метод | Пример |
|---|---|---|
| **P1** | `getByTestId()` / кастомный атрибут / `id` | `page.getByTestId("btn-submit")` |
| **P2** | `getByRole()` | `page.getByRole("button", { name: "Submit" })` |
| **P3** | `getByLabel()` / `getByPlaceholder()` / `getByText()` | `page.getByPlaceholder("Email")` |
| **P4** | `locator([name=])` | `page.locator("[name=\"email\"]")` |
| **P5** | `locator(tag.class)` | `page.locator("button.submit-btn")` |

Дополнительно всегда выводится `By index`: `page.locator("...").nth(index)`.
Он нужен как текст-независимый локатор для проверок вида `await expect(locator).toHaveText(...)`.

> Подробнее — см. [README.md](./README.md)

## Если вывод дублируется

Если `[Inspector]` блоки появляются по 2 раза, обычно проблема в запуске теста (двойной run config, несколько `project`, retries/repeat), а не в генерации локатора.

Проверьте запуск:

```bash
npm run inspect -- --list
npm run inspect -- --project=chromium-manual --workers=1 --retries=0 --repeat-each=1
```

Что важно:

- запускайте через npm-скрипт `inspect` (или один Playwright run config)
- убедитесь, что не включены несколько `project` в раннере IDE
- не используйте одновременно `repeat-each`/`retries`, если отлаживаете инспектор
- в библиотеке есть защита от дублей на Browser-side и Node-side
