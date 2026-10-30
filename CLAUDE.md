# Shorts Explainer Studio: notes for Claude

The owner writes a script file (`shorts/<name>.txt`) for a clip; `tools/make-short.js` turns it into a vertical Short with a Kokoro voiceover, captions, cuts, crop and an audio mix. This is the sister project of Kitsu Studio (Ren_Video_Creation) and follows the same conventions:

- The owner is not a programmer. Every message the tools print is plain, friendly English with line numbers, and says how to fix the problem.
- Windows first: `.bat` launchers (CRLF), `setup.bat`, `.venv\Scripts\python.exe`. Everything must also run on Linux for testing.
- ffmpeg runs with `cwd` set to the project root, and filter paths are relative (`build/...`, `fonts`), so Windows drive letters never end up inside filter strings.
- Clips and music are never committed (`.gitignore`). The footage belongs to other people.
- Test with a generated clip, for example `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30:duration=20 -f lavfi -i sine=frequency=330:duration=20 -shortest clips/test-clip.mp4`. Then look at stills from the result, not only the report.
- Markers (`step`, `label`, `circle`, `arrow`) and the title card are ASS events in the same overlay file as the captions (`tools/markers.js`). libass quirk: with `\an7\pos(x,y)`, drawing coordinates are relative to (x, y), and scaling and rotation happen around it, so circles are drawn around (0, 0) and arrows have their tip at (0, 0).
- `zoom` is one `zoompan` over the whole picture; `freeze` splits the footage into pieces with `tpad`. Every `at` time is in the finished Short.
- The cover frame comes out of the main render (a `split` + `select` branch before the overlay, written with `-frames:v 1`), then gets `DARKEN` and its own small ASS file (`tools/cover.js`).
- Checks: `tools/checks.js` for the clip, script and timeline (the clip ones also run with `--check`); the ones that need the finished video (size, loudness, black frames) are in `make-short.js`.
- Don't give text with `*stars*` a BorderStyle 3 box: each colour run gets its own box and the overlaps show as dark patches.
- `/new-short` (`.claude/skills/new-short/SKILL.md`) is the workflow for making a Short: look at the clip with `tools/clip-sheet.js`, write the script, make it, check the report and `tools/stills.js` pictures. Narration must be original and the facts true; anything uncertain goes to the owner to check.
- `prompts-for-claude.md` repeats the script format for the Claude app. When the format changes, update README.md, `shorts/_template.txt`, the skill and the prompts together.
