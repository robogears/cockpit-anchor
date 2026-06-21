// Generates assets/tray.png (32px) and build/icon.png (256px) — a dark disc with a green ring.
// Run: node scripts/gen-icon.js   (pure Node, no deps; uses zlib.crc32)
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function makePng(W) {
  const C = (W - 1) / 2, R = W / 2;
  const raw = Buffer.alloc(W * (1 + W * 4));
  for (let y = 0; y < W; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const i = y * (1 + W * 4) + 1 + x * 4;
      const d = Math.hypot(x - C, y - C);
      let r = 0, g = 0, b = 0, a = 0;
      if (d <= R * 0.94)                  { r = 22; g = 27; b = 34; a = 255; }   // dark disc
      if (d >= R * 0.56 && d <= R * 0.81) { r = 63; g = 185; b = 80; a = 255; }  // green ring
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function write(rel, W) {
  const p = path.join(__dirname, '..', rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, makePng(W));
  console.log('wrote', rel, `(${W}px)`);
}

write('assets/tray.png', 32);
write('build/icon.png', 256);
