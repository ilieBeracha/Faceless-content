import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { characterRect, clamp, easeInOut, lerp } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps, Rect } from "../../render/types.ts";
import { blinkAt, expressionAt, mouthAt, speakerAt } from "./animation.ts";
import { StickFigure } from "../render-storybook/Figure.tsx";
import { Flat2D } from "./Flat2D.tsx";
import { NeonLine } from "./NeonLine.tsx";
import { PixelSprite } from "./PixelSprite.tsx";
import { OrbBot3D } from "./OrbBot3D.tsx";
import { beatFrame, frameHostRect } from "../render-themed/frames.ts";

const MOVE = 0.4; // seconds to glide between placements
const BASE = 640; // characters render at a fixed size and are scaled, so canvases never resize

/** Where a character is at time t, gliding between the placements of consecutive beats. */
export function placementAt(spans: BeatSpan[], t: number, name: string, width: number, height: number, props: EpisodeProps): { rect: Rect; visible: number } {
  const rectFor = (span: BeatSpan) => {
    const placement = span.beat.speaker === name || Object.keys(props.characters).length === 1 ? span.beat.character.placement : "hidden";
    // The layout of a look applies on the beats that look draws; other scene skills keep the standard spot they plan around.
    const themed = span.beat.visual.skill === "render-themed";
    const layout = themed ? props.theme?.layout : undefined;
    // A look with a world draws the host inside its painted shots, so the rig steps off on those beats.
    if (themed && props.theme?.world) return { rect: characterRect("corner", width, height, props.safeArea, layout), visible: 0 };
    // A look with frames stands the host in the beat's frame; a frame without a host sends it off for that beat.
    const frame = themed ? beatFrame(props, span) : null;
    if (frame) {
      const rect = frameHostRect(frame, placement === "full" ? "full" : "corner", width, height, props.safeArea);
      if (rect && placement !== "hidden") return { rect, visible: 1 };
      return { rect: rect ?? characterRect("corner", width, height, props.safeArea, layout), visible: 0 };
    }
    return { rect: characterRect(placement === "hidden" ? "corner" : placement, width, height, props.safeArea, layout), visible: placement === "hidden" ? 0 : 1 };
  };
  let current = rectFor(spans[0]);
  for (const span of spans.slice(1)) {
    if (t < span.start) break;
    const target = rectFor(span);
    const k = easeInOut((t - span.start) / MOVE);
    current = {
      rect: { x: lerp(current.rect.x, target.rect.x, k), y: lerp(current.rect.y, target.rect.y, k), w: lerp(current.rect.w, target.rect.w, k), h: lerp(current.rect.h, target.rect.h, k) },
      visible: lerp(current.visible, target.visible, k),
    };
  }
  return current;
}

export const CharacterLayer: React.FC<{ props: EpisodeProps; spans: BeatSpan[] }> = ({ props, spans }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const speaking = speakerAt(spans, t);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Object.values(props.characters).map((character, index) => {
        // Photoreal characters are filmed by render-ai-video, never drawn.
        if (character.model.rig === "photoreal") return null;
        const { rect, visible } = placementAt(spans, t, character.name, width, height, props);
        if (visible <= 0.01) return null;
        const isSpeaking = speaking === character.name;
        const mouth = mouthAt(props.envelope, frame, isSpeaking);
        const pose = {
          t,
          mouth,
          blink: blinkAt(t, index * 13.7 + character.name.length),
          expression: expressionAt(character.model.expressions, spans, t, character.name),
          energy: mouth,
        };
        const entrance = clamp(t / 0.25);
        const size = Math.round(rect.w);
        return (
          <div
            key={character.name}
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: size,
              height: size,
              opacity: visible * entrance,
              transform: `scale(${0.85 + 0.15 * entrance * visible})`,
              transformOrigin: "50% 100%",
            }}
          >
            <div style={{ position: "absolute", left: "18%", right: "18%", bottom: "2%", height: "8%", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(0,0,0,0.35), rgba(0,0,0,0))" }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: BASE, height: BASE, transform: `scale(${size / BASE})`, transformOrigin: "0 0" }}>
              {character.model.rig === "orb-bot-3d" ? (
                <OrbBot3D model={character.model} size={BASE} pose={pose} />
              ) : character.model.rig === "flat-2d" ? (
                <Flat2D model={character.model} size={BASE} pose={pose} id={`ch-${character.name}`} />
              ) : character.model.rig === "pixel-sprite" ? (
                <PixelSprite model={character.model} size={BASE} pose={pose} />
              ) : character.model.rig === "neon-line" ? (
                <NeonLine model={character.model} size={BASE} pose={pose} id={`ch-${character.name}`} />
              ) : (
                <svg width={BASE} height={BASE} viewBox="0 0 1000 1000">
                  <StickFigure figure={{ pose: "stand", x: 0.5, scale: 2.3, facing: "right", expression: "neutral" }} model={character.model} expression={pose.expression} groundY={975} t={t} mouth={mouth} blink={pose.blink} seed={index + 3} />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
