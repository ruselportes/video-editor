"""
Parsing and normalisation of the LLM-generated edit blueprint.

The Director agent is asked for strict JSON, but local models regularly return
extra prose, overlapping/gapped frame ranges, invented filenames or nothing
usable at all. Everything that reaches the Remotion player goes through here.
"""
import json
import re

FPS = 30
DEFAULT_CLIP_FRAMES = 120  # 4 seconds, used when the LLM's edit is unusable
MIN_CLIP_FRAMES = 15


class BlueprintError(ValueError):
    pass


def parse_llm_json(raw: str) -> dict:
    """Extract the first JSON object from the LLM output."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise BlueprintError("The Director agent did not return any JSON.")
        try:
            data = json.loads(match.group())
        except json.JSONDecodeError as e:
            raise BlueprintError(f"The Director agent returned invalid JSON: {e}")
    if not isinstance(data, dict):
        raise BlueprintError("The Director agent returned JSON that is not an object.")
    return data


def clean_voiceover(text) -> str:
    if not isinstance(text, str):
        return ""
    text = text.strip()
    # LLMs often wrap the whole script in quotes
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        text = text[1:-1].strip()
    return text


def _to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_clips(raw_clips, available_paths: list[str], target_frames: int) -> list[dict]:
    """
    Keep only clips that point at files we actually produced, then lay them out
    back-to-back (no gaps, no overlaps) so they cover `target_frames`.
    """
    available = set(available_paths)
    picked = []
    if isinstance(raw_clips, list):
        for clip in raw_clips:
            if not isinstance(clip, dict):
                continue
            path = clip.get("file")
            if path not in available:
                continue
            start, end = _to_int(clip.get("start_frame")), _to_int(clip.get("end_frame"))
            length = (end - start) if start is not None and end is not None else DEFAULT_CLIP_FRAMES
            picked.append({"file": path, "order": start if start is not None else 0, "length": max(length, MIN_CLIP_FRAMES)})
        picked.sort(key=lambda c: c["order"])

    if not picked:
        # LLM edit unusable: cycle through the real clips in order
        picked = [{"file": p, "length": DEFAULT_CLIP_FRAMES} for p in available_paths]
    if not picked:
        raise BlueprintError("No video clips were produced from the upload.")

    timeline = []
    cursor = 0
    i = 0
    # Repeat the sequence if needed so the visuals last as long as the voiceover
    while cursor < target_frames or not timeline:
        clip = picked[i % len(picked)]
        timeline.append({"file": clip["file"], "start_frame": cursor, "end_frame": cursor + clip["length"]})
        cursor += clip["length"]
        i += 1
        if i > 1000:
            break

    # Trim the last clip so the video ends with the voiceover
    if target_frames > 0 and timeline[-1]["end_frame"] > target_frames:
        last = timeline[-1]
        if target_frames - last["start_frame"] >= MIN_CLIP_FRAMES:
            last["end_frame"] = target_frames
        elif len(timeline) > 1:
            timeline.pop()
            timeline[-1]["end_frame"] = target_frames
    return timeline
