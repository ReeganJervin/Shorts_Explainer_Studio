# Prompts for Claude: writing a Short's script

There are two ways to get Claude to write a script.

**In Claude Code** (the easiest): open this project and type

```
/new-short clips/bonito.mp4 how bonito flakes are made
```

Claude looks at the clip itself, writes the script, makes the Short, checks it and shows it to you.

**In the Claude app** (claude.ai, or on your phone): use the prompts below. Claude can't open your clip there, so you either describe it or attach its contact sheets:

```
node tools/clip-sheet.js clips/bonito.mp4
```

This makes pictures of the clip, one frame a second with the time on each, in `build\sheets\bonito\`. Attach them to the chat. Then paste Claude's answer into a new file in `shorts\`, check it with `check-script.bat` and make it with `make-short.bat`.

---

## Prompt A: write a script for a clip

Fill in the parts in [brackets], then paste the whole thing.

```
Write a script file for a YouTube Short that explains a video clip. My tool turns the script into the finished Short (new voiceover, captions, markers), so reply with only the script file in one code block, then a short list of any facts I should double-check.

THE CLIP
- File: clips/[bonito.mp4], [45] seconds long, [landscape / vertical]
- Topic: [how bonito flakes (katsuobushi) are made]
- What happens, with times (or see the attached contact sheets, which show the time on each frame and a grid every 10 %):
  [0-6 s: fish being filleted on a steel table]
  [6-15 s: fillets put in baskets and simmered in a big steaming tank]
  [15-30 s: smoking room with wood fire, racks of dark fillets]
  [30-45 s: a hard block shaved on a plane into pink flakes]
- The action is mostly [in the middle / on the left / on the right] of the frame.
- Facts I know: [anything you know; leave empty if nothing]
- Credit: [the original creator's name and link, if you know it]

THE SCRIPT FORMAT
Settings at the top (one per line):
  title: (under 60 characters; put the key words in *stars* to make them yellow)
  clip: clips/<file>
  voice: narrator          (or energetic, or female)
  original audio: 15%
  music: music/<file>      (leave this line out if I have no music)
  crop: center             (left, center, right, or 0 to 1: which part of a wide clip to keep)
  credit: Original footage: <creator>
  hashtags: #shorts plus 2-4 topic tags
  title card: 3
  cover text: (2-5 punchy words for the cover, key word in *stars*)
  cover at: (the time of the most striking moment)
Then the parts of the clip to use, in order (they can be reordered):
  cut: 0-6.5
  cut: 15-22
Then the voice lines and markers, in order:
  say: <a sentence>                    starts right after the line before it
  say at 10: <a sentence>              starts 10 s into the finished Short (after the cuts)
  step: 2/5                            a "STEP 2/5" badge until the next step ("step: off" hides it)
  label: 4 weeks                       a text tag near the top (or "label: 4 weeks @ 50, 30")
  circle: 50, 40                       a ring around a spot
  arrow: 50, 40 from top left          an arrow pointing at a spot
  zoom for 3: 1.8x @ 50, 40            push in on a spot for 3 s
  freeze for 2:                        stop the picture for 2 s while the voice explains
A marker without "at" starts with the say line just above it. Positions are "percent across, percent down" of the finished vertical picture.

THE RULES
- 20-45 seconds of footage. The narrator says about 3 words a second, so the words must fit the footage; if there's more to say, use a freeze instead of running past the end.
- First line: the most surprising true fact, under 8 words, no "Did you know" or "In this video".
- Then one step or fact per line, in the order the footage shows them. Say what the viewer can't see: how long, how hot, how many, why.
- End with a payoff, ideally one that leads back into the first line so the Short loops.
- A marker every 3-5 seconds, each pointing at what the voice is talking about. Keep markers between 7 and 80 "down", and labels, circles and arrows out of 52-70 "down" (that's where the captions go). Only one zoom or freeze at a time.
- Only use facts you're confident are true. Don't invent numbers. List anything uncertain after the script.
- Write everything in your own words; never copy the original video's text or voiceover.
```

---

## Prompt B: make my script better

Paste this with your script (and the report, if you've made the Short already).

```
Here is the script file for a YouTube Short, made by my tool (format: settings like "title:", then "cut:" lines, then "say:" voice lines and markers like step, label, circle, arrow, zoom and freeze; a marker without "at" starts with the say line above it; positions are percent across, percent down of the vertical picture).

Make it more watchable without changing the facts:
- a stronger hook in the first line (under 8 words, the most surprising thing)
- tighter lines (the narrator says about 3 words a second)
- an ending that loops back into the start
- markers every 3-5 seconds that point at what the voice says, kept out of 52-70 "down" (the captions)
- fix anything the report below warns about

Reply with the whole new script in one code block, then a short list of what you changed.

[paste the script here]

[paste videos\<name>-report.txt here, if you have it]
```
