// Reads a short's script file (shorts/<name>.txt) into settings, cuts, voice lines and markers.
// See README.md for every line you can write. Mistakes come back as friendly messages with line numbers.
const fs = require('fs');

// settings that go at the top: "name: value"
const SETTINGS = {
  title: 'text', clip: 'text', voice: 'text', 'original audio': 'percent', music: 'text', 'music volume': 'percent',
  crop: 'crop', credit: 'text', hashtags: 'text', captions: 'onoff', 'title card': 'titlecard',
  logo: 'text', 'logo position': 'corner', 'sound effects': 'onoff', 'sound effects volume': 'percent',
  'cover at': 'time', 'cover text': 'text',
};
const DEFAULTS = {
  voice: 'narrator', 'original audio': 15, 'music volume': 20, crop: 0.5, captions: true, 'title card': 0,
  'logo position': 'top left', 'sound effects': true, 'sound effects volume': 60,
};
// things that happen at a moment: "<name> [at <time>] [for <seconds>]: <value>"
const MARKERS = ['step', 'label', 'circle', 'arrow', 'zoom', 'freeze'];
// how long each one stays when there's no "for"
const LASTS = { label: 2.5, circle: 2, arrow: 2, zoom: 2.5, freeze: 1.5 };
const FROM = { left: 0, 'top left': -45, top: -90, 'top right': -135, right: 180, 'bottom right': 135, bottom: 90, 'bottom left': 45 };

// "4", "4.5", "0:04", "1:02.5" -> seconds
function seconds(s) {
  const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*s?\s*$/.exec(s);
  return m ? (m[1] ? +m[1] * 60 : 0) + +m[2] : null;
}

// "50, 30" -> { x: 0.5, y: 0.3 } (percent across, percent down), or null
function place(s) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*%?\s*,\s*(\d+(?:\.\d+)?)\s*%?\s*$/.exec(s);
  return m && +m[1] <= 100 && +m[2] <= 100 ? { x: +m[1] / 100, y: +m[2] / 100 } : null;
}

// a marker's value -> its details, or an error message
function markerValue(kind, value) {
  const POS = 'a position like "50, 30" (percent across, percent down)';
  if (kind === 'step') {
    if (!value) return 'step: needs what to show, like "step: 2/6" or "step: Smoking". "step: off" hides it.';
    return { text: value, off: /^off$/i.test(value) };
  }
  if (kind === 'label') {
    const [text, at] = value.split('@').map(s => s.trim());
    if (!text) return 'label: needs some text, like "label: 4 weeks".';
    const p = at === undefined ? { x: 0.5, y: 0.32 } : place(at);
    return p ? { text, ...p } : `after the @ the label needs ${POS}.`;
  }
  if (kind === 'circle') {
    const p = place(value), m = /^(.*),\s*(\d+(?:\.\d+)?)\s*%?$/.exec(value), sized = !p && m && place(m[1]);
    if (!p && !sized) return `circle: needs ${POS}, and optionally a size: "circle: 50, 60, 25" (25 % of the width).`;
    const size = p ? 20 : +m[2];
    return size >= 3 && size <= 90 ? { ...(p || sized), size } : 'the circle size is a percentage of the width, from 3 to 90.';
  }
  if (kind === 'arrow') {
    const m = /^(.*?)(?:\s+from\s+(.+))?$/i.exec(value), p = place(m[1]), from = (m[2] || 'top left').toLowerCase().replace(/\s+/g, ' ');
    if (!p) return `arrow: needs ${POS} for where it points, and optionally where it comes from: "arrow: 50, 60 from top left".`;
    return from in FROM ? { ...p, angle: FROM[from] } : `an arrow comes from ${Object.keys(FROM).join(', ')}.`;
  }
  if (kind === 'zoom') {
    const [z, at] = value.split('@').map(s => s.trim()), m = /^(\d+(?:\.\d+)?)\s*x?$/i.exec(z || '1.5');
    if (!m || +m[1] < 1.05 || +m[1] > 4) return 'zoom: needs how close to go, from 1.05x to 4x, like "zoom: 1.5x" or "zoom: 2x @ 50, 40".';
    const p = at === undefined ? { x: 0.5, y: 0.5 } : place(at);
    return p ? { zoom: +m[1], ...p } : `after the @ the zoom needs ${POS} to zoom in on.`;
  }
  return {};   // freeze: nothing after the colon
}

