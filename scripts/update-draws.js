const fs = require("fs/promises");
const path = require("path");

const QUERY_API_URL = "https://api.jisuapi.com/caipiao/query";
const CLASS_API_URL = "https://api.jisuapi.com/caipiao/class";
const APP_KEY = process.env.JISU_APPKEY || "";
const DATA_PATH = path.join(__dirname, "..", "web", "data", "lottery_draws.json");

const GAME_CONFIGS = {
  ssq: { label: "双色球", jisuId: 11, required: 7, firstPrize: true },
  qlc: { label: "七乐彩", jisuId: 13, required: 8 },
  fc3d: { label: "福彩3D", jisuId: 12, required: 3 },
  dlt: { label: "大乐透", jisuId: 14, required: 7, firstPrize: true },
  qxc: { label: "七星彩", jisuId: 15, required: 7 },
  pl3: { label: "排列3", jisuId: 16, required: 3 },
  pl5: { label: "排列5", jisuId: 17, required: 5 },
  k8: { label: "快乐8", jisuId: 89, required: 20 }
};

const GAME_ORDER = Object.keys(GAME_CONFIGS);

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  if (!APP_KEY) {
    throw new Error("Missing JISU_APPKEY. Add it to GitHub repository Secrets.");
  }

  const existing = await readCurrentData();
  const draws = Array.isArray(existing.draws) ? existing.draws : [];
  const classInfoById = await fetchClassInfo();
  const results = [];

  for (const gameKey of GAME_ORDER) {
    try {
      const draw = await fetchDraw(gameKey, classInfoById);
      validateDraw(draw);
      upsertDraw(draws, draw);
      results.push(`${GAME_CONFIGS[gameKey].label}:${draw.expect}`);
    } catch (error) {
      results.push(`${GAME_CONFIGS[gameKey].label}:失败(${error.message})`);
    }
    await sleep(600);
  }

  draws.sort(sortDrawDesc);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    draws
  };

  await fs.writeFile(DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(results.join("\n"));
}

async function readCurrentData() {
  try {
    return JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
  } catch (error) {
    return { version: 1, updatedAt: "", draws: [] };
  }
}

