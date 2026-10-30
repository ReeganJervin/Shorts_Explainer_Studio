// Captions from the voice lines: burned-in ASS captions (a few words at a time, the spoken word highlighted)
// and a plain .srt for YouTube. Word times are estimated from the voice clip's length, by letters per word.
// The ASS file also carries the markers (markers.js), so its styles for those are here too.

// a line -> groups of up to 3 words, never running over a full stop or comma
function groups(text) {
  const words = text.split(/\s+/).filter(Boolean), out = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length === 3 || /[.,!?;:…]$/.test(w)) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

// every word with its start and end, spread over the line by length (punctuation counts as a short pause)
function wordTimes(line) {
  const gs = groups(line.text), flat = gs.flat();
  const weight = w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 2 + (/[.,!?;:…]$/.test(w) ? 3 : 0);
  const total = flat.reduce((s, w) => s + weight(w), 0), span = line.end - line.start;
  let t = line.start, k = 0;
  return gs.map(g => g.map(w => {
    const d = span * weight(w) / total, word = { text: w, start: t, end: t + d, index: k++ };
    t += d;
    return word;
  }));
}

const assTime = s => { const cs = Math.round(Math.max(0, s) * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const srtTime = s => { const ms = Math.round(Math.max(0, s) * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const assText = s => s.replace(/[{}\\]/g, '').toUpperCase();

// the caption events: one per word, the group stays up and the word being said turns yellow
function captionEvents(lines) {
  const events = [];
  for (const line of lines) for (const g of wordTimes(line)) {
    g.forEach((w, i) => {
      const end = i === g.length - 1 ? w.end : g[i + 1].start;
      const text = g.map(x => x === w ? `{\\c&H00E6FF&}${assText(x.text)}{\\c&HFFFFFF&}` : assText(x.text)).join(' ');
      events.push(`Dialogue: 0,${assTime(w.start)},${assTime(end)},Caption,,0,0,0,,${text}`);
    });
  }
  return events;
}

// 1080x1920; the captions sit at about 64 % height, clear of the title at the top and YouTube's buttons at the bottom.
// Step and Label use BorderStyle 3: the outline colour becomes a box behind the text.
function makeAss(events) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Anton,150,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,1,0,1,10,4,2,70,70,680,1
Style: Title,Anton,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,1,0,1,8,4,8,80,80,0,1
Style: Step,Anton,86,&H00000000,&H00000000,&H0000E6FF,&H00000000,0,0,0,0,100,100,2,0,3,14,0,7,0,0,0,1
Style: Label,Anton,96,&H00000000,&H00000000,&H00FFFFFF,&H64000000,0,0,0,0,100,100,1,0,3,16,0,5,0,0,0,1
Style: Draw,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

// .srt: one entry per voice line
const makeSrt = lines => lines.map((l, i) => `${i + 1}\n${srtTime(l.start)} --> ${srtTime(l.end)}\n${l.text}\n`).join('\n');

module.exports = { makeAss, makeSrt, captionEvents, wordTimes, assTime, assText };
