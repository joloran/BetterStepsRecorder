/** Exercise real bundled outputs as well as injected document metadata. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const JSZip = require('../ui/node_modules/jszip');
const md = require('../ui/src/main/template');
const docx = require('../ui/src/main/docx');

const root = path.join(__dirname, '..', 'templates');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsr-template-locale-'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync(path.join(dir, 'screen.png'), png);
const session = {
  dir, name: 'Customer setup',
  steps: [
    { action: 'leftClick', text: 'Clicked the "Save" button in "Billing"',
      target: { name: 'Save', controlType: 'Button' },
      window: { title: 'Billing', process: 'chrome.exe' }, screenshot: 'screen.png' },
    { action: 'note', text: 'Customer-authored note stays in English.' },
    { action: 'password', text: 'Entered password in "Billing"',
      window: { title: 'Billing', process: 'chrome.exe' } },
    { action: 'leftClick', text: 'Excluded secret', excluded: true },
  ],
};
let pass = 0;
function check(name, condition) { assert.ok(condition, name); pass++; }

(async () => {
  try {
    for (const name of ['corporate-sop.md', 'ISO-9001-SOP.md', 'Agile-Checklist.md']) {
      const file = path.join(root, 'pt-BR', name);
      const source = fs.readFileSync(file, 'utf8');
      const result = md.render(source, session, { language: 'pt-BR' });
      check(`${name}: localized generated actions`, result.text.includes('Clique no botão "Save"'));
      check(`${name}: localized password`, result.text.includes('Digite sua senha'));
      check(`${name}: preserves user text`, result.text.includes(session.steps[1].text));
      check(`${name}: localized image labels`, result.text.includes('![Etapa 1](images/screen.png)'));
      check(`${name}: no unfilled hooks`, !result.text.includes('PARSER_HOOK:'));
      check(`${name}: omitted excluded text`, !result.text.includes('Excluded secret'));
      check(`${name}: immutable template`, fs.readFileSync(file, 'utf8') === source);
    }
    const custom = 'CUSTOM ENGLISH HEADING\n<!-- PARSER_HOOK: START_STEPS -->'
      + '{{action}} {{description}} {{image_block}}'
      + '<!-- PARSER_HOOK: END_STEPS -->';
    const result = md.render(custom, session, { language: 'pt-BR' }).text;
    check('custom template prose unchanged', result.startsWith('CUSTOM ENGLISH HEADING'));
    check('custom template action values localized', result.includes('CLIQUE'));
    const gallery = md.render('<!-- PARSER_HOOK: START_IMAGE_GALLERY -->'
      + '<!-- PARSER_HOOK: END_IMAGE_GALLERY -->', session, { language: 'pt-BR' }).text;
    check('default gallery heading localized', gallery.includes('**Etapa 1**'));
    check('redaction details localized', md.redactionSummary(session.steps, 'pt-BR').includes('senha'));
    check('redaction exclusion localized', md.redactionSummary(session.steps, 'pt-BR').includes('excluída'));
    check('default English preserved', md.redactionSummary([]) === 'no password fields were typed into during this recording; no screenshot regions were blurred by the author.');
    const file = path.join(root, 'pt-BR', 'corporate-sop.docx');
    const before = fs.readFileSync(file);
    const output = await docx.render(file, session, { language: 'pt-BR' });
    const zip = await JSZip.loadAsync(output.buffer);
    const xml = await zip.file('word/document.xml').async('string');
    const text = xml.replace(/<[^>]*>/g, '');
    check('Word template headings localized', text.includes('Procedimento Operacional Padrão Corporativo'));
    check('Word metadata headings localized', text.includes('METADADOS DO DOCUMENTO'));
    check('Word generated actions localized', text.includes('Clique no botão &quot;Save&quot;') || text.includes('Clique no botão "Save"'));
    check('Word password localized', text.includes('Digite sua senha'));
    check('Word summary generated in selected language', text.includes('senha registrada sem seu conteúdo'));
    check('Word notes unchanged', text.includes(session.steps[1].text));
    check('Word screenshots embedded', Object.keys(zip.files).some((f) => f.startsWith('word/media/')));
    check('Word placeholders resolved', !text.includes('{{'));
    check('Word template immutable', fs.readFileSync(file).equals(before));
    check('empty document title localized', docx.buildData({ dir, steps: [] }, { language: 'pt-BR' }).title === 'Procedimento gravado');
    console.log(`${pass} passed, 0 failed`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
