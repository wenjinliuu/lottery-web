(function () {
  "use strict";

  const GAME_ROWS = [
    ["ssq", "dlt"],
    ["k8", "fc3d", "pl3"],
    ["qlc", "qxc", "pl5"]
  ];
  const GAME_ORDER = GAME_ROWS.flat();
  const COUNT_GAMES = new Set(["ssq", "dlt", "pl5", "qxc", "qlc"]);
  const COUNT_OPTIONS = [1, 5, 10];
  const DEFAULT_VISIBLE_DRAWS = new Set(["ssq", "dlt"]);
  const LOTTERY_DATA_BASE_URL = "https://raw.githubusercontent.com/wenjinliuu/lottery-data-repo/main/public_data";
  const REMOTE_GAME_KEYS = { k8: "kl8" };
  const GAME_CONFIGS = {
    ssq: { label: "双色球", accent: "red", price: 2, sections: [{ key: "red", label: "红球", count: 6, color: "red" }, { key: "blue", label: "蓝球", count: 1, color: "blue" }] },
    qlc: { label: "七乐彩", accent: "yellow", price: 2, sections: [{ key: "nums7", label: "基本号", count: 7, color: "yellow" }], drawSections: [{ key: "nums7", label: "基本号", count: 7, color: "yellow" }, { key: "special", label: "特别号", count: 1, color: "k8orange" }] },
    fc3d: { label: "福彩3D", accent: "fc3d", price: 2, playModes: digitModes(), sections: [{ key: "nums3", label: "号码", count: 3, color: "fc3d" }] },
    dlt: { label: "大乐透", accent: "blue", price: 2, playModes: [{ key: "normal", label: "普通" }, { key: "add", label: "追加" }], sections: [{ key: "front", label: "前区", count: 5, color: "blue" }, { key: "back", label: "后区", count: 2, color: "yellow" }] },
    qxc: { label: "七星彩", accent: "indigo", price: 2, sections: [{ key: "nums6", label: "前六位", count: 6, color: "indigo" }, { key: "tail", label: "特别号", count: 1, color: "amber" }] },
    pl3: { label: "排列3", accent: "plum", price: 2, playModes: digitModes(), sections: [{ key: "nums3", label: "号码", count: 3, color: "plum" }] },
    pl5: { label: "排列5", accent: "plum", price: 2, sections: [{ key: "nums5", label: "号码", count: 5, color: "plum" }] },
    k8: { label: "快乐8", accent: "k8orange", price: 2, defaultPlayMode: "10", playModes: Array.from({ length: 10 }, (_, i) => ({ key: String(i + 1), label: `选${["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][i]}` })), sections: [{ key: "nums", label: "号码", count: 20, color: "k8orange" }] }
  };

  const K8_PRIZE_TABLE = {
    10: { 10: 5000000, 9: 8000, 8: 720, 7: 80, 6: 5, 5: 3, 0: 2 },
    9: { 9: 250000, 8: 2000, 7: 225, 6: 22, 5: 5, 4: 3, 0: 2 },
    8: { 8: 50000, 7: 800, 6: 80, 5: 10, 4: 3, 0: 2 },
    7: { 7: 8500, 6: 300, 5: 30, 4: 4, 0: 2 },
    6: { 6: 2880, 5: 30, 4: 10, 3: 3 },
    5: { 5: 1000, 4: 20, 3: 3 },
    4: { 4: 93, 3: 5, 2: 3 },
    3: { 3: 52, 2: 3 },
    2: { 2: 19 },
    1: { 1: 4.5 }
  };

  const DB_NAME = "lottery-personal-web";
  const DB_VERSION = 1;
  const RECORD_STORE = "records";
  const FINAL_RECORD_STATUSES = new Set(["won", "lost", "prize_float"]);

  const state = {
    gameKey: "ssq",
    playMode: "single",
    draftTickets: [],
    draws: [],
    records: [],
    activeView: "random",
    showAllDraws: false,
    latestUpdatedAt: "",
    historyGameKey: "ssq"
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    initTheme();
    initControls();
    bindEvents();
    await loadDraws();
    await loadRecords();
    randomizeTickets();
  }

  function cacheElements() {
    [
      "gameSelect", "playModeField", "playModeSelect", "countCard", "countTabs", "countInput", "multipleInput", "priceInput",
      "randomBtn", "saveBtn", "clearDraftBtn", "draftSummary", "draftList",
      "latestDraws", "reloadDrawsBtn", "recordList", "checkRecordsBtn",
      "historyList", "historySummary", "exportBackupBtn", "importBackupInput", "gameTabs",
      "playModeTabs", "todayTitle", "weekTitle", "heroTitle", "decreaseMultiplierBtn",
      "increaseMultiplierBtn", "multiplierText", "toggleDrawsBtn",
      "mineTotalCost", "minePrizeTotal", "mineWinRate", "mineWonCount", "mineRecordSummary",
      "mineRecordToggleBtn", "mineRecordList",
      "latestDrawsUpdated", "historyBackBtn", "toast",
      "themeToggleBtn", "themeToggleSub",
      "profitCard", "profitChartWrap", "profitEmpty", "profitNetValue", "profitNetDelta", "profitSub",
      "myRecordsBackBtn", "myRecordsSummary"
    ].forEach((id) => { els[id] = document.getElementById(id); });
  }

  /* ===== iOS 26 Liquid Glass — Theme manager (system → dark → light → system) ===== */

  const THEME_STORAGE_KEY = "lottery-theme";
  const THEME_LABELS = { system: "跟随系统", dark: "深色", light: "浅色" };

  function initTheme() {
    applyTheme(readSavedTheme());
    if (els.themeToggleBtn) {
      els.themeToggleBtn.addEventListener("click", () => {
        const cur = readSavedTheme();
        const next = cur === "system" ? "dark" : cur === "dark" ? "light" : "system";
        saveTheme(next);
        applyTheme(next);
      });
    }
    if (window.matchMedia) {
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
          if (readSavedTheme() === "system") applyTheme("system");
        });
      } catch (e) { /* Safari < 14 fallback noop */ }
    }
  }

  function readSavedTheme() {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      return v === "dark" || v === "light" ? v : "system";
    } catch (e) { return "system"; }
  }

  function saveTheme(mode) {
    try {
      if (mode === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) { /* private mode etc. */ }
  }

  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === "dark" || mode === "light") root.setAttribute("data-theme", mode);
    else root.removeAttribute("data-theme");
    const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = mode === "dark" || (mode === "system" && systemDark);
    if (els.themeToggleBtn) els.themeToggleBtn.setAttribute("aria-checked", String(isDark));
    if (els.themeToggleSub) els.themeToggleSub.textContent = THEME_LABELS[mode] || THEME_LABELS.system;
  }

  /* ===== iOS 26 Liquid Glass — View Transitions (with reduce-motion fallback) ===== */

  function withViewTransition(fn) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduce) {
      try { return document.startViewTransition(fn); } catch (e) { fn(); }
    } else {
      fn();
    }
  }

  /* ===== SVG icon library (SF Symbols 风) ===== */

  const ICON = {
    chevronUp:    '<svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    chevronDown:  '<svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    chevronRight: '<svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    trash:        '<svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
  };

  function initControls() {
    els.gameSelect.innerHTML = GAME_ORDER.map((key) => `<option value="${key}">${GAME_CONFIGS[key].label}</option>`).join("");
    els.gameSelect.value = state.gameKey;
    renderGameTabs();
    syncPlayModeOptions();
    syncDefaultPrice();
    renderCountTabs();
    renderMultiplier();
    renderHero();
  }

  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });
    els.gameSelect.addEventListener("change", () => {
      state.gameKey = els.gameSelect.value;
      renderGameTabs();
      syncPlayModeOptions();
      syncDefaultPrice();
      renderCountTabs();
      state.draftTickets = [];
      renderAll();
    });
    els.playModeSelect.addEventListener("change", () => {
      state.playMode = els.playModeSelect.value;
      renderPlayModeTabs();
      syncCurrentPrice();
      applyPlayModeChange();
    });
    els.randomBtn.addEventListener("click", randomizeTickets);
    els.saveBtn.addEventListener("click", () => saveDraftRecords(true));
    els.clearDraftBtn.addEventListener("click", () => {
      state.draftTickets = [];
      renderDraft();
    });
    els.reloadDrawsBtn.addEventListener("click", async () => {
      await loadDraws(true);
      await checkAllRecords();
    });
    els.toggleDrawsBtn.addEventListener("click", () => {
      state.showAllDraws = !state.showAllDraws;
      renderDraws();
    });
    els.decreaseMultiplierBtn.addEventListener("click", () => updateMultiplier(-1));
    els.increaseMultiplierBtn.addEventListener("click", () => updateMultiplier(1));
    els.checkRecordsBtn.addEventListener("click", checkAllRecords);
    if (els.historyBackBtn) els.historyBackBtn.addEventListener("click", () => switchView("check"));
    if (els.mineRecordToggleBtn) els.mineRecordToggleBtn.addEventListener("click", () => openMyRecordsView());
    if (els.myRecordsBackBtn) els.myRecordsBackBtn.addEventListener("click", () => switchView("mine"));
    els.exportBackupBtn.addEventListener("click", exportBackup);
    els.importBackupInput.addEventListener("change", importBackup);
  }

  function syncPlayModeOptions() {
    const config = GAME_CONFIGS[state.gameKey];
    const modes = config.playModes || [];
    els.playModeField.hidden = modes.length === 0;
    els.playModeSelect.innerHTML = modes.map((mode) => `<option value="${mode.key}">${mode.label}</option>`).join("");
    state.playMode = config.defaultPlayMode || (modes[0] ? modes[0].key : "");
    els.playModeSelect.value = state.playMode;
    renderPlayModeTabs();
  }

  function renderGameTabs() {
    els.gameTabs.innerHTML = GAME_ROWS.map((row) => `
      <div class="game-row game-row-${row.length}">
        ${row.map((key) => {
          const config = GAME_CONFIGS[key];
          const active = key === state.gameKey ? "game-tab-active" : "";
          return `<button class="game-tab game-tab-${config.accent} ${active}" type="button" data-game="${key}">${config.tabLabel || config.label}</button>`;
        }).join("")}
      </div>
    `).join("");
    els.gameTabs.querySelectorAll("[data-game]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.gameKey = btn.dataset.game;
        els.gameSelect.value = state.gameKey;
        renderGameTabs();
        syncPlayModeOptions();
        syncDefaultPrice();
        renderCountTabs();
        state.draftTickets = [];
        renderAll();
      });
    });
  }

  function renderCountTabs() {
    const show = COUNT_GAMES.has(state.gameKey);
    els.countCard.hidden = !show;
    if (!show) {
      els.countInput.value = "1";
      return;
    }
    const current = clampInt(els.countInput.value, 1, 10);
    els.countInput.value = COUNT_OPTIONS.includes(current) ? String(current) : "1";
    els.countTabs.dataset.accent = GAME_CONFIGS[state.gameKey]?.accent || "";
    els.countTabs.innerHTML = COUNT_OPTIONS.map((count) => `
      <button class="segment-btn ${Number(els.countInput.value) === count ? "segment-btn-active" : ""}" type="button" data-count="${count}">${count}</button>
    `).join("");
    els.countTabs.querySelectorAll("[data-count]").forEach((btn) => {
      btn.addEventListener("click", () => {
        els.countInput.value = btn.dataset.count;
        renderCountTabs();
        appendTickets(Number(btn.dataset.count));
      });
    });
  }

  function updateMultiplier(delta) {
    const current = clampInt(els.multipleInput.value, 1, 99);
    els.multipleInput.value = String(Math.max(1, Math.min(99, current + delta)));
    renderMultiplier();
    renderDraft();
  }

  function renderMultiplier() {
    els.multiplierText.textContent = `${clampInt(els.multipleInput.value, 1, 99)}倍`;
  }

  function renderPlayModeTabs() {
    const config = GAME_CONFIGS[state.gameKey];
    const modes = config.playModes || [];
    els.playModeTabs.dataset.accent = config.accent || "";
    els.playModeTabs.innerHTML = modes.map((mode) => `
      <button class="segment-btn ${mode.key === state.playMode ? "segment-btn-active" : ""}" type="button" data-play="${mode.key}">${mode.label}</button>
    `).join("");
    els.playModeTabs.classList.toggle("play-row-k8", state.gameKey === "k8");
    els.playModeTabs.querySelectorAll("[data-play]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.playMode = btn.dataset.play;
        els.playModeSelect.value = state.playMode;
        renderPlayModeTabs();
        syncCurrentPrice();
        applyPlayModeChange();
      });
    });
  }

  /* 切换玩法时：
     - dlt 普通/追加 仅切换 addOn 标志，不重新生成号码（保留原号）
     - 其他彩种 玩法决定号码生成方式（如 fc3d 直选/组三/组六），追加 1 注新号 */
  function applyPlayModeChange() {
    if (state.gameKey === "dlt") {
      const isAdd = state.playMode === "add";
      state.draftTickets = state.draftTickets.map((t) => ({
        ...t,
        playMode: state.playMode,
        addOn: isAdd
      }));
      renderDraft();
    } else {
      appendTickets(1);
    }
  }

  function switchView(view) {
    withViewTransition(() => {
      state.activeView = view;
      document.querySelectorAll("[data-view-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.viewPanel !== view;
      });
      document.querySelectorAll("[data-view]").forEach((btn) => {
        btn.classList.toggle("dock-item-active", btn.dataset.view === view);
      });
      renderHero();
    });
  }

  function renderHero() {
    const now = new Date();
    const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()];
    els.todayTitle.textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
    els.weekTitle.textContent = week;
    els.heroTitle.textContent = "";
  }

  function syncDefaultPrice() {
    const config = GAME_CONFIGS[state.gameKey];
    els.priceInput.value = String(config.price || 2);
    els.countInput.value = "1";
    els.multipleInput.value = "1";
    renderMultiplier();
  }

  function syncCurrentPrice() {
    els.priceInput.value = String(getCurrentTicketPrice());
  }

  function getCurrentTicketPrice() {
    const base = GAME_CONFIGS[state.gameKey]?.price || 2;
    return state.gameKey === "dlt" && state.playMode === "add" ? base + 1 : base;
  }

  async function loadDraws(showToast = false) {
    try {
      const payload = await fetchRemoteDraws();
      state.draws = payload.draws;
      state.latestUpdatedAt = payload.updatedAt || "";
      els.historySummary.textContent = payload.updatedAt ? `更新于 ${formatDateTime(payload.updatedAt)}` : "暂无开奖数据";
      if (els.latestDrawsUpdated) els.latestDrawsUpdated.textContent = payload.updatedAt ? `更新于 ${formatDateTime(payload.updatedAt)}` : "暂无更新时间";
      renderDraws();
      if (showToast) toast("开奖数据已刷新");
    } catch (error) {
      state.draws = [];
      state.latestUpdatedAt = "";
      if (els.latestDrawsUpdated) els.latestDrawsUpdated.textContent = "暂无更新时间";
      renderDraws();
      if (showToast) toast("读取开奖 JSON 失败");
    }
  }

  async function fetchRemoteDraws() {
    const cacheBust = `t=${Date.now()}`;
    const latest = await fetchJson(`${LOTTERY_DATA_BASE_URL}/latest.json?${cacheBust}`);
    const latestByLocalKey = normalizeRemoteLatest(latest.draws || {});
    const recentGroups = await Promise.all(GAME_ORDER.map(async (gameKey) => {
      const remoteKey = REMOTE_GAME_KEYS[gameKey] || gameKey;
      try {
        const payload = await fetchJson(`${LOTTERY_DATA_BASE_URL}/draws/${remoteKey}.json?${cacheBust}`);
        return Array.isArray(payload.draws) ? payload.draws.map((draw) => convertRemoteDraw(draw, gameKey)) : [];
      } catch (error) {
        return latestByLocalKey[gameKey] ? [latestByLocalKey[gameKey]] : [];
      }
    }));
    const draws = dedupeDraws(recentGroups.flat().concat(Object.values(latestByLocalKey)));
    return {
      updatedAt: latest.updated_at || latest.updatedAt || "",
      draws
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function normalizeRemoteLatest(remoteDraws) {
    return Object.keys(remoteDraws).reduce((map, remoteKey) => {
      const gameKey = remoteKey === "kl8" ? "k8" : remoteKey;
      if (GAME_CONFIGS[gameKey]) map[gameKey] = convertRemoteDraw(remoteDraws[remoteKey], gameKey);
      return map;
    }, {});
  }

  function convertRemoteDraw(remoteDraw, gameKeyOverride) {
    const gameKey = gameKeyOverride || (remoteDraw.lottery_type === "kl8" ? "k8" : remoteDraw.lottery_type);
    const drawValues = convertRemoteNumbers(gameKey, remoteDraw.numbers || {});
    const openCode = buildOpenCodeFromDrawValues(gameKey, drawValues);
    const prizeList = normalizeRemotePrizeList(remoteDraw.prize_details);
    const firstPrize = findPrizeByName(prizeList, "一等奖");
    const expect = String(remoteDraw.issue || "");
    const openDate = String(remoteDraw.draw_date || "");
    return {
      id: [gameKey, expect, openDate].filter(Boolean).join("_"),
      gameKey,
      gameName: remoteDraw.lottery_name || GAME_CONFIGS[gameKey]?.label || gameKey,
      caipiaoid: Number(remoteDraw.caipiaoid || 0),
      expect,
      openDate,
      deadline: String(remoteDraw.deadline || ""),
      openCode,
      drawValues,
      saleAmount: String(remoteDraw.sales_amount || ""),
      totalMoney: String(remoteDraw.prize_pool || ""),
      prizeList,
      firstPrize,
      nextExpect: String(remoteDraw.next_issue || ""),
      nextOpenDate: String(remoteDraw.next_draw_date || ""),
      nextOpenTime: String(remoteDraw.next_open_time || ""),
      nextBuyEndTime: String(remoteDraw.next_buy_end_time || ""),
      classLastExpect: String(remoteDraw.class_last_issue || ""),
      dataSource: "lottery-data-repo",
      fetchedAt: String(remoteDraw.fetched_at || remoteDraw.source?.fetched_at || "")
    };
  }

  function convertRemoteNumbers(gameKey, numbers) {
    if (gameKey === "ssq") return { red: numbers.red || [], blue: numbers.blue || [] };
    if (gameKey === "dlt") return { front: numbers.front || [], back: numbers.back || [] };
    if (gameKey === "k8") return { nums: numbers.nums || [] };
    if (gameKey === "fc3d" || gameKey === "pl3") return { nums: numbers.digits || [] };
    if (gameKey === "pl5") return { nums: numbers.digits || [] };
    if (gameKey === "qlc") return { front: numbers.basic || [], special: numbers.special };
    if (gameKey === "qxc") {
      const digits = numbers.digits || [];
      return { nums6: digits.slice(0, 6), tail: digits[6] };
    }
    return {};
  }

  function buildOpenCodeFromDrawValues(gameKey, drawValues) {
    if (gameKey === "ssq") return (drawValues.red || []).concat(drawValues.blue || []).join(",");
    if (gameKey === "dlt") return (drawValues.front || []).concat(drawValues.back || []).join(",");
    if (gameKey === "k8") return (drawValues.nums || []).join(",");
    if (gameKey === "fc3d" || gameKey === "pl3" || gameKey === "pl5") return (drawValues.nums || []).join(",");
    if (gameKey === "qlc") return (drawValues.front || []).concat([drawValues.special]).filter((item) => item !== undefined).join(",");
    if (gameKey === "qxc") return (drawValues.nums6 || []).concat([drawValues.tail]).filter((item) => item !== undefined).join(",");
    return "";
  }

  function normalizeRemotePrizeList(prizeDetails) {
    if (!Array.isArray(prizeDetails)) return [];
    return prizeDetails.map((item) => ({
      prizeName: String(item.prize_name || item.prize_level || ""),
      require: String(item.require || ""),
      num: Number(item.winning_count || 0),
      singleBonus: String(item.prize_amount || ""),
      prize: String(item.prize_amount || ""),
      addBonus: String(item.additional_prize_amount || item.add_prize_amount || item.append_prize_amount || item.addition_amount || "")
    }));
  }

  function findPrizeByName(prizeList, keyword) {
    return prizeList.find((prize) => String(prize.prizeName || "").includes(keyword)) || null;
  }

  function dedupeDraws(draws) {
    const map = new Map();
    draws.forEach((draw) => {
      if (!draw || !draw.gameKey || !draw.expect) return;
      map.set(draw.id || `${draw.gameKey}_${draw.expect}_${draw.openDate || ""}`, draw);
    });
    return Array.from(map.values()).sort(sortDrawDesc);
  }

  async function loadRecords() {
    state.records = await dbGetAll();
    await checkAllRecords(false);
  }

  function randomizeTickets() {
    const count = clampInt(els.countInput.value, 1, 20);
    state.draftTickets = generateTickets(state.gameKey, count, state.playMode);
    renderDraft();
  }

  function appendTickets(count = 1) {
    const nextTickets = generateTickets(state.gameKey, clampInt(count, 1, 20), state.playMode);
    state.draftTickets = state.draftTickets.concat(nextTickets);
    renderDraft();
  }

  async function saveDraftRecords(copyAfter = false) {
    if (!state.draftTickets.length) {
      toast("请先生成号码");
      return;
    }

    const now = new Date().toISOString();
    const multiple = clampInt(els.multipleInput.value, 1, 99);
    const price = Math.max(0, Number(getCurrentTicketPrice() || els.priceInput.value || 0));
    const batchId = `batch_${compactDate(now)}_${randomId()}`;
    const targetDraw = getNextDrawTarget(state.gameKey);
    if (!targetDraw.available) {
      toast(targetDraw.message);
      return;
    }
    const records = state.draftTickets.map((ticket, index) => {
      return {
        id: `${batchId}_${String(index + 1).padStart(3, "0")}`,
        batchId,
        gameKey: state.gameKey,
        gameName: GAME_CONFIGS[state.gameKey].label,
        playMode: ticket.playMode || state.playMode || "",
        expect: targetDraw.expect,
        openDate: targetDraw.openDate,
        targetExpect: targetDraw.expect,
        targetOpenDate: targetDraw.openDate,
        targetOpenTime: targetDraw.openTime,
        targetBuyEndTime: targetDraw.buyEndTime,
        targetSourceDrawId: targetDraw.sourceDrawId,
        numbers: ticket,
        price,
        multiple,
        status: "pending",
        resultText: "待核对",
        prizeAmount: 0,
        createdAt: now,
        updatedAt: now
      };
    });

    for (const record of records) await dbPut(record);
    state.records = await dbGetAll();
    renderRecords();
    if (copyAfter) {
      await copyDraftText(false);
      toast(`已保存并复制 ${records.length} 注`);
    } else {
      toast(`已保存 ${records.length} 注`);
    }
  }

  async function copyDraftText(showToast = true) {
    if (!state.draftTickets.length) {
      if (showToast) toast("暂无可复制号码");
      return;
    }
    const text = state.draftTickets.map(formatTicket).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      if (showToast) toast("号码已复制");
    } catch (error) {
      if (showToast) toast("复制失败，请手动选择文本");
    }
  }

  async function checkAllRecords(showToast = true) {
    const checked = [];
    let checkedCount = 0;
    let updatedCount = 0;

    for (const record of state.records) {
      if (!shouldEvaluateRecord(record)) {
        checked.push(record);
        continue;
      }

      checkedCount += 1;
      const nextRecord = evaluateRecord(record);
      checked.push(nextRecord);
      if (shouldPersistEvaluatedRecord(record, nextRecord)) {
        await dbPut(nextRecord);
        updatedCount += 1;
      }
    }

    state.records = checked;
    renderRecords();
    if (showToast) {
      toast(checkedCount ? `已核对 ${checkedCount} 条待开奖记录` : "暂无待核对记录");
    }
  }

  async function clearRecords() {
    if (!state.records.length) return;
    if (!window.confirm("确定清空所有本地选号记录吗？")) return;
    await dbClear();
    state.records = [];
    renderRecords();
    toast("本地记录已清空");
  }

  async function exportBackup() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      records: state.records
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lottery-backup-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("备份文件已生成");
  }

  async function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const records = Array.isArray(payload.records) ? payload.records : [];
      for (const record of records) await dbPut(evaluateRecord(record));
      state.records = await dbGetAll();
      renderRecords();
      toast(`已导入 ${records.length} 条记录`);
    } catch (error) {
      toast("导入失败，文件格式不正确");
    } finally {
      event.target.value = "";
    }
  }

  function renderAll() {
    renderHero();
    renderDraft();
    renderDraws();
    renderRecords();
  }

  function renderDraft() {
    const multiplier = clampInt(els.multipleInput.value, 1, 99);
    const price = getCurrentTicketPrice();
    const ticketCount = state.draftTickets.length;
    const totalCount = ticketCount * multiplier;
    const totalCost = price * ticketCount * multiplier;
    els.draftSummary.innerHTML = ticketCount
      ? `<span>${ticketCount} 注 × ${multiplier} 倍 = ${totalCount} 注</span><strong>${formatMoney(totalCost)}</strong>`
      : "暂无号码";
    if (!state.draftTickets.length) {
      els.draftList.className = "ticket-list empty-state";
      els.draftList.textContent = "点击“随机选号”生成号码";
      return;
    }
    els.draftList.className = "ticket-list";
    els.draftList.innerHTML = state.draftTickets.map((ticket, index) => `
      <article class="ticket-card random-ticket random-ticket-${state.gameKey}" style="--stagger-i:${index}">
        <div class="ticket-head">
          <div>
            <div class="ticket-no">第 ${index + 1} 注</div>
            <div class="meta">${GAME_CONFIGS[state.gameKey].label}${ticket.playMode ? ` · ${formatPlayMode(ticket.playMode)}` : ""}</div>
          </div>
          <div class="ticket-right">
            ${multiplier > 1 ? `<span class="ticket-type">${multiplier}倍</span>` : ""}
            <button class="delete-btn has-icon" type="button" data-delete-draft="${index}" aria-label="删除">${ICON.trash}<span>删除</span></button>
          </div>
        </div>
        ${renderTicketBalls(state.gameKey, ticket)}
      </article>
    `).join("");
    els.draftList.querySelectorAll("[data-delete-draft]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.draftTickets.splice(Number(btn.dataset.deleteDraft), 1);
        renderDraft();
      });
    });
  }

  function renderDraws() {
    els.toggleDrawsBtn.innerHTML = state.showAllDraws
      ? `${ICON.chevronUp}<span>收起</span>`
      : `${ICON.chevronDown}<span>展开</span>`;
    const visibleGames = state.showAllDraws ? GAME_ORDER : GAME_ORDER.filter((gameKey) => DEFAULT_VISIBLE_DRAWS.has(gameKey));
    const latestCards = visibleGames.map((gameKey, idx) => {
      const draw = getLatestDraw(gameKey);
      const config = GAME_CONFIGS[gameKey];
      if (!draw) {
        return `<article class="draw-card draw-card-${gameKey}" style="--stagger-i:${idx}"><div class="draw-head"><div class="draw-title">${config.label}</div><span class="draw-meta-tag">暂无数据</span></div></article>`;
      }
      return `
        <article class="draw-card draw-card-${gameKey}" style="--stagger-i:${idx}">
          <div class="draw-top">
            <div class="draw-title">${config.label}</div>
            <div class="draw-info">
              <div class="draw-meta-tag">${draw.expect || "未知期"} · ${draw.openDate || draw.time || "未知日期"}</div>
              ${renderFirstPrize(draw)}
            </div>
          </div>
          <div class="draw-number-row">
            ${renderDrawBalls(gameKey, draw.drawValues || parseOpenCodeToDrawValues(gameKey, draw.openCode))}
            <button class="draw-action-btn" type="button" data-history-game="${gameKey}" aria-label="往期">${ICON.chevronRight}</button>
          </div>
        </article>
      `;
    }).join("");
    els.latestDraws.innerHTML = latestCards;
    els.latestDraws.querySelectorAll("[data-history-game]").forEach((btn) => {
      btn.addEventListener("click", () => openGameHistory(btn.dataset.historyGame));
    });

    renderHistory();
  }

  function openGameHistory(gameKey) {
    state.historyGameKey = gameKey;
    renderHistory();
    switchView("history");
  }

  function renderHistory() {
    const gameKey = state.historyGameKey || state.gameKey;
    const config = GAME_CONFIGS[gameKey];
    const history = state.draws.filter((draw) => draw.gameKey === gameKey).slice().sort(sortDrawDesc).slice(0, 30);
    els.historySummary.textContent = `${config?.label || gameKey} · ${state.latestUpdatedAt ? `更新于 ${formatDateTime(state.latestUpdatedAt)}` : "暂无更新时间"}`;
    const title = document.querySelector(".history-title");
    if (title) title.textContent = `${config?.label || gameKey}往期开奖`;
    els.historyList.innerHTML = history.length ? history.map((draw, idx) => {
      const cfg = GAME_CONFIGS[draw.gameKey] || {};
      return `
        <article class="history-card draw-card-${draw.gameKey}" style="--stagger-i:${idx}">
          <div class="draw-top">
            <div class="draw-title">${cfg.label || draw.gameKey}</div>
            <div class="draw-info">
              <div class="draw-meta-tag">${draw.expect || "未知期"} · ${draw.openDate || draw.time || "未知日期"}</div>
              ${renderFirstPrize(draw)}
            </div>
          </div>
          <div class="draw-number-row">
            ${renderDrawBalls(draw.gameKey, draw.drawValues || parseOpenCodeToDrawValues(draw.gameKey, draw.openCode))}
          </div>
        </article>
      `;
    }).join("") : `<div class="empty-state">暂无${config?.label || ""}往期开奖数据</div>`;
  }

  function renderRecords() {
    const today = formatDate(new Date());
    const todayRecords = state.records.filter((record) => formatDate(record.createdAt) === today);
    renderRecordGroups(els.recordList, todayRecords, {
      emptyText: "今日暂无选号记录，完整记录在“我的”页查看",
      deleteScope: "today"
    });
    renderMyRecordsList();
    renderMineStats();
  }

  function renderMyRecordsList() {
    if (els.mineRecordList) {
      renderRecordGroups(els.mineRecordList, state.records, {
        emptyText: "暂无保存记录",
        deleteScope: "all"
      });
    }
    if (els.myRecordsSummary) {
      els.myRecordsSummary.textContent = `共 ${state.records.length} 条`;
    }
  }

  function openMyRecordsView() {
    renderMyRecordsList();
    switchView("myRecords");
  }

  function renderRecordGroups(container, records, options = {}) {
    if (!container) return;
    if (!records.length) {
      container.className = "record-list empty-state";
      container.textContent = options.emptyText || "暂无保存记录";
      return;
    }
    const groups = groupRecordsByGame(records);
    container.className = "record-list";
    container.innerHTML = groups.map(({ gameKey, gameRecords }, groupIdx) => {
      const config = GAME_CONFIGS[gameKey] || {};
      const latest = gameRecords[0] || {};
      const amount = gameRecords.reduce((sum, record) => sum + Number(record.prizeAmount || 0), 0);
      const pending = gameRecords.filter((record) => record.status === "pending").length;
      const floatCount = gameRecords.filter((record) => record.status === "prize_float").length;
      const groupStatus = pending ? `${pending} 条待开奖` : floatCount ? `${floatCount} 条奖金浮动` : "已开奖";
      const amountText = amount > 0 ? formatMoney(amount) : floatCount ? "浮动待定" : formatMoney(0);
      const meta = [
        latest.createdAt ? `选号时间 ${formatDateTime(latest.createdAt)}` : "",
        groupStatus
      ].filter(Boolean).join(" · ");
      return `
        <section class="record-game-group random-ticket-${gameKey}" style="--stagger-i:${groupIdx}">
          <div class="record-group-head">
            <div>
              <div class="record-group-title">
                <strong>${config.label || gameKey}</strong>
                <span class="status-pill">${gameRecords.length} 注</span>
              </div>
              <div class="record-group-sub">${meta}</div>
            </div>
            <div class="record-group-right">
              <div class="record-group-amount">中奖 ${amountText}</div>
              <button class="delete-btn has-icon" type="button" data-delete-game="${gameKey}" data-delete-scope="${options.deleteScope || "all"}" aria-label="删除">${ICON.trash}<span>删除</span></button>
            </div>
          </div>
          <div class="record-group-list">
            ${gameRecords.map((record) => renderRecordItem(record)).join("")}
          </div>
        </section>
      `;
    }).join("");
    container.querySelectorAll("[data-delete-game]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await deleteRecordsByGame(btn.dataset.deleteGame, btn.dataset.deleteScope);
      });
    });
  }

  function renderRecordItem(record) {
    const resolved = FINAL_RECORD_STATUSES.has(record.status) && record.matched;
    const cost = Number(record.price || 0) * Number(record.multiple || 1);
    const playText = formatPlayMode(record.playMode);
    const prizeText = record.status === "prize_float"
      ? "中奖金额：浮动待定"
      : `中奖金额：${formatMoney(record.prizeAmount || 0)}`;
    return `
      <article class="record-card random-ticket-${record.gameKey}">
        <div class="record-ticket-meta">
          <div class="record-ticket-line">
            <span>${playText || "选号"}</span>
            <span>成本 ${formatMoney(cost)}</span>
            <span>${record.multiple || 1}倍</span>
          </div>
          <span class="status-pill ${statusClass(record.status)}">${record.resultText || "待核对"}</span>
        </div>
        <div class="record-ticket-prize">${prizeText}</div>
        ${renderTicketBalls(record.gameKey, record.numbers, record.matched, resolved)}
      </article>
    `;
  }

  function groupRecordsByGame(records) {
    const map = new Map();
    records.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).forEach((record) => {
      const key = record.gameKey || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(record);
    });
    return Array.from(map.entries()).map(([gameKey, gameRecords]) => ({ gameKey, gameRecords }));
  }

  async function deleteRecordsByGame(gameKey, scope = "all") {
    const today = formatDate(new Date());
    const targets = state.records.filter((record) => {
      if (record.gameKey !== gameKey) return false;
      return scope === "today" ? formatDate(record.createdAt) === today : true;
    });
    if (!targets.length) return;
    const label = GAME_CONFIGS[gameKey]?.label || gameKey;
    const scopeText = scope === "today" ? "今日" : "全部";
    if (!window.confirm(`确定删除${label}${scopeText}选号记录吗？`)) return;
    for (const record of targets) await dbDelete(record.id);
    state.records = await dbGetAll();
    renderRecords();
    toast(`${label}记录已删除`);
  }

  function renderMineStats() {
    const stats = getMineStats();
    if (els.mineTotalCost) els.mineTotalCost.textContent = formatCompactMoney(stats.totalCost);
    if (els.minePrizeTotal) els.minePrizeTotal.textContent = stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize);
    if (els.mineWinRate) els.mineWinRate.textContent = `${stats.winRate}%`;
    if (els.mineWonCount) els.mineWonCount.textContent = String(stats.wonCount);
    if (els.mineRecordSummary) {
      els.mineRecordSummary.textContent = `共 ${stats.totalRecords} 条 · 待开奖 ${stats.pendingCount} 条 · 已花 ${formatMoney(stats.totalCost)}`;
    }
    renderProfitChart();
  }

  /* ===== iOS 26 Liquid Glass — Profit-trend SVG line chart ===== */

  function renderProfitChart() {
    if (!els.profitChartWrap) return;
    const series = buildProfitSeries(state.records);
    if (els.profitNetValue && els.profitNetDelta) {
      const net = series.netTotal;
      const cls = net > 0 ? "is-positive" : net < 0 ? "is-negative" : "";
      els.profitNetValue.className = `profit-net-value ${cls}`;
      els.profitNetValue.textContent = `${net > 0 ? "+" : ""}${formatCompactMoney(net)}`;
      els.profitNetDelta.textContent = series.points.length
        ? `共 ${series.points.length} 期 · 投入 ${formatCompactMoney(series.costTotal)} / 中奖 ${formatCompactMoney(series.prizeTotal)}`
        : "总盈亏";
    }
    if (els.profitSub) {
      els.profitSub.textContent = series.points.length
        ? (series.spanDays >= 1 ? `最近 ${Math.min(series.spanDays, 90)} 天 · ${series.points.length} 期` : `${series.points.length} 期`)
        : "尚无完整数据";
    }
    if (!series.points.length) {
      els.profitChartWrap.innerHTML = `<div class="profit-empty" id="profitEmpty">暂无数据，先去选号吧</div>`;
      return;
    }
    els.profitChartWrap.innerHTML = buildProfitChartSvg(series);
  }

  function buildProfitSeries(records) {
    const settled = (records || [])
      .filter((r) => r && (r.status === "won" || r.status === "lost") && r.createdAt)
      .slice()
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    const points = [];
    let cumCost = 0;
    let cumPrize = 0;
    for (const r of settled) {
      const cost = Number(r.price || 0) * Number(r.multiple || 1);
      const prize = Number(r.prizeAmount || 0);
      cumCost += cost;
      cumPrize += prize;
      points.push({
        t: new Date(r.createdAt).getTime(),
        cost: cumCost,
        prize: cumPrize,
        net: cumPrize - cumCost
      });
    }
    const first = points[0]?.t || 0;
    const last = points[points.length - 1]?.t || first;
    const spanDays = first ? Math.max(1, Math.ceil((last - first) / 86400000)) : 0;
    return {
      points,
      costTotal: cumCost,
      prizeTotal: cumPrize,
      netTotal: cumPrize - cumCost,
      spanDays
    };
  }

  function buildProfitChartSvg(series) {
    const W = 320, H = 168;
    const padL = 36, padR = 12, padT = 14, padB = 22;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const pts = series.points;

    const minT = pts[0].t;
    const maxT = pts[pts.length - 1].t;
    const tRange = maxT - minT || 1;

    const allVals = pts.flatMap((p) => [p.cost, p.prize, p.net]);
    const yMin = Math.min(0, ...allVals);
    const yMax = Math.max(0, ...allVals);
    const yRange = (yMax - yMin) || 1;

    const xOf = (t) => padL + ((t - minT) / tRange) * innerW;
    const yOf = (v) => padT + (1 - (v - yMin) / yRange) * innerH;

    const buildPath = (key) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p[key]).toFixed(1)}`).join(" ");
    const buildArea = (key) => {
      if (pts.length < 2) return "";
      const top = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p[key]).toFixed(1)}`).join(" ");
      const baseY = yOf(yMin).toFixed(1);
      const bottom = `L${xOf(pts[pts.length - 1].t).toFixed(1)} ${baseY} L${xOf(pts[0].t).toFixed(1)} ${baseY} Z`;
      return top + " " + bottom;
    };

    const gridYs = [0.0, 0.5, 1.0].map((p) => padT + p * innerH);
    const grid = gridYs.map((y) => `<line class="profit-grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${y.toFixed(1)}"/>`).join("");

    const yLabels = [yMax, yMin + yRange / 2, yMin].map((v, i) => {
      const y = padT + (i * innerH) / 2;
      return `<text class="profit-axis-label" x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${formatChartTick(v)}</text>`;
    }).join("");

    const xLabels = (() => {
      const fmt = (t) => {
        const d = new Date(t);
        return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      };
      const labels = [fmt(minT)];
      if (pts.length > 1) labels.push(fmt(maxT));
      return [
        `<text class="profit-axis-label" x="${padL}" y="${(H - 6).toFixed(1)}" text-anchor="start">${labels[0]}</text>`,
        labels[1] ? `<text class="profit-axis-label" x="${(W - padR).toFixed(1)}" y="${(H - 6).toFixed(1)}" text-anchor="end">${labels[1]}</text>` : ""
      ].join("");
    })();

    const last = pts[pts.length - 1];
    const dot = (key, cls) => `<circle class="profit-dot ${cls}" cx="${xOf(last.t).toFixed(1)}" cy="${yOf(last[key]).toFixed(1)}" r="3.4"/>`;

    return `
      <svg class="profit-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="收益趋势折线图">
        ${grid}
        <path class="profit-area-cost"  d="${buildArea("cost")}"/>
        <path class="profit-area-prize" d="${buildArea("prize")}"/>
        <path class="profit-line-cost"  d="${buildPath("cost")}"/>
        <path class="profit-line-prize" d="${buildPath("prize")}"/>
        <path class="profit-line-net"   d="${buildPath("net")}"/>
        ${dot("cost", "is-cost")}
        ${dot("prize", "is-prize")}
        ${dot("net", "is-net")}
        ${yLabels}
        ${xLabels}
      </svg>
    `;
  }

  function formatChartTick(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `${Math.round(n)}`;
  }

  function getMineStats() {
    const totalRecords = state.records.length;
    const totalCost = state.records.reduce((sum, record) => sum + Number(record.price || 0) * Number(record.multiple || 1), 0);
    const totalPrize = state.records.reduce((sum, record) => sum + Number(record.prizeAmount || 0), 0);
    const settledRecords = state.records.filter((record) => record.status === "won" || record.status === "lost" || record.status === "prize_float");
    const wonCount = state.records.filter((record) => record.status === "won" || record.status === "prize_float").length;
    const pendingCount = state.records.filter((record) => record.status === "pending").length;
    const floatCount = state.records.filter((record) => record.status === "prize_float").length;
    const winRate = settledRecords.length ? Math.round((wonCount / settledRecords.length) * 1000) / 10 : 0;
    return { totalRecords, totalCost, totalPrize, settledRecords, wonCount, pendingCount, floatCount, winRate };
  }

  function renderFirstPrize(draw) {
    if (!draw.firstPrize) return "";
    const num = Number(draw.firstPrize.num || 0);
    const bonus = draw.firstPrize.singleBonus || "";
    if (!bonus && !num) return "";
    return `<div class="draw-prize-tag">一等奖 ${num} 注 · ${formatPrizeAmount(bonus)}</div>`;
  }

  /* 一等奖等大额奖金：≥1 万显示「X.XX 万」，否则按整数元 */
  function formatPrizeAmount(value) {
    const n = parseMoneyNumber(value);
    if (!Number.isFinite(n) || n === 0) return "金额待定";
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万`;
    return `${Math.round(n).toLocaleString("zh-CN")}元`;
  }

  function evaluateRecord(record) {
    const draw = findDrawForRecord(record);
    if (!draw) {
      return { ...record, status: "pending", resultText: "待开奖" };
    }
    const drawValues = draw.drawValues || parseOpenCodeToDrawValues(record.gameKey, draw.openCode);
    const check = evaluateTicket(record.gameKey, record.numbers, drawValues, record.multiple, draw, record);
    const status = check.float ? "prize_float" : check.amount > 0 ? "won" : "lost";
    return {
      ...record,
      expect: draw.expect || record.expect || "",
      openDate: draw.openDate || draw.time || record.openDate || "",
      drawId: draw.id || record.drawId || "",
      status,
      resultText: check.float ? `${check.prizeName}，奖金浮动` : check.amount > 0 ? `中奖 ${formatMoney(check.amount)}` : "未中奖",
      prizeAmount: check.amount,
      prizeName: check.prizeName,
      matched: check.matched,
      drawOpenCode: draw.openCode,
      updatedAt: new Date().toISOString()
    };
  }

  function shouldEvaluateRecord(record) {
    if (!record) return false;
    if (record.status === "prize_float") return true;
    if (FINAL_RECORD_STATUSES.has(record.status) && record.matched) return false;
    return record.status === "pending" || !record.status || !record.matched;
  }

  function shouldPersistEvaluatedRecord(record, nextRecord) {
    if (record.status !== nextRecord.status) return true;
    if (String(record.resultText || "") !== String(nextRecord.resultText || "")) return true;
    if (Number(record.prizeAmount || 0) !== Number(nextRecord.prizeAmount || 0)) return true;
    if (String(record.prizeName || "") !== String(nextRecord.prizeName || "")) return true;
    if (String(record.expect || "") !== String(nextRecord.expect || "")) return true;
    if (String(record.openDate || "") !== String(nextRecord.openDate || "")) return true;
    if (String(record.drawId || "") !== String(nextRecord.drawId || "")) return true;
    if (String(record.drawOpenCode || "") !== String(nextRecord.drawOpenCode || "")) return true;
    return JSON.stringify(record.matched || null) !== JSON.stringify(nextRecord.matched || null);
  }

  function findDrawForRecord(record) {
    if (record.drawId) {
      const bound = state.draws.find((draw) => draw.id === record.drawId);
      if (bound) return bound;
    }
    const targetExpect = String(record.targetExpect || record.expect || "");
    if (targetExpect) {
      const exact = state.draws.find((draw) => draw.gameKey === record.gameKey && String(draw.expect || "") === targetExpect);
      if (exact) return exact;
      return null;
    }
    const createdDate = String(record.createdAt || "").slice(0, 10);
    return state.draws
      .filter((draw) => draw.gameKey === record.gameKey)
      .filter((draw) => {
        const openDate = String(draw.openDate || draw.time || "").slice(0, 10);
        return !createdDate || !openDate || openDate >= createdDate;
      })
      .sort(sortDrawAsc)[0] || null;
  }

  function getNextDrawTarget(gameKey) {
    const latest = getLatestDraw(gameKey);
    if (!latest) {
      return { available: false, message: "暂无下期开奖数据，请稍后刷新" };
    }
    const expect = String(latest.nextExpect || "");
    const openTime = String(latest.nextOpenTime || "");
    const buyEndTime = String(latest.nextBuyEndTime || "");
    if (!expect || !openTime || !buyEndTime) {
      return { available: false, message: "下期信息不完整，请稍后刷新" };
    }

    const now = new Date();
    const openDateValue = parseApiDate(openTime);
    const buyEndDateValue = parseApiDate(buyEndTime);
    if (!openDateValue || !buyEndDateValue) {
      return { available: false, message: "下期时间格式异常，请稍后刷新" };
    }
    if (now >= openDateValue) {
      return { available: false, message: "开奖数据待更新，请稍后刷新" };
    }
    if (now >= buyEndDateValue) {
      return { available: false, message: "本期已截止，请等待下一期数据更新" };
    }

    return {
      available: true,
      expect,
      openDate: String(latest.nextOpenDate || normalizeDate(openTime) || ""),
      openTime,
      buyEndTime,
      sourceDrawId: latest.id || ""
    };
  }

  function generateTickets(gameKey, count, playMode) {
    if (gameKey === "ssq") return Array.from({ length: count }, () => ({ red: pickUnique(33, 6), blue: pickUnique(16, 1) }));
    if (gameKey === "dlt") return Array.from({ length: count }, () => ({ front: pickUnique(35, 5), back: pickUnique(12, 2), playMode, addOn: playMode === "add" }));
    if (gameKey === "k8") return Array.from({ length: count }, () => {
      const playCount = clampInt(playMode, 1, 10);
      return { nums: pickUnique(80, playCount), playCount, playMode: String(playCount) };
    });
    if (gameKey === "fc3d" || gameKey === "pl3") return Array.from({ length: count }, () => ({ nums3: generateDigit(playMode), playMode }));
    if (gameKey === "pl5") return Array.from({ length: count }, () => ({ nums5: pickDigits(5) }));
    if (gameKey === "qlc") return Array.from({ length: count }, () => ({ nums7: pickUnique(30, 7) }));
    if (gameKey === "qxc") return Array.from({ length: count }, () => ({ nums6: pickDigits(6), tail: randomInt(0, 9) }));
    return [];
  }

  function generateDigit(mode) {
    if (mode === "group6") return pickUnique(9, 3, 0);
    if (mode === "group3") {
      const nums = pickUnique(9, 2, 0);
      nums.push(nums[randomInt(0, 1)]);
      return nums.sort((a, b) => a - b);
    }
    return pickDigits(3);
  }

  function renderTicketBalls(gameKey, ticket, matched = {}, dimUnmatched = false) {
    const config = GAME_CONFIGS[gameKey];
    let i = 0;
    return `<div class="balls">${config.sections.map((section) => {
      const values = getTicketSectionValues(gameKey, ticket, section.key);
      const hits = matched[section.key] || matched[mapMatchedKey(section.key)] || [];
      return values.map((value, index) => ball(value, section.color, hits[index], section.key, dimUnmatched && !hits[index], i++)).join("");
    }).join("")}</div>`;
  }

  function renderDrawBalls(gameKey, drawValues) {
    const config = GAME_CONFIGS[gameKey];
    const sections = config.drawSections || config.sections;
    let i = 0;
    return `<div class="balls">${sections.map((section) => {
      const values = getDrawSectionValues(gameKey, drawValues, section.key);
      return values.map((value) => ball(value, section.color, false, section.key, false, i++)).join("");
    }).join("")}</div>`;
  }

  function ball(value, color, hit = false, sectionKey = "", dim = false, idx = 0) {
    const compact = ["nums3", "nums5", "nums6", "tail"].includes(sectionKey);
    return `<span class="ball ${sectionKey === "tail" ? "" : "small"} ball-${color} ${hit ? "hit" : ""} ${dim ? "ball-dim" : ""}" style="--stagger-i:${idx}">${pad(value, compact ? 1 : 2)}</span>`;
  }

  function getTicketSectionValues(gameKey, ticket, key) {
    if (key === "red") return ticket.red || [];
    if (key === "blue") return ticket.blue || [];
    if (key === "front") return ticket.front || [];
    if (key === "back") return ticket.back || [];
    if (key === "nums") return ticket.nums || [];
    if (key === "nums3") return ticket.nums3 || [];
    if (key === "nums5") return ticket.nums5 || [];
    if (key === "nums7") return ticket.nums7 || [];
    if (key === "nums6") return ticket.nums6 || [];
    if (key === "tail") return [ticket.tail];
    return [];
  }

  function getDrawSectionValues(gameKey, draw, key) {
    if (!draw) return [];
    if (key === "red") return draw.red || [];
    if (key === "blue") return draw.blue || [];
    if (key === "front") return draw.front || [];
    if (key === "back") return draw.back || [];
    if (key === "nums") return draw.nums || [];
    if (key === "nums3") return draw.nums || [];
    if (key === "nums5") return draw.nums || [];
    if (key === "nums7") return draw.front || [];
    if (key === "special") return [draw.special ?? draw.tail].filter((item) => item !== null && item !== undefined);
    if (key === "nums6") return draw.nums6 || [];
    if (key === "tail") return [draw.tail ?? draw.special].filter((item) => item !== null && item !== undefined);
    return [];
  }

  function mapMatchedKey(key) {
    if (key === "nums3") return "nums3";
    if (key === "nums5") return "nums5";
    if (key === "nums7") return "nums7";
    if (key === "nums6") return "nums6";
    return key;
  }

  function formatTicket(ticket) {
    if (ticket.red) return `${ticket.red.map((n) => pad(n)).join("  ")} + ${ticket.blue.map((n) => pad(n)).join("  ")}`;
    if (ticket.front) return `${ticket.front.map((n) => pad(n)).join("  ")} + ${ticket.back.map((n) => pad(n)).join("  ")}${ticket.addOn ? "  追加" : ""}`;
    if (ticket.nums) return ticket.nums.map((n) => pad(n)).join("  ");
    if (ticket.nums3) return `${formatPlayMode(ticket.playMode)}\n${ticket.nums3.join("  ")}`;
    if (ticket.nums5) return ticket.nums5.join("  ");
    if (ticket.nums7) return ticket.nums7.map((n) => pad(n)).join("  ");
    if (ticket.nums6) return `${ticket.nums6.join("  ")} + ${ticket.tail}`;
    return "";
  }

  function parseOpenCodeToDrawValues(gameKey, openCode) {
    const nums = String(openCode || "").match(/\d+/g)?.map(Number) || [];
    if (gameKey === "ssq") return { red: nums.slice(0, 6), blue: nums.slice(6, 7) };
    if (gameKey === "dlt") return { front: nums.slice(0, 5), back: nums.slice(5, 7) };
    if (gameKey === "k8") return { nums: nums.slice(0, 20) };
    if (gameKey === "fc3d" || gameKey === "pl3") return { nums: nums.join("").split("").slice(0, 3).map(Number) };
    if (gameKey === "pl5") return { nums: nums.join("").split("").slice(0, 5).map(Number) };
    if (gameKey === "qlc") return { front: nums.slice(0, 7), special: nums[7] };
    if (gameKey === "qxc") return { nums6: nums.slice(0, 6), tail: nums[6] };
    return {};
  }

  function evaluateTicket(gameKey, ticket, draw, multiple = 1, drawMeta = null, record = null) {
    let result = noPrize({});
    if (gameKey === "ssq") result = evaluateSSQ(ticket, draw);
    if (gameKey === "dlt") result = evaluateDLT(ticket, draw, drawMeta);
    if (gameKey === "k8") result = evaluateK8(ticket, draw);
    if (gameKey === "fc3d" || gameKey === "pl3") result = evaluateDigit(ticket, draw);
    if (gameKey === "pl5") result = evaluatePL5(ticket, draw);
    if (gameKey === "qlc") result = evaluateQLC(ticket, draw);
    if (gameKey === "qxc") result = evaluateQXC(ticket, draw);
    const multiplier = clampInt(multiple, 1, 99);
    const dynamicAmount = result.float ? resolveFloatingPrizeAmount(drawMeta, result.prizeName, gameKey, record || { numbers: ticket }) : 0;
    if (result.float && dynamicAmount > 0) {
      return { ...result, float: false, amount: dynamicAmount * multiplier };
    }
    return { ...result, amount: result.float ? 0 : result.amount * multiplier };
  }

  function evaluateSSQ(ticket, draw) {
    const red = countMatches(ticket.red, draw.red);
    const blue = Number(ticket.blue?.[0]) === Number(draw.blue?.[0]) ? 1 : 0;
    const matched = { red: markMatches(ticket.red, draw.red), blue: [blue === 1] };
    if (red === 6 && blue) return floatPrize("一等奖", matched);
    if (red === 6) return floatPrize("二等奖", matched);
    if (red === 5 && blue) return fixedPrize("三等奖", 3000, matched);
    if ((red === 5 && !blue) || (red === 4 && blue)) return fixedPrize("四等奖", 200, matched);
    if ((red === 4 && !blue) || (red === 3 && blue)) return fixedPrize("五等奖", 10, matched);
    if ([0, 1, 2].includes(red) && blue) return fixedPrize("六等奖", 5, matched);
    if (red === 3 && !blue) return fixedPrize("福运奖", 5, matched);
    return noPrize(matched);
  }

  function evaluateDLT(ticket, draw, drawMeta = null) {
    const front = countMatches(ticket.front, draw.front);
    const back = countMatches(ticket.back, draw.back);
    const matched = { front: markMatches(ticket.front, draw.front), back: markMatches(ticket.back, draw.back) };
    if (front === 5 && back === 2) return floatPrize("一等奖", matched);
    if (front === 5 && back === 1) return floatPrize("二等奖", matched);
    if ((front === 5 && back === 0) || (front === 4 && back === 2)) return fixedPrize("三等奖", dltTierAmount(drawMeta, 5000, 6666), matched);
    if (front === 4 && back === 1) return fixedPrize("四等奖", dltTierAmount(drawMeta, 300, 380), matched);
    if ((front === 4 && back === 0) || (front === 3 && back === 2)) return fixedPrize("五等奖", dltTierAmount(drawMeta, 150, 200), matched);
    if ((front === 3 && back === 1) || (front === 2 && back === 2)) return fixedPrize("六等奖", dltTierAmount(drawMeta, 15, 18), matched);
    if ((front === 3 && back === 0) || (front === 2 && back === 1) || (front === 1 && back === 2) || (front === 0 && back === 2)) return fixedPrize("七等奖", dltTierAmount(drawMeta, 5, 7), matched);
    return noPrize(matched);
  }

  function evaluateK8(ticket, draw) {
    const matches = countMatches(ticket.nums, draw.nums);
    if ((Number(ticket.playCount) === 10 && matches === 10) || (Number(ticket.playCount) === 9 && matches === 9)) {
      return floatPrize(`选${ticket.playCount}中${matches}`, { nums: markMatches(ticket.nums, draw.nums) });
    }
    const amount = (K8_PRIZE_TABLE[ticket.playCount] || {})[matches] || 0;
    const matched = { nums: markMatches(ticket.nums, draw.nums) };
    return amount ? fixedPrize(`中${matches}`, amount, matched) : noPrize(matched);
  }

  function evaluateDigit(ticket, draw) {
    const nums = ticket.nums3 || [];
    if (ticket.playMode === "single") {
      const matched = { nums3: nums.map((n, i) => n === draw.nums[i]) };
      return matched.nums3.every(Boolean) ? fixedPrize("直选", 1040, matched) : noPrize(matched);
    }
    const matched = { nums3: markMatches(nums, draw.nums) };
    if (ticket.playMode === "group3") return isGroup3(draw.nums) && multisetEqual(nums, draw.nums) ? fixedPrize("组三", 346, matched) : noPrize(matched);
    return new Set(draw.nums).size === 3 && multisetEqual(nums, draw.nums) ? fixedPrize("组六", 173, matched) : noPrize(matched);
  }

  function evaluatePL5(ticket, draw) {
    const matched = { nums5: (ticket.nums5 || []).map((n, i) => n === draw.nums[i]) };
    return matched.nums5.every(Boolean) ? fixedPrize("一等奖", 100000, matched) : noPrize(matched);
  }

  function evaluateQLC(ticket, draw) {
    const front = countMatches(ticket.nums7, draw.front);
    const special = (ticket.nums7 || []).includes(draw.special) ? 1 : 0;
    const matched = { nums7: markMatches(ticket.nums7, (draw.front || []).concat([draw.special])) };
    if (front === 7) return floatPrize("一等奖", matched);
    if (front === 6 && special) return floatPrize("二等奖", matched);
    if (front === 6) return floatPrize("三等奖", matched);
    if (front === 5 && special) return fixedPrize("四等奖", 200, matched);
    if (front === 5) return fixedPrize("五等奖", 50, matched);
    if (front === 4 && special) return fixedPrize("六等奖", 10, matched);
    if (front === 4) return fixedPrize("七等奖", 5, matched);
    return noPrize(matched);
  }

  function evaluateQXC(ticket, draw) {
    const mainMatched = (ticket.nums6 || []).map((n, i) => n === draw.nums6[i]);
    const mainCount = mainMatched.filter(Boolean).length;
    const tailMatched = Number(ticket.tail) === Number(draw.tail);
    const matched = { nums6: mainMatched, tail: [tailMatched] };
    if (mainCount === 6 && tailMatched) return floatPrize("一等奖", matched);
    if (mainCount === 6) return floatPrize("二等奖", matched);
    if (mainCount === 5 && tailMatched) return fixedPrize("三等奖", 3000, matched);
    if (mainCount === 5 || (mainCount === 4 && tailMatched)) return fixedPrize("四等奖", 500, matched);
    if (mainCount === 4 || (mainCount === 3 && tailMatched)) return fixedPrize("五等奖", 30, matched);
    if (mainCount === 3 || tailMatched) return fixedPrize("六等奖", 5, matched);
    return noPrize(matched);
  }

  function dltTierAmount(draw, lowAmount, highAmount) {
    return parseMoneyNumber(draw?.totalMoney) >= 800000000 ? highAmount : lowAmount;
  }

  function resolveFloatingPrizeAmount(draw, prizeName, gameKey, record) {
    if (!draw || !Array.isArray(draw.prizeList)) return 0;
    const base = findPrizeAmount(draw.prizeList, prizeName, gameKey, record);
    if (gameKey !== "dlt" || !isDltAddOn(record) || !["一等奖", "二等奖"].includes(prizeName)) return base;
    const addOn = findPrizeAmount(draw.prizeList, `${prizeName}追加`, gameKey, record)
      || findPrizeAmount(draw.prizeList, `追加${prizeName}`, gameKey, record)
      || findDltInlineAddOnPrizeAmount(draw.prizeList, prizeName)
      || findDltAddOnPrizeAmount(draw.prizeList, prizeName);
    return base + (addOn || (base ? base * 0.8 : 0));
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
      return name.includes(prizeName) && (String(prizeName).includes("追加") || !name.includes("追加"));
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

  function getLatestDraw(gameKey) {
    return state.draws.filter((draw) => draw.gameKey === gameKey).sort(sortDrawDesc)[0] || null;
  }

  function sortDrawDesc(a, b) {
    const dateCompare = String(b.openDate || b.time || "").localeCompare(String(a.openDate || a.time || ""));
    if (dateCompare) return dateCompare;
    return String(b.expect || "").localeCompare(String(a.expect || ""));
  }

  function sortDrawAsc(a, b) {
    const dateCompare = String(a.openDate || a.time || "").localeCompare(String(b.openDate || b.time || ""));
    if (dateCompare) return dateCompare;
    return String(a.expect || "").localeCompare(String(b.expect || ""));
  }

  function normalizeDate(value) {
    return String(value || "").slice(0, 10);
  }

  function parseApiDate(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const normalized = text.includes("T") ? text : text.replace(/-/g, "/");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

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

  function fixedPrize(prizeName, amount, matched) {
    return { prizeName, amount, float: false, matched };
  }

  function floatPrize(prizeName, matched) {
    return { prizeName, amount: 0, float: true, matched };
  }

  function dbOpen() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RECORD_STORE)) {
          const store = db.createObjectStore(RECORD_STORE, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
          store.createIndex("gameKey", "gameKey");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbTransaction(mode, callback) {
    const db = await dbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(RECORD_STORE, mode);
      const store = tx.objectStore(RECORD_STORE);
      const result = callback(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  function dbGetAll() {
    return dbTransaction("readonly", (store) => {
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    });
  }

  function dbPut(record) {
    return dbTransaction("readwrite", (store) => store.put(record));
  }

  function dbDelete(id) {
    return dbTransaction("readwrite", (store) => store.delete(id));
  }

  function dbClear() {
    return dbTransaction("readwrite", (store) => store.clear());
  }

  function digitModes() {
    return [{ key: "single", label: "直选" }, { key: "group3", label: "组三" }, { key: "group6", label: "组六" }];
  }

  function pickUnique(max, count, min = 1) {
    const pool = Array.from({ length: max - min + 1 }, (_, index) => index + min);
    const result = [];
    while (result.length < count && pool.length) {
      const index = randomInt(0, pool.length - 1);
      result.push(pool[index]);
      pool.splice(index, 1);
    }
    return result.sort((a, b) => a - b);
  }

  function pickDigits(count) {
    return Array.from({ length: count }, () => randomInt(0, 9));
  }

  function randomInt(min, max) {
    const lower = Math.ceil(Number(min));
    const upper = Math.floor(Number(max));
    if (upper < lower) return lower;
    const range = upper - lower + 1;
    const limit = Math.floor(0x100000000 / range) * range;
    const buffer = new Uint32Array(1);

    do {
      crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);

    return lower + (buffer[0] % range);
  }

  function pad(value, digits = 2) {
    return String(value ?? "").padStart(digits, "0");
  }

  function clampInt(value, min, max) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function formatPlayMode(mode) {
    if (mode === "normal") return "普通";
    if (mode === "add") return "追加";
    if (mode === "single") return "直选";
    if (mode === "group3") return "组三";
    if (mode === "group6") return "组六";
    if (/^\d+$/.test(String(mode))) return `选${toChineseNumber(Number(mode))}`;
    return mode || "";
  }

  function statusClass(status) {
    if (status === "won") return "status-won";
    if (status === "prize_float") return "status-float";
    if (status === "lost") return "status-lost";
    return "";
  }

  function formatMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return value ? `${value}元` : "金额待定";
    return `${number.toLocaleString("zh-CN")}元`;
  }

  function formatCompactMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "待定";
    if (Math.abs(number) >= 10000) return `${(number / 10000).toFixed(number % 10000 === 0 ? 0 : 1)}万`;
    return formatMoney(number);
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

  function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${formatDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function compactDate(value) {
    return String(value).replace(/\D/g, "").slice(0, 14);
  }

  function randomId() {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 8);
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
  }
})();
