import { loadRegion, timeline } from "./src/lib/moon/horizon";
const DAY = 864e5;
const base = "file://" + process.cwd() + "/public";
const args = process.argv.slice(2);
const id = args[0];
const days = Number(args[1]);
const r = await loadRegion(base, id);
const g = r.meta.horizon;
console.log(id, g.width, g.height, g.step, g.mastHeight);
const stride = Number(args[2] ?? 12);
for (const ds of args.slice(3)) {
  const t = Date.parse(ds);
  let n = 0, surv = 0, survE25 = 0, survE60 = 0, any = 0;
  for (let row = 0; row < g.height; row += stride) for (let col = 0; col < g.width; col += stride) {
    const x = g.x0 + col * g.step, y = g.y0 + row * g.step;
    const tl = timeline(r, { x, y }, new Date(t), days * 24, 60);
    let soc = 3000, ok = true, e = 0, s = 0;
    for (let i = 0; i < tl.sunFraction.length; i++) {
      soc = Math.min(3000, soc + 1524 * tl.sunFraction[i] - 150);
      if (soc <= 0) ok = false;
      if (tl.earthFraction[i] > 0) e++;
      if (tl.sunFraction[i] > 0) s++;
    }
    n++;
    if (s > 0) any++;
    const ef = e / tl.sunFraction.length;
    if (ok) { surv++; if (ef >= 0.25) survE25++; if (ef >= 0.6) survE60++; }
  }
  console.log(ds, `n${n} anySun${any} surv${surv} survE25:${survE25} survE60:${survE60}`);
}
