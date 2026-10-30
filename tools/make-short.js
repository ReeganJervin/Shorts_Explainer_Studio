// Makes one explained Short from a script file.
//
//   node tools/make-short.js shorts/bonito.txt            -> videos/bonito.mp4 (+ .srt, -description.txt, -report.txt)
//   node tools/make-short.js shorts/bonito.txt --check    only checks the script and the clip (takes a second)
//
// Steps: read the script -> check the clip -> make the voice lines (Kokoro, cached) -> place them on the timeline
// -> captions -> one ffmpeg pass (cut, 9:16 crop, captions, voice over the lowered original audio and music).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static'), ffprobe = require('ffprobe-static').path;
const { readScript, placeLines } = require('./script.js');
const { makeAss, makeSrt } = require('./captions.js');

const ROOT = path.resolve(__dirname, '..');
const W = 1080, H = 1920, FPS = 30, TAIL = 0.6;
const say = s => console.log(s);
const fail = msg => { console.error(`\n${msg}\n`); process.exit(1); };
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function probe(file) {
  const r = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const j = JSON.parse(r.stdout), v = j.streams.find(s => s.codec_type === 'video');
  return { duration: +j.format.duration, video: !!v, width: v?.width, height: v?.height, audio: j.streams.some(s => s.codec_type === 'audio') };
}

function run(args, what) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) fail(`${what} failed:\n${String(r.stderr).trim().split('\n').slice(-8).join('\n')}`);
}

// a file named in the script: from the project folder, or next to the script
function findFile(name, scriptDir) {
  return [path.resolve(ROOT, name), path.resolve(scriptDir, name)].find(p => fs.existsSync(p)) || null;
}

// the voice lines as .wav files, kept in build/voice-cache so changing the edits doesn't remake them
function makeVoices(lines, v) {
  const cache = path.join(ROOT, 'build', 'voice-cache');
  fs.mkdirSync(cache, { recursive: true });
  const files = lines.map(l => path.join(cache, crypto.createHash('sha1').update(JSON.stringify([l.text, v.voice, v.speed, v.pitch, v.gain])).digest('hex').slice(0, 16) + '.wav'));
  const jobs = lines.map((l, i) => ({ text: l.text, voice: v.voice, speed: v.speed ?? 1, out: files[i] + '.raw.wav' })).filter((_, i) => !fs.existsSync(files[i]));
  if (jobs.length) {
    say(`Making ${jobs.length} voice line(s)...`);
    const py = [path.join(ROOT, '.venv', 'Scripts', 'python.exe'), path.join(ROOT, '.venv', 'bin', 'python')].find(p => fs.existsSync(p));
    if (!py) fail('The voice tool is not installed yet. Please run setup.bat first.');
    if (!fs.existsSync(path.join(ROOT, 'models', 'kokoro.onnx'))) fail('The voice model is missing. Please run setup.bat first.');
    const jobsFile = path.join(cache, 'jobs.json');
    fs.writeFileSync(jobsFile, JSON.stringify(jobs));
    const r = spawnSync(py, [path.join(ROOT, 'tools', 'tts.py'), path.join(ROOT, 'models'), jobsFile], { stdio: 'inherit' });
    if (r.status !== 0) fail('Making the voices failed (see the message above).');
    // pitch and gain, then trim the silence Kokoro leaves at both ends
    const pitch = v.pitch ?? 1, chain = [];
    if (pitch !== 1) chain.push(`asetrate=${Math.round(24000 * pitch)},aresample=24000,atempo=${(1 / pitch).toFixed(5)}`);
    if (v.gain) chain.push(`volume=${v.gain}dB`);
    chain.push('silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse');
    for (const j of jobs) { run(['-i', j.out, '-af', chain.join(','), '-c:a', 'pcm_s16le', j.out.replace(/\.raw\.wav$/, '')], 'Changing a voice line\'s sound'); fs.unlinkSync(j.out); }
  }
  return files;
}

