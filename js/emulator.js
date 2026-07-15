/**
 * emulator.js - NES 模拟器封装层
 * 封装 jsnes 库，提供简洁的控制接口
 */
class Emulator {
  /**
   * @param {Object} options
   * @param {HTMLCanvasElement} options.canvas - 渲染画布
   * @param {NESAudio} options.audio - 音频实例
   * @param {Function} options.onStatusUpdate - 状态更新回调
   * @param {Function} options.onFPS - FPS 更新回调
   */
  constructor({ canvas, audio, onStatusUpdate, onFPS }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = audio;
    this.onStatusUpdate = onStatusUpdate || (() => {});
    this.onFPS = onFPS || (() => {});

    this.nes = null;
    this.running = false;
    this.animFrameId = null;
    this.fpsInterval = null;

    // Canvas 渲染缓冲区
    this.imageData = this.ctx.createImageData(256, 240);
    this.buf = new ArrayBuffer(this.imageData.data.length);
    this.buf8 = new Uint8ClampedArray(this.buf);
    this.buf32 = new Uint32Array(this.buf);

    // 初始化 alpha 通道
    for (let i = 0; i < this.buf32.length; i++) {
      this.buf32[i] = 0xff000000;
    }
  }

  /**
   * 初始化 jsnes 实例
   */
  init() {
    this.nes = new jsnes.NES({
      onFrame: (frameBuffer) => this._renderFrame(frameBuffer),
      onAudioSample: (left, right) => {
        if (this.audio) {
          this.audio.writeSample(left, right);
        }
      },
      onStatusUpdate: (status) => this.onStatusUpdate(status),
      emulateSound: true,
    });
  }

  /**
   * 加载 ROM 文件
   * @param {ArrayBuffer} romData - ROM 文件的 ArrayBuffer
   */
  loadROM(romData) {
    if (!this.nes) this.init();

    try {
      this.nes.loadROM(romData);
      this.onStatusUpdate("ROM 加载成功");
      return true;
    } catch (e) {
      this.onStatusUpdate("ROM 加载失败: " + e.message);
      console.error("ROM 加载错误:", e);
      return false;
    }
  }

  /**
   * 渲染一帧到 Canvas
   * @param {Array} frameBuffer - jsnes 的帧缓冲区（256*240 的数组，每个元素是 RGB 整数）
   */
  _renderFrame(frameBuffer) {
    for (let y = 0; y < 240; y++) {
      for (let x = 0; x < 256; x++) {
        const i = y * 256 + x;
        // jsnes 输出 BGR 格式，Canvas 需要 ABGR（小端序）
        this.buf32[i] = 0xff000000 | frameBuffer[i];
      }
    }
    this.imageData.data.set(this.buf8);
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * 开始游戏循环
   */
  start() {
    if (!this.nes || this.running) return;
    this.running = true;

    // NES 标准帧率 60.0988 FPS
    const fps = 60.0988;
    const frameDuration = 1000 / fps;
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const loop = (now) => {
      if (!this.running) return;

      // 帧率控制：确保每帧间隔正确
      const elapsed = now - lastFrameTime;
      if (elapsed >= frameDuration) {
        // 补偿丢失的帧
        const framesToRun = Math.min(Math.floor(elapsed / frameDuration), 3);
        for (let i = 0; i < framesToRun; i++) {
          try {
            this.nes.frame();
          } catch (e) {
            console.error("模拟器运行错误:", e);
            this.stop();
            this.onStatusUpdate("模拟器崩溃: " + e.message);
            return;
          }
        }

        // 刷新音频缓冲
        if (this.audio) {
          this.audio.flush();
        }

        lastFrameTime = now - (elapsed % frameDuration);
        frameCount += framesToRun;
      }

      // 每秒更新 FPS
      const fpsElapsed = now - lastFpsTime;
      if (fpsElapsed >= 1000) {
        this.onFPS(Math.round((frameCount * 1000) / fpsElapsed));
        frameCount = 0;
        lastFpsTime = now;
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
    this.onStatusUpdate("运行中");
  }

  /**
   * 暂停游戏
   */
  pause() {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.onStatusUpdate("已暂停");
  }

  /**
   * 重置游戏
   */
  reset() {
    if (!this.nes) return;
    const wasRunning = this.running;
    this.pause();
    this.nes.reset();
    this.onStatusUpdate("已重置");
    if (wasRunning) {
      this.start();
    }
  }

  /**
   * 停止模拟器并释放资源
   */
  stop() {
    this.pause();
    this.nes = null;
  }

  /**
   * 获取手柄控制器接口（供 input 模块使用）
   */
  buttonDown(controller, button) {
    if (this.nes) {
      this.nes.buttonDown(controller, button);
    }
  }

  buttonUp(controller, button) {
    if (this.nes) {
      this.nes.buttonUp(controller, button);
    }
  }
}
