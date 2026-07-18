const assert = require("node:assert/strict");
const fs = require("node:fs");
const { detectRomCore } = require("../js/emulator.js");

assert.equal(detectRomCore(new ArrayBuffer(1), "game.nes"), "nes");
assert.equal(detectRomCore(new ArrayBuffer(1), "game.gb"), "gb");
assert.equal(detectRomCore(new ArrayBuffer(1), "game.gbc"), "gb");
assert.equal(detectRomCore(new ArrayBuffer(1), "game.gba"), "gba");
assert.equal(detectRomCore(new ArrayBuffer(1), "game.sfc"), "snes");
assert.equal(detectRomCore(new ArrayBuffer(1), "game.smc"), "snes");

const nesHeader = Uint8Array.from([0x4e, 0x45, 0x53, 0x1a]);
assert.equal(detectRomCore(nesHeader.buffer), "nes");

const gbaHeader = new Uint8Array(0xb3);
gbaHeader[0xb2] = 0x96;
assert.equal(detectRomCore(gbaHeader.buffer), "gba");

const referenceGba = "I:/口袋妖怪/GBA宝可梦剑盾3.0/POKEMON SW SH.gba";
if (fs.existsSync(referenceGba)) {
  const data = fs.readFileSync(referenceGba);
  assert.equal(detectRomCore(data, referenceGba), "gba");
}

assert.throws(
  () => detectRomCore(new ArrayBuffer(32), "unknown.bin"),
  /仅支持/,
);

console.log("EmulatorJS core detection tests passed");
