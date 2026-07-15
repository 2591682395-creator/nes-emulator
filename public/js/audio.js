/**
 * audio.js - Web Audio API 音频处理模块
 * 将 jsnes 产生的音频采样通过 AudioWorklet 播放
 */
class NESAudio {
  constructor() {
    this.audioCtx = null;
    this.node = null;
    this.muted = false;
    this.gainNode = null;

    // 批处理缓冲区，减少 MessagePort 开销
    this.BATCH_SIZE = 128;
    this.batchL = new Float32Array(this.BATCH_SIZE);
    this.batchR = new Float32Array(this.BATCH_SIZE);
    this.batchPos = 0;
  }

  /**
   * 启动音频系统（需要在用户交互后调用）
   */
  async start() {
    if (this.audioCtx) return;

    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // 创建 AudioWorklet 处理器
      const workletCode = `
        class NESAudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.capacity = 8192;
            this.bufferL = new Float32Array(this.capacity);
            this.bufferR = new Float32Array(this.capacity);
            this.readPos = 0;
            this.writePos = 0;
            this.count = 0;

            this.port.onmessage = (e) => {
              if (e.data.type === "samples") {
                const left = e.data.left;
                const right = e.data.right;
                const len = left.length;

                if (this.count + len > this.capacity) {
                  const drop = this.count + len - this.capacity;
                  this.readPos = (this.readPos + drop) % this.capacity;
                  this.count -= drop;
                }

                for (let i = 0; i < len; i++) {
                  this.bufferL[this.writePos] = left[i];
                  this.bufferR[this.writePos] = right[i];
                  this.writePos = (this.writePos + 1) % this.capacity;
                }
                this.count += len;
              }
            };
          }

          process(inputs, outputs) {
            const output = outputs[0];
            if (!output || output.length < 2) return true;

            const outL = output[0];
            const outR = output[1];
            const size = outL.length;

            if (this.count < size) {
              for (let i = 0; i < this.count; i++) {
                outL[i] = this.bufferL[this.readPos];
                outR[i] = this.bufferR[this.readPos];
                this.readPos = (this.readPos + 1) % this.capacity;
              }
              for (let i = this.count; i < size; i++) {
                outL[i] = 0;
                outR[i] = 0;
              }
              this.count = 0;
            } else {
              for (let i = 0; i < size; i++) {
                outL[i] = this.bufferL[this.readPos];
                outR[i] = this.bufferR[this.readPos];
                this.readPos = (this.readPos + 1) % this.capacity;
              }
              this.count -= size;
            }
            return true;
          }
        }
        registerProcessor("nes-audio-processor", NESAudioProcessor);
      `;

      const blob = new Blob([workletCode], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(blob);
      await this.audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // 创建音频节点链：WorkletNode → GainNode → Destination
      this.gainNode = this.audioCtx.createGain();
      this.node = new AudioWorkletNode(this.audioCtx, "nes-audio-processor", {
        outputChannelCount: [2],
      });
      this.node.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      // 处理浏览器自动播放策略
      if (this.audioCtx.state === "suspended") {
        this._resumeOnInteraction = () => {
          this.audioCtx.resume();
          this._removeResumeListeners();
        };
        document.addEventListener("keydown", this._resumeOnInteraction);
        document.addEventListener("mousedown", this._resumeOnInteraction);
      }
    } catch (e) {
      console.warn("音频初始化失败:", e);
    }
  }

  _removeResumeListeners() {
    if (this._resumeOnInteraction) {
      document.removeEventListener("keydown", this._resumeOnInteraction);
      document.removeEventListener("mousedown", this._resumeOnInteraction);
      this._resumeOnInteraction = null;
    }
  }

  /**
   * 写入一个音频采样（由 jsnes 每帧调用多次）
   */
  writeSample(left, right) {
    if (!this.node || this.muted) return;

    this.batchL[this.batchPos] = left;
    this.batchR[this.batchPos] = right;
    this.batchPos++;

    if (this.batchPos >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * 将缓冲区中的采样发送给 AudioWorklet
   */
  flush() {
    if (this.batchPos > 0 && this.node) {
      this.node.port.postMessage({
        type: "samples",
        left: this.batchL.slice(0, this.batchPos),
        right: this.batchR.slice(0, this.batchPos),
      });
      this.batchPos = 0;
    }
  }

  /**
   * 静音/取消静音
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.gainNode) {
      this.gainNode.gain.value = this.muted ? 0 : 1;
    }
    return this.muted;
  }

  /**
   * 停止音频系统
   */
  stop() {
    this._removeResumeListeners();
    if (this.node) {
      this.node.disconnect();
      this.node = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.batchPos = 0;
  }
}
