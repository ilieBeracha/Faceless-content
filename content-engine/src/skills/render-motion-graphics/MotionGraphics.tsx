import React, { useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFor } from "../../render/fonts.ts";
import { useQaProbe } from "../../render/qa-probe.ts";
import { characterRect, clamp, easeOut, hash01, regions } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps, Rect } from "../../render/types.ts";
import type { MgBeatVisual, MgElement, MgScene } from "./schema.ts";

type Font = ReturnType<typeof fontFor>;

interface Ctx {
  t: number; // seconds since the element started appearing
  font: Font;
  text: string;
  accent: string;
  primary: string;
  palette: string[];
  probe: boolean;
  id: string;
  width: number;
}

/** Height each element type wants (px at 1080 wide). */
function elementHeight(el: MgElement): number {
  switch (el.type) {
    case "title":
      return el.size === "xl" ? 190 : el.size === "lg" ? 150 : 110;
    case "counter":
      return el.label ? 290 : 220;
    case "compare":
      return el.mode === "bars" ? 110 * el.items.length + 20 : 470;
    case "list":
      return 104 * el.items.length;
    case "orb":
      return (el.size === "l" ? 420 : el.size === "m" ? 320 : 220) + (el.label ? 70 : 0);
    case "timeline":
      return 250;
    case "fact-card":
      return 280;
    case "icon-row":
      return (Math.ceil(el.count / 10) * 82 + (el.label ? 70 : 0)) + 10;
    case "arrow-flow":
      return 150 * Math.ceil(el.steps.length / 2) + 20;
  }
}

const Probe: React.FC<{ ctx: Ctx; suffix: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ ctx, suffix, style, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(ctx.probe && ctx.t > 0.4, ref, `${ctx.id}:${suffix}`, "text");
  return (
    <div ref={ref} style={{ display: "inline-block", whiteSpace: "nowrap", ...style }}>
      {children}
    </div>
  );
};

function Title({ el, ctx }: { el: Extract<MgElement, { type: "title" }>; ctx: Ctx }) {
  const size = el.size === "xl" ? 128 : el.size === "lg" ? 100 : 76;
  const words = el.text.split(" ");
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Probe ctx={ctx} suffix="title" style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: size, color: ctx.text, lineHeight: 1.05, letterSpacing: -1, textShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
        {words.map((w, i) => {
          const k = easeOut((ctx.t - i * 0.08) / 0.3);
          return (
            <span key={i} style={{ display: "inline-block", marginRight: i < words.length - 1 ? size * 0.25 : 0, opacity: k, transform: `translateY(${(1 - k) * 40}px) scale(${0.8 + 0.2 * k})` }}>
              {w}
            </span>
          );
        })}
      </Probe>
    </div>
  );
}

function Counter({ el, ctx }: { el: Extract<MgElement, { type: "counter" }>; ctx: Ctx }) {
  const k = easeOut(ctx.t / 1.4);
  const value = el.from + (el.to - el.from) * k;
  const shown = value.toLocaleString("en-US", { minimumFractionDigits: el.decimals, maximumFractionDigits: el.decimals });
  const pop = 1 + 0.06 * Math.max(0, Math.sin(clamp((ctx.t - 1.4) / 0.25) * Math.PI));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: clamp(ctx.t / 0.2) }}>
      <Probe ctx={ctx} suffix="counter" style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: shown.length > 9 ? 120 : 160, color: ctx.accent, lineHeight: 1, transform: `scale(${pop})`, textShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
        {el.prefix}
        {shown}
        <span style={{ fontSize: "0.45em", marginLeft: 12, color: ctx.text }}>{el.suffix}</span>
      </Probe>
      {el.label && (
        <Probe ctx={ctx} suffix="counter-label" style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.regular, fontSize: 46, color: ctx.text, marginTop: 18, opacity: clamp((ctx.t - 0.3) / 0.3) }}>
          {el.label}
        </Probe>
      )}
    </div>
  );
}