async function fetchClassInfo() {
  const url = new URL(CLASS_API_URL);
  url.searchParams.set("appkey", APP_KEY);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Class API HTTP ${response.status}`);
  const payload = await response.json();
  const list = extractClassList(payload);

  const byId = {};
  list.forEach((item) => {
    const id = Number(item.caipiaoid);
    if (!Number.isNaN(id)) byId[id] = item;
  });
  return byId;
}

function extractClassList(payload) {
  const result = payload && payload.result;
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.list)) return result.list;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

async function fetchDraw(gameKey, classInfoById) {
  const config = GAME_CONFIGS[gameKey];
  const url = new URL(QUERY_API_URL);
  url.searchParams.set("appkey", APP_KEY);
  url.searchParams.set("caipiaoid", String(config.jisuId));

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const data = payload && payload.result;
  if (!data) throw new Error(payload && payload.msg ? payload.msg : "No result");

  const mainNumber = normalizeOpenCode(data.number);
  const referNumber = normalizeOpenCode(data.refernumber);
  const openCode = buildOpenCode(gameKey, mainNumber, referNumber);
  const prizeList = normalizePrizeList(data.prize);
  const firstPrize = findPrizeByName(prizeList, "一等奖");
  const openDate = String(data.opendate || data.officialopendate || "");
  const classInfo = classInfoById[config.jisuId] || {};

  return {
    id: buildDrawId(gameKey, data.issueno, openDate),
    gameKey,
    gameName: config.label,
    caipiaoid: Number(data.caipiaoid || config.jisuId),
    expect: String(data.issueno || ""),
    openDate,
    nextExpect: String(classInfo.nextissueno || ""),
    nextOpenDate: normalizeDate(classInfo.nextopentime),
    nextOpenTime: String(classInfo.nextopentime || ""),
    nextBuyEndTime: String(classInfo.nextbuyendtime || ""),
    classLastExpect: String(classInfo.lastissueno || ""),
    deadline: String(data.deadline || ""),
    openCode,
    mainNumber: mainNumber.join(","),
    referNumber: referNumber.join(","),
    drawValues: parseOpenCodeToDrawValues(gameKey, openCode),
    saleAmount: String(data.saleamount || ""),
    totalMoney: String(data.totalmoney || ""),
    prizeList,
    firstPrize,
    raw: data,
    dataSource: "jisuapi",
    fetchedAt: new Date().toISOString()
  };
}

function validateDraw(draw) {
  const config = GAME_CONFIGS[draw.gameKey];
  const count = extractNums(draw.openCode).length;
  if (count < config.required) {
    throw new Error(`开奖号码不完整: ${draw.openCode}`);
  }
  if (config.firstPrize && (!draw.firstPrize || !String(draw.firstPrize.singleBonus || "").trim())) {
    throw new Error("一等奖数据缺失");
  }
}

function upsertDraw(draws, draw) {
  const index = draws.findIndex((item) => item.id === draw.id || (
    item.gameKey === draw.gameKey && item.expect === draw.expect && (item.openDate || item.time) === draw.openDate
  ));
  if (index >= 0) {
    draws[index] = { ...draws[index], ...draw };
  } else {
    draws.push(draw);
  }
}

function buildOpenCode(gameKey, mainNumber, referNumber) {
  if (gameKey === "ssq") return mainNumber.slice(0, 6).concat(referNumber.slice(0, 1)).join(",");
  if (gameKey === "dlt") return mainNumber.slice(0, 5).concat(referNumber.slice(0, 2)).join(",");
  if (gameKey === "qlc") return mainNumber.slice(0, 7).concat(referNumber.slice(0, 1)).join(",");
  if (gameKey === "qxc") {
    if (mainNumber.length >= 7) return mainNumber.slice(0, 7).join(",");
    return mainNumber.slice(0, 6).concat(referNumber.slice(0, 1)).join(",");
  }
  return mainNumber.join(",");
}

function parseOpenCodeToDrawValues(gameKey, openCode) {
  const numbers = extractNums(openCode).map(Number);
  if (gameKey === "ssq") return { red: numbers.slice(0, 6), blue: numbers.slice(6, 7) };
  if (gameKey === "dlt") return { front: numbers.slice(0, 5), back: numbers.slice(5, 7) };
  if (gameKey === "k8") return { nums: numbers.slice(0, 20) };
  if (gameKey === "fc3d" || gameKey === "pl3") return { nums: numbers.join("").split("").slice(0, 3).map(Number) };
  if (gameKey === "pl5") return { nums: numbers.join("").split("").slice(0, 5).map(Number) };
  if (gameKey === "qlc") return { front: numbers.slice(0, 7), special: numbers[7] };
  if (gameKey === "qxc") return { nums6: numbers.slice(0, 6), tail: numbers[6] };
  return {};
}

function normalizeOpenCode(value) {
  return extractNums(value);
}

function extractNums(value) {
  return String(value || "").match(/\d+/g) || [];
}

function normalizePrizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    prizeName: String(item.prizename || item.name || ""),
    require: String(item.require || ""),
    num: Number(item.num || 0),
    singleBonus: String(item.singlebonus || item.bonus || ""),
    prize: String(item.prize || "")
  }));
}

function findPrizeByName(prizeList, keyword) {
  const item = prizeList.find((prize) => prize.prizeName.includes(keyword));
  if (!item) return null;
  return {
    prizeName: item.prizeName,
    num: Number(item.num || 0),
    singleBonus: item.singleBonus,
    require: item.require
  };
}

function buildDrawId(gameKey, expect, openDate) {
  return [gameKey, expect, openDate].filter(Boolean).map((part) => String(part).replace(/[^\w-]+/g, "-")).join("_");
}

function sortDrawDesc(a, b) {
  const dateCompare = String(b.openDate || "").localeCompare(String(a.openDate || ""));
  if (dateCompare) return dateCompare;
  return String(b.expect || "").localeCompare(String(a.expect || ""));
}

function normalizeDate(value) {
  return String(value || "").slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
