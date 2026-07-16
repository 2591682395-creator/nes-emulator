/**
 * play.js - 游戏页面主入口
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

  // ===== Toast 提示 =====
  let toastTimer = null;
  window.showToast = function(message, duration = 2500) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, duration);
  }

  // ===== 按钮状态更新 =====
  window.updateButtons = function() {
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
      const romData = event.target.result;

      await audio.start();

      const success = emulator.loadROM(romData);
      if (success) {
        romLoaded = true;
        placeholder.classList.add("hidden");
        showToast(`已加载: ${file.name}`);
        updateButtons();

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

  document.addEventListener("fullscreenchange", () => {
    btnFullscreen.textContent = document.fullscreenElement
      ? "⛶ 退出全屏"
      : "⛶ 全屏";
  });

  // ===== 防止方向键滚动页面 =====
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  }, { passive: false });

  // ===== 初始化 =====
  emulator.init();
  updateButtons();
  console.log("NES 游戏页面已就绪");
})();
