// The markers drawn over the picture (step badge, labels, circles, arrows, the title card) as ASS events, which
// go into the same file as the captions. Positions are in the finished 1080x1920 picture, after any zoom.
// Zooms and freezes change the picture itself; make-short.js handles those.
const { assTime, assText } = require('./captions.js');
const { richText } = require('./cover.js');

const W = 1080, H = 1920;
const r = n => Math.round(n);
const ev = (start, end, style, text, layer = 1) => `Dialogue: ${layer},${assTime(start)},${assTime(end)},${style},,0,0,0,,${text}`;

// a circle of radius rad around (0, 0), from four curves
function circlePath(rad) {
  const k = r(rad * 0.5523), R = r(rad);
  return `m 0 ${-R} b ${k} ${-R} ${R} ${-k} ${R} 0 b ${R} ${k} ${k} ${R} 0 ${R} b ${-k} ${R} ${-R} ${k} ${-R} 0 b ${-R} ${-k} ${-k} ${-R} 0 ${-R}`;
}
// an arrow pointing right, its tip at (0, 0)
const ARROW = 'm 0 0 l -90 -62 l -90 -22 l -250 -22 l -250 22 l -90 22 l -90 62';

function markerEvents(markers, total, titleCard, title) {
  const out = [], until = e => Math.min(e, total);
  if (titleCard > 0) out.push(ev(0, until(titleCard), 'Title', `{\\an8\\pos(540,255)\\fad(0,250)}${richText(title)}`, 2));
  for (const m of markers) {
    const x = r(m.x * W), y = r(m.y * H), end = until(m.end);
    if (m.start >= total || m.kind === 'zoom' || m.kind === 'freeze' || m.off) continue;
    if (m.kind === 'step') {
      const text = /^\d+\s*\/\s*\d+$/.test(m.text) ? `STEP ${m.text.replace(/\s+/g, '')}` : m.text;
      out.push(ev(m.start, end, 'Step', `{\\an7\\pos(60,440)\\fscx70\\fscy70\\t(0,140,\\fscx108\\fscy108)\\t(140,240,\\fscx100\\fscy100)}${assText(text)}`));
    } else if (m.kind === 'label') {
      out.push(ev(m.start, end, 'Label', `{\\an5\\pos(${x},${y})\\fad(0,180)\\fscx60\\fscy60\\t(0,150,\\fscx108\\fscy108)\\t(150,250,\\fscx100\\fscy100)}${assText(m.text)}`));
    } else if (m.kind === 'circle') {
      // a yellow ring (transparent inside) over a darker, wider one so it shows on bright footage, popping in from small
      const pop = '\\fad(0,180)\\fscx35\\fscy35\\t(0,170,\\fscx112\\fscy112)\\t(170,280,\\fscx100\\fscy100)', ring = circlePath(m.size / 100 * W / 2);
      out.push(ev(m.start, end, 'Draw', `{\\an7\\pos(${x},${y})\\1a&HFF&\\3c&H000000&\\3a&H60&\\bord20\\shad0${pop}\\p1}${ring}{\\p0}`));
      out.push(ev(m.start, end, 'Draw', `{\\an7\\pos(${x},${y})\\1a&HFF&\\3c&H00E6FF&\\bord12\\shad0${pop}\\p1}${ring}{\\p0}`, 2));
    } else if (m.kind === 'arrow') {
      // slides in towards the spot along its own direction
      const a = m.angle * Math.PI / 180, dx = Math.cos(a), dy = -Math.sin(a);
      const from = `${r(x - dx * 140)},${r(y - dy * 140)}`, at = `${x},${y}`;
      out.push(ev(m.start, end, 'Draw', `{\\an7\\move(${from},${at},0,260)\\frz${m.angle}\\1c&H00E6FF&\\3c&H000000&\\bord6\\shad0\\fad(120,180)\\p1}${ARROW}{\\p0}`));
    }
  }
  return out;
}

module.exports = { markerEvents };
