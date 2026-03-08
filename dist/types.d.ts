/**
 * Опции для управления поведением Smart Inspector.
 * Передаются через фикстуру `smartInspector` в конфигурации теста.
 */
export interface SmartInspectorOptions {
    /**
     * Включает/выключает браузерный инспектор и механизм Self-Healing.
     * По умолчанию: true
     */
    enabled: boolean;
    /**
     * Кастомные data-атрибуты — Priority 1 при поиске локаторов.
     * Проверяются в порядке массива — первый найденный побеждает.
     * По умолчанию: ["data-testid", "data-test-id", "data-e2e", "test-id"]
     */
    locatorAttributes?: string[];
    /**
     * Клавиша-модификатор для активации инспектора (кликнуть с зажатой клавишей).
     *
     * Рекомендации по платформам:
     *   - Windows / Linux : 'alt'  (Alt+Click)
     *   - macOS           : 'meta' (Cmd+Click)
     *
     * Если не задано — определяется автоматически:
     *   macOS → 'meta', остальные → 'alt'
     *
     * Допустимые значения: 'alt' | 'ctrl' | 'shift' | 'meta'
     */
    activationKey?: 'alt' | 'ctrl' | 'shift' | 'meta';
}
/**
 * Тип фикстур для регистрации через test.extend<T>().
 * Пользователь может переопределить опции через use({ smartInspector: { enabled: false } }).
 */
export interface SmartInspectorFixtures {
    smartInspector: SmartInspectorOptions;
}
/** Полный результат Alt+Click — все варианты локаторов для выбора */
export interface LocatorPayload {
    /** Лучший Playwright-локатор по приоритету стратегий */
    playwrightLocator: string;
    /** Дополнительный locator(tag).nth(index), не зависящий от текста */
    indexBasedLocator: string;
    /** URL вкладки, где был клик в момент генерации локатора */
    pageUrl: string;
    /** Стабильный CSS-селектор (без позиционных div[2]/span[1]) */
    cssSelector: string;
    /** XPath от ближайшего стабильного предка — НЕ от корня документа */
    xpath: string;
    /** Использованная стратегия */
    strategy: string;
    /** HTML-тег элемента */
    tagName: string;
}
/**
 * Один кандидат-альтернатива, найденный механизмом Self-Healing.
 * Содержит предлагаемый селектор, причину и оценку релевантности.
 */
export interface LocatorCandidate {
    /** Предлагаемый CSS/XPath/Playwright-локатор */
    selector: string;
    /** Человекочитаемое объяснение, почему кандидат был предложен */
    reason: string;
    /**
     * Оценка релевантности (0–100):
     * - 100: точное совпадение текста/атрибута
     * - 60:  частичное совпадение текста
     * - 40:  совпадение атрибута (data-testid, placeholder и т.д.)
     */
    score: number;
}
/**
 * Итоговый отчёт Self-Healing для одного упавшего теста.
 * Содержит оригинальный упавший селектор и список кандидатов на замену.
 */
export interface HealingReport {
    /** Селектор, извлечённый из сообщения об ошибке Playwright */
    failedSelector: string;
    /** Список альтернативных кандидатов, отсортированных по score DESC */
    candidates: LocatorCandidate[];
}
