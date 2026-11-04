/** The main-process export boundary must forward the current setting to every format. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const JSZip = require('../ui/node_modules/jszip');
const mainFile = path.join(__dirname, '..', 'ui', 'src', 'main', 'main.js');
const realRequire = createRequire(mainFile);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsr-export-locale-'));
const root = path.join(__dirname, '..');
const handlers = new Map();
let destination;
let changeLanguageInDialog = false;
let printedHtml;
const electron = {
  app: { whenReady: () => ({ then() {} }), on() {}, getPath: () => dir },
  ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
  protocol: { registerSchemesAsPrivileged() {} },
  globalShortcut: { unregisterAll() {}, register: () => true },
  dialog: { async showSaveDialog() {
    if (changeLanguageInDialog) api.setLanguage('en');
    return { canceled: false, filePath: destination };
  } },
  BrowserWindow: class {
    constructor() {
      this.webContents = { printToPDF: async () => Buffer.from(printedHtml) };
    }
    async loadFile(file) { printedHtml = fs.readFileSync(file, 'utf8'); }
    destroy() {}
  },
};
const modules = new Set(['./export', './latex', './texzip', './template', './docx',
  './templates-lib', './screenshots', './messages', './shortcuts',
  '../renderer/annotate', '../renderer/sections', '../renderer/appname',
  '../shared/i18n', '../shared/step-language']);
const sandbox = {
  require(name) {
    if (name === 'electron') return electron;
    if (name === './history') return { History: class { clear() {} } };
    if (name === './log') return { info() {}, warn() {}, error() {} };
    if (name === './composite') return { markAll: async () => ({ images: new Map() }) };
    if (name === './transcode') return {};
    if (modules.has(name) || name.startsWith('node:')) return realRequire(name);
    return {};
  },
  module: { exports: {} }, __dirname: path.dirname(mainFile),
  process: { pid: 42, on() {} }, Buffer,
  // PDF layout delay is irrelevant to checking which HTML is printed.
  setTimeout(fn) { fn(); },
};
vm.runInNewContext(fs.readFileSync(mainFile, 'utf8') + `
module.exports = {
  configure(language, templatePath = '') {
    settings = { values: { language, saveRoot: ${JSON.stringify(dir)},
      showHighlightLegend: true, highlightMeanings: { yellow: 'Custom meaning' } } };
    session = { dir: ${JSON.stringify(dir)}, name: '', purpose: 'sop', templatePath,
      steps: [{ id: 'a', action: 'leftClick', highlights: ['yellow'],
        text: 'Clicked the "Save" button in "Billing"',
        window: { title: 'Billing', process: 'app.exe' } }] };
  },
  setLanguage(language) { settings.values.language = language; },
};`, sandbox, { filename: mainFile });
const api = sandbox.module.exports;
let pass = 0;
const check = (name, fn) => { fn(); pass++; console.log('  PASS ' + name); };
async function exported(format, ext, template = '', language = 'pt-BR') {
  api.configure(language, template);
  destination = path.join(dir, `guide-${pass}.${ext}`);
  const result = await handlers.get('export:run')(null, { format });
  assert.equal(result.ok, true, result.error);
  return fs.readFileSync(destination);
}
(async () => {
  for (const format of ['html', 'md', 'tex', 'texdoc']) {
    const text = (await exported(format, format === 'texdoc' ? 'tex' : format)).toString();
    check(format + ' receives Portuguese from Settings', () => assert.match(text, /Clique/));
    check(format + ' uses a Portuguese fallback title', () => assert.match(text, /Etapas gravadas/));
    check(format + ' includes localized colors and authored legend meanings', () => {
      assert.match(text, /Amarelo/); assert.match(text, /Custom meaning/);
    });
  }
  const pdf = (await exported('pdf', 'pdf')).toString();
  check('PDF prints the localized HTML document', () => assert.match(pdf, /Clique/));
  check('PDF includes localized legend colors and authored meanings', () => {
    assert.match(pdf, /Amarelo/); assert.match(pdf, /Custom meaning/);
  });
  const zipped = await JSZip.loadAsync(await exported('texzip', 'zip'));
  const texFile = Object.keys(zipped.files).find((name) => name.endsWith('.tex'));
  check('Overleaf ZIP contains a Portuguese document', () => assert.ok(texFile));
  const tex = await zipped.file(texFile).async('string');
  check('Overleaf ZIP forwards the language to LaTeX', () => assert.match(tex, /Clique/));
  const word = await JSZip.loadAsync(await exported('template', 'docx'));
  const xml = await word.file('word/document.xml').async('string');
  check('default Word output selects the Portuguese stock template', () => assert.match(xml, /Objetivo/));
  check('default Word output localizes generated steps', () => assert.match(xml, /Clique/));
  const stockMd = path.join(root, 'templates', 'corporate-sop.md');
  const md = (await exported('template', 'md', stockMd)).toString();
  check('a saved English stock choice follows the selected language', () => {
    assert.match(md, /Objetivo/); assert.match(md, /Clique/);
  });
  const englishMd = (await exported('template', 'md', path.join(root, 'templates', 'pt-BR', 'corporate-sop.md'), 'en')).toString();
  check('a saved Portuguese stock choice follows a switch back to English', () => {
    assert.match(englishMd, /Purpose/); assert.match(englishMd, /Click the/);
  });
  api.configure('pt-BR', path.join(dir, 'missing-custom.md'));
  destination = path.join(dir, 'must-not-be-created.md');
  const missing = await handlers.get('export:run')(null, { format: 'template' });
  check('a missing explicit custom template is reported without substituting stock text', () => {
    assert.equal(missing.ok, false); assert.match(missing.error, /missing-custom/);
    assert.equal(fs.existsSync(destination), false);
  });
  const custom = path.join(dir, 'custom.md');
  fs.writeFileSync(custom, '# Custom authored heading\n<!-- PARSER_HOOK: START_STEPS -->\n{{description}}\n<!-- PARSER_HOOK: END_STEPS -->\n');
  const customText = (await exported('template', 'md', custom)).toString();
  check('custom template text remains intact while generated steps translate', () => {
    assert.match(customText, /Custom authored heading/); assert.match(customText, /Clique/);
  });
  changeLanguageInDialog = true;
  const captured = (await exported('html', 'html')).toString();
  changeLanguageInDialog = false;
  check('an export keeps its language if Settings changes while the dialog is open', () => assert.match(captured, /Clique/));
  const english = (await exported('html', 'html', '', 'en')).toString();
  check('the next export follows a switch back to English', () => assert.match(english, /Click the/));
  const fallback = (await exported('html', 'html', '', 'xx')).toString();
  check('unsupported languages fall back to English at the boundary', () => assert.match(fallback, /Click the/));
  console.log(`\n${pass} passed, 0 failed`);
})().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => fs.rmSync(dir, { recursive: true, force: true }));
