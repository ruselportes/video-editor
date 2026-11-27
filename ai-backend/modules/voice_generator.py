import os
import asyncio
import edge_tts


async def text_to_speech(text: str, output_dir: str, filename: str = "generated_voiceover.mp3") -> str:
    """
    Converts the AI script into an audio file using edge-tts.
    This provides high-quality, free voices.
    """
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, filename)
    print("🎙️ Generating Voiceover via edge-tts...")

    # We use a popular TikTok-style voice (en-US-GuyNeural or en-US-ChristopherNeural)
    voice = "en-US-GuyNeural"
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

    return output_path


def text_to_speech_sync(text: str, output_dir: str, filename: str = "generated_voiceover.mp3") -> str:
    """Run from a worker thread (no event loop running there)."""
    return asyncio.run(text_to_speech(text, output_dir, filename))
