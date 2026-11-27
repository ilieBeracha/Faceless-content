import React, { useRef } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "../../render/fonts.ts";
import { useQaProbe } from "../../render/qa-probe.ts";
import { clamp, easeInOut, easeOut, safeRect } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps } from "../../render/types.ts";
import { beatVisualSchema, countingValue, MAIN, sceneSchema, type SubScene, type SubView } from "./schema.ts";

/** Labels inside the scene use one clean sans, whatever the channel's headline font is. */
const LABEL_FONT = FONTS["space-grotesk"];
/** Where the subject's centre sits: a little above the middle, so the captions fit under it. */
export const SUBJECT_Y = 0.39;
/** How much of the frame the subject fills (its measured box), at zoom 1: at most this tall and this wide. */
const FIT_H = 0.4;
const FIT_W = 0.72;
/** Seconds a move from one view to the next takes. */
const MOVE = 0.7;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Pics = NonNullable<EpisodeProps["subjectPictures"]>;

interface Timed {
  view: SubView;
  start: number;
  end: number;
  beatId: string;
}

/** Every view of every render-subject beat, on one clock. A view starts just before its at_word is spoken. */
export function subjectTimeline(props: EpisodeProps, spans: BeatSpan[]): Timed[] {
  const out: Timed[] = [];
  for (const span of spans) {
    if (span.beat.visual.skill !== "render-subject") continue;
    const visual = beatVisualSchema.parse(span.beat.visual);
    const words = props.words.filter((w) => w.beat === span.id);
    visual.views.forEach((view, i) => {
      const start = i === 0 ? span.start : Math.max(span.start, (words[view.at_word]?.start ?? span.start) - 0.12);
      out.push({ view, start, end: span.end, beatId: span.id });
    });
  }
  for (let i = 0; i < out.length - 1; i++) out[i].end = Math.min(out[i].end, out[i + 1].start);
  return out;
}

/** Where a picture is drawn: the point of it (fx, fy: 0–1 across and down) that sits at (cx, cy) on screen, its scale and its turn. */
interface Pose {
  cx: number;
  cy: number;
  s: number;
  fx: number;
  fy: number;
  rot: number;
}

/** The scale at which a picture's subject fills the frame as FIT_H / FIT_W say. */
function fitScale(box: Box): number {
  return Math.min(FIT_H / Math.max(0.05, box.y1 - box.y0), FIT_W / Math.max(0.05, box.x1 - box.x0));
}

/** The picture a view shows of the subject (a reveal and a compare keep the subject itself on screen). */
function shownPicture(v: SubView): string {
  return v.view === "reveal" || v.view === "compare" ? MAIN : v.picture;
}

function poseFor(v: SubView, W: number, H: number, pics: Pics): Pose {
  const box = pics[shownPicture(v)]?.box;
  if (!box) throw new Error(`render-subject: picture "${shownPicture(v)}" was not painted.`);
  const fit = fitScale(box);
  const p: Pose = { cx: W / 2, cy: H * SUBJECT_Y, s: fit, fx: (box.x0 + box.x1) / 2, fy: (box.y0 + box.y1) / 2, rot: 0 };
  switch (v.view) {
    case "hero":
      return { ...p, s: fit * v.zoom };
    case "focus":
      return { ...p, s: fit * v.zoom, fx: v.x, fy: v.y };
    case "labels":
      return { ...p, s: fit * 0.9 };
    case "stat":
      return { ...p, cy: H * 0.5, s: fit * 0.72 };
    case "reveal":
      return p;
    case "swap":
      return p;
    case "compare":
      return { ...p, cx: W * 0.64, s: fit * 0.8 };
    case "tilt":
      return { ...p, s: fit * 0.9, rot: v.degrees };
  }
}

function mix(a: Pose, b: Pose, k: number): Pose {
  const m = (x: number, y: number) => x + (y - x) * k;
  return { cx: m(a.cx, b.cx), cy: m(a.cy, b.cy), s: m(a.s, b.s), fx: m(a.fx, b.fx), fy: m(a.fy, b.fy), rot: m(a.rot, b.rot) };
}

