// Records demo clips of the app for the pitch deck. Used from an eval `tab.run` with a raw Puppeteer page.
// The app runs in a 1280x800 iframe scaled 2x, so the UI keeps its desktop layout while the screencast
// captures 2560x1600 frames (input for deck/clip.ts). Pointer moves are eased so the demo cursor glides.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const CURSOR = new URL("./cursor.js", import.meta.url).pathname;

export async function stage(page, base) {
  const cdp = await page.createCDPSession();
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: 2760, height: 1800 } });
  await page.setViewport({ width: 2560, height: 1600, deviceScaleFactor: 1 });
  const cursor = await Bun.file(CURSOR).text();
  // raw CDP: the harness runs page.evaluate in an isolated world, but the app's globals live in the main world
  await cdp.send("Page.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (window !== window.top) {
    Object.defineProperty(window, "devicePixelRatio", { get: () => 2 });
    try { localStorage.setItem("malapert.welcome.seen", "1"); localStorage.setItem("malapert.luna-bot.intro", "1"); } catch {}
    const css = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
    if (document.documentElement) css(); else addEventListener("DOMContentLoaded", css);
    ${cursor}
  }`,
  });
  // same-origin top page: about:blank cannot embed the app
  await page.goto(`${base}robots.txt`).catch(() => {});
  await page.setContent(
    `<html><body style="margin:0;background:#000;overflow:hidden"><iframe src="${base}" style="border:0;width:1280px;height:800px;transform:scale(2);transform-origin:0 0"></iframe></body></html>`,
  );
  const s = { page, cdp, x: 640, y: 400 };
  for (let i = 0; i < 600; i++) {
    if (await app(s, (w) => !!w.__app).catch(() => false)) return s;
    await sleep(100);
  }
  throw new Error("app did not load");
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** run `fn(iframeWindow, ...args)` in the page's main world; returns the JSON value */
export async function app(s, fn, ...args) {
  const expression = `(async () => (${fn})(document.querySelector("iframe").contentWindow, ...${JSON.stringify(args)}))()`;
  const r = await s.cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

/** centre of the innermost visible element matching `sel` (and containing `text`), in iframe CSS px */
export async function at(s, sel, text) {
  return app(
    s,
    (w, sel, text) => {
      const els = [...w.document.querySelectorAll(sel)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (!text || e.textContent.trim().includes(text));
      });
      const el = text ? els.sort((a, b) => a.textContent.length - b.textContent.length)[0] : els[0];
      if (!el) return null;
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    sel,
    text ?? null,
  );
}
export async function move(s, x, y, ms = 700) {
  const n = Math.max(2, Math.round(ms / 16));
  const x0 = s.x;
  const y0 = s.y;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
    await mouse(s, "mouseMoved", (x0 + (x - x0) * e) * 2, (y0 + (y - y0) * e) * 2);
    await sleep(16);
  }
  s.x = x;
  s.y = y;
}

function mouse(s, type, x, y) {
  return s.cdp.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
}

export async function click(s, x, y, ms) {
  await move(s, x, y, ms);
  await sleep(150);
  await mouse(s, "mousePressed", x * 2, y * 2);
  await sleep(90);
  await mouse(s, "mouseReleased", x * 2, y * 2);
}

/** type text with a human cadence into the focused element */
export async function type(s, text, msPerChar = 45) {
  for (const ch of text) {
    await s.cdp.send("Input.insertText", { text: ch });
    await sleep(msPerChar);
  }
}

export async function key(s, k) {
  const code = { Enter: 13 }[k];
  await s.cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: code, text: k === "Enter" ? "\r" : undefined });
  await s.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code });
}

export async function clickEl(s, sel, text, ms) {
  const p = await at(s, sel, text);
  if (!p) throw new Error(`not found: ${sel} ${text ?? ""}`);
  await click(s, p.x, p.y, ms);
}

export async function startCast(s, dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const stamps = [];
  const onFrame = async ({ data, metadata, sessionId }) => {
    writeFileSync(`${dir}/f${String(stamps.length).padStart(5, "0")}.jpg`, Buffer.from(data, "base64"));
    stamps.push(metadata.timestamp);
    await s.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  };
  s.cdp.on("Page.screencastFrame", onFrame);
  await s.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 2560, maxHeight: 1600 });
  const t0 = Date.now();
  return {
    t: () => (Date.now() - t0) / 1000,
    stop: async () => {
      await s.cdp.send("Page.stopScreencast");
      s.cdp.off("Page.screencastFrame", onFrame);
      writeFileSync(`${dir}/timestamps.json`, JSON.stringify(stamps));
      return { frames: stamps.length, seconds: stamps.length ? stamps.at(-1) - stamps[0] : 0 };
    },
  };
}
