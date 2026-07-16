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
    historyGameKey: "ssq",
    dltAddOn: false,
    calendar: null,
    loadedHistoryGames: new Set(),
    historyLoadingGames: new Set(),
    recordFilterGame: "all",
    profitRange: "all",
    ticketScanResult: null,
    ticketScanPreview: "",
    ticketScanBusy: false,
    ticketScanAddDraft: null,
    nextDrawRefreshing: false,
    nextDrawRefreshAvailableAt: 0
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    initTheme();
    initControls();
    bindEvents();
    await Promise.all([loadCalendar(), loadDraws()]);
    await loadRecords();
    await reconcileInferredRecords(false);
    /* 首屏默认 ssq；若今日不开 ssq，自动切到今日开奖列表第一个 */
    const todayGames = getTodayOpenGames();
    if (todayGames.length && !todayGames.includes(state.gameKey)) {
      state.gameKey = todayGames[0];
      els.gameSelect.value = state.gameKey;
      renderGameTabs();
      syncPlayModeOptions();
      syncDefaultPrice();
      renderCountTabs();
    }
    /* 自动确定首屏彩种后，再同步一次今日开奖 chip 的激活态。 */
    renderTodayRecommend();
    randomizeTickets();
    renderBackupHint();
  }

  function cacheElements() {
    [
      "gameSelect", "playModeField", "playModeSelect", "countCard", "countTabs", "countInput", "multipleInput", "priceInput",
      "randomBtn", "saveBtn", "clearDraftBtn", "draftSummary", "draftList",
      "latestDraws", "reloadDrawsBtn", "recordList", "checkRecordsBtn",
      "historyList", "historySummary", "exportBackupBtn", "importBackupInput", "gameTabs",
      "playModeTabs", "todayTitle", "weekTitle", "decreaseMultiplierBtn",
      "increaseMultiplierBtn", "multiplierText", "toggleDrawsBtn",
      "mineTotalCost", "minePrizeTotal", "mineWinRate", "mineWonCount", "mineRecordSummary",
      "mineRecordToggleBtn", "mineRecordList",
      "latestDrawsUpdated", "historyBackBtn", "toast",
      "themeToggleBtn", "themeToggleSub",
      "profitCard", "profitChartWrap", "profitEmpty", "profitNetValue", "profitSub", "profitRangeTabs",
      "myRecordsBackBtn", "myRecordsSummary", "recordFilterChips", "recordFilterSummary",
      "wonRecordsBackBtn", "wonRecordsSummary", "wonRecordList", "mineWonRecordsBtn",
      "detailSheet", "detailSheetBackdrop", "detailSheetCloseBtn", "detailSheetTitle", "detailSheetSub", "detailSheetBody",
      "scanTicketBtn", "ticketScan", "ticketScanBackdrop", "ticketScanCloseBtn", "ticketScanTitle", "ticketScanSub", "ticketScanBody", "ticketScanInput",
      "dltAddOnBtn",
      "todayRecommend", "todayRecommendChips",
      "lastBackupHint",
      "draftDrawTag", "draftDrawRefreshBtn"
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
      /* a11y: role=switch 必须支持 Space / Enter 键盘触发 */
      els.themeToggleBtn.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); els.themeToggleBtn.click(); }
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
      btn.addEventListener("click", async () => {
        const view = btn.dataset.view;
        switchView(view);
        if (view === "check") {
          await ensurePendingRecordDraws();
          await checkAllRecords(false);
        }
      });
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
      if (state.draftTickets.length && !window.confirm(`清空当前 ${state.draftTickets.length} 注未保存号码？`)) return;
      state.draftTickets = [];
      renderDraft();
    });
    els.reloadDrawsBtn.addEventListener("click", async () => {
      await refreshNextDrawData(false);
      await ensurePendingRecordDraws();
      await checkAllRecords();
      toast("开奖与日历数据已刷新");
    });
    els.toggleDrawsBtn.addEventListener("click", () => {
      state.showAllDraws = !state.showAllDraws;
      renderDraws();
    });
    els.decreaseMultiplierBtn.addEventListener("click", () => updateMultiplier(-1));
    els.increaseMultiplierBtn.addEventListener("click", () => updateMultiplier(1));
    els.checkRecordsBtn.addEventListener("click", async () => {
      await refreshNextDrawData(false);
      await ensurePendingRecordDraws();
      await checkAllRecords();
    });
    if (els.draftDrawRefreshBtn) els.draftDrawRefreshBtn.addEventListener("click", () => refreshNextDrawData(true));
    if (els.scanTicketBtn) els.scanTicketBtn.addEventListener("click", openTicketScan);
    if (els.ticketScanBackdrop) els.ticketScanBackdrop.addEventListener("click", closeTicketScan);
    if (els.ticketScanCloseBtn) els.ticketScanCloseBtn.addEventListener("click", closeTicketScan);
    if (els.ticketScanInput) els.ticketScanInput.addEventListener("change", handleTicketScanFile);
    if (els.historyBackBtn) els.historyBackBtn.addEventListener("click", () => switchView("check"));
    if (els.mineRecordToggleBtn) els.mineRecordToggleBtn.addEventListener("click", () => openMyRecordsView());
    if (els.myRecordsBackBtn) els.myRecordsBackBtn.addEventListener("click", () => switchView("mine"));
    if (els.wonRecordsBackBtn) els.wonRecordsBackBtn.addEventListener("click", () => switchView("mine"));
    if (els.mineWonRecordsBtn) els.mineWonRecordsBtn.addEventListener("click", openWonRecordsView);
    document.querySelectorAll("[data-stat-details]").forEach((btn) => btn.addEventListener("click", openGameStatsSheet));
    if (els.detailSheetBackdrop) els.detailSheetBackdrop.addEventListener("click", closeDetailSheet);
    if (els.detailSheetCloseBtn) els.detailSheetCloseBtn.addEventListener("click", closeDetailSheet);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && els.detailSheet && !els.detailSheet.hidden) closeDetailSheet();
      if (event.key === "Escape" && els.ticketScan && !els.ticketScan.hidden) {
        const expandedPreview = els.ticketScanBody?.querySelector(".scan-preview-zoom.is-expanded");
        if (expandedPreview) expandedPreview.classList.remove("is-expanded");
        else closeTicketScan();
      }
    });
    if (els.dltAddOnBtn) {
      els.dltAddOnBtn.addEventListener("click", () => {
        state.dltAddOn = !state.dltAddOn;
        state.playMode = state.dltAddOn ? "add" : "normal";
        els.playModeSelect.value = state.playMode;
        renderDltAddOnBtn();
        syncCurrentPrice();
        applyPlayModeChange();
      });
    }
    els.exportBackupBtn.addEventListener("click", exportBackup);
    els.importBackupInput.addEventListener("change", importBackup);
    if (els.profitRangeTabs) {
      els.profitRangeTabs.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-profit-range]");
        if (!btn) return;
        state.profitRange = btn.dataset.profitRange || "all";
        els.profitRangeTabs.querySelectorAll("[data-profit-range]").forEach((item) => {
          const active = item.dataset.profitRange === state.profitRange;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        renderProfitChart();
      });
    }
  }

  function syncPlayModeOptions() {
    const config = GAME_CONFIGS[state.gameKey];
    const isDlt = state.gameKey === "dlt";
    /* dlt 不再走"普通/追加"两段 tab，改用 toolbar 上的独立 toggle 控制 */
    const modes = isDlt ? [] : (config.playModes || []);
    els.playModeField.hidden = modes.length === 0;
    els.playModeSelect.innerHTML = modes.map((mode) => `<option value="${mode.key}">${mode.label}</option>`).join("");
    if (isDlt) {
      state.playMode = state.dltAddOn ? "add" : "normal";
    } else {
      state.playMode = config.defaultPlayMode || (modes[0] ? modes[0].key : "");
    }
    els.playModeSelect.value = state.playMode;
    renderPlayModeTabs();
    renderDltAddOnBtn();
  }

  function renderDltAddOnBtn() {
    if (!els.dltAddOnBtn) return;
    const isDlt = state.gameKey === "dlt";
    els.dltAddOnBtn.hidden = !isDlt;
    const on = isDlt && state.dltAddOn;
    els.dltAddOnBtn.setAttribute("aria-pressed", String(on));
    els.dltAddOnBtn.classList.toggle("is-on", on);
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
        const newCount = Number(btn.dataset.count);
        const prevCount = clampInt(els.countInput.value, 1, 10);
        els.countInput.value = btn.dataset.count;
        renderCountTabs();
        /* 切到不同注数 → 清空旧 draft 重新生成 N
           连点同一个注数 → 在已有基础上累加 N */
        if (newCount !== prevCount) state.draftTickets = [];
        appendTickets(newCount);
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
        const isActive = btn.dataset.view === view;
        btn.classList.toggle("dock-item-active", isActive);
        if (isActive) btn.setAttribute("aria-current", "page");
        else btn.removeAttribute("aria-current");
      });
      renderHero();
      /* 进 random 时刷新开奖日期标注（处理停售时刻跨越） */
      if (view === "random") renderDraftHead();
    });
  }

  function renderHero() {
    const now = new Date();
    const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()];
    els.todayTitle.textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
    els.weekTitle.textContent = week;
    renderTodayRecommend();
  }

  /* ===== 今日开奖：从 calendar.json 计算当日开奖彩种并渲染彩色 chip ===== */

  async function loadCalendar() {
    try {
      const url = `${LOTTERY_DATA_BASE_URL}/calendar.json?t=${Date.now()}`;
      state.calendar = await fetchJson(url);
      renderTodayRecommend();
      return true;
    } catch (e) {
      state.calendar = null;
      renderTodayRecommend();
      return false;
    }
  }

  function getTodayOpenGames() {
    const wd = new Date().getDay(); /* 0=Sun ~ 6=Sat */
    if (state.calendar && state.calendar.lotteries) {
      const list = state.calendar.lotteries;
      return GAME_ORDER.filter((gameKey) => {
        const remoteKey = REMOTE_GAME_KEYS[gameKey] || gameKey;
        const entry = list[remoteKey] || list[gameKey];
        if (!entry || !Array.isArray(entry.draw_weekdays)) return false;
        return entry.draw_weekdays.includes(wd);
      });
    }
    /* 未拿到 calendar：用 fallback 周表 */
    const FALLBACK = {
      ssq: [0, 2, 4], dlt: [1, 3, 6], qlc: [1, 3, 5], qxc: [2, 5, 0],
      fc3d: [0, 1, 2, 3, 4, 5, 6], pl3: [0, 1, 2, 3, 4, 5, 6],
      pl5: [0, 1, 2, 3, 4, 5, 6], k8: [0, 1, 2, 3, 4, 5, 6]
    };
    return GAME_ORDER.filter((g) => (FALLBACK[g] || []).includes(wd));
  }

  function renderTodayRecommend() {
    if (!els.todayRecommendChips) return;
    const games = getTodayOpenGames();
    if (!games.length) {
      els.todayRecommendChips.innerHTML = `<span class="today-recommend-empty">今日无开奖</span>`;
      return;
    }
    els.todayRecommendChips.innerHTML = games.map((g) => {
      const cfg = GAME_CONFIGS[g] || {};
      const label = cfg.label || g;
      const active = g === state.gameKey ? " is-active" : "";
      const aria = active ? ` aria-current="true"` : "";
      return `<button class="today-chip today-chip-${g}${active}" type="button" data-today-game="${g}" aria-label="切换到 ${label}"${aria}>${label}</button>`;
    }).join("");
    els.todayRecommendChips.querySelectorAll("[data-today-game]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = btn.dataset.todayGame;
        if (!g || g === state.gameKey) {
          if (state.activeView !== "random") switchView("random");
          return;
        }
        state.gameKey = g;
        els.gameSelect.value = g;
        renderGameTabs();
        syncPlayModeOptions();
        syncDefaultPrice();
        renderCountTabs();
        state.draftTickets = [];
        randomizeTickets();
        renderAll();
        if (state.activeView !== "random") switchView("random");
      });
    });
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
      return true;
    } catch (error) {
      state.draws = [];
      state.latestUpdatedAt = "";
      if (els.latestDrawsUpdated) els.latestDrawsUpdated.textContent = "暂无更新时间";
      renderDrawsError();
      if (showToast) toast("读取开奖 JSON 失败");
      return false;
    }
  }

  async function refreshNextDrawData(showToast = true) {
    const now = Date.now();
    if (state.nextDrawRefreshing) return false;
    if (now < state.nextDrawRefreshAvailableAt) {
      if (showToast) toast("刚刚已经刷新，请稍后再试");
      return false;
    }
    state.nextDrawRefreshing = true;
    state.nextDrawRefreshAvailableAt = now + 10000;
    renderDraftHead();
    try {
      const [calendarOk, drawsOk] = await Promise.all([loadCalendar(), loadDraws(false)]);
      if (!calendarOk && !drawsOk) {
        if (showToast) toast("刷新失败，请检查网络后重试");
        return false;
      }
      const reconciliation = await reconcileInferredRecords(false);
      renderAll();
      if (showToast) {
        if (reconciliation.corrected) {
          toast(`已按官方日历修正 ${reconciliation.corrected} 注记录`);
        } else if (reconciliation.confirmed) {
          toast(`已确认 ${reconciliation.confirmed} 注预测记录`);
        } else {
          const target = getNextDrawTarget(state.gameKey);
          toast(target.status === "inferred" ? "已是最新数据，下一期仍为预计状态" : "下一期开奖数据已刷新");
        }
      }
      return true;
    } finally {
      state.nextDrawRefreshing = false;
      renderDraftHead();
    }
  }

  /* B-C5: 兑奖页加载失败的可重试 empty state */
  function renderDrawsError() {
    if (!els.latestDraws) return;
    els.latestDraws.innerHTML = `
      <div class="empty empty-error">
        <div>开奖数据加载失败 — 检查网络后重试</div>
        <button class="mini-blue has-icon" type="button" id="retryDrawsBtn">
          <svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
          <span>重试</span>
        </button>
      </div>
    `;
    const retryBtn = document.getElementById("retryDrawsBtn");
    if (retryBtn) retryBtn.addEventListener("click", () => loadDraws(true));
  }

  async function fetchRemoteDraws() {
    const cacheBust = `t=${Date.now()}`;
    const latest = await fetchJson(`${LOTTERY_DATA_BASE_URL}/latest.json?${cacheBust}`);
    const latestByLocalKey = normalizeRemoteLatest(latest.draws || {});
    /* 首屏只读取 latest.json。各彩种近 50 期在用户打开往期或核对旧记录时按需加载。 */
    const previousHistory = state.draws.filter((draw) => state.loadedHistoryGames.has(draw.gameKey));
    const draws = dedupeDraws(previousHistory.concat(Object.values(latestByLocalKey)));
    return {
      updatedAt: latest.updated_at || latest.updatedAt || "",
      draws
    };
  }

  async function loadGameHistory(gameKey, showError = true) {
    if (!GAME_CONFIGS[gameKey] || state.loadedHistoryGames.has(gameKey)) return true;
    if (state.historyLoadingGames.has(gameKey)) return false;
    state.historyLoadingGames.add(gameKey);
    renderHistory();
    try {
      const remoteKey = REMOTE_GAME_KEYS[gameKey] || gameKey;
      const payload = await fetchJson(`${LOTTERY_DATA_BASE_URL}/draws/${remoteKey}.json?t=${Date.now()}`);
      const history = Array.isArray(payload.draws) ? payload.draws.map((draw) => convertRemoteDraw(draw, gameKey)) : [];
      state.draws = dedupeDraws(state.draws.concat(history));
      state.loadedHistoryGames.add(gameKey);
      return true;
    } catch (error) {
      if (showError) toast(`${GAME_CONFIGS[gameKey].label}往期数据加载失败`);
      return false;
    } finally {
      state.historyLoadingGames.delete(gameKey);
      renderDraws();
    }
  }

  async function ensurePendingRecordDraws() {
    const neededGames = new Set();
    state.records.forEach((record) => {
      if (shouldEvaluateRecord(record) && !findDrawForRecord(record) && GAME_CONFIGS[record.gameKey]) {
        neededGames.add(record.gameKey);
      }
    });
    await Promise.all(Array.from(neededGames, (gameKey) => loadGameHistory(gameKey, false)));
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
      nextStatus: String(remoteDraw.next_status || (remoteDraw.next_confirmed === false ? "inferred" : "confirmed")),
      nextSource: String(remoteDraw.next_source || "class_api"),
      nextConfirmed: remoteDraw.next_confirmed !== false,
      nextBasisIssue: String(remoteDraw.next_basis_issue || remoteDraw.issue || ""),
      nextResolutionReason: String(remoteDraw.next_resolution_reason || ""),
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
      addBonus: String(item.additional_amount || item.additional_prize_amount || item.add_prize_amount || item.append_prize_amount || item.addition_amount || "")
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

  async function reconcileInferredRecords(showToast = true) {
    let confirmed = 0;
    let corrected = 0;
    let review = 0;
    let changed = false;
    for (const record of state.records) {
      if (FINAL_RECORD_STATUSES.has(record.status) || record.targetStatus !== "inferred") continue;
      const targetExpect = String(record.targetExpect || record.expect || "");
      const targetDrawAlreadyExists = state.draws.some((draw) => (
        draw.gameKey === record.gameKey && String(draw.expect || "") === targetExpect
      ));
      if (targetDrawAlreadyExists) continue;

      const official = getNextDrawMetadata(record.gameKey);
      if (!official || official.status !== "confirmed" || !official.confirmed) continue;
      const basisIssue = String(record.targetBasisIssue || "");
      if (!basisIssue || !official.basisIssue || basisIssue !== official.basisIssue) {
        const reviewRecord = {
          ...record,
          targetStatus: "review",
          targetReviewReason: "official_basis_issue_changed",
          updatedAt: new Date().toISOString()
        };
        await dbPut(reviewRecord);
        review += 1;
        changed = true;
        continue;
      }

      const targetChanged = (
        targetExpect !== official.expect
        || String(record.targetOpenDate || record.openDate || "") !== official.openDate
        || String(record.targetOpenTime || "") !== official.openTime
      );
      const nextRecord = {
        ...record,
        expect: official.expect,
        openDate: official.openDate,
        targetExpect: official.expect,
        targetOpenDate: official.openDate,
        targetOpenTime: official.openTime,
        targetBuyEndTime: official.buyEndTime,
        targetSourceDrawId: official.sourceDrawId,
        targetStatus: "confirmed",
        targetSource: official.source,
        targetConfirmed: true,
        targetBasisIssue: official.basisIssue,
        targetResolutionReason: official.resolutionReason,
        targetConfirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (targetChanged) {
        nextRecord.originalTargetExpect = record.originalTargetExpect || targetExpect;
        nextRecord.originalTargetOpenDate = record.originalTargetOpenDate || record.targetOpenDate || record.openDate || "";
        nextRecord.targetCorrectedAt = new Date().toISOString();
        nextRecord.targetCorrectionReason = "class_api_confirmed";
        corrected += 1;
      } else {
        confirmed += 1;
      }
      await dbPut(nextRecord);
      changed = true;
    }
    if (changed) {
      state.records = await dbGetAll();
      renderRecords();
    }
    if (showToast) {
      if (corrected) toast(`已按官方日历修正 ${corrected} 注记录`);
      else if (confirmed) toast(`已确认 ${confirmed} 注预测记录`);
      else if (review) toast(`${review} 注记录需要确认目标期号`);
    }
    return { confirmed, corrected, review };
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

    /* iOS Safari 修复：剪贴板必须在 await 之前同步触发，
       否则 user activation 会在 dbPut 的 await 之后失效，
       navigator.clipboard.writeText 会被静默拒绝。
       业务逻辑（record 生成 / dbPut / dbGetAll / renderRecords）保持不变。 */
    let copyOk = true;
    if (copyAfter) {
      copyOk = copyToClipboard(buildClipboardBlock(state.draftTickets, state.gameKey));
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
        targetStatus: targetDraw.status,
        targetSource: targetDraw.source,
        targetConfirmed: targetDraw.confirmed,
        targetBasisIssue: targetDraw.basisIssue,
        targetResolutionReason: targetDraw.resolutionReason,
        originalTargetExpect: targetDraw.status === "inferred" ? targetDraw.expect : "",
        originalTargetOpenDate: targetDraw.status === "inferred" ? targetDraw.openDate : "",
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
    const viewAction = { label: "查看", onClick: () => switchView("check") };
    if (copyAfter) {
      if (copyOk) {
        toast(`已保存并复制 ${records.length} 注`, viewAction);
      } else {
        /* 第一次同步复制失败 — 让用户用 toast action 触发新的 user gesture 重试 */
        toast(`已保存 ${records.length} 注 · 复制失败`, {
          label: "重试复制",
          onClick: () => {
            const ok2 = copyToClipboard(buildClipboardBlock(state.draftTickets, state.gameKey));
            toast(ok2 ? "号码已复制" : "复制仍失败，请长按号码块手动选择");
          }
        });
      }
    } else {
      toast(`已保存 ${records.length} 注`, viewAction);
    }
  }

  /* iOS Safari 复制方案：
     - 不能用 textarea + select() — iOS 不接受这种选区
     - 不能用 contentEditable + Range API on textarea — 行为不一致
     - 最稳：<pre> + Range + user-select:text + execCommand("copy") */
  function legacyCopy(text) {
    const yPos = window.pageYOffset || document.documentElement.scrollTop || 0;
    const pre = document.createElement("pre");
    pre.textContent = text;
    pre.style.cssText = [
      "position:absolute",
      "top:" + yPos + "px",
      "left:-9999px",
      "white-space:pre",        /* 保留剪贴板格式的换行 */
      "font-size:12pt",         /* 防 iOS 自动放大视口 */
      "padding:0;border:0;margin:0",
      "user-select:text",       /* 显式允许选中（CSS reset 可能禁用了）*/
      "-webkit-user-select:text"
    ].join(";");
    document.body.appendChild(pre);

    const selection = window.getSelection();
    /* 备份用户当前选区，复制完还原 */
    const previousRanges = [];
    for (let i = 0; i < selection.rangeCount; i++) previousRanges.push(selection.getRangeAt(i));
    selection.removeAllRanges();

    const range = document.createRange();
    range.selectNodeContents(pre);
    selection.addRange(range);

    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }

    selection.removeAllRanges();
    for (const r of previousRanges) selection.addRange(r);
    document.body.removeChild(pre);
    return ok;
  }

  function copyToClipboard(text) {
    /* 1. 同步 execCommand — iOS Safari 必走这条 */
    let ok = false;
    try { ok = legacyCopy(text); } catch (e) {}
    if (ok) return true;
    /* 2. fallback：现代 Clipboard API */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(text).catch(() => {});
        return true;
      } catch (e) {}
    }
    return false;
  }

  function copyDraftText(showToast = true) {
    if (!state.draftTickets.length) {
      if (showToast) toast("暂无可复制号码");
      return false;
    }
    const text = buildClipboardBlock(state.draftTickets, state.gameKey);
    const ok = copyToClipboard(text);
    if (showToast) toast(ok ? "号码已复制" : "复制失败，请手动选择文本");
    return ok;
  }

  /* ===== 剪贴板格式：标题｜投入｜分组号码 ===== */

  function buildClipboardBlock(tickets, gameKey) {
    const cfg = GAME_CONFIGS[gameKey] || {};
    const name = cfg.label || gameKey;
    const count = tickets.length;
    const multiplier = clampInt(els.multipleInput.value, 1, 99);
    const price = getCurrentTicketPrice();
    const totalCost = price * count * multiplier;

    /* —— 标题 —— */
    const headParts = [name, `${count}注`];
    if (multiplier > 1) headParts.push(`${multiplier}倍`);

    if (gameKey === "dlt") {
      if (state.dltAddOn) {
        headParts.push("追加");
      } else {
        const md = getNextOpenDateMMDD(gameKey);
        if (md) headParts.push(`开奖日 ${md}`);
      }
    } else if (gameKey === "ssq" || gameKey === "qlc" || gameKey === "qxc" || gameKey === "k8") {
      const md = getNextOpenDateMMDD(gameKey);
      if (md) headParts.push(`开奖日 ${md}`);
    }
    const title = headParts.join("｜");

    const investLine = `投入：${totalCost}元`;

    /* —— 号码区 —— */
    let body = "";
    if (gameKey === "fc3d" || gameKey === "pl3") {
      const groups = groupTicketsByPlayMode(tickets);
      body = groups.map((g) => {
        const head = `${formatPlayModeForCopy(g.playMode)}｜${g.list.length}注`;
        const lines = g.list.map((t) => formatTicketBody(gameKey, t)).join("\n");
        return `${head}\n${lines}`;
      }).join("\n\n");
    } else {
      body = tickets.map((t) => formatTicketBody(gameKey, t)).join("\n");
    }

    return `${title}\n${investLine}\n\n${body}`;
  }

  function formatTicketBody(gameKey, ticket) {
    if (gameKey === "ssq") {
      return `${(ticket.red || []).map((n) => pad(n)).join("  ")} + ${pad((ticket.blue || [])[0])}`;
    }
    if (gameKey === "dlt") {
      return `${(ticket.front || []).map((n) => pad(n)).join("  ")} + ${(ticket.back || []).map((n) => pad(n)).join("  ")}`;
    }
    if (gameKey === "k8") {
      return (ticket.nums || []).map((n) => pad(n)).join("  ");
    }
    if (gameKey === "fc3d" || gameKey === "pl3") {
      return (ticket.nums3 || []).join(" ");
    }
    if (gameKey === "pl5") {
      return (ticket.nums5 || []).join("  ");
    }
    if (gameKey === "qlc") {
      return (ticket.nums7 || []).map((n) => pad(n)).join("  ");
    }
    if (gameKey === "qxc") {
      return `${(ticket.nums6 || []).join(" ")} + ${ticket.tail}`;
    }
    return "";
  }

  function groupTicketsByPlayMode(tickets) {
    const map = new Map();
    tickets.forEach((t) => {
      const key = t.playMode || "single";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    const ORDER = ["single", "group3", "group6"];
    const known = ORDER.filter((k) => map.has(k)).map((k) => ({ playMode: k, list: map.get(k) }));
    const others = Array.from(map.keys()).filter((k) => !ORDER.includes(k)).map((k) => ({ playMode: k, list: map.get(k) }));
    return known.concat(others);
  }

  function formatPlayModeForCopy(mode) {
    if (mode === "single") return "直选";
    if (mode === "group3") return "组3";
    if (mode === "group6") return "组6";
    if (mode === "normal") return "普通";
    if (mode === "add") return "追加";
    if (/^\d+$/.test(String(mode))) return `选${mode}`;
    return mode || "";
  }

  function getNextOpenDateMMDD(gameKey) {
    /* 优先从 calendar.json 取下次开奖日期 */
    if (state.calendar && state.calendar.lotteries) {
      const remoteKey = REMOTE_GAME_KEYS[gameKey] || gameKey;
      const entry = state.calendar.lotteries[remoteKey] || state.calendar.lotteries[gameKey];
      const nt = entry && (entry.next_open_time || entry.nextopentime);
      const md = nt ? extractMMDD(nt) : "";
      if (md) return md;
    }
    /* 退而求其次：用最近开奖卡的 next 字段 */
    const draw = getLatestDraw(gameKey);
    if (draw) {
      return extractMMDD(draw.nextOpenDate || draw.nextOpenTime || "");
    }
    return "";
  }

  function extractMMDD(value) {
    const m = String(value || "").match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!m) return "";
    return `${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
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

  /* B-M4: 备份时间提示 */
  const LAST_BACKUP_KEY = "lottery-last-backup";
  function readLastBackupAt() {
    try { return localStorage.getItem(LAST_BACKUP_KEY) || ""; } catch (e) { return ""; }
  }
  function writeLastBackupAt(iso) {
    try { localStorage.setItem(LAST_BACKUP_KEY, iso); } catch (e) {}
  }
  function renderBackupHint() {
    if (!els.lastBackupHint) return;
    const last = readLastBackupAt();
    if (!last) {
      els.lastBackupHint.textContent = "生成 JSON 文件，换设备时可以恢复。";
      return;
    }
    const diffMs = Date.now() - new Date(last).getTime();
    const day = 86400000;
    let rel;
    if (diffMs < 60000) rel = "刚刚";
    else if (diffMs < 3600000) rel = `${Math.floor(diffMs / 60000)} 分钟前`;
    else if (diffMs < day) rel = `${Math.floor(diffMs / 3600000)} 小时前`;
    else if (diffMs < day * 30) rel = `${Math.floor(diffMs / day)} 天前`;
    else rel = formatDate(last);
    els.lastBackupHint.textContent = `上次备份：${rel}`;
  }

  async function exportBackup() {
    const now = new Date().toISOString();
    const payload = {
      version: 1,
      exportedAt: now,
      records: state.records
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lottery-backup-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    writeLastBackupAt(now);
    renderBackupHint();
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

  /* 当前彩种"本批号码归属哪天开奖"的标注。三态：
       ok    — 当期可投注，显示"X月X日 开奖" + 期号
       warn  — 本期已截止，显示"已截止 · 下期 X月X日"
       muted — 没拿到开奖数据 */
  function getDraftDrawHint(gameKey) {
    const target = getNextDrawTarget(gameKey);
    if (target.available) {
      const md = formatDrawMD(target.openTime) || formatDrawMD(target.openDate);
      const expectShort = target.expect ? `第 ${target.expect} 期` : "";
      const prefix = target.status === "inferred" ? "预计 " : "";
      return {
        tone: target.status === "inferred" ? "inferred" : "ok",
        text: md ? `${prefix}${md} 开奖${expectShort ? ` · ${expectShort}` : ""}` : `${prefix}${expectShort || "下期开奖"}`,
        refreshable: target.status === "inferred"
      };
    }
    const fallbackMD = getNextOpenDateMMDD(gameKey);
    if (fallbackMD && /截止/.test(target.message || "")) {
      return { tone: "warn", text: `已截止 · 下期 ${fallbackMD.replace("/", "月") + "日"}`, refreshable: true };
    }
    return { tone: "muted", text: target.message || "等待开奖数据", refreshable: true };
  }

  function formatDrawMD(value) {
    const m = String(value || "").match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!m) return "";
    return `${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
  }

  function renderDraftHead() {
    const hint = getDraftDrawHint(state.gameKey);
    if (els.draftDrawTag) {
      els.draftDrawTag.textContent = hint.text;
      els.draftDrawTag.dataset.tone = hint.tone;
    }
    if (els.draftDrawRefreshBtn) {
      els.draftDrawRefreshBtn.hidden = !hint.refreshable;
      els.draftDrawRefreshBtn.disabled = state.nextDrawRefreshing;
      els.draftDrawRefreshBtn.classList.toggle("is-loading", state.nextDrawRefreshing);
    }
  }

  function renderDraft() {
    renderDraftHead();
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
          <div class="ticket-head-left">
            <span class="ticket-no">第 ${index + 1} 注</span>
            <span class="ticket-meta-inline">${GAME_CONFIGS[state.gameKey].label}${ticket.playMode ? ` · ${formatPlayMode(ticket.playMode)}` : ""}</span>
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
            <span class="draw-meta-tag">${draw.expect || "未知期"} · ${draw.openDate || draw.time || "未知日期"}</span>
          </div>
          ${renderFirstPrize(draw)}
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

  async function openGameHistory(gameKey) {
    state.historyGameKey = gameKey;
    switchView("history");
    renderHistory();
    await loadGameHistory(gameKey);
  }

  function renderHistory() {
    const gameKey = state.historyGameKey || state.gameKey;
    const config = GAME_CONFIGS[gameKey];
    const history = state.draws.filter((draw) => draw.gameKey === gameKey).slice().sort(sortDrawDesc).slice(0, 30);
    els.historySummary.textContent = `${config?.label || gameKey} · ${state.latestUpdatedAt ? `更新于 ${formatDateTime(state.latestUpdatedAt)}` : "暂无更新时间"}`;
    const title = document.querySelector(".history-title");
    if (title) title.textContent = `${config?.label || gameKey}往期开奖`;
    if (state.historyLoadingGames.has(gameKey)) {
      els.historyList.innerHTML = `<div class="empty-state">正在加载${config?.label || ""}往期开奖…</div>`;
      return;
    }
    els.historyList.innerHTML = history.length ? history.map((draw, idx) => {
      const cfg = GAME_CONFIGS[draw.gameKey] || {};
      return `
        <article class="history-card draw-card-${draw.gameKey}" style="--stagger-i:${idx}">
          <div class="draw-top">
            <div class="draw-title">${cfg.label || draw.gameKey}</div>
            <span class="draw-meta-tag">${draw.expect || "未知期"} · ${draw.openDate || draw.time || "未知日期"}</span>
          </div>
          ${renderFirstPrize(draw)}
          <div class="draw-number-row">
            ${renderDrawBalls(draw.gameKey, draw.drawValues || parseOpenCodeToDrawValues(draw.gameKey, draw.openCode))}
          </div>
        </article>
      `;
    }).join("") : `<div class="empty-state">暂无${config?.label || ""}往期开奖数据</div>`;
  }

  function renderRecords() {
    const visibleRecords = getCheckVisibleRecords();
    renderRecordGroups(els.recordList, visibleRecords, {
      emptyText: "暂无本期或上期选号记录，完整记录在“我的”页查看",
      deleteScope: "check"
    });
    renderMyRecordsList();
    renderWonRecordsList();
    renderMineStats();
  }

  function getCheckVisibleRecords() {
    return state.records.filter(isRecordVisibleInCheck);
  }

  function isRecordVisibleInCheck(record) {
    if (!record) return false;
    if (record.status === "pending" || !record.status) return true;
    const latest = getLatestDraw(record.gameKey);
    if (!latest) return Date.now() - new Date(record.createdAt || 0).getTime() < 3 * 86400000;
    const targetExpect = String(record.targetExpect || record.expect || "");
    if (targetExpect && String(latest.expect || "") === targetExpect) return true;
    const targetTime = parseApiDate(record.targetOpenTime || record.openDate || record.targetOpenDate || "");
    const latestTime = parseApiDate(latest.openDate || latest.time || "");
    if (targetTime && latestTime) return latestTime <= targetTime;
    return formatDate(record.createdAt) === formatDate(new Date());
  }

  function renderMyRecordsList() {
    renderRecordFilters();
    const filteredRecords = state.recordFilterGame === "all"
      ? state.records
      : state.records.filter((record) => record.gameKey === state.recordFilterGame);
    if (els.mineRecordList) {
      renderRecordTimeline(els.mineRecordList, filteredRecords);
    }
    if (els.myRecordsSummary) {
      const label = state.recordFilterGame === "all" ? "全部彩种" : (GAME_CONFIGS[state.recordFilterGame]?.label || state.recordFilterGame);
      els.myRecordsSummary.textContent = `${label} · ${groupRecordsByBatch(filteredRecords).length} 次选号`;
    }
    if (els.recordFilterSummary) {
      const stats = summarizeRecords(filteredRecords);
      const batchCount = groupRecordsByBatch(filteredRecords).length;
      const label = state.recordFilterGame === "all" ? "全部彩种" : (GAME_CONFIGS[state.recordFilterGame]?.label || state.recordFilterGame);
      const prize = stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize);
      els.recordFilterSummary.textContent = `${label} · ${batchCount} 次选号 · ${filteredRecords.length} 注 · 花费 ${formatCompactMoney(stats.totalCost)} · 中奖 ${prize} · 中奖率 ${stats.winRate}%`;
    }
  }

  function renderRecordFilters() {
    if (!els.recordFilterChips) return;
    const options = [{ key: "all", label: "全部" }].concat(GAME_ORDER.map((key) => ({ key, label: GAME_CONFIGS[key]?.label || key })));
    els.recordFilterChips.innerHTML = options.map((option) => {
      const active = option.key === state.recordFilterGame;
      return `<button class="record-filter-btn${active ? " is-active" : ""}" type="button" data-record-filter="${option.key}" aria-pressed="${active}">${option.label}</button>`;
    }).join("");
    els.recordFilterChips.querySelectorAll("[data-record-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.recordFilterGame = btn.dataset.recordFilter || "all";
        renderMyRecordsList();
      });
    });
  }

  function renderRecordTimeline(container, records) {
    if (!records.length) {
      container.className = "record-list empty empty-cta";
      container.innerHTML = `
        <div>当前筛选下暂无选号记录</div>
        <button class="mini-blue has-icon" type="button" data-empty-go-random>
          <svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3l-8 8"/><path d="M3 21l8-8"/><path d="M16 21h5v-5"/><path d="M3 3l5 5"/></svg>
          <span>先去选几注</span>
        </button>
      `;
      container.querySelector("[data-empty-go-random]")?.addEventListener("click", () => switchView("random"));
      return;
    }
    const batches = groupRecordsByBatch(records);
    container.className = "record-list record-timeline";
    container.innerHTML = batches.map((batch, index) => {
      const gameKey = batch.records[0]?.gameKey || "unknown";
      return `<section class="record-timeline-item random-ticket-${gameKey}" style="--stagger-i:${index}">${renderRecordBatch(batch)}</section>`;
    }).join("");
    container.querySelectorAll("[data-delete-batch]").forEach((btn) => {
      btn.addEventListener("click", async () => deleteRecordsByBatch(btn.dataset.deleteBatch));
    });
  }

  function renderWonRecordsList() {
    const wonRecords = state.records.filter((record) => record.status === "won" || record.status === "prize_float");
    if (els.wonRecordList) {
      renderRecordGroups(els.wonRecordList, wonRecords, {
        emptyText: "暂无中奖记录",
        deleteScope: "won"
      });
    }
    if (els.wonRecordsSummary) {
      const total = wonRecords.reduce((sum, record) => sum + Number(record.prizeAmount || 0), 0);
      els.wonRecordsSummary.textContent = `共 ${wonRecords.length} 注 · 累计 ${formatCompactMoney(total)}`;
    }
  }

  function openMyRecordsView() {
    renderMyRecordsList();
    switchView("myRecords");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }

  function openWonRecordsView() {
    renderWonRecordsList();
    switchView("wins");
  }

  function renderRecordGroups(container, records, options = {}) {
    if (!container) return;
    if (!records.length) {
      /* B-C4: 空状态加"先去选几注"CTA */
      container.className = "record-list empty empty-cta";
      container.innerHTML = `
        <div>${options.emptyText || "暂无保存记录"}</div>
        <button class="mini-blue has-icon" type="button" data-empty-go-random>
          <svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3l-8 8"/><path d="M3 21l8-8"/><path d="M16 21h5v-5"/><path d="M3 3l5 5"/></svg>
          <span>先去选几注</span>
        </button>
      `;
      const goBtn = container.querySelector("[data-empty-go-random]");
      if (goBtn) goBtn.addEventListener("click", () => switchView("random"));
      return;
    }
    const groups = groupRecordsByGame(records);
    container.className = "record-list";
    container.innerHTML = groups.map(({ gameKey, gameRecords }, groupIdx) => {
      const config = GAME_CONFIGS[gameKey] || {};
      const stats = summarizeRecords(gameRecords);
      const batches = groupRecordsByBatch(gameRecords);
      const groupStatus = stats.pendingCount ? `${stats.pendingCount} 注待开奖` : stats.floatCount ? `${stats.floatCount} 注奖金待定` : "已开奖";
      const amountText = stats.totalPrize > 0 ? formatMoney(stats.totalPrize) : stats.floatCount ? "浮动待定" : formatMoney(0);
      const meta = `${batches.length} 次选号 · 花费 ${formatMoney(stats.totalCost)} · 中奖率 ${stats.winRate}% · ${groupStatus}`;
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
            ${batches.map((batch) => renderRecordBatch(batch)).join("")}
          </div>
        </section>
      `;
    }).join("");
    container.querySelectorAll("[data-delete-game]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await deleteRecordsByGame(btn.dataset.deleteGame, btn.dataset.deleteScope);
      });
    });
    container.querySelectorAll("[data-delete-batch]").forEach((btn) => {
      btn.addEventListener("click", async () => deleteRecordsByBatch(btn.dataset.deleteBatch));
    });
  }

  function renderRecordBatch(batch) {
    const records = batch.records;
    const stats = summarizeRecords(records);
    const latest = records[0] || {};
    const gameLabel = GAME_CONFIGS[latest.gameKey]?.label || latest.gameKey || "未知彩种";
    const modes = Array.from(new Set(records.map((record) => formatPlayMode(record.playMode)).filter(Boolean))).join("/");
    const issue = latest.targetExpect || latest.expect || "待定期号";
    const targetState = latest.targetStatus === "inferred"
      ? `<span class="record-target-state is-inferred">预计</span>`
      : latest.targetStatus === "review"
        ? `<span class="record-target-state is-review">需确认</span>`
        : "";
    return `
      <article class="record-batch-card">
        <div class="record-batch-head">
          <div>
            <div class="record-batch-title"><span class="record-batch-game">${gameLabel}</span>${formatDateTime(batch.createdAt)} · ${records.length} 注</div>
            <div class="record-batch-sub">第 ${issue} 期 ${targetState}${modes ? ` · ${modes}` : ""}${latest.source === "ocr" ? " · 扫描导入" : ""}</div>
          </div>
          <div class="record-batch-summary">
            <div>花费 ${formatMoney(stats.totalCost)}</div>
            <div>中奖 ${stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize)}</div>
          </div>
        </div>
        <div class="record-batch-tickets">${records.map((record) => renderRecordItem(record)).join("")}</div>
        <button class="delete-btn has-icon record-batch-delete" type="button" data-delete-batch="${batch.batchId}" aria-label="删除本次选号">${ICON.trash}<span>删除本次选号</span></button>
      </article>
    `;
  }

  function renderRecordItem(record) {
    const resolved = FINAL_RECORD_STATUSES.has(record.status) && record.matched;
    const cost = Number(record.price || 0) * Number(record.multiple || 1);
    const playText = formatPlayMode(record.playMode);
    /* 状态 chip 直接承载中奖金额：won → "中 X 元/万"；其他 → resultText */
    let chipText = record.resultText || "待核对";
    if (record.status === "won" && Number(record.prizeAmount) > 0) {
      chipText = `中 ${formatCompactMoney(record.prizeAmount)}`;
    }
    return `
      <article class="record-card random-ticket-${record.gameKey}">
        <div class="record-ticket-meta">
          <div class="record-ticket-line">
            <span>${playText || "选号"}</span>
            <span>成本 ${formatMoney(cost)}</span>
            <span>${record.multiple || 1}倍</span>
          </div>
          <span class="status-pill ${statusClass(record.status)}">${chipText}</span>
        </div>
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

  function groupRecordsByBatch(records) {
    const map = new Map();
    records.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).forEach((record) => {
      const key = record.batchId || record.id;
      if (!map.has(key)) map.set(key, { batchId: key, createdAt: record.createdAt, records: [] });
      map.get(key).records.push(record);
    });
    return Array.from(map.values());
  }

  function summarizeRecords(records) {
    const list = records || [];
    const totalCost = list.reduce((sum, record) => sum + Number(record.price || 0) * Number(record.multiple || 1), 0);
    const totalPrize = list.reduce((sum, record) => sum + Number(record.prizeAmount || 0), 0);
    const settled = list.filter((record) => FINAL_RECORD_STATUSES.has(record.status));
    const wonCount = list.filter((record) => record.status === "won" || record.status === "prize_float").length;
    const pendingCount = list.filter((record) => record.status === "pending" || !record.status).length;
    const floatCount = list.filter((record) => record.status === "prize_float").length;
    const winRate = settled.length ? Math.round((wonCount / settled.length) * 1000) / 10 : 0;
    return { totalCost, totalPrize, settledCount: settled.length, wonCount, pendingCount, floatCount, winRate };
  }

  async function deleteRecordsByGame(gameKey, scope = "all") {
    const targets = state.records.filter((record) => {
      if (record.gameKey !== gameKey) return false;
      if (scope === "check") return isRecordVisibleInCheck(record);
      if (scope === "won") return record.status === "won" || record.status === "prize_float";
      return true;
    });
    if (!targets.length) return;
    const label = GAME_CONFIGS[gameKey]?.label || gameKey;
    const scopeText = scope === "check" ? "当前显示的" : scope === "won" ? "中奖" : "全部";
    if (!window.confirm(`确定删除${label}${scopeText}选号记录吗？`)) return;
    for (const record of targets) await dbDelete(record.id);
    state.records = await dbGetAll();
    renderRecords();
    toast(`${label}记录已删除`);
  }

  async function deleteRecordsByBatch(batchId) {
    const targets = state.records.filter((record) => (record.batchId || record.id) === batchId);
    if (!targets.length || !window.confirm("确定删除这一次选号记录吗？")) return;
    for (const record of targets) await dbDelete(record.id);
    state.records = await dbGetAll();
    renderRecords();
    toast("本次选号记录已删除");
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

  function openGameStatsSheet() {
    if (!els.detailSheet || !els.detailSheetBody) return;
    const groups = groupRecordsByGame(state.records);
    els.detailSheetTitle.textContent = "各彩种统计";
    els.detailSheetSub.textContent = "按已保存的全部本地选号记录汇总";
    els.detailSheetBody.innerHTML = groups.length ? groups.map(({ gameKey, gameRecords }) => {
      const stats = summarizeRecords(gameRecords);
      const batchCount = groupRecordsByBatch(gameRecords).length;
      return `
        <article class="game-stat-detail">
          <div class="game-stat-detail-head">
            <div class="game-stat-detail-name">${GAME_CONFIGS[gameKey]?.label || gameKey}</div>
            <div class="game-stat-detail-count">${batchCount} 次选号 · ${gameRecords.length} 注</div>
          </div>
          <div class="game-stat-detail-grid">
            <div><span>累计花费</span><strong>${formatCompactMoney(stats.totalCost)}</strong></div>
            <div><span>累计中奖</span><strong>${stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize)}</strong></div>
            <div><span>中奖率</span><strong>${stats.winRate}%</strong></div>
          </div>
        </article>
      `;
    }).join("") : `<div class="empty-state">暂无选号记录</div>`;
    els.detailSheet.hidden = false;
    document.body.classList.add("sheet-open");
    window.setTimeout(() => els.detailSheetCloseBtn?.focus(), 20);
  }

  function closeDetailSheet() {
    if (!els.detailSheet) return;
    els.detailSheet.hidden = true;
    document.body.classList.remove("sheet-open");
  }

  /* ===== 本地 OCR 扫描彩票 ===== */

  function openTicketScan() {
    if (!els.ticketScan || !els.ticketScanBody) return;
    state.ticketScanResult = null;
    state.ticketScanPreview = "";
    state.ticketScanBusy = false;
    state.ticketScanAddDraft = null;
    els.ticketScan.hidden = false;
    document.body.classList.add("scan-open");
    renderTicketScanIntro();
    window.setTimeout(() => els.ticketScanBody.querySelector("[data-scan-choose]")?.focus(), 20);
  }

  function closeTicketScan() {
    if (!els.ticketScan || state.ticketScanBusy) return;
    els.ticketScan.hidden = true;
    document.body.classList.remove("scan-open");
    state.ticketScanResult = null;
    state.ticketScanPreview = "";
    state.ticketScanAddDraft = null;
    if (els.ticketScanInput) els.ticketScanInput.value = "";
  }

  function renderTicketScanIntro(errorText = "") {
    if (!els.ticketScanBody) return;
    els.ticketScanTitle.textContent = "扫描彩票";
    els.ticketScanSub.textContent = "图片只在本机识别，不会上传或保存";
    els.ticketScanBody.innerHTML = `
      <div class="scan-intro">
        <div class="scan-illustration" aria-hidden="true">
          <svg viewBox="0 0 64 64"><path d="M18 8h28a4 4 0 0 1 4 4v40a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z"/><path d="M22 21h20M22 29h20M22 37h8M35 37h7"/><path d="M8 22V12a4 4 0 0 1 4-4h6M56 22V12a4 4 0 0 0-4-4h-6M8 42v10a4 4 0 0 0 4 4h6M56 42v10a4 4 0 0 1-4 4h-6"/></svg>
        </div>
        <div class="scan-intro-title">拍摄完整、清晰的彩票正面</div>
        <div class="scan-intro-copy">当前支持双色球、大乐透普通单式票；可识别期号、开奖日期、号码、倍数、追加和金额。</div>
        ${errorText ? `<div class="scan-error">${escapeScanText(errorText)}</div>` : ""}
        <button class="scan-primary-btn" type="button" data-scan-choose>拍照或选择图片</button>
        <div class="scan-privacy">本地 OCR · 原图识别结束后立即释放</div>
      </div>
    `;
    els.ticketScanBody.querySelector("[data-scan-choose]")?.addEventListener("click", () => els.ticketScanInput?.click());
  }

  async function handleTicketScanFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      renderTicketScanIntro("请选择 JPG、PNG 或 HEIC 图片");
      return;
    }
    if (!window.LotteryOCR) {
      renderTicketScanIntro("OCR 模块没有正确加载，请刷新页面后重试");
      return;
    }
    state.ticketScanBusy = true;
    els.ticketScanCloseBtn.disabled = true;
    renderTicketScanProgress(0.02, "正在读取彩票图片");
    try {
      const { parsed, previewUrl } = await window.LotteryOCR.recognizeFile(file, ({ progress, label }) => {
        renderTicketScanProgress(progress, label);
      });
      state.ticketScanResult = parsed;
      state.ticketScanPreview = previewUrl || "";
      state.ticketScanAddDraft = null;
      renderTicketScanProgress(0.98, "正在核对开奖期号");
      await loadGameHistory(parsed.gameKey, false);
      renderTicketScanReview();
    } catch (error) {
      renderTicketScanIntro(`识别失败：${error?.message || "请检查网络后重试"}`);
    } finally {
      state.ticketScanBusy = false;
      els.ticketScanCloseBtn.disabled = false;
      els.ticketScanInput.value = "";
    }
  }

  function renderTicketScanProgress(progress = 0, label = "正在本地识别") {
    if (!els.ticketScanBody) return;
    const value = Math.max(2, Math.min(100, Math.round((Number(progress) || 0) * 100)));
    els.ticketScanTitle.textContent = "正在识别彩票";
    els.ticketScanSub.textContent = "首次使用需要下载识别模型，之后会自动缓存";
    els.ticketScanBody.innerHTML = `
      <div class="scan-progress-state">
        <div class="scan-progress-ring" style="--scan-progress:${value * 3.6}deg"><span>${value}%</span></div>
        <div class="scan-progress-label">${escapeScanText(label)}</div>
        <div class="scan-progress-copy">请保持页面打开，图片始终只在当前设备处理</div>
      </div>
    `;
  }

  function renderTicketScanReview() {
    if (!els.ticketScanBody || !state.ticketScanResult) return;
    const result = state.ticketScanResult;
    const gameLabel = result.gameKey === "dlt" ? "大乐透" : "双色球";
    const drawCheck = getScanDrawCheck(result);
    const statusTone = result.errors.length || drawCheck?.status === "error" ? "error" : result.warnings.length ? "warning" : "ok";
    const statusText = result.errors.length ? `${result.errors.length}项需要修改` : drawCheck?.status === "error" ? "开奖日期需要修改" : result.warnings.length ? `${result.warnings.length}项请确认` : "规则校验通过";
    els.ticketScanTitle.textContent = "确认识别结果";
    els.ticketScanSub.textContent = `本地识别可信度 ${result.confidence || 0}% · 请核对后导入`;
    els.ticketScanBody.innerHTML = `
      <form class="scan-review" id="ticketScanForm">
        <div class="scan-review-top${state.ticketScanPreview ? "" : " no-preview"}">
          <div class="scan-preview-column">
            ${state.ticketScanPreview ? `
              <button class="scan-preview-zoom" type="button" data-scan-preview-zoom aria-label="放大彩票图片">
                <img src="${state.ticketScanPreview}" alt="裁剪后的彩票预览">
                <span>点击图片放大核对</span>
              </button>
            ` : ""}
            <div class="scan-review-summary"><strong>${gameLabel}</strong><span class="scan-validation is-${statusTone}">${statusText}</span></div>
          </div>
          <div class="scan-meta-grid">
            <label><span>彩种</span><select name="gameKey"><option value="ssq"${result.gameKey === "ssq" ? " selected" : ""}>双色球</option><option value="dlt"${result.gameKey === "dlt" ? " selected" : ""}>大乐透</option></select></label>
            <label><span>期号</span><input name="issue" inputmode="numeric" value="${escapeScanText(result.issue)}" placeholder="请输入期号"></label>
            <label><span>开奖日期</span><input name="drawDate" type="date" value="${escapeScanText(result.drawDate)}"></label>
            <label><span>购买时间</span><input name="saleDateTime" type="datetime-local" step="1" value="${escapeScanText(result.saleDateTime)}"></label>
            ${result.gameKey === "dlt" ? `<label><span>投注方式</span><select name="addOn"><option value=""${result.addOn === null ? " selected" : ""}>请选择</option><option value="false"${result.addOn === false ? " selected" : ""}>普通投注</option><option value="true"${result.addOn === true ? " selected" : ""}>追加投注</option></select></label>` : ""}
            <label><span>倍数</span><input name="multiple" type="number" inputmode="numeric" min="1" max="99" value="${result.multiple || 1}"></label>
            <label><span>票面金额</span><div class="scan-money-input"><input name="totalAmount" type="number" inputmode="decimal" min="0" value="${result.totalAmount || ""}"><em>元</em></div></label>
          </div>
        </div>
        <div class="scan-ticket-list">
          ${result.tickets.map((ticket, index) => renderScanTicketEditor(result.gameKey, ticket, index, result.tickets.length)).join("")}
        </div>
        <button class="scan-add-ticket" type="button" data-scan-add>＋ 新增一注</button>
        ${state.ticketScanAddDraft ? renderScanBallPicker(result.gameKey, state.ticketScanAddDraft) : ""}
        ${renderScanValidationMessages(result)}
        <div class="scan-cost-check"><span>${result.tickets.length}注 · 按号码计算</span><strong>${formatMoney(result.calculatedAmount)}</strong></div>
        <div class="scan-review-actions">
          <button class="scan-secondary-btn" type="button" data-scan-again>重新选择</button>
          <button class="scan-primary-btn" type="submit"${canImportScanResult(result) ? "" : " disabled"}>确认导入 ${result.tickets.length} 注</button>
        </div>
      </form>
    `;
    bindTicketScanReview();
  }

  function renderScanTicketEditor(gameKey, ticket, index, count) {
    const main = gameKey === "dlt" ? ticket.front || [] : ticket.red || [];
    const extra = gameKey === "dlt" ? ticket.back || [] : ticket.blue || [];
    const mainMax = gameKey === "dlt" ? 35 : 33;
    const extraMax = gameKey === "dlt" ? 12 : 16;
    return `
      <article class="scan-ticket-editor" data-scan-ticket="${index}">
        <div class="scan-ticket-editor-head"><strong>第 ${index + 1} 注</strong>${count > 1 ? `<button type="button" data-scan-delete="${index}">删除</button>` : ""}</div>
        <div class="scan-number-row">
          <div class="scan-number-group">${main.map((value, numberIndex) => scanNumberInput("main", index, numberIndex, value, mainMax, gameKey === "dlt" ? "blue" : "red")).join("")}</div>
          <span class="scan-number-plus">＋</span>
          <div class="scan-number-group">${extra.map((value, numberIndex) => scanNumberInput("extra", index, numberIndex, value, extraMax, gameKey === "dlt" ? "yellow" : "blue")).join("")}</div>
        </div>
      </article>
    `;
  }

  function scanNumberInput(zone, ticketIndex, numberIndex, value, max, tone) {
    return `<input class="scan-number-input is-${tone}" data-scan-zone="${zone}" data-ticket-index="${ticketIndex}" data-number-index="${numberIndex}" type="number" inputmode="numeric" min="1" max="${max}" value="${String(Number(value) || "").padStart(2, "0")}" aria-label="第${ticketIndex + 1}注第${numberIndex + 1}个号码">`;
  }

  function getScanBallConfig(gameKey) {
    return gameKey === "dlt"
      ? { mainMax: 35, mainCount: 5, mainLabel: "前区", mainTone: "blue", extraMax: 12, extraCount: 2, extraLabel: "后区", extraTone: "yellow" }
      : { mainMax: 33, mainCount: 6, mainLabel: "红球", mainTone: "red", extraMax: 16, extraCount: 1, extraLabel: "蓝球", extraTone: "blue" };
  }

  function renderScanBallPicker(gameKey, draft) {
    const config = getScanBallConfig(gameKey);
    const group = (zone, max, selected, tone) => Array.from({ length: max }, (_, index) => {
      const number = index + 1;
      const active = selected.includes(number);
      return `<button class="scan-pick-ball is-${tone}${active ? " is-selected" : ""}" type="button" data-scan-pick-zone="${zone}" data-scan-pick-number="${number}" aria-pressed="${active}">${pad(number)}</button>`;
    }).join("");
    const ready = draft.main.length === config.mainCount && draft.extra.length === config.extraCount;
    return `
      <section class="scan-ball-picker" aria-label="手动新增一注">
        <div class="scan-ball-picker-head"><strong>手动新增一注</strong><span>已选 ${draft.main.length + draft.extra.length}/${config.mainCount + config.extraCount}</span></div>
        <div class="scan-pick-section"><div><strong>${config.mainLabel}</strong><span>选择 ${config.mainCount} 个</span></div><div class="scan-pick-grid">${group("main", config.mainMax, draft.main, config.mainTone)}</div></div>
        <div class="scan-pick-section"><div><strong>${config.extraLabel}</strong><span>选择 ${config.extraCount} 个</span></div><div class="scan-pick-grid">${group("extra", config.extraMax, draft.extra, config.extraTone)}</div></div>
        <div class="scan-ball-picker-actions"><button type="button" data-scan-pick-cancel>取消</button><button class="is-confirm" type="button" data-scan-pick-confirm${ready ? "" : " disabled"}>确定新增</button></div>
      </section>
    `;
  }

  function renderScanValidationMessages(result) {
    const messages = result.errors.map((text) => `<li class="is-error">${escapeScanText(text)}</li>`)
      .concat(result.warnings.map((text) => `<li class="is-warning">${escapeScanText(text)}</li>`));
    const drawCheck = getScanDrawCheck(result);
    if (drawCheck) messages.push(`<li class="${drawCheck.status === "error" ? "is-error" : "is-ok"}">${escapeScanText(drawCheck.text)}</li>`);
    return messages.length ? `<ul class="scan-validation-list">${messages.join("")}</ul>` : `<div class="scan-validation-ok">号码、倍数和金额校验通过</div>`;
  }

  function getScanDrawCheck(result) {
    if (!result?.issue || !result?.gameKey) return null;
    const draw = state.draws.find((item) => item.gameKey === result.gameKey && String(item.expect) === String(result.issue));
    if (!draw) return null;
    const repositoryDate = normalizeDate(draw.openDate || draw.time || "");
    if (result.drawDate && repositoryDate && result.drawDate !== repositoryDate) {
      return { status: "error", text: `开奖仓库显示第${result.issue}期日期为${repositoryDate}` };
    }
    return { status: "ok", text: `已匹配开奖仓库第${result.issue}期` };
  }

  function bindTicketScanReview() {
    const form = els.ticketScanBody.querySelector("#ticketScanForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.ticketScanResult = readTicketScanForm(form);
      if (!canImportScanResult(state.ticketScanResult)) {
        renderTicketScanReview();
        return;
      }
      await importScannedTicket(state.ticketScanResult);
    });
    form.addEventListener("change", (event) => {
      const changedGame = event.target.name === "gameKey";
      state.ticketScanResult = readTicketScanForm(form, changedGame);
      if (changedGame) state.ticketScanAddDraft = null;
      renderTicketScanReview();
    });
    form.querySelector("[data-scan-preview-zoom]")?.addEventListener("click", (event) => {
      event.currentTarget.classList.toggle("is-expanded");
    });
    form.querySelector("[data-scan-again]")?.addEventListener("click", () => els.ticketScanInput?.click());
    form.querySelector("[data-scan-add]")?.addEventListener("click", () => {
      state.ticketScanResult = readTicketScanForm(form);
      state.ticketScanAddDraft = { gameKey: state.ticketScanResult.gameKey, main: [], extra: [] };
      renderTicketScanReview();
    });
    form.querySelectorAll("[data-scan-pick-zone]").forEach((btn) => btn.addEventListener("click", () => {
      state.ticketScanResult = readTicketScanForm(form);
      const config = getScanBallConfig(state.ticketScanResult.gameKey);
      const zone = btn.dataset.scanPickZone === "extra" ? "extra" : "main";
      const maxCount = zone === "main" ? config.mainCount : config.extraCount;
      const number = Number(btn.dataset.scanPickNumber);
      const draft = state.ticketScanAddDraft || { gameKey: state.ticketScanResult.gameKey, main: [], extra: [] };
      const values = draft[zone].slice();
      const existing = values.indexOf(number);
      if (existing >= 0) values.splice(existing, 1);
      else if (maxCount === 1) values.splice(0, values.length, number);
      else if (values.length < maxCount) values.push(number);
      else toast(`最多选择 ${maxCount} 个号码`);
      draft[zone] = values.sort((a, b) => a - b);
      state.ticketScanAddDraft = draft;
      renderTicketScanReview();
    }));
    form.querySelector("[data-scan-pick-cancel]")?.addEventListener("click", () => {
      state.ticketScanResult = readTicketScanForm(form);
      state.ticketScanAddDraft = null;
      renderTicketScanReview();
    });
    form.querySelector("[data-scan-pick-confirm]")?.addEventListener("click", () => {
      const result = readTicketScanForm(form);
      const config = getScanBallConfig(result.gameKey);
      const draft = state.ticketScanAddDraft;
      if (!draft || draft.main.length !== config.mainCount || draft.extra.length !== config.extraCount) return;
      result.tickets.push(result.gameKey === "dlt"
        ? { front: draft.main.slice(), back: draft.extra.slice(), multiple: result.multiple }
        : { red: draft.main.slice(), blue: draft.extra.slice(), multiple: result.multiple });
      state.ticketScanResult = window.LotteryOCR.validateTicketResult(result);
      state.ticketScanAddDraft = null;
      renderTicketScanReview();
    });
    form.querySelectorAll("[data-scan-delete]").forEach((btn) => btn.addEventListener("click", () => {
      const result = readTicketScanForm(form);
      result.tickets.splice(Number(btn.dataset.scanDelete), 1);
      state.ticketScanResult = window.LotteryOCR.validateTicketResult(result);
      renderTicketScanReview();
    }));
  }

  function readTicketScanForm(form, resetTickets = false) {
    const data = new FormData(form);
    const gameKey = data.get("gameKey") === "dlt" ? "dlt" : "ssq";
    const multiple = clampInt(data.get("multiple"), 1, 99);
    let tickets;
    if (resetTickets || gameKey !== state.ticketScanResult?.gameKey) {
      tickets = [gameKey === "dlt"
        ? { front: [1, 2, 3, 4, 5], back: [1, 2], multiple }
        : { red: [1, 2, 3, 4, 5, 6], blue: [1], multiple }];
    } else {
      const ticketCount = form.querySelectorAll("[data-scan-ticket]").length;
      tickets = Array.from({ length: ticketCount }, (_, ticketIndex) => {
        const values = (zone) => Array.from(form.querySelectorAll(`[data-ticket-index="${ticketIndex}"][data-scan-zone="${zone}"]`), (input) => Number(input.value));
        return gameKey === "dlt"
          ? { front: values("main"), back: values("extra"), multiple }
          : { red: values("main"), blue: values("extra"), multiple };
      });
    }
    const addOnValue = data.get("addOn");
    return window.LotteryOCR.validateTicketResult({
      ...state.ticketScanResult,
      gameKey,
      issue: String(data.get("issue") || "").trim(),
      drawDate: String(data.get("drawDate") || ""),
      saleDateTime: String(data.get("saleDateTime") || ""),
      totalAmount: Number(data.get("totalAmount")) || null,
      addOn: gameKey === "dlt" ? addOnValue === "true" ? true : addOnValue === "false" ? false : null : false,
      multiple,
      tickets,
      errors: [],
      warnings: []
    });
  }

  function canImportScanResult(result) {
    const drawCheck = getScanDrawCheck(result);
    return Boolean(result && !result.errors.length && drawCheck?.status !== "error" && result.tickets.length && result.issue && result.drawDate && (result.gameKey !== "dlt" || result.addOn !== null));
  }

  async function importScannedTicket(result) {
    const now = new Date().toISOString();
    const createdAt = parseScanLocalDateTime(result.saleDateTime) || now;
    const batchId = `ocr_${compactDate(now)}_${randomId()}`;
    const price = result.gameKey === "dlt" && result.addOn ? 3 : 2;
    const records = result.tickets.map((ticket, index) => {
      const numbers = result.gameKey === "dlt"
        ? { front: ticket.front, back: ticket.back, addOn: Boolean(result.addOn), playMode: result.addOn ? "add" : "normal" }
        : { red: ticket.red, blue: ticket.blue };
      return {
        id: `${batchId}_${String(index + 1).padStart(3, "0")}`,
        batchId,
        gameKey: result.gameKey,
        gameName: GAME_CONFIGS[result.gameKey].label,
        playMode: result.gameKey === "dlt" ? result.addOn ? "add" : "normal" : "单式",
        addOn: result.gameKey === "dlt" ? Boolean(result.addOn) : false,
        expect: result.issue,
        openDate: result.drawDate,
        targetExpect: result.issue,
        targetOpenDate: result.drawDate,
        numbers,
        price,
        multiple: Number(ticket.multiple || result.multiple || 1),
        status: "pending",
        resultText: "待核对",
        prizeAmount: 0,
        source: "ocr",
        ocrConfidence: result.confidence || 0,
        scannedTicketAmount: result.totalAmount,
        createdAt,
        updatedAt: now
      };
    });
    for (const record of records) await dbPut(record);
    state.records = await dbGetAll();
    state.ticketScanBusy = false;
    closeTicketScan();
    await ensurePendingRecordDraws();
    await checkAllRecords(false);
    toast(`已从彩票导入 ${records.length} 注`);
  }

  function parseScanLocalDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function escapeScanText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ===== 连续累计盈亏折线 ===== */

  function renderProfitChart() {
    if (!els.profitChartWrap) return;
    const series = buildDailyProfitSeries(state.records, state.profitRange);
    if (els.profitNetValue) {
      const net = series.closingBalance;
      const cls = net > 0 ? "is-positive" : net < 0 ? "is-negative" : "";
      els.profitNetValue.className = `profit-net-value ${cls}`;
      els.profitNetValue.textContent = `${net > 0 ? "+" : ""}${formatCompactMoney(net)}`;
    }
    if (els.profitSub) {
      els.profitSub.textContent = series.days.length
        ? `${series.rangeLabel} · 累计走势`
        : "尚无完整数据";
    }
    if (!series.days.length) {
      els.profitChartWrap.innerHTML = `
        <div class="profit-empty empty-cta" id="profitEmpty">
          <div>暂无数据，先去选号吧</div>
          <button class="mini-blue has-icon" type="button" data-empty-go-random>
            <svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3l-8 8"/><path d="M3 21l8-8"/><path d="M16 21h5v-5"/><path d="M3 3l5 5"/></svg>
            <span>去选号</span>
          </button>
        </div>
      `;
      const goBtn = els.profitChartWrap.querySelector("[data-empty-go-random]");
      if (goBtn) goBtn.addEventListener("click", () => switchView("random"));
      return;
    }
    els.profitChartWrap.innerHTML = buildProfitChartSvg(series);
    bindProfitChartInteractions(series);
  }

  function buildDailyProfitSeries(records, range = "all") {
    const settled = (records || [])
      .filter((r) => r && (r.status === "won" || r.status === "lost") && r.createdAt)
      .slice()
      .sort((a, b) => {
        const dateCompare = getRecordProfitDate(a).localeCompare(getRecordProfitDate(b));
        return dateCompare || String(a.createdAt).localeCompare(String(b.createdAt));
      });

    const dayMap = new Map();
    settled.forEach((record) => {
      const date = getRecordProfitDate(record);
      if (!dayMap.has(date)) dayMap.set(date, []);
      dayMap.get(date).push(record);
    });
    const availableDates = Array.from(dayMap.keys()).sort();
    if (!availableDates.length) {
      return { days: [], costTotal: 0, prizeTotal: 0, netTotal: 0, openingBalance: 0, closingBalance: 0, rangeLabel: range === "all" ? "全部" : `最近${range}天` };
    }

    const endDate = availableDates[availableDates.length - 1];
    let startDate = availableDates[0];
    if (range !== "all") {
      const date = new Date(`${endDate}T12:00:00`);
      date.setDate(date.getDate() - Math.max(0, Number(range) - 1));
      startDate = formatDate(date);
    }
    const openingBalance = settled.reduce((sum, record) => {
      if (getRecordProfitDate(record) >= startDate) return sum;
      return sum + Number(record.prizeAmount || 0) - Number(record.price || 0) * Number(record.multiple || 1);
    }, 0);

    const dates = [];
    for (let cursor = new Date(`${startDate}T12:00:00`), end = new Date(`${endDate}T12:00:00`); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      dates.push(formatDate(cursor));
    }

    let balance = openingBalance;
    const days = dates.map((date) => {
      const dayRecords = dayMap.get(date) || [];
      const open = balance;
      let high = open;
      let low = open;
      let cost = 0;
      let prize = 0;
      const games = new Map();
      dayRecords.forEach((record) => {
        const itemCost = Number(record.price || 0) * Number(record.multiple || 1);
        const itemPrize = Number(record.prizeAmount || 0);
        cost += itemCost;
        prize += itemPrize;
        balance += itemPrize - itemCost;
        high = Math.max(high, balance);
        low = Math.min(low, balance);
        const gameKey = record.gameKey || "unknown";
        if (!games.has(gameKey)) games.set(gameKey, { cost: 0, prize: 0, count: 0 });
        const game = games.get(gameKey);
        game.cost += itemCost;
        game.prize += itemPrize;
        game.count += 1;
      });
      const settledCount = dayRecords.length;
      const wonCount = dayRecords.filter((record) => record.status === "won").length;
      return {
        date,
        t: new Date(`${date}T12:00:00`).getTime(),
        open,
        close: balance,
        high,
        low,
        cost,
        prize,
        net: prize - cost,
        count: dayRecords.length,
        wonCount,
        winRate: settledCount ? Math.round((wonCount / settledCount) * 1000) / 10 : 0,
        games: Array.from(games.entries()).map(([gameKey, item]) => ({ gameKey, ...item }))
      };
    });
    const costTotal = days.reduce((sum, day) => sum + day.cost, 0);
    const prizeTotal = days.reduce((sum, day) => sum + day.prize, 0);
    return {
      days,
      costTotal,
      prizeTotal,
      netTotal: prizeTotal - costTotal,
      openingBalance,
      closingBalance: balance,
      rangeLabel: range === "all" ? "全部记录" : `最近${range}天`
    };
  }

  function getRecordProfitDate(record) {
    const value = record.targetOpenDate || record.openDate || record.createdAt;
    const normalized = normalizeDate(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : formatDate(value);
  }

  function buildProfitChartSvg(series) {
    const W = 320, H = 168;
    const padL = 36, padR = 10, padT = 12, padB = 22;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const days = series.days;
    const allVals = days.map((day) => day.close);
    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const rawRange = (rawMax - rawMin) || Math.max(10, Math.abs(rawMax) * 0.12);
    const yMin = rawMin - rawRange * 0.08;
    const yMax = rawMax + rawRange * 0.08;
    const yRange = yMax - yMin;
    const yOf = (v) => padT + (1 - (v - yMin) / yRange) * innerH;
    const xOf = (index) => days.length === 1
      ? padL + innerW / 2
      : padL + (innerW * index) / (days.length - 1);

    const gridYs = [0.0, 0.5, 1.0].map((p) => padT + p * innerH);
    const grid = gridYs.map((y) => `<line class="profit-grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${y.toFixed(1)}"/>`).join("");
    const zeroLine = yMin <= 0 && yMax >= 0
      ? `<line class="profit-zero-line" x1="${padL}" y1="${yOf(0).toFixed(1)}" x2="${W - padR}" y2="${yOf(0).toFixed(1)}"/>`
      : "";

    const yLabels = [yMax, yMin + yRange / 2, yMin].map((v, i) => {
      const y = padT + (i * innerH) / 2;
      return `<text class="profit-axis-label" x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${formatChartTick(v)}</text>`;
    }).join("");

    const xLabels = (() => {
      const fmt = (value) => {
        const d = new Date(value);
        return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      };
      const labels = [fmt(days[0].t)];
      if (days.length > 1) labels.push(fmt(days[days.length - 1].t));
      return [
        `<text class="profit-axis-label" x="${padL}" y="${(H - 6).toFixed(1)}" text-anchor="start">${labels[0]}</text>`,
        labels[1] ? `<text class="profit-axis-label" x="${(W - padR).toFixed(1)}" y="${(H - 6).toFixed(1)}" text-anchor="end">${labels[1]}</text>` : ""
      ].join("");
    })();

    const RED = "#ef4444", GREEN = "#10b981";
    const directions = days.slice(1).map((day, index) => Math.sign(day.close - days[index].close));
    const segmentColors = directions.map((direction, index) => {
      if (direction > 0) return GREEN;
      if (direction < 0) return RED;
      for (let i = index - 1; i >= 0; i -= 1) {
        if (directions[i] !== 0) return directions[i] > 0 ? GREEN : RED;
      }
      for (let i = index + 1; i < directions.length; i += 1) {
        if (directions[i] !== 0) return directions[i] > 0 ? GREEN : RED;
      }
      return RED;
    });
    const gradients = segmentColors.map((color, index) => {
      const previousColor = index ? segmentColors[index - 1] : color;
      if (previousColor === color) return "";
      return `<linearGradient id="profit-gradient-${index}" gradientUnits="userSpaceOnUse" x1="${xOf(index).toFixed(1)}" y1="${yOf(days[index].close).toFixed(1)}" x2="${xOf(index + 1).toFixed(1)}" y2="${yOf(days[index + 1].close).toFixed(1)}"><stop offset="0%" stop-color="${previousColor}"/><stop offset="45%" stop-color="${color}"/><stop offset="100%" stop-color="${color}"/></linearGradient>`;
    }).join("");
    const lineSegments = days.slice(1).map((day, index) => {
      const color = segmentColors[index];
      const previousColor = index ? segmentColors[index - 1] : color;
      const stroke = previousColor === color ? color : `url(#profit-gradient-${index})`;
      return `<line class="profit-line-segment" x1="${xOf(index).toFixed(1)}" y1="${yOf(days[index].close).toFixed(1)}" x2="${xOf(index + 1).toFixed(1)}" y2="${yOf(day.close).toFixed(1)}" stroke="${stroke}"/>`;
    }).join("");

    const points = days.map((day, index) => {
      const x = xOf(index);
      const left = index === 0 ? padL : (xOf(index - 1) + x) / 2;
      const right = index === days.length - 1 ? W - padR : (x + xOf(index + 1)) / 2;
      const markerColor = index && segmentColors[index - 1] ? segmentColors[index - 1] : RED;
      return `
        <g class="profit-point" data-profit-point="${index}">
          <circle class="profit-point-marker" cx="${x.toFixed(1)}" cy="${yOf(day.close).toFixed(1)}" r="4" stroke="${markerColor}"/>
          <rect class="profit-point-hit" data-profit-point-index="${index}" x="${left.toFixed(1)}" y="${padT}" width="${Math.max(1, right - left).toFixed(1)}" height="${innerH}" tabindex="0" role="button" aria-label="${day.date}，花费${formatMoney(day.cost)}，中奖${formatMoney(day.prize)}，当日盈亏${formatMoney(day.net)}，累计盈亏${formatMoney(day.close)}"/>
        </g>
      `;
    }).join("");
    const singlePoint = days.length === 1
      ? `<circle class="profit-single-point" cx="${xOf(0).toFixed(1)}" cy="${yOf(days[0].close).toFixed(1)}" r="2.5"/>`
      : "";

    return `
      <svg class="profit-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="累计盈亏折线图">
        <defs>${gradients}</defs>
        ${grid}
        ${zeroLine}
        ${lineSegments}
        ${singlePoint}
        ${points}
        ${yLabels}
        ${xLabels}
      </svg>
    `;
  }

  function bindProfitChartInteractions(series) {
    const wrap = els.profitChartWrap;
    if (!wrap) return;
    let pressTimer = 0;
    let hideTimer = 0;
    const show = (index, clientX) => {
      const day = series.days[index];
      if (!day) return;
      wrap.querySelectorAll(".profit-point").forEach((item) => item.classList.toggle("is-active", item.dataset.profitPoint === String(index)));
      let tooltip = wrap.querySelector(".profit-tooltip");
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.className = "profit-tooltip";
        wrap.appendChild(tooltip);
      }
      tooltip.innerHTML = `
        <div class="profit-tooltip-date">${day.date}</div>
        <div class="profit-tooltip-grid">
          <span>当日花费</span><span>${formatMoney(day.cost)}</span>
          <span>当日中奖</span><span>${formatMoney(day.prize)}</span>
          <span>当日盈亏</span><span>${day.net > 0 ? "+" : ""}${formatMoney(day.net)}</span>
          <span>累计盈亏</span><span>${day.close > 0 ? "+" : ""}${formatMoney(day.close)}</span>
        </div>
        ${day.games.length ? `<div class="profit-tooltip-games">彩种：${day.games.map((game) => GAME_CONFIGS[game.gameKey]?.label || game.gameKey).join("、")}</div>` : ""}
      `;
      const rect = wrap.getBoundingClientRect();
      const fallbackX = rect.left + ((index + 0.5) / series.days.length) * rect.width;
      const x = Number.isFinite(clientX) ? clientX : fallbackX;
      const width = tooltip.offsetWidth || 160;
      tooltip.style.left = `${Math.max(6, Math.min(rect.width - width - 6, x - rect.left - width / 2))}px`;
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        tooltip.remove();
        wrap.querySelectorAll(".profit-point").forEach((item) => item.classList.remove("is-active"));
      }, 5000);
    };
    wrap.querySelectorAll("[data-profit-point-index]").forEach((hit) => {
      const index = Number(hit.dataset.profitPointIndex);
      hit.addEventListener("pointerdown", (event) => {
        window.clearTimeout(pressTimer);
        pressTimer = window.setTimeout(() => show(index, event.clientX), 380);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach((name) => hit.addEventListener(name, () => window.clearTimeout(pressTimer)));
      hit.addEventListener("click", (event) => show(index, event.clientX));
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); show(index); }
      });
    });
  }

  function formatChartTick(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `${Math.round(n)}`;
  }

  function getMineStats() {
    const settledRecords = state.records.filter((record) => record.status === "won" || record.status === "lost" || record.status === "prize_float");
    return { totalRecords: state.records.length, settledRecords, ...summarizeRecords(state.records) };
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

  function getNextDrawMetadata(gameKey) {
    const latest = getLatestDraw(gameKey);
    if (!latest) {
      return null;
    }
    return {
      latest,
      expect: String(latest.nextExpect || ""),
      openDate: String(latest.nextOpenDate || normalizeDate(latest.nextOpenTime) || ""),
      openTime: String(latest.nextOpenTime || ""),
      buyEndTime: String(latest.nextBuyEndTime || ""),
      status: String(latest.nextStatus || "confirmed"),
      source: String(latest.nextSource || "class_api"),
      confirmed: latest.nextConfirmed !== false,
      basisIssue: String(latest.nextBasisIssue || latest.expect || ""),
      resolutionReason: String(latest.nextResolutionReason || ""),
      sourceDrawId: latest.id || ""
    };
  }

  function getNextDrawTarget(gameKey) {
    const metadata = getNextDrawMetadata(gameKey);
    if (!metadata) {
      return { available: false, status: "unavailable", message: "暂无下期开奖数据，请稍后刷新" };
    }
    const { expect, openTime, buyEndTime } = metadata;
    if (!expect || !openTime || !buyEndTime) {
      return { ...metadata, available: false, message: "下期信息不完整，请稍后刷新" };
    }

    const now = new Date();
    const openDateValue = parseApiDate(openTime);
    const buyEndDateValue = parseApiDate(buyEndTime);
    if (!openDateValue || !buyEndDateValue) {
      return { ...metadata, available: false, message: "下期时间格式异常，请稍后刷新" };
    }
    if (now >= openDateValue) {
      return { ...metadata, available: false, message: "开奖数据待更新，请稍后刷新" };
    }
    if (now >= buyEndDateValue) {
      return { ...metadata, available: false, message: "本期已截止，请等待下一期数据更新" };
    }

    return {
      ...metadata,
      available: true,
      message: ""
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
    if (gameKey === "qxc") return Array.from({ length: count }, () => ({ nums6: pickDigits(6), tail: randomInt(0, 14) }));
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
    if (gameKey === "ssq") result = evaluateSSQ(ticket, draw, drawMeta);
    if (gameKey === "dlt") result = evaluateDLT(ticket, draw);
    if (gameKey === "k8") result = evaluateK8(ticket, draw, drawMeta);
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
    /* 福运奖只在当期开奖数据明确包含该奖项时启用。3+1 已命中更高的五等奖。 */
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

  function resolveFloatingPrizeAmount(draw, prizeName, gameKey, record) {
    if (!draw || !Array.isArray(draw.prizeList)) return 0;
    const base = findPrizeAmount(draw.prizeList, prizeName, gameKey, record);
    if (gameKey !== "dlt" || !isDltAddOn(record) || !["一等奖", "二等奖"].includes(prizeName)) return base;
    const addOn = findPrizeAmount(draw.prizeList, `${prizeName}追加`, gameKey, record)
      || findPrizeAmount(draw.prizeList, `追加${prizeName}`, gameKey, record)
      || findDltInlineAddOnPrizeAmount(draw.prizeList, prizeName)
      || findDltAddOnPrizeAmount(draw.prizeList, prizeName);
    /* 不在前端推算“80%”；当期追加奖金缺失时保留为金额待定。 */
    return addOn > 0 ? base + addOn : 0;
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

  function canonicalPrizeName(value) {
    return String(value || "")
      .replace(/组选[3三]奖?/g, "组三")
      .replace(/组选[6六]奖?/g, "组六")
      .replace(/直选奖/g, "直选")
      .replace(/\s+/g, "");
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

  function toast(message, options) {
    const hasAction = options && options.label && typeof options.onClick === "function";
    if (hasAction) {
      els.toast.innerHTML = `<span class="toast-msg"></span><button class="toast-action" type="button"></button>`;
      els.toast.querySelector(".toast-msg").textContent = message;
      const btn = els.toast.querySelector(".toast-action");
      btn.textContent = options.label;
      btn.addEventListener("click", () => {
        try { options.onClick(); } finally { els.toast.classList.remove("show"); }
      });
    } else {
      els.toast.textContent = message;
    }
    els.toast.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), hasAction ? 4200 : 2200);
  }
})();
