/**
 * Turns a recorded screencast (JPEG frames + timestamps.json, 2560 px wide) into a looping GIF and an MP4.
 *
 *   bun deck/clip.ts <castDir> <outBase> '<json spec>'
 *
 * spec: { zoom: number, keys: [{ t: seconds, x: px, y: px }], trim?: [start, end], width?: number, fps?: number }
 * The crop window is (2560 / zoom) wide, 16:10, and eases between `keys` (top-left corner in source px).
 */
import { $ } from "bun";

const [castDir, outBase, specJson] = process.argv.slice(2);
const spec = JSON.parse(specJson) as {
  zoom: number;
  keys: { t: number; x: number; y: number }[];
  trim?: [number, number];
  width?: number;
  fps?: number;
};

const SRC_W = 2560;
const SRC_H = 1600;
const stamps: number[] = await Bun.file(`${castDir}/timestamps.json`).json();
const t0 = stamps[0];
const total = stamps[stamps.length - 1] - t0;
const [start, end] = spec.trim ?? [0, total];

// concat list with real per-frame durations (screencast frames arrive irregularly)
let list = "";
for (let i = 0; i < stamps.length; i++) {
  const dur = i + 1 < stamps.length ? stamps[i + 1] - stamps[i] : 0.05;
  list += `file '${castDir}/f${String(i).padStart(5, "0")}.jpg'\nduration ${dur.toFixed(4)}\n`;
}
await Bun.write(`${outBase}.txt`, list);

const cw = Math.round(SRC_W / spec.zoom / 2) * 2;
const ch = Math.round((cw * 10) / 16 / 2) * 2;
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));

// piecewise smoothstep between keys, as an ffmpeg expression of t (t is relative to the trimmed clip)
function track(axis: "x" | "y", max: number): string {
  const keys = spec.keys.map((k) => ({ t: k.t - start, v: clamp(k[axis], max) }));
  let expr = `${keys[keys.length - 1].v}`;
  for (let i = keys.length - 2; i >= 0; i--) {
    const a = keys[i];
    const b = keys[i + 1];
    const u = `((t-${a.t.toFixed(3)})/${(b.t - a.t).toFixed(3)})`;
    expr = `if(lt(t,${b.t.toFixed(3)}),${a.v}+(${b.v - a.v})*(3*${u}*${u}-2*${u}*${u}*${u}),${expr})`;
  }
  return `if(lt(t,${keys[0].t.toFixed(3)}),${keys[0].v},${expr})`;
}

const fps = spec.fps ?? 20;
const width = spec.width ?? 1280;
const crop = `crop=${cw}:${ch}:'${track("x", SRC_W - cw)}':'${track("y", SRC_H - ch)}'`;
const base = `trim=${start}:${end},setpts=PTS-STARTPTS,fps=${fps},${crop},scale=${width}:-2:flags=lanczos`;

await $`ffmpeg -y -loglevel error -f concat -safe 0 -i ${outBase}.txt -vf ${base} -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart ${outBase}.mp4`;
await $`ffmpeg -y -loglevel error -i ${outBase}.mp4 -filter_complex ${"split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle"} -loop 0 ${outBase}.gif`;

const size = (p: string) => `${(Bun.file(p).size / 1e6).toFixed(1)} MB`;
console.log(
  `${outBase}: ${(end - start).toFixed(1)} s, crop ${cw}x${ch}, gif ${size(`${outBase}.gif`)}, mp4 ${size(`${outBase}.mp4`)}`,
);