/** Where a point of the picture lands on screen (turn left out: labels are never on a tilted subject). */
function onScreen(pose: Pose, x: number, y: number, W: number, H: number) {
  return { x: pose.cx + (x - pose.fx) * W * pose.s, y: pose.cy + (y - pose.fy) * H * pose.s };
}

/** The picture itself, faded into the background at its edges so it never shows a border. */
const Picture: React.FC<{ src: string; box: Box; W: number; H: number; pose: Pose; opacity: number; clip?: string; extraX?: number }> = ({ src, box, W, H, pose, opacity, clip, extraX = 0 }) => {
  // Fade out just beyond the subject, so as little of the painted background as possible shows.
  const mask = `radial-gradient(ellipse ${((box.x1 - box.x0) * 50 * 1.3).toFixed(1)}% ${((box.y1 - box.y0) * 50 * 1.15).toFixed(1)}% at ${(((box.x0 + box.x1) / 2) * 100).toFixed(1)}% ${(((box.y0 + box.y1) / 2) * 100).toFixed(1)}%, #000 78%, transparent 100%)`;
  return (
  <div
    style={{
      position: "absolute",
      left: pose.cx - pose.fx * W + extraX,
      top: pose.cy - pose.fy * H,
      width: W,
      height: H,
      transform: `rotate(${pose.rot}deg) scale(${pose.s})`,
      transformOrigin: `${pose.fx * W}px ${pose.fy * H}px`,
      opacity,
      clipPath: clip,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{
        width: W,
        height: H,
        objectFit: "cover",
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  </div>
  );
};

/** HTML text in the scene (so the QA probe can check it stays in the safe area). */
const Text: React.FC<{ id: string; probe: boolean; x: number; y: number; size: number; weight?: number; color?: string; opacity?: number; anchor?: "center" | "left" | "right"; dir: "ltr" | "rtl"; children: React.ReactNode }> = ({ id, probe, x, y, size, weight, color, opacity = 1, anchor = "center", dir, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(probe && opacity > 0.9, ref, id, "text");
  const shift = anchor === "center" ? "-50%" : anchor === "right" ? "-100%" : "0";
  return (
    <div
      ref={ref}
      dir={dir}
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${shift}, -50%)`,
        whiteSpace: "nowrap",
        lineHeight: 1.08,
        fontFamily: LABEL_FONT.family,
        fontWeight: weight ?? LABEL_FONT.heavy,
        fontSize: size,
        color: color ?? "#ffffff",
        opacity,
        letterSpacing: -0.5,
        textShadow: "0 3px 14px rgba(0,0,0,0.75)",
      }}
    >
      {children}
    </div>
  );
};

/** render-subject: one painted subject whose view changes on the words. */
export const Subject: React.FC<{ props: EpisodeProps; spans: BeatSpan[]; from: number }> = ({ props, spans, from }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = (frame + from) / fps;
  const scene: SubScene = sceneSchema.parse(props.script.visuals["render-subject"]);
  const pics = props.subjectPictures;
  if (!pics) throw new Error("render-subject needs its painted pictures (props.subjectPictures).");
  const views = subjectTimeline(props, spans);
  if (!views.length) return null;
  const idx = views.reduce((cur, v, i) => (t >= v.start ? i : cur), 0);
  const cur = views[idx];
  const prev = views[idx - 1];
  const v = cur.view;
  const lt = t - cur.start;
  const move = easeInOut(clamp(lt / MOVE));
  const pose = prev ? mix(poseFor(prev.view, W, H, pics), poseFor(v, W, H, pics), move) : poseFor(v, W, H, pics);
  const fadeIn = easeOut(clamp((lt - 0.25) / 0.45));
  const out = clamp((cur.end - t) / 0.2);
  const accent = props.brand.caption_color ?? props.brand.accent_color;
  const probe = props.qaProbe;
  const dir = props.direction;
  const safe = safeRect(W, H, props.safeArea);
  const breathe = 1 + 0.012 * Math.sin(t * 0.6);
  const live: Pose = { ...pose, s: pose.s * breathe, cy: pose.cy + Math.sin(t * 0.8) * 6 };
  const pic = (id: string) => {
    const p = pics[id];
    if (!p) throw new Error(`render-subject: picture "${id}" was not painted.`);
    return p;
  };

  const showNow = shownPicture(v);
  const showBefore = prev ? shownPicture(prev.view) : showNow;
  const cross = showBefore !== showNow ? easeInOut(clamp(lt / 0.5)) : 1;
  // The subject's top and bottom on screen (from its measured box), for the text placed around it.
  const box = pic(showNow).box;
  const top = onScreen(live, live.fx, box.y0, W, H).y;
  const bottom = onScreen(live, live.fx, box.y1, W, H).y;
  const titleY = Math.max(safe.y + 40, Math.min(top - 50, H * SUBJECT_Y - 120));
  const bg = scene.background;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${SUBJECT_Y * 100}%, ${bg.top} 0%, ${bg.bottom} 80%)`, overflow: "hidden" }}>
      {/* The subject (cross-fading when the view shows another picture of it). */}
      {v.view === "reveal" ? (
        <Reveal pic={pic} picture={v.picture} W={W} H={H} pose={live} lt={lt} accent={accent} />
      ) : (
        <>
          {cross < 1 && <Picture src={pic(showBefore).file} box={pic(showBefore).box} W={W} H={H} pose={live} opacity={1 - cross} />}
          <Picture src={pic(showNow).file} box={box} W={W} H={H} pose={{ ...live, s: live.s * (cross < 1 ? 0.96 + 0.04 * cross : 1) }} opacity={cross} />
        </>
      )}

      {v.view === "compare" && <CompareOther pic={pic(v.picture)} main={box} pose={live} ratio={v.ratio} lt={lt} W={W} H={H} opacity={fadeIn} />}

      {v.view === "tilt" && <TiltMarks pose={live} half={(bottom - top) / 2} degrees={v.degrees} lt={lt} accent={accent} W={W} H={H} />}

      {v.view === "labels" && <LabelLines items={v.items} pose={live} W={W} H={H} lt={lt} safeX={safe.x} safeW={safe.w} />}

      {/* Text: the small title above the subject, then the view's own labels. */}
      {v.caption && (
        <Text id={`sub:${cur.beatId}:${idx}:caption`} probe={probe} dir={dir} x={W / 2} y={v.view === "stat" ? safe.y + 300 : titleY} size={44} weight={LABEL_FONT.regular} color="#f2efe6" opacity={fadeIn * out}>
          {v.caption}
        </Text>
      )}
      {v.view === "stat" && (
        <>
          <Text id={`sub:${cur.beatId}:${idx}:value`} probe={probe} dir="ltr" x={W / 2} y={safe.y + 110} size={150} opacity={fadeIn * out}>
            <span style={{ display: "inline-block", transform: `scale(${0.85 + 0.15 * fadeIn})` }}>{countingValue(v.value, easeOut(clamp((lt - 0.2) / 0.9)))}</span>
          </Text>
          {v.subtitle && (
            <Text id={`sub:${cur.beatId}:${idx}:subtitle`} probe={probe} dir={dir} x={W / 2} y={safe.y + 215} size={40} weight={LABEL_FONT.regular} color="#e3e0d6" opacity={easeOut(clamp((lt - 0.6) / 0.4)) * out}>
              {v.subtitle}
            </Text>
          )}
        </>
      )}
      {v.view === "labels" &&
        v.items.map((item, i) => {
          const lp = labelPlace(item, i, live, W, H, safe.x, safe.w);
          return (
            <Text key={i} id={`sub:${cur.beatId}:${idx}:label${i}`} probe={probe} dir={dir} x={lp.tx} y={lp.ty} size={44} color="#ffffff" anchor={lp.left ? "left" : "right"} opacity={easeOut(clamp((lt - 0.5 - i * 0.3) / 0.35)) * out}>
              {item.text}
            </Text>
          );
        })}
      {v.view === "compare" && (
        <>
          <Text id={`sub:${cur.beatId}:${idx}:other`} probe={probe} dir={dir} x={W * 0.27} y={bottom + 50} size={38} weight={LABEL_FONT.regular} color="#f2efe6" opacity={fadeIn * out}>
            {scene.pictures.find((p) => p.id === v.picture)?.name ?? ""}
          </Text>
          <Text id={`sub:${cur.beatId}:${idx}:self`} probe={probe} dir={dir} x={live.cx} y={bottom + 50} size={38} weight={LABEL_FONT.regular} color="#f2efe6" opacity={fadeIn * out}>
            {scene.subject.name}
          </Text>
          {v.label && (
            <Text id={`sub:${cur.beatId}:${idx}:label`} probe={probe} dir={dir} x={W / 2} y={titleY} size={48} color={accent} opacity={easeOut(clamp((lt - 0.7) / 0.4)) * out}>
              {v.label}
            </Text>
          )}
        </>
      )}
      {v.view === "tilt" && (
        <Text id={`sub:${cur.beatId}:${idx}:deg`} probe={probe} dir="ltr" x={W / 2} y={Math.max(safe.y + 70, top - 110)} size={100} color={accent} opacity={fadeIn * out}>
          {`${Math.round(v.degrees * easeOut(clamp((lt - 0.3) / 1.2)))}°`}
        </Text>
      )}
      {v.view === "tilt" && v.label && (
        <Text id={`sub:${cur.beatId}:${idx}:tiltlabel`} probe={probe} dir={dir} x={W / 2} y={Math.max(safe.y + 170, top - 30)} size={40} weight={LABEL_FONT.regular} color="#f2efe6" opacity={fadeIn * out}>
          {v.label}
        </Text>
      )}
    </AbsoluteFill>
  );
};

/** Split the subject open: a bright slit, its two halves slide apart, and what is inside grows in between. */
const Reveal: React.FC<{ pic: (id: string) => { file: string; box: Box }; picture: string; W: number; H: number; pose: Pose; lt: number; accent: string }> = ({ pic, picture, W, H, pose, lt, accent }) => {
  const main = pic(MAIN);
  const inner = pic(picture);
  const slit = easeInOut(clamp(lt / 0.45));
  const open = easeOut(clamp((lt - 0.35) / 0.8));
  const apart = (main.box.x1 - main.box.x0) * W * pose.s * 0.55 * open;
  const half = ((main.box.y1 - main.box.y0) * H * pose.s) / 2;
  // The cut runs down the middle of the subject.
  const cut = ((main.box.x0 + main.box.x1) / 2) * 100;
  const innerPose: Pose = { ...pose, fx: (inner.box.x0 + inner.box.x1) / 2, fy: (inner.box.y0 + inner.box.y1) / 2, s: fitScale(inner.box) * 0.9 * (0.7 + 0.3 * open) };
  return (
    <>
      <Picture src={inner.file} box={inner.box} W={W} H={H} pose={innerPose} opacity={open} />
      <Picture src={main.file} box={main.box} W={W} H={H} pose={pose} opacity={1 - 0.2 * open} clip={`inset(0 ${100 - cut}% 0 0)`} extraX={-apart} />
      <Picture src={main.file} box={main.box} W={W} H={H} pose={pose} opacity={1 - 0.2 * open} clip={`inset(0 0 0 ${cut}%)`} extraX={apart} />
      <div
        style={{
          position: "absolute",
          left: pose.cx - 5,
          top: pose.cy - half * slit,
          width: 10,
          height: 2 * half * slit,
          borderRadius: 5,
          background: accent,
          boxShadow: `0 0 40px 12px ${accent}`,
          opacity: (1 - open) * 0.95,
        }}
      />
    </>
  );
};

/** The thing set beside the subject: as tall as `ratio` of the subject, standing on the same line. */
const CompareOther: React.FC<{ pic: { file: string; box: Box }; main: Box; pose: Pose; ratio: number; lt: number; W: number; H: number; opacity: number }> = ({ pic, main, pose, ratio, lt, W, H, opacity }) => {
  const mainH = (main.y1 - main.y0) * H * pose.s;
  const grow = easeOut(clamp((lt - 0.2) / 0.6));
  const s = ((mainH * ratio) / ((pic.box.y1 - pic.box.y0) * H)) * grow;
  const bottom = pose.cy + (main.y1 - pose.fy) * H * pose.s;
  const otherPose: Pose = { cx: W * 0.27, cy: bottom, s: Math.max(0.001, s), fx: (pic.box.x0 + pic.box.x1) / 2, fy: pic.box.y1, rot: 0 };
  return <Picture src={pic.file} box={pic.box} W={W} H={H} pose={otherPose} opacity={opacity} />;
};

/** Upright reference, the tilted axis and the angle between them. */
const TiltMarks: React.FC<{ pose: Pose; half: number; degrees: number; lt: number; accent: string; W: number; H: number }> = ({ pose, half, degrees, lt, accent, W, H }) => {
  const k = easeOut(clamp((lt - 0.3) / 1.2));
  const rad = (degrees * k * Math.PI) / 180;
  const L = half * 1.2;
  const arcR = half * 1.05;
  const sweep = degrees >= 0 ? 1 : 0;
  const large = Math.abs(degrees * k) > 180 ? 1 : 0;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} opacity={clamp(lt / 0.4)}>
      <g transform={`translate(${pose.cx} ${pose.cy})`}>
        <line x1={0} y1={-L} x2={0} y2={L} stroke="#d6dbe6" strokeWidth={3} strokeDasharray="6 12" opacity={0.6} />
        <line x1={-Math.sin(rad) * L} y1={Math.cos(rad) * L} x2={Math.sin(rad) * L} y2={-Math.cos(rad) * L} stroke="#ffffff" strokeWidth={5} strokeLinecap="round" />
        <path d={`M 0 ${-arcR} A ${arcR} ${arcR} 0 ${large} ${sweep} ${Math.sin(rad) * arcR} ${-Math.cos(rad) * arcR}`} fill="none" stroke={accent} strokeWidth={6} strokeLinecap="round" />
      </g>
    </svg>
  );
};

