const fs = require('node:fs');
const path = require('node:path');
const { resolveLocale, locales } = require('../shared/i18n');

/**
 * The templates a recording can be rendered into.
 *
 * Two sources, kept apart on purpose:
 *
 *   built in - ships with the app, read-only, always present. "System default"
 *              is one of these: a complete corporate SOP structure with
 *              metadata, numbered steps, a revision table and a signature
 *              block, for someone who has no format of their own yet.
 *   yours    - anything dropped into the user's templates folder, which is
 *              where an organisation's own document goes.
 *
 * Choosing happens BEFORE recording rather than at export, because the choice
 * changes what the recording is for, and a person setting out to write a
 * procedure knows that at the start.
 */

const KINDS = { '.md': 'Markdown', '.html': 'HTML', '.txt': 'Text', '.docx': 'Word' };

/** Where a user's own templates live. Created on first look. */
function userDir(userDataPath) {
  const dir = path.join(userDataPath, 'templates');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* listing still works */ }
  return dir;
}

/** Built-in templates, in the source tree during development and beside the app once packaged. */
function builtInDir(projectRoot) {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'templates') : null,
    path.join(projectRoot, 'templates'),
  ];
  const found = candidates.find((d) => d && fs.existsSync(d));
  return found ? path.resolve(found) : null;
}

/** Resolve only stock templates, preserving custom templates byte for byte.
 * A saved built-in path is a template identity; its language follows Settings.
 */
function forLanguage(projectRoot, file, language = 'en') {
  if (!file) return file;
  const root = builtInDir(projectRoot);
  if (!root) return file;
  const relative = path.relative(root, path.resolve(file));
  const parts = relative.split(path.sep);
  const stock = parts.length === 1
    || (parts.length === 2 && locales.some((locale) => locale.code === parts[0]));
  if (!stock || parts.some((part) => part === '..') || path.isAbsolute(relative)) return file;
  const name = parts.at(-1);
  // A locale variant must have a canonical stock counterpart, not just a file
  // somebody happened to place inside a locale folder.
  if (!fs.existsSync(path.join(root, name))) return file;
  const locale = resolveLocale(language);
  const translated = path.join(root, locale === 'en' ? '' : locale, name);
  return fs.existsSync(translated) ? translated : path.join(root, name);
}

function describe(file, origin) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, ext);
  const isDefault = origin === 'builtin' && base.startsWith('corporate-sop');

  return {
    path: file,
    kind: KINDS[ext] || ext.replace('.', '').toUpperCase(),
    origin,
    // The built-in SOP structure is the starting point for anyone without a
    // format of their own, so it is named as such rather than by its filename.
    name: isDefault ? `System default (${KINDS[ext]})` : base.replace(/[-_]/g, ' '),
    isDefault,
  };
}

function listIn(dir, origin) {
  if (!dir || !fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => KINDS[path.extname(f).toLowerCase()])
      .map((f) => describe(path.join(dir, f), origin));
  } catch {
    return [];
  }
}

/**
 * Every template available, system defaults first so the list opens on a
 * working choice rather than an empty one.
 */
function list(projectRoot, userDataPath, language = 'en') {
  const builtin = listIn(builtInDir(projectRoot), 'builtin')
    .map((entry) => ({ ...entry, path: forLanguage(projectRoot, entry.path, language) }));
  const mine = listIn(userDir(userDataPath), 'user');

  // Defaults first, and Word ahead of Markdown within them: a .docx is what an
  // organisation usually expects to be handed.
  const rank = (t) => (t.isDefault ? 0 : 1) * 10 + (t.kind === 'Word' ? 0 : 1);
  builtin.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  mine.sort((a, b) => a.name.localeCompare(b.name));

  return { templates: [...builtin, ...mine], userDir: userDir(userDataPath) };
}

/** The template a new recording should start on when nothing is chosen. */
function defaultFor(projectRoot, userDataPath, preferred = '', language = 'en') {
  if (preferred && fs.existsSync(preferred)) return forLanguage(projectRoot, preferred, language);
  const { templates } = list(projectRoot, userDataPath, language);
  const def = templates.find((t) => t.isDefault && t.kind === 'Word')
           || templates.find((t) => t.isDefault)
           || templates[0];
  return def ? def.path : '';
}

/**
 * Copies a template into the user's own folder so it can be edited.
 *
 * The ones that ship with the app live inside the installation, read-only and
 * replaced on every update. Making one your own previously meant finding that
 * folder, copying the file out and putting it somewhere the app looks - which
 * nobody does, so "use your own format" was really "already have a format and
 * know where to put it".
 */
function duplicate(sourcePath, userDataPath, { label = 'My' } = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, error: 'That template is no longer where it was.' };
  }

  const dir = userDir(userDataPath);
  const ext = path.extname(sourcePath);
  const base = `${label} ${path.basename(sourcePath, ext).replace(/[-_]/g, ' ')}`;

  // Never overwrite something the user has already worked on.
  let target = path.join(dir, `${base}${ext}`);
  for (let n = 2; fs.existsSync(target); n += 1) {
    target = path.join(dir, `${base} ${n}${ext}`);
  }

  try {
    fs.copyFileSync(sourcePath, target);
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: `Could not copy the template: ${err.message}` };
  }
}

module.exports = { list, defaultFor, forLanguage, userDir, duplicate };
