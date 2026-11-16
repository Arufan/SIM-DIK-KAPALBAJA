// Converts the indexed-color UBJ logo to RGBA and (if the background is
// opaque) chroma-keys it out with a soft edge. Pure Node built-ins.
// Run: node tools/clean-ubj-logo.mjs <in.png> <out.png>
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const [src, dst] = process.argv.slice(2);
const png = readFileSync(src);
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
const bitDepth = png[24];
const colorType = png[25];
const interlace = png[28];
if (bitDepth !== 8 || interlace !== 0) throw new Error("unsupported PNG");

let pos = 8;
let palette = null;
let trns = null;
const idat = [];
while (pos < png.length) {
  const len = png.readUInt32BE(pos);
  const type = png.toString("ascii", pos + 4, pos + 8);
  const data = png.subarray(pos + 8, pos + 8 + len);
  if (type === "PLTE") palette = data;
  else if (type === "tRNS") trns = data;
  else if (type === "IDAT") idat.push(data);
  pos += 12 + len;
}
const raw = inflateSync(Buffer.concat(idat));
const bpp = colorType === 6 ? 4 : 1; // RGBA or palette index
const stride = width * bpp;
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
    const a = x >= bpp ? px[o + x - bpp] : 0;
    const b = y > 0 ? px[o - stride + x] : 0;
    const c = x >= bpp && y > 0 ? px[o - stride + x - bpp] : 0;
    let v = row[x];
    if (filter === 1) v += a;
    else if (filter === 2) v += b;
    else if (filter === 3) v += (a + b) >> 1;
    else if (filter === 4) v += paeth(a, b, c);
    px[o + x] = v & 0xff;
  }
}

// build RGBA
const rgba = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  let r, g, b, a = 255;
  if (colorType === 6) {
    r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3];
  } else if (colorType === 3 && palette) {
    const idx = px[i];
    r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2];
    if (trns && idx < trns.length) a = trns[idx];
  } else if (colorType === 2) {
    r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2];
  } else {
    throw new Error("unsupported colorType " + colorType);
  }
  rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
}

// chroma-key the background if it is opaque: sample the four corners
const corner = (x, y) => { const i = (y * width + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]]; };
const corners = [corner(0, 0), corner(width - 1, 0), corner(0, height - 1), corner(width - 1, height - 1)];
const opaque = corners.every((c) => c[3] === 255);
const same = corners.every((c) => Math.abs(c[0] - corners[0][0]) + Math.abs(c[1] - corners[0][1]) + Math.abs(c[2] - corners[0][2]) < 24);
if (opaque && same) {
  const [br, bg, bb] = corners[0];
  const TOL = 60; // soft edge radius in RGB distance
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const d = Math.hypot(r - br, g - bg, b - bb);
    if (d < TOL) {
      rgba[i * 4 + 3] = Math.round((d / TOL) * 255); // feather
    }
  }
  console.log(`background keyed out (rgb ${br},${bg},${bb})`);
} else {
  console.log("corners uniform/opaque =", opaque && same, "— left as-is");
}

// ----- encode RGBA PNG -----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
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
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const rawOut = Buffer.alloc(height * (width * 4 + 1));
for (let y = 0; y < height; y++) {
  rawOut[y * (width * 4 + 1)] = 0;
  rgba.copy(rawOut, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
}
writeFileSync(dst, Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(rawOut, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]));
console.log("wrote", dst);