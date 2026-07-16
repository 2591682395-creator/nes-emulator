class PersistentSaveManager {
  constructor({ emulator, onStatus = () => {} }) {
    this.emulator = emulator;
    this.onStatus = onStatus;
    this.context = null;
    this.lastHash = null;
    this.timer = null;
    this.dbPromise = this.openDatabase();
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("childhood-arcade-saves", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("saves", { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async romHash(romData) {
    const digest = await crypto.subtle.digest("SHA-256", romData);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  token() {
    return localStorage.getItem("user_token") || localStorage.getItem("admin_token") || "";
  }

  async setGame({ gameId, romData, core, title }) {
    await this.flush();
    const romHash = await this.romHash(romData);
    this.context = { gameId: gameId || null, romHash, core, title };
    this.lastHash = null;
    return this.context;
  }

  key() {
    if (!this.context) return null;
    const user = JSON.parse(localStorage.getItem("user_data") || localStorage.getItem("admin_user") || "null");
    const owner = user?.id || "guest";
    return `${owner}:${this.context.gameId || "local"}:${this.context.romHash}:auto`;
  }

  async readLocal() {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const request = db.transaction("saves", "readonly").objectStore("saves").get(this.key());
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async writeLocal(record) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const request = db.transaction("saves", "readwrite").objectStore("saves").put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async readCloud() {
    if (!this.token() || !this.context?.gameId) return null;
    const params = new URLSearchParams({ rom_hash: this.context.romHash, slot: "auto" });
    const response = await fetch(`/api/cloud-saves/${this.context.gameId}?${params}`, { headers: { Authorization: `Bearer ${this.token()}` } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("云存档读取失败");
    const payload = await response.json();
    return payload.data || null;
  }

  async restore() {
    if (!this.context) return false;
    let local = await this.readLocal().catch(() => null);
    let cloud = await this.readCloud().catch(error => { console.warn(error); return null; });
    const selected = [local, cloud].filter(Boolean).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
    if (!selected?.save) return false;
    await this.emulator.importSave(selected.save);
    this.lastHash = await this.dataHash(selected.save.data);
    if (cloud && (!local || new Date(cloud.updated_at) > new Date(local.updated_at))) {
      await this.writeLocal({ ...cloud, key: this.key() }).catch(() => {});
    }
    this.onStatus(this.token() ? "云存档已恢复" : "本地存档已恢复");
    return true;
  }

  async dataHash(data) {
    const bytes = new TextEncoder().encode(data);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async flush() {
    if (!this.context || !this.emulator.ready) return false;
    try {
      const save = await this.emulator.exportSave();
      if (!save?.data) return false;
      const contentHash = await this.dataHash(save.data);
      if (contentHash === this.lastHash) return false;
      const updatedAt = new Date().toISOString();
      const record = { key: this.key(), game_id: this.context.gameId, rom_hash: this.context.romHash, core: this.context.core, slot: "auto", save, updated_at: updatedAt };
      await this.writeLocal(record);
      this.lastHash = contentHash;
      this.onStatus("存档已保存到本机");
      if (this.token() && this.context.gameId) this.writeCloud(record).catch(error => console.warn("云同步失败:", error));
      return true;
    } catch (error) {
      console.warn("自动存档失败:", error);
      return false;
    }
  }

  async writeCloud(record) {
    const response = await fetch(`/api/cloud-saves/${this.context.gameId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token()}` },
      body: JSON.stringify({ rom_hash: record.rom_hash, core: record.core, slot: record.slot, save: record.save }),
    });
    if (!response.ok) throw new Error("云端上传失败");
    this.onStatus("云存档已同步");
  }

  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.flush(), 30000);
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.flush(); });
    window.addEventListener("pagehide", () => this.flush());
  }
}
