/**
 * Localize the capture engine's generated grammar at export time. The stored
 * recording stays a faithful record. Names, typed values and authored wording
 * are data, never translation keys. No network service is involved.
 */
const i18n = require('../shared/i18n');
const translator = (language) => i18n.createTranslator(language);
const NO_TARGET = new Set(['Window', 'Pane', 'TitleBar']);
const NOUNS = {
  Button: 'button', Edit: 'text box', CheckBox: 'checkbox',
  RadioButton: 'radio button', ComboBox: 'dropdown', MenuItem: 'menu item',
  TabItem: 'tab', Hyperlink: 'link', ListItem: 'list item', TreeItem: 'tree item',
};
const MOUSE = {
  leftClick: 'Clicked', rightClick: 'Right-clicked',
  doubleClick: 'Double-clicked', drag: 'Dragged',
};

function targetFor(step) {
  const target = step.target;
  if (!target || NO_TARGET.has(target.controlType)
      || (step.window && target.name === step.window.title)) return null;
  return target;
}

function englishTarget(target) {
  if (!target) return '';
  const noun = NOUNS[target.controlType];
  const named = typeof target.name === 'string' && target.name.trim();
  return named ? (noun ? `the "${target.name}" ${noun}` : `"${target.name}"`)
    : noun ? `a ${noun}` : '';
}

// Older recordings can carry the generated sentence but no target metadata.
// Accept only the engine's exact grammar; unfamiliar wording remains authored.
function legacyTarget(what) {
  for (const [controlType, noun] of Object.entries(NOUNS)) {
    if (what === `a ${noun}`) return { controlType, name: '' };
    const suffix = `" ${noun}`;
    if (what.startsWith('the "') && what.endsWith(suffix)) {
      return { controlType, name: what.slice(5, -suffix.length) };
    }
  }
  if (what.startsWith('"') && what.endsWith('"')) return { name: what.slice(1, -1) };
  return null;
}

/** null delegates to the existing English imperative converter. */
function localizeStep(step, voice = 'imperative', language = 'en') {
  const t = translator(language);
  if (t.locale === 'en') return null;
  const original = step.text || step.action || '';
  if (step.textEdited || ['note', 'section', 'photo'].includes(step.action)) return original;
  const tense = voice === 'past' ? 'past' : 'imperative';
  const title = step.window && step.window.title;
  const englishWhere = typeof title === 'string' && title.trim() ? ` in "${title}"` : '';
  const where = englishWhere ? t('export.windowSuffix', { title }) : '';
  let phrase = original;
  if (englishWhere) {
    if (!phrase.endsWith(englishWhere)) return null;
    phrase = phrase.slice(0, -englishWhere.length);
  }

  if (step.action === 'password') {
    return phrase === 'Entered password' ? t(`export.password.${tense}`, { where }) : null;
  }
  if (step.action === 'keyText') {
    const target = targetFor(step);
    let name = target && typeof target.name === 'string' && target.name.trim() ? target.name : '';
    if (!step.target) {
      const legacyField = phrase.match(/^Typed "(.*)" into the "(.*)" field$/s);
      if (legacyField) name = legacyField[2];
    }
    const englishField = name ? ` into the "${name}" field` : '';
    if (englishField) {
      if (!phrase.endsWith(englishField)) return null;
      phrase = phrase.slice(0, -englishField.length);
    }
    if (!phrase.startsWith('Typed "') || !phrase.endsWith('"')) return null;
    const text = phrase.slice(7, -1);
    if (typeof step.typed === 'string' && step.typed !== text) return null;
    const field = name ? t('export.field', { name }) : '';
    return t(`export.typed.${tense}`, { text, field, where });
  }
  if (step.action === 'keyPress') {
    if (!phrase.startsWith('Pressed ') || phrase.length <= 8) return null;
    let keys = phrase.slice(8), times = '';
    const repetitions = keys.match(/ \((once|\d+ times)\)$/);
    if (repetitions) {
      keys = keys.slice(0, -repetitions[0].length);
      times = repetitions[1] === 'once' ? t('export.key.once')
        : t('export.key.times', { count: Number.parseInt(repetitions[1], 10) });
    }
    return t(`export.key.${tense}`, { keys, times, where });
  }

  const action = Object.hasOwn(MOUSE, step.action) ? step.action : 'interact';
  const verb = Object.hasOwn(MOUSE, step.action) ? MOUSE[step.action] : 'Interacted with';
  if (phrase !== verb && !phrase.startsWith(verb + ' ')) return null;
  const what = phrase === verb ? '' : phrase.slice(verb.length + 1);
  let target = targetFor(step);
  if (englishTarget(target) !== what) {
    if (step.target) return null;
    target = legacyTarget(what);
    if (englishTarget(target) !== what) return null;
  }
  const mode = action === 'drag' ? 'object' : action === 'interact' ? 'with' : 'at';
  const named = target && typeof target.name === 'string' && target.name.trim();
  const noun = target && Object.hasOwn(NOUNS, target.controlType) ? '.' + target.controlType : '';
  const translatedTarget = target && what ? t(`export.target.${mode}.${named ? 'named' : 'unnamed'}${noun}`,
    { name: target.name || '' }) : '';
  return t(`export.mouse.${action}.${tense}`, { target: translatedTarget, where });
}

module.exports = { translator, localizeStep };
