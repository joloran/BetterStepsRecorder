/** Generated capture grammar, including legacy recordings and privacy boundaries. */
const assert = require('node:assert/strict');
const { localizeStep } = require('../ui/src/main/export-language');
const { toImperative } = require('../ui/src/main/export');
let pass = 0;
function check(name, test) { test(); pass++; console.log('  PASS ' + name); }
const pt = (step, voice = 'imperative') => toImperative(step, voice, 'pt-BR');
const window = { title: 'Billing "2026"', process: 'billing.exe' };
const nouns = { Button: 'button', Edit: 'text box', CheckBox: 'checkbox', RadioButton: 'radio button',
  ComboBox: 'dropdown', MenuItem: 'menu item', TabItem: 'tab', Hyperlink: 'link',
  ListItem: 'list item', TreeItem: 'tree item' };
for (const [controlType, noun] of Object.entries(nouns)) {
  check(controlType + ' recognizes named and unnamed capture grammar', () => {
    for (const name of ['Save <&> "now"', '']) {
      const target = { name, controlType };
      const what = name ? `the "${name}" ${noun}` : `a ${noun}`;
      for (const [action, past, imperative] of [['leftClick','Clicked','Clique'],
        ['rightClick','Right-clicked','Clique com o botão direito'],
        ['doubleClick','Double-clicked','Clique duas vezes'], ['drag','Dragged','Arraste']]) {
        const step = { action, text: `${past} ${what} in "${window.title}"`, target, window };
        const before = JSON.stringify(step);
        assert.ok(pt(step).startsWith(imperative));
        assert.ok(pt(step).endsWith(` em "${window.title}"`));
        if (name) assert.ok(pt(step).includes(name));
        assert.equal(JSON.stringify(step), before);
      }
    }
  });
}
check('window and pane targets do not become invented controls', () => {
  for (const controlType of ['Window', 'Pane', 'TitleBar']) {
    assert.equal(pt({ action: 'leftClick', text: `Clicked in "${window.title}"`,
      target: { controlType, name: window.title }, window }), `Clique em "${window.title}"`);
  }
});
check('typing preserves typed values and field names literally', () => {
  const typed = 'ACME "{}" $& <tag>\nsegunda linha';
  const name = 'Customer "Name"';
  const step = { action: 'keyText', typed, target: { controlType: 'Edit', name }, window,
    text: `Typed "${typed}" into the "${name}" field in "${window.title}"` };
  assert.equal(pt(step), `Digite "${typed}" no campo "${name}" em "${window.title}"`);
  assert.ok(pt(step, 'past').startsWith('Digitou '));
});
check('legacy typing with field context and no target is localized', () => {
  assert.equal(pt({ action: 'keyText', typed: 'ACME',
    text: 'Typed "ACME" into the "Name" field in "Billing"', window: { title: 'Billing' } }),
    'Digite "ACME" no campo "Name" em "Billing"');
});
check('key chords and repeated command counts are preserved', () => {
  assert.equal(pt({ action: 'keyPress', text: 'Pressed Ctrl+S' }), 'Pressione Ctrl+S');
  assert.equal(pt({ action: 'keyPress', text: 'Pressed W (once)' }), 'Pressione W (uma vez)');
  assert.equal(pt({ action: 'keyPress', text: 'Pressed A, D, W (12 times)' }), 'Pressione A, D, W (12 vezes)');
  assert.equal(pt({ action: 'keyPress', text: 'Pressed Enter' }, 'past'), 'Pressionou Enter');
});
check('password descriptions reveal neither contents nor length', () => {
  const step = { action: 'password', text: 'Entered password', typed: 'MUST NOT APPEAR' };
  assert.equal(pt(step), 'Digite sua senha');
  assert.equal(pt(step, 'past'), 'Digitou a senha');
});
check('authored content and unfamiliar grammar are preserved', () => {
  for (const action of ['note', 'section', 'photo']) {
    assert.equal(pt({ action, text: 'Clicked the customer-authored wording' }), 'Clicked the customer-authored wording');
  }
  const edited = { action: 'leftClick', text: 'Clicked this custom sentence', textEdited: true };
  assert.equal(pt(edited), edited.text);
  const custom = { action: 'leftClick', text: 'Customer supplied title' };
  assert.equal(pt(custom), custom.text);
});
check('English, unsupported locales and legacy mouse grammar remain compatible', () => {
  const step = { action: 'leftClick', text: 'Clicked the "Save" button' };
  assert.equal(toImperative(step), 'Click the "Save" button');
  assert.equal(toImperative(step, 'imperative', 'xx'), 'Click the "Save" button');
  assert.equal(localizeStep(step, 'imperative', 'en'), null);
  assert.equal(pt(step), 'Clique no botão "Save"');
  assert.equal(pt(step, 'past'), 'Clicou no botão "Save"');
});
console.log(`\n${pass} passed, 0 failed`);
