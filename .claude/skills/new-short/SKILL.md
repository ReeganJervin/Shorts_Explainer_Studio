---
name: new-short
description: Turn a clip into an explained Short for the owner's channel. Look at the clip, choose the cuts, crop and markers, write the voice script and the script file, make the Short, check it, and show it to the owner for approval. Use when the owner types /new-short (optionally with a clip and a topic, like "/new-short clips/bonito.mp4 how bonito flakes are made"), or asks for a script or a Short from a clip.
---

# /new-short: from a clip to a finished Short

The owner is not a programmer. Keep every message short, friendly and simple. Never commit without the owner's approval, and never commit anything from `clips/` or `music/`.

## How it's called

- `/new-short clips/bonito.mp4 how bonito flakes are made`: that clip, about that topic.
- `/new-short clips/bonito.mp4`: work out the topic from the clip, and say what you think it shows before writing anything.
- `/new-short`: list what's in `clips/` and ask which one, in one line.

## 1. Look at the clip

1. Read `README.md` (the script format, markers and checks) and `shorts/example-bonito.txt`.
2. Run `node tools/clip-sheet.js <clip> --full`, then open the sheets. This shows whole frames with their times, plus the clip's size, length and **scene changes** (good places to start and end cuts). Work out what happens when, and where the action is across the frame.
3. Choose the crop (`left`, `center`, `right` or 0 to 1) that keeps the action in the 9:16 view, then run `node tools/clip-sheet.js <clip> --crop <crop>` and open those sheets. They show the picture as it will be in the Short, with a grid every 10 % for reading off marker positions ("percent across, percent down"). Red strips are covered by YouTube; the yellow band is where the captions go.
4. If the clip is small (the sheet says something like 640x360), tell the owner the Short will look soft and that a sharper copy would be better. Carry on if they want to.

## 2. Plan it

- **Length:** 20-45 seconds of footage. Keep the best moments and cut the slow ones; cuts may be in a different order from the clip if that tells the story better.
- **Voice:** the narrator says about **3 words a second**, so the words have to fit the footage: about 3 × the seconds of footage, minus a little for breathing. If there's more to say than footage, use a `freeze` at the key moment rather than letting the voice run past the end.
- **Hook (the first line):** the single most surprising true thing, under 3 seconds (about 8 words), starting at once. No "Did you know" and no "In this video".
- **Middle:** one step or one fact per line, in the order the footage shows them. Say what the viewer can't see: how long, how hot, how many, why.
- **End:** a payoff, then ideally a last line that leads back into the first, so the Short loops.
- **Facts must be true.** Use only facts you're confident are well established. Never invent numbers, names or places. Anything you're unsure of goes to the owner as a short list of "please check" lines before the Short is made. Explain; don't exaggerate.
- **Own words.** Write the narration fresh. Never copy the original video's text, captions or voiceover.

## 3. Markers

About one every 3-5 seconds, each pointing at something the voice is talking about:

- `step: 1/5` for a process (one per stage), `label:` for a number or a name, `circle:` or `arrow:` for a small detail, `zoom:` to move in on the key detail, `freeze for 2:` for the "wow" moment.
- Read positions off the 9:16 sheet at the time the marker shows. Keep "down" between 7 and 80, and labels, circles and arrows out of the caption band (about 52-70 down).
- Leave out "at" when a marker should start with the say line above it; use "at" only when it has to land on a moment in the footage.
- At most one zoom or freeze at a time.

## 4. Write the script

Save `shorts/<name>.txt` (`name` = the topic, lowercase with dashes), from `shorts/_template.txt`:

- `title:` under 60 characters, curiosity first, with the key words in `*stars*`; `title card: 3`.
- `cover text:` a shorter, punchier line than the title (2-5 words), and `cover at:` the most striking frame.
- `credit:` the original creator if the owner knows it; otherwise leave the placeholder and remind them.
- `hashtags:` `#shorts` plus 2-4 topic tags.
- Music: the first file in `music/` if there is one (ask if there are several), at `music volume: 20%`. Leave the original sound at about 15 % unless it's noisy talk.

## 5. Make it and check it

1. `node tools/make-short.js shorts/<name>.txt --check`, and fix anything it lists.
2. `node tools/make-short.js shorts/<name>.txt`, then read `videos/<name>-report.txt`. Fix every `WARN` you can: a late or long hook, silences, markers over the captions or in the safe area, the voice running past the footage. Explain any you leave.
3. Look at it: `node tools/stills.js videos/<name>.mp4 <times>`, with a time in each marker (a little after it starts) and one in the middle of the hook, then open the picture. Check that every circle, arrow and label is on the thing it points at, that nothing important is hidden by the captions, and that the zooms land on the right spot. Open `videos/<name>-cover.jpg` too.
4. Fix and make it again until it's right.

## 6. Show the owner

Give the full paths of `videos/<name>.mp4` and `videos/<name>-cover.jpg`, the hook line, the length, any "please check" facts and any `WARN` you left, in a few short lines. **Wait for approval**, and change it as often as they ask. When they're happy, ask whether to commit the script (`shorts/<name>.txt` only).
