# Shorts Explainer Studio: notes for Claude

The owner writes a script file (`shorts/<name>.txt`) for a clip; `tools/make-short.js` turns it into a vertical Short with a Kokoro voiceover, captions, cuts, crop and an audio mix. This is the sister project of Kitsu Studio (Ren_Video_Creation) and follows the same conventions:

- The owner is not a programmer. Every message the tools print is plain, friendly English with line numbers, and says how to fix the problem.
- Windows first: `.bat` launchers (CRLF), `setup.bat`, `.venv\Scripts\python.exe`. Everything must also run on Linux for testing.
- ffmpeg runs with `cwd` set to the project root, and filter paths are relative (`build/...`, `fonts`), so Windows drive letters never end up inside filter strings.
- Clips and music are never committed (`.gitignore`). The footage belongs to other people.
- Test with a generated clip, for example `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30:duration=20 -f lavfi -i sine=frequency=330:duration=20 -shortest clips/test-clip.mp4`. Then look at stills from the result, not only the report.

Roadmap: Phase 2 adds markers (`step`, `label`, `circle`, `arrow`, `zoom`, `freeze`, `title card`, logo); they use the same `<command> at <time>: <value>` shape as `say`. Phase 3 adds a cover image and more checks. Phase 4 adds a Claude prompt that drafts a script from a description of the clip.
