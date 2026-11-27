import threading

from faster_whisper import WhisperModel

FPS = 30

_model = None
_model_lock = threading.Lock()


def _get_model() -> WhisperModel:
    """Load the Whisper model once and reuse it across jobs."""
    global _model
    with _model_lock:
        if _model is None:
            # compute_type="int8" allows it to run on CPU efficiently if no GPU is found
            _model = WhisperModel("base", device="cpu", compute_type="int8")
        return _model


def get_word_timestamps(audio_path: str) -> tuple[list, float]:
    """
    Uses faster-whisper to transcribe the audio and extract word-level timestamps
    for dynamic TikTok captions.

    Returns (captions, audio_duration_seconds). Raises on failure so the job
    reports an error instead of silently shipping placeholder captions.
    """
    print("⏱️ Aligning audio with faster-whisper...")

    segments, info = _get_model().transcribe(audio_path, word_timestamps=True)

    dynamic_captions = []
    for segment in segments:
        for word in segment.words or []:
            text = word.word.strip()
            if not text:
                continue
            start_frame = int(word.start * FPS)
            end_frame = max(int(word.end * FPS), start_frame + 1)
            dynamic_captions.append({
                "word": text,
                "start_frame": start_frame,
                "end_frame": end_frame,
                "emphasis": False,  # Could add logic to emphasize capitalized words
            })

    if not dynamic_captions:
        raise RuntimeError("Whisper found no words in the generated voiceover.")

    return dynamic_captions, float(info.duration)
