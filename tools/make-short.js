// Makes one explained Short from a script file.
//
//   node tools/make-short.js shorts/bonito.txt            -> videos/bonito.mp4 (+ .srt, -description.txt, -report.txt)
//   node tools/make-short.js shorts/bonito.txt --check    only checks the script and the clip (takes a second)
//
// Steps: read the script -> check the clip -> make the voice lines (Kokoro, cached) -> place them on the timeline
// -> captions and markers -> one ffmpeg pass (cuts and freezes, 9:16 crop, zooms, logo, captions and markers,
// voice over the lowered original audio and music, sound effects).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static'), ffprobe = require('ffprobe-static').path;
const { readScript, placeLines, placeMarkers } = require('./script.js');
const { makeAss, makeSrt, captionEvents } = require('./captions.js');
const { markerEvents } = require('./markers.js');

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

// integrated loudness in LUFS: the summary at the end of ebur128's output (the lines before it are momentary values)
const loudness = file => +([...spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop() || [])[1];

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

// The footage as pieces of the clip: the cuts in order, split wherever a freeze holds the picture.
// A freeze's "at" is in the finished Short, so earlier freezes push the footage after them later.
function footagePieces(cuts, freezes) {
  const pieces = [];
  let F = 0, k = 0;
  for (const c of cuts) {
    const len = c.end - c.start;
    let a = c.start;
    while (k < freezes.length && freezes[k].foot <= F + len + 1e-6) {
      const s = Math.min(c.end, Math.max(a + 0.04, c.start + freezes[k].foot - F));
      pieces.push({ a, b: s, hold: freezes[k].lasts });
      a = s; k++;
    }
    if (c.end - a > 0.01) pieces.push({ a, b: c.end, hold: 0 });
    F += len;
  }
  return pieces;
}

// One zoompan for all the zooms: each eases in, holds and eases out around its own spot. t is the frame's time.
function zoomFilter(zooms) {
  const T = `(on/${FPS})`;
  const ease = z => { const R = Math.min(0.4, (z.end - z.start) / 2).toFixed(3); return `(1-cos(PI*clip(min((${T}-${z.start.toFixed(3)})/${R},(${z.end.toFixed(3)}-${T})/${R}),0,1)))/2`; };
  const during = (z, k) => `between(${T},${z.start.toFixed(3)},${z.end.toFixed(3)})*${(z[k] - 0.5).toFixed(4)}`;
  const zx = `1+${zooms.map(z => `${(z.zoom - 1).toFixed(3)}*${ease(z)}`).join('+')}`;
  const c = k => `(0.5+${zooms.map(z => during(z, k)).join('+')})`;
  return `zoompan=z='${zx}':x='clip(${c('x')}*iw-iw/zoom/2,0,iw-iw/zoom)':y='clip(${c('y')}*ih-ih/zoom/2,0,ih-ih/zoom)':d=1:s=${W}x${H}:fps=${FPS}`;
}

// The sound effects, made by ffmpeg itself (so there's nothing to license), kept in build/sfx.
const SFX = {
  ding: "aevalsrc='0.55*sin(2*PI*1568*t)*exp(-7*t)+0.3*sin(2*PI*2352*t)*exp(-9*t)':d=0.7:s=48000",
  pop: "aevalsrc='0.9*sin(2*PI*(260+1400*exp(-40*t))*t)*exp(-28*t)':d=0.15:s=48000",
  whoosh: 'anoisesrc=d=0.55:c=pink:a=0.7:r=48000,highpass=f=400,lowpass=f=4500,afade=t=in:d=0.3:curve=qsin,afade=t=out:st=0.3:d=0.25:curve=qsin',
  click: "aevalsrc='0.8*sin(2*PI*1900*t)*exp(-90*t)+0.5*sin(2*PI*900*(t-0.06))*exp(-90*(t-0.06))*gte(t,0.06)':d=0.2:s=48000",
};
const SOUND_OF = { step: 'ding', label: 'pop', circle: 'pop', arrow: 'pop', zoom: 'whoosh', freeze: 'click' };
function sfxFile(kind) {
  const file = path.join(ROOT, 'build', 'sfx', `${kind}.wav`);
  if (!fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); run(['-f', 'lavfi', '-i', SFX[kind], '-ac', '1', '-c:a', 'pcm_s16le', file], 'Making a sound effect'); }
  return file;
}