function Compare({ el, ctx, area }: { el: Extract<MgElement, { type: "compare" }>; ctx: Ctx; area: Rect }) {
  const max = Math.max(...el.items.map((i) => i.value));
  if (el.mode === "bars") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 26, width: area.w * 0.9, margin: "0 auto" }}>
        {el.items.map((item, i) => {
          const k = easeOut((ctx.t - i * 0.25) / 0.7);
          const color = item.color ?? ctx.palette[i % ctx.palette.length];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Probe ctx={ctx} suffix={`bar-label-${i}`} style={{ width: 230, textAlign: "right", fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 40, color: ctx.text }}>
                {item.label}
              </Probe>
              <div style={{ flex: 1, height: 70, background: "rgba(255,255,255,0.08)", borderRadius: 35, overflow: "hidden" }}>
                <div style={{ width: `${(item.value / max) * 100 * k}%`, height: "100%", background: color, borderRadius: 35 }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  // circles: area-true (radius ∝ √value), sitting on a shared baseline
  const maxR = Math.min(area.w / (el.items.length === 2 ? 2.4 : 3.1), 230);
  const radii = el.items.map((i) => Math.max(10, maxR * Math.sqrt(i.value / max)));
  const total = radii.reduce((a, b) => a + b * 2, 0) + 40 * (el.items.length - 1);
  let x = (area.w - total) / 2;
  const baseline = maxR * 2 + 20;
  return (
    <div style={{ position: "relative", width: area.w, height: 470, margin: "0 auto" }}>
      {el.items.map((item, i) => {
        const r = radii[i];
        const cx = x + r;
        x += r * 2 + 40;
        const k = easeOut((ctx.t - i * 0.35) / 0.6);
        const color = item.color ?? ctx.palette[i % ctx.palette.length];
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: cx - r, top: baseline - 2 * r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, ${color}, ${color}cc 60%, ${color}88)`, boxShadow: `0 0 40px ${color}55`, transform: `scale(${k})`, transformOrigin: "50% 100%" }} />
            <div style={{ position: "absolute", left: cx - 160, width: 320, top: baseline + 18, display: "flex", justifyContent: "center", opacity: clamp(k * 2 - 0.5) }}>
              <Probe ctx={ctx} suffix={`compare-${i}`} style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 38, color: ctx.text, textAlign: "center" }}>
                {item.label}
                {el.show_values && <span style={{ fontWeight: ctx.font.regular, opacity: 0.8 }}>{` ${item.value.toLocaleString("en-US")}${el.unit ? " " + el.unit : ""}`}</span>}
              </Probe>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function List({ el, ctx }: { el: Extract<MgElement, { type: "list" }>; ctx: Ctx }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start", margin: "0 auto", width: "86%" }}>
      {el.items.map((item, i) => {
        const k = easeOut((ctx.t - i * 0.5) / 0.35);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, opacity: k, transform: `translateX(${(1 - k) * -60}px)` }}>
            <div style={{ width: 70, height: 70, borderRadius: 35, background: ctx.accent, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 38, flexShrink: 0 }}>{el.numbered ? i + 1 : "✓"}</div>
            <Probe ctx={ctx} suffix={`list-${i}`} style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 48, color: ctx.text }}>
              {item}
            </Probe>
          </div>
        );
      })}
    </div>
  );
}

function Orb({ el, ctx }: { el: Extract<MgElement, { type: "orb" }>; ctx: Ctx }) {
  const d = el.size === "l" ? 380 : el.size === "m" ? 280 : 190;
  const k = easeOut(ctx.t / 0.5);
  const accent = el.accent ?? "#ffffff";
  const spin = (ctx.t * 18) % 360;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: d * 1.7, height: d, transform: `scale(${k})` }}>
        {el.ring && <div style={{ position: "absolute", left: 0, top: d * 0.38, width: d * 1.7, height: d * 0.24, borderRadius: "50%", border: `10px solid ${accent}aa`, transform: "rotate(-12deg)", boxSizing: "border-box" }} />}
        <div style={{ position: "absolute", left: d * 0.35, top: 0, width: d, height: d, borderRadius: "50%", overflow: "hidden", background: `radial-gradient(circle at 32% 28%, ${lighten(el.color)}, ${el.color} 45%, ${darken(el.color)} 100%)`, boxShadow: el.glow ? `0 0 ${d * 0.35}px ${el.color}aa` : "0 20px 50px rgba(0,0,0,0.4)" }}>
          {el.bands &&
            [0.22, 0.38, 0.55, 0.7].map((y, i) => <div key={i} style={{ position: "absolute", left: -d * 0.2 + ((spin + i * 40) % 40) - 20, top: d * y, width: d * 1.4, height: d * (0.05 + (i % 2) * 0.04), background: `${accent}55`, borderRadius: d }} />)}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 70% 75%, rgba(0,0,0,0.0), rgba(0,0,0,0.35))" }} />
        </div>
        {el.ring && <div style={{ position: "absolute", left: 0, top: d * 0.38, width: d * 1.7, height: d * 0.24, borderRadius: "50%", borderBottom: `10px solid ${accent}dd`, transform: "rotate(-12deg)", boxSizing: "border-box" }} />}
      </div>
      {el.label && (
        <Probe ctx={ctx} suffix="orb-label" style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 48, color: ctx.text, marginTop: 18, opacity: clamp((ctx.t - 0.3) / 0.3) }}>
          {el.label}
        </Probe>
      )}
    </div>
  );
}

function Timeline({ el, ctx, area }: { el: Extract<MgElement, { type: "timeline" }>; ctx: Ctx; area: Rect }) {
  const w = area.w * 0.86;
  const lineK = easeOut(ctx.t / 0.6);
  return (
    <div style={{ position: "relative", width: w, height: 250, margin: "0 auto" }}>
      <div style={{ position: "absolute", left: 0, top: 120, width: w * lineK, height: 8, borderRadius: 4, background: ctx.accent }} />
      {el.items.map((item, i) => {
        const x = el.items.length === 1 ? w / 2 : (i / (el.items.length - 1)) * (w - 40) + 20;
        const k = easeOut((ctx.t - 0.3 - i * 0.4) / 0.3);
        return (
          <div key={i} style={{ position: "absolute", left: x - 110, width: 220, top: 0, height: 250, display: "flex", flexDirection: "column", alignItems: "center", opacity: k }}>
            <Probe ctx={ctx} suffix={`tl-v-${i}`} style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 46, color: ctx.accent, height: 90, display: "flex", alignItems: "flex-end" }}>
              {item.value}
            </Probe>
            <div style={{ width: 34, height: 34, borderRadius: 17, background: ctx.text, border: `8px solid ${ctx.accent}`, marginTop: 6, transform: `scale(${k})` }} />
            <Probe ctx={ctx} suffix={`tl-l-${i}`} style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.regular, fontSize: 32, color: ctx.text, marginTop: 14, whiteSpace: "normal", textAlign: "center", width: 210 }}>
              {item.label}
            </Probe>
          </div>
        );
      })}
    </div>
  );
}

function FactCard({ el, ctx, area }: { el: Extract<MgElement, { type: "fact-card" }>; ctx: Ctx; area: Rect }) {
  const k = easeOut(ctx.t / 0.45);
  return (
    <div style={{ width: area.w * 0.88, margin: "0 auto", padding: "34px 40px", boxSizing: "border-box", borderRadius: 36, background: "rgba(255,255,255,0.1)", border: `5px solid ${ctx.accent}`, transform: `rotate(${(1 - k) * -4}deg) scale(${0.9 + 0.1 * k})`, opacity: k }}>
      {el.kicker && <div style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 34, color: ctx.accent, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>{el.kicker}</div>}
      <FactText ctx={ctx} text={el.text} />
    </div>
  );
}

const FactText: React.FC<{ ctx: Ctx; text: string }> = ({ ctx, text }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(ctx.probe && ctx.t > 0.4, ref, `${ctx.id}:fact`, "text");
  return (
    <div ref={ref} style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 50, lineHeight: 1.15, color: ctx.text }}>
      {text}
    </div>
  );
};

const SYMBOL: Record<string, (c: string) => React.ReactNode> = {
  dot: (c) => <circle cx="30" cy="30" r="22" fill={c} />,
  circle: (c) => <circle cx="30" cy="30" r="20" fill="none" stroke={c} strokeWidth="8" />,
  square: (c) => <rect x="9" y="9" width="42" height="42" rx="8" fill={c} />,
  star: (c) => <path d="M30 5 L37 22 L55 23 L41 35 L46 53 L30 43 L14 53 L19 35 L5 23 L23 22 Z" fill={c} />,
  heart: (c) => <path d="M30 52 C5 35 5 12 20 10 C26 9 30 14 30 18 C30 14 34 9 40 10 C55 12 55 35 30 52 Z" fill={c} />,
  bolt: (c) => <path d="M34 4 L12 34 H28 L24 56 L48 24 H32 Z" fill={c} />,
  drop: (c) => <path d="M30 6 C40 22 48 32 48 40 A18 18 0 0 1 12 40 C12 32 20 22 30 6 Z" fill={c} />,
};

function IconRow({ el, ctx }: { el: Extract<MgElement, { type: "icon-row" }>; ctx: Ctx }) {
  const color = el.color ?? ctx.accent;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", width: 10 * 76 }}>
        {Array.from({ length: el.count }, (_, i) => {
          const k = easeOut((ctx.t - i * 0.06) / 0.25);
          return (
            <svg key={i} width={70} height={70} viewBox="0 0 60 60" style={{ margin: 3, transform: `scale(${k})` }}>
              {SYMBOL[el.symbol](color)}
            </svg>
          );
        })}
      </div>
      {el.label && (
        <Probe ctx={ctx} suffix="icons" style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 44, color: ctx.text, marginTop: 18, opacity: clamp((ctx.t - 0.4) / 0.3) }}>
          {el.label}
        </Probe>
      )}
    </div>
  );
}

function ArrowFlow({ el, ctx, area }: { el: Extract<MgElement, { type: "arrow-flow" }>; ctx: Ctx; area: Rect }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 18, width: area.w * 0.95, margin: "0 auto" }}>
      {el.steps.map((step, i) => {
        const k = easeOut((ctx.t - i * 0.45) / 0.3);
        return (
          <React.Fragment key={i}>
            {i > 0 && <div style={{ fontSize: 60, color: ctx.accent, opacity: k, fontFamily: ctx.font.family, fontWeight: ctx.font.heavy }}>→</div>}
            <div style={{ padding: "22px 28px", borderRadius: 26, background: i % 2 ? "rgba(255,255,255,0.12)" : `${ctx.accent}33`, border: `4px solid ${ctx.accent}`, opacity: k, transform: `scale(${0.8 + 0.2 * k})` }}>
              <Probe ctx={ctx} suffix={`flow-${i}`} style={{ fontFamily: ctx.font.family, fontWeight: ctx.font.heavy, fontSize: 40, color: ctx.text }}>
                {step}
              </Probe>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Element({ el, ctx, area }: { el: MgElement; ctx: Ctx; area: Rect }) {
  switch (el.type) {
    case "title":
      return <Title el={el} ctx={ctx} />;
    case "counter":
      return <Counter el={el} ctx={ctx} />;
    case "compare":
      return <Compare el={el} ctx={ctx} area={area} />;
    case "list":
      return <List el={el} ctx={ctx} />;
    case "orb":
      return <Orb el={el} ctx={ctx} />;
    case "timeline":
      return <Timeline el={el} ctx={ctx} area={area} />;
    case "fact-card":
      return <FactCard el={el} ctx={ctx} area={area} />;
    case "icon-row":
      return <IconRow el={el} ctx={ctx} />;
    case "arrow-flow":
      return <ArrowFlow el={el} ctx={ctx} area={area} />;
  }
}

const Texture: React.FC<{ kind: MgScene["texture"]; t: number; width: number; height: number; accent: string }> = ({ kind, t, width, height, accent }) => {
  if (kind === "stars") {
    return (
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 90 }, (_, i) => {
          const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1 + hash01(i) * 2) + i));
          return <circle key={i} cx={hash01(i * 3.1) * width} cy={hash01(i * 7.7) * height} r={1 + hash01(i * 5.3) * 3} fill="#ffffff" opacity={tw * 0.8} />;
        })}
      </svg>
    );
  }
  if (kind === "grid") return <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${accent}18 2px, transparent 2px), linear-gradient(90deg, ${accent}18 2px, transparent 2px)`, backgroundSize: "90px 90px", backgroundPosition: `0 ${(t * 20) % 90}px` }} />;
  if (kind === "dots") return <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${accent}30 3px, transparent 4px)`, backgroundSize: "60px 60px" }} />;
  if (kind === "paper") return <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.10), transparent 40%), radial-gradient(circle at 80% 85%, rgba(0,0,0,0.12), transparent 45%)" }} />;
  return null;
};

/** render-motion-graphics: animated 2D panels (titles, counters, comparisons, lists, orbs, timelines…). */
export const MotionGraphics: React.FC<{ props: EpisodeProps; spans: BeatSpan[]; from: number }> = ({ props, spans, from }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = (frame + from) / fps;
  const scene = (props.script.visuals["render-motion-graphics"] as MgScene | undefined) ?? { texture: "none" as const };
  const bg = scene.background ?? { top: props.brand.background[0], bottom: props.brand.background[1] };
  const font = fontFor(props.brand.font);
  const r = regions(width, height, props.safeArea);
  const span = spans.reduce((cur, s) => (t >= s.start ? s : cur), spans[0]);
  const visual = span.beat.visual as MgBeatVisual;
  const ch = props.renderSkills.includes("render-talking-character") && span.beat.character.placement !== "hidden" ? characterRect(span.beat.character.placement, width, height, props.safeArea) : null;
  // Leave room for the character: above it when it takes the lower half, beside it in the corner.
  const area: Rect = ch && span.beat.character.placement === "full" ? { ...r.stage, h: Math.max(260, ch.y - r.stage.y - 10) } : ch ? { ...r.stage, h: ch.y - r.stage.y + ch.h * 0.25 } : r.stage;
  const elements = visual.skill === "render-motion-graphics" ? visual.elements : [];
  const heights = elements.map(elementHeight);
  const gap = 40;
  const total = heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, elements.length - 1);
  const scale = Math.min(1, area.h / total);
  const out = clamp((span.end - t) / 0.18);
  const palette = [props.brand.accent_color, props.brand.primary_color, "#ffd166", "#06d6a0", "#ef476f"];
  let y = area.y + (area.h - total * scale) / 2;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${bg.top} 0%, ${bg.bottom} 100%)`, overflow: "hidden" }}>
      <Texture kind={scene.texture} t={t} width={width} height={height} accent={props.brand.accent_color} />
      {elements.map((el, i) => {
        const top = y;
        y += (heights[i] + gap) * scale;
        const start = (i === 0 ? span.start + 0.05 : span.voiceStart) + i * 0.35;
        const ctx: Ctx = { t: t - start, font, text: props.brand.text_color, accent: props.brand.accent_color, primary: props.brand.primary_color, palette, probe: props.qaProbe && out > 0.9, id: `mg:${span.id}:${i}`, width };
        if (ctx.t < 0) return null;
        return (
          <div key={`${span.id}-${i}`} style={{ position: "absolute", left: area.x, top, width: area.w, height: heights[i], transform: `scale(${scale})`, transformOrigin: "50% 0", opacity: out }}>
            <Element el={el} ctx={ctx} area={{ ...area, w: area.w }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

function lighten(hex: string): string {
  return mixHex(hex, "#ffffff", 0.45);
}
function darken(hex: string): string {
  return mixHex(hex, "#000000", 0.45);
}
function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const pb = parseInt(b.replace("#", ""), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
