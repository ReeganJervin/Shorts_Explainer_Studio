"""Creates voice clips with Kokoro (offline). Called by make-short.js; you don't run it yourself.

Usage: python tools/tts.py <models-folder> <jobs.json>
jobs.json: [{"text": "...", "voice": "af_heart", "speed": 0.92, "out": "path.wav"}, ...]
"voice" can be one voice ("af_sky") or a blend ("am_puck:0.6+af_sky:0.4", weights should add up to 1).
"""
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

models, jobs_path = sys.argv[1], sys.argv[2]
k = Kokoro(os.path.join(models, "kokoro.onnx"), os.path.join(models, "voices.bin"))
styles = np.load(os.path.join(models, "voices.bin"))


def voice_style(spec):
    """A single voice name, or a weighted blend of voice styles."""
    if "+" not in spec:
        return spec
    mix = 0
    for part in spec.split("+"):
        name, weight = part.split(":")
        mix = mix + styles[name.strip()] * float(weight)
    return mix.astype(np.float32)


jobs = json.load(open(jobs_path, encoding="utf-8"))
for i, job in enumerate(jobs, 1):
    voice = job["voice"]
    # British voices (bf_/bm_, or a blend that starts with one) read with British pronunciation
    lang = "en-gb" if voice.strip().startswith("b") else "en-us"
    samples, sr = k.create(job["text"], voice=voice_style(voice), speed=job["speed"], lang=lang)
    sf.write(job["out"], samples, sr)
    print(f"  voice {i}/{len(jobs)}: {job['text'][:60]}", flush=True)
