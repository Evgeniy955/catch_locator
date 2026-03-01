/**
 * inspector-script.ts — Браузерный IIFE, инжектируется через page.addInitScript().
 * Конфиг принимается через window.__smartInspectorConfig (устанавливается ДО этого скрипта).
 *
 * Приоритеты Playwright-локатора (нативные методы Playwright):
 *   P1: getByTestId()       — кастомные data-атрибуты + стабильный id
 *   P2: getByRole()         — ARIA role + accessible name
 *   P3: getByLabel()        — label[for] или обёртка <label>
 *       getByPlaceholder()  — placeholder
 *       getByAltText()      — alt (img)
 *       getByTitle()        — title
 *       getByText()         — видимый текст
 *   P4: locator([name=])    — name-атрибут
 *   P5: locator(.class)     — семантический класс (НЕ Tailwind-утилиты)
 *
 * CSS-селектор: tag#id / tag[attr] / tag.class / input[type] / составной через предка
 *
 * XPath: ТОЛЬКО от предка с id или кастомным data-атрибутом.
 *        Tailwind-классы (min-h-screen, flex-grow, text-3xl...) НЕ используются.
 *        Если стабильный якорь не найден в 6 уровнях — XPath = '' (не генерируется).
 */
export declare const inspectorScript: string;
