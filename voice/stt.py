"""Speech-to-text worker: loads a local Whisper model once, then transcribes one recording per stdin line.

Each stdin line is JSON {"path": ..., "hotwords": ..., "embed": bool}: a raw recording of 16 kHz mono float32 samples
(the app captures them that way, so no audio decoder/ffmpeg is needed), words to bias recognition towards (his name),
and whether to also return the speaker's voiceprint (to tell the user's voice from other people's).

Protocol (JSON lines on stdout): {"ready": true} once loaded, then {"text": ..., "lang": ..., "emb": [...]} per recording.
Needs: pip install faster-whisper   (the model downloads on first run, ~500 MB for "small")
Voiceprints: pip install sherpa-onnx, and voice/speaker.onnx (WeSpeaker ResNet34, from the sherpa-onnx releases)
"""
import json
import os
import sys

import numpy as np
from faster_whisper import WhisperModel

# ponytail: CPU int8 is fast enough for short phrases; CUDA needs cuBLAS/cuDNN DLLs on PATH - switch device when it does
model = WhisperModel(sys.argv[1] if len(sys.argv) > 1 else "small", device="cpu", compute_type="int8")
speaker = None  # loaded the first time a voiceprint is asked for


def voiceprint(audio):
    """A unit-length speaker embedding of the recording: close to 1 against the same voice, far below for others."""
    global speaker
    if speaker is None:
        import sherpa_onnx
        model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "speaker.onnx")
        speaker = sherpa_onnx.SpeakerEmbeddingExtractor(sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=model_path, num_threads=2))
    stream = speaker.create_stream()
    stream.accept_waveform(16000, audio)
    stream.input_finished()
    e = np.array(speaker.compute(stream))
    return (e / np.linalg.norm(e)).round(5).tolist()


print(json.dumps({"ready": True}), flush=True)

for line in sys.stdin:
    if not line.strip():
        continue
    try:
        job = json.loads(line)
        raw = np.fromfile(job["path"], dtype=np.float32)
        peak = np.abs(raw).max()
        audio = raw * (0.9 / peak) if peak > 0 else raw  # quiet speech from a distant mic otherwise comes back empty
        # no Whisper VAD: the app already cut out a phrase with speech in it, and the VAD was discarding short phrases
        segments, info = model.transcribe(audio, vad_filter=False, beam_size=1, hotwords=job.get("hotwords") or None)
        out = {"text": " ".join(s.text.strip() for s in segments).strip(), "lang": info.language}
        if job.get("embed"):
            try:
                out["emb"] = voiceprint(audio)
            except Exception as e:  # no sherpa-onnx or model: transcription still works, the app reports it
                out["embError"] = str(e)
        print(json.dumps(out), flush=True)
    except Exception as e:  # a broken recording must not kill the worker
        print(json.dumps({"error": str(e)}), flush=True)
