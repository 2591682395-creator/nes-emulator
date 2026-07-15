/**
 * app.js - 主应用入口
 * 初始化各模块，绑定 UI 事件
 */
(function () {
  "use strict";

  // ===== DOM 元素 =====
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

  // ===== 实例化模块 =====
  const audio = new NESAudio();
  const emulator = new Emulator({
    canvas: screen,
    audio: audio,
    onStatusUpdate: (status) => {
      statusDisplay.textContent = status;
    },
    onFPS: (fps) => {
      fpsDisplay.textContent = `FPS: ${fps}`;
    },
  });
  const input = new InputManager(emulator);

  // ===== 状态 =====
  let romLoaded = false;
  let isRunning = false;
  let isMuted = false;
  let currentGameId = null;

  // ===== 加载游戏库 =====
  async function loadGameLibrary() {
    try {
      const res = await fetch("/api/games?pageSize=50");
      const data = await res.json();
      if (data.code !== 0 || !data.data.list.length) return;

      gameGrid.innerHTML = data.data.list.map(game => `
        <div class="game-card" data-id="${game.id}" data-title="${game.title}">
          <img class="game-card-cover"
               src="${game.cover_path || '/uploads/covers/default.png'}"
               alt="${game.title}"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%2316213e%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2240%22>🎮</text></svg>'">
          <div class="game-card-badge">运行中</div>
          <div class="game-card-info">
            <div class="game-card-title">${game.title}</div>
            <div class="game-card-meta">
              <span class="game-card-tag">${game.category_name || '未分类'}</span>
              <span>${game.play_count || 0} 次</span>
            </div>
          </div>
        </div>
      `).join("");

      // 绑定点击事件
      gameGrid.querySelectorAll(".game-card").forEach(card => {
        card.addEventListener("click", () => {
          const gameId = card.dataset.id;
          const gameTitle = card.dataset.title;
          loadGameFromServer(gameId, gameTitle, card);
        });
      });
    } catch (e) {
      console.warn("加载游戏库失败:", e);
    }
  }

  // ===== 从服务器加载游戏 =====
  async function loadGameFromServer(gameId, gameTitle, cardEl) {
    // 高亮当前卡片
    gameGrid.querySelectorAll(".game-card").forEach(c => c.classList.remove("active"));
    if (cardEl) cardEl.classList.add("active");

    showToast(`正在加载: ${gameTitle}...`);

    try {
      const res = await fetch(`/api/games/${gameId}/download`);
      if (!res.ok) throw new Error("下载失败");

      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // 启动音频
      await audio.start();

      // 加载 ROM
      const success = emulator.loadROM(arrayBuffer);
      if (success) {
        romLoaded = true;
        currentGameId = gameId;
        placeholder.classList.add("hidden");
        romNameDisplay.textContent = gameTitle;
        showToast(`已加载: ${gameTitle}`);
        updateButtons();

        // 自动开始
        emulator.start();
        input.start();
        isRunning = true;
        updateButtons();
      } else {
        showToast("ROM 加载失败");
      }
    } catch (e) {
      console.error("加载游戏失败:", e);
      showToast("加载失败: " + e.message);
    }
  }

  // ===== Toast 提示 =====
  let toastTimer = null;
  function showToast(message, duration = 2500) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, duration);
  }

  // ===== 按钮状态更新 =====
  function updateButtons() {
    btnStart.disabled = !romLoaded;
    btnPause.disabled = !romLoaded;
    btnReset.disabled = !romLoaded;
    btnMute.disabled = !romLoaded;
    btnFullscreen.disabled = !romLoaded;

    btnPause.textContent = isRunning ? "⏸ 暂停" : "▶ 继续";
    btnMute.textContent = isMuted ? "🔇 静音" : "🔊 声音";
  }

  // ===== ROM 文件加载 =====
  romFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    romNameDisplay.textContent = file.name;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const romData = event.target.result; // ArrayBuffer

      // 启动音频（需要用户手势触发）
      await audio.start();

      // 加载 ROM
      const success = emulator.loadROM(romData);
      if (success) {
        romLoaded = true;
        placeholder.classList.add("hidden");
        showToast(`已加载: ${file.name}`);
        updateButtons();

        // 自动开始游戏
        emulator.start();
        input.start();
        isRunning = true;
        updateButtons();
      } else {
        showToast("ROM 加载失败，请检查文件格式");
      }
    };

    reader.onerror = () => {
      showToast("文件读取失败");
    };

    reader.readAsArrayBuffer(file);
  });

  // ===== 开始/继续 =====
  btnStart.addEventListener("click", () => {
    if (!romLoaded) return;
    if (!isRunning) {
      emulator.start();
      input.start();
      isRunning = true;
      updateButtons();
    }
  });

  // ===== 暂停 =====
  btnPause.addEventListener("click", () => {
    if (!romLoaded) return;
    if (isRunning) {
      emulator.pause();
      isRunning = false;
    } else {
      emulator.start();
      isRunning = true;
    }
    updateButtons();
  });

  // ===== 重置 =====
  btnReset.addEventListener("click", () => {
    if (!romLoaded) return;
    emulator.reset();
    if (!isRunning) {
      emulator.start();
      input.start();
      isRunning = true;
    }
    showToast("游戏已重置");
    updateButtons();
  });

  // ===== 静音 =====
  btnMute.addEventListener("click", () => {
    isMuted = audio.toggleMute();
    updateButtons();
  });

  // ===== 全屏 =====
  btnFullscreen.addEventListener("click", () => {
    const wrapper = document.getElementById("screenWrapper");
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapper.requestFullscreen().catch(() => {
        showToast("全屏模式不可用");
      });
    }
  });

  // 全屏状态变化时更新按钮文字
  document.addEventListener("fullscreenchange", () => {
    btnFullscreen.textContent = document.fullscreenElement
      ? "⛶ 退出全屏"
      : "⛶ 全屏";
  });

  // ===== 防止方向键滚动页面 =====
  window.addEventListener(
    "keydown",
    (e) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code
        )
      ) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // ===== 初始化 =====
  emulator.init();
  updateButtons();
  loadGameLibrary();
  console.log("NES 红白机模拟器 MVP 已就绪");
})();
