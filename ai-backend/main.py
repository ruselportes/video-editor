from fastapi import FastAPI, UploadFile, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from modules import scene_chopper, vision_analyzer, crew_agents, voice_generator, aligner

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple state variable to track progress across API calls
job_status = {"status": "idle", "progress": 0, "message": ""}

async def run_multi_agent_pipeline(file_path: str, product_name: str):
    global job_status
    
    try:
        # STEP 1: Chop the raw video - Save directly to the shared public folder
        job_status = {"status": "processing", "progress": 10, "message": "Chopping raw video..."}
        public_clips_dir = "/app/remotion_public/clips"
        clips = scene_chopper.detect_and_split(file_path, output_dir=public_clips_dir)
        
        # STEP 2: Vision Analysis
        job_status = {"status": "processing", "progress": 30, "message": "Visionary Agent Analyzing Clips..."}
        clip_descriptions = []
        for clip in clips:
            desc = vision_analyzer.analyze_clip_frame(clip)
            # Convert full container path to public-relative path (e.g. "clips/scene_001.mp4")
            rel_clip_path = os.path.relpath(clip, "/app/remotion_public")
            clip_descriptions.append({"clip_path": rel_clip_path, "description": desc})
            
        # STEP 3: CrewAI (Marketer & Director)
        job_status = {"status": "processing", "progress": 50, "message": "CrewAI Assembling Script & Edit..."}
        json_result_str = crew_agents.run_crew_pipeline(product_name, clip_descriptions)
        
        # Parse the JSON returned by CrewAI
        try:
            final_blueprint = json.loads(json_result_str)
        except json.JSONDecodeError:
            # Fallback if CrewAI output includes extra markdown text
            import re
            match = re.search(r'\{.*\}', json_result_str, re.DOTALL)
            final_blueprint = json.loads(match.group()) if match else {}
            
        # STEP 4: Generate Voiceover - Save directly to the shared public folder
        job_status = {"status": "processing", "progress": 70, "message": "Generating AI Voiceover..."}
        script_text = final_blueprint.get("voiceover_text", "Fallback text")
        public_audio_dir = "/app/remotion_public/audio"
        audio_full_path = await voice_generator.text_to_speech(script_text, output_dir=public_audio_dir)
        
        # Strip the base path so the blueprint only contains "audio/filename.mp3"
        audio_path = os.path.relpath(audio_full_path, "/app/remotion_public")
        
        # STEP 5: Generate Captions Timestamps
        job_status = {"status": "processing", "progress": 85, "message": "Syncing dynamic captions..."}
        word_timestamps = aligner.get_word_timestamps(audio_full_path)
        
        # STEP 6: Finalize Blueprint
        job_status = {"status": "processing", "progress": 95, "message": "Compiling timeline..."}
        final_blueprint["audio_track"] = audio_path
        final_blueprint["dynamic_captions"] = word_timestamps
        
        # Save blueprint to BOTH the dashboard and the Remotion public folders
        # These paths match the Docker volume mounts in docker-compose.yml
        safe_name = product_name.replace(' ', '_')
        
        # 1. Save to shared volume (mounted as /app/public/blueprints in the dashboard)
        dashboard_path = f"/app/dashboard_public/{safe_name}_blueprint.json"
        os.makedirs(os.path.dirname(dashboard_path), exist_ok=True)
        with open(dashboard_path, 'w') as f:
            json.dump(final_blueprint, f, indent=4)
        
        # 2. Save a "latest" copy to the shared volume for the dashboard Player
        latest_dashboard = "/app/dashboard_public/latest_blueprint.json"
        with open(latest_dashboard, 'w') as f:
            json.dump(final_blueprint, f, indent=4)
        
        # 3. Save to video-editor/public/ via mounted volume (for standalone Remotion renderer)
        remotion_path = f"/app/remotion_public/{safe_name}_blueprint.json"
        os.makedirs(os.path.dirname(remotion_path), exist_ok=True)
        with open(remotion_path, 'w') as f:
            json.dump(final_blueprint, f, indent=4)
        
        latest_remotion = "/app/remotion_public/latest_blueprint.json"
        with open(latest_remotion, 'w') as f:
            json.dump(final_blueprint, f, indent=4)
            
        job_status = {"status": "complete", "progress": 100, "message": "Ready to preview!"}
        
    except Exception as e:
        job_status = {"status": "error", "progress": 0, "message": f"Error: {str(e)}"}


@app.post("/api/generate")
async def generate_video(file: UploadFile, background_tasks: BackgroundTasks, product_name: str = Form(...)):
    os.makedirs("./data/raw", exist_ok=True)
    file_path = f"./data/raw/{file.filename}"
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    background_tasks.add_task(run_multi_agent_pipeline, file_path, product_name)
    return {"message": "Job started!"}

@app.get("/api/status")
async def get_status():
    return job_status
