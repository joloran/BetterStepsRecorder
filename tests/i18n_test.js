/** Catalog completeness and the same translation contract in Node and Chromium. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const i18n = require('../ui/src/shared/i18n');

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); }
}
const shared = path.join(__dirname, '..', 'ui', 'src', 'shared');
const html = fs.readFileSync(path.join(shared, '..', 'renderer', 'index.html'), 'utf8');
const catalogs = {};
for (const locale of i18n.locales) {
  catalogs[locale.code] = Object.assign({}, ...['ui', 'renderer', 'main', 'export'].map((area) =>
    require(path.join(shared, 'locales', locale.code, area))));
}
const en = i18n.createTranslator('en');
const pt = i18n.createTranslator('pt-BR');

console.log('language choice and fallback:');
check('English is the default', i18n.getLocale() === 'en');
check('Portuguese language tags resolve to the available catalog',
      ['pt', 'pt-br', 'PT_br', 'pt-PT'].every((tag) => i18n.resolveLocale(tag) === 'pt-BR'));
check('regional English resolves to English', i18n.resolveLocale('en-US') === 'en');
check('unknown, malformed and absent choices fall back safely',
      [null, undefined, {}, 42, '', 'unknown', '../../outside'].every((tag) =>
        i18n.resolveLocale(tag) === 'en'));
check('unknown keys remain diagnosable', pt('missing.message') === 'missing.message');
check('prototype properties are never treated as messages', pt('toString') === 'toString');
i18n.register('en', {
  'test.englishOnly': 'English fallback for {name}',
  'test.count': { one: '{count} step', other: '{count} steps' },
});
i18n.register('pt-BR', {
  'test.count': { one: '{count} etapa', other: '{count} etapas' },
  'test.literal': 'Valor: {text}',
});
check('missing translations use English and its parameters',
      pt('test.englishOnly', { name: 'Rei' }) === 'English fallback for Rei');
check('English singular, zero and plural stay correct',
      en('test.count', { count: 1 }) === '1 step'
      && en('test.count', { count: 0 }) === '0 steps'
      && en('test.count', { count: 4 }) === '4 steps');
check('Portuguese plurals use the selected language rules',
      pt('test.count', { count: 1 }) === '1 etapa'
      && pt('test.count', { count: 4 }) === '4 etapas');
check('parameters containing markup or dollars stay literal text',
      pt('test.literal', { text: '<img src=x onerror=alert(1)> $& {name}' })
        === 'Valor: <img src=x onerror=alert(1)> $& {name}');
i18n.setLocale('pt-BR');
check('switching locale leaves independent translators stable',
      en('test.count', { count: 2 }) === '2 steps'
      && i18n.t('test.count', { count: 2 }) === '2 etapas');
i18n.setLocale('en');

console.log('\ncatalog coverage:');
const englishKeys = Object.keys(catalogs.en).sort();
check('catalogs cover static, dynamic and native UI',
      ['ui.', 'renderer.', 'main.'].every((prefix) => englishKeys.some((key) => key.startsWith(prefix))));
function placeholders(value) {
  return [...new Set([...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');
}
for (const locale of i18n.locales.filter((l) => l.code !== 'en')) {
  const translated = catalogs[locale.code];
  const missing = englishKeys.filter((key) => !Object.hasOwn(translated, key));
  const extra = Object.keys(translated).filter((key) => !Object.hasOwn(catalogs.en, key));
  check(locale.code + ' has every English key and no stale keys',
        !missing.length && !extra.length, JSON.stringify({ missing, extra }));
  const invalid = englishKeys.filter((key) => {
    const source = catalogs.en[key];
    const target = translated[key];
    if (typeof source !== typeof target) return true;
    const forms = typeof source === 'string' ? { other: source } : source;
    const targetForms = typeof target === 'string' ? { other: target } : target;
    return !targetForms || Object.entries(forms).some(([form, value]) =>
      typeof targetForms[form] !== 'string' || !targetForms[form].trim()
      || placeholders(value) !== placeholders(targetForms[form]));
  });
  check(locale.code + ' keeps placeholders and plural forms', !invalid.length, invalid.join(', '));
}
const staticKeys = [...html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)].map((m) => m[1]);
const unknownStatic = staticKeys.filter((key) => !Object.hasOwn(catalogs.en, key));
check('every marked HTML label has a catalog entry',
      staticKeys.length > 50 && !unknownStatic.length, unknownStatic.join(', '));
for (const file of ['main/main.js', 'renderer/renderer.js']) {
  const source = fs.readFileSync(path.join(shared, '..', file), 'utf8');
  const keys = [...source.matchAll(/['"]((?:main|renderer)\.[\w.]+)['"]/g)].map((m) => m[1]);
  if (file.startsWith('renderer/')) {
    keys.push(...[...source.matchAll(/\btr\('([\w.]+)'/g)].map((m) => 'renderer.' + m[1]));
  }
  const unknown = keys.filter((key) => !Object.hasOwn(catalogs.en, key));
  check(file + ' refers to available messages', !unknown.length, unknown.join(', '));
}

console.log('\nthe browser and Node share the catalog:');
const browser = vm.createContext({ Intl });
vm.runInContext(fs.readFileSync(path.join(shared, 'i18n.js'), 'utf8'), browser);
const scriptPaths = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
check('the translator is loaded before renderer code',
      scriptPaths.indexOf('../shared/i18n.js') < scriptPaths.indexOf('renderer.js'));
for (const locale of i18n.locales) {
  for (const area of ['ui', 'renderer', 'main', 'export']) {
    const scriptPath = `../shared/locales/${locale.code}/${area}.js`;
    check(scriptPath + ' ships in the real page', scriptPaths.includes(scriptPath));
    vm.runInContext(fs.readFileSync(path.join(shared, 'locales', locale.code, area + '.js'), 'utf8'), browser);
  }
  const browserTranslate = browser.BsrI18n.createTranslator(locale.code);
  const nodeTranslate = i18n.createTranslator(locale.code);
  check(locale.code + ' produces identical browser and main-process text',
        englishKeys.every((key) => browserTranslate(key, { count: 2, name: '<literal>' })
          === nodeTranslate(key, { count: 2, name: '<literal>' })));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
