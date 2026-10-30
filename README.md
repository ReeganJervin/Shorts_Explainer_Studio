# Shorts Explainer Studio

You write a short script for a video clip and get a finished, explained vertical Short (1080×1920, 30 fps). It has:

- a **new voiceover** (Kokoro voices, made offline on your computer)
- **captions**, a few words at a time, with the spoken word in yellow
- the **original sound turned down** and optional **background music**, both dipping further while the voice talks
- the clip **cut** to the parts you choose and **cropped to 9:16**
- a `.srt` subtitle file, a **description draft** with a credit line, and a **check report**

This is Phase 1. Coming next: step counters, labels, circles, arrows, zooms and freeze-frames (Phase 2), then a cover image and more checks (Phase 3).

## One-time setup (Windows)

1. Install **Node.js LTS** from https://nodejs.org.
2. Install **Python 3.12** from https://www.python.org/downloads/. During install, tick **"Add python.exe to PATH"**.
3. Double-click **`setup.bat`** and wait for "All set!". It needs internet once, to download the video tools, the voice tool and the voice model (about 120 MB).

After setup, everything runs offline.

## Making a Short

1. Put your clip in the **`clips`** folder (and any music in **`music`**).
2. Copy `shorts\_template.txt` to a new name, for example `shorts\bonito.txt`, and fill it in.
3. Check it: `check-script.bat shorts\bonito.txt`. This takes a second.
4. Make it: `make-short.bat shorts\bonito.txt`, or drag the script file onto `make-short.bat`.

The finished files go in the **`videos`** folder:

| File | What it is |
|---|---|
| `bonito.mp4` | The Short, ready to upload |
| `bonito.srt` | Subtitles (upload them in YouTube Studio, under Subtitles) |
| `bonito-description.txt` | A description draft: the title, the hook, the credit and the hashtags |
| `bonito-report.txt` | The checks (`PASS`, `WARN`, `FAIL`) and when each voice line plays |

A 20-second Short takes about half a minute the first time. Voice lines are remembered, so when you only change cuts or settings, the voices aren't made again.

## The script file

```
title: How bonito flakes are made
clip: clips/bonito.mp4
voice: narrator
original audio: 15%
music: music/curious.mp3
music volume: 20%
crop: center
credit: Original footage: Example Channel (youtube.com/@example)
hashtags: #shorts #japan #japanesefood

cut: 0-6.5
cut: 9-17

say: This is one of the hardest foods on Earth.
say: Fresh skipjack tuna is cut into four long loins.
say at 10: A special mould is grown on it, on purpose.
say: Shaved paper thin, it becomes the flakes that dance on hot takoyaki.
```

Lines starting with `#` are notes and do nothing.

### Settings

| Line | What it does | If you leave it out |
|---|---|---|
| `title:` | The first line of the description | The file name |
| `clip:` | The video to use (from the project folder, usually `clips/...`) | **Required** |
| `voice:` | `narrator` (calm documentary), `energetic` or `female`. You can add your own in `config/voices.json` | `narrator` |
| `original audio:` | How loud the clip's own sound is, from `0%` (muted) to `100%` | `15%` |
| `music:` | Background music (`music/...`). It loops if it's shorter than the Short | No music |
| `music volume:` | How loud the music is | `20%` |
| `crop:` | Which part of a wide clip to keep: `left`, `center`, `right`, or a number from `0` (left) to `1` (right) | `center` |
| `credit:` | The credit line for the description | A placeholder to fill in |
| `hashtags:` | The hashtags for the description | `#shorts` |
| `captions:` | `on` or `off` | `on` |

### Cuts

`cut: 0-6.5` uses the clip from 0 to 6.5 seconds. Write as many as you like; they're joined in the order you write them, so you can also change the order. Times can be `12`, `12.5` or `0:12.5`. With no cuts, the whole clip is used.

### Voice lines

- `say: text` starts just after the line before it (the first one starts at 0.2 s).
- `say at 10: text` starts 10 seconds into the **finished Short** (after the cuts), not into the original clip.

If the voice goes on longer than the footage, the last frame is held until the voice ends, and the report warns you. To fix it, add footage or shorten the script.

## The voices

`config/voices.json` holds the channel's voices. Each one is a Kokoro voice or a blend of two (for example `am_onyx:0.6+am_michael:0.4`), with `speed` and `pitch` (1 = unchanged) and an optional `gain` in dB. English voices start with `am_`/`af_` (American) or `bm_`/`bf_` (British).

## What's inside

| Folder or file | What it is |
|---|---|
| `shorts\` | Your scripts, plus the template and an example |
| `clips\`, `music\` | Your footage and music. They stay on your computer and aren't uploaded to GitHub |
| `config\voices.json` | The voices |
| `tools\make-short.js` | The main program behind the `.bat` files |
| `tools\script.js` | Reads a script and places the voice lines on the timeline |
| `tools\captions.js` | The burned-in captions and the `.srt` |
| `tools\tts.py` | Makes the voice lines with Kokoro |
| `fonts\Anton-Regular.ttf` | The caption font (SIL Open Font License, in `licenses\`) |

## Before you upload

Only use footage you have permission to use, and always fill in the `credit:` line. If you get a copyright claim, take the Short down.
