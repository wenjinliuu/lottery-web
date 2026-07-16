"use strict";

const assert = require("node:assert/strict");

global.window = global;
require("../web/ocr.js");

const ssq = LotteryOCR.parseLotteryTicketText(`
中国福利彩票
玩法：双色球 单式
A.03 19 20 21 30 31-14 (3)
B.02 12 14 17 21 31-05 (3)
C.01 10 16 27 29 32-03 (3)
D.-- -- -- -- -- ---- (-)
E.-- -- -- -- -- ---- (-)
开奖期:2026078 26-07-09
销售期:2026078-118 26-07-09 09:48:42
合计18元
`, 82);

assert.equal(ssq.gameKey, "ssq");
assert.equal(ssq.tickets.length, 3);
assert.deepEqual(ssq.tickets[0].red, [3, 19, 20, 21, 30, 31]);
assert.deepEqual(ssq.tickets[2].blue, [3]);
assert.equal(ssq.multiple, 3);
assert.equal(ssq.totalAmount, 18);
assert.equal(ssq.errors.length, 0);

const dlt = LotteryOCR.parseLotteryTicketText(`
体彩 超级大乐透
第26079期 2026年07月15日开奖
单式票 追加投注2倍 合计18元
① 03 04 16 20 26 04 11
② 01 13 18 23 28 01 08
③ 03 06 10 19 24 03 12
26/07/15 13:37:23
`, 88);

assert.equal(dlt.gameKey, "dlt");
assert.equal(dlt.tickets.length, 3);
assert.deepEqual(dlt.tickets[0].front, [3, 4, 16, 20, 26]);
assert.deepEqual(dlt.tickets[2].back, [3, 12]);
assert.equal(dlt.addOn, true);
assert.equal(dlt.multiple, 2);
assert.equal(dlt.totalAmount, 18);
assert.equal(dlt.errors.length, 0);

const missingOne = LotteryOCR.validateTicketResult({
  gameKey: "ssq",
  issue: "2026081",
  drawDate: "2026-07-16",
  totalAmount: 18,
  multiple: 3,
  addOn: false,
  confidence: 69,
  tickets: ssq.tickets.slice(0, 2)
});

assert.ok(missingOne.warnings.some((message) => message.includes("应有3注")));
assert.ok(missingOne.errors.some((message) => message.includes("票面18元不一致")));

console.log("OCR parser tests passed");
