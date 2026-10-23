/**
 * Small, dependency-free message catalog shared by Node and the isolated
 * renderer, like the existing renderer helpers. Translations are plain text;
 * callers escape them when constructing HTML, just as they escape user text.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    // Keep this list and the scripts in index.html together when adding a locale.
    for (const locale of api.locales) {
      for (const area of ['ui', 'renderer', 'main', 'export']) {
        api.register(locale.code, require(`./locales/${locale.code}/${area}`));
      }
    }
  } else root.BsrI18n = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_LOCALE = 'en';
  const locales = Object.freeze([
    Object.freeze({ code: 'en', name: 'English' }),
    Object.freeze({ code: 'pt-BR', name: 'Português (Brasil)' }),
  ]);
  const catalogs = Object.create(null);
  let currentLocale = DEFAULT_LOCALE;

  /** Accept language tags from settings without ever using them as file paths. */
  function resolveLocale(language) {
    if (typeof language !== 'string') return DEFAULT_LOCALE;
    const tag = language.trim().replace(/_/g, '-').toLowerCase();
    const exact = locales.find((l) => l.code.toLowerCase() === tag);
    if (exact) return exact.code;
    const base = tag.split('-')[0];
    return locales.find((l) => l.code.toLowerCase().split('-')[0] === base)?.code
      || DEFAULT_LOCALE;
  }

  function register(language, messages) {
    const locale = resolveLocale(language);
    if (!catalogs[locale]) catalogs[locale] = Object.create(null);
    Object.assign(catalogs[locale], messages);
  }

  function message(locale, key, count) {
    const catalog = catalogs[locale];
    if (!catalog || !Object.hasOwn(catalog, key)) return undefined;
    const value = catalog[key];
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return undefined;
    const number = Number(count);
    const plural = Number.isFinite(number)
      ? new Intl.PluralRules(locale).select(number) : 'other';
    return value[plural] ?? value.other;
  }

  function createTranslator(language) {
    const locale = resolveLocale(language);
    const translate = (key, params = {}) => {
      const template = message(locale, key, params.count)
        ?? message(DEFAULT_LOCALE, key, params.count) ?? key;
      return String(template).replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(params, name) ? String(params[name]) : match);
    };
    translate.locale = locale;
    return translate;
  }

  const t = (key, params) => createTranslator(currentLocale)(key, params);
  const getLocale = () => currentLocale;
  function setLocale(language) {
    currentLocale = resolveLocale(language);
    return currentLocale;
  }

  /** Text and accessible labels only: never parse a translated string as HTML. */
  function translatePage(root) {
    const attributes = ['title', 'placeholder', 'aria-label'];
    const elements = [...root.querySelectorAll('*')];
    if (root.nodeType === 1) elements.unshift(root);
    for (const element of elements) {
      const key = element.getAttribute('data-i18n');
      if (key) element.textContent = t(key);
      for (const binding of [...element.attributes]) {
        if (!binding.name.startsWith('data-i18n-')) continue;
        const attribute = binding.name.slice('data-i18n-'.length);
        if (attributes.includes(attribute) || attribute.startsWith('data-')) {
          element.setAttribute(attribute, t(binding.value));
        }
      }
    }
    if (root.documentElement) root.documentElement.lang = currentLocale;
  }

  return { DEFAULT_LOCALE, locales, register, resolveLocale, createTranslator,
           t, getLocale, setLocale, translatePage };
}));
