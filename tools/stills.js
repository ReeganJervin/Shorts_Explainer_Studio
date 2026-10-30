// Stills from a finished Short, side by side in one picture, for checking markers and captions.
//
//   node tools/stills.js videos/bonito.mp4 1 3.5 7 10.5        -> build/stills/bonito.jpg
//   node tools/stills.js videos/bonito.mp4 1 3.5 --out <folder>
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const fail = msg => { console.error(`\n${msg}\n`); process.exit(1); };
const args = process.argv.slice(2), oi = args.indexOf('--out');
const [video, ...times] = args.filter((a, i) => oi < 0 || (i !== oi && i !== oi + 1));
if (!video || !times.length) fail('Usage: node tools/stills.js videos/<name>.mp4 <time> [<time> ...] [--out <folder>]');
if (!fs.existsSync(video)) fail(`There is no video at ${video}.`);
if (times.some(t => !(+t >= 0))) fail('The times are seconds, like 1 3.5 7.');
if (times.length > 8) fail('Up to 8 stills at a time.');

const out = path.resolve(oi >= 0 ? args[oi + 1] : path.join(__dirname, '..', 'build', 'stills'));
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `${path.basename(video, path.extname(video))}.jpg`);
// one input per time (seeking each is quick), each scaled to 360x640, then side by side
const inputs = times.flatMap(t => ['-ss', String(t), '-i', video]);
const graph = times.map((_, i) => `[${i}:v]trim=end_frame=1,scale=360:640[s${i}]`).join(';') + ';' +
  (times.length > 1 ? `${times.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${times.length}[out]` : '[s0]null[out]');
const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-q:v', '3', file], { encoding: 'utf8' });
if (r.status !== 0) fail(`Making the stills failed:\n${String(r.stderr).trim()}`);
console.log(`Stills at ${times.map(t => `${t}s`).join(', ')}: ${file}`);
