/** Minimal 8-bit RGB PNG encoder (zlib from node:zlib, no dependencies). */
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** rgb: width * height * 3 bytes, row 0 = top of the image. Per-row filter chosen by min sum |byte|. */
export function encodePngRgb(
  width: number,
  height: number,
  rgb: Uint8Array,
): Uint8Array {
  const stride = width * 3;
  const raw = new Uint8Array(height * (stride + 1));
  const zero = new Uint8Array(stride);
  const cand = Array.from({ length: 5 }, () => new Uint8Array(stride));
  for (let y = 0; y < height; y++) {
    const row = rgb.subarray(y * stride, (y + 1) * stride);
    const up = y === 0 ? zero : rgb.subarray((y - 1) * stride, y * stride);
    let bestF = 0;
    let bestCost = Infinity;
    for (let f = 0; f < 5; f++) {
      const o = cand[f];
      let cost = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 3 ? row[i - 3] : 0;
        const b = up[i];
        const c = i >= 3 ? up[i - 3] : 0;
        let pred = 0;
        if (f === 1) pred = a;
        else if (f === 2) pred = b;
        else if (f === 3) pred = (a + b) >> 1;
        else if (f === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        const v = (row[i] - pred) & 0xff;
        o[i] = v;
        cost += v < 128 ? v : 256 - v;
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestF = f;
      }
    }
    raw[y * (stride + 1)] = bestF;
    raw.set(cand[bestF], y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit, RGB, deflate, adaptive filter, no interlace
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
