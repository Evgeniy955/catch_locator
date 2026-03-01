# 🔍 Как использовать инспектор локаторов

---

## Быстрый старт — `inspect.spec.ts`

Это мини-тест для поиска локаторов на любой странице.  
Запускается **отдельно** от ваших тестов — ничего не ломает.

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
```

### 2. Запустите

```bash
npm run inspect
```

### 3. Используйте инспектор в браузере

- Зажмите **`Alt`** и кликните на любой элемент
- Элемент подсветится красной рамкой
- В терминале появятся локаторы:

```
══════════════════════════════════════════════════════════════
[Inspector] 📍 Element: <button>  Strategy: role
──────────────────────────────────────────────────────────────
  Playwright  : page.getByRole("button", { name: "Генерировать" })
  CSS         : button:has-text("Генерировать")
  XPath       : //button[normalize-space()="Генерировать"]
──────────────────────────────────────────────────────────────
  📋 Copied   : page.getByRole("button", { name: "Генерировать" })
══════════════════════════════════════════════════════════════
```

- Playwright-локатор **автоматически скопируется** в буфер обмена
- Вставьте его в тест: `Ctrl+V`

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

> Подробнее — см. [README.md](./README.md)

