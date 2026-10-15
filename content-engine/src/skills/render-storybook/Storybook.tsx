import React, { useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { useQaProbe } from "../../render/qa-probe.ts";
import { clamp, easeInOut, regions } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps, TimedWord } from "../../render/types.ts";
import { blinkAt, mouthAt, speakerAt } from "../render-talking-character/animation.ts";
import { expressionSchema, type Expression, type StickFigureModel } from "../render-talking-character/rigs.ts";
import { StickFigure } from "./Figure.tsx";
import { isSkyProp, PropView } from "./props.tsx";
import type { StoryBeatVisual, Storybook as StorybookData, StoryScene } from "./schema.ts";
import { GROUND_Y, SettingView } from "./settings.tsx";
import grainUrl from "./textures/grain.png";
import wash0 from "./textures/wash-0.png";
import wash1 from "./textures/wash-1.png";
import wash2 from "./textures/wash-2.png";
import wash3 from "./textures/wash-3.png";

/** Pre-made paper textures (see textures/make_textures.py): far cheaper than per-frame SVG noise filters. */
const WASHES = [wash0, wash1, wash2, wash3];

/** Hold rendering until the textures are decoded, so no frame is captured without them. */
function useTextures(): void {
  const [handle] = useState(() => delayRender("storybook textures"));
  useEffect(() => {
    const load = (src: string) => {
      const img = new Image();
      img.src = src;
      return img.decode();
    };
    Promise.all([grainUrl, ...WASHES].map(load)).then(
      () => continueRender(handle),
      () => continueRender(handle),
    );
  }, [handle]);
}

/** Fallback look when a beat's speaker isn't a stick-figure character. */
const DEFAULT_FIGURE: StickFigureModel = {
  rig: "stick-figure",
  params: { head: "#f1d9a6", line: "#3a332d", line_width: 5.5, head_size: 1, hair: "tuft", hair_color: "#3a332d", body_style: "stick", body_color: "#d9b97e", accessory: "none", accessory_color: "#c2553a" },
  expressions: { neutral: expressionSchema.parse({}) },
};

export const TITLE_FONT = "Anton";
/** Anton's glyph boxes reach past a tight line box; this line height plus TITLE_PAD keeps them inside the title's own box. */
const TITLE_LINE = 1.2;
const TITLE_PAD = 0.15;

/** Card layout on a vertical frame: title bar, then a square scene the full width of the frame. */
export function storyLayout(width: number, height: number, props: Pick<EpisodeProps, "safeArea">) {
  const r = regions(width, height, props.safeArea);
  const card = Math.min(width, height * 0.5625);
  const cardY = Math.round(height * 0.219);
  return { card, cardX: (width - card) / 2, cardY, title: { x: r.headline.x, y: Math.max(r.safe.y + 4, cardY - 166), w: r.headline.w, h: 156 } };
}

/** When each scene of a beat starts: one scene per sentence, extra scenes split the last sentence. */
export function sceneStarts(span: BeatSpan, words: TimedWord[], count: number): number[] {
  const beatWords = words.filter((w) => w.beat === span.id);
  const sentenceStarts: number[] = [];
  let startNext = true;
  for (const w of beatWords) {
    if (startNext) sentenceStarts.push(w.start);
    startNext = /[.!?]["”')]?$/.test(w.text);
  }
  const starts: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) starts.push(span.start);
    else if (i < sentenceStarts.length) starts.push(sentenceStarts[i] - 0.08);
    else {
      const last = sentenceStarts.length ? sentenceStarts[sentenceStarts.length - 1] : span.start;
      const extra = count - sentenceStarts.length + 1;
      const k = i - sentenceStarts.length + 1;
      starts.push(last + ((span.end - last) * k) / extra);
    }
  }
  return starts;
}

/** Title size: one line when it fits at a readable size, otherwise two balanced lines. */
export function titleFit(chars: number, w: number, h: number): { size: number; lines: 1 | 2 } {
  const em = 0.44; // Anton capitals: average advance per character, in ems (measured ≈0.42)
  const one = Math.floor(w / (Math.max(1, chars) * em));
  if (one >= 56) return { size: Math.min(one, 76), lines: 1 };
  const perLine = Math.ceil(chars / 2) + 2;
  return { size: Math.max(40, Math.min(Math.floor(w / (perLine * em)), Math.floor(h / (2 * TITLE_LINE + 2 * TITLE_PAD)))), lines: 2 };
}

