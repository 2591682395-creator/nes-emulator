(function () {
  "use strict";
  const elements = {
    screen: document.getElementById("screen"), placeholder: document.getElementById("placeholder"),
    romFile: document.getElementById("romFile"), romName: document.getElementById("romName"),
    start: document.getElementById("btnStart"), pause: document.getElementById("btnPause"),
    reset: document.getElementById("btnReset"), mute: document.getElementById("btnMute"),
    fullscreen: document.getElementById("btnFullscreen"), fps: document.getElementById("fpsDisplay"),
    status: document.getElementById("statusDisplay"), toast: document.getElementById("toast"),
    list: document.getElementById("gameList"), search: document.getElementById("gameSearch"),
    count: document.getElementById("libraryCount"), info: document.getElementById("gameInfo"),
    title: document.getElementById("gameTitle"), category: document.getElementById("gameCategory"),
    plays: document.getElementById("gamePlays")
  };
  const emulator = new Emulator({
    canvas: elements.screen,
    onStatusUpdate: status => { elements.status.textContent = status; },
    onFPS: status => { elements.fps.textContent = status; }
  });
  let games = [];
  let loaded = false;
  let running = false;
  let muted = false;
  let toastTimer;

  const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  function toast(message) {
    elements.toast.textContent = message; elements.toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
  }
  function updateControls() {
    [elements.start, elements.pause, elements.reset, elements.mute, elements.fullscreen].forEach(button => { button.disabled = !loaded; });
    elements.pause.textContent = running ? "PAUSE" : "RESUME";
    elements.mute.innerHTML = `${muted ? "A" : "A"}<small>${muted ? "静音" : "声音"}</small>`;
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
      elements.count.textContent = `${games.length} 款`; renderList();
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
    elements.list.querySelectorAll(".game-list-item").forEach(item => item.classList.toggle("active", item.dataset.id === String(id)));
    elements.info.hidden = false; elements.title.textContent = game.title;
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
    } catch (error) { console.error(error); toast(`加载失败：${error.message}`); }
  }
  function finishLoading(data, filename, label) {
    if (!emulator.loadROM(data, filename)) { toast("无法识别这个 ROM 文件"); return; }
    loaded = true; running = true; elements.placeholder.classList.add("hidden");
    elements.romName.textContent = label; updateControls(); toast(`已装入《${label}》`);
  }

  elements.list.addEventListener("click", event => { const item = event.target.closest("[data-id]"); if (item) selectGame(item.dataset.id); });
  elements.search.addEventListener("input", event => renderList(event.target.value));
  elements.romFile.addEventListener("change", async event => { const file = event.target.files[0]; if (file) finishLoading(await file.arrayBuffer(), file.name, file.name); });
  elements.start.addEventListener("click", () => { emulator.start(); running = true; updateControls(); });
  elements.pause.addEventListener("click", () => { running ? emulator.pause() : emulator.start(); running = !running; updateControls(); });
  elements.reset.addEventListener("click", () => { emulator.reset(); running = true; updateControls(); toast("游戏已重置"); });
  elements.mute.addEventListener("click", () => { muted = emulator.toggleMute(); updateControls(); });
  elements.fullscreen.addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : document.getElementById("screenWrapper").requestFullscreen().catch(() => toast("当前浏览器不支持全屏")));
  document.addEventListener("fullscreenchange", () => { elements.fullscreen.textContent = document.fullscreenElement ? "▣ 退出全屏" : "▣ 全屏游玩"; });
  emulator.init(); updateControls(); loadLibrary();
})();
