# Local AI Faceless TikTok Generator

Welcome to the **Local AI Faceless TikTok Generator**! This project is an automated, 100% local, off-the-grid video editing pipeline designed specifically to create viral, short-form affiliate marketing videos for TikTok. 

Unlike other AI tools that rely on expensive paid APIs (like OpenAI, Claude, or ElevenLabs), this project leverages open-source models running locally on your hardware.

## 🚀 Features
* **100% Free & Offline:** Uses local Ollama (Llama 3, LLaVA) and local TTS models.
* **Multi-Agent AI (CrewAI):** Uses a "team" of AI agents (Visionary, Marketer, Director) to intelligently crop your raw B-roll and write high-converting scripts.
* **Dynamic Captions:** Leverages `faster-whisper` to create accurate, word-level bouncing captions (Alex Hormozi style).
* **Unified Dashboard:** A single-tab experience — upload footage, generate, and preview the result all in one place via the embedded Remotion Player.
* **Remotion Engine:** Uses React and Remotion for programmatic, pixel-perfect video rendering at a 9:16 aspect ratio (1080x1920).

---

## 📂 Project Architecture

The workspace is divided into three main components, all inside `video-editor/`:

1. **`ui-dashboard/`**: A React/Vite frontend with an embedded Remotion Player. This is the unified control panel — upload raw footage, trigger generation, and preview the result in one tab.
2. **`ai-backend/`**: The Python FastAPI server that runs `PySceneDetect`, `faster-whisper`, and the `CrewAI` orchestration. Outputs the JSON "Edit Blueprint."
3. **`src/` (Remotion)**: The standalone Remotion project for advanced debugging and CLI rendering (`npx remotion render`).

### How the Pipeline Flows

```
Upload Video (Dashboard) → FastAPI Backend → CrewAI Agents → JSON Blueprint
                                                                   ↓
                            Remotion Player (Dashboard) ← latest_blueprint.json
                                                                   ↓
                                                        npx remotion render → MP4
```

---

## 📚 Essential Documentation
To understand how this project works under the hood, please refer to the following blueprint files included in this repository:

* 📄 **[The Pipeline Blueprint](./docs/local_ai_video_pipeline.md):** Explains the architecture, the CrewAI workflow, and the FastAPI structure.
* 📄 **[The Project Tracker](./docs/tiktok_generator_tracker.md):** The living to-do list where we log what is finished and what we are building next.
* 📄 **[The Custom AI Skill](./docs/tiktok_generator_skill.md):** The strict rulebook and JSON contract that the AI must follow when contributing to this repository.

---

## 🧠 Setting up the Local AI (Ollama)

Because this tool is 100% offline, the AI models are hosted inside a Docker container. 

When you first build the project, Docker downloads the Ollama *software*, but it does NOT automatically download the massive AI models (Llama 3 and LLaVA). You must trigger this download once the containers are running.

1. **Start the network:**
   ```bash
   docker-compose up -d
   ```
2. **Download the AI Marketer/Director:** Open your terminal and tell the container to pull the model:
   ```bash
   docker exec -it ollama-server ollama run llama3
   ```
3. **Download the AI Visionary:**
   ```bash
   docker exec -it ollama-server ollama run llava
   ```
*Note: Because we mapped `ollama_data` in the compose file, these models are permanently saved to a Docker volume. You only have to download them once.*

---

## 🛠️ Quick Start (Running the App)

### 1. Start Everything (One Command)
```bash
docker-compose up --build
```
This launches **all three services** in one go:
- 🧠 **Ollama AI server** (Llama 3 + LLaVA), reachable only by the backend on the internal Docker network
- ⚙️ **Python FastAPI backend** (CrewAI pipeline) on `127.0.0.1:8000`
- 🖥️ **Unified Dashboard** (with embedded Remotion Player) on `127.0.0.1:5173`

All ports are bound to `127.0.0.1`, so other devices on your network can't reach them. The backend only accepts requests from the dashboard's origin (`ALLOWED_ORIGINS` in `docker-compose.yml`), and runs one job at a time.

Open **`http://localhost:5173`** — that's the only URL you need.

### 2. Generate a Video
1. Enter a product name in the sidebar
2. Drop your raw B-roll footage
3. Click **"Generate TikTok ✨"**
4. Watch the progress bar — when it hits 100%, the blueprint auto-loads into the player

### 3. Render the Final MP4 (Optional)
Once you're happy with the preview, render the final video from the root folder:
```bash
npx remotion render MyComp out/my_tiktok.mp4
```
You can also target a specific blueprint:
```bash
npx remotion render MyComp --props='{"blueprintFile":"MyProduct_blueprint.json"}'
```

---

## 🗂️ Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates Ollama, backend, and dashboard containers |
| `ai-backend/main.py` | FastAPI server — handles uploads and runs the CrewAI pipeline |
| `ai-backend/modules/crew_agents.py` | Defines the Visionary, Marketer, and Director agents |
| `ui-dashboard/src/App.tsx` | Unified dashboard — sidebar controls + embedded Remotion Player |
| `ui-dashboard/src/VideoComposition.tsx` | The Remotion composition used inside the Player |
| `src/Composition.tsx` | Standalone Remotion composition (for CLI rendering) |
| `public/latest_blueprint.json` | Auto-generated by the backend — the latest Edit Blueprint |
