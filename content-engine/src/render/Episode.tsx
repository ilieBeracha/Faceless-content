import React, { useMemo, useRef } from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "../skills/captions/Captions.tsx";
import { AiVideoScene } from "../skills/render-ai-video/AiVideoScene.tsx";
import { MotionGraphics } from "../skills/render-motion-graphics/MotionGraphics.tsx";
import { CharacterLayer } from "../skills/render-talking-character/CharacterLayer.tsx";
import { Scene3D } from "../skills/render-3d-explainer/Scene3D.tsx";
import { StorybookScene } from "../skills/render-storybook/Storybook.tsx";
import { fontFor, loadEngineFonts } from "./fonts.ts";
import { useQaProbe } from "./qa-probe.ts";
import { beatSpans, clamp, easeOut, regions, safeRect } from "./timeline.ts";
import type { BeatSpan, EpisodeProps } from "./types.ts";

loadEngineFonts();

type SceneComponent = React.FC<{ props: EpisodeProps; spans: BeatSpan[]; from: number }>;

/** Scene-layer render skills (one fills the frame per beat). Overlays are composed below. */
export const SCENE_SKILLS: Record<string, SceneComponent> = {
  "render-3d-explainer": Scene3D,
  "render-ai-video": AiVideoScene,
  "render-motion-graphics": MotionGraphics,
  "render-storybook": StorybookScene,
};

/** Scene skills that draw their own title, so the engine's per-beat headline stays off. */
const OWN_TITLE = new Set(["render-storybook"]);

interface Run {
  skill: string;
  from: number;
  duration: number;
}

function sceneRuns(spans: BeatSpan[], fps: number, total: number): Run[] {
  const runs: Run[] = [];
  for (const span of spans) {
    const skill = span.beat.visual.skill;
    const from = Math.round(span.start * fps);
    const last = runs[runs.length - 1];
    if (last && last.skill === skill) continue;
    if (last) last.duration = from - last.from;
    runs.push({ skill, from, duration: total - from });
  }
  return runs.filter((r) => r.duration > 0);
}

const Headline: React.FC<{ props: EpisodeProps; spans: BeatSpan[] }> = ({ props, spans }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const span = spans.reduce((cur, s) => (t >= s.start ? s : cur), spans[0]);
  const text = OWN_TITLE.has(span.beat.visual.skill) ? undefined : span.beat.on_screen_text;
  const ref = useRef<HTMLDivElement>(null);
  const appearAt = span.index === 0 ? 0 : span.start + 0.05;
  const k = easeOut((t - appearAt) / 0.22);
  const out = clamp((span.end - t) / 0.15);
  useQaProbe(props.qaProbe && Boolean(text) && k > 0.5 && out > 0.9, ref, `headline:${span.id}`, "headline");
  if (!text) return null;
  const region = regions(width, height, props.safeArea).headline;
  const font = fontFor(props.brand.font);
  const size = text.length > 26 ? 60 : text.length > 18 ? 70 : 82;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: region.x, top: region.y, width: region.w, height: region.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          ref={ref}
          style={{
            maxWidth: region.w,
            padding: "14px 30px",
            borderRadius: 28,
            background: props.brand.primary_color,
            boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
            fontFamily: font.family,
            fontWeight: font.heavy,
            fontSize: size,
            lineHeight: 1.04,
            color: props.brand.text_color,
            textAlign: "center",
            overflow: "hidden",
            opacity: k * out,
            transform: `translateY(${(1 - k) * -30}px) rotate(${(1 - k) * -3}deg) scale(${0.9 + 0.1 * k})`,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SafeAreaOverlay: React.FC<{ props: EpisodeProps }> = ({ props }) => {
  const s = safeRect(props.width, props.height, props.safeArea);
  return <div style={{ position: "absolute", left: s.x, top: s.y, width: s.w, height: s.h, border: "4px dashed rgba(255,60,60,0.9)", boxSizing: "border-box", pointerEvents: "none" }} />;
};

/** The one composition every channel uses. What it shows comes entirely from the episode's props. */
export const Episode: React.FC<EpisodeProps> = (props) => {
  const spans = useMemo(() => beatSpans(props), [props]);
  const runs = useMemo(() => sceneRuns(spans, props.fps, props.durationInFrames), [spans, props.fps, props.durationInFrames]);
  const [top, bottom] = props.brand.background;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${top}, ${bottom})` }}>
      {runs.map((run) => {
        const Scene = SCENE_SKILLS[run.skill];
        return (
          <Sequence key={`${run.skill}-${run.from}`} from={run.from} durationInFrames={run.duration} name={run.skill}>
            {Scene ? <Scene props={props} spans={spans} from={run.from} /> : null}
          </Sequence>
        );
      })}
      {props.renderSkills.includes("render-talking-character") && <CharacterLayer props={props} spans={spans} />}
      <Headline props={props} spans={spans} />
      {props.captionsSkill && <Captions props={props} />}
      {props.audioFile && <Html5Audio src={staticFile(props.audioFile)} />}
      {props.showSafeAreas && <SafeAreaOverlay props={props} />}
    </AbsoluteFill>
  );
};
