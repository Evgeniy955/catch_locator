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
export const inspectorScript: string = `
(function () {
  'use strict';

  // Запускаемся только в top-фрейме.
  // addInitScript выполняется для каждого фрейма страницы (включая iframes),
  // что приводит к двойному вызову onLocatorGenerated.
  if (window !== window.top) return;

  // Защита от двойной регистрации при повторном вызове addInitScript (например, после навигации).
  if (window.__smartInspectorActive) return;
  window.__smartInspectorActive = true;

  var CFG   = window.__smartInspectorConfig || {};
  var ATTRS = CFG.locatorAttributes || ['data-testid', 'data-test-id', 'data-e2e', 'test-id'];

  // ─── Утилиты ──────────────────────────────────────────────────────────────────

  function highlight(el) {
    var prev = el.style.outline;
    el.style.outline = '3px solid #ff3b30';
    setTimeout(function () { el.style.outline = prev; }, 1500);
  }

  function norm(text, max) {
    return (text || '').replace(/\\s+/g, ' ').trim().slice(0, max || 60);
  }

  function esc(v) {
    return (v || '').replace(/["\\\\]/g, function (c) { return '\\\\' + c; });
  }

  /**
   * Семантический класс: НЕ Tailwind-утилита.
   * Отбрасываем: text-3xl, p-4, min-h-screen, flex-grow, bg-white, md:flex, container и т.п.
   */
  function isSemantic(cls) {
    if (!cls || cls.length < 3) return false;
    if (/^[a-z]+-[0-9]/.test(cls))  return false;  // text-3xl, p-4, mt-2, gap-6
    if (/^[a-z]+:[a-z]/.test(cls))  return false;  // md:flex, lg:hidden, sm:block
    if (/^[0-9_\\-]+$/.test(cls))   return false;  // чисто цифровые / дефисные
    // Tailwind-префиксы утилит
    if (/^(flex|grid|block|inline|hidden|absolute|relative|fixed|sticky|static|overflow|truncate|whitespace|break|z-|w-|h-|min-|max-|m[trblxy]?-|p[trblxy]?-|gap-|space-|border|rounded|shadow|ring|outline|bg-|text-|font-|leading-|tracking-|align-|justify|items-|content-|self-|order-|col-|row-|opacity|cursor|pointer|select|resize|appearance|transition|duration|ease|delay|animate|scale|rotate|translate|skew|origin|sr-|not-sr|container|aspect-|grow|shrink|basis|float|clear|object|fill|stroke|accent|caret|decoration|underline|line-through|no-underline|uppercase|lowercase|capitalize|normal-case|italic|not-italic|tabular|oldstyle|diagonal|lining|proportional|slashed|numeric|ordinal|list-|from-|via-|to-|gradient|divide|place-|vertical-|table-|caption-|border-|inset-|top-|right-|bottom-|left-)/.test(cls)) return false;
    return true;
  }

  function semClass(el) {
    if (!el || !el.className) return null;
    var list = el.className.toString().split(/\\s+/).filter(isSemantic);
    return list.length > 0 ? list[0] : null;
  }

  /** id не сгенерирован: не цифры, не :r0:, не radix-*, не содержит __ */
  function isStableId(id) {
    if (!id) return false;
    if (/^[0-9]+$/.test(id))    return false;
    if (/^:/.test(id))           return false;
    if (/^radix-/.test(id))      return false;
    if (id.indexOf('__') >= 0)   return false;
    return true;
  }

  // ─── P1: getByTestId / locator('#id') ─────────────────────────────────────────

  function tryTestId(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v) {
        // getByTestId работает только для data-testid (дефолт Playwright)
        var pw = ATTRS[i] === 'data-testid'
          ? 'page.getByTestId("' + esc(v) + '")'
          : 'page.locator("[' + ATTRS[i] + '=\\"' + esc(v) + '\\"]")';
        return { pw: pw, strategy: ATTRS[i] };
      }
    }
    var id = el.getAttribute('id');
    if (isStableId(id)) {
      return { pw: 'page.locator("#' + esc(id) + '")', strategy: 'id' };
    }
    return null;
  }

  // ─── P2: getByRole ────────────────────────────────────────────────────────────

  function tryRole(el) {
    var role = el.getAttribute('role');
    var tagRoles = {
      BUTTON: 'button', A: 'link',
      H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading',
      IMG: 'img', NAV: 'navigation', MAIN: 'main', LI: 'listitem', UL: 'list', OL: 'list',
      SELECT: 'combobox', TEXTAREA: 'textbox', TABLE: 'table', DIALOG: 'dialog', FORM: 'form'
    };
    if (!role) {
      if (el.tagName === 'INPUT') {
        var t = (el.getAttribute('type') || 'text').toLowerCase();
        var ir = { checkbox: 'checkbox', radio: 'radio', button: 'button',
                   submit: 'button', reset: 'button', search: 'searchbox', range: 'slider' };
        role = ir[t] || 'textbox';
      } else {
        role = tagRoles[el.tagName] || null;
      }
    }
    if (!role) return null;

    // Accessible name: aria-label -> aria-labelledby -> alt/value -> textContent
    var name = el.getAttribute('aria-label');
    if (!name) {
      var lbId = el.getAttribute('aria-labelledby');
      if (lbId) {
        var lbEl = document.getElementById(lbId);
        if (lbEl) name = norm(lbEl.textContent, 60);
      }
    }
    if (!name && el.tagName === 'IMG')   name = el.getAttribute('alt') || '';
    if (!name && el.tagName === 'INPUT') name = el.getAttribute('value') || '';
    if (!name) name = norm(el.textContent, 60);
    if (!name) return null;

    return { pw: 'page.getByRole("' + role + '", { name: "' + esc(name) + '" })', strategy: 'role' };
  }

  // ─── P3: getByLabel / getByPlaceholder / getByAltText / getByTitle / getByText ─

  function tryText(el) {
    // getByLabel — label[for=id]
    var id = el.getAttribute('id');
    if (id) {
      var lbl = document.querySelector('label[for="' + id + '"]');
      if (lbl) {
        var t = norm(lbl.textContent, 60);
        if (t) return { pw: 'page.getByLabel("' + esc(t) + '")', strategy: 'label' };
      }
    }
    // getByLabel — обёртка <label>
    var pLbl = el.closest('label');
    if (pLbl) {
      var t = norm(pLbl.textContent, 60);
      if (t) return { pw: 'page.getByLabel("' + esc(t) + '")', strategy: 'label' };
    }
    // getByPlaceholder
    var ph = el.getAttribute('placeholder');
    if (ph) return { pw: 'page.getByPlaceholder("' + esc(ph) + '")', strategy: 'placeholder' };

    // getByAltText
    if (el.tagName === 'IMG') {
      var alt = el.getAttribute('alt');
      if (alt) return { pw: 'page.getByAltText("' + esc(alt) + '")', strategy: 'alt' };
    }
    // getByTitle
    var title = el.getAttribute('title');
    if (title) return { pw: 'page.getByTitle("' + esc(title) + '")', strategy: 'title' };

    // getByText
    var txt = norm(el.innerText || el.textContent, 60);
    if (txt && txt.length > 1) return { pw: 'page.getByText("' + esc(txt) + '")', strategy: 'text' };

    return null;
  }

  // ─── P4: locator([name=]) ─────────────────────────────────────────────────────

  function tryName(el) {
    var n = el.getAttribute('name');
    if (n) return { pw: 'page.locator("[name=\\"' + esc(n) + '\\"]")', strategy: 'name' };
    return null;
  }

  // ─── P5: locator(tag.semantic-class) — только НЕ Tailwind-классы ──────────────

  function tryClass(el) {
    var tag = el.tagName.toLowerCase();
    // Семантический класс на самом элементе
    var cls = semClass(el);
    if (cls) return { pw: 'page.locator("' + tag + '.' + cls + '")', strategy: 'class' };
    // Ищем в родителях (до 3 уровней)
    var cur = el.parentElement;
    var depth = 0;
    while (cur && cur !== document.body && depth < 3) {
      var pCls = semClass(cur);
      if (pCls) {
        var pTag = cur.tagName.toLowerCase();
        return { pw: 'page.locator("' + pTag + '.' + pCls + ' ' + tag + '")', strategy: 'parent-class' };
      }
      cur = cur.parentElement;
      depth++;
    }
    return null;
  }

  // Index-based locator: без привязки к тексту, только selector + nth(index).
  function buildIndexBasedLocator(el) {
    function buildSelfCollectionSelector(node) {
      var tag = node.tagName.toLowerCase();

      // Приоритет: кастомные атрибуты -> id -> семантический класс -> name -> role -> tag
      for (var ai = 0; ai < ATTRS.length; ai++) {
        var av = node.getAttribute(ATTRS[ai]);
        if (av) return '[' + ATTRS[ai] + '="' + esc(av) + '"]';
      }

      var id = node.getAttribute('id');
      if (isStableId(id)) return tag + '#' + esc(id);

      var cls = semClass(node);
      if (cls) return tag + '.' + cls;

      var nm = node.getAttribute('name');
      if (nm) return tag + '[name="' + esc(nm) + '"]';

      var rl = node.getAttribute('role');
      if (rl) return tag + '[role="' + esc(rl) + '"]';

      return tag;
    }

    var root = document;
    var anchor = '';

    // Ближайший стабильный блок (фрейм/секция/контейнер), чтобы индекс был локальным.
    var cur = el.parentElement;
    var depth = 0;
    while (cur && cur !== document.body && depth < 8) {
      for (var i = 0; i < ATTRS.length; i++) {
        var av = cur.getAttribute(ATTRS[i]);
        if (av) {
          root = cur;
          anchor = '[' + ATTRS[i] + '="' + esc(av) + '"]';
          break;
        }
      }
      if (anchor) break;

      var cid = cur.getAttribute('id');
      if (isStableId(cid)) {
        root = cur;
        anchor = cur.tagName.toLowerCase() + '#' + esc(cid);
        break;
      }

      var ccls = semClass(cur);
      if (ccls) {
        root = cur;
        anchor = cur.tagName.toLowerCase() + '.' + ccls;
        break;
      }

      cur = cur.parentElement;
      depth++;
    }

    var baseSelector = buildSelfCollectionSelector(el);

    function buildLocator(scopeRoot, scopeAnchor, selector) {
      var scoped = Array.prototype.slice.call(scopeRoot.querySelectorAll(selector));
      if (scoped.length === 0) return '';

      var idx = scoped.indexOf(el);
      if (idx < 0) return '';

      var locatorPrefix = scopeAnchor
        ? 'page.locator("' + scopeAnchor + ' ' + selector + '")'
        : 'page.locator("' + selector + '")';

      return locatorPrefix + '.nth(' + idx + ')';
    }

    var localLocator = buildLocator(root, anchor, baseSelector);
    if (localLocator) return localLocator;

    // Фолбэк: глобальный поиск по тому же селектору.
    var globalLocator = buildLocator(document, '', baseSelector);
    if (globalLocator) return globalLocator;

    // Последний фолбэк: по тегу.
    var tag = el.tagName.toLowerCase();
    var all = Array.prototype.slice.call(document.querySelectorAll(tag));
    var idx = all.indexOf(el);
    if (idx < 0) idx = 0;
    return 'page.locator("' + tag + '").nth(' + idx + ')';
  }

  // ─── CSS-selector ────────────────────────────────────────────────────────────
  // Priority:
  //   1. Custom data-attr / stable-id / semantic-class on element itself
  //   2. name / placeholder / aria-label / input[type]
  //   3. tag:has-text("...") — button, a, h1-h6, p, span, li, label (no anchor needed)
  //   4. Walk ancestors up to 4 levels:
  //      a) custom-attr on ancestor  -> [attr="val"] tag[:has-text]
  //      b) stable id on ancestor    -> tag#id tag[:has-text]
  //      c) semantic class on ancestor -> div.card tag[:has-text]
  //      d) ancestor IS button/a/h* with text -> button:has-text("X") child-tag
  //   5. bare tag as last resort

  function buildCss(el) {
    var tag = el.tagName.toLowerCase();
    var TT  = ['button','a','h1','h2','h3','h4','h5','h6','p','span','li','td','th','label'];

    // 1a. custom data-attrs
    for (var i = 0; i < ATTRS.length; i++) {
      var av = el.getAttribute(ATTRS[i]);
      if (av) return '[' + ATTRS[i] + '="' + esc(av) + '"]';
    }
    // 1b. stable id
    var elId = el.getAttribute('id');
    if (isStableId(elId)) return tag + '#' + esc(elId);
    // 1c. semantic class on element itself
    var elCls = semClass(el);
    if (elCls) return tag + '.' + elCls;
    // 2a. name / placeholder / aria-label
    var nm = el.getAttribute('name');
    if (nm) return tag + '[name="' + esc(nm) + '"]';
    var ph = el.getAttribute('placeholder');
    if (ph) return tag + '[placeholder="' + esc(ph) + '"]';
    var al = el.getAttribute('aria-label');
    if (al) return tag + '[aria-label="' + esc(al) + '"]';
    // 2b. input[type]
    if (tag === 'input') {
      var tp = el.getAttribute('type');
      return (tp && tp !== 'text') ? 'input[type="' + esc(tp) + '"]' : 'input';
    }
    // 3. tag:has-text — for text-bearing elements (no parent needed)
    if (TT.indexOf(tag) >= 0) {
      var elTxt = norm(el.innerText || el.textContent, 40);
      if (elTxt && elTxt.length > 1) return tag + ':has-text("' + esc(elTxt) + '")';
    }
    // 4. walk ancestors up to 4 levels
    var cur = el.parentElement;
    var d = 0;
    while (cur && cur !== document.body && d < 4) {
      var pTag = cur.tagName.toLowerCase();
      var childTxt    = norm(el.innerText || el.textContent, 30);
      var hasChildTxt = childTxt && childTxt.length > 1 && TT.indexOf(tag) >= 0;

      // 4a. custom attr on ancestor
      for (var j = 0; j < ATTRS.length; j++) {
        var pav = cur.getAttribute(ATTRS[j]);
        if (pav) {
          var anch = '[' + ATTRS[j] + '="' + esc(pav) + '"]';
          return hasChildTxt ? anch + ' ' + tag + ':has-text("' + esc(childTxt) + '")' : anch + ' ' + tag;
        }
      }
      // 4b. stable id on ancestor
      var pid = cur.getAttribute('id');
      if (isStableId(pid)) {
        var anch = pTag + '#' + esc(pid);
        return hasChildTxt ? anch + ' ' + tag + ':has-text("' + esc(childTxt) + '")' : anch + ' ' + tag;
      }
      // 4c. semantic class on ancestor (div.card, section.hero, nav.menu, etc.)
      var pcls = semClass(cur);
      if (pcls) {
        var anch = pTag + '.' + pcls;
        return hasChildTxt ? anch + ' ' + tag + ':has-text("' + esc(childTxt) + '")' : anch + ' ' + tag;
      }
      // 4d. ancestor IS button/a/h* with its own text (up to 2 levels deep)
      if (d <= 1) {
        var AT = ['button','a','h1','h2','h3','h4','h5','h6'];
        if (AT.indexOf(pTag) >= 0) {
          var pt = norm(cur.innerText || cur.textContent, 30);
          if (pt && pt.length > 1) return pTag + ':has-text("' + esc(pt) + '") ' + tag;
        }
      }
      cur = cur.parentElement; d++;
    }
    return tag;
  }

  // ─── XPath ───────────────────────────────────────────────────────────────────
  // Rules:
  //   FAST PATH: button/a/h*/p/span with visible text
  //     -> //button[normalize-space()="Submit"]  (most stable, no traversal)
  //   HARD ANCHOR: id / custom-data-attr found within 8 levels
  //     -> //*[@id="form"]/input[2]
  //   SOFT ANCHOR: non-Tailwind semantic class found within 8 levels
  //     -> //div[contains(@class,"card")]/span
  //   POSITIONAL: tag + sibling-index in intermediate path nodes (NO classes)
  //   Returns '' only when absolutely nothing stable is found.

  function buildXPath(el) {
    var tag      = el.tagName.toLowerCase();
    var TEXTABLE = ['button','a','h1','h2','h3','h4','h5','h6','p','span','li','label','td'];

    // ── Fast path 1: кастомный data-атрибут на самом элементе ────────────────
    for (var fi = 0; fi < ATTRS.length; fi++) {
      var fav = el.getAttribute(ATTRS[fi]);
      if (fav) return '//*[@' + ATTRS[fi] + '="' + esc(fav) + '"]';
    }

    // ── Fast path 2: stable id на самом элементе ──────────────────────────────
    var eid = el.getAttribute('id');
    if (isStableId(eid)) return '//' + tag + '[@id="' + esc(eid) + '"]';

    // ── Fast path 3: placeholder ───────────────────────────────────────────────
    var ph = el.getAttribute('placeholder');
    if (ph) return '//' + tag + '[@placeholder="' + esc(ph) + '"]';

    // ── Fast path 4: aria-label ────────────────────────────────────────────────
    var al = el.getAttribute('aria-label');
    if (al) return '//' + tag + '[@aria-label="' + esc(al) + '"]';

    // ── Fast path 5: name-атрибут (input, select, textarea) ───────────────────
    var nm = el.getAttribute('name');
    if (nm) return '//' + tag + '[@name="' + esc(nm) + '"]';

    // ── Fast path 6: видимый текст (button, a, h*, p, span, li...) ────────────
    if (TEXTABLE.indexOf(tag) >= 0) {
      var ftxt = norm(el.innerText || el.textContent, 60);
      if (ftxt && ftxt.length > 1) {
        return '//' + tag + '[normalize-space()="' + esc(ftxt) + '"]';
      }
    }

    // ── Fast path 7: семантический класс на самом элементе ────────────────────
    var ownCls = semClass(el);
    if (ownCls) return '//' + tag + '[contains(@class,"' + ownCls + '")]';

    // ── Anchor walk: ищем ближайшего предка со стабильным якорем ─────────────
    // Строим короткий путь от якоря до элемента (без позиционных цепочек).
    var segments = [];
    var cur      = el;
    var depth    = 0;

    while (cur && cur !== document.body && depth < 8) {
      var cTag = cur.tagName.toLowerCase();

      // Hard anchor: custom data-attr на предке
      for (var i = 0; i < ATTRS.length; i++) {
        var av = cur.getAttribute(ATTRS[i]);
        if (av) {
          segments.unshift('//*[@' + ATTRS[i] + '="' + esc(av) + '"]');
          return segments.join('/');
        }
      }
      // Hard anchor: stable id на предке
      var xid = cur.getAttribute('id');
      if (isStableId(xid)) {
        segments.unshift('//*[@id="' + esc(xid) + '"]');
        return segments.join('/');
      }
      // Soft anchor: placeholder на предке (маловероятно, но бывает)
      if (depth > 0) {
        var xph = cur.getAttribute('placeholder');
        if (xph) {
          segments.unshift('//' + cTag + '[@placeholder="' + esc(xph) + '"]');
          return segments.join('/');
        }
        // Soft anchor: semantic class на предке
        var xcls = semClass(cur);
        if (xcls) {
          // Если остался только один уровень вложения — используем прямой тег,
          // иначе используем /descendant:: чтобы не строить длинную позиционную цепочку
          if (segments.length <= 1) {
            segments.unshift('//' + cTag + '[contains(@class,"' + xcls + '")]');
          } else {
            // Сбрасываем позиционные сегменты — используем descendant
            var lastSeg = segments[segments.length - 1];
            segments = ['//' + cTag + '[contains(@class,"' + xcls + '")]//' + lastSeg];
          }
          return segments.join('/');
        }
      }

      // Промежуточный узел: добавляем тег + позиционный индекс
      // НО только если уже нашли хоть один нижний сегмент (depth > 0)
      if (depth > 0) {
        var sibs = cur.parentElement
          ? Array.prototype.slice.call(cur.parentElement.children)
              .filter(function (s) { return s.tagName === cur.tagName; })
          : [];
        var idx = sibs.length > 1 ? '[' + (sibs.indexOf(cur) + 1) + ']' : '';
        segments.unshift(cTag + idx);
      } else {
        // Первый шаг — сам элемент
        var sibs0 = cur.parentElement
          ? Array.prototype.slice.call(cur.parentElement.children)
              .filter(function (s) { return s.tagName === cur.tagName; })
          : [];
        var idx0 = sibs0.length > 1 ? '[' + (sibs0.indexOf(cur) + 1) + ']' : '';
        segments.unshift(cTag + idx0);
      }

      cur = cur.parentElement;
      depth++;
    }

    // Если путь слишком длинный (> 3 сегментов) и нет якоря — не возвращаем мусор
    if (segments.length > 3) return '';

    return segments.length > 0 ? '//' + segments.join('/') : '';
  }

  // ─── Главный обработчик клика с модификатором ────────────────────────────────
  //
  // Клавиша активации читается из CFG.activationKey (передаётся через __smartInspectorConfig).
  // Дефолт по платформе задаётся на Node-стороне (index.ts):
  //   macOS  → 'meta'  (⌘ Cmd; Ctrl открывает контекстное меню)
  //   другие → 'alt'

  var KEY = (CFG.activationKey || 'alt').toLowerCase();

  // Карта: ключ конфига → флаг MouseEvent
  var KEY_FLAGS = {
    alt:   function(e) { return e.altKey; },
    ctrl:  function(e) { return e.ctrlKey; },
    shift: function(e) { return e.shiftKey; },
    meta:  function(e) { return e.metaKey; }
  };

  function isActivationKeyPressed(event) {
    var check = KEY_FLAGS[KEY] || KEY_FLAGS['alt'];
    return check(event);
  }

  var _handling = false;
  var _lastPayloadKey = '';
  var _lastPayloadTs = 0;
  var PAYLOAD_DEDUPE_WINDOW_MS = 1500;

  function handleInspectorClick(event) {
    if (!isActivationKeyPressed(event)) return;
    if (_handling) return;
    _handling = true;
    setTimeout(function () { _handling = false; }, 250);

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Shadow DOM: composedPath()[0] даёт реальный целевой элемент
    var path = event.composedPath();
    var target = (path && path.length > 0) ? path[0] : event.target;
    if (!target || target === document || target === window) return;

    highlight(target);

    // P1 -> P2 -> P3 -> P4 -> P5
    var result = tryTestId(target)
      || tryRole(target)
      || tryText(target)
      || tryName(target)
      || tryClass(target)
      || null;

    var css   = buildCss(target);
    var xpath = buildXPath(target);
    var pw    = result ? result.pw : 'page.locator("' + esc(css) + '")';
    var strat = result ? result.strategy : 'css-fallback';
    var indexBased = buildIndexBasedLocator(target);

    var payload = {
      playwrightLocator: pw,
      indexBasedLocator: indexBased,
      cssSelector: css,
      xpath: xpath,
      strategy: strat,
      tagName: target.tagName.toLowerCase()
    };

    // Browser-side dedupe to avoid double callback from synthetic/duplicated events.
    var payloadKey = payload.playwrightLocator + '|' + payload.indexBasedLocator + '|' + payload.cssSelector + '|' + payload.xpath;
    var now = Date.now();
    if (payloadKey === _lastPayloadKey && (now - _lastPayloadTs) < PAYLOAD_DEDUPE_WINDOW_MS) {
      return;
    }
    _lastPayloadKey = payloadKey;
    _lastPayloadTs = now;

    if (typeof window.onLocatorGenerated === 'function') {
      window.onLocatorGenerated(payload);
    }

    // Копируем Playwright-локатор в буфер обмена
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pw).catch(function () {});
    }
  }

  // pointerdown is more stable than click for modified-click inspector mode.
  document.addEventListener('pointerdown', handleInspectorClick, true);

  // Выводим актуальную клавишу в лог браузера
  var keyDisplay = KEY.charAt(0).toUpperCase() + KEY.slice(1);
  console.log('[SmartInspector] ✅ Activated. ' + keyDisplay + '+Click any element to inspect locators.');
})();
`;

