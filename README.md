# Shorts Explainer Studio

You write a short script for a video clip and get a finished, explained vertical Short (1080×1920, 30 fps). It has:

- a **new voiceover** (Kokoro voices, made offline on your computer)
- **captions**, a few words at a time, with the spoken word in yellow
- the **original sound turned down** and optional **background music**, both dipping further while the voice talks
- the clip **cut** to the parts you choose and **cropped to 9:16**
- **markers**: step counters, labels, circles and arrows, **zooms** and **freeze-frames**, each with its own sound effect
- an optional **title card** and your **logo**
- a **cover image**, a `.srt` subtitle file, a **description draft** with a credit line, and a **check report** that warns you about the things that lose viewers

## One-time setup (Windows)

1. Install **Node.js LTS** from https://nodejs.org.
2. Install **Python 3.12** from https://www.python.org/downloads/. During install, tick **"Add python.exe to PATH"**.
3. Double-click **`setup.bat`** and wait for "All set!". It needs internet once, to download the video tools, the voice tool and the voice model (about 120 MB).

After setup, everything runs offline.

## Making a Short

1. Put your clip in the **`clips`** folder (and any music in **`music`**).
2. Copy `shorts\_template.txt` to a new name, for example `shorts\bonito.txt`, and fill it in.
3. Check it: `check-script.bat shorts\bonito.txt`. This takes a second, and also warns you about a blurry clip, cuts past the end of the clip, a title that's too long and too many hashtags.
4. Make it: `make-short.bat shorts\bonito.txt`, or drag the script file onto `make-short.bat`.

The finished files go in the **`videos`** folder:

| File | What it is |
|---|---|
| `bonito.mp4` | The Short, ready to upload |
| `bonito-cover.jpg` | The cover: a clean frame of the Short with the title on it big (see "The cover" below) |
| `bonito.srt` | Subtitles (upload them in YouTube Studio, under Subtitles) |
| `bonito-description.txt` | A description draft: the title, the hook, the credit and the hashtags |
| `bonito-report.txt` | The checks (`PASS`, `WARN`, `FAIL`) and when each voice line plays |

A 20-second Short takes about half a minute the first time. Voice lines are remembered, so when you only change cuts or settings, the voices aren't made again.

## The script file

