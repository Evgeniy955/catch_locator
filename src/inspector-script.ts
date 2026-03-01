/**
 * inspector-script.ts
 *
 * Этот модуль экспортирует строку с браузерным JavaScript-кодом.
 * Строка передаётся в page.addInitScript() и выполняется в контексте браузера
 * при каждой навигации (Playwright автоматически переинжектирует её).
 *
 * ВАЖНО: Код внутри строки — это Vanilla JS (без TypeScript, без import).
 * Все типы и конструкции должны быть совместимы с ES2016+ браузера.
 */
export const inspectorScript: string = `
(function () {
  'use strict';

  // ─── Утилиты ────────────────────────────────────────────────────────────────

  /**
   * Подсвечивает элемент красной рамкой на 1.5 секунды.
   * Сохраняет оригинальный outline и восстанавливает его после.
   */
  function highlightElement(el) {
    var original = el.style.outline;
    el.style.outline = '3px solid #ff0000';
    setTimeout(function () {
      el.style.outline = original;
    }, 1500);
  }

  /**
   * Обрезает строку до maxLen символов, убирает переносы строк и лишние пробелы.
   * Используется для нормализации innerText при генерации text-локатора.
   */
  function normalizeText(text, maxLen) {
    return text.replace(/\\s+/g, ' ').trim().slice(0, maxLen || 40);
  }

  /**
   * Экранирует спецсимволы CSS для использования в значениях атрибутов.
   */
  function escapeCss(value) {
    return value.replace(/["\\\\]/g, function (ch) { return '\\\\' + ch; });
  }

  // ─── Стратегии генерации локаторов ──────────────────────────────────────────

  /**
   * Стратегия 1: data-testid — самый надёжный селектор в Playwright.
   * Возвращает [data-testid="value"] если атрибут присутствует.
   */
  function tryDataTestId(el) {
    var val = el.getAttribute('data-testid');
    if (val) {
      return { selector: '[data-testid="' + escapeCss(val) + '"]', strategy: 'data-testid' };
    }
    return null;
  }

  /**
   * Стратегия 2: ARIA role + доступное имя.
   * Строит Playwright-локатор вида role=button[name="Submit"].
   * Имя берётся из aria-label, aria-labelledby (текст referenced-элемента),
   * или innerText (до 40 символов).
   */
  function tryRole(el) {
    var role = el.getAttribute('role');
    // Нативные роли для часто используемых тегов
    var nativeRoles = {
      button: 'button', a: 'link', input: null, // input роль зависит от type
      h1: 'heading', h2: 'heading', h3: 'heading',
      h4: 'heading', h5: 'heading', h6: 'heading',
      img: 'img', nav: 'navigation', main: 'main',
      list: 'list', li: 'listitem', checkbox: 'checkbox'
    };
    if (!role) {
      var tag = el.tagName.toLowerCase();
      if (tag === 'input') {
        var type = (el.getAttribute('type') || 'text').toLowerCase();
        var inputRoles = { checkbox: 'checkbox', radio: 'radio', button: 'button', submit: 'button', reset: 'button' };
        role = inputRoles[type] || null;
      } else {
        role = nativeRoles[tag] || null;
      }
    }
    if (!role) return null;

    // Определяем доступное имя
    var name = el.getAttribute('aria-label');
    if (!name) {
      var labelledById = el.getAttribute('aria-labelledby');
      if (labelledById) {
        var labelEl = document.getElementById(labelledById);
        if (labelEl) name = normalizeText(labelEl.textContent || '', 40);
      }
    }
    if (!name) {
      name = normalizeText(el.textContent || '', 40);
    }
    if (!name) return null;

    return {
      selector: 'role=' + role + '[name="' + escapeCss(name) + '"]',
      strategy: 'role'
    };
  }

  /**
   * Стратегия 3: label[for] — подходит для полей формы.
   * Ищет <label>, связанный с элементом через for=id или обёртку.
   * Возвращает getByLabel-строку для Playwright.
   */
  function tryLabel(el) {
    var id = el.getAttribute('id');
    if (id) {
      var label = document.querySelector('label[for="' + id + '"]');
      if (label) {
        var text = normalizeText(label.textContent || '', 40);
        if (text) return { selector: 'label=' + text, strategy: 'label' };
      }
    }
    // Проверяем, не обёрнут ли элемент в <label>
    var parentLabel = el.closest('label');
    if (parentLabel) {
      var text = normalizeText(parentLabel.textContent || '', 40);
      if (text) return { selector: 'label=' + text, strategy: 'label' };
    }
    return null;
  }

  /**
   * Стратегия 4: placeholder — подходит для input/textarea.
   * Возвращает [placeholder="value"].
   */
  function tryPlaceholder(el) {
    var val = el.getAttribute('placeholder');
    if (val) {
      return { selector: '[placeholder="' + escapeCss(val) + '"]', strategy: 'placeholder' };
    }
    return null;
  }

  /**
   * Стратегия 5: innerText — текстовый контент элемента.
   * Используется как последний семантический вариант перед XPath-fallback.
   * Текст обрезается до 40 символов.
   */
  function tryText(el) {
    var text = normalizeText(el.innerText || el.textContent || '', 40);
    if (text && text.length > 1) {
      return { selector: 'text=' + text, strategy: 'text' };
    }
    return null;
  }

  // ─── Fallback: Smart XPath ───────────────────────────────────────────────────

  /**
   * Строит стабильный XPath от ближайшего предка с id или data-testid.
   * Алгоритм:
   *   1. Поднимаемся по parentElement вверх до элемента с id/data-testid.
   *   2. Собираем путь от этого предка до целевого элемента.
   *   3. Пропускаем теги div/span/section/article без атрибутов (структурный шум).
   *   4. Если стабильный предок не найден — строим XPath от <body>.
   */
  function buildFallbackXPath(el) {
    var parts = [];
    var current = el;

    // Строим путь снизу вверх до стабильного предка
    while (current && current !== document.body) {
      var tag = current.tagName.toLowerCase();
      var testId = current.getAttribute('data-testid');
      var id = current.getAttribute('id');

      if (testId) {
        // Нашли стабильный предок — завершаем подъём
        parts.unshift('//*[@data-testid="' + escapeCss(testId) + '"]');
        break;
      } else if (id) {
        parts.unshift('//*[@id="' + escapeCss(id) + '"]');
        break;
      } else {
        // Определяем позицию среди siblings с тем же тегом
        var siblings = current.parentElement
          ? Array.prototype.slice.call(current.parentElement.children).filter(function (s) {
              return s.tagName === current.tagName;
            })
          : [];
        var index = siblings.length > 1 ? siblings.indexOf(current) + 1 : null;

        // Пропускаем структурные div/span без значимых атрибутов
        var isNoise = ['div', 'span', 'section', 'article', 'main', 'header', 'footer'].includes(tag)
          && !current.getAttribute('class')
          && !current.getAttribute('role');

        if (!isNoise || current === el) {
          parts.unshift(tag + (index ? '[' + index + ']' : ''));
        }

        current = current.parentElement;
      }
    }

    // Если не нашли стабильного предка, корневой элемент — body
    if (parts.length === 0 || !parts[0].startsWith('//*[')) {
      parts.unshift('//body');
    }

    return parts.join('/');
  }

  // ─── Главный обработчик Alt+Click ───────────────────────────────────────────

  /**
   * Обрабатывает клик с зажатым Alt.
   * Capture-фаза гарантирует перехват до любых обработчиков приложения.
   * composedPath()[0] возвращает реальный целевой элемент даже внутри Shadow DOM.
   */
  function handleAltClick(event) {
    if (!event.altKey) return;

    // Предотвращаем стандартное поведение браузера (переход по ссылке, фокус и т.д.)
    event.preventDefault();
    event.stopPropagation();

    // Резолвим реальный элемент через composedPath для поддержки Shadow DOM
    var path = event.composedPath();
    var target = path && path.length > 0 ? path[0] : event.target;

    if (!target || target === document || target === window) return;

    // Подсвечиваем выбранный элемент
    highlightElement(target);

    // Применяем стратегии по цепочке приоритетов
    var result = tryDataTestId(target)
      || tryRole(target)
      || tryLabel(target)
      || tryPlaceholder(target)
      || tryText(target)
      || null;

    // XPath fallback если ни одна семантическая стратегия не сработала
    var xpathValue = buildFallbackXPath(target);

    if (!result) {
      result = { selector: xpathValue, strategy: 'xpath-fallback' };
    }

    var payload = {
      selector: result.selector,
      strategy: result.strategy,
      xpath: xpathValue,
      tagName: target.tagName.toLowerCase()
    };

    // Отправляем результат на Node.js-сторону через exposeFunction
    if (typeof window.onLocatorGenerated === 'function') {
      window.onLocatorGenerated(payload);
    }

    // Копируем локатор в буфер обмена (без выброса исключений при отказе)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(result.selector).catch(function () {
        // Буфер обмена недоступен (headless / нет разрешений) — молча игнорируем
      });
    }
  }

  // Регистрируем обработчик в capture-фазе для перехвата до приложения
  document.addEventListener('click', handleAltClick, true);

  // Визуальная подсказка в консоли браузера (видна в DevTools)
  console.log('[SmartInspector] ✅ Activated. Hold Alt and click any element to inspect its locator.');
})();
`;

