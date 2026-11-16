// Generates PWA/apple icons from the real club logo (PNG RGBA) using only
// Node built-ins: inflate -> unfilter -> premultiplied bilinear scale -> deflate.
// Run: node tools/make-icons-from-logo.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const SRC = "web/public/logo_kb.png";
const BG = [7, 28, 20]; // #071c14

// ---------- PNG decode (RGBA8, non-interlaced) ----------
const png = readFileSync(SRC);
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
const bitDepth = png[24], colorType = png[25], interlace = png[28];
if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
  throw new Error(`unsupported PNG (bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace})`);
}
let pos = 8;
const idat = [];
while (pos < png.length) {
  const len = png.readUInt32BE(pos);
  const type = png.toString("ascii", pos + 4, pos + 8);
  if (type === "IDAT") idat.push(png.subarray(pos + 8, pos + 8 + len));
  pos += 12 + len;
}
const raw = inflateSync(Buffer.concat(idat));
const stride = width * 4;
const px = Buffer.alloc(height * stride);
let rp = 0;
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
for (let y = 0; y < height; y++) {
  const filter = raw[rp++];
  const row = raw.subarray(rp, rp + stride);
  rp += stride;
  const o = y * stride;
  for (let x = 0; x < stride; x++) {
    const a = x >= 4 ? px[o + x - 4] : 0;
    const b = y > 0 ? px[o - stride + x] : 0;
    const c = x >= 4 && y > 0 ? px[o - stride + x - 4] : 0;
    let v = row[x];
    if (filter === 1) v += a;
    else if (filter === 2) v += b;
    else if (filter === 3) v += (a + b) >> 1;
    else if (filter === 4) v += paeth(a, b, c);
    px[o + x] = v & 0xff;
  }
}

// ---------- premultiplied bilinear scale ----------
function sample(x, y, ch) {
  x = Math.max(0, Math.min(width - 1, x));
  y = Math.max(0, Math.min(height - 1, y));
  return px[(y * width + x) * 4 + ch];
}
function scale(size, offset) {
  const out = Buffer.alloc(size * size * 4);
  const scaleRatio = size / width;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x / scaleRatio, sy = y / scaleRatio;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const acc = [0, 0, 0, 0];
      for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const a = sample(x0 + dx, y0 + dy, 3) / 255;
        acc[0] += sample(x0 + dx, y0 + dy, 0) * a * w;
        acc[1] += sample(x0 + dx, y0 + dy, 1) * a * w;
        acc[2] += sample(x0 + dx, y0 + dy, 2) * a * w;
        acc[3] += a * w;
      }
      const i = (y * size + x) * 4;
      const a = acc[3];
      if (a > 0.0001) {
        out[i] = Math.round(acc[0] / a);
        out[i + 1] = Math.round(acc[1] / a);
        out[i + 2] = Math.round(acc[2] / a);
      }
      out[i + 3] = Math.round(a * 255);
    }
  }
  return out;
}
function scaleInto(canvas, canvasSize, logoSize, logo) {
  const off = Math.floor((canvasSize - logoSize) / 2);
  for (let y = 0; y < logoSize; y++) {
    for (let x = 0; x < logoSize; x++) {
      const si = (y * logoSize + x) * 4;
      const di = ((y + off) * canvasSize + (x + off)) * 4;
      const a = logo[si + 3] / 255;
      // composite logo over solid BG
      canvas[di] = Math.round(logo[si] * a + BG[0] * (1 - a));
      canvas[di + 1] = Math.round(logo[si + 1] * a + BG[1] * (1 - a));
      canvas[di + 2] = Math.round(logo[si + 2] * a + BG[2] * (1 - a));
      canvas[di + 3] = 255;
    }
  }
}

// ---------- PNG encode ----------
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
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rawOut = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rawOut[y * (size * 4 + 1)] = 0;
    rgba.copy(rawOut, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rawOut, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("web/public/icons", { recursive: true });
const logo512 = scale(512, 0);
// "any" icons: transparent background (logo already has a circular emblem)
writeFileSync("web/public/icons/pwa-192x192.png", encodePng(192, scale(192, 0)));
writeFileSync("web/public/icons/pwa-512x512.png", encodePng(512, logo512));
// maskable: full-bleed dark green, logo inside the 80% safe zone
const maskable = Buffer.alloc(512 * 512 * 4);
for (let i = 0; i < 512 * 512; i++) {
  maskable[i * 4] = BG[0];
  maskable[i * 4 + 1] = BG[1];
  maskable[i * 4 + 2] = BG[2];
  maskable[i * 4 + 3] = 255;
}
scaleInto(maskable, 512, 400, logo512);
writeFileSync("web/public/icons/maskable-icon-512x512.png", encodePng(512, maskable));
// apple touch icon: full-bleed (iOS applies its own rounding)
writeFileSync("web/public/apple-touch-icon.png", encodePng(180, (() => {
  const canvas = Buffer.alloc(180 * 180 * 4);
  for (let i = 0; i < 180 * 180; i++) {
    canvas[i * 4] = BG[0];
    canvas[i * 4 + 1] = BG[1];
    canvas[i * 4 + 2] = BG[2];
    canvas[i * 4 + 3] = 255;
  }
  scaleInto(canvas, 180, 150, scale(150, 0));
  return canvas;
})()));
// favicon
writeFileSync("web/public/favicon.png", encodePng(48, scale(48, 0)));
console.log("icons generated from logo_kb.png");