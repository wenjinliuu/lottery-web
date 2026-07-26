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
  const DEFAULT_VISIBLE_DRAWS = new Set(GAME_ORDER);
  const APP_VERSION = "3.4.2";
  const LOTTERY_DATA_BASE_URL = "https://raw.githubusercontent.com/wenjinliuu/lottery-data-repo/main/public_data";
  const REMOTE_GAME_KEYS = { k8: "kl8" };
  const GAME_CHART_COLORS = { ssq: "#ef4444", dlt: "#3b82f6", k8: "#f05a28", fc3d: "#239fc5", pl3: "#bf5ea1", pl5: "#9b4f91", qlc: "#ff9c34", qxc: "#525ba7" };
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
    activeView: "home",
    showAllDraws: false,
    latestUpdatedAt: "",
    historyGameKey: "ssq",
    dltAddOn: false,
    calendar: null,
    loadedHistoryGames: new Set(),
    historyLoadingGames: new Set(),
    recordFilterGame: "all",
    profitRange: "all",
    walletStatusFilter: "all",
    expandedWalletBatches: new Set(),
    drawCarouselIndex: 0,
    ticketAddStep: "intro",
    manualGameKey: "ssq",
    manualPlayMode: "",
    manualSelection: {},
    manualTickets: [],
    manualMultiple: 1,
    ticketScanResult: null,
    ticketScanPreview: "",
    ticketScanBusy: false,
    ticketScanAddDraft: null,
    nextDrawRefreshing: false,
    nextDrawRefreshAvailableAt: 0,
    health: null,
    healthError: "",
    monthCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    statsYear: new Date().getFullYear(),
    statsMonth: String(new Date().getMonth() + 1),
    pwaState: window.LotteryPWA?.getState?.() || {}
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    initTheme();
    initControls();
    bindEvents();
    await Promise.all([loadCalendar(), loadDraws(), loadHealth()]);
    /* 电子票默认展示对应开奖号：启动时并行缓存全部彩种最近 50 期。 */
    await loadAllGameHistories();
    await loadRecords();
    await reconcileInferredRecords(false);
    /* 首页开奖轮播固定从双色球开始；选号工具的彩种状态与开奖浏览互不干扰。 */
    state.drawCarouselIndex = 0;
    renderTodayRecommend();
    randomizeTickets();
    renderHomeDashboard();
    renderBackupHint();
    renderDataStatus();
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
      "latestDrawsUpdated", "drawUpdateNotice", "historyBackBtn", "toast",
      "themeToggleBtn", "themeToggleSub",
      "profitCard", "profitChartWrap", "profitEmpty", "profitNetValue", "profitSub", "profitRangeTabs",
      "myRecordsBackBtn", "myRecordsSummary", "recordFilterChips", "recordFilterSummary",
      "wonRecordsBackBtn", "wonRecordsSummary", "wonRecordList", "mineWonRecordsBtn",
      "detailSheet", "detailSheetBackdrop", "detailSheetCloseBtn", "detailSheetTitle", "detailSheetSub", "detailSheetBody",
      "scanTicketBtn", "ticketScan", "ticketScanBackdrop", "ticketScanCloseBtn", "ticketScanTitle", "ticketScanSub", "ticketScanBody", "ticketScanOverlay", "ticketScanInput",
      "dltAddOnBtn",
      "todayRecommend", "todayRecommendChips",
      "lastBackupHint",
      "draftDrawTag", "draftDrawRefreshBtn",
      "monthlyStatsBtn", "monthlyBackBtn", "monthlySummary", "monthlyKpis", "monthlyCalendar", "monthlyCalendarHint", "monthlyGameChart", "monthlyCompareChart", "statsYearSelect", "statsMonthSelect",
      "dataStatusCard", "dataStatusSummary", "dataStatusDot", "dataStatusGrid", "dataStatusRefreshBtn", "pwaInstallBtn",
      "homeNotificationBtn", "homeNotificationBadge", "homeOverviewSub", "homeOverviewMoreBtn", "homeScanTicketBtn", "latestDrawMoreBtn", "drawCarouselDots", "homeMonthlyChart", "homeMonthlySub",
      "walletSubtitle", "walletFilterChips", "walletFilterSummary", "addTicketBtn", "walletMoreBtn",
      "autoCheckToggleBtn", "autoCheckToggleSub",
      "ticketAdd", "ticketAddBackdrop", "ticketAddBackBtn", "ticketAddCloseBtn", "ticketAddTitle", "ticketAddSub", "ticketAddIntro", "randomToolView", "manualToolView",
      "addScanTicketBtn", "addAlbumTicketBtn", "openRandomToolBtn", "openManualToolBtn", "openManualPickToolBtn", "dataStatusEntryBtn",
      "manualGameTabs", "manualPlayModeField", "manualPlayModeTabs", "manualPickerHint", "manualPicker", "manualClearBtn", "manualAddLineBtn",
      "manualDraftSummary", "manualDraftList", "manualMultipleMinusBtn", "manualMultiplePlusBtn", "manualMultipleText", "manualSaveBtn"
    ].forEach((id) => { els[id] = document.getElementById(id); });
  }

  /* ===== iOS 26 Liquid Glass — Theme manager (light ↔ dark) ===== */

  const THEME_STORAGE_KEY = "lottery-theme";
  const THEME_LABELS = { dark: "深色", light: "浅色" };

  function initTheme() {
    applyTheme(readSavedTheme());
    if (els.themeToggleBtn) {
      els.themeToggleBtn.addEventListener("click", () => {
        const cur = readSavedTheme();
        const next = cur === "dark" ? "light" : "dark";
        saveTheme(next);
        applyTheme(next);
      });
      /* a11y: role=switch 必须支持 Space / Enter 键盘触发 */
      els.themeToggleBtn.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); els.themeToggleBtn.click(); }
      });
    }
  }

  function readSavedTheme() {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      /* 未设置、旧版 system 值或异常值一律迁移为默认浅色。 */
      return v === "dark" ? "dark" : "light";
    } catch (e) { return "light"; }
  }

  function saveTheme(mode) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode === "dark" ? "dark" : "light");
    } catch (e) { /* private mode etc. */ }
  }

  function applyTheme(mode) {
    const root = document.documentElement;
    const normalizedMode = mode === "dark" ? "dark" : "light";
    const isDark = normalizedMode === "dark";
    root.setAttribute("data-theme", normalizedMode);
    const themeColor = document.getElementById("themeColorMeta");
    if (themeColor) themeColor.setAttribute("content", isDark ? "#0b0f1c" : "#f7f7f7");
    if (els.themeToggleBtn) els.themeToggleBtn.setAttribute("aria-checked", String(isDark));
    if (els.themeToggleSub) els.themeToggleSub.textContent = THEME_LABELS[normalizedMode];
  }

  const AUTO_CHECK_STORAGE_KEY = "lottery-auto-check-v1";

  function getAutoCheckEnabled() {
    try { return localStorage.getItem(AUTO_CHECK_STORAGE_KEY) !== "off"; }
    catch (error) { return true; }
  }

  function setAutoCheckEnabled(enabled) {
    try { localStorage.setItem(AUTO_CHECK_STORAGE_KEY, enabled ? "on" : "off"); }
    catch (error) { /* private mode */ }
  }

  function renderAutoCheckPreference() {
    const enabled = getAutoCheckEnabled();
    if (els.autoCheckToggleBtn) {
      els.autoCheckToggleBtn.setAttribute("aria-checked", String(enabled));
      els.autoCheckToggleBtn.classList.toggle("is-on", enabled);
    }
    if (els.autoCheckToggleSub) els.autoCheckToggleSub.textContent = enabled ? "已开启 · 每次打开时核对待核对票据" : "已关闭 · 仅手动核对";
  }

  function openTicketAdd(step = "intro") {
    if (!els.ticketAdd) return;
    els.ticketAdd.hidden = false;
    document.body.classList.add("ticket-add-open");
    showTicketAddStep(step);
  }

  function closeTicketAdd() {
    if (!els.ticketAdd) return;
    els.ticketAdd.hidden = true;
    document.body.classList.remove("ticket-add-open");
    state.ticketAddStep = "intro";
  }

  function showTicketAddStep(step = "intro") {
    state.ticketAddStep = ["random", "manual"].includes(step) ? step : "intro";
    const intro = state.ticketAddStep === "intro";
    if (els.ticketAddIntro) els.ticketAddIntro.hidden = !intro;
    if (els.randomToolView) els.randomToolView.hidden = state.ticketAddStep !== "random";
    if (els.manualToolView) els.manualToolView.hidden = state.ticketAddStep !== "manual";
    if (els.ticketAddBackBtn) els.ticketAddBackBtn.hidden = intro;
    if (els.ticketAddTitle) els.ticketAddTitle.textContent = intro ? "添加到票夹" : state.ticketAddStep === "random" ? "随机选号" : "手动录入号码";
    if (els.ticketAddSub) {
      els.ticketAddSub.textContent = intro
        ? "记录已经在线下正规渠道购买的彩票"
        : state.ticketAddStep === "random"
          ? "生成号码后，请确认已在线下完成购买再加入票夹"
          : "选择一张普通单式票的号码并加入票夹";
    }
    if (state.ticketAddStep === "random") {
      renderDraftHead();
      renderDraft();
    }
    if (state.ticketAddStep === "manual") renderManualTool();
    els.ticketAdd?.querySelector(".ticket-add-scroll")?.scrollTo({ top: 0, behavior: "auto" });
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
    refresh:       '<svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
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
    els.saveBtn.addEventListener("click", () => saveDraftRecords(true, "random"));
    els.clearDraftBtn.addEventListener("click", () => {
      if (state.draftTickets.length && !window.confirm(`清空当前 ${state.draftTickets.length} 注未保存号码？`)) return;
      state.draftTickets = [];
      renderDraft();
    });
    els.reloadDrawsBtn?.addEventListener("click", async () => {
      await refreshNextDrawData(false);
      await ensurePendingRecordDraws();
      await checkAllRecords();
      toast("开奖与日历数据已刷新");
    });
    els.toggleDrawsBtn?.addEventListener("click", () => {
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
    if (els.homeScanTicketBtn) els.homeScanTicketBtn.addEventListener("click", openTicketScan);
    if (els.addTicketBtn) els.addTicketBtn.addEventListener("click", () => openTicketAdd("intro"));
    if (els.ticketAddBackdrop) els.ticketAddBackdrop.addEventListener("click", closeTicketAdd);
    if (els.ticketAddCloseBtn) els.ticketAddCloseBtn.addEventListener("click", closeTicketAdd);
    if (els.ticketAddBackBtn) els.ticketAddBackBtn.addEventListener("click", () => showTicketAddStep("intro"));
    if (els.addScanTicketBtn) els.addScanTicketBtn.addEventListener("click", () => {
      closeTicketAdd();
      openTicketScan();
    });
    if (els.addAlbumTicketBtn) els.addAlbumTicketBtn.addEventListener("click", () => {
      /* 保持在用户点击手势内直接唤起系统相册；选中图片后才进入识别页。 */
      els.ticketScanInput?.click();
    });
    if (els.openRandomToolBtn) els.openRandomToolBtn.addEventListener("click", () => showTicketAddStep("random"));
    if (els.openManualToolBtn) els.openManualToolBtn.addEventListener("click", () => showTicketAddStep("manual"));
    if (els.openManualPickToolBtn) els.openManualPickToolBtn.addEventListener("click", () => showTicketAddStep("manual"));
    if (els.homeOverviewMoreBtn) els.homeOverviewMoreBtn.addEventListener("click", openMonthlyStatsView);
    if (els.latestDrawMoreBtn) els.latestDrawMoreBtn.addEventListener("click", openLatestDrawsSheet);
    if (els.walletMoreBtn) els.walletMoreBtn.addEventListener("click", () => {
      state.recordFilterGame = "all";
      openMyRecordsView();
    });
    if (els.dataStatusEntryBtn) els.dataStatusEntryBtn.addEventListener("click", openDataStatusSheet);
    if (els.homeNotificationBtn) els.homeNotificationBtn.addEventListener("click", openNotificationSheet);
    if (els.ticketScanBackdrop) els.ticketScanBackdrop.addEventListener("click", closeTicketScan);
    if (els.ticketScanCloseBtn) els.ticketScanCloseBtn.addEventListener("click", closeTicketScan);
    if (els.ticketScanInput) els.ticketScanInput.addEventListener("change", handleTicketScanFile);
    if (els.historyBackBtn) els.historyBackBtn.addEventListener("click", () => switchView("check"));
    if (els.mineRecordToggleBtn) els.mineRecordToggleBtn.addEventListener("click", () => openMyRecordsView());
    if (els.myRecordsBackBtn) els.myRecordsBackBtn.addEventListener("click", () => switchView("mine"));
    if (els.wonRecordsBackBtn) els.wonRecordsBackBtn.addEventListener("click", () => switchView("home"));
    if (els.mineWonRecordsBtn) els.mineWonRecordsBtn.addEventListener("click", () => {
      state.walletStatusFilter = "pending";
      switchView("check");
      renderWalletTickets();
    });
    if (els.monthlyStatsBtn) els.monthlyStatsBtn.addEventListener("click", openMonthlyStatsView);
    if (els.monthlyBackBtn) els.monthlyBackBtn.addEventListener("click", () => switchView("home"));
    if (els.statsYearSelect) els.statsYearSelect.addEventListener("change", () => {
      state.statsYear = Number(els.statsYearSelect.value) || new Date().getFullYear();
      renderMonthlyStats();
      window.requestAnimationFrame(resetPageScroll);
    });
    if (els.statsMonthSelect) els.statsMonthSelect.addEventListener("change", () => {
      state.statsMonth = els.statsMonthSelect.value || "all";
      renderMonthlyStats();
      window.requestAnimationFrame(resetPageScroll);
    });
    if (els.dataStatusRefreshBtn) els.dataStatusRefreshBtn.addEventListener("click", refreshDataStatus);
    if (els.pwaInstallBtn) els.pwaInstallBtn.addEventListener("click", installPwa);
    if (els.autoCheckToggleBtn) {
      els.autoCheckToggleBtn.addEventListener("click", () => {
        const enabled = !getAutoCheckEnabled();
        setAutoCheckEnabled(enabled);
        renderAutoCheckPreference();
        toast(enabled ? "已开启打开应用时自动核对" : "已关闭自动核对，可在票夹手动核对");
      });
    }
    window.addEventListener("online", renderDataStatus);
    window.addEventListener("offline", renderDataStatus);
    window.addEventListener("lottery:pwa-state", (event) => {
      state.pwaState = event.detail || {};
      renderDataStatus();
      if (state.pwaState.updateReady) toast("彩票夹有新版本", { label: "立即更新", onClick: () => window.LotteryPWA?.applyUpdate?.() });
    });
    document.querySelectorAll("[data-stat-details]").forEach((btn) => btn.addEventListener("click", openGameStatsSheet));
    if (els.detailSheetBackdrop) els.detailSheetBackdrop.addEventListener("click", closeDetailSheet);
    if (els.detailSheetCloseBtn) els.detailSheetCloseBtn.addEventListener("click", closeDetailSheet);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && state.activeView === "home") scheduleDrawCarouselAuto(1600);
    });
    window.addEventListener("scroll", syncStickyChrome, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && els.detailSheet && !els.detailSheet.hidden) closeDetailSheet();
      if (event.key === "Escape" && els.ticketAdd && !els.ticketAdd.hidden) closeTicketAdd();
      if (event.key === "Escape" && els.ticketScan && !els.ticketScan.hidden) {
        const expandedPreview = els.ticketScanBody?.querySelector(".scan-preview-zoom.is-expanded");
        if (expandedPreview) expandedPreview.classList.remove("is-expanded");
        else if (state.ticketScanAddDraft) {
          state.ticketScanAddDraft = null;
          renderTicketScanReview();
          requestAnimationFrame(() => els.ticketScanBody?.querySelector("[data-scan-add]")?.focus());
        }
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
    bindManualToolEvents();
    renderAutoCheckPreference();
    syncStickyChrome();
  }

  function syncStickyChrome() {
    const scrolling = document.scrollingElement || document.documentElement;
    const scrolled = Number(scrolling?.scrollTop || window.scrollY || 0) > 8;
    document.querySelectorAll(".home-header,.wallet-sticky-shell,.sticky-secondary-head").forEach((node) => {
      node.classList.toggle("is-scrolled", scrolled);
    });
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
    if (view === "random" || view === "numberTool") {
      openTicketAdd("random");
      return;
    }
    resetPageScroll();
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
      if (view === "home") renderHomeDashboard();
      if (view === "mine") {
        renderBackupHint();
        renderDataStatus();
      }
      if (view === "monthly") renderMonthlyStats();
    });
    window.requestAnimationFrame(resetPageScroll);
    if (view === "home") scheduleDrawCarouselAuto();
  }

  function resetPageScroll() {
    const scrolling = document.scrollingElement || document.documentElement;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (scrolling) scrolling.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll(".ticket-add-scroll,.ticket-scan-body,.detail-sheet-body").forEach((node) => {
      node.scrollTop = 0;
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
      renderDrawUpdateStatus();
      renderDataStatus();
      return true;
    } catch (e) {
      state.calendar = null;
      renderTodayRecommend();
      renderDrawUpdateStatus();
      renderDataStatus();
      return false;
    }
  }

  async function loadHealth() {
    try {
      state.health = await fetchJson(`${LOTTERY_DATA_BASE_URL}/health.json?t=${Date.now()}`);
      state.healthError = "";
      renderDataStatus();
      return true;
    } catch (error) {
      state.health = null;
      state.healthError = String(error?.message || "健康数据读取失败");
      renderDataStatus();
      return false;
    }
  }

  function getDataStatusModel() {
    const online = navigator.onLine !== false;
    const latestAt = state.latestUpdatedAt || "";
    const calendarAt = state.calendar?.updated_at || state.calendar?.updatedAt || "";
    const healthAt = state.health?.updated_at || state.health?.updatedAt || "";
    const inferred = state.draws.filter((draw) => draw.nextStatus === "inferred").length;
    const unavailable = state.draws.filter((draw) => draw.nextStatus === "unavailable" || !draw.nextExpect).length;
    const pendingDraws = getPendingDrawUpdates();
    const pendingNames = pendingDraws.map((item) => item.label).join("、");
    const remoteOk = state.health?.ok !== false && Boolean(state.health);
    const pwa = state.pwaState || window.LotteryPWA?.getState?.() || {};
    const backup = getBackupHealth();
    const tone = !online || state.health?.ok === false ? "error" : (!remoteOk || inferred || unavailable || pendingDraws.length || backup.tone === "warn" || pwa.offlineDataUsed) ? "warn" : "ok";
    return {
      tone,
      summary: !online
        ? "当前离线，页面正在使用本地记录与已缓存内容"
        : pendingDraws.length
          ? `今日${pendingNames}开奖号码尚未更新，请稍后再试`
          : tone === "ok" ? "开奖数据、应用与本地备份状态正常" : "部分数据仍在确认，建议查看下方状态",
      items: [
        { label: "网络", value: online ? "在线" : "离线", tone: online ? "ok" : "error" },
        { label: "开奖仓库", value: remoteOk ? "运行正常" : state.healthError ? "暂时不可用" : "状态待确认", tone: remoteOk ? "ok" : "warn" },
        { label: "最新开奖", value: pendingDraws.length ? `${pendingNames}待更新` : latestAt ? formatStatusTime(latestAt) : "尚未载入", tone: pendingDraws.length || !latestAt ? "warn" : "ok" },
        { label: "今日开奖号", value: pendingDraws.length ? `${pendingNames}尚未更新` : "已同步", tone: pendingDraws.length ? "warn" : "ok" },
        { label: "开奖日历", value: calendarAt ? formatStatusTime(calendarAt) : "尚未载入", tone: calendarAt ? (inferred ? "warn" : "ok") : "warn" },
        { label: "下期信息", value: unavailable ? `${unavailable} 个彩种待生成` : inferred ? `${inferred} 个彩种为预计` : "均为已确认状态", tone: unavailable || inferred ? "warn" : "ok" },
        { label: "本地备份", value: backup.shortText, tone: backup.tone },
        { label: "离线应用", value: pwa.installed ? "已安装" : pwa.registered ? "已启用" : pwa.supported === false ? "浏览器不支持" : "正在准备", tone: pwa.registered || pwa.installed ? "ok" : "warn" },
        { label: "应用版本", value: `v${APP_VERSION}${pwa.updateReady ? " · 可更新" : ""}`, tone: pwa.updateReady ? "warn" : "ok" }
      ],
      healthAt
    };
  }

  function formatStatusTime(value) {
    if (!value) return "未知";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function renderDataStatus() {
    if (!els.dataStatusGrid) return;
    state.pwaState = window.LotteryPWA?.getState?.() || state.pwaState || {};
    const model = getDataStatusModel();
    if (els.dataStatusSummary) els.dataStatusSummary.textContent = model.summary;
    if (els.dataStatusDot) els.dataStatusDot.dataset.tone = model.tone;
    els.dataStatusGrid.innerHTML = model.items.map((item) => `
      <div class="status-item">
        <div class="status-item-label">${item.label}</div>
        <div class="status-item-value" data-tone="${item.tone}">${item.value}</div>
      </div>
    `).join("");
    if (els.pwaInstallBtn) {
      els.pwaInstallBtn.hidden = !(state.pwaState.installAvailable || state.pwaState.manualInstall);
      const label = els.pwaInstallBtn.querySelector("span");
      if (label) label.textContent = state.pwaState.manualInstall ? "查看安装方法" : "安装到桌面";
    }
    renderHomeNotificationBadge();
  }

  function getChinaNowParts(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now).reduce((map, part) => {
      if (part.type !== "literal") map[part.type] = part.value;
      return map;
    }, {});
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    return {
      date,
      clock: `${parts.hour}:${parts.minute}`,
      weekday: new Date(`${date}T00:00:00Z`).getUTCDay()
    };
  }

  function getCalendarEntry(gameKey) {
    const list = state.calendar?.lotteries || {};
    const remoteKey = REMOTE_GAME_KEYS[gameKey] || gameKey;
    return list[remoteKey] || list[gameKey] || null;
  }

  function getPendingDrawUpdates(now = new Date()) {
    const current = getChinaNowParts(now);
    return GAME_ORDER.reduce((items, gameKey) => {
      const entry = getCalendarEntry(gameKey);
      const weekdays = Array.isArray(entry?.draw_weekdays) ? entry.draw_weekdays.map(Number) : [];
      const drawClock = String(entry?.draw_time || "").slice(0, 5);
      if (!entry || !weekdays.includes(current.weekday) || !drawClock || current.clock < drawClock) return items;
      const latest = getLatestDraw(gameKey);
      const latestDate = normalizeDate(latest?.openDate || latest?.time || "");
      if (latestDate !== current.date) items.push({ gameKey, label: GAME_CONFIGS[gameKey]?.label || gameKey });
      return items;
    }, []);
  }

  function renderDrawUpdateStatus() {
    if (!els.drawUpdateNotice) return;
    const pending = getPendingDrawUpdates();
    els.drawUpdateNotice.hidden = !pending.length;
    els.drawUpdateNotice.textContent = pending.length
      ? `今日${pending.map((item) => item.label).join("、")}开奖号码尚未更新，请稍后再试`
      : "";
  }

  async function refreshDataStatus() {
    if (els.dataStatusRefreshBtn) els.dataStatusRefreshBtn.disabled = true;
    const results = await Promise.all([loadHealth(), loadCalendar(), loadDraws(false)]);
    renderDataStatus();
    if (els.dataStatusRefreshBtn) els.dataStatusRefreshBtn.disabled = false;
    toast(results.every(Boolean) ? "数据状态已更新" : "部分状态暂时无法获取");
  }

  async function installPwa() {
    if (state.pwaState.manualInstall) {
      window.alert("在 iPhone 或 iPad 的 Safari 中：点击底部“分享”按钮，然后选择“添加到主屏幕”，即可把彩票夹作为独立应用打开。");
      return;
    }
    const installed = await window.LotteryPWA?.install?.();
    toast(installed ? "彩票夹已添加到桌面" : "未完成安装，可稍后再试");
    renderDataStatus();
  }

  function getTodayOpenGames() {
    const wd = getChinaNowParts().weekday; /* 统一按中国标准时间判断开奖日 */
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
        if (!g) return;
        state.gameKey = g;
        renderTodayRecommend();
        if (state.activeView !== "home") switchView("home");
        requestAnimationFrame(() => scrollDrawCarouselToGame(g));
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
      renderDrawUpdateStatus();
      renderDataStatus();
      if (showToast) toast("开奖数据已刷新");
      return true;
    } catch (error) {
      state.draws = [];
      state.latestUpdatedAt = "";
      if (els.latestDrawsUpdated) els.latestDrawsUpdated.textContent = "暂无更新时间";
      renderDrawsError();
      renderDrawUpdateStatus();
      renderDataStatus();
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

  async function loadAllGameHistories() {
    await Promise.all(GAME_ORDER.map((gameKey) => loadGameHistory(gameKey, false)));
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
    if (getAutoCheckEnabled()) await checkAllRecords(false);
    else renderRecords();
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

  async function saveDraftRecords(copyAfter = false, source = "number-tool") {
    if (!state.draftTickets.length) {
      toast("请先生成号码");
      return false;
    }
    if (!ensureResponsibleAcknowledgement()) return false;

    const now = new Date().toISOString();
    const multiple = clampInt(els.multipleInput.value, 1, 99);
    const price = Math.max(0, Number(getCurrentTicketPrice() || els.priceInput.value || 0));
    const batchId = `batch_${compactDate(now)}_${randomId()}`;
    const targetDraw = getNextDrawTarget(state.gameKey);
    if (!targetDraw.available) {
      toast(targetDraw.message);
      return false;
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
        source,
        createdAt: now,
        updatedAt: now
      };
    });

    for (const record of records) await dbPut(record);
    state.records = await dbGetAll();
    renderRecords();
    closeTicketAdd();
    switchView("check");
    const viewAction = { label: "查看票夹", onClick: () => switchView("check") };
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
    return true;
  }

  function ensureResponsibleAcknowledgement() {
    const key = "lottery-responsible-play-ack-v1";
    try {
      if (localStorage.getItem(key) === "yes") return true;
    } catch (error) { /* 仍显示一次确认 */ }
    const accepted = window.confirm("彩票夹的号码功能仅供试玩与记录，不构成购买或中奖建议。本工具不提供网络售彩、代购或支付入口；如需购买，请通过当地合法、正规线下彩票销售渠道，并理性参与。\n\n点击“确定”表示我已知晓。");
    if (accepted) {
      try { localStorage.setItem(key, "yes"); } catch (error) { /* private mode */ }
    }
    return accepted;
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
    if (!window.confirm("确定清空所有本地彩票记录吗？")) return;
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
    const health = getBackupHealth();
    els.lastBackupHint.textContent = health.text;
    els.lastBackupHint.classList.add("backup-health-alert");
    els.lastBackupHint.classList.toggle("is-ok", health.tone === "ok");
  }

  function getBackupHealth() {
    const last = readLastBackupAt();
    if (!state.records.length) return { tone: "ok", shortText: "暂无需备份", text: "暂无本地记录，产生记录后会提醒备份。" };
    if (!last) return { tone: "warn", shortText: "尚未备份", text: "尚未备份：建议现在导出一份 JSON 文件。" };
    const diffMs = Date.now() - new Date(last).getTime();
    const day = 86400000;
    let rel;
    if (diffMs < 60000) rel = "刚刚";
    else if (diffMs < 3600000) rel = `${Math.floor(diffMs / 60000)} 分钟前`;
    else if (diffMs < day) rel = `${Math.floor(diffMs / 3600000)} 小时前`;
    else if (diffMs < day * 30) rel = `${Math.floor(diffMs / day)} 天前`;
    else rel = formatDate(last);
    const due = !Number.isFinite(diffMs) || diffMs >= day * 7;
    return {
      tone: due ? "warn" : "ok",
      shortText: due ? `已超过 ${Math.max(7, Math.floor(diffMs / day) || 7)} 天` : rel,
      text: due ? `上次备份：${rel}，建议重新导出。` : `上次备份：${rel}，状态正常。`
    };
  }

  async function exportBackup() {
    const now = new Date().toISOString();
    const payload = {
      version: 2,
      appVersion: APP_VERSION,
      exportedAt: now,
      recordCount: state.records.length,
      checksum: backupChecksum(state.records),
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
      if (payload.checksum && payload.checksum !== backupChecksum(records)) throw new Error("backup_checksum_mismatch");
      for (const record of records) await dbPut(evaluateRecord(record));
      state.records = await dbGetAll();
      renderRecords();
      renderBackupHint();
      toast(`已导入 ${records.length} 条记录`);
    } catch (error) {
      toast("导入失败，文件格式不正确");
    } finally {
      event.target.value = "";
    }
  }

  function backupChecksum(records) {
    const text = JSON.stringify(records || []);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
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
      els.draftList.textContent = "点击“重新随机”生成号码";
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
    if (!els.latestDraws) return;
    const visibleGames = GAME_ORDER.filter((gameKey) => DEFAULT_VISIBLE_DRAWS.has(gameKey));
    const latestCards = visibleGames.map((gameKey, idx) => renderLatestDrawCard(gameKey, idx)).join("");
    els.latestDraws.innerHTML = latestCards;
    els.latestDraws.querySelectorAll("[data-history-game]").forEach((btn) => {
      btn.addEventListener("click", () => openGameHistory(btn.dataset.historyGame));
    });
    renderDrawCarouselDots();
    els.latestDraws.onpointerdown = () => pauseDrawCarouselAuto();
    els.latestDraws.ontouchstart = () => pauseDrawCarouselAuto();
    els.latestDraws.onscroll = () => {
      window.clearTimeout(renderDraws.scrollTimer);
      renderDraws.scrollTimer = window.setTimeout(syncDrawCarouselIndex, 70);
    };
    window.requestAnimationFrame(() => {
      const activeGame = GAME_ORDER[state.drawCarouselIndex] || GAME_ORDER[0];
      scrollDrawCarouselToGame(activeGame, { behavior: "auto", manual: false });
    });
    scheduleDrawCarouselAuto();

    renderHistory();
  }

  function renderLatestDrawCard(gameKey, index = 0, expanded = false) {
    const draw = getLatestDraw(gameKey);
    const config = GAME_CONFIGS[gameKey];
    const todayTag = getTodayOpenGames().includes(gameKey) ? `<span class="today-draw-tag">今日开奖</span>` : "";
    if (!draw) {
      return `<article class="draw-card draw-card-${gameKey}${expanded ? " is-expanded-list" : ""}" data-draw-slide="${gameKey}" style="--stagger-i:${index}"><div class="draw-top"><div class="draw-title-line"><div class="draw-title">${config.label}</div>${todayTag}</div><span class="draw-meta-tag">暂无数据</span></div><div class="draw-card-empty">等待开奖仓库更新</div></article>`;
    }
    const firstPrize = renderFirstPrize(draw);
    return `
      <article class="draw-card draw-card-${gameKey}${firstPrize ? " has-first-prize" : " no-first-prize"}${expanded ? " is-expanded-list" : ""}" data-draw-slide="${gameKey}" style="--stagger-i:${index}">
        <div class="draw-top">
          <div class="draw-title-line"><div class="draw-title">${config.label}</div>${todayTag}</div>
          <span class="draw-meta-tag">${draw.expect || "未知期"} · ${draw.openDate || draw.time || "未知日期"}</span>
        </div>
        ${firstPrize}
        <div class="draw-number-row">
          ${renderDrawBalls(gameKey, draw.drawValues || parseOpenCodeToDrawValues(gameKey, draw.openCode), { compactK8: !expanded })}
          <button class="draw-action-btn" type="button" data-history-game="${gameKey}" aria-label="查看${config.label}往期">${ICON.chevronRight}</button>
        </div>
      </article>
    `;
  }

  function renderDrawCarouselDots() {
    if (!els.drawCarouselDots) return;
    els.drawCarouselDots.innerHTML = GAME_ORDER.map((gameKey, index) => `
      <button class="draw-carousel-dot${index === state.drawCarouselIndex ? " is-active" : ""}" type="button" data-draw-dot="${gameKey}" aria-label="查看${GAME_CONFIGS[gameKey]?.label || gameKey}" aria-pressed="${index === state.drawCarouselIndex}"></button>
    `).join("");
    els.drawCarouselDots.querySelectorAll("[data-draw-dot]").forEach((btn) => btn.addEventListener("click", () => scrollDrawCarouselToGame(btn.dataset.drawDot, { manual: true })));
  }

  function syncDrawCarouselIndex() {
    if (!els.latestDraws) return;
    const cards = Array.from(els.latestDraws.querySelectorAll("[data-draw-slide]"));
    if (!cards.length) return;
    const left = els.latestDraws.getBoundingClientRect().left;
    let bestIndex = 0;
    let bestDistance = Infinity;
    cards.forEach((card, index) => {
      const distance = Math.abs(card.getBoundingClientRect().left - left);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex === state.drawCarouselIndex) return;
    state.drawCarouselIndex = bestIndex;
    renderDrawCarouselDots();
  }

  function scrollDrawCarouselToGame(gameKey, options = {}) {
    if (!els.latestDraws) return;
    const card = els.latestDraws.querySelector(`[data-draw-slide="${gameKey}"]`);
    if (!card) return;
    state.drawCarouselIndex = Math.max(0, GAME_ORDER.indexOf(gameKey));
    const trackRect = els.latestDraws.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const targetLeft = els.latestDraws.scrollLeft + cardRect.left - trackRect.left;
    els.latestDraws.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: options.behavior || "smooth"
    });
    renderDrawCarouselDots();
    if (options.manual !== false) pauseDrawCarouselAuto();
  }

  function pauseDrawCarouselAuto(duration = 11000) {
    scheduleDrawCarouselAuto.pausedUntil = Date.now() + duration;
    scheduleDrawCarouselAuto(duration + 800);
  }

  function scheduleDrawCarouselAuto(delay = 5200) {
    window.clearTimeout(scheduleDrawCarouselAuto.timer);
    if (!els.latestDraws || document.hidden) return;
    scheduleDrawCarouselAuto.timer = window.setTimeout(() => {
      const pauseLeft = Number(scheduleDrawCarouselAuto.pausedUntil || 0) - Date.now();
      if (pauseLeft > 0 || state.activeView !== "home" || !els.detailSheet?.hidden) {
        scheduleDrawCarouselAuto(Math.max(1200, pauseLeft + 300));
        return;
      }
      const nextIndex = (state.drawCarouselIndex + 1) % GAME_ORDER.length;
      scrollDrawCarouselToGame(GAME_ORDER[nextIndex], { manual: false });
      scheduleDrawCarouselAuto();
    }, Math.max(800, delay));
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
    renderWalletTickets();
    renderMyRecordsList();
    renderWonRecordsList();
    renderMineStats();
    renderBackupHint();
    renderDataStatus();
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

  function getWalletBatchStatus(batch) {
    const records = batch?.records || [];
    if (records.some((record) => record.status === "pending" || !record.status)) return "pending";
    if (records.some((record) => record.status === "prize_float")) return "float";
    if (records.some((record) => record.status === "won")) return "won";
    return "lost";
  }

  function getWalletStatusLabel(status) {
    return { pending: "待核对", won: "已中奖", lost: "未中奖", float: "奖金待定" }[status] || "待核对";
  }

  function walletBatchMatchesFilter(batch, filter) {
    const status = getWalletBatchStatus(batch);
    if (filter === "all") return true;
    if (filter === "won") return status === "won" || status === "float";
    return status === filter;
  }

  function renderWalletFilters(allBatches = groupRecordsByBatch(state.records)) {
    if (!els.walletFilterChips) return;
    const pendingCount = allBatches.filter((batch) => getWalletBatchStatus(batch) === "pending").length;
    const options = [
      { key: "all", label: "全部" },
      { key: "pending", label: "待核对" },
      { key: "won", label: "已中奖" },
      { key: "lost", label: "未中奖" }
    ];
    els.walletFilterChips.innerHTML = options.map((option) => {
      const active = state.walletStatusFilter === option.key;
      const attention = option.key === "pending" && pendingCount > 0;
      const badge = attention ? `<span class="wallet-filter-badge">${pendingCount > 99 ? "99+" : pendingCount}</span>` : "";
      return `<button class="wallet-filter-btn${active ? " is-active" : ""}${attention ? " has-pending" : ""}" type="button" data-wallet-filter="${option.key}" aria-pressed="${active}"><span>${option.label}</span>${badge}</button>`;
    }).join("");
    els.walletFilterChips.querySelectorAll("[data-wallet-filter]").forEach((btn) => btn.addEventListener("click", () => {
      state.walletStatusFilter = btn.dataset.walletFilter || "all";
      renderWalletTickets();
    }));
  }

  function renderWalletTickets() {
    if (!els.recordList) return;
    const allBatches = groupRecordsByBatch(state.records);
    renderWalletFilters(allBatches);
    const pendingBatches = allBatches.filter((batch) => getWalletBatchStatus(batch) === "pending");
    if (els.walletSubtitle) els.walletSubtitle.textContent = `${allBatches.length} 张本地电子票 · ${pendingBatches.length} 张待核对`;

    const batches = allBatches.filter((batch) => walletBatchMatchesFilter(batch, state.walletStatusFilter));
    const lineCount = batches.reduce((sum, batch) => sum + batch.records.length, 0);
    if (els.walletFilterSummary) {
      const label = { all: "全部", pending: "待核对", won: "已中奖", lost: "未中奖" }[state.walletStatusFilter] || "全部";
      els.walletFilterSummary.textContent = `${label} · ${batches.length} 张电子票 · ${lineCount} 注`;
    }
    if (!batches.length) {
      els.recordList.className = "wallet-ticket-list empty empty-cta";
      els.recordList.innerHTML = `
        <div>${allBatches.length ? "当前筛选下暂无票据" : "票夹还是空的，扫描实体彩票后会显示在这里"}</div>
        <button class="mini-blue has-icon" type="button" data-wallet-add-empty>
          <svg class="icn" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>添加彩票</span>
        </button>
      `;
      els.recordList.querySelector("[data-wallet-add-empty]")?.addEventListener("click", () => openTicketAdd("intro"));
      return;
    }

    els.recordList.className = "wallet-ticket-list";
    const visibleBatches = batches.slice(0, 10);
    els.recordList.innerHTML = visibleBatches.map((batch, index) => renderWalletTicket(batch, index)).join("")
      + (batches.length > 10 ? `<button class="wallet-all-records-link" type="button" data-wallet-all>查看全部票夹 · ${batches.length} 张 <span aria-hidden="true">›</span></button>` : "");
    bindWalletTicketActions(els.recordList, renderWalletTickets);
    els.recordList.querySelector("[data-wallet-all]")?.addEventListener("click", () => {
      state.recordFilterGame = "all";
      openMyRecordsView();
    });
  }

  function renderWalletTicket(batch, index) {
    const records = batch.records || [];
    const first = records[0] || {};
    const stats = summarizeRecords(records);
    const gameKey = first.gameKey || "unknown";
    const status = getWalletBatchStatus(batch);
    const expanded = state.expandedWalletBatches.has(batch.batchId);
    const visible = expanded ? records : records.slice(0, 3);
    const issue = first.targetExpect || first.expect || "待定";
    const openDate = first.targetOpenDate || first.openDate || "";
    const prizeText = stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize);
    const isWinning = status === "won" || status === "float";
    const isDltAddOn = gameKey === "dlt" && records.some((record) => record.addOn || record.playMode === "add");
    const draw = findDrawForRecord(first);
    const statusText = status === "won"
      ? prizeText
      : status === "float"
        ? "奖金待定"
        : getWalletStatusLabel(status);
    return `
      <article class="wallet-ticket wallet-ticket-${gameKey}${isWinning ? " is-winning" : ""}" style="--stagger-i:${index}">
        ${isWinning ? `<div class="wallet-winning-sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>` : ""}
        <div class="wallet-ticket-top">
          <div class="wallet-ticket-identity">
            <span class="wallet-game-badge" aria-label="${GAME_CONFIGS[gameKey]?.label || gameKey}">${GAME_CONFIGS[gameKey]?.label || gameKey}</span>
            <div class="wallet-ticket-info">
              <div class="wallet-ticket-issue">第 ${issue} 期</div>
              <div class="wallet-ticket-meta">
                <span>购买 ${formatDateTime(batch.createdAt)}</span>
                <span>${openDate ? `开奖 ${normalizeDate(openDate)}` : "开奖日期待确认"}</span>
              </div>
              <div class="wallet-ticket-tags">
                <span>${records.length} 注 · ${first.multiple || 1} 倍</span>
                <span>花费 ${formatCompactMoney(stats.totalCost)}</span>
                ${isDltAddOn ? `<span class="wallet-play-badge">追加</span>` : ""}
              </div>
            </div>
          </div>
          <div class="wallet-ticket-head-right">
            <span class="wallet-status is-${status}">${statusText}</span>
            <button class="delete-btn wallet-ticket-delete has-icon" type="button" data-delete-batch="${batch.batchId}" aria-label="删除本张电子票">${ICON.trash}<span>删除</span></button>
          </div>
        </div>
        <div class="wallet-draw-panel${draw ? "" : " is-pending"}">
          <span class="wallet-draw-label">开奖<br>号码</span>
          ${draw
            ? renderDrawBalls(gameKey, draw.drawValues || parseOpenCodeToDrawValues(gameKey, draw.openCode))
            : `<span class="wallet-draw-pending">本期开奖号码尚未更新</span>`}
        </div>
        <div class="wallet-ticket-lines${gameKey === "k8" ? " wallet-ticket-lines-k8" : ""}">
          ${visible.map((record, lineIndex) => `
            <div class="wallet-ticket-line">
              <span class="wallet-line-no">${String(lineIndex + 1).padStart(2, "0")}</span>
              ${renderTicketBalls(record.gameKey, record.numbers, record.matched, FINAL_RECORD_STATUSES.has(record.status) && record.matched)}
            </div>
          `).join("")}
        </div>
        ${records.length > 3 ? `<button class="wallet-expand-btn" type="button" data-wallet-expand="${batch.batchId}">${expanded ? "收起号码" : `展开其余 ${records.length - 3} 注`}</button>` : ""}
        <div class="wallet-ticket-watermark">本地记录 · 非官方票据 · 请以实体票与官方开奖为准</div>
      </article>
    `;
  }

  function bindWalletTicketActions(container, rerender) {
    container?.querySelectorAll("[data-wallet-expand]").forEach((btn) => btn.addEventListener("click", () => {
      const id = btn.dataset.walletExpand;
      if (state.expandedWalletBatches.has(id)) state.expandedWalletBatches.delete(id);
      else state.expandedWalletBatches.add(id);
      rerender();
    }));
    container?.querySelectorAll("[data-delete-batch]").forEach((btn) => btn.addEventListener("click", () => deleteRecordsByBatch(btn.dataset.deleteBatch)));
  }

  function renderMyRecordsList() {
    renderRecordFilters();
    const filteredRecords = state.recordFilterGame === "all"
      ? state.records
      : state.records.filter((record) => record.gameKey === state.recordFilterGame);
    if (els.mineRecordList) {
      const batches = groupRecordsByBatch(filteredRecords);
      if (!batches.length) {
        els.mineRecordList.className = "wallet-ticket-list empty empty-cta";
        els.mineRecordList.innerHTML = `<div>当前筛选下暂无彩票记录</div><button class="mini-blue has-icon" type="button" data-empty-add-ticket><svg class="icn" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>添加彩票</span></button>`;
        els.mineRecordList.querySelector("[data-empty-add-ticket]")?.addEventListener("click", () => openTicketAdd("intro"));
      } else {
        els.mineRecordList.className = "wallet-ticket-list";
        els.mineRecordList.innerHTML = batches.map((batch, index) => renderWalletTicket(batch, index)).join("");
        bindWalletTicketActions(els.mineRecordList, renderMyRecordsList);
      }
    }
    if (els.myRecordsSummary) {
      const label = state.recordFilterGame === "all" ? "全部彩种" : (GAME_CONFIGS[state.recordFilterGame]?.label || state.recordFilterGame);
      els.myRecordsSummary.textContent = `${label} · ${groupRecordsByBatch(filteredRecords).length} 次记录`;
    }
    if (els.recordFilterSummary) {
      const stats = summarizeRecords(filteredRecords);
      const batchCount = groupRecordsByBatch(filteredRecords).length;
      const label = state.recordFilterGame === "all" ? "全部彩种" : (GAME_CONFIGS[state.recordFilterGame]?.label || state.recordFilterGame);
      const prize = stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize);
      els.recordFilterSummary.textContent = `${label} · ${batchCount} 次记录 · ${filteredRecords.length} 注 · 花费 ${formatCompactMoney(stats.totalCost)} · 中奖 ${prize} · 中奖率 ${stats.winRate}%`;
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
        <div>当前筛选下暂无彩票记录</div>
        <button class="mini-blue has-icon" type="button" data-empty-add-ticket>
          <svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3l-8 8"/><path d="M3 21l8-8"/><path d="M16 21h5v-5"/><path d="M3 3l5 5"/></svg>
          <span>添加彩票</span>
        </button>
      `;
      container.querySelector("[data-empty-add-ticket]")?.addEventListener("click", () => openTicketAdd("intro"));
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
    bindRedeemActions(container);
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
      els.wonRecordsSummary.textContent = `共 ${wonRecords.length} 注 · 累计中奖 ${formatCompactMoney(total)}`;
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
        <button class="mini-blue has-icon" type="button" data-empty-add-ticket>
          <svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3l-8 8"/><path d="M3 21l8-8"/><path d="M16 21h5v-5"/><path d="M3 3l5 5"/></svg>
          <span>添加彩票</span>
        </button>
      `;
      const goBtn = container.querySelector("[data-empty-add-ticket]");
      if (goBtn) goBtn.addEventListener("click", () => openTicketAdd("intro"));
      return;
    }
    const groups = groupRecordsByGame(records);
    container.className = "record-list";
    container.innerHTML = groups.map(({ gameKey, gameRecords }, groupIdx) => {
      const config = GAME_CONFIGS[gameKey] || {};
      const stats = summarizeRecords(gameRecords);
      const batches = groupRecordsByBatch(gameRecords);
      const groupStatus = stats.pendingCount ? `${stats.pendingCount} 注待核对` : stats.floatCount ? `${stats.floatCount} 注奖金待定` : "已核对";
      const amountText = stats.totalPrize > 0 ? formatMoney(stats.totalPrize) : stats.floatCount ? "浮动待定" : formatMoney(0);
      const meta = `${batches.length} 次记录 · 花费 ${formatMoney(stats.totalCost)} · 中奖率 ${stats.winRate}% · ${groupStatus}`;
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
    bindRedeemActions(container);
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
        <button class="delete-btn has-icon record-batch-delete" type="button" data-delete-batch="${batch.batchId}" aria-label="删除本次记录">${ICON.trash}<span>删除本次记录</span></button>
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
            <span>${playText || "普通"}</span>
            <span>成本 ${formatMoney(cost)}</span>
            <span>${record.multiple || 1}倍</span>
          </div>
          <div class="record-ticket-status">
            <span class="status-pill ${statusClass(record.status)}">${chipText}</span>
          </div>
        </div>
        ${renderTicketBalls(record.gameKey, record.numbers, record.matched, resolved)}
      </article>
    `;
  }

  function bindRedeemActions() {
    /* v3.3 起不再提供“兑奖”状态；保留空钩子兼容旧渲染路径。 */
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
    if (!window.confirm(`确定删除${label}${scopeText}彩票记录吗？`)) return;
    for (const record of targets) await dbDelete(record.id);
    state.records = await dbGetAll();
    renderRecords();
    toast(`${label}记录已删除`);
  }

  async function deleteRecordsByBatch(batchId) {
    const targets = state.records.filter((record) => (record.batchId || record.id) === batchId);
    if (!targets.length || !window.confirm("确定删除这一次彩票记录吗？")) return;
    for (const record of targets) await dbDelete(record.id);
    state.records = await dbGetAll();
    renderRecords();
    toast("本次彩票记录已删除");
  }

  function renderMineStats() {
    const stats = buildHomeMonthOverview();
    if (els.mineTotalCost) els.mineTotalCost.textContent = formatCompactMoney(stats.totalCost);
    if (els.minePrizeTotal) els.minePrizeTotal.textContent = stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize);
    if (els.mineWinRate) els.mineWinRate.textContent = `${stats.winRate}%`;
    if (els.mineWonCount) els.mineWonCount.textContent = String(stats.pendingBatches);
    if (els.mineRecordSummary) {
      const all = getMineStats();
      els.mineRecordSummary.textContent = `共 ${groupRecordsByBatch(state.records).length} 张票 · ${all.totalRecords} 注 · 已花 ${formatMoney(all.totalCost)}`;
    }
    renderProfitChart();
    renderHomeMonthlyChart(stats);
    renderHomeNotificationBadge();
  }

  function buildHomeMonthOverview() {
    const cursor = new Date();
    const monthKey = getMonthKey(cursor);
    const records = state.records.filter((record) => getRecordProfitDate(record).startsWith(monthKey));
    const stats = summarizeRecords(records);
    const batches = groupRecordsByBatch(records);
    const pendingBatches = batches.filter((batch) => getWalletBatchStatus(batch) === "pending").length;
    const games = new Map();
    records.forEach((record) => {
      const gameKey = record.gameKey || "unknown";
      if (!games.has(gameKey)) games.set(gameKey, { gameKey, cost: 0, count: 0 });
      const game = games.get(gameKey);
      game.cost += Number(record.price || 0) * Number(record.multiple || 1);
      game.count += 1;
    });
    return {
      ...stats,
      records,
      batches,
      pendingBatches,
      games: Array.from(games.values()).sort((a, b) => b.cost - a.cost)
    };
  }

  function renderHomeDashboard() {
    renderHero();
    renderMineStats();
    renderDraws();
    renderDataStatus();
  }

  function renderHomeMonthlyChart(stats = buildHomeMonthOverview()) {
    if (!els.homeMonthlyChart) return;
    const games = stats.games.filter((game) => game.cost > 0);
    if (els.homeOverviewSub) {
      els.homeOverviewSub.innerHTML = stats.records.length
        ? `${stats.batches.length} 张电子票 · <span class="${stats.pendingBatches ? "is-pending" : ""}">${stats.pendingBatches} 张待核对</span>`
        : "扫描实体彩票后，这里会生成本月概览";
    }
    if (!games.length || !stats.totalCost) {
      els.homeMonthlyChart.innerHTML = `<div class="home-monthly-empty">暂无统计数据</div>`;
      return;
    }
    const circumference = 2 * Math.PI * 38;
    let offset = 0;
    const segments = games.map((game) => {
      const share = game.cost / stats.totalCost;
      const dash = share * circumference;
      const node = `<circle class="monthly-donut-segment" cx="52" cy="52" r="38" stroke="${GAME_CHART_COLORS[game.gameKey] || "#94a3b8"}" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
      offset += dash;
      return node;
    }).join("");
    const legend = games.slice(0, 5).map((game) => `
      <div class="home-monthly-legend-item">
        <span class="monthly-legend-dot" style="background:${GAME_CHART_COLORS[game.gameKey] || "#94a3b8"}"></span>
        <span>${GAME_CONFIGS[game.gameKey]?.label || game.gameKey}</span>
        <strong>${Math.round((game.cost / stats.totalCost) * 100)}%</strong>
      </div>
    `).join("");
    els.homeMonthlyChart.innerHTML = `
      <div class="home-donut-wrap">
        <div class="home-donut-figure">
          <svg class="home-donut" viewBox="0 0 104 104" role="img" aria-label="本月各彩种花费占比"><circle class="monthly-donut-track" cx="52" cy="52" r="38"/>${segments}</svg>
          <div class="home-donut-center"><strong>${formatCompactMoney(stats.totalCost)}</strong><span>本月花费</span></div>
        </div>
        <div class="home-monthly-legend">${legend}</div>
      </div>
      <div class="home-monthly-metrics">
        <div><span>本月中奖</span><strong class="${stats.totalPrize > 0 ? "is-positive" : ""}">${stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize)}</strong></div>
        <div><span>中奖率</span><strong>${stats.winRate}%</strong></div>
        <div><span>已记录</span><strong>${stats.records.length}注</strong></div>
      </div>
    `;
  }

  function renderHomeNotificationBadge() {
    if (!els.homeNotificationBadge) return;
    const pending = groupRecordsByBatch(state.records).filter((batch) => getWalletBatchStatus(batch) === "pending").length;
    const backupWarn = getBackupHealth().tone === "warn" ? 1 : 0;
    const staleDraw = getPendingDrawUpdates().length ? 1 : 0;
    const count = pending + backupWarn + staleDraw;
    els.homeNotificationBadge.hidden = !count;
    els.homeNotificationBadge.textContent = count > 9 ? "9+" : String(count);
  }

  function openNotificationSheet() {
    if (!els.detailSheet || !els.detailSheetBody) return;
    els.detailSheet.classList.remove("is-fullscreen");
    const pendingBatches = groupRecordsByBatch(state.records).filter((batch) => getWalletBatchStatus(batch) === "pending");
    const backup = getBackupHealth();
    const dataModel = getDataStatusModel();
    els.detailSheetTitle.textContent = "提醒中心";
    els.detailSheetSub.textContent = "票据、开奖数据与本地备份";
    els.detailSheetBody.innerHTML = `
      <div class="notification-list">
        <button class="notification-item" type="button" data-notice-wallet>
          <span class="notification-icon is-blue">票</span>
          <span><strong>${pendingBatches.length ? `${pendingBatches.length} 张彩票等待核对` : "暂无待核对彩票"}</strong><small>${pendingBatches.length ? "开奖数据更新后会在打开应用时自动核对" : "票夹状态正常"}</small></span>
        </button>
        <div class="notification-item">
          <span class="notification-icon is-${dataModel.tone === "ok" ? "green" : "orange"}">数</span>
          <span><strong>${dataModel.summary}</strong><small>可在设置的数据状态中心查看详情</small></span>
        </div>
        <div class="notification-item">
          <span class="notification-icon is-${backup.tone === "ok" ? "green" : "orange"}">备</span>
          <span><strong>${backup.shortText}</strong><small>${backup.text}</small></span>
        </div>
      </div>
    `;
    els.detailSheet.hidden = false;
    document.body.classList.add("sheet-open");
    els.detailSheetBody.scrollTop = 0;
    els.detailSheetBody.querySelector("[data-notice-wallet]")?.addEventListener("click", () => {
      closeDetailSheet();
      switchView("check");
    });
  }

  function openLatestDrawsSheet() {
    if (!els.detailSheet || !els.detailSheetBody) return;
    els.detailSheet.classList.add("is-fullscreen");
    els.detailSheetTitle.textContent = "全部最新开奖";
    els.detailSheetSub.textContent = state.latestUpdatedAt ? `开奖仓库更新于 ${formatDateTime(state.latestUpdatedAt)}` : "等待开奖仓库数据";
    els.detailSheetBody.innerHTML = `
      <div class="latest-draw-sheet-list">
        ${GAME_ORDER.map((gameKey, index) => renderLatestDrawCard(gameKey, index, true)).join("")}
      </div>
      <div class="official-result-note">开奖号码仅供辅助核对，请以官方公布为准。</div>
    `;
    els.detailSheet.hidden = false;
    document.body.classList.add("sheet-open");
    els.detailSheetBody.scrollTop = 0;
    els.detailSheetBody.querySelectorAll("[data-history-game]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeDetailSheet();
        openGameHistory(btn.dataset.historyGame);
      });
    });
    window.setTimeout(() => els.detailSheetCloseBtn?.focus(), 20);
  }

  function openDataStatusSheet() {
    if (!els.detailSheet || !els.detailSheetBody) return;
    els.detailSheet.classList.remove("is-fullscreen");
    renderDataStatus();
    const model = getDataStatusModel();
    els.detailSheetTitle.textContent = "数据状态";
    els.detailSheetSub.textContent = model.summary;
    els.detailSheetBody.innerHTML = `
      <div class="status-center-grid status-center-grid-sheet">
        ${model.items.map((item) => `
          <div class="status-item">
            <div class="status-item-label">${item.label}</div>
            <div class="status-item-value" data-tone="${item.tone}">${item.value}</div>
          </div>
        `).join("")}
      </div>
      <div class="detail-sheet-actions">
        <button class="mini-blue has-icon" type="button" data-status-refresh>${ICON.refresh}<span>重新检查</span></button>
        ${(state.pwaState?.installAvailable || state.pwaState?.manualInstall) ? `<button class="mini-green has-icon" type="button" data-status-install><span>安装到桌面</span></button>` : ""}
      </div>
      <div class="official-result-note">开奖与日历数据来自自动更新仓库；最终结果请以彩票官方公布为准。</div>
    `;
    els.detailSheet.hidden = false;
    document.body.classList.add("sheet-open");
    els.detailSheetBody.scrollTop = 0;
    els.detailSheetBody.querySelector("[data-status-refresh]")?.addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      await refreshDataStatus();
      openDataStatusSheet();
    });
    els.detailSheetBody.querySelector("[data-status-install]")?.addEventListener("click", installPwa);
    window.setTimeout(() => els.detailSheetCloseBtn?.focus(), 20);
  }

  function openGameStatsSheet() {
    if (!els.detailSheet || !els.detailSheetBody) return;
    els.detailSheet.classList.remove("is-fullscreen");
    const groups = groupRecordsByGame(state.records);
    els.detailSheetTitle.textContent = "各彩种统计";
    els.detailSheetSub.textContent = "按已保存的全部本地彩票记录汇总";
    els.detailSheetBody.innerHTML = groups.length ? groups.map(({ gameKey, gameRecords }) => {
      const stats = summarizeRecords(gameRecords);
      const batchCount = groupRecordsByBatch(gameRecords).length;
      return `
        <article class="game-stat-detail">
          <div class="game-stat-detail-head">
            <div class="game-stat-detail-name">${GAME_CONFIGS[gameKey]?.label || gameKey}</div>
            <div class="game-stat-detail-count">${batchCount} 次记录 · ${gameRecords.length} 注</div>
          </div>
          <div class="game-stat-detail-grid">
            <div><span>累计花费</span><strong>${formatCompactMoney(stats.totalCost)}</strong></div>
            <div><span>累计中奖</span><strong>${stats.floatCount ? "待定" : formatCompactMoney(stats.totalPrize)}</strong></div>
            <div><span>中奖率</span><strong>${stats.winRate}%</strong></div>
          </div>
        </article>
      `;
    }).join("") : `<div class="empty-state">暂无彩票记录</div>`;
    els.detailSheet.hidden = false;
    document.body.classList.add("sheet-open");
    els.detailSheetBody.scrollTop = 0;
    window.setTimeout(() => els.detailSheetCloseBtn?.focus(), 20);
  }

  function closeDetailSheet() {
    if (!els.detailSheet) return;
    els.detailSheet.hidden = true;
    els.detailSheet.classList.remove("is-fullscreen");
    document.body.classList.remove("sheet-open");
  }

  /* ===== 全彩种普通单式手动选号 ===== */

  function bindManualToolEvents() {
    els.manualClearBtn?.addEventListener("click", () => {
      state.manualSelection = {};
      renderManualPicker();
    });
    els.manualAddLineBtn?.addEventListener("click", () => {
      const ticket = buildManualTicket();
      if (!ticket) return;
      state.manualTickets.push(ticket);
      state.manualSelection = {};
      renderManualTool();
    });
    els.manualMultipleMinusBtn?.addEventListener("click", () => {
      state.manualMultiple = Math.max(1, state.manualMultiple - 1);
      renderManualDraft();
    });
    els.manualMultiplePlusBtn?.addEventListener("click", () => {
      state.manualMultiple = Math.min(99, state.manualMultiple + 1);
      renderManualDraft();
    });
    els.manualSaveBtn?.addEventListener("click", async () => {
      if (!state.manualTickets.length) return;
      state.gameKey = state.manualGameKey;
      state.playMode = state.manualPlayMode;
      state.dltAddOn = state.manualGameKey === "dlt" && state.manualPlayMode === "add";
      state.draftTickets = state.manualTickets.map((ticket) => ({ ...ticket }));
      if (els.gameSelect) els.gameSelect.value = state.gameKey;
      if (els.multipleInput) els.multipleInput.value = String(state.manualMultiple);
      if (els.priceInput) els.priceInput.value = String(getCurrentTicketPrice());
      const saved = await saveDraftRecords(false, "manual");
      if (saved) {
        state.manualTickets = [];
        state.manualSelection = {};
        state.manualMultiple = 1;
        renderGameTabs();
        syncPlayModeOptions();
        syncDefaultPrice();
        renderCountTabs();
      }
    });
  }

  function getManualModes(gameKey) {
    if (gameKey === "dlt") return [{ key: "normal", label: "普通" }, { key: "add", label: "追加" }];
    if (gameKey === "k8") return GAME_CONFIGS.k8.playModes;
    if (gameKey === "fc3d" || gameKey === "pl3") return digitModes();
    return [];
  }

  function resetManualDraft(nextGameKey = state.manualGameKey, nextMode = "") {
    state.manualGameKey = nextGameKey;
    const modes = getManualModes(nextGameKey);
    state.manualPlayMode = nextMode || GAME_CONFIGS[nextGameKey]?.defaultPlayMode || modes[0]?.key || "";
    state.manualSelection = {};
    state.manualTickets = [];
    state.manualMultiple = 1;
  }

  function renderManualTool() {
    if (!els.manualGameTabs) return;
    els.manualGameTabs.innerHTML = GAME_ORDER.map((key) => {
      const active = key === state.manualGameKey;
      return `<button class="manual-game-tab today-chip-${key}${active ? " is-active" : ""}" type="button" data-manual-game="${key}" aria-pressed="${active}">${GAME_CONFIGS[key].label}</button>`;
    }).join("");
    els.manualGameTabs.querySelectorAll("[data-manual-game]").forEach((btn) => btn.addEventListener("click", () => {
      const key = btn.dataset.manualGame;
      if (key === state.manualGameKey) return;
      resetManualDraft(key);
      renderManualTool();
    }));

    const modes = getManualModes(state.manualGameKey);
    if (els.manualPlayModeField) els.manualPlayModeField.hidden = !modes.length;
    if (els.manualPlayModeTabs) {
      els.manualPlayModeTabs.dataset.accent = GAME_CONFIGS[state.manualGameKey]?.accent || "";
      els.manualPlayModeTabs.innerHTML = modes.map((mode) => {
        const active = mode.key === state.manualPlayMode;
        return `<button class="segment-btn${active ? " segment-btn-active" : ""}" type="button" data-manual-mode="${mode.key}" aria-pressed="${active}">${mode.label}</button>`;
      }).join("");
      els.manualPlayModeTabs.querySelectorAll("[data-manual-mode]").forEach((btn) => btn.addEventListener("click", () => {
        if (btn.dataset.manualMode === state.manualPlayMode) return;
        state.manualPlayMode = btn.dataset.manualMode;
        state.manualSelection = {};
        state.manualTickets = [];
        renderManualTool();
      }));
    }
    renderManualPicker();
    renderManualDraft();
  }

  function getManualSections() {
    const gameKey = state.manualGameKey;
    if (gameKey === "ssq") return [
      { key: "red", label: "红球", helper: "选择 6 个", min: 1, max: 33, count: 6, tone: "red" },
      { key: "blue", label: "蓝球", helper: "选择 1 个", min: 1, max: 16, count: 1, tone: "blue" }
    ];
    if (gameKey === "dlt") return [
      { key: "front", label: "前区", helper: "选择 5 个", min: 1, max: 35, count: 5, tone: "blue" },
      { key: "back", label: "后区", helper: "选择 2 个", min: 1, max: 12, count: 2, tone: "yellow" }
    ];
    if (gameKey === "k8") return [
      { key: "nums", label: GAME_CONFIGS.k8.playModes.find((mode) => mode.key === state.manualPlayMode)?.label || "快乐8", helper: `选择 ${clampInt(state.manualPlayMode, 1, 10)} 个`, min: 1, max: 80, count: clampInt(state.manualPlayMode, 1, 10), tone: "k8orange" }
    ];
    if (gameKey === "qlc") return [
      { key: "nums7", label: "基本号", helper: "选择 7 个", min: 1, max: 30, count: 7, tone: "yellow" }
    ];
    if (gameKey === "fc3d" || gameKey === "pl3") {
      if (state.manualPlayMode === "group3") {
        return [{ key: "nums3", label: "组三号码", helper: "选择 2 个数字，第一个作为重号", min: 0, max: 9, count: 2, tone: gameKey === "fc3d" ? "fc3d" : "plum" }];
      }
      if (state.manualPlayMode === "group6") {
        return [{ key: "nums3", label: "组六号码", helper: "选择 3 个不同数字", min: 0, max: 9, count: 3, tone: gameKey === "fc3d" ? "fc3d" : "plum" }];
      }
      return ["百位", "十位", "个位"].map((label, index) => ({ key: `pos${index}`, label, helper: "选择 1 个", min: 0, max: 9, count: 1, positional: true, tone: gameKey === "fc3d" ? "fc3d" : "plum" }));
    }
    if (gameKey === "pl5") {
      return ["万位", "千位", "百位", "十位", "个位"].map((label, index) => ({ key: `pos${index}`, label, helper: "选择 1 个", min: 0, max: 9, count: 1, positional: true, tone: "plum" }));
    }
    if (gameKey === "qxc") {
      return [
        ...["第一位", "第二位", "第三位", "第四位", "第五位", "第六位"].map((label, index) => ({ key: `pos${index}`, label, helper: "选择 1 个", min: 0, max: 9, count: 1, positional: true, tone: "indigo" })),
        { key: "tail", label: "特别号", helper: "选择 1 个（0–14）", min: 0, max: 14, count: 1, positional: true, tone: "amber" }
      ];
    }
    return [];
  }

  function renderManualPicker() {
    if (!els.manualPicker) return;
    const sections = getManualSections();
    const selectedCount = sections.reduce((sum, section) => sum + (state.manualSelection[section.key]?.length || 0), 0);
    const requiredCount = sections.reduce((sum, section) => sum + section.count, 0);
    if (els.manualPickerHint) els.manualPickerHint.textContent = `已选 ${selectedCount}/${requiredCount} · ${GAME_CONFIGS[state.manualGameKey]?.label || ""}`;
    els.manualPicker.innerHTML = sections.map((section) => {
      const selected = state.manualSelection[section.key] || [];
      const balls = Array.from({ length: section.max - section.min + 1 }, (_, index) => section.min + index).map((number) => {
        const active = selected.includes(number);
        return `<button class="manual-ball is-${section.tone}${active ? " is-selected" : ""}" type="button" data-manual-section="${section.key}" data-manual-number="${number}" aria-pressed="${active}">${pad(number, section.max <= 14 && section.min === 0 ? 1 : 2)}</button>`;
      }).join("");
      return `<section class="manual-section"><div class="manual-section-head"><strong>${section.label}</strong><span>${section.helper}</span></div><div class="manual-ball-grid${section.positional ? " is-positional" : ""}">${balls}</div></section>`;
    }).join("");
    els.manualPicker.querySelectorAll("[data-manual-section]").forEach((btn) => btn.addEventListener("click", () => {
      const section = sections.find((item) => item.key === btn.dataset.manualSection);
      if (!section) return;
      const number = Number(btn.dataset.manualNumber);
      const values = (state.manualSelection[section.key] || []).slice();
      const existing = values.indexOf(number);
      if (existing >= 0 && !section.positional) values.splice(existing, 1);
      else if (section.positional || section.count === 1) values.splice(0, values.length, number);
      else if (values.length < section.count) values.push(number);
      else {
        toast(`${section.label}最多选择 ${section.count} 个`);
        return;
      }
      state.manualSelection[section.key] = values;
      renderManualPicker();
    }));
    if (els.manualAddLineBtn) els.manualAddLineBtn.disabled = !isManualSelectionComplete();
  }

  function isManualSelectionComplete() {
    return getManualSections().every((section) => (state.manualSelection[section.key] || []).length === section.count);
  }

  function buildManualTicket() {
    if (!isManualSelectionComplete()) return null;
    const value = (key) => (state.manualSelection[key] || []).slice().sort((a, b) => a - b);
    const ordered = (count) => Array.from({ length: count }, (_, index) => (state.manualSelection[`pos${index}`] || [])[0]);
    if (state.manualGameKey === "ssq") return { red: value("red"), blue: value("blue") };
    if (state.manualGameKey === "dlt") return { front: value("front"), back: value("back"), playMode: state.manualPlayMode, addOn: state.manualPlayMode === "add" };
    if (state.manualGameKey === "k8") return { nums: value("nums"), playCount: clampInt(state.manualPlayMode, 1, 10), playMode: state.manualPlayMode };
    if (state.manualGameKey === "qlc") return { nums7: value("nums7") };
    if (state.manualGameKey === "fc3d" || state.manualGameKey === "pl3") {
      if (state.manualPlayMode === "group3") {
        const nums = state.manualSelection.nums3.slice();
        return { nums3: [nums[0], nums[0], nums[1]], playMode: "group3" };
      }
      if (state.manualPlayMode === "group6") return { nums3: value("nums3"), playMode: "group6" };
      return { nums3: ordered(3), playMode: "single" };
    }
    if (state.manualGameKey === "pl5") return { nums5: ordered(5) };
    if (state.manualGameKey === "qxc") return { nums6: ordered(6), tail: (state.manualSelection.tail || [0])[0] };
    return null;
  }

  function renderManualDraft() {
    if (!els.manualDraftList) return;
    const count = state.manualTickets.length;
    const price = (GAME_CONFIGS[state.manualGameKey]?.price || 2) + (state.manualGameKey === "dlt" && state.manualPlayMode === "add" ? 1 : 0);
    const total = count * state.manualMultiple * price;
    if (els.manualMultipleText) els.manualMultipleText.textContent = `${state.manualMultiple}倍`;
    if (els.manualDraftSummary) els.manualDraftSummary.textContent = count ? `${count} 注 · ${formatMoney(total)}` : "暂无号码";
    if (!count) {
      els.manualDraftList.className = "ticket-list empty-state";
      els.manualDraftList.textContent = "请先完成一注号码";
    } else {
      els.manualDraftList.className = "ticket-list";
      els.manualDraftList.innerHTML = state.manualTickets.map((ticket, index) => `
        <article class="ticket-card random-ticket-${state.manualGameKey}">
          <div class="ticket-head"><div class="ticket-head-left"><span class="ticket-no">第 ${index + 1} 注</span><span class="ticket-meta-inline">${GAME_CONFIGS[state.manualGameKey].label} · ${formatPlayMode(ticket.playMode || state.manualPlayMode) || "普通"}</span></div><button class="delete-btn" type="button" data-manual-delete="${index}">删除</button></div>
          ${renderTicketBalls(state.manualGameKey, ticket)}
        </article>
      `).join("");
      els.manualDraftList.querySelectorAll("[data-manual-delete]").forEach((btn) => btn.addEventListener("click", () => {
        state.manualTickets.splice(Number(btn.dataset.manualDelete), 1);
        renderManualDraft();
      }));
    }
    if (els.manualSaveBtn) els.manualSaveBtn.disabled = !count;
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
    els.ticketScanBody.scrollTop = 0;
    window.setTimeout(() => els.ticketScanBody.querySelector("[data-scan-choose]")?.focus(), 20);
  }

  function closeTicketScan() {
    if (!els.ticketScan || state.ticketScanBusy) return;
    els.ticketScan.hidden = true;
    document.body.classList.remove("scan-open");
    state.ticketScanResult = null;
    state.ticketScanPreview = "";
    state.ticketScanAddDraft = null;
    els.ticketScan.classList.remove("is-picking");
    if (els.ticketScanOverlay) els.ticketScanOverlay.innerHTML = "";
    if (els.ticketScanInput) els.ticketScanInput.value = "";
  }

  function renderTicketScanIntro(errorText = "") {
    if (!els.ticketScanBody) return;
    els.ticketScan.classList.remove("is-picking");
    if (els.ticketScanOverlay) els.ticketScanOverlay.innerHTML = "";
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
    /* 从“添加到票夹”直接选相册时，选中后再切换到识别界面。 */
    if (els.ticketScan?.hidden) {
      closeTicketAdd();
      openTicketScan();
    }
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
    els.ticketScan.classList.remove("is-picking");
    if (els.ticketScanOverlay) els.ticketScanOverlay.innerHTML = "";
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
      <form class="scan-review${state.ticketScanAddDraft ? " is-picking" : ""}" id="ticketScanForm">
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
        ${renderScanValidationMessages(result)}
        <div class="scan-cost-check"><span>${result.tickets.length}注 · 按号码计算</span><strong>${formatMoney(result.calculatedAmount)}</strong></div>
        <div class="scan-review-actions">
          <button class="scan-secondary-btn" type="button" data-scan-again>重新选择</button>
          <button class="scan-primary-btn" type="submit"${canImportScanResult(result) ? "" : " disabled"}>确认导入 ${result.tickets.length} 注</button>
        </div>
      </form>
    `;
    els.ticketScan.classList.toggle("is-picking", Boolean(state.ticketScanAddDraft));
    if (els.ticketScanOverlay) {
      els.ticketScanOverlay.innerHTML = state.ticketScanAddDraft
        ? renderScanBallPicker(result.gameKey, state.ticketScanAddDraft)
        : "";
    }
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
      <section class="scan-ball-sheet" role="dialog" aria-modal="true" aria-labelledby="scanBallPickerTitle">
        <div class="scan-ball-sheet-handle" aria-hidden="true"></div>
        <div class="scan-ball-picker">
          <div class="scan-ball-picker-head"><strong id="scanBallPickerTitle">手动新增一注</strong><span data-scan-pick-count>已选 ${draft.main.length + draft.extra.length}/${config.mainCount + config.extraCount}</span></div>
          <div class="scan-ball-sheet-scroll">
            <div class="scan-pick-section"><div><strong>${config.mainLabel}</strong><span>选择 ${config.mainCount} 个</span></div><div class="scan-pick-grid">${group("main", config.mainMax, draft.main, config.mainTone)}</div></div>
            <div class="scan-pick-section"><div><strong>${config.extraLabel}</strong><span>选择 ${config.extraCount} 个</span></div><div class="scan-pick-grid">${group("extra", config.extraMax, draft.extra, config.extraTone)}</div></div>
          </div>
          <div class="scan-ball-picker-actions"><button type="button" data-scan-pick-cancel>取消</button><button class="is-confirm" type="button" data-scan-pick-confirm${ready ? "" : " disabled"}>确定新增</button></div>
        </div>
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
    const pickerRoot = els.ticketScanOverlay || form;
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
      if (els.ticketScanBody) els.ticketScanBody.scrollTop = 0;
      requestAnimationFrame(() => els.ticketScan?.querySelector("[data-scan-pick-zone]")?.focus({ preventScroll: true }));
    });
    pickerRoot.querySelectorAll("[data-scan-pick-zone]").forEach((btn) => btn.addEventListener("click", () => {
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
      pickerRoot.querySelectorAll(`[data-scan-pick-zone="${zone}"]`).forEach((ball) => {
        const selected = draft[zone].includes(Number(ball.dataset.scanPickNumber));
        ball.classList.toggle("is-selected", selected);
        ball.setAttribute("aria-pressed", String(selected));
      });
      const selectedCount = draft.main.length + draft.extra.length;
      const requiredCount = config.mainCount + config.extraCount;
      const countLabel = pickerRoot.querySelector("[data-scan-pick-count]");
      if (countLabel) countLabel.textContent = `已选 ${selectedCount}/${requiredCount}`;
      const confirm = pickerRoot.querySelector("[data-scan-pick-confirm]");
      if (confirm) confirm.disabled = draft.main.length !== config.mainCount || draft.extra.length !== config.extraCount;
    }));
    pickerRoot.querySelector("[data-scan-pick-cancel]")?.addEventListener("click", () => {
      state.ticketScanResult = readTicketScanForm(form);
      state.ticketScanAddDraft = null;
      renderTicketScanReview();
      requestAnimationFrame(() => els.ticketScanBody?.querySelector("[data-scan-add]")?.focus());
    });
    pickerRoot.querySelector("[data-scan-pick-confirm]")?.addEventListener("click", () => {
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
      requestAnimationFrame(() => els.ticketScanBody?.querySelector(`[data-scan-ticket="${result.tickets.length - 1}"]`)?.scrollIntoView({ block: "nearest" }));
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
    switchView("check");
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
      const value = series.netTotal || 0;
      els.profitNetValue.textContent = `${value > 0 ? "+" : ""}${formatCompactMoney(value)}`;
      els.profitNetValue.className = `profit-net-value ${value > 0 ? "is-positive" : value < 0 ? "is-negative" : "is-neutral"}`;
    }
    if (!series.days.length) {
      els.profitChartWrap.innerHTML = `
        <div class="profit-empty empty-cta" id="profitEmpty">
          <div>暂无完整开奖记录</div>
          <button class="mini-blue has-icon" type="button" data-empty-add-ticket>
            <svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>
            <span>扫描彩票</span>
          </button>
        </div>
      `;
      els.profitChartWrap.querySelector("[data-empty-add-ticket]")?.addEventListener("click", openTicketScan);
      return;
    }
    els.profitChartWrap.innerHTML = buildProfitChartSvg(series);
    bindProfitChartInteractions(series);
  }

  function buildDailyProfitSeries(records, range = "all") {
    let settled = (records || [])
      .filter((r) => r && (r.status === "won" || r.status === "lost") && r.createdAt)
      .slice()
      .sort((a, b) => {
        const dateCompare = getRecordProfitDate(a).localeCompare(getRecordProfitDate(b));
        return dateCompare || String(a.createdAt).localeCompare(String(b.createdAt));
      });

    if (range === "month") {
      const monthKey = getMonthKey(new Date());
      settled = settled.filter((record) => getRecordProfitDate(record).startsWith(monthKey));
    }

    const dayMap = new Map();
    settled.forEach((record) => {
      const date = getRecordProfitDate(record);
      if (!dayMap.has(date)) dayMap.set(date, []);
      dayMap.get(date).push(record);
    });
    const availableDates = Array.from(dayMap.keys()).sort();
    if (!availableDates.length) {
      return { days: [], costTotal: 0, prizeTotal: 0, netTotal: 0, openingBalance: 0, closingBalance: 0, rangeLabel: range === "all" ? "全部记录" : range === "month" ? "本月" : `最近${range}天` };
    }

    const endDate = availableDates[availableDates.length - 1];
    let startDate = availableDates[0];
    if (range === "month") {
      const now = new Date();
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    } else if (range !== "all") {
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
    const chartDays = range === "all" && days.length
      ? [{
          date: formatDate(new Date(days[0].t - 86400000)),
          t: days[0].t - 86400000,
          open: 0,
          close: 0,
          high: 0,
          low: 0,
          cost: 0,
          prize: 0,
          net: 0,
          count: 0,
          wonCount: 0,
          winRate: 0,
          games: [],
          isBaseline: true
        }, ...days]
      : days;
    return {
      days: chartDays,
      costTotal,
      prizeTotal,
      netTotal: prizeTotal - costTotal,
      openingBalance,
      closingBalance: balance,
      rangeLabel: range === "all" ? "全部记录" : range === "month" ? "本月" : `最近${range}天`
    };
  }

  function getRecordProfitDate(record) {
    const value = record.targetOpenDate || record.openDate || record.createdAt;
    const normalized = normalizeDate(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : formatDate(value);
  }

  function buildProfitChartSvg(series) {
    const W = 320, H = 168;
    const padL = 10, padR = 10, padT = 20, padB = 22;
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
    const areaColor = days[days.length - 1].close > days[0].close ? GREEN : RED;
    const areaLine = days.map((day, index) => `${index ? "L" : "M"} ${xOf(index).toFixed(1)} ${yOf(day.close).toFixed(1)}`).join(" ");
    const areaPath = `${areaLine} L ${xOf(days.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xOf(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

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
    const minIndex = days.reduce((best, day, index) => day.close < days[best].close ? index : best, 0);
    const maxIndex = days.reduce((best, day, index) => day.close > days[best].close ? index : best, 0);
    const extremeLabel = (index, kind) => {
      const value = days[index].close;
      const x = xOf(index);
      const pointY = yOf(value);
      const preferAbove = kind === "max";
      const canPlaceAbove = pointY - 16 >= 10;
      const canPlaceBelow = pointY + 19 <= H - padB - 2;
      const placeAbove = preferAbove ? canPlaceAbove : !canPlaceBelow && canPlaceAbove;
      const labelY = pointY + (placeAbove ? -13 : 18);
      const tone = value > 0 ? "is-positive" : value < 0 ? "is-negative" : "is-neutral";
      const amount = `${value > 0 ? "+" : ""}${formatChartTick(value)}元`;
      const anchor = x < 34 ? "start" : x > W - 34 ? "end" : "middle";
      return `<g class="profit-extreme ${tone}"><circle class="profit-extreme-dot" cx="${x.toFixed(1)}" cy="${pointY.toFixed(1)}" r="2.8"/><text class="profit-extreme-label" x="${x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}">${amount}</text></g>`;
    };
    const extremes = minIndex === maxIndex
      ? extremeLabel(minIndex, "min")
      : `${extremeLabel(maxIndex, "max")}${extremeLabel(minIndex, "min")}`;

    return `
      <svg class="profit-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="累计盈亏折线图">
        <defs>
          ${gradients}
          <linearGradient id="profit-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${areaColor}" stop-opacity=".16"/>
            <stop offset="100%" stop-color="${areaColor}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}
        ${zeroLine}
        <path class="profit-area-fill" d="${areaPath}"/>
        ${lineSegments}
        ${singlePoint}
        ${points}
        ${extremes}
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

  /* ===== 月度统计日历 ===== */

  function openMonthlyStatsView() {
    const now = new Date();
    state.statsYear = now.getFullYear();
    state.statsMonth = String(now.getMonth() + 1);
    switchView("monthly");
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function buildPeriodStats(year, month = "all") {
    const monthKey = month === "all"
      ? `${year}-`
      : `${year}-${String(month).padStart(2, "0")}`;
    const records = state.records.filter((record) => {
      if (!record || !["won", "lost", "prize_float"].includes(record.status)) return false;
      return getRecordProfitDate(record).startsWith(monthKey);
    });
    const days = new Map();
    const games = new Map();
    records.forEach((record) => {
      const date = getRecordProfitDate(record);
      const cost = Number(record.price || 0) * Number(record.multiple || 1);
      const prize = Number(record.prizeAmount || 0);
      if (!days.has(date)) days.set(date, { date, cost: 0, prize: 0, net: 0, count: 0, wonCount: 0 });
      const day = days.get(date);
      day.cost += cost;
      day.prize += prize;
      day.net += prize - cost;
      day.count += 1;
      if (record.status === "won" || record.status === "prize_float") day.wonCount += 1;
      const gameKey = record.gameKey || "unknown";
      if (!games.has(gameKey)) games.set(gameKey, { gameKey, cost: 0, prize: 0, count: 0 });
      const game = games.get(gameKey);
      game.cost += cost;
      game.prize += prize;
      game.count += 1;
    });
    const totalCost = records.reduce((sum, record) => sum + Number(record.price || 0) * Number(record.multiple || 1), 0);
    const totalPrize = records.reduce((sum, record) => sum + Number(record.prizeAmount || 0), 0);
    const pendingCount = state.records.filter((record) => (record.status === "pending" || !record.status) && getRecordProfitDate(record).startsWith(monthKey)).length;
    return { year, month, monthKey, records, days, games: Array.from(games.values()).sort((a, b) => b.cost - a.cost), totalCost, totalPrize, net: totalPrize - totalCost, pendingCount };
  }

  function buildMonthStats(cursor) {
    return buildPeriodStats(cursor.getFullYear(), String(cursor.getMonth() + 1));
  }

  function renderStatsSelectors() {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear, state.statsYear]);
    state.records.forEach((record) => {
      const year = Number(getRecordProfitDate(record).slice(0, 4));
      if (year >= 2000 && year <= currentYear + 1) years.add(year);
    });
    if (els.statsYearSelect) {
      els.statsYearSelect.innerHTML = Array.from(years).sort((a, b) => b - a).map((year) => `<option value="${year}">${year}年</option>`).join("");
      els.statsYearSelect.value = String(state.statsYear);
    }
    if (els.statsMonthSelect) {
      els.statsMonthSelect.innerHTML = `<option value="all">全年</option>${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}">${index + 1}月</option>`).join("")}`;
      els.statsMonthSelect.value = String(state.statsMonth);
    }
  }

  function renderMonthlyStats() {
    if (!els.monthlyCalendar) return;
    renderStatsSelectors();
    const stats = buildPeriodStats(state.statsYear, state.statsMonth);
    const periodText = state.statsMonth === "all" ? `${state.statsYear}年` : `${state.statsYear}年${state.statsMonth}月`;
    if (els.monthlySummary) els.monthlySummary.textContent = `${periodText} · ${stats.records.length} 注已核对${stats.pendingCount ? ` · ${stats.pendingCount} 注待核对` : ""}`;
    if (els.monthlyKpis) {
      const netClass = stats.net > 0 ? "is-positive" : stats.net < 0 ? "is-negative" : "";
      const wonDays = Array.from(stats.days.values()).filter((day) => day.net > 0).length;
      els.monthlyKpis.innerHTML = `
        <article class="monthly-kpi"><span>期间花费</span><strong>${formatCompactMoney(stats.totalCost)}</strong></article>
        <article class="monthly-kpi"><span>期间中奖</span><strong>${formatCompactMoney(stats.totalPrize)}</strong></article>
        <article class="monthly-kpi"><span>期间盈亏</span><strong class="${netClass}">${stats.net > 0 ? "+" : ""}${formatCompactMoney(stats.net)}</strong></article>
        <article class="monthly-kpi"><span>盈利天数</span><strong>${wonDays}天</strong></article>
      `;
    }
    renderMonthlyCalendar(state.statsYear, state.statsMonth, stats);
    renderMonthlyGameChart(stats);
    renderMonthlyCompareChart(state.statsYear, state.statsMonth);
  }

  function renderMonthlyCalendar(year, selectedMonth, stats) {
    if (selectedMonth === "all") {
      if (els.monthlyCalendarHint) els.monthlyCalendarHint.textContent = "选择具体月份后显示";
      els.monthlyCalendar.innerHTML = `<div class="monthly-calendar-empty">请选择上方月份，查看每天的花费、中奖与盈亏。</div>`;
      return;
    }
    const month = Number(selectedMonth) - 1;
    if (els.monthlyCalendarHint) els.monthlyCalendarHint.textContent = `${year}年${month + 1}月`;
    const dayCount = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const cells = Array.from({ length: firstWeekday }, () => `<div class="monthly-day is-empty" aria-hidden="true"></div>`);
    for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
      const data = stats.days.get(date);
      const tone = data ? data.net > 0 ? "is-win" : data.net < 0 ? "is-loss" : "" : "";
      const netText = data ? `${data.net > 0 ? "+" : ""}${formatChartTick(data.net)}` : "";
      const aria = data ? `${date}，花费${formatMoney(data.cost)}，中奖${formatMoney(data.prize)}，盈亏${formatMoney(data.net)}` : `${date}，无已开奖记录`;
      const prizeText = data?.prize > 0 ? `<span class="monthly-day-prize">中${formatChartTick(data.prize)}</span>` : "";
      cells.push(`<div class="monthly-day${data ? " has-data" : ""} ${tone}" aria-label="${aria}"><span class="monthly-day-number">${dayNumber}</span><span class="monthly-day-net">${netText}</span>${prizeText}</div>`);
    }
    els.monthlyCalendar.innerHTML = cells.join("");
  }

  function renderMonthlyGameChart(stats) {
    if (!els.monthlyGameChart) return;
    const games = stats.games.filter((game) => game.cost > 0);
    if (!games.length || !stats.totalCost) {
      els.monthlyGameChart.innerHTML = `<div class="monthly-chart-empty">当前期间暂无已核对记录</div>`;
      return;
    }
    const circumference = 2 * Math.PI * 42;
    let offset = 0;
    const segments = games.map((game) => {
      const share = game.cost / stats.totalCost;
      const dash = share * circumference;
      const node = `<circle class="monthly-donut-segment" cx="56" cy="56" r="42" stroke="${GAME_CHART_COLORS[game.gameKey] || "#94a3b8"}" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
      offset += dash;
      return node;
    }).join("");
    const legend = games.map((game) => `
      <div class="monthly-legend-item"><span class="monthly-legend-dot" style="background:${GAME_CHART_COLORS[game.gameKey] || "#94a3b8"}"></span><span>${GAME_CONFIGS[game.gameKey]?.label || game.gameKey}</span><strong>${Math.round((game.cost / stats.totalCost) * 100)}%</strong></div>
    `).join("");
    els.monthlyGameChart.innerHTML = `<div class="monthly-donut-wrap"><svg class="monthly-donut" viewBox="0 0 112 112" role="img" aria-label="各彩种花费占比"><circle class="monthly-donut-track" cx="56" cy="56" r="42"/>${segments}</svg><div class="monthly-legend">${legend}</div></div>`;
  }

  function renderMonthlyCompareChart(year, selectedMonth = "all") {
    if (!els.monthlyCompareChart) return;
    const months = Array.from({ length: 12 }, (_, index) => buildPeriodStats(year, String(index + 1)));
    const maxCost = Math.max(1, ...months.map((month) => month.totalCost));
    const yearGames = buildPeriodStats(year, "all").games.filter((game) => game.cost > 0);
    if (!yearGames.length) {
      els.monthlyCompareChart.innerHTML = `<div class="monthly-chart-empty">${year}年暂无已核对记录</div>`;
      return;
    }
    const bars = months.map((month, index) => {
      const segments = month.games.filter((game) => game.cost > 0).map((game) => {
        const height = (game.cost / maxCost) * 100;
        return `<span class="month-stack-segment" style="height:${height.toFixed(2)}%;background:${GAME_CHART_COLORS[game.gameKey] || "#94a3b8"}" title="${GAME_CONFIGS[game.gameKey]?.label || game.gameKey} ${formatMoney(game.cost)}"></span>`;
      }).join("");
      const active = String(index + 1) === String(selectedMonth);
      return `<button class="month-stack-item${active ? " is-active" : ""}" type="button" data-month-stack="${index + 1}" aria-label="${year}年${index + 1}月，花费${formatMoney(month.totalCost)}，中奖${formatMoney(month.totalPrize)}，点击查看各彩种明细"><span class="month-stack-total">${month.totalCost ? formatChartTick(month.totalCost) : ""}</span><span class="month-stack-track">${segments}</span><span class="month-stack-label">${index + 1}</span></button>`;
    }).join("");
    const legend = yearGames.map((game) => `<span><i style="background:${GAME_CHART_COLORS[game.gameKey] || "#94a3b8"}"></i>${GAME_CONFIGS[game.gameKey]?.label || game.gameKey}</span>`).join("");
    els.monthlyCompareChart.innerHTML = `<div class="month-stack-chart">${bars}</div><div class="month-stack-legend">${legend}</div>`;
    els.monthlyCompareChart.querySelectorAll("[data-month-stack]").forEach((button) => {
      button.addEventListener("click", () => openMonthStackDetails(year, button.dataset.monthStack));
    });
  }

  function openMonthStackDetails(year, month) {
    if (!els.detailSheet || !els.detailSheetBody) return;
    const stats = buildPeriodStats(year, String(month));
    els.detailSheet.classList.remove("is-fullscreen");
    els.detailSheetTitle.textContent = `${year}年${month}月`;
    els.detailSheetSub.textContent = `花费 ${formatMoney(stats.totalCost)} · 中奖 ${formatMoney(stats.totalPrize)} · 盈亏 ${stats.net > 0 ? "+" : ""}${formatMoney(stats.net)}`;
    els.detailSheetBody.innerHTML = stats.games.length
      ? `<div class="month-game-detail-list">${stats.games.map((game) => {
          const net = game.prize - game.cost;
          return `
            <article class="month-game-detail" style="--detail-color:${GAME_CHART_COLORS[game.gameKey] || "#94a3b8"}">
              <span class="month-game-detail-dot"></span>
              <div><strong>${GAME_CONFIGS[game.gameKey]?.label || game.gameKey}</strong><small>${game.count} 注</small></div>
              <div><span>花费</span><strong>${formatCompactMoney(game.cost)}</strong></div>
              <div><span>中奖</span><strong>${formatCompactMoney(game.prize)}</strong></div>
              <div><span>盈亏</span><strong class="${net > 0 ? "is-positive" : net < 0 ? "is-negative" : ""}">${net > 0 ? "+" : ""}${formatCompactMoney(net)}</strong></div>
            </article>
          `;
        }).join("")}</div>`
      : `<div class="empty-state">这个月暂无已核对记录</div>`;
    els.detailSheet.hidden = false;
    document.body.classList.add("sheet-open");
    els.detailSheetBody.scrollTop = 0;
    window.setTimeout(() => els.detailSheetCloseBtn?.focus(), 20);
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
      return { ...record, status: "pending", resultText: "待核对" };
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
    const calendar = getCalendarEntry(gameKey);
    if (!latest && !calendar) {
      return null;
    }
    return {
      latest,
      expect: String(calendar?.next_issue || latest?.nextExpect || ""),
      openDate: String(calendar?.next_draw_date || latest?.nextOpenDate || normalizeDate(calendar?.next_open_time || latest?.nextOpenTime) || ""),
      openTime: String(calendar?.next_open_time || latest?.nextOpenTime || ""),
      buyEndTime: String(calendar?.next_buy_end_time || latest?.nextBuyEndTime || ""),
      status: String(calendar?.next_status || latest?.nextStatus || "unavailable"),
      source: String(calendar?.next_source || latest?.nextSource || "none"),
      confirmed: calendar ? calendar.next_confirmed !== false : latest?.nextConfirmed !== false,
      basisIssue: String(calendar?.next_basis_issue || latest?.nextBasisIssue || latest?.expect || ""),
      resolutionReason: String(calendar?.next_resolution_reason || latest?.nextResolutionReason || ""),
      sourceDrawId: latest?.id || ""
    };
  }

  function getNextDrawTarget(gameKey) {
    const metadata = getNextDrawMetadata(gameKey);
    if (!metadata) {
      return { available: false, status: "unavailable", message: "暂无下期开奖数据，请稍后刷新" };
    }
    const { expect, openTime, buyEndTime } = metadata;
    if (!expect || !openTime || !buyEndTime) {
      return { ...metadata, available: false, message: "开奖仓库尚未生成下期预测，请稍后刷新" };
    }

    const now = new Date();
    const openDateValue = parseApiDate(openTime);
    const buyEndDateValue = parseApiDate(buyEndTime);
    if (!openDateValue || !buyEndDateValue) {
      return { ...metadata, available: false, message: "下期时间格式异常，请稍后刷新" };
    }
    if (now >= openDateValue) {
      return { ...metadata, available: false, message: "当期开奖号码尚未更新，请稍后再试" };
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

  function renderDrawBalls(gameKey, drawValues, options = {}) {
    const config = GAME_CONFIGS[gameKey];
    const sections = config.drawSections || config.sections;
    let i = 0;
    let hiddenCount = 0;
    const content = sections.map((section) => {
      const values = getDrawSectionValues(gameKey, drawValues, section.key);
      const visibleValues = options.compactK8 && gameKey === "k8" ? values.slice(0, 7) : values;
      hiddenCount += Math.max(0, values.length - visibleValues.length);
      return visibleValues.map((value) => ball(value, section.color, false, section.key, false, i++)).join("");
    }).join("");
    const more = hiddenCount ? `<span class="draw-ball-more" aria-label="另有 ${hiddenCount} 个号码">•••</span>` : "";
    return `<div class="balls">${content}${more}</div>`;
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
    if (!window.LotteryPrizeRules?.evaluateTicket) throw new Error("中奖规则模块未加载");
    return window.LotteryPrizeRules.evaluateTicket(gameKey, ticket, draw, multiple, drawMeta, record);
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
    let normalized = text;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) normalized = `${text}T00:00:00+08:00`;
    else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(text)) normalized = `${text.replace(" ", "T")}${text.length === 16 ? ":00" : ""}+08:00`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
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
