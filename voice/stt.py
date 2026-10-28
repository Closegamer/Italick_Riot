"""Speech-to-text worker: loads a local Whisper model once, then transcribes one recording per stdin line.

Each stdin line is JSON {"path": ..., "hotwords": ...}: a raw recording of 16 kHz mono float32 samples (the app
captures them that way, so no audio decoder/ffmpeg is needed) and words to bias recognition towards (his name).

Protocol (JSON lines on stdout): {"ready": true} once loaded, then {"text": ..., "lang": ...} per recording.
Needs: pip install faster-whisper   (the model downloads on first run, ~500 MB for "small")
"""
import json
import sys

import numpy as np
from faster_whisper import WhisperModel

# ponytail: CPU int8 is fast enough for short phrases; CUDA needs cuBLAS/cuDNN DLLs on PATH - switch device when it does
model = WhisperModel(sys.argv[1] if len(sys.argv) > 1 else "small", device="cpu", compute_type="int8")
print(json.dumps({"ready": True}), flush=True)

for line in sys.stdin:
    if not line.strip():
        continue
    try:
        job = json.loads(line)
        audio = np.fromfile(job["path"], dtype=np.float32)
        peak = np.abs(audio).max()
        if peak > 0:
            audio = audio * (0.9 / peak)  # quiet speech from a distant mic otherwise comes back empty
        # no Whisper VAD: the app already cut out a phrase with speech in it, and the VAD was discarding short phrases
        segments, info = model.transcribe(audio, vad_filter=False, beam_size=1, hotwords=job.get("hotwords") or None)
        text = " ".join(s.text.strip() for s in segments).strip()
        print(json.dumps({"text": text, "lang": info.language}), flush=True)
    except Exception as e:  # a broken recording must not kill the worker
        print(json.dumps({"error": str(e)}), flush=True)
