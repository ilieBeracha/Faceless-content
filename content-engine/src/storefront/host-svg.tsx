/** A still picture of a host, drawn by the same components that draw it in a video, as a standalone SVG. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StickFigure } from "../skills/render-storybook/Figure.tsx";
import { Flat2D } from "../skills/render-talking-character/Flat2D.tsx";
import { NeonLine } from "../skills/render-talking-character/NeonLine.tsx";
import { PixelSprite } from "../skills/render-talking-character/PixelSprite.tsx";
import { expressionSchema, type CharacterModel } from "../skills/render-talking-character/rigs.ts";

const SIZE = 400;

export function hostSvg(model: CharacterModel): string {
  if (model.rig === "orb-bot-3d" || model.rig === "photoreal") throw new Error(`A ${model.rig} host cannot be drawn as a still picture here.`);
  const expression = expressionSchema.parse(model.expressions.neutral ?? {});
  const pose = { t: 0, mouth: 0.1, blink: 0, expression, energy: 0 };
  const drawing =
    model.rig === "flat-2d" ? (
      <Flat2D model={model} size={SIZE} pose={pose} id="host" />
    ) : model.rig === "pixel-sprite" ? (
      <PixelSprite model={model} size={SIZE} pose={pose} />
    ) : model.rig === "neon-line" ? (
      <NeonLine model={model} size={SIZE} pose={pose} id="host" />
    ) : (
      <svg width={SIZE} height={SIZE} viewBox="0 0 1000 1000">
        <StickFigure figure={{ pose: "stand", x: 0.5, scale: 2.3, facing: "right", expression: "neutral" }} model={model} expression={expression} groundY={975} t={0} mouth={0.1} blink={0} seed={3} />
      </svg>
    );
  return renderToStaticMarkup(drawing).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
}