const Title: React.FC<{ book: StorybookData; x: number; y: number; w: number; h: number; text: string; accent: string; probe: boolean }> = ({ book, x, y, w, h, text, accent, probe }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(probe, ref, "storybook:title", "headline");
  const title = book.title.toUpperCase();
  const marks = book.highlight.map((m) => m.toUpperCase()).filter((m) => title.includes(m));
  const parts: { s: string; hi: boolean }[] = [];
  let rest = title;
  while (rest.length) {
    const hits = marks.map((m) => ({ m, i: rest.indexOf(m) })).filter((h) => h.i >= 0).sort((a, b) => a.i - b.i);
    if (!hits.length) {
      parts.push({ s: rest, hi: false });
      break;
    }
    if (hits[0].i > 0) parts.push({ s: rest.slice(0, hits[0].i), hi: false });
    parts.push({ s: hits[0].m, hi: true });
    rest = rest.slice(hits[0].i + hits[0].m.length);
  }
  const { size } = titleFit(title.length, w, h);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div ref={ref} style={{ maxWidth: w, fontFamily: TITLE_FONT, fontSize: size, lineHeight: TITLE_LINE, padding: `${TITLE_PAD}em 0`, textAlign: "center", letterSpacing: 0.5, overflow: "hidden", textWrap: "balance" }}>
        {parts.map((p, i) => (
          <span key={i} style={{ color: p.hi ? accent : text }}>
            {p.s}
          </span>
        ))}
      </div>
    </div>
  );
};

const SceneArt: React.FC<{ scene: StoryScene; seed: number; t: number; u: number; figureFor: (scene: StoryScene) => { model: StickFigureModel; expression: (name: string) => Expression }; mouth: number; blink: number; accent: string }> = ({ scene, seed, t, u, figureFor, mouth, blink, accent }) => {
  const ground = GROUND_Y[scene.setting];
  const focusX = scene.character ? scene.character.x * 1000 : 500;
  const focusY = ground - 200;
  const k = easeInOut(u);
  let transform = `translate(${focusX} ${focusY}) scale(${1 + 0.02 * k}) translate(${-focusX} ${-focusY})`;
  if (scene.camera === "push-in") transform = `translate(${focusX} ${focusY}) scale(${1 + 0.09 * k}) translate(${-focusX} ${-focusY})`;
  if (scene.camera === "pull-out") transform = `translate(${focusX} ${focusY}) scale(${1.09 - 0.09 * k}) translate(${-focusX} ${-focusY})`;
  if (scene.camera === "pan-left") transform = `translate(500 500) scale(1.06) translate(${-500 + 28 - 56 * k} -500)`;
  if (scene.camera === "pan-right") transform = `translate(500 500) scale(1.06) translate(${-500 - 28 + 56 * k} -500)`;
  const { model, expression } = figureFor(scene);
  // On dark skies the ink lines vanish: draw a pale, thicker copy of each figure underneath as an outline.
  const dark = scene.setting === "night" || scene.setting === "space" || scene.time === "night";
  const halo: StickFigureModel = { ...model, params: { ...model.params, line: "#efe6cf", hair_color: "#efe6cf", line_width: model.params.line_width * 2.6 } };
  const sky = scene.props.filter((p) => isSkyProp(p.type) && p.type !== "thought" && p.type !== "speech" && p.type !== "question");
  const ground_ = scene.props.filter((p) => !isSkyProp(p.type));
  const overlay = scene.props.filter((p) => p.type === "thought" || p.type === "speech" || p.type === "question");
  return (
    <g transform={transform}>
      <SettingView setting={scene.setting} time={scene.time} seed={seed} t={t} />
      {sky.map((p, i) => (
        <PropView key={`s${i}`} p={p} groundY={ground} seed={seed + i * 7} t={t} accent={accent} />
      ))}
      {ground_.filter((p) => (p.y ?? 1) * 1000 <= ground - 1 || p.type === "mountain" || p.type === "house").map((p, i) => (
        <PropView key={`b${i}`} p={p} groundY={ground - 30} seed={seed + 100 + i * 7} t={t} accent={accent} />
      ))}
      {scene.others.map((f, i) => (
        <React.Fragment key={`o${i}`}>
          {dark && <StickFigure figure={f} model={halo} expression={expression(f.expression)} groundY={ground + 10 * (f.scale - 1)} t={t} mouth={0} blink={blinkAt(t, seed + i * 9.1)} seed={seed + 300 + i} />}
          <StickFigure figure={f} model={model} expression={expression(f.expression)} groundY={ground + 10 * (f.scale - 1)} t={t} mouth={0} blink={blinkAt(t, seed + i * 9.1)} seed={seed + 300 + i} />
        </React.Fragment>
      ))}
      {ground_.filter((p) => !((p.y ?? 1) * 1000 <= ground - 1 || p.type === "mountain" || p.type === "house")).map((p, i) => (
        <PropView key={`g${i}`} p={p} groundY={ground} seed={seed + 200 + i * 7} t={t} accent={accent} />
      ))}
      {scene.character && dark && <StickFigure figure={scene.character} model={halo} expression={expression(scene.character.expression)} groundY={ground} t={t} mouth={mouth} blink={blink} seed={seed} />}
      {scene.character && <StickFigure figure={scene.character} model={model} expression={expression(scene.character.expression)} groundY={ground} t={t} mouth={mouth} blink={blink} seed={seed} />}
      {overlay.map((p, i) => (
        <PropView key={`v${i}`} p={p} groundY={ground} seed={seed + 400 + i * 7} t={t} accent={accent} />
      ))}
      <image href={WASHES[washSeed(seed)]} x={-60} y={-60} width={1120} height={1120} opacity={0.32} style={{ mixBlendMode: "multiply" }} />
    </g>
  );
};

