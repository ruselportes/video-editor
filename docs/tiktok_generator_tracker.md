# Local AI TikTok Generator: Project Tracker

This file serves as our living "save state" and to-do list. Whenever we finish a session or complete a major feature, we will update this file so we always know exactly where we left off.

---

## ✅ Completed Tasks (What we have done)
- [x] **Project Discovery:** Reviewed the `boost-vlog-2` repository and identified the pros/cons of a cloud-based AI editing pipeline.
- [x] **Architecture Pivot:** Re-designed the architecture to be 100% local and free.
- [x] **Format Adaptation:** Shifted the logic from horizontal YouTube vlogs to vertical 9:16 TikTok Affiliate videos.
- [x] **Architecture Blueprint:** Created the `local_ai_video_pipeline.md` outlining the 3-tier structure.
- [x] **Project Skill File:** Created `tiktok_generator_skill.md` to ensure the AI always remembers the specific tech stack and coding conventions.
- [x] **Project Tracker Created:** Initialized this file to track future progress.
- [x] **CrewAI Upgrade:** Updated all documentation to replace standalone scripts with a Multi-Agent system.
- [x] **Folder Consolidation:** Updated instructions to strictly ensure all subprojects (`ai-backend` and `ui-dashboard`) are created *inside* the existing `video-editor` folder.
- [x] **Docker Integration:** Switched execution strategy from local environments to containerized Docker deployment (`docker-compose.yml`, `Dockerfile`s).

---

## 🚧 Current Phase: Phase 1 (Environment Setup)
*We are currently deciding where to begin coding. The next immediate tasks involve setting up the foundation.*

- [x] **Task 1.1:** Restructure the `video-editor` folder to include the `ui-dashboard` and `ai-backend` subfolders.
- [x] **Task 1.2:** Initialize the Python virtual environment in `video-editor/ai-backend` and install core libraries (`fastapi`, `crewai`, `langchain-community`, `scenedetect`, `faster-whisper`).
- [x] **Task 1.3:** Configure the existing Remotion `video-editor/src` app to use a 1080x1920 canvas.

---

## 📅 Future Roadmap (What to do next)

### Phase 2: The Multi-Agent AI Backend
- [x] Write the `scene_chopper.py` to slice raw `.mp4` files using `PySceneDetect`.
- [x] Setup `crew_agents.py` to define the Visionary, Marketer, and Director agents.
- [x] Integrate Local TTS to generate the voiceover audio.
- [x] Integrate `faster-whisper` to generate the word-level timestamp JSON.
- [x] Build the `main.py` FastAPI server endpoints to kick off the CrewAI tasks.

### Phase 3: The Remotion Renderer
- [x] Create a React component that parses the AI's "Edit Blueprint" JSON.
- [x] Build the dynamic, bouncy TikTok-style text component using `faster-whisper` timestamps.
- [x] Stitch the chosen background B-roll clips together using Remotion `<Sequence>`.

### Phase 4: The UI Dashboard
- [x] Create the React/Vite web interface.
- [x] Build the Drag-and-Drop video uploader.
- [x] Build the progress bar that polls the Python backend's `/status` endpoint.
- [ ] Embed the Remotion Player for final video preview and export.
