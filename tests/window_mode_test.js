/** Real main-process window transitions, with native window operations observed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const mainFile = path.join(__dirname, '..', 'ui', 'src', 'main', 'main.js');
const realRequire = createRequire(mainFile);
const handlers = new Map();
const displayEvents = new Map();
let workArea = { x: 0, y: 0, width: 1536, height: 816 };
let current;

class Window {
  constructor(options) {
    current = this;
    this.options = options;
    this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
    this.normal = { ...this.bounds };
    this.maximized = false;
    this.minimized = false;
    this.visible = true;
    this.minimum = [options.minWidth, options.minHeight];
    this.maximum = [0, 0];
    this.resizable = true;
    this.maximizable = true;
    this.closed = 0;
    this.messages = [];
    this.webContents = { send: (channel, payload) => this.messages.push({ channel, payload }), invalidate() {} };
  }
  isDestroyed() { return false; }
  getBounds() { return { ...this.bounds }; }
  getNormalBounds() { return { ...this.normal }; }
  setBounds(value) { this.bounds = { ...value }; if (!this.maximized) this.normal = { ...value }; }
  setMinimumSize(...value) { this.minimum = value; }
  setMaximumSize(...value) { this.maximum = value; }
  setResizable(value) {
    // Electron on Windows restores the constraints cached when resizing was disabled.
    if (!value && this.resizable) this.cachedMaximum = [...this.maximum];
    if (value && !this.resizable) this.maximum = [...this.cachedMaximum];
    this.resizable = value;
  }
  setMaximizable(value) { this.maximizable = value; }
  setAlwaysOnTop(value) { this.onTop = value; }
  setContentProtection(value) { this.protected = value; }
  isMaximized() { return this.maximized; }
  isMinimized() { return this.minimized; }
  minimize() { this.minimized = true; }
  restore() { this.minimized = false; }
  maximize() { this.maximized = true; this.bounds = { ...workArea }; }
  unmaximize() { this.maximized = false; this.bounds = { ...this.normal }; }
  close() { this.closed++; }
  show() { this.visible = true; }
  showInactive() { this.visible = true; }
  removeMenu() {}
  loadFile() {}
  once() {}
}

const electron = {
  BrowserWindow: Window,
  app: { whenReady: () => ({ then() {} }), on() {} },
  ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
  protocol: { registerSchemesAsPrivileged() {} },
  screen: { getPrimaryDisplay: () => ({ workArea }), getDisplayMatching: () => ({ workArea }),
    on: (name, callback) => displayEvents.set(name, callback) },
};
const sandbox = {
  require(name) {
    if (name === 'electron') return electron;
    if (name.startsWith('node:') || name === './bounds') return realRequire(name);
    if (name === './history') return { History: class {} };
    return {};
  },
  module: { exports: {} }, __dirname: path.dirname(mainFile),
  process: { pid: 42, on() {} },
};
vm.runInNewContext(fs.readFileSync(mainFile, 'utf8')
  + '\nmodule.exports = { createWindow, enterCompact, leaveCompact };', sandbox, { filename: mainFile });
const api = sandbox.module.exports;
const action = (value) => handlers.get('ui:window')(null, value);
let pass = 0;
const check = (name, test) => { test(); pass++; console.log('  PASS ' + name); };
const plainBounds = () => JSON.parse(JSON.stringify(current.getBounds()));

api.createWindow();
const original = plainBounds();
check('the existing editor is created without a native frame', () => assert.equal(current.options.frame, false));
check('the custom editor controls minimize and toggle maximize', () => {
  assert.equal(action('minimize').ok, true);
  assert.equal(current.isMinimized(), true);
  current.restore();
  assert.equal(action('maximize').ok, true);
  assert.equal(current.isMaximized(), true);
  assert.equal(action('maximize').ok, true);
  assert.equal(current.isMaximized(), false);
});
check('unknown window commands are rejected', () => assert.equal(action('destroy').ok, false));
api.enterCompact();
check('recording uses the same window at a fixed 280 by 64 points', () => {
  assert.equal(current.getBounds().width, 280);
  assert.equal(current.getBounds().height, 64);
  assert.deepEqual(current.minimum, [280, 64]);
  assert.deepEqual(current.maximum, [280, 64]);
  assert.equal(current.resizable, false);
  assert.equal(current.maximizable, false);
});
check('the small control stays on top and out of screenshots', () => {
  assert.equal(current.onTop, true);
  assert.equal(current.protected, true);
});
check('editor window commands cannot hide or close the recording control', () => {
  for (const command of ['minimize', 'maximize', 'close']) assert.equal(action(command).ok, false);
  assert.equal(current.closed, 0);
});
check('entering compact mode twice leaves the original restore bounds intact', () => {
  api.enterCompact();
  assert.equal(current.getBounds().height, 64);
});
check('a display change keeps the control small and inside its new display', () => {
  workArea = { x: 0, y: 0, width: 800, height: 450 };
  displayEvents.get('display-removed')();
  const value = current.getBounds();
  assert.equal(value.width, 280);
  assert.equal(value.height, 64);
  assert.ok(value.x >= 0 && value.x + value.width <= 800);
  assert.ok(value.y >= 0 && value.y + value.height <= 450);
});
check('restoring returns the editor and fits it to a smaller display', () => {
  api.leaveCompact();
  assert.equal(current.protected, false);
  assert.equal(current.onTop, false);
  assert.equal(current.resizable, true);
  assert.equal(current.maximizable, true);
  assert.deepEqual(current.maximum, [0, 0]);
  assert.deepEqual(current.minimum, [800, 450]);
  assert.deepEqual(plainBounds(), workArea);
  assert.equal(current.visible, true);
});
check('a maximized editor is unmaximized for recording and maximized again afterwards', () => {
  workArea = { x: 0, y: 0, width: 1536, height: 816 };
  current.setBounds(original);
  current.maximize();
  api.enterCompact();
  assert.equal(current.isMaximized(), false);
  assert.equal(current.getBounds().width, 280);
  api.leaveCompact();
  assert.equal(current.isMaximized(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(current.getNormalBounds())), original);
});
check('a minimized editor can still show the recording control', () => {
  current.minimize();
  api.enterCompact();
  assert.equal(current.isMinimized(), false);
  assert.equal(current.visible, true);
  api.leaveCompact();
});
check('the restore safety channel returns from compact mode', () => {
  api.enterCompact();
  assert.equal(handlers.get('ui:restore')().ok, true);
  assert.equal(current.resizable, true);
  assert.equal(current.protected, false);
});
check('the editor close command uses the normal close lifecycle', () => {
  assert.equal(action('close').ok, true);
  assert.equal(current.closed, 1);
});
check('preload forwards only the named window action through its narrow bridge', () => {
  let bridge;
  let invocation;
  vm.runInNewContext(fs.readFileSync(path.join(path.dirname(mainFile), 'preload.js'), 'utf8'), {
    require: () => ({ contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } },
      ipcRenderer: { invoke: (...value) => { invocation = value; } } }),
  });
  bridge.windowAction('minimize');
  assert.deepEqual(invocation, ['ui:window', 'minimize']);
});
console.log(`\n${pass} passed, 0 failed`);