/** Low-frequency noise that makes flat fills look like uneven watercolour washes (one of 4 variants per scene). */
const washSeed = (seed: number) => Math.abs(Math.round(seed)) % 4;

/** render-storybook: hand-drawn scenes (one per sentence), a title bar, a square card layout. */
export const StorybookScene: React.FC<{ props: EpisodeProps; spans: BeatSpan[]; from: number }> = ({ props, spans, from }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = (frame + from) / fps;
  const book = (props.script.visuals["render-storybook"] as StorybookData | undefined) ?? { title: props.script.title, highlight: [] };
  const L = storyLayout(width, height, props);
  const span = spans.reduce((cur, s) => (t >= s.start ? s : cur), spans[0]);
  const visual = span.beat.visual as StoryBeatVisual;
  const scenes = visual.skill === "render-storybook" ? visual.scenes : [];
  const starts = sceneStarts(span, props.words, scenes.length);
  let idx = 0;
  for (let i = 0; i < starts.length; i++) if (t >= starts[i]) idx = i;
  const sceneStart = starts[idx] ?? span.start;
  const sceneEnd = starts[idx + 1] ?? span.end;
  const u = clamp((t - sceneStart) / Math.max(0.5, sceneEnd - sceneStart));

  // Previous scene (for a short cross-fade): the last scene of this beat, or of the previous storybook beat.
  let prev: { scene: StoryScene; seed: number } | null = null;
  if (t - sceneStart < 0.14) {
    if (idx > 0) prev = { scene: scenes[idx - 1], seed: span.index * 100 + idx - 1 };
    else {
      const before = spans[span.index - 1];
      const bv = before?.beat.visual as StoryBeatVisual | undefined;
      if (bv?.skill === "render-storybook" && bv.scenes.length) prev = { scene: bv.scenes[bv.scenes.length - 1], seed: before.index * 100 + bv.scenes.length - 1 };
    }
  }
  const fade = prev ? clamp((t - sceneStart) / 0.14) : 1;

  const speaking = speakerAt(spans, t);
  const isSpeaker = speaking === span.beat.speaker;
  const mouth = mouthAt(props.envelope, frame + from, isSpeaker);
  const blink = blinkAt(t, 3.3);
  const figureFor = () => {
    const ch = props.characters[span.beat.speaker];
    const model = ch && ch.model.rig === "stick-figure" ? ch.model : DEFAULT_FIGURE;
    return { model, expression: (name: string) => expressionSchema.parse({ ...(model.expressions.neutral ?? {}), ...(model.expressions[name] ?? {}) }) };
  };
  const current = scenes[idx];
  const scale = L.card / 1000;
  const bg = props.brand.background[0];
  useTextures();

  return (
    <AbsoluteFill style={{ background: bg }}>
      <Title book={book} x={L.title.x} y={L.title.y} w={L.title.w} h={L.title.h} text={props.brand.text_color} accent={props.brand.accent_color} probe={props.qaProbe} />
      <svg style={{ position: "absolute", left: L.cardX, top: L.cardY }} width={L.card} height={L.card} viewBox="0 0 1000 1000">
        <defs>
          <clipPath id="card-clip">
            <rect x={0} y={0} width={1000} height={1000} />
          </clipPath>
          <radialGradient id="vignette" cx="50%" cy="48%" r="72%">
            <stop offset="0.62" stopColor="#3b2f22" stopOpacity="0" />
            <stop offset="1" stopColor="#3b2f22" stopOpacity="0.42" />
          </radialGradient>
        </defs>
        <g clipPath="url(#card-clip)">
          {prev && <SceneArt scene={prev.scene} seed={prev.seed} t={t} u={1} figureFor={figureFor} mouth={0} blink={0} accent={props.brand.accent_color} />}
          {current && (
            <g opacity={fade}>
              <SceneArt scene={current} seed={span.index * 100 + idx} t={t} u={u} figureFor={figureFor} mouth={mouth} blink={blink} accent={props.brand.accent_color} />
            </g>
          )}
          <image href={grainUrl} x={0} y={0} width={1000} height={1000} opacity={0.22} style={{ mixBlendMode: "multiply" }} />
          <rect x={0} y={0} width={1000} height={1000} fill="url(#vignette)" />
        </g>
      </svg>
      {scale <= 0 && null}
    </AbsoluteFill>
  );
};
