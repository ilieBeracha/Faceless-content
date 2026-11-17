/** The host standing still on white, in its neutral face: the picture an image model copies to draw the host into painted shots. */
import React from "react";
import { AbsoluteFill } from "remotion";
import { StickFigure } from "../render-storybook/Figure.tsx";
import { Flat2D } from "./Flat2D.tsx";
import { NeonLine } from "./NeonLine.tsx";
import { OrbBot3D } from "./OrbBot3D.tsx";
import { PixelSprite } from "./PixelSprite.tsx";
import { expressionSchema, type CharacterModel } from "./rigs.ts";

export const HOST_STILL_SIZE = 1024;

export const HostStill: React.FC<{ model: CharacterModel }> = ({ model }) => {
  if (model.rig === "photoreal") throw new Error("A photoreal host is filmed, not drawn, so it cannot be painted into shots.");
  const size = HOST_STILL_SIZE * 0.8;
  const pose = { t: 0, mouth: 0.1, blink: 0, expression: expressionSchema.parse(model.expressions.neutral ?? {}), energy: 0 };
  return (
    <AbsoluteFill style={{ background: "#ffffff", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: size, height: size, position: "relative" }}>
        {model.rig === "orb-bot-3d" ? (
          <OrbBot3D model={model} size={size} pose={pose} />
        ) : model.rig === "flat-2d" ? (
          <Flat2D model={model} size={size} pose={pose} id="host-still" />
        ) : model.rig === "pixel-sprite" ? (
          <PixelSprite model={model} size={size} pose={pose} />
        ) : model.rig === "neon-line" ? (
          <NeonLine model={model} size={size} pose={pose} id="host-still" />
        ) : (
          <svg width={size} height={size} viewBox="0 0 1000 1000">
            <StickFigure figure={{ pose: "stand", x: 0.5, scale: 2.3, facing: "right", expression: "neutral" }} model={model} expression={pose.expression} groundY={975} t={0} mouth={0.1} blink={0} seed={3} />
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
};
