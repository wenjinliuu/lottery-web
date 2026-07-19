const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "web/index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "web/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "web/styles.css"), "utf8");

assert.match(html, /<html[^>]+data-theme="light"/, "HTML must start in explicit light mode");
assert.ok(
  html.indexOf("lottery-theme") < html.indexOf('rel="stylesheet"'),
  "theme preload must run before the stylesheet is loaded"
);
assert.equal((html.match(/name="theme-color"/g) || []).length, 1, "use one app-controlled theme-color");
assert.doesNotMatch(html, /跟随系统|prefers-color-scheme/, "HTML must not expose a system theme state");
assert.doesNotMatch(app, /THEME_LABELS\s*=\s*\{[^}]*system|mode\s*===\s*["']system["']/, "app theme state must be binary");
assert.doesNotMatch(css, /prefers-color-scheme\s*:\s*dark|:root:not\(\[data-theme="light"\]\)/, "CSS must not infer dark mode from the OS");

const preloadMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(preloadMatch, "theme preload script is required");

function runPreload(savedValue, storageThrows = false) {
  const attrs = {};
  const meta = { setAttribute(name, value) { attrs[`meta:${name}`] = value; } };
  const context = {
    localStorage: {
      getItem() {
        if (storageThrows) throw new Error("storage unavailable");
        return savedValue;
      }
    },
    document: {
      documentElement: { setAttribute(name, value) { attrs[name] = value; } },
      getElementById(id) { return id === "themeColorMeta" ? meta : null; }
    }
  };
  vm.runInNewContext(preloadMatch[1], context);
  return attrs;
}

for (const legacyOrEmpty of [null, "system", "invalid", "light"]) {
  assert.equal(runPreload(legacyOrEmpty)["data-theme"], "light", `${legacyOrEmpty} must resolve to light`);
}
assert.equal(runPreload("dark")["data-theme"], "dark", "saved dark mode must be preserved");
assert.equal(runPreload(null, true)["data-theme"], "light", "storage failures must fall back to light");

console.log("theme tests passed");
