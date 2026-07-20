const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "web/index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "web/app.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "web/sw.js"), "utf8");
const headers = fs.readFileSync(path.join(root, "web/_headers"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "web/manifest.webmanifest"), "utf8"));

assert.match(html, /<title>彩票夹<\/title>/);
assert.match(html, /data-view="random" aria-label="试玩"/);
assert.match(html, /data-view="check" aria-label="票夹"/);
assert.match(html, /data-view-panel="monthly"/);
assert.match(html, /数据状态中心/);
assert.match(html, /正规线下彩票销售渠道/);
assert.ok(html.indexOf("./rules.js") < html.indexOf("./app.js"), "rules must load before app");

assert.equal(manifest.name, "彩票夹");
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
assert.match(sw, /networkFirst\(request, DATA_CACHE\)/, "draw JSON should have an offline fallback");
assert.match(headers, /application\/manifest\+json/, "Netlify should serve the manifest with the PWA MIME type");
assert.match(headers, /\/sw\.js[\s\S]*no-cache/, "service worker updates should not be pinned by Netlify cache");
assert.match(app, /LotteryPrizeRules\.evaluateTicket/, "app should use the standalone prize rules module");
assert.match(app, /backupChecksum/, "backup v2 should include integrity checking");
assert.match(app, /renderMonthlyStats/, "monthly statistics should be wired");

console.log("Product v2 tests passed");
