// Generates all app icons from geometry — no image libraries needed.
// Run: node tools/make-icons.mjs   (from repo root)
// Outputs: web/public/icons/*.png, web/public/apple-touch-icon.png, icons-src/icon-1024.png
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const GREEN = [20, 83, 45]; // #14532d
const AMBER = [251, 191, 36]; // #fbbf24
const WHITE = [255, 255, 255];

// Ship glyph from the app logo (24-unit viewBox):
// hull M3 14 l2-6 h14 l2 6 -9 4 z ; base m2 6 h14 v2 H5 z
const HULL = [[3, 14], [5, 8], [19, 8], [21, 14], [12, 18]];
const BASE = [[5, 20], [19, 20], [19, 22], [5, 22]];

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** coverage of the ship glyph at point (px,py), glyph centered at icon center */
function shipCoverage(px, py, s, ss) {
  const k = (0.56 * s) / 18; // glyph width 18 units -> 56% of icon
  const cx = s / 2, cy = s / 2;
  let hit = 0;
  for (let a = 0; a < ss; a++) {
    for (let b = 0; b < ss; b++) {
      const x = px + (a + 0.5) / ss, y = py + (b + 0.5) / ss;
      const gx = (x - cx) / k + 12, gy = (y - cy) / k + 15;
      if (inPoly(gx, gy, HULL) || inPoly(gx, gy, BASE)) hit++;
    }
  }
  return hit / (ss * ss);
}

function circleCoverage(px, py, s, r, ss) {
  const cx = s / 2, cy = s / 2;
  let hit = 0;
  for (let a = 0; a < ss; a++) {
    for (let b = 0; b < ss; b++) {
      const x = px + (a + 0.5) / ss - cx, y = py + (b + 0.5) / ss - cy;
      if (x * x + y * y <= r * r) hit++;
    }
  }
  return hit / (ss * ss);
}

/** maskable=false: transparent bg, green disc, amber ring, white ship.
 *  maskable=true:  full-bleed green square, ring+ship inside 80% safe zone. */
function render(size, { maskable }) {
  const ss = 3;
  const buf = Buffer.alloc(size * size * 4);
  const discR = maskable ? 0.42 * size : 0.46 * size;
  const ringOuter = discR + 0.045 * size;
  const setPx = (i, rgb, alpha) => {
    buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2];
    buf[i + 3] = Math.round(alpha * 255);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (maskable) {
        // full-bleed background, content confined to safe zone
        setPx(i, GREEN, 1);
        const ring = circleCoverage(x, y, size, ringOuter, ss) - circleCoverage(x, y, size, discR, ss);
        if (ring > 0) setPx(i, AMBER, Math.min(1, ring));
        const ship = shipCoverage(x, y, size, ss);
        if (ship > 0) setPx(i, WHITE, ship);
      } else {
        const disc = circleCoverage(x, y, size, discR, ss);
        if (disc > 0) setPx(i, GREEN, disc);
        const ring = circleCoverage(x, y, size, ringOuter, ss) - disc;
        if (ring > 0) setPx(i, AMBER, ring);
        const ship = shipCoverage(x, y, size, ss);
        if (ship > 0) setPx(i, WHITE, ship);
      }
    }
  }
  return buf;
}

// --- minimal PNG encoder (RGBA, filter 0) ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outputs = [
  ["web/public/icons/pwa-192x192.png", 192, { maskable: false }],
  ["web/public/icons/pwa-512x512.png", 512, { maskable: false }],
  ["web/public/icons/maskable-icon-512x512.png", 512, { maskable: true }],
  ["web/public/apple-touch-icon.png", 180, { maskable: true }],
  ["icons-src/icon-1024.png", 1024, { maskable: true }],
];

for (const [path, size, opts] of outputs) {
  mkdirSync(path.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(path, encodePng(size, render(size, opts)));
  console.log("wrote", path, `(${size}x${size})`);
}
