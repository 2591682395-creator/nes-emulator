(function () {
  "use strict";

  const screen = document.getElementById("screen");
  const placeholder = document.getElementById("placeholder");
  const romFileInput = document.getElementById("romFile");
  const romNameDisplay = document.getElementById("romName");
  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnReset = document.getElementById("btnReset");
  const btnMute = document.getElementById("btnMute");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const fpsDisplay = document.getElementById("fpsDisplay");
  const statusDisplay = document.getElementById("statusDisplay");
  const toastEl = document.getElementById("toast");
  const gameGrid = document.getElementById("gameGrid");

  const emulator = new Emulator({
    canvas: screen,
    onStatusUpdate: (status) => { statusDisplay.textContent = status; },
    onFPS: (status) => { fpsDisplay.textContent = status; },
  });

  let romLoaded = false;
  let isRunning = false;
  let isMuted = false;

  const escapeHTML = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  async function loadGameLibrary() {
    try {
      const res = await fetch("/api/games?pageSize=50");
      const data = await res.json();
      if (data.code !== 0 || !data.data.list.length) return;

      gameGrid.innerHTML = data.data.list.map((game) => `
        <div class="game-card" data-id="${game.id}"
             data-title="${escapeHTML(game.title)}"
             data-rom-path="${escapeHTML(game.rom_path || "")}">
          <img class="game-card-cover"
               src="${escapeHTML(game.cover_path || "/uploads/covers/default.png") }"
               alt="${escapeHTML(game.title)}">
          <div class="game-card-badge">点击游玩</div>
          <div class="game-card-info">
            <div class="game-card-title">${escapeHTML(game.title)}</div>
            <div class="game-card-meta">
              <span class="game-card-tag">${escapeHTML(game.category_name || "未分类")}</span>
              <span>${Number(game.play_count) || 0} 次</span>
            </div>
          </div>
        </div>
      `).join("");

      gameGrid.querySelectorAll(".game-card").forEach((card) => {
        card.addEventListener("click", () => loadGameFromServer(card));
      });
    } catch (error) {
      console.warn("加载游戏库失败:", error);
    }
  }

  async function loadGameFromServer(card) {
    gameGrid.querySelectorAll(".game-card").forEach((item) => item.classList.remove("active"));
    card.classList.add("active");
    const { id, title, romPath } = card.dataset;
    showToast(`正在加载: ${title}...`);

    try {
      const res = await fetch(`/api/games/${id}/download`);
      if (!res.ok) throw new Error("ROM 下载失败");
      const data = await res.arrayBuffer();
      finishLoading(data, romPath || title, title);
    } catch (error) {
      console.error("加载游戏失败:", error);
      showToast(`加载失败: ${error.message}`);
    }
  }

  function finishLoading(data, fileName, displayName) {
    if (!emulator.loadROM(data, fileName)) {
      showToast("ROM 格式不受支持");
      return;
    }
    romLoaded = true;
    isRunning = true;
    placeholder.classList.add("hidden");
    romNameDisplay.textContent = displayName;
    showToast(`已加载: ${displayName}`);
    updateButtons();
  }

  let toastTimer;
  function showToast(message, duration = 2500) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
  }

  function updateButtons() {
    [btnStart, btnPause, btnReset, btnMute, btnFullscreen]
      .forEach((button) => { button.disabled = !romLoaded; });
    btnPause.textContent = isRunning ? "⏸ 暂停" : "▶ 继续";
    btnMute.textContent = isMuted ? "🔇 静音" : "🔊 声音";
  }

  romFileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      finishLoading(await file.arrayBuffer(), file.name, file.name);
    } catch (error) {
      showToast(`文件读取失败: ${error.message}`);
    }
  });

  btnStart.addEventListener("click", () => {
    if (!romLoaded) return;
    emulator.start();
    isRunning = true;
    updateButtons();
  });

  btnPause.addEventListener("click", () => {
    if (!romLoaded) return;
    isRunning ? emulator.pause() : emulator.start();
    isRunning = !isRunning;
    updateButtons();
  });

  btnReset.addEventListener("click", () => {
    if (!romLoaded) return;
    emulator.reset();
    isRunning = true;
    updateButtons();
  });

  btnMute.addEventListener("click", () => {
    isMuted = emulator.toggleMute();
    updateButtons();
  });

  btnFullscreen.addEventListener("click", () => {
    const wrapper = document.getElementById("screenWrapper");
    document.fullscreenElement
      ? document.exitFullscreen()
      : wrapper.requestFullscreen().catch(() => showToast("全屏模式不可用"));
  });

  document.addEventListener("fullscreenchange", () => {
    btnFullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
  });

  emulator.init();
  updateButtons();
  loadGameLibrary();
})();
