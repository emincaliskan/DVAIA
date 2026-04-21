"""
Audio payload generators. WAV via stdlib wave; synthetic (scipy/numpy); optional TTS (gTTS+pydub).
Returns absolute Path to created file.
"""
import wave
from pathlib import Path
from typing import Optional

from payloads.config import get_output_dir
from payloads._utils import resolve_output_path


def create_synthetic_wav(
    duration_sec: float = 1.0,
    frequency: float = 440.0,
    sample_rate: int = 44100,
    filename: Optional[str] = None,
    subdir: str = "audio",
    output_path: Optional[Path] = None,
) -> Path:
    """Create a synthetic WAV (sine tone). Returns absolute path."""
    import numpy as np

    if output_path is not None:
        path = Path(output_path).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
    else:
        base = get_output_dir()
        path = resolve_output_path(filename, subdir, "wav", base)
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), dtype=np.float32)
    data = (np.sin(2 * np.pi * frequency * t) * 0.5).astype(np.float32)
    # Convert to 16-bit PCM
    samples = (data * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(samples.tobytes())
    return path


def create_tts_wav(
    text: str,
    filename: Optional[str] = None,
    subdir: str = "audio",
    sample_rate: int = 44100,
) -> Path:
    """
    Create a WAV from text (TTS). Tries gTTS + pydub; falls back to synthetic tone.
    For pydub, ffmpeg must be on PATH. Returns absolute path.
    """
    base = get_output_dir()
    path = resolve_output_path(filename, subdir, "wav", base)
    try:
        from gtts import gTTS
        from pydub import AudioSegment
    except ImportError:
        return create_synthetic_wav(duration_sec=0.5, output_path=path)
    if not text.strip():
        return create_synthetic_wav(duration_sec=0.5, output_path=path)
    try:
        tmp_mp3 = path.with_suffix(".mp3")
        tts = gTTS(text=text[:500], lang="en")
        tts.save(str(tmp_mp3))
        seg = AudioSegment.from_mp3(str(tmp_mp3))
        seg = seg.set_frame_rate(sample_rate).set_channels(1)
        seg.export(str(path), format="wav")
        if tmp_mp3.exists():
            tmp_mp3.unlink()
    except Exception:
        path = create_synthetic_wav(duration_sec=0.5, output_path=path)
    return path
