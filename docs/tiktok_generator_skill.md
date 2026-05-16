# SKILL: Local AI Faceless TikTok Generator

## 1. Project Identity & Goal
**Context:** This project is a fully automated, 100% local AI video generation pipeline designed to create faceless TikTok affiliate marketing videos.
**Core Directive:** NEVER suggest or write code that relies on paid cloud APIs (e.g., OpenAI, Claude, Gemini, ElevenLabs). All AI processing MUST be handled by local, open-source models to ensure the system is free to run and works entirely offline.
**File Location Directive:** ALL files, folders, and code must be created inside the existing `video-editor` folder. Do not create folders outside of it.

## 2. Architecture & Folder Structure
The entire system lives under `video-editor/`, divided into three distinct modules:
- `ui-dashboard/`: React/Vite frontend. Acts as the user control panel for uploading raw footage and entering product prompts.
- `ai-backend/`: Python FastAPI server. The "Brain" that processes video, runs AI models via CrewAI, and generates the final JSON Edit Blueprint.
- `src/`: Remotion project (React). The "Renderer" that consumes the JSON Blueprint to programmatically layer video, audio, and captions.

## 3. Tech Stack & Required AI Models
When writing code for this project, adhere strictly to this stack:
- **Video Renderer:** Remotion (Canvas MUST be 1080x1920 at 30fps).
- **Backend API:** FastAPI (Python 3.10+).
- **Multi-Agent Orchestration:** `CrewAI` & `LangChain`.
- **Containerization:** `Docker` and `Docker Compose` (Everything runs in containers).
- **Text & Scripting AI:** `llama3` running via local Ollama (accessed via `host.docker.internal`).
- **Vision AI (Scene Analysis):** `llava` running via local Ollama.
- **Transcription & Timestamps:** `faster-whisper`.
- **Voice Generation (TTS):** `XTTSv2` (Coqui) or `Piper TTS`.
- **Video Processing:** `PySceneDetect` (for scene cutting) and `ffmpeg` (for extraction).

## 4. The "Edit Blueprint" JSON Contract
The Python backend (via the Director Agent) must always output, and the Remotion frontend must always consume, a JSON object matching this exact structure:

```json
{
  "project_name": "string",
  "aspect_ratio": "9:16",
  "total_duration_frames": "number",
  "audio_track": "path/to/generated_voiceover.mp3",
  "background_music": "path/to/lofi_beat.mp3",
  "video_clips": [
    {
      "file": "path/to/chopped_clip.mp4",
      "start_frame": "number",
      "end_frame": "number"
    }
  ],
  "dynamic_captions": [
    {
      "word": "string",
      "start_frame": "number",
      "end_frame": "number",
      "emphasis": "boolean"
    }
  ]
}
```

## 5. Coding Conventions
- **Multi-Agent Logic:** Use `CrewAI` to separate concerns. The Marketer Agent writes the script. The Director Agent handles mapping video clips and outputting JSON. The Visionary Agent uses LLaVA to describe clips.
- **Remotion:** Use `AbsoluteFill` and `Sequence` to manage clips. Captions must be dynamic, bouncy, and bold (TikTok style), utilizing `useVideoConfig` and `useCurrentFrame`.
- **FastAPI:** Video processing is heavy. Always use `BackgroundTasks` to prevent blocking the API. The UI must poll a `/status` endpoint to update the loading bar.
- **Ollama Integration:** Use `langchain_community.llms.Ollama` to connect CrewAI agents to the local Ollama models.
