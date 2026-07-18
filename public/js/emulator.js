/**
 * Multi-system EmulatorJS wrapper.
 * Supports NES, SNES, Game Boy, Game Boy Color and Game Boy Advance ROMs.
 */
class Emulator {
  constructor({ canvas, onStatusUpdate, onFPS }) {
    this.canvas = canvas;
    this.wrapper = canvas.parentElement;
    this.onStatusUpdate = onStatusUpdate || (() => {});
    this.onFPS = onFPS || (() => {});
    this.frame = null;
    this.objectUrl = null;
    this.core = null;
    this.muted = false;
    this.ready = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.onReady = null;
  }

  init() {
    this.canvas.hidden = true;
    this.frame = document.createElement("iframe");
    this.frame.id = "emulatorFrame";
    this.frame.className = "emulator-frame";
    this.frame.title = "游戏模拟器";
    this.frame.allow = "autoplay; fullscreen; gamepad";
    this.frame.setAttribute("allowfullscreen", "");
    this.frame.hidden = true;
    this.wrapper.insertBefore(this.frame, this.canvas.nextSibling);

    window.addEventListener("message", (event) => {
      if (event.source !== this.frame.contentWindow || !event.data) return;
      if (event.data.type === "emulator-ready") {
        this.ready = true;
        this.onStatusUpdate(`${this.getCoreLabel()} 核心已就绪`);
        this.frame.focus();
        this.onReady?.();
      } else if (event.data.type === "emulator-error") {
        this.onStatusUpdate(`模拟器错误: ${event.data.message}`);
      } else if (event.data.type === "emulator-response") {
        const pending = this.pendingRequests.get(event.data.requestId);
        if (!pending) return;
        this.pendingRequests.delete(event.data.requestId);
        clearTimeout(pending.timer);
        event.data.error ? pending.reject(new Error(event.data.error)) : pending.resolve(event.data.payload);
      }
    });

    this.onStatusUpdate("EmulatorJS 已就绪");
  }

  loadROM(romData, fileName = "game.nes") {
    try {
      this.core = detectRomCore(romData, fileName);
      this.ready = false;
      this.stop();
      this.objectUrl = URL.createObjectURL(
        new Blob([romData], { type: "application/octet-stream" }),
      );

      const query = new URLSearchParams({
        core: this.core,
        rom: this.objectUrl,
        name: fileName.replace(/\.[^.]+$/, ""),
      });
      this.frame.src = `/player.html?${query}`;
      this.frame.hidden = false;
      this.onFPS(`核心: ${this.getCoreLabel()}`);
      this.onStatusUpdate(`正在启动 ${this.getCoreLabel()} 核心...`);
      return true;
    } catch (error) {
      this.onStatusUpdate(`ROM 加载失败: ${error.message}`);
      console.error("ROM 加载失败:", error);
      return false;
    }
  }

  getCoreLabel() {
    return { nes: "NES", snes: "SNES", gba: "GBA", gb: "GB/GBC" }[this.core] || "EmulatorJS";
  }

  _control(action, value) {
    if (!this.frame || !this.frame.contentWindow) return;
    this.frame.contentWindow.postMessage(
      { type: "emulator-control", action, value },
      location.origin,
    );
  }

  start() {
    this._control("play");
    this.frame?.focus();
    this.onStatusUpdate(`${this.getCoreLabel()} 运行中`);
  }

  pause() {
    this._control("pause");
    this.onStatusUpdate("已暂停");
  }

  reset() {
    this._control("restart");
    this.onStatusUpdate("游戏已重置");
  }

  toggleMute() {
    this.muted = !this.muted;
    this._control("mute", this.muted);
    return this.muted;
  }

  setFastForward(enabled) {
    this._control("fast-forward", Boolean(enabled));
  }

  _request(action, value, timeout = 8000) {
    if (!this.frame?.contentWindow) return Promise.reject(new Error("模拟器尚未启动"));
    const requestId = `save-${Date.now()}-${++this.requestId}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("模拟器存档操作超时"));
      }, timeout);
      this.pendingRequests.set(requestId, { resolve, reject, timer });
      this.frame.contentWindow.postMessage({ type: "emulator-control", action, value, requestId }, location.origin);
    });
  }

  exportSave() { return this._request("export-save"); }
  importSave(save) { return this._request("import-save", save); }

  stop() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  buttonDown(keyCode) {
    this._control("key", { code: keyCode, pressed: true });
  }

  buttonUp(keyCode) {
    this._control("key", { code: keyCode, pressed: false });
  }
}

function detectRomCore(romData, fileName = "") {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1];
  if (extension === "nes") return "nes";
  if (extension === "gba") return "gba";
  if (extension === "gb" || extension === "gbc") return "gb";
  if (extension === "sfc" || extension === "smc") return "snes";

  const bytes = new Uint8Array(romData);
  if (bytes.length >= 4 && bytes[0] === 0x4e && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1a) {
    return "nes";
  }
  if (bytes.length > 0xb2 && bytes[0xb2] === 0x96) return "gba";
  if (
    bytes.length > 0x14a &&
    bytes[0x104] === 0xce && bytes[0x105] === 0xed &&
    bytes[0x106] === 0x66 && bytes[0x107] === 0x66
  ) {
    return "gb";
  }
  throw new Error("仅支持 .nes、.sfc、.smc、.gb、.gbc 和 .gba ROM");
}

if (typeof module !== "undefined") {
  module.exports = { detectRomCore };
}
