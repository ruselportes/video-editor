import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, Audio, Video } from "remotion";
import React from "react";

// The strict JSON contract our Python CrewAI Director generates
export interface Blueprint {
  project_name: string;
  audio_track: string;
  background_music?: string;
  total_duration_frames?: number;
  video_clips: {
    file: string;
    start_frame: number;
    end_frame: number;
  }[];
  dynamic_captions: {
    word: string;
    start_frame: number;
    end_frame: number;
    emphasis: boolean;
  }[];
}

// Mock blueprint used for preview when no real blueprint is loaded
export const MOCK_BLUEPRINT: Blueprint = {
  project_name: "Mock Product",
  audio_track: "",
  video_clips: [
    { file: "", start_frame: 0, end_frame: 90 },
    { file: "", start_frame: 90, end_frame: 258 }
  ],
  dynamic_captions: [
    { word: "STOP", start_frame: 10, end_frame: 25, emphasis: true },
    { word: "wiping", start_frame: 25, end_frame: 40, emphasis: false },
    { word: "your", start_frame: 40, end_frame: 50, emphasis: false },
    { word: "desk!", start_frame: 50, end_frame: 90, emphasis: true },
    { word: "Click", start_frame: 110, end_frame: 125, emphasis: false },
    { word: "the", start_frame: 125, end_frame: 140, emphasis: false },
    { word: "BASKET", start_frame: 140, end_frame: 180, emphasis: true },
  ]
};

export const VideoComposition: React.FC<{ blueprint: Blueprint }> = ({ blueprint }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const clips = Array.isArray(blueprint.video_clips) ? blueprint.video_clips : [];
  const captions = Array.isArray(blueprint.dynamic_captions) ? blueprint.dynamic_captions : [];
  const hasRealClips = clips.some(c => typeof c.file === "string" && c.file.length > 0);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f19" }}>
      
      {/* 1. LAYER: Background Video Clips (B-Roll) */}
      {clips.map((clip, index) => {
        const duration = clip.end_frame - clip.start_frame;
        // <Sequence> throws on non-positive or non-finite durations
        if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(clip.start_frame)) return null;
        return (
          <Sequence key={index} from={clip.start_frame} durationInFrames={duration}>
            {hasRealClips && clip.file ? (
              <Video 
                src={`/assets/${clip.file}`} 
                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              />
            ) : (
              <AbsoluteFill style={{ 
                backgroundColor: index % 2 === 0 ? "#1e293b" : "#334155",
                justifyContent: "center",
                alignItems: "center"
              }}>
                <h2 style={{ color: "rgba(255,255,255,0.15)", fontSize: "2.5rem", fontFamily: 'Inter, sans-serif', fontWeight: 800 }}>
                  B-Roll Clip {index + 1}
                </h2>
              </AbsoluteFill>
            )}
          </Sequence>
        );
      })}

      {/* 2. LAYER: AI Voiceover Audio */}
      {hasRealClips && blueprint.audio_track && (
        <Audio src={`/assets/${blueprint.audio_track}`} />
      )}

      {/* 3. LAYER: Background Music */}
      {hasRealClips && blueprint.background_music && (
        <Audio src={`/assets/${blueprint.background_music}`} volume={0.15} />
      )}

      {/* 4. LAYER: Dynamic TikTok Captions (Alex Hormozi Style) */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: "15%" }}>
        {captions.map((cap, i) => {
          const isActive = frame >= cap.start_frame && frame <= cap.end_frame;
          if (!isActive) return null;

          const scale = spring({
            fps,
            frame: frame - cap.start_frame,
            config: { damping: 12, stiffness: 200, mass: 0.5 },
          });

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                transform: `scale(${scale}) rotate(${cap.emphasis ? -3 : 0}deg)`,
                fontSize: cap.emphasis ? "80px" : "64px",
                fontFamily: "Inter, sans-serif",
                fontWeight: 900,
                color: cap.emphasis ? "#facc15" : "#ffffff",
                WebkitTextStroke: "3px black",
                textShadow: "8px 8px 0px rgba(0,0,0,0.6)",
                textTransform: "uppercase",
                textAlign: "center",
                lineHeight: 1
              }}
            >
              {cap.word}
            </div>
          );
        })}
      </AbsoluteFill>
      
    </AbsoluteFill>
  );
};