function main() {
  const args = process.argv.slice(2), checkOnly = args.includes('--check');
  const scriptPath = args.find(a => !a.startsWith('--'));
  if (!scriptPath) fail('Usage: node tools/make-short.js shorts/<name>.txt [--check]');
  if (!fs.existsSync(scriptPath)) fail(`There is no script at ${scriptPath}.`);
  const name = path.basename(scriptPath, path.extname(scriptPath)), safe = name.replace(/[^\w-]/g, '_');
  const s = readScript(scriptPath), set = s.settings;
  if (s.errors.length) fail(`Please fix these lines in ${path.basename(scriptPath)}:\n\n${s.errors.join('\n')}`);

  // the clip, the cuts, the music and the logo
  const here = path.dirname(scriptPath);
  const clipFile = findFile(set.clip, here);
  if (!clipFile) fail(`The clip "${set.clip}" isn't there. Put it in the clips folder and write "clip: clips/<file name>".`);
  const clip = probe(clipFile);
  if (!clip || !clip.video) fail(`"${set.clip}" isn't a video file I can read.`);
  const cuts = s.cuts.length ? s.cuts : [{ start: 0, end: clip.duration }];
  const bad = cuts.filter(c => c.start >= clip.duration - 0.05).map(c => `Line ${c.line}: the cut starts at ${c.start}s, but the clip is only ${clip.duration.toFixed(1)}s long.`);
  if (bad.length) fail(bad.join('\n'));
  cuts.forEach(c => { c.end = Math.min(c.end, clip.duration); });
  const musicFile = set.music ? findFile(set.music, here) : null;
  if (set.music && !musicFile) fail(`The music "${set.music}" isn't there. Put it in the music folder and write "music: music/<file name>".`);
  const logoFile = set.logo ? findFile(set.logo, here) : null;
  if (set.logo && !logoFile) fail(`The logo "${set.logo}" isn't there. Put a PNG (ideally with a transparent background) in the project folder and write "logo: <file name>".`);
  const voices = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'voices.json'), 'utf8'));
  const voice = voices[set.voice];
  if (!voice || set.voice.startsWith('_')) fail(`There is no voice called "${set.voice}". Voices: ${Object.keys(voices).filter(k => !k.startsWith('_')).join(', ')} (in config/voices.json).`);
  if (checkOnly) return say(`${path.basename(scriptPath)} looks good: ${s.lines.length} voice line(s), ${s.markers.length} marker(s), ${cuts.length} cut(s) from a ${clip.duration.toFixed(1)}s clip.`);

  // voices -> timeline -> markers
  const voiceFiles = makeVoices(s.lines, voice);
  const lens = voiceFiles.map(f => probe(f).duration);
  const problems = placeLines(s.lines, lens);
  if (problems.length) fail(`The voice lines overlap:\n\n${problems.join('\n')}\n\nMove the "at" time later, or shorten the line before it.`);
  const mProblems = placeMarkers(s.markers, s.lines);
  if (mProblems.length) fail(`Please fix these lines:\n\n${mProblems.join('\n')}`);
  const footage = cuts.reduce((t, c) => t + c.end - c.start, 0);
  // each freeze at its place in the footage (the finished time, minus the freezes before it)
  const freezes = s.markers.filter(m => m.kind === 'freeze').sort((a, b) => a.start - b.start);
  let frozen = 0;
  for (const f of freezes) {
    f.foot = f.start - frozen;
    if (f.foot > footage + 0.01) fail(`Line ${f.line}: the freeze at ${f.start.toFixed(1)}s comes after the footage has ended (at ${(footage + frozen).toFixed(1)}s).`);
    frozen += f.lasts;
  }
  const pictured = footage + frozen;
  const needed = s.lines[s.lines.length - 1].end + TAIL, hold = Math.max(0, needed - pictured), total = pictured + hold;
  const zooms = s.markers.filter(m => m.kind === 'zoom' && m.start < total);

  // captions, markers and subtitles
  const buildDir = path.join(ROOT, 'build', safe), videos = path.join(ROOT, 'videos');
  fs.mkdirSync(buildDir, { recursive: true }); fs.mkdirSync(videos, { recursive: true });
  const overlay = [...(set.captions ? captionEvents(s.lines) : []), ...markerEvents(s.markers, total, set['title card'], set.title)];
  fs.writeFileSync(path.join(buildDir, 'overlay.ass'), makeAss(overlay));
  fs.writeFileSync(path.join(videos, `${name}.srt`), makeSrt(s.lines));

  // the picture: the pieces joined (frozen where asked), filled to 9:16 at the crop position, the last frame held if
  // the voice runs longer, then the zooms, the logo and the overlay
  const inputs = [], input = (...a) => { inputs.push(...a); return inputs.filter(x => x === '-i').length - 1; };
  input('-i', clipFile);
  const g = [], withAudio = clip.audio && set['original audio'] > 0;
  const pieces = footagePieces(cuts, freezes);
  pieces.forEach((p, i) => {
    g.push(`[0:v]trim=start=${p.a.toFixed(3)}:end=${p.b.toFixed(3)},setpts=PTS-STARTPTS${p.hold ? `,tpad=stop_mode=clone:stop_duration=${p.hold}` : ''}[v${i}]`);
    if (withAudio) g.push(`[0:a]atrim=start=${p.a.toFixed(3)}:end=${p.b.toFixed(3)},asetpts=PTS-STARTPTS${p.hold ? `,apad=pad_dur=${p.hold}` : ''}[a${i}]`);
  });
  g.push(`${pieces.map((_, i) => `[v${i}]${withAudio ? `[a${i}]` : ''}`).join('')}concat=n=${pieces.length}:v=1:a=${withAudio ? 1 : 0}[vcat]${withAudio ? '[acat]' : ''}`);
  const v = [`fps=${FPS}`, `scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}:(iw-${W})*${set.crop}:(ih-${H})/2`, 'setsar=1'];
  if (hold > 0) v.push(`tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}`);
  if (zooms.length) v.push(zoomFilter(zooms));
  g.push(`[vcat]${v.join(',')}[vpic]`);
  let pic = '[vpic]';
  if (logoFile) {
    const k = input('-i', logoFile), x = set['logo position'] === 'top right' ? `W-w-50` : '50';
    g.push(`[${k}:v]scale=140:-1,format=rgba,colorchannelmixer=aa=0.9[logo]`, `${pic}[logo]overlay=${x}:90:format=auto[vlogo]`);
    pic = '[vlogo]';
  }
  g.push(`${pic}subtitles=${rel(path.join(buildDir, 'overlay.ass'))}:fontsdir=fonts,format=yuv420p[vout]`);

  // the sound: voice on top; the original audio and the music underneath, ducked further while the voice talks;
  // the sound effects on top of everything
  const AF = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
  s.lines.forEach((l, i) => g.push(`[${input('-i', voiceFiles[i])}:a]${AF},adelay=${Math.round(l.start * 1000)}:all=1[s${i}]`));
  g.push(`${s.lines.map((_, i) => `[s${i}]`).join('')}amix=inputs=${s.lines.length}:duration=longest:normalize=0,apad=whole_dur=${total.toFixed(3)}[voice]`);
  const bed = [], top = [];
  if (withAudio) { g.push(`[acat]${AF},volume=${set['original audio'] / 100},apad=whole_dur=${total.toFixed(3)}[orig]`); bed.push('[orig]'); }
  if (musicFile) {
    g.push(`[${input('-stream_loop', '-1', '-i', musicFile)}:a]${AF},atrim=0:${total.toFixed(3)},volume=${set['music volume'] / 100}[music]`);
    bed.push('[music]');
  }
  if (bed.length) {
    g.push(`${bed.join('')}${bed.length > 1 ? `amix=inputs=${bed.length}:duration=longest:normalize=0,` : ''}anull[bed]`);
    g.push('[voice]asplit=2[vmix][vkey]', '[bed][vkey]sidechaincompress=threshold=0.02:ratio=4:attack=15:release=350[ducked]');
    top.push('[ducked]', '[vmix]');
  } else top.push('[voice]');
  const hits = set['sound effects'] ? s.markers.filter(m => m.start < total && !m.off) : [];
  if (hits.length) {
    const kinds = [...new Set(hits.map(m => SOUND_OF[m.kind]))];
    kinds.forEach(kind => {
      const uses = hits.filter(m => SOUND_OF[m.kind] === kind);
      g.push(`[${input('-i', sfxFile(kind))}:a]${AF},asplit=${uses.length}${uses.map((_, j) => `[${kind}${j}]`).join('')}`);
      uses.forEach((m, j) => g.push(`[${kind}${j}]adelay=${Math.round(m.start * 1000)}:all=1[fx${hits.indexOf(m)}]`));
    });
    g.push(`${hits.map((_, i) => `[fx${i}]`).join('')}amix=inputs=${hits.length}:duration=longest:normalize=0,volume=${(set['sound effects volume'] / 100 * 0.6).toFixed(3)}[sfx]`);
    top.push('[sfx]');
  }
  g.push(`${top.join('')}${top.length > 1 ? `amix=inputs=${top.length}:duration=longest:normalize=0,` : ''}loudnorm=I=-14:TP=-1.5:LRA=11,${AF},atrim=0:${total.toFixed(3)},afade=t=out:st=${Math.max(0, total - 0.5).toFixed(3)}:d=0.5[aout]`);

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
  // the loudness filter can't lift a Short with long quiet parts all the way, so measure it and correct the rest
  // (only the sound is made again; a limiter keeps the peaks from clipping)
  let lufs = loudness(outFile);
  if (Math.abs(lufs + 14) > 1) {
    const tmp = path.join(buildDir, 'levelled.mp4');
    run(['-i', outFile, '-map', '0', '-c:v', 'copy', '-af', `volume=${(-14 - lufs).toFixed(2)}dB,alimiter=limit=0.84:level=false`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp], 'Levelling the sound');
    fs.renameSync(tmp, outFile);
    lufs = loudness(outFile);
  }
  const out = probe(outFile), report = [];
  const check = (ok, what, detail, warn) => report.push(`${ok ? 'PASS' : warn ? 'WARN' : 'FAIL'}  ${what}: ${detail}`);
  check(out && out.width === W && out.height === H, 'Size', out ? `${out.width}x${out.height} (vertical 9:16)` : 'the video could not be read');
  check(out && Math.abs(out.duration - total) < 0.2, 'Length', out ? `${out.duration.toFixed(1)}s` : '-');
  check(total <= 60, 'Short length', total <= 60 ? 'under 60 s' : `${total.toFixed(0)}s: Shorts can be up to 3 minutes, but under 60 s usually does better`, true);
  check(!!out?.audio, 'Sound', out?.audio ? `voice${withAudio ? ` + original audio at ${set['original audio']}%` : ''}${musicFile ? ` + music at ${set['music volume']}%` : ''}${hits.length ? ` + ${hits.length} sound effect(s)` : ''}` : 'missing');
  check(lufs > -17 && lufs < -11, 'Loudness', `${lufs.toFixed(1)} LUFS (YouTube plays at -14)`, true);
  check(hold === 0, 'Footage', hold === 0 ? `the voice fits inside ${pictured.toFixed(1)}s of footage${frozen ? ` (${frozen.toFixed(1)}s of it frozen)` : ''}` : `the voice runs ${hold.toFixed(1)}s past the footage, so the last frame is held; add footage or shorten the script`, true);
  const late = s.markers.filter(m => m.start >= total), drawn = s.markers.filter(m => ['label', 'circle', 'arrow'].includes(m.kind));
  const unsafe = drawn.filter(m => m.y > 0.8 || m.y < 0.07);
  check(!late.length, 'Markers', late.length ? `${late.map(m => `line ${m.line}`).join(', ')} start after the Short ends (${total.toFixed(1)}s), so they don't show` : `${s.markers.length} marker(s), all inside the Short`, true);
  check(!unsafe.length, 'Safe area', unsafe.length ? `${unsafe.map(m => `line ${m.line}`).join(', ')}: too close to the ${unsafe[0].y > 0.8 ? 'bottom' : 'top'}, where YouTube's buttons and title cover the picture (keep "down" between 7 and 80)` : 'labels, circles and arrows are clear of YouTube\'s buttons', true);
  check(!!set.credit, 'Credit', set.credit ? set.credit : 'no "credit:" line, so the description has a placeholder to fill in', true);
  report.push('', 'Voice lines:', ...s.lines.map(l => `  ${l.start.toFixed(1)}s-${l.end.toFixed(1)}s  ${l.text}`));
  if (s.markers.length) report.push('', 'Markers:', ...[...s.markers].sort((a, b) => a.start - b.start).map(m => `  ${m.start.toFixed(1)}s-${Math.min(m.end, total).toFixed(1)}s  ${m.kind}${m.text ? ` "${m.text}"` : m.zoom ? ` ${m.zoom}x` : ''}  (line ${m.line})`));
  fs.writeFileSync(path.join(videos, `${name}-report.txt`), report.join('\n') + '\n');
  say(`\n${report.slice(0, 9).join('\n')}\n\nDone: ${rel(outFile)}\nAlso in videos/: ${name}.srt, ${name}-description.txt, ${name}-report.txt`);
  if (report.some(l => l.startsWith('FAIL'))) process.exit(1);
}

main();
