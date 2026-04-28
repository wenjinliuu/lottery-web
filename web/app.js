(function () {
  "use strict";

  const GAME_ROWS = [
    ["ssq", "dlt"],
    ["k8", "fc3d", "pl3"],
    ["qlc", "qxc", "pl5"]
  ];
  const GAME_ORDER = GAME_ROWS.flat();
  const COUNT_GAMES = new Set(["ssq", "dlt", "pl3", "pl5", "qxc", "qlc"]);
  const COUNT_OPTIONS = [1, 5, 10];
  const DEFAULT_VISIBLE_DRAWS = new Set(["ssq", "dlt"]);
  const GAME_CONFIGS = {
    ssq: { label: "双色球", accent: "red", price: 2, sections: [{ key: "red", label: "红球", count: 6, color: "red" }, { key: "blue", label: "蓝球", count: 1, color: "blue" }] },
    qlc: { label: "七乐彩", accent: "yellow", price: 2, sections: [{ key: "nums7", label: "基本号", count: 7, color: "yellow" }], drawSections: [{ key: "nums7", label: "基本号", count: 7, color: "yellow" }, { key: "special", label: "特别号", count: 1, color: "k8orange" }] },
    fc3d: { label: "福彩3D", accent: "fc3d", price: 2, playModes: digitModes(), sections: [{ key: "nums3", label: "号码", count: 3, color: "fc3d" }] },
    dlt: { label: "大乐透", accent: "blue", price: 2, sections: [{ key: "front", label: "前区", count: 5, color: "blue" }, { key: "back", label: "后区", count: 2, color: "yellow" }] },
    qxc: { label: "七星彩", accent: "indigo", price: 2, sections: [{ key: "nums6", label: "前六位", count: 6, color: "indigo" }, { key: "tail", label: "特别号", count: 1, color: "amber" }] },
    pl3: { label: "排列3", accent: "plum", price: 2, playModes: digitModes(), sections: [{ key: "nums3", label: "号码", count: 3, color: "plum" }] },
    pl5: { label: "排列5", tabLabel: "PL5", accent: "plum", price: 2, sections: [{ key: "nums5", label: "号码", count: 5, color: "plum" }] },
    k8: { label: "快乐8", accent: "k8orange", price: 2, playModes: Array.from({ length: 10 }, (_, i) => ({ key: String(i + 1), label: `选${["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][i]}` })), sections: [{ key: "nums", label: "号码", count: 20, color: "k8orange" }] }
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

  const state = {
    gameKey: "ssq",
    playMode: "single",
    draftTickets: [],
    draws: [],
    records: [],
    activeView: "random",
    showAllDraws: false
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    initControls();
    bindEvents();
    await loadDraws();
    await loadRecords();
    randomizeTickets();
  }

  function cacheElements() {
    [
      "gameSelect", "playModeField", "playModeSelect", "countCard", "countTabs", "countInput", "multipleInput", "priceInput",
      "randomBtn", "saveBtn", "copyBtn", "clearDraftBtn", "draftSummary", "draftList",
      "latestDraws", "reloadDrawsBtn", "recordList", "checkRecordsBtn", "clearRecordsBtn",
      "historyList", "historySummary", "exportBackupBtn", "importBackupInput", "gameTabs",
      "playModeTabs", "todayTitle", "weekTitle", "heroTitle", "decreaseMultiplierBtn",
      "increaseMultiplierBtn", "multiplierText", "toggleDrawsBtn",
      "mineRecordCount", "minePendingCount", "toast"
    ].forEach((id) => { els[id] = document.getElementById(id); });
  }

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
      state.draftTickets = [];
      renderPlayModeTabs();
      renderAll();
    });
    els.randomBtn.addEventListener("click", randomizeTickets);
    els.saveBtn.addEventListener("click", saveDraftRecords);
    els.copyBtn.addEventListener("click", copyDraftText);
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
    els.clearRecordsBtn.addEventListener("click", clearRecords);
    els.exportBackupBtn.addEventListener("click", exportBackup);
    els.importBackupInput.addEventListener("change", importBackup);
  }

  function syncPlayModeOptions() {
    const config = GAME_CONFIGS[state.gameKey];
    const modes = config.playModes || [];
    els.playModeField.hidden = modes.length === 0;
    els.playModeSelect.innerHTML = modes.map((mode) => `<option value="${mode.key}">${mode.label}</option>`).join("");
    state.playMode = modes[0] ? modes[0].key : "";
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
    els.countTabs.innerHTML = COUNT_OPTIONS.map((count) => `
      <button class="segment-btn ${Number(els.countInput.value) === count ? "segment-btn-active" : ""}" type="button" data-count="${count}">${count}</button>
    `).join("");
    els.countTabs.querySelectorAll("[data-count]").forEach((btn) => {
      btn.addEventListener("click", () => {
        els.countInput.value = btn.dataset.count;
        renderCountTabs();
        randomizeTickets();
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
    els.playModeTabs.innerHTML = modes.map((mode) => `
      <button class="segment-btn ${mode.key === state.playMode ? "segment-btn-active" : ""}" type="button" data-play="${mode.key}">${mode.label}</button>
    `).join("");
    els.playModeTabs.classList.toggle("play-row-k8", state.gameKey === "k8");
    els.playModeTabs.querySelectorAll("[data-play]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.playMode = btn.dataset.play;
        els.playModeSelect.value = state.playMode;
        state.draftTickets = [];
        renderPlayModeTabs();
        renderAll();
      });
    });
  }

  function switchView(view) {
    state.activeView = view;
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== view;
    });
    document.querySelectorAll("[data-view]").forEach((btn) => {
      btn.classList.toggle("dock-item-active", btn.dataset.view === view);
    });
    renderHero();
  }

  function renderHero() {
    const now = new Date();
    const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()];
    els.todayTitle.textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
    els.weekTitle.textContent = `${week} / 本地网页`;
    const titleMap = {
      random: `${GAME_CONFIGS[state.gameKey].label} 选号`,
      check: "开奖兑奖",
      history: "往期开奖",
      mine: "我的账户"
    };
    els.heroTitle.textContent = titleMap[state.activeView] || "彩票号码备忘";
  }

  function syncDefaultPrice() {
    const config = GAME_CONFIGS[state.gameKey];
    els.priceInput.value = String(config.price || 2);
    els.countInput.value = "1";
    els.multipleInput.value = "1";
    renderMultiplier();
  }

  async function loadDraws(showToast = false) {
    try {
      const response = await fetch(`./data/lottery_draws.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.draws = Array.isArray(payload.draws) ? payload.draws : [];
      els.historySummary.textContent = payload.updatedAt ? `更新于 ${formatDateTime(payload.updatedAt)}` : "暂无自动开奖数据";
      renderDraws();
      if (showToast) toast("开奖数据已刷新");
    } catch (error) {
      state.draws = [];
      renderDraws();
      if (showToast) toast("读取开奖 JSON 失败");
    }
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

  async function saveDraftRecords() {
    if (!state.draftTickets.length) {
      toast("请先生成号码");
      return;
    }

    const now = new Date().toISOString();
    const multiple = clampInt(els.multipleInput.value, 1, 99);
    const price = Math.max(0, Number(els.priceInput.value || 0));
    const batchId = `batch_${compactDate(now)}_${randomId()}`;
    const records = state.draftTickets.map((ticket, index) => {
      return {
        id: `${batchId}_${String(index + 1).padStart(3, "0")}`,
        batchId,
        gameKey: state.gameKey,
        gameName: GAME_CONFIGS[state.gameKey].label,
        playMode: ticket.playMode || state.playMode || "",
        expect: "",
        openDate: "",
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
    toast(`已保存 ${records.length} 注`);
  }

  async function copyDraftText() {
    if (!state.draftTickets.length) {
      toast("暂无可复制号码");
      return;
    }
    const text = state.draftTickets.map(formatTicket).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("号码已复制");
    } catch (error) {
      toast("复制失败，请手动选择文本");
    }
  }

  async function checkAllRecords(showToast = true) {
    const checked = state.records.map(evaluateRecord);
    for (const record of checked) await dbPut(record);
    state.records = checked;
    renderRecords();
    if (showToast) toast("记录已重新核对");
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
    els.draftSummary.textContent = state.draftTickets.length ? `${state.draftTickets.length} 注` : "暂无号码";
    if (!state.draftTickets.length) {
      els.draftList.className = "ticket-list empty-state";
      els.draftList.textContent = "点击“随机选号”生成号码";
      return;
    }
    const multiplier = clampInt(els.multipleInput.value, 1, 99);
    els.draftList.className = "ticket-list";
    els.draftList.innerHTML = state.draftTickets.map((ticket, index) => `
      <article class="ticket-card random-ticket random-ticket-${state.gameKey}">
        <div class="ticket-head">
          <div>
            <div class="ticket-no">第 ${index + 1} 注</div>
            <div class="meta">${GAME_CONFIGS[state.gameKey].label}${ticket.playMode ? ` · ${formatPlayMode(ticket.playMode)}` : ""}</div>
          </div>
          <div class="ticket-right">
            ${multiplier > 1 ? `<span class="ticket-type">${multiplier}倍</span>` : ""}
            <button class="delete-btn" type="button" data-delete-draft="${index}">删除</button>
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
    els.toggleDrawsBtn.textContent = state.showAllDraws ? "收起" : "展开";
    const visibleGames = state.showAllDraws ? GAME_ORDER : GAME_ORDER.filter((gameKey) => DEFAULT_VISIBLE_DRAWS.has(gameKey));
    const latestCards = visibleGames.map((gameKey) => {
      const draw = getLatestDraw(gameKey);
      const config = GAME_CONFIGS[gameKey];
      if (!draw) {
        return `<article class="draw-card draw-card-${gameKey}"><div class="draw-head"><div class="draw-title">${config.label}</div><span class="draw-meta-tag">暂无数据</span></div></article>`;
      }
      return `
        <article class="draw-card draw-card-${gameKey}">
          <div class="draw-head">
            <div>
              <div class="title-line"><div class="draw-title">${config.label}</div></div>
              <div class="draw-meta-tag">${draw.expect || "未知期"} · ${draw.openDate || draw.time || "未知日期"}</div>
              ${renderFirstPrize(draw)}
            </div>
            <span class="draw-action-btn">往</span>
          </div>
          ${renderDrawBalls(gameKey, draw.drawValues || parseOpenCodeToDrawValues(gameKey, draw.openCode))}
        </article>
      `;
    }).join("");
    els.latestDraws.innerHTML = latestCards;

    const history = state.draws.slice().sort(sortDrawDesc).slice(0, 30);
    els.historyList.innerHTML = history.length ? history.map((draw) => `
      <article class="history-card draw-card-${draw.gameKey}">
        <div class="history-head">
          <div>
            <div class="expect">${GAME_CONFIGS[draw.gameKey]?.label || draw.gameKey} ${draw.expect || "未知期"}</div>
            <div class="draw-date">${draw.openDate || draw.time || "未知日期"}</div>
          </div>
        </div>
        ${renderDrawBalls(draw.gameKey, draw.drawValues || parseOpenCodeToDrawValues(draw.gameKey, draw.openCode))}
      </article>
    `).join("") : `<div class="empty-state">暂无往期开奖数据</div>`;
  }

  function renderRecords() {
    if (!state.records.length) {
      els.recordList.className = "record-list empty-state";
      els.recordList.textContent = "暂无保存记录";
      renderMineStats();
      return;
    }
    els.recordList.className = "record-list";
    els.recordList.innerHTML = state.records.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((record) => `
      <article class="record-card random-ticket-${record.gameKey}">
        <div class="record-head">
          <div>
            <div class="title-line">
              <strong>${record.gameName || GAME_CONFIGS[record.gameKey]?.label || record.gameKey}</strong>
              <span class="status-pill ${statusClass(record.status)}">${record.resultText || "待核对"}</span>
            </div>
            <div class="meta">
              ${record.expect ? `${record.expect}期` : "未绑定期号"} · ${record.price || 0}元 · ${record.multiple || 1}倍 · ${formatDateTime(record.createdAt)}
            </div>
          </div>
          <button class="text-button danger-text" type="button" data-delete="${record.id}">删除</button>
        </div>
        ${renderTicketBalls(record.gameKey, record.numbers, record.matched)}
      </article>
    `).join("");
    renderMineStats();
    els.recordList.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await dbDelete(btn.dataset.delete);
        state.records = await dbGetAll();
        renderRecords();
        toast("记录已删除");
      });
    });
  }

  function renderMineStats() {
    if (els.mineRecordCount) els.mineRecordCount.textContent = String(state.records.length);
    if (els.minePendingCount) {
      els.minePendingCount.textContent = String(state.records.filter((record) => record.status === "pending").length);
    }
  }

  function renderFirstPrize(draw) {
    if (!draw.firstPrize) return "";
    const num = Number(draw.firstPrize.num || 0);
    const bonus = draw.firstPrize.singleBonus || "";
    if (!bonus && !num) return "";
    return `<div class="draw-prize-tag">一等奖 ${num} 注 · ${formatMoney(bonus)}</div>`;
  }

  function evaluateRecord(record) {
    const draw = findDrawForRecord(record);
    if (!draw) return { ...record, status: "pending", resultText: "待开奖", updatedAt: new Date().toISOString() };
    const drawValues = draw.drawValues || parseOpenCodeToDrawValues(record.gameKey, draw.openCode);
    const check = evaluateTicket(record.gameKey, record.numbers, drawValues, record.multiple);
    const status = check.float ? "prize_float" : check.amount > 0 ? "won" : "lost";
    return {
      ...record,
      expect: draw.expect || record.expect || "",
      openDate: draw.openDate || draw.time || record.openDate || "",
      drawId: draw.id || record.drawId || "",
      status,
      resultText: check.float ? `${check.prizeName}，奖金浮动` : check.amount > 0 ? `中奖 ${check.amount} 元` : "未中奖",
      prizeAmount: check.amount,
      prizeName: check.prizeName,
      matched: check.matched,
      drawOpenCode: draw.openCode,
      updatedAt: new Date().toISOString()
    };
  }

  function findDrawForRecord(record) {
    if (record.drawId) {
      const bound = state.draws.find((draw) => draw.id === record.drawId);
      if (bound) return bound;
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

  function generateTickets(gameKey, count, playMode) {
    if (gameKey === "ssq") return Array.from({ length: count }, () => ({ red: pickUnique(33, 6), blue: pickUnique(16, 1) }));
    if (gameKey === "dlt") return Array.from({ length: count }, () => ({ front: pickUnique(35, 5), back: pickUnique(12, 2) }));
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

  function renderTicketBalls(gameKey, ticket, matched = {}) {
    const config = GAME_CONFIGS[gameKey];
    return `<div class="balls">${config.sections.map((section) => {
      const values = getTicketSectionValues(gameKey, ticket, section.key);
      const hits = matched[section.key] || matched[mapMatchedKey(section.key)] || [];
      return values.map((value, index) => ball(value, section.color, hits[index], section.key === "tail")).join("");
    }).join("")}</div>`;
  }

  function renderDrawBalls(gameKey, drawValues) {
    const config = GAME_CONFIGS[gameKey];
    const sections = config.drawSections || config.sections;
    return `<div class="balls">${sections.map((section) => {
      const values = getDrawSectionValues(gameKey, drawValues, section.key);
      return values.map((value) => ball(value, section.color)).join("");
    }).join("")}</div>`;
  }

  function ball(value, color, hit = false, tail = false) {
    return `<span class="ball ${tail ? "" : "small"} ball-${color} ${hit ? "hit" : ""}">${pad(value, color === "plum" || color === "indigo" ? 1 : 2)}</span>`;
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
    if (ticket.red) return `${ticket.red.map((n) => pad(n)).join(" ")} / ${ticket.blue.map((n) => pad(n)).join(" ")}`;
    if (ticket.front) return `${ticket.front.map((n) => pad(n)).join(" ")} / ${ticket.back.map((n) => pad(n)).join(" ")}`;
    if (ticket.nums) return ticket.nums.map((n) => pad(n)).join(" ");
    if (ticket.nums3) return `${formatPlayMode(ticket.playMode)}\n${ticket.nums3.join(" ")}`;
    if (ticket.nums5) return ticket.nums5.join(" ");
    if (ticket.nums7) return ticket.nums7.map((n) => pad(n)).join(" ");
    if (ticket.nums6) return `${ticket.nums6.join(" ")} / ${pad(ticket.tail)}`;
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

  function evaluateTicket(gameKey, ticket, draw, multiple = 1) {
    let result = noPrize({});
    if (gameKey === "ssq") result = evaluateSSQ(ticket, draw);
    if (gameKey === "dlt") result = evaluateDLT(ticket, draw);
    if (gameKey === "k8") result = evaluateK8(ticket, draw);
    if (gameKey === "fc3d" || gameKey === "pl3") result = evaluateDigit(ticket, draw);
    if (gameKey === "pl5") result = evaluatePL5(ticket, draw);
    if (gameKey === "qlc") result = evaluateQLC(ticket, draw);
    if (gameKey === "qxc") result = evaluateQXC(ticket, draw);
    return { ...result, amount: result.float ? 0 : result.amount * clampInt(multiple, 1, 99) };
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
    return noPrize(matched);
  }

  function evaluateDLT(ticket, draw) {
    const front = countMatches(ticket.front, draw.front);
    const back = countMatches(ticket.back, draw.back);
    const matched = { front: markMatches(ticket.front, draw.front), back: markMatches(ticket.back, draw.back) };
    if (front === 5 && back === 2) return floatPrize("一等奖", matched);
    if (front === 5 && back === 1) return floatPrize("二等奖", matched);
    if ((front === 5 && back === 0) || (front === 4 && back === 2)) return fixedPrize("三等奖", 5000, matched);
    if (front === 4 && back === 1) return fixedPrize("四等奖", 300, matched);
    if ((front === 4 && back === 0) || (front === 3 && back === 2)) return fixedPrize("五等奖", 150, matched);
    if ((front === 3 && back === 1) || (front === 2 && back === 2)) return fixedPrize("六等奖", 15, matched);
    if ((front === 3 && back === 0) || (front === 2 && back === 1) || (front === 1 && back === 2) || (front === 0 && back === 2)) return fixedPrize("七等奖", 5, matched);
    return noPrize(matched);
  }

  function evaluateK8(ticket, draw) {
    const matches = countMatches(ticket.nums, draw.nums);
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
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
    if (mode === "single") return "直选";
    if (mode === "group3") return "组三";
    if (mode === "group6") return "组六";
    if (/^\d+$/.test(String(mode))) return `选${mode}`;
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
    return Math.random().toString(36).slice(2, 8);
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
  }
})();
