const assert = require("node:assert/strict");
const jsnes = require("../js/jsnes.min.js");

// In 8x16 mode, an odd tile number selects the second pattern table and
// clears bit 0 for the top tile. Tile $01 must therefore resolve to tile $100,
// not tile $0ff.
const nes = new jsnes.NES();
nes.mmap = {
  latchAccess() {},
  clockIrqCounter() {},
  onSpriteRender() {},
  onBgRender() {},
};

const ppu = nes.ppu;
ppu.f_spVisibility = 1;
ppu.f_spriteSize = 1;
ppu.ptTile[0xff].pix.fill(2);
ppu.ptTile[0x100].pix.fill(1);
ppu.sprPalette[1] = 0x111111;
ppu.sprPalette[2] = 0x222222;
ppu.startFrame();

const scanline = 1;
const oamOffset = scanline * 32;
ppu.scanlineSpriteCount[scanline] = 1;
ppu.scanlineSecondaryOAM.set([0, 1, 0, 0], oamOffset);
ppu.renderSpritesPartially(scanline, 1, 0);

assert.equal(
  ppu.buffer[scanline * 256],
  ppu.sprPalette[1],
  "odd 8x16 sprite tile should use the first tile in pattern table 1",
);

console.log("8x16 sprite pattern-table regression test passed");
