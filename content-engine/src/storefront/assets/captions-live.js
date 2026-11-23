// The captions step: draws a video's captions over its clean render while it plays, as the captions form is set
// right now, so every change is seen at once. The data (#cap-data) comes from src/skills/captions/live.ts and the
// drawing follows src/skills/captions/Captions.tsx: what is seen here is what Save draws into the video.
(() => {
  const data = document.getElementById("cap-data");
  const video = document.getElementById("cap-video");
  const layer = document.getElementById("cap-layer");
  const form = document.getElementById("cap-form");
  if (!data || !video || !layer || !form) return;
  const D = JSON.parse(data.textContent);

  layer.style.width = `${D.width}px`;
  layer.style.height = `${D.height}px`;
  const fit = () => (layer.style.transform = `scale(${video.clientWidth / D.width})`);
  new ResizeObserver(fit).observe(video);
  fit();

  const settings = () => {
    const f = new FormData(form);
    const hidden = new Set([...f.keys()].filter((k) => k.startsWith("hide_")).map((k) => k.slice(5)));
    return {
      show: f.get("show") === "on",
      font: f.get("font") || D.font,
      text: f.get("text_color") || "#ffffff",
      highlight: f.get("own_color") === "on" ? f.get("color") : D.accent,
      single: f.get("own_color") === "on" ? f.get("color") : D.singleColor,
      size: f.get("size"),
      place: f.get("place"),
      upper: f.get("case") === "upper",
      hidden,
    };
  };

  const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const alpha = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const esc = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const active = (t) => {
    let i = -1;
    for (let k = 0; k < D.words.length && D.words[k].s <= t; k++) i = k;
    return i;
  };
  // pages.ts pageAt: the first page is up from the first frame, the last stays to the end, a hidden beat shows nothing.
  const pageAt = (pages, t) => {
    if (!pages.length) return null;
    const first = pages[0];
    const last = pages[pages.length - 1];
    if (t < first.s) return first.l[0][0] === 0 ? first : null;
    for (const p of pages) if (t >= p.s - 0.05 && t < p.e) return p;
    return t >= last.e && last.l.at(-1).at(-1) === D.words.length - 1 ? last : null;
  };

  const box = document.createElement("div");
  box.style.cssText = "position:absolute;display:flex;align-items:center;justify-content:center";
  box.dir = D.rtl ? "rtl" : "ltr";
  layer.append(box);

  let drawn = "";
  const draw = () => {
    const s = settings();
    const t = video.currentTime;
    const now = active(t);
    const key = D.fonts[s.font] ? s.font : D.font;
    const face = `font-family:'cap-${key}';font-weight:${D.fonts[key].weight}`; // single quotes: it sits in a style="…" attribute
    const r = D.regions[s.place];
    let html = "";
    if (s.show && D.style === "single-word") {
      const w = D.words[now];
      const next = D.words[now + 1];
      const visible = w && !s.hidden.has(w.b) && (t <= w.e + 0.35 || (next && t < next.s && next.s - w.e < 0.35));
      Object.assign(box.style, { left: `${r.x}px`, width: `${r.w}px`, top: `${D.singleY[s.place] - 50}px`, height: "100px" });
      if (visible) html = `<div style="${face};font-size:${D.singleSizes[s.size]}px;line-height:1;white-space:nowrap;text-transform:${s.upper ? "uppercase" : "none"};color:${s.single};-webkit-text-stroke:8px rgba(20,16,12,0.92);paint-order:stroke fill">${esc(w.t.replace(/[,;:]$/, ""))}</div>`;
    } else if (s.show) {
      Object.assign(box.style, { left: `${r.x}px`, width: `${r.w}px`, top: `${r.y}px`, height: `${r.h}px` });
      const pages = D.pages[`${s.size}:${s.upper ? "upper" : "normal"}`].filter((p) => !s.hidden.has(D.words[p.l[0][0]].b));
      const page = pageAt(pages, t);
      if (page) {
        const onHighlight = luminance(s.highlight) > 0.45 ? "#121418" : "#ffffff";
        const lines = page.l.map((line) => {
          const spans = line.map((i) => {
            const on = i === now;
            const color = on ? onHighlight : i < now ? s.text : alpha(s.text, 0.82);
            return `<span style="${face};font-size:${D.sizes[s.size]}px;line-height:1.08;letter-spacing:${s.upper ? 0.5 : -0.5}px;text-transform:${s.upper ? "uppercase" : "none"};white-space:nowrap;color:${color};background:${on ? s.highlight : "transparent"};border-radius:18px;padding:2px 10px;margin:0 -10px;-webkit-text-stroke:${on ? 0 : 10}px rgba(0,0,0,0.85);paint-order:stroke fill;text-shadow:0 6px 18px rgba(0,0,0,0.45)">${esc(D.words[i].t)}</span>`;
          });
          return `<div style="display:flex;gap:${D.gap}px;flex-wrap:nowrap;justify-content:center;padding:0 10px">${spans.join("")}</div>`;
        });
        html = `<div style="max-width:${r.w}px;display:flex;flex-direction:column;align-items:center;gap:6px">${lines.join("")}</div>`;
      }
    }
    if (html !== drawn) {
      box.innerHTML = html;
      drawn = html;
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
})();
