// Contact sheets of a clip, for choosing cuts, the crop and marker positions (by you or by Claude).
//
//   node tools/clip-sheet.js clips/bonito.mp4                  the 9:16 view (crop: center), one frame a second
//   node tools/clip-sheet.js clips/bonito.mp4 --full           the whole frame, for choosing the crop
//   node tools/clip-sheet.js clips/bonito.mp4 --crop 0.3       the 9:16 view at another crop
//   node tools/clip-sheet.js clips/bonito.mp4 --every 0.5      more frames (or fewer, with a bigger number)
//   ... --out <folder>                                        where the sheets go (default build/sheets/<clip>)
//
// Each frame shows its time in the clip. In the 9:16 view, the lines are every 10 % (the 50 % lines brighter), so
// a spot can be read off as "percent across, percent down" for markers; the caption band and YouTube's covered
// strips are shaded. It also prints the clip's size and length, and the moments the picture changes a lot.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static'), ffprobe = require('ffprobe-static').path;

const ROOT = path.resolve(__dirname, '..');
const fail = msg => { console.error(`\n${msg}\n`); process.exit(1); };
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const clipArg = args.find((a, i) => !a.startsWith('--') && !['--every', '--crop', '--out'].includes(args[i - 1]));
if (!clipArg) fail('Usage: node tools/clip-sheet.js clips/<clip> [--full] [--crop center|left|right|0.3] [--every 1] [--out <folder>]');
const clipFile = path.resolve(clipArg);
if (!fs.existsSync(clipFile)) fail(`There is no clip at ${clipArg}.`);

const p = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', clipFile], { encoding: 'utf8' });
if (p.status !== 0) fail(`"${clipArg}" isn't a video file I can read.`);
const info = JSON.parse(p.stdout), video = info.streams.find(s => s.codec_type === 'video'), duration = +info.format.duration;
if (!video) fail(`"${clipArg}" has no picture.`);

const full = args.includes('--full');
const crop = { left: 0, center: 0.5, centre: 0.5, right: 1 }[opt('crop')] ?? (opt('crop') !== undefined ? +opt('crop') : 0.5);
if (!(crop >= 0 && crop <= 1)) fail('--crop is left, center, right, or a number from 0 to 1.');
// about 40 frames for a long clip, never less than one every half second
const every = +(opt('every') || Math.max(0.5, Math.ceil(duration / 40 * 2) / 2));
const out = path.resolve(opt('out') || path.join(ROOT, 'build', 'sheets', path.basename(clipFile, path.extname(clipFile)) + (full ? '-full' : '')));
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (/^sheet-\d+\.jpg$/.test(f)) fs.rmSync(path.join(out, f));

// the frames: full (landscape tiles) or the 9:16 view with the grid, each with its time
const time = "drawtext=fontfile=fonts/Anton-Regular.ttf:text='%{pts\\:hms}':x=8:y=8:fontsize=FS:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6";
const chain = full
  ? [`fps=1/${every}`, 'scale=480:-2', time.replace('FS', '26'), 'tile=4x5:padding=6:color=white']
  : [`fps=1/${every}`, 'scale=1080:1920:force_original_aspect_ratio=increase', `crop=1080:1920:(iw-1080)*${crop}:(ih-1920)/2`, 'scale=270:480',
    // shaded: YouTube's covered strips (top 7 %, bottom 20 %) and the caption band (52-70 %)
    'drawbox=y=0:w=iw:h=ih*0.07:color=red@0.25:t=fill', 'drawbox=y=ih*0.8:w=iw:h=ih*0.2:color=red@0.25:t=fill',
    'drawbox=y=ih*0.52:w=iw:h=ih*0.18:color=yellow@0.18:t=fill',
    'drawgrid=w=iw/10:h=ih/10:t=1:c=white@0.35', 'drawgrid=w=iw/2:h=ih/2:t=2:c=white@0.8', time.replace('FS', '20'),
    'tile=5x4:padding=6:color=white'];
const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', clipFile, '-vf', chain.join(','), '-q:v', '3', rel(path.join(out, 'sheet-%d.jpg'))], { cwd: ROOT, encoding: 'utf8' });
if (r.status !== 0) fail(`Making the sheets failed:\n${String(r.stderr).trim().split('\n').slice(-5).join('\n')}`);

// the moments the picture changes a lot: good places to start or end a cut
const sc = spawnSync(ffmpeg, ['-hide_banner', '-i', clipFile, '-vf', "select='gt(scene,0.3)',showinfo", '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const scenes = [...sc.stderr.matchAll(/pts_time:([\d.]+)/g)].map(m => (+m[1]).toFixed(1));

const sheets = fs.readdirSync(out).filter(f => /^sheet-\d+\.jpg$/.test(f)).sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)));
console.log(`Clip: ${clipArg}, ${video.width}x${video.height}, ${duration.toFixed(1)}s${info.streams.some(s => s.codec_type === 'audio') ? ', with sound' : ', no sound'}`);
console.log(`Frames: one every ${every}s, ${full ? 'the whole frame' : `the 9:16 view at crop ${crop} (grid lines every 10 %; red = covered by YouTube, yellow = captions)`}`);
console.log(`Scene changes: ${scenes.length ? scenes.map(s => `${s}s`).join(', ') : 'none (one continuous shot)'}`);
console.log(`Sheets:\n${sheets.map(f => `  ${path.join(out, f)}`).join('\n')}`);
