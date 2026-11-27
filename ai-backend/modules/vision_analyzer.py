import base64
import requests
import json
import cv2
import os

# Same variable crew_agents uses; in Docker it points at the ollama-server container
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")

def analyze_clip_frame(clip_path: str) -> str:
    """
    Extracts the middle frame of a video clip, sends it to the local LLaVA model
    via Ollama, and returns a short description of the scene.
    """
    # 1. Extract a frame using OpenCV
    cap = cv2.VideoCapture(clip_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Get the frame right in the middle of the clip
    cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2)
    success, frame = cap.read()
    cap.release()
    
    if not success:
        return "Failed to extract frame from video."

    # 2. Encode the frame to base64
    _, buffer = cv2.imencode('.jpg', frame)
    base64_image = base64.b64encode(buffer).decode('utf-8')
    
    # 3. Send to Ollama LLaVA
    prompt = "Describe what is happening in this image briefly in one sentence. Focus on the main subject or action."
    
    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": "llava",
                "prompt": prompt,
                "images": [base64_image],
                "stream": False
            },
            timeout=600,
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get("response", "").strip()
        else:
            return f"Ollama API Error: {response.status_code}"
            
    except Exception as e:
        return f"Failed to connect to local Ollama server: {str(e)}"

if __name__ == "__main__":
    # Test block
    # print(analyze_clip_frame("./data/clips/test_clip.mp4"))
    pass