```
title: How *bonito flakes* are made
clip: clips/bonito.mp4
voice: narrator
original audio: 15%
music: music/curious.mp3
music volume: 20%
crop: center
credit: Original footage: Example Channel (youtube.com/@example)
hashtags: #shorts #japan #japanesefood
title card: 3

cut: 0-6.5
cut: 9-17

say: This is one of the hardest foods on Earth.
say: Fresh skipjack tuna is cut into four long loins.
step: 1/3
label: 4 loins
say: Then it's smoked over a wood fire, again and again, for weeks.
step: 2/3
zoom for 3: 1.8x @ 60, 45
say at 10: A special mould is grown on it, on purpose.
step: 3/3
freeze for 2:
circle: 50, 55
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
| `cover at:` | The moment of the Short to make the cover from, like `7.5` | The first zoom at its closest, or 40 % of the way in |
| `cover text:` | The words on the cover | The title |
| `title card:` | Shows the title at the top: a number of seconds (like `3`), `always`, or `off` | `off` |
| `logo:` | Your logo, a PNG with a transparent background, shown on the whole Short | No logo |
| `logo position:` | `top left` or `top right` | `top left` |
| `sound effects:` | `on` or `off` (a ding on steps, a pop on labels, circles and arrows, a whoosh on zooms, a click on freezes) | `on` |
| `sound effects volume:` | How loud they are | `60%` |

### Cuts

`cut: 0-6.5` uses the clip from 0 to 6.5 seconds. Write as many as you like; they're joined in the order you write them, so you can also change the order. Times can be `12`, `12.5` or `0:12.5`. With no cuts, the whole clip is used.

### Voice lines

- `say: text` starts just after the line before it (the first one starts at 0.2 s).
- `say at 10: text` starts 10 seconds into the **finished Short** (after the cuts and freezes), not into the original clip.

### Markers

Markers point things out. Each one is a line like a voice line:

```
<marker> at <time> for <seconds>: <what>
```

- **Without `at`**, a marker starts with the `say` line just above it, which is usually what you want.
- **Without `for`**, it stays for its usual time (in the table).
- **Positions** are two numbers: **percent across, then percent down** the finished Short. `50, 50` is the middle and `50, 30` is centred, a third of the way down. Keep "down" between 7 and 80, because YouTube covers the top and bottom of a Short; the report warns you if a marker is too close.

| Marker | Example | What it does | Stays for |
|---|---|---|---|
| `step:` | `step: 2/6` | A yellow "STEP 2/6" badge, top left. You can also write words: `step: Smoking`. `step: off` hides it | Until the next step |
| `label:` | `label: 4 weeks` or `label: 4 weeks @ 50, 30` | A white tag with text. Without a position it sits near the top | 2.5 s |
| `circle:` | `circle: 50, 55` or `circle: 50, 55, 30` | A yellow ring that pops in around a spot. The third number is its size (percent of the width, 20 if you leave it out) | 2 s |
| `arrow:` | `arrow: 50, 55` or `arrow: 50, 55 from right` | An arrow that slides in and points at a spot. It can come `from` top left (the default), top, top right, left, right, bottom left, bottom or bottom right | 2 s |
| `zoom:` | `zoom: 1.5x` or `zoom: 2x @ 60, 40` | Smoothly pushes in on a spot, holds, and goes back out. From 1.05x to 4x | 2.5 s |
| `freeze:` | `freeze for 2:` | Stops the picture while the voice explains. The footage carries on afterwards, so the Short gets longer by that much | 1.5 s |

Two zooms can't overlap, and neither can two freezes. Emoji in labels may not show, depending on the computer, so words are safer.

### Yellow words

Put `*stars*` around words in the `title:` or the `cover text:` to make them yellow on the title card and the cover, for example `title: How *bonito flakes* are made`. The stars are left out of the description.

### When the voice runs long

If the voice goes on longer than the footage, the last frame is held until the voice ends, and the report warns you. To fix it, add footage or shorten the script.

## The cover

Every Short gets `<name>-cover.jpg`: a clean frame (no captions or markers, but with your logo), darker behind the text, with the `cover text:` (or the title) in big letters a third of the way down. Upload it as the Short's thumbnail in YouTube Studio if it lets you; otherwise, when you pick the Short's thumbnail frame in the YouTube app, choose the moment the report names.

## The check report

`<name>-report.txt` starts with a line per check. `PASS` is fine, `WARN` is worth a look (the Short is still made) and `FAIL` means something went wrong. Besides the size, length and sound, it checks:

| Check | Warns when |
|---|---|
| Picture | The clip is so small that it's enlarged more than 2x (it will look soft) |
| Cuts | A cut ends after the clip does, or is shorter than 0.4 s |
| Footage | The voice runs past the footage, so the last frame is held |
| Black frames | The picture is black for 0.4 s or more (usually a cut that lands in a fade) |
| Hook | The first words come after 1 s, or the first line takes more than 4 s to say |
| Silences | Nothing is said for more than 2.5 s |
| Captions clear | A label, circle or arrow covers the captions (about 55-66 % down) |
| Safe area | A marker is where YouTube's buttons or title cover the picture |
| Title | Over 60 characters (cut off on phones), or over 100 (YouTube won't take it) |
| Hashtags | More than 15 (YouTube then ignores all of them) |
| Credit | There's no `credit:` line |

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
| `tools\markers.js` | The step badge, labels, circles, arrows and title card |
| `tools\cover.js` | The cover image |
| `tools\checks.js` | The checks on the clip, the script and the timeline |
| `tools\tts.py` | Makes the voice lines with Kokoro |
| `fonts\Anton-Regular.ttf` | The caption font (SIL Open Font License, in `licenses\`) |

## Before you upload

Only use footage you have permission to use, and always fill in the `credit:` line. If you get a copyright claim, take the Short down.
