// Injected into the app page while recording demo clips: a large, high-contrast pointer with a soft
// halo, and a ring that expands on every click. Follows real mouse events, so it shows exactly what
// the scripted pointer does.
(() => {
  if (window.__demoCursor) return;
  window.__demoCursor = true;
  const mount = () => {
    const root = document.createElement("div");
    root.style.cssText =
      "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;transform:translate(-200px,-200px)";
    root.innerHTML = `
      <div data-halo style="position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;
        background:rgba(255,255,255,0.16);box-shadow:0 0 0 1.5px rgba(255,255,255,0.35) inset;
        transition:transform 140ms cubic-bezier(0.23,1,0.32,1),background 140ms"></div>
      <svg width="34" height="42" viewBox="0 0 34 42" style="position:absolute;left:-3px;top:-2px;
        filter:drop-shadow(0 3px 6px rgba(0,0,0,0.65))">
        <path d="M3 2 L3 31 L10.5 24.5 L15.5 37 L21 34.6 L16 22.5 L26 22.5 Z"
          fill="#ffffff" stroke="#0d0e12" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>`;
    document.documentElement.appendChild(root);
    const halo = root.querySelector("[data-halo]");
    const ring = (x, y) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${x - 12}px;top:${y - 12}px;width:24px;height:24px;border-radius:50%;
        border:3px solid #f5c26b;z-index:2147483646;pointer-events:none;opacity:0.95;
        transition:transform 520ms cubic-bezier(0.23,1,0.32,1),opacity 520ms ease-out`;
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => {
        r.style.transform = "scale(3.4)";
        r.style.opacity = "0";
      });
      setTimeout(() => r.remove(), 600);
    };
    addEventListener(
      "mousemove",
      (e) => {
        root.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      },
      true,
    );
    addEventListener(
      "mousedown",
      (e) => {
        halo.style.transform = "scale(0.7)";
        halo.style.background = "rgba(245,194,107,0.45)";
        ring(e.clientX, e.clientY);
      },
      true,
    );
    addEventListener(
      "mouseup",
      () => {
        halo.style.transform = "scale(1)";
        halo.style.background = "rgba(255,255,255,0.16)";
      },
      true,
    );
  };
  if (document.documentElement) mount();
  else addEventListener("DOMContentLoaded", mount);
})();
