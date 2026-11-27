import json
import os
import re
import threading
import uuid

from fastapi import BackgroundTasks, FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from modules import aligner, crew_agents, scene_chopper, vision_analyzer, voice_generator
from modules.blueprint import FPS, BlueprintError, clean_voiceover, normalize_clips, parse_llm_json

REMOTION_PUBLIC = "/app/remotion_public"
DASHBOARD_PUBLIC = "/app/dashboard_public"
RAW_DIR = os.path.abspath("./data/raw")

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "2048")) * 1024 * 1024

# Only the dashboard may call this API. Browsers send simple cross-site POSTs
# (multipart forms) without a CORS preflight, so CORS alone does not stop a
# malicious page from starting jobs: the origin check below does.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def reject_foreign_origins(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin is not None and origin not in ALLOWED_ORIGINS:
        return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    return await call_next(request)


# One job at a time: the pipeline saturates the machine anyway, and this keeps
# the status endpoint and shared output files consistent.
_job_lock = threading.Lock()
job_status = {"status": "idle", "progress": 0, "message": "", "blueprint": None}


def _set_status(status: str, progress: int, message: str, blueprint: str | None = None):
    global job_status
    job_status = {"status": status, "progress": progress, "message": message, "blueprint": blueprint}


def make_slug(name: str) -> str:
    """Filesystem-safe name: letters, digits, '-' and '_' only."""
    slug = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")
    return slug[:64]


def _write_json(path: str, data: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
    os.replace(tmp, path)


def run_multi_agent_pipeline(file_path: str, product_name: str, slug: str, job_id: str):
    # Plain `def` on purpose: FastAPI runs sync background tasks in a worker
    # thread, so the blocking steps below don't freeze /api/status.
    try:
        # STEP 1: Chop the raw video into the shared public folder
        _set_status("processing", 10, "Chopping raw video...")
        clips = scene_chopper.detect_and_split(file_path, output_dir=os.path.join(REMOTION_PUBLIC, "clips"))
        if not clips:
            raise BlueprintError("No scenes could be cut from the uploaded video.")
        clip_paths = [os.path.relpath(c, REMOTION_PUBLIC).replace(os.sep, "/") for c in clips]

        # STEP 2: Vision analysis
        _set_status("processing", 30, "Visionary Agent Analyzing Clips...")
        clip_descriptions = [
            {"clip_path": rel, "description": vision_analyzer.analyze_clip_frame(full)}
            for full, rel in zip(clips, clip_paths)
        ]

        # STEP 3: CrewAI (Marketer & Director)
        _set_status("processing", 50, "CrewAI Assembling Script & Edit...")
        raw_blueprint = parse_llm_json(crew_agents.run_crew_pipeline(product_name, clip_descriptions))
        script_text = clean_voiceover(raw_blueprint.get("voiceover_text"))
        if not script_text:
            raise BlueprintError("The Director agent did not return a voiceover script.")

        # STEP 4: Voiceover (unique file per job so older blueprints keep their audio)
        _set_status("processing", 70, "Generating AI Voiceover...")
        audio_full_path = voice_generator.text_to_speech_sync(
            script_text, output_dir=os.path.join(REMOTION_PUBLIC, "audio"), filename=f"{slug}_{job_id}.mp3"
        )
        audio_path = os.path.relpath(audio_full_path, REMOTION_PUBLIC).replace(os.sep, "/")

        # STEP 5: Caption timestamps
        _set_status("processing", 85, "Syncing dynamic captions...")
        word_timestamps, audio_seconds = aligner.get_word_timestamps(audio_full_path)
        total_frames = max(int(audio_seconds * FPS) + FPS // 2, FPS)  # half a second of tail

        # STEP 6: Final, validated blueprint
        _set_status("processing", 95, "Compiling timeline...")
        final_blueprint = {
            "project_name": product_name,
            "voiceover_text": script_text,
            "video_clips": normalize_clips(raw_blueprint.get("video_clips"), clip_paths, total_frames),
            "audio_track": audio_path,
            "dynamic_captions": word_timestamps,
            "total_duration_frames": total_frames,
        }

        blueprint_name = f"{slug}_blueprint.json"
        for folder in (DASHBOARD_PUBLIC, REMOTION_PUBLIC):
            _write_json(os.path.join(folder, blueprint_name), final_blueprint)
            _write_json(os.path.join(folder, "latest_blueprint.json"), final_blueprint)

        _set_status("complete", 100, "Ready to preview!", blueprint=blueprint_name)

    except Exception as e:
        _set_status("error", 0, f"Error: {e}")
    finally:
        try:
            os.remove(file_path)
        except OSError:
            pass
        _job_lock.release()


@app.post("/api/generate")
async def generate_video(file: UploadFile, background_tasks: BackgroundTasks, product_name: str = Form(...)):
    product_name = product_name.strip()[:120]
    slug = make_slug(product_name)
    if not slug:
        raise HTTPException(400, "Product name must contain at least one letter or digit.")

    # Never trust the client's filename: keep only a whitelisted extension.
    ext = os.path.splitext(os.path.basename(file.filename or ""))[1].lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}")

    if not _job_lock.acquire(blocking=False):
        raise HTTPException(409, "A video is already being generated. Wait for it to finish.")

    job_id = uuid.uuid4().hex[:12]
    os.makedirs(RAW_DIR, exist_ok=True)
    file_path = os.path.join(RAW_DIR, f"{job_id}{ext}")

    try:
        # Stream to disk instead of reading the whole upload into memory
        written = 0
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
                buffer.write(chunk)
        if written == 0:
            raise HTTPException(400, "The uploaded file is empty.")
    except BaseException:
        if os.path.exists(file_path):
            os.remove(file_path)
        _job_lock.release()
        raise

    _set_status("processing", 5, "Upload received, starting pipeline...")
    background_tasks.add_task(run_multi_agent_pipeline, file_path, product_name, slug, job_id)
    return {"message": "Job started!", "job_id": job_id}


@app.get("/api/status")
async def get_status():
    return job_status
