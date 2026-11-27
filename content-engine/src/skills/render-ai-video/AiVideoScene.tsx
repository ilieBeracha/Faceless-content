import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { BeatSpan, EpisodeProps } from "../../render/types.ts";

/** A slow push-in over one shot, so even a static frame feels like a moving camera. */
const PushIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, Math.max(1, frames)], [1.0, 1.06], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `scale(${s})` }}>{children}</AbsoluteFill>;
};

/**
 * Film grain: one small noise tile (rendered by the browser once and cached) tiled over the frame and
 * shifted to a new random offset every frame. Same look as full-frame noise at a fraction of the cost.
 */
const GRAIN_TILE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='256' height='256' filter='url(%23n)'/></svg>",
).replace(/%2523/g, "%23")}")`;
const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const x = Math.floor(random(`grain-x-${f}`) * 256);
  const y = Math.floor(random(`grain-y-${f}`) * 256);
  return <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.16, pointerEvents: "none", backgroundImage: GRAIN_TILE, backgroundSize: "256px 256px", backgroundPosition: `${x}px ${y}px` }} />;
};

/**
 * render-ai-video: the generated clips, cut to their spoken parts and laid end to end (the voice step
 * decided where each one goes). Clips are muted here: their sound is already in voice.wav.
 * With `grade: "cinematic"` every shot gets a film grade, a vignette, grain and a slow push-in.
 */
export const AiVideoScene: React.FC<{ props: EpisodeProps; spans: BeatSpan[]; from: number }> = ({ props, from }) => {
  const { fps } = useVideoConfig();
  const clips = props.clips ?? [];
  const world = (props.script.visuals?.["render-ai-video"] ?? {}) as { grade?: string };
  const cinematic = world.grade === "cinematic";
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {clips.map((clip, i) => {
        const start = Math.round(clip.start * fps);
        const end = i < clips.length - 1 ? Math.round(clips[i + 1].start * fps) : props.durationInFrames;
        if (end <= start) return null;
        const video = <OffthreadVideo src={staticFile(clip.file)} trimBefore={Math.round(clip.trim * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover", ...(cinematic ? { filter: "contrast(1.1) saturate(1.12) brightness(0.96)" } : {}) }} />;
        return (
          <Sequence key={clip.id} from={start - from} durationInFrames={end - start} name={clip.id}>
            {cinematic ? <PushIn frames={end - start}>{video}</PushIn> : video}
          </Sequence>
        );
      })}
      {cinematic ? (
        <>
          {/* Teal shadows, warm highlights, darker edges: a film look on top of every shot. */}
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,40,60,0.18), rgba(0,0,0,0) 40%, rgba(60,30,0,0.10))", mixBlendMode: "soft-light" }} />
          <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
          <Grain />
        </>
      ) : null}
      {/* A soft shade behind the caption area keeps white words readable on bright footage. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.28) 68%, rgba(0,0,0,0.38) 82%, rgba(0,0,0,0.1) 100%)" }} />
    </AbsoluteFill>
  );
};
