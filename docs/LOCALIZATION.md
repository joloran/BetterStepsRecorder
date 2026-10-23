# Interface languages

Choose **Settings → Language → Português (Brasil)** to use the application in
Brazilian Portuguese. The choice applies immediately and is saved in the
existing `settings.json`. Existing installations continue in English. An
unknown or invalid saved language falls back to English.

The setting covers the application's controls, accessible labels, dynamic
status messages, native file dialogs and exported documents. HTML, PDF,
Markdown, Word, template exports and LaTeX/Overleaf documents use the selected
language for generated descriptions, labels, legends and metadata. Procedures
use instructions; evidence records use the past tense in the selected language.
Bundled templates have Portuguese variants chosen automatically, including when
an older recording remembers the English built-in template path.

The language is captured when an export starts. Recorded data is never
rewritten: generated C# descriptions are localized at render time using the
engine's known grammar and structured target/window data. Authored notes,
headings, edited descriptions, typed values, application/control names and
custom template prose keep their original content. Unrecognized legacy wording
is preserved. This is an offline document renderer, not a general translation
service for arbitrary user-authored text.

## Architecture

`ui/src/shared/i18n.js` is a dependency-free UMD module. Node uses `require()`;
the isolated renderer uses script tags, following the existing shared helpers.
There are no new IPC channels, renderer privileges or runtime dependencies.
Electron packaging already includes `src/**/*`, including the catalogs.

Each locale has four flat catalogs under `ui/src/shared/locales/`:

- `ui.js`: static HTML text, titles, placeholders and accessible labels.
- `renderer.js`: dynamic editor, recording and library messages.
- `main.js`: native dialogs, notifications and main-process errors.
- `export.js`: generated document descriptions, labels, metadata and grammar.

`ui/src/main/export-language.js` recognizes the capture engine's generated
sentences, then formats them with locale messages. Every exporter receives an
explicit `language` option, defaulting to English for existing callers. New
languages can add bundled templates under `templates/<locale>/`; only known
built-in template paths are mapped to these variants. User copies are kept.

Messages have stable semantic keys. `createTranslator(language)` creates an
independent translator for Node; `setLocale(language)` selects the renderer's
active language. Missing messages fall back to English, then the key itself.
Named placeholders such as `{name}` preserve user content. Plural messages use
`Intl.PluralRules` with objects such as
`{ one: '{count} step', other: '{count} steps' }`.

Static markup uses `data-i18n`, `data-i18n-title`,
`data-i18n-placeholder` and `data-i18n-aria-label`. CSS-generated text can bind
data attributes through `data-i18n-data-*`. `translatePage(document)` updates
text and attributes and sets the document language. It never parses messages
as HTML. Wrap text in a child span when a label also contains a control, link
or formatting that must survive translation. Dynamic HTML must escape
translations and interpolated user values with the existing helper.

## Adding a language

1. Copy `locales/en/` to a directory with the language's BCP 47 tag. Translate
   values, keeping keys, placeholders and plural forms. Each catalog exports
   its messages under CommonJS and registers its own tag in the browser.
2. Add the tag and native language name to `locales` in `i18n.js`.
3. Add the four catalog script tags in `renderer/index.html`, after
   `i18n.js` and before `renderer.js`. The language selector is populated from
   the locale registry automatically.
4. Run `npm test` from the repository root and `npm run test:window` from
   `ui/`. Catalog tests check key and placeholder parity, HTML coverage and
   agreement between Node and the browser. Export tests cover generated
   instructions and past tense, all output routes, real Word/Markdown files,
   password privacy and preservation of authored content. The window suite
   exercises live language changes in the real editor.

English is the compatibility baseline: adding a locale must preserve existing
English text and the persisted recording/protocol formats.
