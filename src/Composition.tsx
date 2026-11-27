import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, staticFile, Audio, Video, CalculateMetadataFunction } from "remotion";
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

// Mock blueprint used only when no real blueprint file is available (dev/preview)
const MOCK_BLUEPRINT: Blueprint = {
  project_name: "Mock Product",
  audio_track: "mock_audio.mp3",
  video_clips: [
    { file: "clip1.mp4", start_frame: 0, end_frame: 90 },
    { file: "clip2.mp4", start_frame: 90, end_frame: 258 }
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

type CompositionProps = {
  blueprintFile?: string;
  // Filled in by calculateMetadata; not meant to be passed by hand
  blueprint?: Blueprint;
  useMock?: boolean;
};

const DEFAULT_DURATION = 1800;

// Length in frames: explicit total, else the end of the last clip/caption
const blueprintFrames = (bp: Blueprint): number => {
  if (bp.total_duration_frames && bp.total_duration_frames > 0) return bp.total_duration_frames;
  const ends = [...(bp.video_clips ?? []), ...(bp.dynamic_captions ?? [])].map((x) => x?.end_frame || 0);
  const last = Math.max(0, ...ends);
  return last > 0 ? last : DEFAULT_DURATION;
};

// Loads the blueprint before rendering so the composition length matches it
export const calculateBlueprintMetadata: CalculateMetadataFunction<CompositionProps> = async ({ props }) => {
  const filename = props.blueprintFile || "latest_blueprint.json";
  try {
    const response = await fetch(`${staticFile(filename)}?t=${Date.now()}`);
    if (!response.ok) throw new Error(`Blueprint not found: ${filename}`);
    const blueprint: Blueprint = await response.json();
    return { durationInFrames: blueprintFrames(blueprint), props: { ...props, blueprint, useMock: false } };
  } catch (err) {
    // No blueprint file yet: fall back to mock for dev/preview
    console.warn(`Could not load blueprint "${filename}", using mock data for preview.`, err);
    return { durationInFrames: blueprintFrames(MOCK_BLUEPRINT), props: { ...props, blueprint: MOCK_BLUEPRINT, useMock: true } };
  }
};

// Helper to strip bad prefixes like "./data/" which Remotion's staticFile() rejects
const cleanPath = (path: string) => {
  return path.replace(/^\.\/data\//, "").replace(/^\.\//, "");
};

export const MyComposition: React.FC<CompositionProps> = ({ blueprint = MOCK_BLUEPRINT, useMock = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      
      {/* Dev mode banner when using mock data */}
      {useMock && (
        <AbsoluteFill style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 30,
          zIndex: 999
        }}>
          <div style={{
            background: "rgba(250, 204, 21, 0.9)",
            color: "#000",
            padding: "8px 24px",
            borderRadius: 8,
            fontSize: 28,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif"
          }}>
            ⚠️ PREVIEW MODE — Using mock data
          </div>
        </AbsoluteFill>
      )}

      {/* 1. LAYER: Background Video Clips (B-Roll) */}
      {(blueprint.video_clips || (blueprint as Blueprint & { clip_timeline?: Blueprint["video_clips"] }).clip_timeline || []).map((clip: Partial<Blueprint["video_clips"][number]>, index: number) => {
        const duration = (clip?.end_frame ?? NaN) - (clip?.start_frame ?? NaN);
        // <Sequence> throws on non-positive or non-finite durations
        if (!Number.isFinite(duration) || duration <= 0 || clip.start_frame === undefined) return null;

        // Safety: If the AI puts a description instead of a filename, show a placeholder
        const file = typeof clip.file === "string" ? clip.file : "";
        const isRealFile = file.includes('.') && !file.includes(' ');

        return (
          <Sequence key={index} from={clip.start_frame} durationInFrames={duration}>
            {(!isRealFile || useMock) ? (
              /* Mock placeholder when no real clips exist or path is invalid */
              <AbsoluteFill style={{ 
                backgroundColor: index % 2 === 0 ? "#1e293b" : "#334155",
                justifyContent: "center",
                alignItems: "center"
              }}>
                 <h2 style={{ color: "rgba(255,255,255,0.2)", fontSize: "4rem", fontFamily: 'sans-serif', textAlign: 'center', padding: 40 }}>
                   [ Clip {index + 1} ]<br/>
                   <span style={{ fontSize: '1.5rem' }}>{isRealFile ? file : 'Missing Visuals'}</span>
                 </h2>
              </AbsoluteFill>
            ) : (
              /* Real video clip from the pipeline */
              <Video 
                src={staticFile(cleanPath(file))} 
                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              />
            )}
          </Sequence>
        );
      })}

      {/* 2. LAYER: AI Voiceover Audio */}
      {!useMock && blueprint.audio_track && (
        <Audio src={staticFile(cleanPath(blueprint.audio_track))} />
      )}

      {/* 3. LAYER: Background Music (if provided) */}
      {!useMock && blueprint.background_music && (
        <Audio src={staticFile(cleanPath(blueprint.background_music))} volume={0.15} />
      )}

      {/* 4. LAYER: Dynamic TikTok Captions (Alex Hormozi Style) */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: "15%" }}>
        {(blueprint.dynamic_captions || []).map((cap, i) => {
          // Determine if this exact word is currently spoken
          const isActive = frame >= cap.start_frame && frame <= cap.end_frame;
          if (!isActive) return null;

          // Create an aggressive, bouncy pop-in animation using Remotion Springs
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
                fontSize: cap.emphasis ? "150px" : "120px",
                fontFamily: "Inter, sans-serif",
                fontWeight: 900,
                color: cap.emphasis ? "#facc15" : "#ffffff", // Yellow for emphasis, white for normal
                WebkitTextStroke: "6px black",
                textShadow: "15px 15px 0px rgba(0,0,0,0.6)", // Deep drop shadow for visibility
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
