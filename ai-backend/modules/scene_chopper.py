import os
import cv2
from scenedetect import detect, ContentDetector, split_video_ffmpeg

def detect_and_split(video_path: str, output_dir: str) -> list[str]:
    """
    Detects scene changes in a raw video and splits it into smaller clips.
    Returns a list of file paths to the chopped clips.
    """
    print(f"🎬 Processing video: {video_path}")
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    # Get the base name of the video file to prefix our clips
    base_name = os.path.splitext(os.path.basename(video_path))[0]
    
    # 1. Find the scenes using PySceneDetect
    print("🔍 Detecting scenes...")
    scene_list = detect(video_path, ContentDetector(threshold=27.0))
    
    print(f"✂️ Found {len(scene_list)} scenes. Splitting video...")
    
    # 2. Split the video using ffmpeg
    # PySceneDetect handles the ffmpeg splitting for us
    output_file_template = os.path.join(output_dir, f"{base_name}_clip_$SCENE_NUMBER.mp4")
    split_video_ffmpeg(video_path, scene_list, output_file_template=output_file_template, show_progress=False)
    
    # 3. Collect the paths to the generated clips
    generated_clips = []
    # Scene numbers are 1-indexed and padded to 3 digits by default
    for i in range(1, len(scene_list) + 1):
        clip_path = output_file_template.replace("$SCENE_NUMBER", f"{i:03d}")
        if os.path.exists(clip_path):
            generated_clips.append(clip_path)
            
    print(f"✅ Successfully chopped {len(generated_clips)} clips.")
    return generated_clips

if __name__ == "__main__":
    # Test block
    # detect_and_split("./data/raw/test_video.mp4", "./data/clips")
    pass
