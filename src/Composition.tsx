import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, staticFile, Audio, Video, delayRender, continueRender } from "remotion";
import React, { useState, useEffect, useCallback } from "react";

// The strict JSON contract our Python CrewAI Director generates
interface Blueprint {
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

export const MyComposition: React.FC<{ blueprintFile?: string }> = ({ blueprintFile }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Helper to strip bad prefixes like "./data/" which Remotion's staticFile() rejects
  const cleanPath = (path: string) => {
    return path.replace(/^\.\/data\//, "").replace(/^\.\//, "");
  };
  
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [handle] = useState(() => delayRender("Loading blueprint JSON..."));
  const [useMock, setUseMock] = useState(false);

  const loadBlueprint = useCallback(async () => {
    // Determine which file to load (prop overrides default)
    const filename = blueprintFile || "latest_blueprint.json";
    
    try {
      const url = `${staticFile(filename)}?t=${Date.now()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Blueprint not found: ${filename}`);
      }
      
      const data: Blueprint = await response.json();
      setBlueprint(data);
      continueRender(handle);
    } catch (err) {
      // No blueprint file yet — fall back to mock for dev/preview
      console.warn(`Could not load blueprint "${filename}", using mock data for preview.`, err);
      setBlueprint(MOCK_BLUEPRINT);
      setUseMock(true);
      continueRender(handle);
    }
  }, [blueprintFile, handle]);

  useEffect(() => {
    loadBlueprint();
  }, [loadBlueprint]);

  // While loading, show nothing (Remotion will wait via delayRender)
  if (!blueprint) return null;

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
      {(blueprint.video_clips || (blueprint as any).clip_timeline || []).map((clip: any, index: number) => {
        const duration = clip.end_frame - clip.start_frame;
        
        // Safety: If the AI puts a description instead of a filename, show a placeholder
        const isRealFile = clip.file.includes('.') && !clip.file.includes(' ');

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
                   <span style={{ fontSize: '1.5rem' }}>{isRealFile ? clip.file : 'Missing Visuals'}</span>
                 </h2>
              </AbsoluteFill>
            ) : (
              /* Real video clip from the pipeline */
              <Video 
                src={staticFile(cleanPath(clip.file))} 
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
