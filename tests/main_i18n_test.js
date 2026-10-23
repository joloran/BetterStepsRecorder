/** Exercise the main-process IPC boundary without a capture engine or window. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { fileProblem } = require('../ui/src/main/messages');

const mainFile = path.join(__dirname, '..', 'ui', 'src', 'main', 'main.js');
const realRequire = createRequire(mainFile);
const handlers = new Map();
const dialogs = [];
const electron = {
  app: { whenReady: () => ({ then() {} }), on() {} },
  ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
  protocol: { registerSchemesAsPrivileged() {} },
  globalShortcut: { unregisterAll() {}, register: () => true },
  dialog: { showOpenDialog: async (_window, options) => {
    dialogs.push(options);
    return { canceled: true, filePaths: [] };
  } },
};
const sandbox = {
  require: (name) => {
    if (name === 'electron') return electron;
    if (name === './history') return { History: class { clear() {} } };
    if (name === './log') return { info() {}, warn() {}, error() {} };
    if (name === './export-language' || name === '../shared/i18n' || name === './messages' || name === './shortcuts'
        || name.startsWith('node:')) return realRequire(name);
    return {};
  },
  module: { exports: {} },
  __dirname: path.dirname(mainFile),
  process: { pid: 42, on() {} },
};
vm.runInNewContext(fs.readFileSync(mainFile, 'utf8') + `
module.exports = {
  setLanguage(language) {
    if (!settings) settings = { values: {}, update(patch) { Object.assign(this.values, patch); return this.values; } };
    settings.values.language = language;
  },
  setSession(value) { session = value; },
  engineNotice, screenshotSummary, replacementSummary,
};`, sandbox, { filename: mainFile });
const api = sandbox.module.exports;
const invoke = (name, value) => handlers.get(name)(null, value);
let pass = 0;
const check = (name, test) => { test(); pass++; console.log('  PASS ' + name); };

(async () => {
  api.setLanguage('en');
  check('English main errors retain their original text', () => {
    assert.equal(invoke('recording:pause').error, 'Nothing is being recorded.');
    assert.equal(invoke('scope:get').label, 'Everything');
  });

  api.setLanguage('pt-BR');
  check('the next IPC call immediately uses Portuguese', () => {
    assert.equal(invoke('recording:pause').error, 'Nenhuma gravação está em andamento.');
    assert.equal(invoke('recording:resume').error, 'Nenhuma gravação está em andamento.');
    assert.equal(invoke('scope:get').label, 'Everything');
  });
  check('scope protocol preserves canonical labels and application names in every language', () => {
    assert.equal(invoke('scope:set', { pids: [123], label: 'Google Chrome' }).label, 'Google Chrome');
    assert.equal(invoke('scope:get').pids[0], 123);
    assert.equal(invoke('scope:set', { pids: [], label: 'Tudo' }).label, 'Everything');
    assert.equal(invoke('scope:get').label, 'Everything');
    assert.equal(invoke('scope:set', { pids: [123] }).label, 'One application');
    assert.equal(invoke('scope:set', { pids: [] }).label, 'Everything');
  });
  check('shortcut validation explains the problem in Portuguese', () => {
    assert.match(invoke('shortcuts:set', { which: 'pause', accelerator: 'A' }).error, /tecla modificadora/);
  });
  check('engine notices translate surrounding UI and preserve diagnostic details', () => {
    const message = api.engineNotice({ code: 'STEP_FAILED', message: 'Diagnostic detail' });
    assert.match(message, /^Não foi possível gravar uma etapa/);
    assert.match(message, /Diagnostic detail/);
  });
  check('export image advice translates sizes', () => {
    assert.equal(api.screenshotSummary({ mode: 'original' }), null);
    assert.match(api.screenshotSummary({ mode: 'transcoded', before: 10485760, after: 1048576 }), /de 10 MB para 1 MB/);
  });
  check('replace summaries use singular and plural forms', () => {
    assert.equal(api.replacementSummary([]), 'Nada para substituir.');
    assert.equal(api.replacementSummary([{ count: 1 }]), 'Substituição concluída: 1 ocorrência em 1 etapa.');
    assert.equal(api.replacementSummary([{ count: 2 }, { count: 1 }]), 'Substituição concluída: 3 ocorrências em 2 etapas.');
  });

  await invoke('settings:chooseLogo');
  check('native file dialogs translate the title and filters', () => {
    assert.equal(dialogs.at(-1).title, 'Escolha um logotipo para as exportações');
    assert.equal(dialogs.at(-1).filters[0].name, 'Imagens');
    assert.equal(dialogs.at(-1).filters[0].extensions.join(','), 'png,jpg,jpeg,gif,svg');
  });
  await invoke('session:open');
  check('opening recordings has a localized native dialog', () => {
    assert.equal(dialogs.at(-1).title, 'Abrir gravação');
    assert.equal(dialogs.at(-1).properties[0], 'openDirectory');
  });

  check('file errors translate known actions and preserve useful recovery advice', () => {
    const error = Object.assign(new Error('RAW PRIVATE PATH'), { code: 'EBUSY' });
    assert.equal(fileProblem(error, { action: 'export the guide', language: 'pt-BR' }),
      'Não foi possível exportar o guia: o arquivo está aberto em outro programa. Feche-o nesse programa e tente novamente.');
    for (const code of ['EBUSY', 'EPERM', 'EACCES', 'ENOSPC', 'ENOENT', 'UNKNOWN']) {
      const message = fileProblem({ code }, { language: 'pt-BR' });
      assert.match(message, /^Não foi possível salvar o arquivo/);
      assert.doesNotMatch(message, /RAW PRIVATE PATH|main\./);
    }
  });
  check('file error API remains compatible with custom actions and unsupported locales', () => {
    assert.equal(fileProblem(null, { action: 'save a custom format', language: 'xx' }),
      'Could not save a custom format. The details are in the log.');
  });

  api.setLanguage('en');
  await invoke('settings:chooseLogo');
  check('switching back changes native dialogs while scope protocol stays canonical', () => {
    assert.equal(dialogs.at(-1).title, 'Choose a logo for exports');
    assert.equal(invoke('scope:get').label, 'Everything');
  });
  console.log(`\n${pass} passed, 0 failed`);
})().catch((err) => { console.error(err); process.exitCode = 1; });
