/**
 * Опции для управления поведением Smart Inspector.
 * Передаются через фикстуру `smartInspector` в конфигурации теста.
 */
export interface SmartInspectorOptions {
  /**
   * Включает/выключает браузерный инспектор (Alt+Click) и механизм Self-Healing.
   * По умолчанию: true
   */
  enabled: boolean;
}

/**
 * Тип фикстур для регистрации через test.extend<T>().
 * Пользователь может переопределить опции через use({ smartInspector: { enabled: false } }).
 */
export interface SmartInspectorFixtures {
  smartInspector: SmartInspectorOptions;
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

