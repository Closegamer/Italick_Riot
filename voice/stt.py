"""Speech-to-text worker: loads a local Whisper model once, then transcribes one recording per stdin line.

Each line is the path of a raw recording: 16 kHz mono float32 samples (the chat captures them that way,
so no audio decoder/ffmpeg is needed).

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
    path = line.strip()
    if not path:
        continue
    try:
        segments, info = model.transcribe(np.fromfile(path, dtype=np.float32), vad_filter=True, beam_size=1)
        text = " ".join(s.text.strip() for s in segments).strip()
        print(json.dumps({"text": text, "lang": info.language}), flush=True)
    except Exception as e:  # a broken recording must not kill the worker
        print(json.dumps({"error": str(e)}), flush=True)
