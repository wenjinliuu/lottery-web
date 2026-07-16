(function (global) {
  "use strict";

  const TESSERACT_URLS = [
    "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js",
    "https://unpkg.com/tesseract.js@7.0.0/dist/tesseract.min.js"
  ];

  let loaderPromise = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\r/g, "\n")
      .replace(/[：﹕]/g, ":")
      .replace(/[＋﹢]/g, "+")
      .replace(/[—–−﹣]/g, "-")
      .replace(/[（]/g, "(")
      .replace(/[）]/g, ")")
      .replace(/[，,]/g, " ")
      .replace(/[\t\f\v]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function normalizeDigitToken(token) {
    const normalized = String(token || "")
      .replace(/[OoQqDd]/g, "0")
      .replace(/[Il|!]/g, "1")
      .replace(/[Zz]/g, "2")
      .replace(/[Ss]/g, "5")
      .replace(/[Gg]/g, "6")
      .replace(/[Bb]/g, "8")
      .replace(/[^0-9]/g, "");
    if (!normalized || normalized.length > 2) return null;
    return Number(normalized);
  }

  function extractNumberTokens(value) {
    const source = String(value || "");
    const matches = source.match(/[0-9OQDIloq|!ZzSsGgBb]{2}/g) || [];
    return matches.map(normalizeDigitToken).filter((item) => Number.isFinite(item));
  }

  function extractCompactNumberSequence(value, count, max) {
    const map = { O: 0, o: 0, Q: 0, q: 0, D: 0, d: 0, I: 1, i: 1, l: 1, "|": 1, "!": 1, Z: 2, z: 2, S: 5, s: 5, G: 6, B: 8 };
    const digits = [];
    String(value || "").split("").forEach((char, position) => {
      if (/\d/.test(char)) digits.push({ value: Number(char), position });
      else if (Object.prototype.hasOwnProperty.call(map, char)) digits.push({ value: map[char], position });
    });
    if (digits.length < count * 2) return [];
    let best = null;
    const search = (cursor, numbers, last, score) => {
      if (numbers.length === count) {
        const finalScore = score + Math.max(0, digits.length - cursor) * 0.18;
        if (!best || finalScore <= best.score) best = { values: numbers.slice(), score: finalScore };
        return;
      }
      const needed = (count - numbers.length) * 2;
      for (let first = cursor; first <= digits.length - needed; first += 1) {
        for (let second = first + 1; second <= Math.min(first + 2, digits.length - needed + 1); second += 1) {
          const number = digits[first].value * 10 + digits[second].value;
          if (number < 1 || number > max || number <= last) continue;
          const gapPenalty = first - cursor + (second - first - 1);
          search(second + 1, numbers.concat(number), number, score + gapPenalty);
        }
      }
    };
    search(0, [], 0, 0);
    return best ? best.values : [];
  }

  function isAscendingUnique(values) {
    return values.every((value, index) => !index || value > values[index - 1]);
  }

  function parseSsqLines(text) {
    const tickets = [];
    normalizeText(text).split("\n").forEach((rawLine) => {
      const line = rawLine.trim();
      const separator = line.search(/\s[-]\s*|[0-9OQDIloq|!]\s*[-]\s*[0-9OQDIloq|!]/);
      const dash = separator >= 0 ? line.indexOf("-", separator) : -1;
      let red = [];
      let blue;
      if (dash >= 0) {
        const leftSource = line.slice(0, dash);
        const rightSource = line.slice(dash + 1);
        const left = extractNumberTokens(leftSource);
        const right = extractNumberTokens(rightSource);
        red = left.slice(-6);
        blue = right[0];
        if (red.length !== 6 || !red.every((n) => n >= 1 && n <= 33) || !isAscendingUnique(red)) {
          red = extractCompactNumberSequence(leftSource, 6, 33);
        }
        if (!Number.isFinite(blue) || blue < 1 || blue > 16) {
          blue = extractCompactNumberSequence(rightSource, 1, 16)[0];
        }
      } else if (/^\s*[A-E][.·:：\s]/i.test(line)) {
        /* 双色球单式票固定使用 A-E 行号；分隔横线漏识别时仍可按 6+1 解析。 */
        const withoutMultiple = line.replace(/\(\s*[0-9OQDIloq|!]{1,2}\s*\)?\s*$/, "");
        const values = extractNumberTokens(withoutMultiple.replace(/^\s*[A-E][.·:：\s]*/i, ""));
        red = values.slice(0, 6);
        blue = values[6];
      } else {
        return;
      }
      if (red.length !== 6 || !Number.isFinite(blue)) return;
      if (!red.every((n) => n >= 1 && n <= 33) || blue < 1 || blue > 16) return;
      if (!isAscendingUnique(red)) return;
      const multipleMatch = line.match(/\(\s*([0-9OQDIloq|!]{1,2})(?:\s*\))?/);
      const multiple = multipleMatch ? normalizeDigitToken(multipleMatch[1]) : null;
      tickets.push({ red, blue: [blue], multiple: multiple || null });
    });
    return uniqueTickets(tickets, (ticket) => `${ticket.red.join(",")}|${ticket.blue[0]}`);
  }

  function parseDltLines(text) {
    const tickets = [];
    normalizeText(text).split("\n").forEach((rawLine) => {
      const line = rawLine.trim();
      const plus = line.search(/[+*]/);
      let leftSource = plus >= 0 ? line.slice(0, plus) : "";
      let rightSource = plus >= 0 ? line.slice(plus + 1) : "";
      let left = extractNumberTokens(leftSource);
      let right = extractNumberTokens(rightSource);
      let front = left.slice(-5);
      let back = right.slice(0, 2);
      if (plus < 0) {
        /* 大乐透号码行的 + 容易被热敏票/压缩图吃掉，七个两位数仍可稳定按 5+2 拆分。 */
        const withoutMultiple = line.replace(/\(\s*[0-9OQDIloq|!]{1,2}\s*\)?\s*$/, "");
        const values = extractNumberTokens(withoutMultiple);
        if (values.length !== 7) return;
        front = values.slice(0, 5);
        back = values.slice(5, 7);
        leftSource = front.map((n) => String(n).padStart(2, "0")).join(" ");
        rightSource = back.map((n) => String(n).padStart(2, "0")).join(" ");
        left = front;
        right = back;
      }
      if (/[0-9OQDIloq|!ZzSsGB]{3,}/.test(leftSource) || front.length !== 5 || !front.every((n) => n >= 1 && n <= 35) || !isAscendingUnique(front)) {
        front = extractCompactNumberSequence(leftSource, 5, 35);
      }
      if (/[0-9OQDIloq|!ZzSsGB]{3,}/.test(rightSource) || back.length !== 2 || !back.every((n) => n >= 1 && n <= 12) || !isAscendingUnique(back)) {
        back = extractCompactNumberSequence(rightSource, 2, 12);
      }
      if (front.length !== 5 || back.length !== 2) return;
      if (!front.every((n) => n >= 1 && n <= 35) || !back.every((n) => n >= 1 && n <= 12)) return;
      if (!isAscendingUnique(front) || !isAscendingUnique(back)) return;
      tickets.push({ front, back, multiple: null });
    });
    return uniqueTickets(tickets, (ticket) => `${ticket.front.join(",")}|${ticket.back.join(",")}`);
  }

  function uniqueTickets(tickets, keyOf) {
    const seen = new Map();
    tickets.forEach((ticket) => {
      const key = keyOf(ticket);
      const existing = seen.get(key);
      if (!existing || (!existing.multiple && ticket.multiple)) seen.set(key, ticket);
    });
    return Array.from(seen.values());
  }

  function mergeMultipleTicketPasses(passes, gameKey) {
    const keyOf = (ticket) => gameKey === "dlt"
      ? `${ticket.front.join(",")}|${ticket.back.join(",")}`
      : `${ticket.red.join(",")}|${ticket.blue.join(",")}`;
    const clusters = [];
    passes.forEach((tickets, passIndex) => {
      tickets.forEach((ticket) => {
        let cluster = clusters.find((item) => !item.passIndexes.has(passIndex)
          && item.variants.some((variant) => areTicketsSimilar(ticket, variant.ticket, gameKey)));
        if (!cluster) {
          cluster = { variants: [], passIndexes: new Set(), order: clusters.length };
          clusters.push(cluster);
        }
        cluster.passIndexes.add(passIndex);
        const key = keyOf(ticket);
        const variant = cluster.variants.find((item) => item.key === key);
        if (variant) {
          variant.votes += 1;
          if (!variant.ticket.multiple && ticket.multiple) variant.ticket.multiple = ticket.multiple;
        } else {
          cluster.variants.push({ key, ticket: { ...ticket }, votes: 1, firstPass: passIndex });
        }
      });
    });
    return clusters.map((cluster) => {
      const winner = cluster.variants.slice().sort((a, b) => b.votes - a.votes || a.firstPass - b.firstPass)[0];
      if (!winner.ticket.multiple) {
        const withMultiple = cluster.variants.find((variant) => variant.ticket.multiple);
        if (withMultiple) winner.ticket.multiple = withMultiple.ticket.multiple;
      }
      return winner.ticket;
    });
  }

  function areTicketsSimilar(a, b, gameKey) {
    const differences = (left = [], right = []) => left.length === right.length
      ? left.reduce((sum, value, index) => sum + (value === right[index] ? 0 : 1), 0)
      : 99;
    if (gameKey === "dlt") {
      const frontDiff = differences(a.front, b.front);
      const backDiff = differences(a.back, b.back);
      return (frontDiff === 0 && backDiff <= 1) || (backDiff === 0 && frontDiff <= 1);
    }
    const redDiff = differences(a.red, b.red);
    const blueDiff = differences(a.blue, b.blue);
    return (redDiff === 0 && blueDiff <= 1) || (blueDiff === 0 && redDiff <= 1);
  }

  function detectGame(text, ssqTickets, dltTickets) {
    if (/双色球|福利彩|WELFARE/i.test(text)) return "ssq";
    if (/大乐透|体育彩票|体彩|LOTTO|SPORT/i.test(text)) return "dlt";
    if (ssqTickets.length && !dltTickets.length) return "ssq";
    if (dltTickets.length && !ssqTickets.length) return "dlt";
    return ssqTickets.length >= dltTickets.length ? "ssq" : "dlt";
  }

  function extractIssue(text, gameKey) {
    const lines = normalizeText(text).split("\n");
    if (gameKey === "ssq") {
      for (const line of lines) {
        const preferred = line.match(/(?:开奖期|开奖|期)\D{0,8}(20\d{5})/);
        if (preferred) return preferred[1];
      }
      const match = text.match(/\b(20\d{5})\b/);
      return match ? match[1] : "";
    }
    for (const line of lines.slice(0, Math.max(8, Math.ceil(lines.length / 2)))) {
      const preferred = line.match(/(?:第\s*)?(2\d{4})\s*(?:期|H|84|H8|$)/i);
      if (preferred) return preferred[1];
      const merged = line.match(/\b(26\d{3})(?=\d{0,2}(?:期|H|84|H8|\D))/i);
      if (merged) return merged[1];
    }
    return "";
  }

  function isoDate(year, month, day) {
    const y = Number(year), m = Number(month), d = Number(day);
    if (y < 2020 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return "";
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function extractDates(text) {
    const source = normalizeText(text);
    const dates = [];
    const fullYear = /\b(20\d{2})\D{1,4}(\d{1,2})\D{1,4}(\d{1,2})(?:\D|$)/g;
    let match;
    while ((match = fullYear.exec(source))) {
      const value = isoDate(match[1], match[2], match[3]);
      if (value) dates.push({ value, index: match.index, hasTime: false, time: "" });
    }
    const shortYear = /(?:^|\D)(2\d)[-\/]([01]?\d)[-\/]([0-3]?\d)(?:\s+([0-2]?\d:[0-5]\d:[0-5]\d))?/g;
    while ((match = shortYear.exec(source))) {
      const value = isoDate(`20${match[1]}`, match[2], match[3]);
      if (value) dates.push({ value, index: match.index, hasTime: Boolean(match[4]), time: match[4] || "" });
    }
    return dates.sort((a, b) => a.index - b.index);
  }

  function chooseDrawDate(dates, timedDate) {
    const candidates = dates.filter((item) => !item.hasTime);
    if (!candidates.length) return dates[0];
    if (timedDate) {
      const saleTime = new Date(`${timedDate.value}T12:00:00`).getTime();
      const nearby = candidates
        .map((item) => ({ item, distance: Math.abs(new Date(`${item.value}T12:00:00`).getTime() - saleTime) }))
        .filter(({ distance }) => distance <= 370 * 86400000)
        .sort((a, b) => a.distance - b.distance || a.item.index - b.item.index);
      if (nearby.length) return nearby[0].item;
    }
    const latestPlausibleYear = new Date().getFullYear() + 2;
    return candidates.find((item) => Number(item.value.slice(0, 4)) <= latestPlausibleYear) || candidates[0];
  }

  function extractTotal(text) {
    const lines = normalizeText(text).split("\n");
    for (const line of lines) {
      const match = line.match(/(?:合计|共计|总计|计)\D{0,8}(\d{1,4})\s*元/);
      if (match) return Number(match[1]);
    }
    const fallback = text.match(/\b(\d{1,4})\s*元/);
    return fallback ? Number(fallback[1]) : null;
  }

  function extractDltMode(text) {
    const add = text.match(/追加\s*(?:投注)?\D{0,5}([0-9OQDIloq|!]{1,2})\s*[倍信]/);
    if (add) return { addOn: true, multiple: normalizeDigitToken(add[1]) || null };
    const normal = text.match(/(?:普通|基本)\s*(?:投注)?\D{0,5}([0-9OQDIloq|!]{1,2})\s*[倍信]/);
    if (normal) return { addOn: false, multiple: normalizeDigitToken(normal[1]) || null };
    if (/追加/.test(text)) return { addOn: true, multiple: null };
    return { addOn: null, multiple: null };
  }

  function parseLotteryTicketText(rawText, ocrConfidence) {
    const text = normalizeText(rawText);
    const passes = text.split("---NUMBER-RECHECK---");
    const ssqTickets = mergeMultipleTicketPasses(passes.map(parseSsqLines), "ssq");
    const dltTickets = mergeMultipleTicketPasses(passes.map(parseDltLines), "dlt");
    const gameKey = detectGame(text, ssqTickets, dltTickets);
    const tickets = gameKey === "dlt" ? dltTickets : ssqTickets;
    const dates = extractDates(text);
    const timedDate = dates.find((item) => item.hasTime);
    const drawDateItem = chooseDrawDate(dates, timedDate);
    const totalAmount = extractTotal(text);
    const dltMode = gameKey === "dlt" ? extractDltMode(text) : { addOn: false, multiple: null };
    let multiple = dltMode.multiple || null;

    if (gameKey === "ssq") {
      const values = tickets.map((ticket) => ticket.multiple).filter(Number.isFinite);
      if (values.length && values.every((value) => value === values[0])) multiple = values[0];
    }

    if (!multiple && totalAmount && tickets.length) {
      const price = gameKey === "ssq" ? 2 : dltMode.addOn === true ? 3 : dltMode.addOn === false ? 2 : 0;
      const inferred = price ? totalAmount / tickets.length / price : 0;
      if (Number.isInteger(inferred) && inferred >= 1 && inferred <= 99) multiple = inferred;
    }
    tickets.forEach((ticket) => { if (!ticket.multiple) ticket.multiple = multiple || 1; });

    return validateTicketResult({
      gameKey,
      issue: extractIssue(text, gameKey),
      drawDate: drawDateItem?.value || "",
      saleDateTime: timedDate ? `${timedDate.value}T${timedDate.time}` : "",
      totalAmount,
      addOn: gameKey === "dlt" ? dltMode.addOn : false,
      multiple: multiple || 1,
      tickets,
      confidence: Math.round(Number(ocrConfidence) || 0),
      rawText: text
    });
  }

  function validateTicketResult(input) {
    const result = { ...input, tickets: (input.tickets || []).map((ticket) => ({ ...ticket })) };
    const errors = [];
    const warnings = [];
    if (!result.gameKey || !["ssq", "dlt"].includes(result.gameKey)) errors.push("未能确认彩票类型");
    if (!result.tickets.length) errors.push("没有识别到有效投注号码");
    if (!result.issue) warnings.push("期号未识别，请手动填写");
    if (!result.drawDate) warnings.push("开奖日期未识别，请手动填写");
    if (result.gameKey === "dlt" && result.addOn === null) warnings.push("未能确认是否追加，请手动选择");
    if (!Number.isInteger(Number(result.multiple)) || Number(result.multiple) < 1) errors.push("投注倍数无效");
    if (Number(result.confidence) > 0 && Number(result.confidence) < 70) warnings.push("照片识别可信度较低，请逐个核对号码");

    result.tickets.forEach((ticket, index) => {
      const prefix = `第${index + 1}注`;
      if (result.gameKey === "ssq") {
        if (!Array.isArray(ticket.red) || ticket.red.length !== 6) errors.push(`${prefix}红球数量不正确`);
        else if (!ticket.red.every((n) => n >= 1 && n <= 33) || !isAscendingUnique(ticket.red)) errors.push(`${prefix}红球范围或顺序不正确`);
        if (!Array.isArray(ticket.blue) || ticket.blue.length !== 1 || ticket.blue[0] < 1 || ticket.blue[0] > 16) errors.push(`${prefix}蓝球不正确`);
      } else if (result.gameKey === "dlt") {
        if (!Array.isArray(ticket.front) || ticket.front.length !== 5) errors.push(`${prefix}前区数量不正确`);
        else if (!ticket.front.every((n) => n >= 1 && n <= 35) || !isAscendingUnique(ticket.front)) errors.push(`${prefix}前区范围或顺序不正确`);
        if (!Array.isArray(ticket.back) || ticket.back.length !== 2) errors.push(`${prefix}后区数量不正确`);
        else if (!ticket.back.every((n) => n >= 1 && n <= 12) || !isAscendingUnique(ticket.back)) errors.push(`${prefix}后区范围或顺序不正确`);
      }
    });

    const unitPrice = result.gameKey === "dlt" && result.addOn === true ? 3 : 2;
    const calculatedAmount = result.tickets.reduce((sum, ticket) => sum + unitPrice * Number(ticket.multiple || result.multiple || 1), 0);
    const totalAmount = Number(result.totalAmount);
    const commonMultiple = Number(result.multiple || 1);
    const expectedTicketCount = totalAmount > 0 && commonMultiple > 0
      ? totalAmount / (unitPrice * commonMultiple)
      : 0;
    if (Number.isInteger(expectedTicketCount) && expectedTicketCount > 0 && expectedTicketCount !== result.tickets.length) {
      warnings.push(`根据票面金额推算应有${expectedTicketCount}注，当前识别到${result.tickets.length}注`);
    }
    if (Number.isFinite(Number(result.totalAmount)) && Number(result.totalAmount) > 0 && calculatedAmount !== Number(result.totalAmount)) {
      errors.push(`按号码计算为${calculatedAmount}元，与票面${result.totalAmount}元不一致`);
    }
    result.calculatedAmount = calculatedAmount;
    result.totalAmount = Number(result.totalAmount) || calculatedAmount || null;
    result.errors = Array.from(new Set(errors));
    result.warnings = Array.from(new Set(warnings));
    return result;
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-ocr-src="${url}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.ocrSrc = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureTesseract() {
    if (global.Tesseract) return global.Tesseract;
    if (!loaderPromise) {
      loaderPromise = (async () => {
        let lastError;
        for (const url of TESSERACT_URLS) {
          try {
            await loadScript(url);
            if (global.Tesseract) return global.Tesseract;
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError || new Error("OCR 引擎加载失败");
      })();
    }
    return loaderPromise;
  }

  async function decodeImage(file) {
    if (global.createImageBitmap) {
      try {
        return await global.createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (error) {
        /* HEIC 或旧版 Safari 解码失败时退回原生 Image。 */
      }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片读取失败")); };
      image.src = url;
    });
  }

  function findTicketBounds(image) {
    const width = 180;
    const height = Math.max(180, Math.round(width * image.height / image.width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i += 1) {
      const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      mask[i] = luma > 145 && chroma < 72 ? 1 : 0;
    }
    const seen = new Uint8Array(mask.length);
    let best = null;
    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || seen[start]) continue;
      const queue = [start];
      seen[start] = 1;
      let head = 0, count = 0, minX = width, minY = height, maxX = 0, maxY = 0;
      while (head < queue.length) {
        const index = queue[head++];
        const x = index % width, y = Math.floor(index / width);
        count += 1;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        const neighbors = [index - 1, index + 1, index - width, index + width];
        neighbors.forEach((next, direction) => {
          if (next < 0 || next >= mask.length || seen[next] || !mask[next]) return;
          if (direction === 0 && x === 0) return;
          if (direction === 1 && x === width - 1) return;
          seen[next] = 1;
          queue.push(next);
        });
      }
      const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
      const score = count * Math.min(1.4, boxH / Math.max(boxW, 1));
      if (count > mask.length * 0.025 && boxH > height * 0.28 && (!best || score > best.score)) {
        best = { minX, minY, maxX, maxY, score };
      }
    }
    if (!best) return { x: 0, y: 0, width: image.width, height: image.height };
    const scaleX = image.width / width, scaleY = image.height / height;
    const marginX = (best.maxX - best.minX) * 0.06;
    const marginY = (best.maxY - best.minY) * 0.06;
    const x = clamp((best.minX - marginX) * scaleX, 0, image.width);
    const y = clamp((best.minY - marginY) * scaleY, 0, image.height);
    const right = clamp((best.maxX + marginX) * scaleX, 0, image.width);
    const bottom = clamp((best.maxY + marginY) * scaleY, 0, image.height);
    return { x, y, width: right - x, height: bottom - y };
  }

  async function prepareImage(file) {
    const image = await decodeImage(file);
    const bounds = findTicketBounds(image);
    const maxHeight = 1900;
    const scale = Math.min(2, maxHeight / bounds.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(600, Math.round(bounds.width * scale));
    canvas.height = Math.round(bounds.height * canvas.width / bounds.width);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, canvas.width, canvas.height);
    if (typeof image.close === "function") image.close();
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const gray = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
      const value = clamp((gray - 128) * 1.28 + 138, 0, 255);
      data.data[i] = value;
      data.data[i + 1] = value;
      data.data[i + 2] = value;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  function cropCanvas(source, top, bottom) {
    const y = clamp(Math.round(top), 0, source.height - 1);
    const height = clamp(Math.round(bottom - top), 1, source.height - y);
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, y, source.width, height, 0, 0, canvas.width, height);
    return canvas;
  }

  function findDashedSeparatorPair(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const left = Math.round(canvas.width * 0.05);
    const right = Math.round(canvas.width * 0.95);
    const stepX = Math.max(1, Math.round(canvas.width / 720));
    const rows = [];
    const startY = Math.round(canvas.height * 0.08);
    const endY = Math.round(canvas.height * 0.78);
    for (let y = startY; y < endY; y += 1) {
      let dark = 0, runs = 0, inRun = false, sampled = 0;
      for (let x = left; x < right; x += stepX) {
        const offset = (y * canvas.width + x) * 4;
        const isDark = pixels[offset] < 118;
        sampled += 1;
        if (isDark) {
          dark += 1;
          if (!inRun) runs += 1;
        }
        inRun = isDark;
      }
      const ratio = dark / Math.max(1, sampled);
      if (ratio >= 0.10 && ratio <= 0.62 && runs >= 7) rows.push({ y, score: ratio * 20 + Math.min(runs, 24) * 0.12 });
    }
    const peaks = [];
    rows.forEach((row) => {
      const last = peaks[peaks.length - 1];
      if (last && row.y <= last.end + 2) {
        last.end = row.y;
        if (row.score > last.score) Object.assign(last, { y: row.y, score: row.score });
      } else {
        peaks.push({ ...row, end: row.y });
      }
    });
    let best = null;
    for (let i = 0; i < peaks.length; i += 1) {
      for (let j = i + 1; j < peaks.length; j += 1) {
        const gap = peaks[j].y - peaks[i].y;
        if (gap < canvas.height * 0.08 || gap > canvas.height * 0.46) continue;
        if (peaks[i].y > canvas.height * 0.52 || peaks[j].y > canvas.height * 0.76) continue;
        const score = peaks[i].score + peaks[j].score + gap / canvas.height;
        if (!best || score > best.score) best = { top: peaks[i].y, bottom: peaks[j].y, score };
      }
    }
    return best;
  }

  function buildNumberRegionCanvases(canvas) {
    const pair = findDashedSeparatorPair(canvas);
    if (pair) {
      const margin = canvas.height * 0.035;
      return [
        cropCanvas(canvas, pair.top - margin, pair.bottom + margin),
        cropCanvas(canvas, canvas.height * 0.10, canvas.height * 0.68)
      ];
    }
    /* 双色球 A-E 行没有稳定双虚线，使用两个重叠动态比例区覆盖短票和长票。 */
    return [
      cropCanvas(canvas, canvas.height * 0.10, canvas.height * 0.62),
      cropCanvas(canvas, canvas.height * 0.26, canvas.height * 0.80)
    ];
  }

  function buildHighContrastCanvas(source) {
    const scale = 1.35;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < data.data.length; index += 4) {
      const gray = data.data[index];
      const value = gray < 172 ? 0 : 255;
      data.data[index] = value;
      data.data[index + 1] = value;
      data.data[index + 2] = value;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  async function recognizeFile(file, onProgress) {
    const canvas = await prepareImage(file);
    const numberRegions = buildNumberRegionCanvases(canvas);
    onProgress?.({ progress: 0.04, label: "正在加载本地识别模型" });
    const Tesseract = await ensureTesseract();
    let phaseStart = 0.15;
    let phaseSpan = 0.38;
    const worker = await Tesseract.createWorker(["chi_sim", "eng"], 1, {
      logger(message) {
        const rawProgress = Number(message.progress) || 0;
        const labels = {
          "loading tesseract core": "正在加载识别引擎",
          "initializing tesseract": "正在初始化识别引擎",
          "loading language traineddata": "正在加载中英文模型",
          "initializing api": "正在准备票面识别",
          "recognizing text": "正在识别票面信息"
        };
        const progress = message.status === "recognizing text"
          ? phaseStart + rawProgress * phaseSpan
          : Math.min(0.14, rawProgress * 0.14);
        onProgress?.({ progress, label: labels[message.status] || "正在本地识别" });
      }
    });
    try {
      await worker.setParameters({ preserve_interword_spaces: "1" });
      const result = await worker.recognize(canvas);
      let mergedText = result.data.text;
      let confidence = result.data.confidence;
      try {
        await worker.reinitialize("eng");
        phaseStart = 0.55;
        phaseSpan = 0.12;
        onProgress?.({ progress: phaseStart, label: "正在复核号码排列" });
        await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
        const blockPass = await worker.recognize(canvas);
        phaseStart = 0.69;
        phaseSpan = 0.10;
        onProgress?.({ progress: phaseStart, label: "正在复核模糊号码" });
        await worker.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" });
        const sparsePass = await worker.recognize(canvas);
        mergedText += `\n---NUMBER-RECHECK---\n${blockPass.data.text}\n---NUMBER-RECHECK---\n${sparsePass.data.text}`;
        confidence = Math.max(confidence, blockPass.data.confidence, sparsePass.data.confidence);
        await worker.setParameters({
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1",
          tessedit_char_whitelist: "ABCDEabcde0123456789+-() "
        });
        for (let index = 0; index < numberRegions.length; index += 1) {
          phaseStart = 0.80 + index * (0.18 / numberRegions.length);
          phaseSpan = 0.18 / numberRegions.length;
          onProgress?.({ progress: phaseStart, label: "正在复核完整号码行" });
          const regionPass = await worker.recognize(numberRegions[index]);
          mergedText += `\n---NUMBER-RECHECK---\n${regionPass.data.text}`;
          confidence = Math.max(confidence, regionPass.data.confidence);
        }
        const provisional = parseLotteryTicketText(mergedText, confidence);
        const missingTicket = provisional.warnings.some((message) => message.includes("当前识别到"));
        if (missingTicket) {
          const recoveryCanvas = buildHighContrastCanvas(numberRegions[0]);
          try {
            phaseStart = 0.97;
            phaseSpan = 0.02;
            onProgress?.({ progress: phaseStart, label: "正在补查可能漏掉的号码行" });
            await worker.setParameters({
              tessedit_pageseg_mode: "6",
              preserve_interword_spaces: "1",
              tessedit_char_whitelist: "ABCDEabcde0123456789+-() "
            });
            const recoveryPass = await worker.recognize(recoveryCanvas);
            mergedText += `\n---NUMBER-RECHECK---\n${recoveryPass.data.text}`;
            confidence = Math.max(confidence, recoveryPass.data.confidence);
          } finally {
            recoveryCanvas.width = 1;
            recoveryCanvas.height = 1;
          }
        }
      } catch (error) {
        /* 中文主识别已成功时，号码复核失败不阻断用户手动确认。 */
      }
      onProgress?.({ progress: 1, label: "识别完成，正在校验" });
      return {
        parsed: parseLotteryTicketText(mergedText, confidence),
        previewUrl: canvas.toDataURL("image/jpeg", 0.88)
      };
    } finally {
      await worker.terminate();
      numberRegions.forEach((region) => { region.width = 1; region.height = 1; });
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  global.LotteryOCR = {
    recognizeFile,
    parseLotteryTicketText,
    validateTicketResult,
    normalizeText
  };
})(window);
