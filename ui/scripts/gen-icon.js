// Generates the Cockpit Anchor app icons by rasterizing the anchor mark in pure Node (no deps):
//   build/icon.png   (256px) — dark rounded tile + cyan anchor (app / installer / window icon)
//   assets/tray.png  (32px)  — cyan anchor on transparent (system tray)
// The anchor geometry matches the in-app SVG logo (24x24 design space). Run: node scripts/gen-icon.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CYAN = [34, 211, 238];   // anchor stroke
const TILE = [12, 17, 23];     // dark tile fill
const BORDER = [22, 49, 58];   // muted cyan inner border

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// distance (design units) to the nearest anchor stroke centerline
function anchorDist(x, y) {
  let d = Math.abs(Math.hypot(x - 12, y - 4.5) - 2.4);          // ring
  d = Math.min(d, distSeg(x, y, 12, 6.9, 12, 20.5));            // shaft
  d = Math.min(d, distSeg(x, y, 8.2, 10, 15.8, 10));           // crossbar (stock)
  if (y >= 13.4) d = Math.min(d, Math.abs(Math.hypot(x - 12, y - 13.4) - 7)); // flukes (bottom half)
  d = Math.min(d, distSeg(x, y, 5, 13.4, 3.3, 12.4));          // left fluke tip
  d = Math.min(d, distSeg(x, y, 19, 13.4, 20.7, 12.4));        // right fluke tip
  return d;
}

// signed distance to a rounded rect centered at origin (negative inside)
function rrSDF(px, py, hw, hh, r) {
  const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => Math.round(a + (b - a) * t);

function makePng(W, withBg) {
  const raw = Buffer.alloc(W * (1 + W * 4));
  const scale = (W * (withBg ? 0.54 : 0.86)) / 24;   // px per design unit
  const c = (W - 1) / 2;
  const oy = c + W * 0.012;                            // nudge anchor down a hair
  const strokeHW = ((withBg ? 1.9 : 2.3) / 2) * scale;
  const tileR = W * 0.22, borderW = Math.max(1.4, W * 0.016);
  for (let y = 0; y < W; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const i = y * (1 + W * 4) + 1 + x * 4;
      let r = 0, g = 0, b = 0, a = 0;
      if (withBg) {
        const sd = rrSDF(x - c, y - c, W / 2, W / 2, tileR);
        const tileCov = clamp01(0.5 - sd); // ~1px AA at the tile edge
        if (tileCov > 0) {
          const col = sd > -borderW ? BORDER : TILE;
          r = col[0]; g = col[1]; b = col[2]; a = Math.round(255 * tileCov);
        }
      }
      const dx = 12 + (x - c) / scale;
      const dy = 11.3 + (y - oy) / scale;
      const dPx = anchorDist(dx, dy) * scale;
      const cov = clamp01((strokeHW + 0.6 - dPx) / 1.2); // ~1.2px AA band
      if (cov > 0) {
        r = mix(r, CYAN[0], cov); g = mix(g, CYAN[1], cov); b = mix(b, CYAN[2], cov);
        a = Math.max(a, Math.round(255 * cov));
      }
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

function write(rel, W, withBg) {
  const p = path.join(__dirname, '..', rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, makePng(W, withBg));
  console.log('wrote', rel, `(${W}px)`);
}

write('build/icon.png', 256, true);
write('assets/tray.png', 32, false);
