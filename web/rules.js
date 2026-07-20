(function (global) {
  "use strict";

  function countMatches(ticket = [], draw = []) {
    const counts = {};
    draw.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    return ticket.reduce((sum, n) => {
      if (!counts[n]) return sum;
      counts[n] -= 1;
      return sum + 1;
    }, 0);
  }

  function markMatches(ticket = [], draw = []) {
    const counts = {};
    draw.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    return ticket.map((n) => {
      if (!counts[n]) return false;
      counts[n] -= 1;
      return true;
    });
  }

  function multisetEqual(a = [], b = []) {
    if (a.length !== b.length) return false;
    const counts = {};
    a.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    return b.every((n) => counts[n]-- > 0);
  }

  function isGroup3(nums = []) {
    const counts = {};
    nums.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    return Object.values(counts).sort((a, b) => a - b).join(",") === "1,2";
  }

  function noPrize(matched) {
    return { prizeName: "未中奖", amount: 0, float: false, matched };
  }

  function floatPrize(prizeName, matched) {
    return { prizeName, amount: 0, float: true, matched };
  }

  function clampInt(value, min, max) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function parseMoneyNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value || "").replace(/,/g, "").trim();
    if (!text) return 0;
    const number = Number.parseFloat(text.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(number)) return 0;
    if (text.includes("亿")) return number * 100000000;
    if (text.includes("万")) return number * 10000;
    return number;
  }

  function toChineseNumber(value) {
    return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][Number(value)] || String(value);
  }

  function canonicalPrizeName(value) {
    return String(value || "")
      .replace(/组选[3三]奖?/g, "组三")
      .replace(/组选[6六]奖?/g, "组六")
      .replace(/直选奖/g, "直选")
      .replace(/\s+/g, "");
  }

  function hasPrizeByName(draw, prizeName) {
    return Boolean(draw?.prizeList?.some((prize) => canonicalPrizeName(prize.prizeName) === canonicalPrizeName(prizeName)));
  }

  function findK8PrizeEntry(prizeList, playCount, hits) {
    const playChinese = toChineseNumber(playCount);
    const hitsChinese = toChineseNumber(hits);
    return prizeList.find((prize) => {
      const name = String(prize.prizeName || prize.require || "");
      return (name.includes(`选${playCount}`) || name.includes(`选${playChinese}`))
        && (name.includes(`中${hits}`) || name.includes(`中${hitsChinese}`));
    }) || null;
  }

  function evaluateSSQ(ticket, draw, drawMeta) {
    const red = countMatches(ticket.red, draw.red);
    const blue = Number(ticket.blue?.[0]) === Number(draw.blue?.[0]) ? 1 : 0;
    const matched = { red: markMatches(ticket.red, draw.red), blue: [blue === 1] };
    if (red === 6 && blue) return floatPrize("一等奖", matched);
    if (red === 6) return floatPrize("二等奖", matched);
    if (red === 5 && blue) return floatPrize("三等奖", matched);
    if ((red === 5 && !blue) || (red === 4 && blue)) return floatPrize("四等奖", matched);
    if ((red === 4 && !blue) || (red === 3 && blue)) return floatPrize("五等奖", matched);
    if ([0, 1, 2].includes(red) && blue) return floatPrize("六等奖", matched);
    if (red === 3 && !blue && hasPrizeByName(drawMeta, "福运奖")) return floatPrize("福运奖", matched);
    return noPrize(matched);
  }

  function evaluateDLT(ticket, draw) {
    const front = countMatches(ticket.front, draw.front);
    const back = countMatches(ticket.back, draw.back);
    const matched = { front: markMatches(ticket.front, draw.front), back: markMatches(ticket.back, draw.back) };
    if (front === 5 && back === 2) return floatPrize("一等奖", matched);
    if (front === 5 && back === 1) return floatPrize("二等奖", matched);
    if ((front === 5 && back === 0) || (front === 4 && back === 2)) return floatPrize("三等奖", matched);
    if (front === 4 && back === 1) return floatPrize("四等奖", matched);
    if ((front === 4 && back === 0) || (front === 3 && back === 2)) return floatPrize("五等奖", matched);
    if ((front === 3 && back === 1) || (front === 2 && back === 2)) return floatPrize("六等奖", matched);
    if ((front === 3 && back === 0) || (front === 2 && back === 1) || (front === 1 && back === 2) || (front === 0 && back === 2)) return floatPrize("七等奖", matched);
    return noPrize(matched);
  }

  function evaluateK8(ticket, draw, drawMeta) {
    const matches = countMatches(ticket.nums, draw.nums);
    const matched = { nums: markMatches(ticket.nums, draw.nums) };
    const prize = findK8PrizeEntry(drawMeta?.prizeList || [], Number(ticket.playCount), matches);
    return prize ? floatPrize(prize.prizeName, matched) : noPrize(matched);
  }

  function evaluateDigit(ticket, draw) {
    const nums = ticket.nums3 || [];
    if (ticket.playMode === "single") {
      const matched = { nums3: nums.map((n, i) => n === draw.nums[i]) };
      return matched.nums3.every(Boolean) ? floatPrize("直选", matched) : noPrize(matched);
    }
    const matched = { nums3: markMatches(nums, draw.nums) };
    if (ticket.playMode === "group3") return isGroup3(draw.nums) && multisetEqual(nums, draw.nums) ? floatPrize("组三", matched) : noPrize(matched);
    return new Set(draw.nums).size === 3 && multisetEqual(nums, draw.nums) ? floatPrize("组六", matched) : noPrize(matched);
  }

  function evaluatePL5(ticket, draw) {
    const matched = { nums5: (ticket.nums5 || []).map((n, i) => n === draw.nums[i]) };
    return matched.nums5.every(Boolean) ? floatPrize("一等奖", matched) : noPrize(matched);
  }

  function evaluateQLC(ticket, draw) {
    const front = countMatches(ticket.nums7, draw.front);
    const special = (ticket.nums7 || []).includes(draw.special) ? 1 : 0;
    const matched = { nums7: markMatches(ticket.nums7, (draw.front || []).concat([draw.special])) };
    if (front === 7) return floatPrize("一等奖", matched);
    if (front === 6 && special) return floatPrize("二等奖", matched);
    if (front === 6) return floatPrize("三等奖", matched);
    if (front === 5 && special) return floatPrize("四等奖", matched);
    if (front === 5) return floatPrize("五等奖", matched);
    if (front === 4 && special) return floatPrize("六等奖", matched);
    if (front === 4) return floatPrize("七等奖", matched);
    return noPrize(matched);
  }

  function evaluateQXC(ticket, draw) {
    const mainMatched = (ticket.nums6 || []).map((n, i) => n === draw.nums6[i]);
    const mainCount = mainMatched.filter(Boolean).length;
    const tailMatched = Number(ticket.tail) === Number(draw.tail);
    const matched = { nums6: mainMatched, tail: [tailMatched] };
    if (mainCount === 6 && tailMatched) return floatPrize("一等奖", matched);
    if (mainCount === 6) return floatPrize("二等奖", matched);
    if (mainCount === 5 && tailMatched) return floatPrize("三等奖", matched);
    if (mainCount === 5 || (mainCount === 4 && tailMatched)) return floatPrize("四等奖", matched);
    if (mainCount === 4 || (mainCount === 3 && tailMatched)) return floatPrize("五等奖", matched);
    if (mainCount === 3 || tailMatched) return floatPrize("六等奖", matched);
    return noPrize(matched);
  }

  function findPrizeAmount(prizeList, prizeName, gameKey, record) {
    const candidates = prizeList.filter((prize) => {
      const name = String(prize.prizeName || prize.require || "");
      if (gameKey === "k8") {
        const playCount = Number(record?.numbers?.playCount || record?.playMode || 0);
        const hits = String(prizeName).match(/\d+/g)?.pop() || "";
        return (name.includes(`选${playCount}`) || name.includes(`选${toChineseNumber(playCount)}`))
          && (name.includes(`中${hits}`) || name.includes(`中${toChineseNumber(Number(hits))}`));
      }
      const normalizedName = canonicalPrizeName(name);
      const normalizedTarget = canonicalPrizeName(prizeName);
      return normalizedName.includes(normalizedTarget) && (String(prizeName).includes("追加") || !name.includes("追加"));
    });
    return candidates.reduce((amount, prize) => amount || parseMoneyNumber(prize.singleBonus || prize.prize), 0);
  }

  function findDltAddOnPrizeAmount(prizeList, prizeName) {
    const candidates = prizeList.filter((prize) => {
      const name = String(prize.prizeName || prize.require || "");
      return name.includes("追加") && name.includes(prizeName);
    });
    return candidates.reduce((amount, prize) => amount || parseMoneyNumber(prize.singleBonus || prize.prize), 0);
  }

  function findDltInlineAddOnPrizeAmount(prizeList, prizeName) {
    const prize = prizeList.find((item) => String(item.prizeName || item.require || "").includes(prizeName) && item.addBonus);
    return prize ? parseMoneyNumber(prize.addBonus) : 0;
  }

  function isDltAddOn(record) {
    return record?.addOn || record?.numbers?.addOn || record?.playMode === "add";
  }

  function resolveFloatingPrizeAmount(draw, prizeName, gameKey, record) {
    if (!draw || !Array.isArray(draw.prizeList)) return 0;
    const base = findPrizeAmount(draw.prizeList, prizeName, gameKey, record);
    if (gameKey !== "dlt" || !isDltAddOn(record) || !["一等奖", "二等奖"].includes(prizeName)) return base;
    const addOn = findPrizeAmount(draw.prizeList, `${prizeName}追加`, gameKey, record)
      || findPrizeAmount(draw.prizeList, `追加${prizeName}`, gameKey, record)
      || findDltInlineAddOnPrizeAmount(draw.prizeList, prizeName)
      || findDltAddOnPrizeAmount(draw.prizeList, prizeName);
    return addOn > 0 ? base + addOn : 0;
  }

  function evaluateTicket(gameKey, ticket, draw, multiple = 1, drawMeta = null, record = null) {
    let result = noPrize({});
    if (gameKey === "ssq") result = evaluateSSQ(ticket, draw, drawMeta);
    if (gameKey === "dlt") result = evaluateDLT(ticket, draw);
    if (gameKey === "k8") result = evaluateK8(ticket, draw, drawMeta);
    if (gameKey === "fc3d" || gameKey === "pl3") result = evaluateDigit(ticket, draw);
    if (gameKey === "pl5") result = evaluatePL5(ticket, draw);
    if (gameKey === "qlc") result = evaluateQLC(ticket, draw);
    if (gameKey === "qxc") result = evaluateQXC(ticket, draw);
    const multiplier = clampInt(multiple, 1, 99);
    const dynamicAmount = result.float ? resolveFloatingPrizeAmount(drawMeta, result.prizeName, gameKey, record || { numbers: ticket }) : 0;
    if (result.float && dynamicAmount > 0) return { ...result, float: false, amount: dynamicAmount * multiplier };
    return { ...result, amount: result.float ? 0 : result.amount * multiplier };
  }

  global.LotteryPrizeRules = Object.freeze({
    evaluateTicket,
    canonicalPrizeName,
    countMatches,
    markMatches
  });
})(typeof window !== "undefined" ? window : globalThis);
