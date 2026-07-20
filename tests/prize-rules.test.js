const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../web/rules.js"), "utf8");
const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(source, context);
const rules = context.globalThis.LotteryPrizeRules;

assert.ok(rules, "rules module should export LotteryPrizeRules");

const prize = (name, amount) => ({ prizeName: name, singleBonus: String(amount) });

const ssqDraw = { red: [1, 2, 3, 4, 5, 6], blue: [7] };
assert.equal(rules.evaluateTicket("ssq", { red: [1, 2, 3, 4, 5, 6], blue: [7] }, ssqDraw, 1, { prizeList: [prize("一等奖", 5000000)] }).amount, 5000000);
assert.equal(rules.evaluateTicket("ssq", { red: [1, 2, 3, 20, 21, 22], blue: [8] }, ssqDraw, 1, { prizeList: [prize("福运奖", 10)] }).prizeName, "福运奖");

const dltDraw = { front: [1, 2, 3, 4, 5], back: [6, 7] };
const dltMeta = { prizeList: [prize("三等奖", 10000)] };
assert.equal(rules.evaluateTicket("dlt", { front: [1, 2, 3, 4, 5], back: [8, 9] }, dltDraw, 1, dltMeta).prizeName, "三等奖", "5+0 is third prize");
assert.equal(rules.evaluateTicket("dlt", { front: [1, 2, 3, 4, 8], back: [6, 7] }, dltDraw, 1, dltMeta).prizeName, "三等奖", "4+2 is third prize");

const k8Draw = { nums: Array.from({ length: 20 }, (_, index) => index + 1) };
assert.equal(rules.evaluateTicket("k8", { nums: [1, 2, 3, 4, 5], playCount: 5 }, k8Draw, 1, { prizeList: [prize("选五中五", 1000)] }).amount, 1000);

assert.equal(rules.evaluateTicket("fc3d", { nums3: [1, 2, 3], playMode: "single" }, { nums: [1, 2, 3] }, 1, { prizeList: [prize("直选", 1040)] }).amount, 1040);
assert.equal(rules.evaluateTicket("pl3", { nums3: [1, 1, 2], playMode: "group3" }, { nums: [1, 2, 1] }, 1, { prizeList: [prize("组三", 346)] }).amount, 346);
assert.equal(rules.evaluateTicket("pl5", { nums5: [1, 2, 3, 4, 5] }, { nums: [1, 2, 3, 4, 5] }, 1, { prizeList: [prize("一等奖", 100000)] }).amount, 100000);

const qlcDraw = { front: [1, 2, 3, 4, 5, 6, 7], special: 8 };
assert.equal(rules.evaluateTicket("qlc", { nums7: [1, 2, 3, 4, 5, 6, 8] }, qlcDraw, 1, { prizeList: [prize("二等奖", 10000)] }).prizeName, "二等奖");

const qxcDraw = { nums6: [1, 2, 3, 4, 5, 6], tail: 7 };
assert.equal(rules.evaluateTicket("qxc", { nums6: [1, 2, 3, 4, 5, 6], tail: 7 }, qxcDraw, 1, { prizeList: [prize("一等奖", 5000000)] }).amount, 5000000);
assert.equal(rules.evaluateTicket("qxc", { nums6: [9, 9, 9, 9, 9, 9], tail: 7 }, qxcDraw, 1, { prizeList: [prize("六等奖", 5)] }).prizeName, "六等奖", "tail match uses position-aware rule");

console.log("Prize rules tests passed");
