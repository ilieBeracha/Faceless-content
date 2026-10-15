import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import type { BeatSpan, EpisodeProps } from "../../render/types.ts";

/**
 * render-ai-video: the generated clips, cut to their spoken parts and laid end to end (the voice step
 * decided where each one goes). Clips are muted here: their sound is already in voice.wav.
 */
export const AiVideoScene: React.FC<{ props: EpisodeProps; spans: BeatSpan[]; from: number }> = ({ props, from }) => {
  const { fps } = useVideoConfig();
  const clips = props.clips ?? [];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {clips.map((clip, i) => {
        const start = Math.round(clip.start * fps);
        const end = i < clips.length - 1 ? Math.round(clips[i + 1].start * fps) : props.durationInFrames;
        if (end <= start) return null;
        return (
          <Sequence key={clip.id} from={start - from} durationInFrames={end - start} name={clip.id}>
            <OffthreadVideo src={staticFile(clip.file)} trimBefore={Math.round(clip.trim * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Sequence>
        );
      })}
      {/* A soft shade behind the caption area keeps white words readable on bright footage. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.28) 68%, rgba(0,0,0,0.38) 82%, rgba(0,0,0,0.1) 100%)" }} />
    </AbsoluteFill>
  );
};
