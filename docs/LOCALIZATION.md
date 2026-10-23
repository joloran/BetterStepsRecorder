# Interface languages

Choose **Settings → Language → Português (Brasil)** to use the application in
Brazilian Portuguese. The choice applies immediately and is saved in the
existing `settings.json`. Existing installations continue in English. An
unknown or invalid saved language falls back to English.

The setting covers the application's controls, accessible labels, dynamic
status messages and native file dialogs. Recorded text, authored notes,
application/window names and document templates keep their original content.
Changing the interface language does not translate an existing recording or
rewrite the C# capture engine's descriptions or exported instructions.

## Architecture

`ui/src/shared/i18n.js` is a dependency-free UMD module. Node uses `require()`;
the isolated renderer uses script tags, following the existing shared helpers.
There are no new IPC channels, renderer privileges or runtime dependencies.
Electron packaging already includes `src/**/*`, including the catalogs.

Each locale has three flat catalogs under `ui/src/shared/locales/`:

- `ui.js`: static HTML text, titles, placeholders and accessible labels.
- `renderer.js`: dynamic editor, recording and library messages.
- `main.js`: native dialogs, notifications and main-process errors.

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
3. Add the three catalog script tags in `renderer/index.html`, after
   `i18n.js` and before `renderer.js`. The language selector is populated from
   the locale registry automatically.
4. Run `npm test` from the repository root and `npm run test:window` from
   `ui/`. Catalog tests check key and placeholder parity, HTML coverage and
   agreement between Node and the browser. The window suite exercises live
   language changes in the real editor.

English is the compatibility baseline: adding a locale must preserve existing
English text and the persisted recording/protocol formats.
