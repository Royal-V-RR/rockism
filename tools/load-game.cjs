// The game now ships as a single self-contained index.html (see README,
// "Single-file build"). Tests and data validation still need to exercise
// the real game logic, so this helper extracts the inline <script> content
// straight from index.html and runs it under a minimal browser-like stub.
// This keeps index.html the single source of truth: nothing here
// duplicates game logic, it only provides the DOM/storage shims needed to
// run browser code under Node.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function stubBrowserGlobals() {
  global.window = globalThis;

  class MemoryStorage {
    constructor() { this.store = {}; }
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; }
    setItem(key, value) { this.store[key] = String(value); }
    removeItem(key) { delete this.store[key]; }
  }
  global.localStorage = new MemoryStorage();
  global.URL = global.URL || { createObjectURL: () => "blob:stub", revokeObjectURL: () => {} };
  global.Blob = global.Blob || function Blob() {};
  global.navigator = global.navigator || { serviceWorker: undefined };
  global.document = global.document || {
    addEventListener() {},
    createElement: () => ({ click() {}, style: {}, dataset: {} }),
    body: { appendChild() {}, removeChild() {} },
    querySelectorAll: () => [],
    getElementById: () => null
  };
}

function loadGameFromIndexHtml() {
  stubBrowserGlobals();

  const htmlPath = path.join(__dirname, "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const scriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const blocks = [];
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    blocks.push(match[1]);
  }
  if (!blocks.length) {
    throw new Error("No inline <script> blocks found in index.html. Has the single-file build changed shape?");
  }
  const code = blocks.join("\n\n");

  vm.runInThisContext(code, { filename: "index.html (inline script)" });

  if (!global.window.Rockism) {
    throw new Error("index.html's inline script did not register window.Rockism as expected.");
  }
  return global.window.Rockism;
}

module.exports = { loadGameFromIndexHtml };