function parseScript(text) {
  const out = { settings: { ...DEFAULTS }, cuts: [], lines: [], markers: [], errors: [] };
  const err = (n, msg) => out.errors.push(`Line ${n}: ${msg}`);
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1, line = raw.trim();
    if (!line || line.startsWith('#')) return;
    // "zoom at 0:04.5 for 2: 1.5x" (a time can have its own colon) or "name: value"
    const t = /^([a-z ]+?)(?:\s+at\s+(\S+?))?(?:\s+for\s+(\S+?))?\s*:(?:\s|$)(.*)$/i.exec(line), m = t || /^([a-z ]+?)\s*:\s*(.*)$/i.exec(line);
    if (!m) return err(n, `"${line}" isn't a line I know. Lines look like "say: ...", "cut: 0-6.5" or "title: ...".`);
    const key = m[1].toLowerCase(), at = t?.[2], lasts = t?.[3], value = (t ? t[4] : m[2]).trim();
    let start = null, dur = null;
    if (at !== undefined && (start = seconds(at)) === null) return err(n, `"${at}" isn't a time. Write it like 4, 4.5 or 0:04.5.`);
    if (lasts !== undefined && !((dur = seconds(lasts)) > 0)) return err(n, `"for ${lasts}" needs a number of seconds, like "for 2" or "for 1.5".`);
    if (key !== 'say' && !MARKERS.includes(key) && (at !== undefined || lasts !== undefined)) return err(n, `only say and the markers (${MARKERS.join(', ')}) can have "at" or "for".`);
    if (key === 'say') {
      if (!value) return err(n, 'say: needs something to say.');
      if (dur !== null) return err(n, 'a say line lasts as long as the voice takes, so it can\'t have "for".');
      return out.lines.push({ line: n, text: value, at: start });
    }
    if (MARKERS.includes(key)) {
      const v = markerValue(key, value);
      if (typeof v === 'string') return err(n, v);
      // without "at" a marker starts with the say line just above it
      return out.markers.push({ line: n, kind: key, at: start, after: out.lines.length - 1, lasts: dur ?? LASTS[key] ?? null, ...v });
    }
    if (key === 'cut') {
      const c = /^([\d:.]+)\s*-\s*([\d:.]+)$/.exec(value), a = c && seconds(c[1]), b = c && seconds(c[2]);
      if (a === null || b === null) return err(n, `cut: needs a start and an end, like "cut: 0-6.5" or "cut: 0:12-0:20".`);
      if (b <= a) return err(n, `the cut ends (${b}s) before it starts (${a}s).`);
      return out.cuts.push({ line: n, start: a, end: b });
    }
    const kind = SETTINGS[key];
    if (!kind) return err(n, `"${key}" isn't a setting I know. Settings: ${Object.keys(SETTINGS).join(', ')}.`);
    if (kind === 'percent') {
      const p = /^(\d+(?:\.\d+)?)\s*%?$/.exec(value);
      if (!p || +p[1] > 200) return err(n, `${key} needs a percentage, like "${key}: 15%".`);
      out.settings[key] = +p[1];
    } else if (kind === 'crop') {
      const named = { left: 0, center: 0.5, centre: 0.5, middle: 0.5, right: 1 }[value.toLowerCase()];
      const num = /^\d+(\.\d+)?$/.test(value) ? +value : null;
      if (named === undefined && (num === null || num > 1)) return err(n, 'crop: is left, center, right, or a number from 0 (left) to 1 (right).');
      out.settings.crop = named ?? num;
    } else if (kind === 'onoff') {
      if (!/^(on|off)$/i.test(value)) return err(n, `${key}: is on or off.`);
      out.settings[key] = /^on$/i.test(value);
    } else if (kind === 'titlecard') {
      // seconds at the start, "always", or off
      const v = value.toLowerCase(), s = seconds(v);
      if (!['on', 'off', 'always'].includes(v) && s === null) return err(n, 'title card: is a number of seconds (like 3), always, or off.');
      out.settings[key] = v === 'always' ? Infinity : v === 'on' ? 3 : v === 'off' ? 0 : s;
    } else if (kind === 'time') {
      const s = seconds(value);
      if (s === null) return err(n, `${key}: needs a time in the finished Short, like "${key}: 7.5".`);
      out.settings[key] = s;
    } else if (kind === 'corner') {
      const v = value.toLowerCase().replace(/\s+/g, ' ');
      if (!['top left', 'top right'].includes(v)) return err(n, 'logo position: is top left or top right (the bottom is covered by YouTube\'s buttons).');
      out.settings[key] = v;
    } else out.settings[key] = value;
  });
  if (!out.settings.clip) out.errors.push('The script needs a clip, for example "clip: clips/bonito.mp4".');
  if (!out.lines.length) out.errors.push('The script has nothing to say yet. Add at least one "say: ..." line.');
  if (out.settings['title card'] && !out.settings.title) out.errors.push('The title card needs a title, for example "title: How bonito flakes are made".');
  return out;
}

const readScript = file => parseScript(fs.readFileSync(file, 'utf8'));

// Places every voice line on the short's timeline, now that the voice lengths are known.
// A line without "at" starts just after the line before it. Returns problems as messages.
const GAP = 0.25, FIRST = 0.2;
function placeLines(lines, lengths) {
  const problems = [];
  let free = FIRST;
  lines.forEach((l, i) => {
    l.start = l.at ?? free;
    l.end = l.start + lengths[i];
    if (l.at !== null && l.at < free - GAP + 0.01 && i) problems.push(`Line ${l.line}: starts at ${l.at}s, but the line before it is still talking until ${(free - GAP).toFixed(1)}s.`);
    free = l.end + GAP;
  });
  return problems;
}

// Gives every marker its start and end, once the voice lines are placed. A step lasts until the next step.
// Returns problems as messages (zooms and freezes that overlap each other).
function placeMarkers(markers, lines) {
  const problems = [];
  for (const m of markers) m.start = m.at ?? (m.after >= 0 ? lines[m.after].start : 0);
  const steps = markers.filter(m => m.kind === 'step').sort((a, b) => a.start - b.start);
  steps.forEach((m, i) => { m.end = m.lasts !== null ? m.start + m.lasts : steps[i + 1]?.start ?? Infinity; });
  for (const m of markers) if (m.kind !== 'step') m.end = m.start + m.lasts;
  for (const kind of ['zoom', 'freeze']) {
    const list = markers.filter(m => m.kind === kind).sort((a, b) => a.start - b.start);
    list.forEach((m, i) => { if (i && m.start < list[i - 1].end - 0.01) problems.push(`Line ${m.line}: this ${kind} starts at ${m.start.toFixed(1)}s, while the ${kind} on line ${list[i - 1].line} is still going (until ${list[i - 1].end.toFixed(1)}s).`); });
  }
  return problems;
}

module.exports = { parseScript, readScript, placeLines, placeMarkers, seconds };
