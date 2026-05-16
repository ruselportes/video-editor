import os
import asyncio
import edge_tts

async def text_to_speech(text: str, output_dir: str) -> str:
    """
    Converts the AI script into an audio file using edge-tts.
    This provides high-quality, free voices. 
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    output_path = os.path.join(output_dir, "generated_voiceover.mp3")
    print(f"🎙️ Generating Voiceover via edge-tts...")
    
    # We use a popular TikTok-style voice (en-US-GuyNeural or en-US-ChristopherNeural)
    voice = "en-US-GuyNeural"
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    
    return output_path

# Helper to run async in sync context if needed
def text_to_speech_sync(text: str, output_dir: str) -> str:
    return asyncio.run(text_to_speech(text, output_dir))