/** Where a label's point is on screen, and where its text goes (at the side the point is on, a little above it). */
function labelPlace(item: { x: number; y: number }, i: number, pose: Pose, W: number, H: number, safeX: number, safeW: number) {
  const p = onScreen(pose, item.x, item.y, W, H);
  const left = item.x < pose.fx;
  const tx = left ? safeX + 10 : safeX + safeW - 10;
  const ty = p.y - 50 - i * 6;
  return { px: p.x, py: p.y, tx, ty, left };
}

const LabelLines: React.FC<{ items: { x: number; y: number }[]; pose: Pose; W: number; H: number; lt: number; safeX: number; safeW: number }> = ({ items, pose, W, H, lt, safeX, safeW }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
    {items.map((item, i) => {
      const lp = labelPlace(item, i, pose, W, H, safeX, safeW);
      const k = easeOut(clamp((lt - 0.3 - i * 0.3) / 0.35));
      const endX = lp.left ? safeX + 10 : safeX + safeW - 10;
      const elbowX = lp.left ? Math.max(endX + 40, Math.min(lp.px - 40, safeX + 260)) : Math.min(endX - 40, Math.max(lp.px + 40, safeX + safeW - 260));
      const y = lp.ty + 30;
      return (
        <g key={i} opacity={k}>
          <circle cx={lp.px} cy={lp.py} r={9} fill="#ffffff" />
          <circle cx={lp.px} cy={lp.py} r={18 + 6 * Math.sin(lt * 3)} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.5} />
          <polyline points={`${lp.px},${lp.py} ${elbowX},${y} ${endX},${y}`} fill="none" stroke="#ffffff" strokeWidth={3} strokeDasharray={2000} strokeDashoffset={2000 * (1 - k)} />
        </g>
      );
    })}
  </svg>
);
