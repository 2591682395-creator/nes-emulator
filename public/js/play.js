(function () {
  "use strict";
  const elements = {
    screen: document.getElementById("screen"), placeholder: document.getElementById("placeholder"),
    romFile: document.getElementById("romFile"), romName: document.getElementById("romName"),
    pause: document.getElementById("btnPause"), reset: document.getElementById("btnReset"),
    mute: document.getElementById("btnMute"), fullscreen: document.getElementById("btnFullscreen"),
    fps: document.getElementById("fpsDisplay"), status: document.getElementById("statusDisplay"),
    toast: document.getElementById("toast"), list: document.getElementById("gameList"),
    search: document.getElementById("gameSearch"), count: document.getElementById("libraryCount"),
    info: document.getElementById("gameInfo"), title: document.getElementById("gameTitle"),
    category: document.getElementById("gameCategory"), plays: document.getElementById("gamePlays"),
    machine: document.getElementById("gameMachine"), brand: document.getElementById("machineBrand"),
    drawer: document.getElementById("gameDrawer"), drawerOpen: document.getElementById("openGameDrawer"),
    drawerClose: document.getElementById("closeGameDrawer"), drawerBackdrop: document.getElementById("drawerBackdrop"),
    mobileHeader: document.getElementById("mobilePlayHeader"), headerToggle: document.getElementById("mobileHeaderToggle"),
    headerCollapse: document.getElementById("collapseMobileHeader")
  };
  const emulator = new Emulator({
    canvas: elements.screen,
    onStatusUpdate: status => { elements.status.textContent = status; },
    onFPS: status => { elements.fps.textContent = status; }
  });
  let games = [], loaded = false, running = false, muted = false, toastTimer;
  const activePointers = new Map();
  const controlCodes = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyX", "KeyZ", "KeyA", "KeyS", "Enter", "ShiftRight"]);
  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function toast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
  }
  function updateControls() {
    [elements.pause, elements.reset, elements.mute, elements.fullscreen].forEach(button => { button.disabled = !loaded; });
    elements.pause.textContent = running ? "PAUSE" : "RESUME";
    elements.mute.textContent = muted ? "♪ 开启声音" : "♪ 声音";
  }
  function setConsoleStyle(style, announce = true) {
    if (isMobileLayout()) style = "psp";
    const isPsp = style === "psp";
    elements.machine.classList.toggle("psp-console", isPsp);
    elements.machine.classList.toggle("pixel-console", !isPsp);
    elements.machine.setAttribute("aria-label", `${isPsp ? "PSP" : "Pixel Boy"} 网页游戏机`);
    elements.brand.innerHTML = isPsp ? `PSP <small>PORTABLE</small>` : `PIXEL BOY <small>COLOR</small>`;
    document.querySelectorAll(".console-option").forEach(button => {
      const selected = button.dataset.console === style;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    localStorage.setItem("preferred-console", style);
    if (announce) toast(`已切换为 ${isPsp ? "PSP" : "Pixel Boy"} 外观`);
  }
  function isMobileLayout() {
    const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const mobileScreen = Math.min(screen.width, screen.height) <= 820;
    return window.matchMedia("(max-width: 900px)").matches || (coarsePointer && mobileScreen);
  }
  function setMobileHeader(open) {
    document.body.classList.toggle("mobile-header-open", open);
    elements.mobileHeader.setAttribute("aria-hidden", String(!open));
    elements.headerToggle.setAttribute("aria-expanded", String(open));
    elements.headerToggle.querySelector("b").textContent = open ? "⌃" : "⌄";
  }
  function setDrawer(open) {
    elements.drawer.classList.toggle("is-open", open);
    elements.drawerBackdrop.hidden = !open;
    elements.drawerOpen.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("drawer-open", open);
    if (!open && document.activeElement === elements.search) elements.search.blur();
  }
  function syncResponsiveMode() {
    document.body.classList.toggle("mobile-play-mode", isMobileLayout());
    if (isMobileLayout()) setConsoleStyle("psp", false);
    else { setDrawer(false); setMobileHeader(false); }
  }
  function renderList(filter = "") {
    const keyword = filter.trim().toLowerCase();
    const filtered = games.filter(game => String(game.title).toLowerCase().includes(keyword));
    elements.list.innerHTML = filtered.length ? filtered.map(game => `<button type="button" class="game-list-item" data-id="${escape(game.id)}">
      <img class="game-list-cover" src="${escape(game.cover_path || "/uploads/covers/default.svg")}" alt="" onerror="this.onerror=null;this.src='/uploads/covers/default.svg'">
      <span class="game-list-info"><span class="game-list-title">${escape(game.title)}</span><span class="game-list-meta">${escape(game.category_name || "经典游戏")}</span></span>
    </button>`).join("") : `<div class="list-message">没有找到这张卡带。</div>`;
  }
  async function loadLibrary() {
    try {
      const response = await fetch("/api/games?pageSize=50");
      if (!response.ok) throw new Error("卡带目录请求失败");
      const payload = await response.json();
      games = payload?.code === 0 ? payload.data?.list || [] : [];
      elements.count.textContent = `${games.length} 款`;
      renderList();
      const gameId = new URLSearchParams(location.search).get("id");
      if (gameId && games.some(game => String(game.id) === gameId)) selectGame(gameId);
    } catch (error) {
      console.warn("卡带目录加载失败:", error);
      elements.list.innerHTML = `<div class="list-message">卡带架暂时无法读取，你仍可加载本地 ROM。</div>`;
    }
  }
  async function selectGame(id) {
    const game = games.find(item => String(item.id) === String(id));
    if (!game) return;
    if (isMobileLayout()) setDrawer(false);
    elements.list.querySelectorAll(".game-list-item").forEach(item => item.classList.toggle("active", item.dataset.id === String(id)));
    elements.info.hidden = false;
    elements.title.textContent = game.title;
    elements.category.textContent = game.category_name || "经典游戏";
    elements.plays.textContent = `${Number(game.play_count) || 0} 次游玩`;
    toast(`正在装入《${game.title}》...`);
    try {
      const response = await fetch(`/api/games/${encodeURIComponent(id)}/download`);
      if (!response.ok) throw new Error("ROM 下载失败");
      const data = await response.arrayBuffer();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || game.rom_path || game.title);
      finishLoading(data, filename, game.title);
    } catch (error) {
      console.error(error);
      toast(`加载失败：${error.message}`);
    }
  }
  function finishLoading(data, filename, label) {
    if (!emulator.loadROM(data, filename)) { toast("无法识别这个 ROM 文件"); return; }
    loaded = true;
    running = true;
    elements.placeholder.classList.add("hidden");
    elements.romName.textContent = label;
    updateControls();
    toast(`已装入《${label}》`);
  }
  function pressControl(button, code) {
    if (!controlCodes.has(code) || button.classList.contains("is-pressed")) return;
    button.classList.add("is-pressed");
    emulator.buttonDown(code);
  }
  function releaseControl(button, code) {
    if (!controlCodes.has(code)) return;
    button.classList.remove("is-pressed");
    emulator.buttonUp(code);
  }
  function bindConsoleControls() {
    document.querySelectorAll(".console-key[data-game-key]").forEach(button => {
      const code = button.dataset.gameKey;
      if (code === "analog") { bindAnalogStick(button); return; }
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        activePointers.set(event.pointerId, { button, code });
        pressControl(button, code);
      });
      const release = event => {
        const active = activePointers.get(event.pointerId);
        if (!active) return;
        releaseControl(active.button, active.code);
        activePointers.delete(event.pointerId);
      };
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
      button.addEventListener("contextmenu", event => event.preventDefault());
    });
    window.addEventListener("keydown", event => {
      if (!controlCodes.has(event.code) || event.repeat) return;
      const button = document.querySelector(`.console-key[data-game-key="${event.code}"]`);
      if (button) button.classList.add("is-pressed");
    });
    window.addEventListener("keyup", event => {
      if (!controlCodes.has(event.code)) return;
      document.querySelectorAll(`.console-key[data-game-key="${event.code}"]`).forEach(button => button.classList.remove("is-pressed"));
    });
    window.addEventListener("blur", () => {
      activePointers.forEach(({ button, code }) => releaseControl(button, code));
      activePointers.clear();
      document.querySelectorAll(".console-key.is-pressed").forEach(button => button.classList.remove("is-pressed"));
    });
  }

  function bindAnalogStick(stick) {
    let activeCode = null;
    const updateDirection = event => {
      const rect = stick.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      const nextCode = Math.abs(x) > Math.abs(y) ? (x < 0 ? "ArrowLeft" : "ArrowRight") : (y < 0 ? "ArrowUp" : "ArrowDown");
      if (nextCode === activeCode) return;
      if (activeCode) emulator.buttonUp(activeCode);
      activeCode = nextCode;
      emulator.buttonDown(activeCode);
      stick.dataset.direction = activeCode;
    };
    const release = () => {
      if (activeCode) emulator.buttonUp(activeCode);
      activeCode = null;
      stick.classList.remove("is-pressed");
      delete stick.dataset.direction;
    };
    stick.addEventListener("pointerdown", event => { event.preventDefault(); stick.setPointerCapture?.(event.pointerId); stick.classList.add("is-pressed"); updateDirection(event); });
    stick.addEventListener("pointermove", event => { if (stick.hasPointerCapture?.(event.pointerId)) updateDirection(event); });
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);
    stick.addEventListener("lostpointercapture", release);
  }

  document.querySelectorAll(".console-option").forEach(button => button.addEventListener("click", () => setConsoleStyle(button.dataset.console)));
  elements.drawerOpen.addEventListener("click", () => setDrawer(true));
  elements.drawerClose.addEventListener("click", () => setDrawer(false));
  elements.drawerBackdrop.addEventListener("click", () => setDrawer(false));
  elements.headerToggle.addEventListener("click", () => setMobileHeader(!document.body.classList.contains("mobile-header-open")));
  elements.headerCollapse.addEventListener("click", () => setMobileHeader(false));
  document.addEventListener("keydown", event => { if (event.key === "Escape") setDrawer(false); });
  window.addEventListener("resize", syncResponsiveMode);
  window.addEventListener("orientationchange", () => setTimeout(syncResponsiveMode, 120));
  elements.list.addEventListener("click", event => { const item = event.target.closest("[data-id]"); if (item) selectGame(item.dataset.id); });
  elements.search.addEventListener("input", event => renderList(event.target.value));
  elements.romFile.addEventListener("change", async event => { const file = event.target.files[0]; if (file) finishLoading(await file.arrayBuffer(), file.name, file.name); });
  elements.pause.addEventListener("click", () => { running ? emulator.pause() : emulator.start(); running = !running; updateControls(); });
  elements.reset.addEventListener("click", () => { emulator.reset(); running = true; updateControls(); toast("游戏已重置"); });
  elements.mute.addEventListener("click", () => { muted = emulator.toggleMute(); updateControls(); });
  elements.fullscreen.addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : document.getElementById("screenWrapper").requestFullscreen().catch(() => toast("当前浏览器不支持全屏")));
  document.addEventListener("fullscreenchange", () => { elements.fullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏"; });

  setConsoleStyle(isMobileLayout() ? "psp" : (localStorage.getItem("preferred-console") === "psp" ? "psp" : "pixel"), false);
  syncResponsiveMode();
  bindConsoleControls();
  emulator.init();
  updateControls();
  loadLibrary();
})();
