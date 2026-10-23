/**
 * What to tell a person when something they asked for could not be done.
 *
 * The window used to show an operating system error as it came - "EBUSY:
 * resource busy or locked, open 'C:\...\guide.docx'" - in a box that had to be
 * clicked away. Every word of that is true and none of it says what to do. The
 * raw error still goes to the log, where somebody diagnosing a problem wants
 * it; the person in front of the window gets the cause in plain words and the
 * one thing that fixes it.
 *
 * Pure of Electron, so each wording can be checked without a window.
 */
const i18n = require('../shared/i18n');

const ACTION_KEYS = {
  'save the file': 'main.file.action.save',
  'export the guide': 'main.file.action.export',
  'save the photo': 'main.file.action.savePhoto',
  'move the empty recording to the Recycle Bin': 'main.file.action.discard',
};

/**
 * A file or folder problem, described for the person who hit it.
 *
 * `action` is the thing they were doing, phrased to follow "Could not" -
 * "export the guide", "save the photo".
 */
function fileProblem(err, { action = 'save the file', language = 'en' } = {}) {
  const t = i18n.createTranslator(language);
  // Existing callers may supply their own action. Known application actions
  // have catalog entries; custom actions keep their backwards-compatible text.
  const params = { action: Object.hasOwn(ACTION_KEYS, action) ? t(ACTION_KEYS[action]) : action };
  const code = err && err.code;
  switch (code) {
    // Windows reports a file held open by another program as either of these,
    // and Word holding the .docx being exported over is the usual one.
    case 'EBUSY':
      return t('main.file.busy', params);
    case 'EPERM':
      return t('main.file.protected', params);
    case 'EACCES':
      return t('main.file.denied', params);
    case 'ENOSPC':
      return t('main.file.full', params);
    case 'ENOENT':
      return t('main.file.missingFolder', params);
    default:
      // Unknown causes are not guessed at. The log has the real one.
      return t('main.file.unknown', params);
  }
}

module.exports = { fileProblem };