function main() {
  const args = process.argv.slice(2), checkOnly = args.includes('--check');
  const scriptPath = args.find(a => !a.startsWith('--'));
  if (!scriptPath) fail('Usage: node tools/make-short.js shorts/<name>.txt [--check]');
  if (!fs.existsSync(scriptPath)) fail(`There is no script at ${scriptPath}.`);
  const name = path.basename(scriptPath, path.extname(scriptPath)), safe = name.replace(/[^\w-]/g, '_');
  const s = readScript(scriptPath), set = s.settings;
  if (s.errors.length) fail(`Please fix these lines in ${path.basename(scriptPath)}:\n\n${s.errors.join('\n')}`);

  // the clip, the cuts and the music
  const clipFile = findFile(set.clip, path.dirname(scriptPath));
  if (!clipFile) fail(`The clip "${set.clip}" isn't there. Put it in the clips folder and write "clip: clips/<file name>".`);
  const clip = probe(clipFile);
  if (!clip || !clip.video) fail(`"${set.clip}" isn't a video file I can read.`);
  const cuts = s.cuts.length ? s.cuts : [{ start: 0, end: clip.duration }];
  const bad = cuts.filter(c => c.start >= clip.duration - 0.05).map(c => `Line ${c.line}: the cut starts at ${c.start}s, but the clip is only ${clip.duration.toFixed(1)}s long.`);
  if (bad.length) fail(bad.join('\n'));
  cuts.forEach(c => { c.end = Math.min(c.end, clip.duration); });
  const musicFile = set.music ? findFile(set.music, path.dirname(scriptPath)) : null;
  if (set.music && !musicFile) fail(`The music "${set.music}" isn't there. Put it in the music folder and write "music: music/<file name>".`);
  const voices = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'voices.json'), 'utf8'));
  const voice = voices[set.voice];
  if (!voice || set.voice.startsWith('_')) fail(`There is no voice called "${set.voice}". Voices: ${Object.keys(voices).filter(k => !k.startsWith('_')).join(', ')} (in config/voices.json).`);
  if (checkOnly) return say(`${path.basename(scriptPath)} looks good: ${s.lines.length} voice line(s), ${cuts.length} cut(s) from a ${clip.duration.toFixed(1)}s clip.`);

  // voices -> timeline
  const voiceFiles = makeVoices(s.lines, voice);
  const lens = voiceFiles.map(f => probe(f).duration);
  const problems = placeLines(s.lines, lens);
  if (problems.length) fail(`The voice lines overlap:\n\n${problems.join('\n')}\n\nMove the "at" time later, or shorten the line before it.`);
  const footage = cuts.reduce((t, c) => t + c.end - c.start, 0);
  const needed = s.lines[s.lines.length - 1].end + TAIL, hold = Math.max(0, needed - footage), total = footage + hold;

  // captions and subtitles
  const buildDir = path.join(ROOT, 'build', safe), videos = path.join(ROOT, 'videos');
  fs.mkdirSync(buildDir, { recursive: true }); fs.mkdirSync(videos, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'captions.ass'), makeAss(s.lines));
  fs.writeFileSync(path.join(videos, `${name}.srt`), makeSrt(s.lines));

  // the picture: the cuts joined, filled to 9:16 at the crop position, the last frame held if the voice runs longer
  const inputs = ['-i', clipFile], g = [];
  const withAudio = clip.audio && set['original audio'] > 0;
  cuts.forEach((c, i) => {
    g.push(`[0:v]trim=start=${c.start}:end=${c.end},setpts=PTS-STARTPTS[v${i}]`);
    if (withAudio) g.push(`[0:a]atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS[a${i}]`);
  });
  g.push(`${cuts.map((_, i) => `[v${i}]${withAudio ? `[a${i}]` : ''}`).join('')}concat=n=${cuts.length}:v=1:a=${withAudio ? 1 : 0}[vcat]${withAudio ? '[acat]' : ''}`);
  const v = [`fps=${FPS}`, `scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}:(iw-${W})*${set.crop}:(ih-${H})/2`, 'setsar=1'];
  if (hold > 0) v.push(`tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}`);
  if (set.captions) v.push(`subtitles=${rel(path.join(buildDir, 'captions.ass'))}:fontsdir=fonts`);
  g.push(`[vcat]${v.join(',')}[vout]`);

  // the sound: voice on top; the original audio and the music underneath, ducked further while the voice talks
  const AF = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
  s.lines.forEach((l, i) => {
    inputs.push('-i', voiceFiles[i]);
    g.push(`[${i + 1}:a]${AF},adelay=${Math.round(l.start * 1000)}:all=1[s${i}]`);
  });
  g.push(`${s.lines.map((_, i) => `[s${i}]`).join('')}amix=inputs=${s.lines.length}:duration=longest:normalize=0,apad=whole_dur=${total.toFixed(3)}[voice]`);
  const bed = [];
  if (withAudio) { g.push(`[acat]${AF},volume=${set['original audio'] / 100},apad=whole_dur=${total.toFixed(3)}[orig]`); bed.push('[orig]'); }
  if (musicFile) {
    inputs.push('-stream_loop', '-1', '-i', musicFile);
    g.push(`[${s.lines.length + 1}:a]${AF},atrim=0:${total.toFixed(3)},volume=${set['music volume'] / 100}[music]`);
    bed.push('[music]');
  }
  const master = `loudnorm=I=-14:TP=-1.5:LRA=11,${AF},atrim=0:${total.toFixed(3)},afade=t=out:st=${Math.max(0, total - 0.5).toFixed(3)}:d=0.5`;
  if (bed.length) {
    g.push(`${bed.join('')}${bed.length > 1 ? `amix=inputs=${bed.length}:duration=longest:normalize=0,` : ''}anull[bed]`);
    g.push('[voice]asplit=2[vmix][vkey]', '[bed][vkey]sidechaincompress=threshold=0.02:ratio=4:attack=15:release=350[ducked]');
    g.push(`[ducked][vmix]amix=inputs=2:duration=longest:normalize=0,${master}[aout]`);
  } else g.push(`[voice]${master}[aout]`);

  const outFile = path.join(videos, `${name}.mp4`);
  say(`Making the video (${total.toFixed(1)}s)...`);
  fs.writeFileSync(path.join(buildDir, 'filter.txt'), g.join(';\n'));
  run([...inputs, '-filter_complex_script', rel(path.join(buildDir, 'filter.txt')), '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), '-movflags', '+faststart', outFile], 'Making the video');

  // upload helpers and the check report
  const tags = set.hashtags || '#shorts';
  fs.writeFileSync(path.join(videos, `${name}-description.txt`), [
    set.title || name, '', s.lines.slice(0, 2).map(l => l.text).join(' '), '',
    set.credit ? set.credit : 'Credit: (add the original creator of the footage here)', '', tags, '',
  ].join('\n'));
  const out = probe(outFile), report = [];
  // the summary at the end of ebur128's output (the lines before it are momentary values)
  const lufs = +([...spawnSync(ffmpeg, ['-hide_banner', '-i', outFile, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop() || [])[1];
  const check = (ok, what, detail, warn) => report.push(`${ok ? 'PASS' : warn ? 'WARN' : 'FAIL'}  ${what}: ${detail}`);
  check(out && out.width === W && out.height === H, 'Size', out ? `${out.width}x${out.height} (vertical 9:16)` : 'the video could not be read');
  check(out && Math.abs(out.duration - total) < 0.2, 'Length', out ? `${out.duration.toFixed(1)}s` : '-');
  check(total <= 60, 'Short length', total <= 60 ? 'under 60 s' : `${total.toFixed(0)}s: Shorts can be up to 3 minutes, but under 60 s usually does better`, true);
  check(!!out?.audio, 'Sound', out?.audio ? `voice${withAudio ? ` + original audio at ${set['original audio']}%` : ''}${musicFile ? ` + music at ${set['music volume']}%` : ''}, ${lufs.toFixed(1)} LUFS (YouTube plays at -14)` : 'missing');
  check(lufs > -17 && lufs < -11, 'Loudness', `${lufs.toFixed(1)} LUFS`, true);
  check(hold === 0, 'Footage', hold === 0 ? `the voice fits inside ${footage.toFixed(1)}s of footage` : `the voice runs ${hold.toFixed(1)}s past the footage, so the last frame is held; add footage or shorten the script`, true);
  check(!!set.credit, 'Credit', set.credit ? set.credit : 'no "credit:" line, so the description has a placeholder to fill in', true);
  report.push('', 'Voice lines:', ...s.lines.map(l => `  ${l.start.toFixed(1)}s-${l.end.toFixed(1)}s  ${l.text}`));
  fs.writeFileSync(path.join(videos, `${name}-report.txt`), report.join('\n') + '\n');
  say(`\n${report.slice(0, 7).join('\n')}\n\nDone: ${rel(outFile)}\nAlso in videos/: ${name}.srt, ${name}-description.txt, ${name}-report.txt`);
  if (report.some(l => l.startsWith('FAIL'))) process.exit(1);
}

main();
