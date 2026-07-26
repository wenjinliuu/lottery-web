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
assert.match(html, /data-view="home" aria-label="首页"/);
assert.match(html, /data-view="check" aria-label="票夹"/);
assert.match(html, /data-view="mine" aria-label="设置"/);
assert.doesNotMatch(html, /data-view="random" aria-label="试玩"/);
assert.match(html, /id="ticketAdd"/);
assert.match(html, /id="manualGameTabs"/);
assert.match(html, /id="drawCarouselDots"/);
assert.match(html, /data-profit-range="month"/);
assert.match(html, /id="homeMonthlyChart"/);
assert.match(html, /data-view-panel="monthly"/);
assert.match(html, /数据状态中心/);
assert.match(html, /id="drawUpdateNotice"/);
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
assert.match(app, /const APP_VERSION = "3\.0\.0"/);
assert.match(app, /renderWalletTickets/, "electronic ticket wallet should be wired");
assert.match(app, /renderManualTool/, "all-game manual picker should be wired");
assert.match(app, /scrollDrawCarouselToGame/, "latest draws should support swipe and dot navigation");
assert.match(app, /本地记录 · 非官方票据 · 不作为兑奖凭证/, "wallet tickets must be clearly marked as local records");
assert.match(app, /开奖号码尚未更新，请稍后再试/, "stale same-day draw data should be visible");
assert.doesNotMatch(app, /frontend_schedule_inference/, "the frontend must not invent draw issues");

console.log("Product v3 tests passed");
