// Reads a short's script file (shorts/<name>.txt) into settings, cuts and voice lines.
// See README.md for every line you can write. Mistakes come back as friendly messages with line numbers.
const fs = require('fs');

// settings that go at the top: "name: value"
const SETTINGS = {
  title: 'text', clip: 'text', voice: 'text', 'original audio': 'percent', music: 'text', 'music volume': 'percent',
  crop: 'crop', credit: 'text', hashtags: 'text', captions: 'onoff',
};
const DEFAULTS = { voice: 'narrator', 'original audio': 15, 'music volume': 20, crop: 0.5, captions: true };

// "4", "4.5", "0:04", "1:02.5" -> seconds
function seconds(s) {
  const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(s);
  return m ? (m[1] ? +m[1] * 60 : 0) + +m[2] : null;
}

function parseScript(text) {
  const out = { settings: { ...DEFAULTS }, cuts: [], lines: [], errors: [] };
  const err = (n, msg) => out.errors.push(`Line ${n}: ${msg}`);
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1, line = raw.trim();
    if (!line || line.startsWith('#')) return;
    // "say at 0:04.5: text" (the time can have its own colon) or "name: value"
    const t = /^([a-z ]+?)\s+at\s+(\S+?)\s*:(?:\s|$)(.*)$/i.exec(line), m = t || /^([a-z ]+?)\s*:\s*(.*)$/i.exec(line);
    if (!m) return err(n, `"${line}" isn't a line I know. Lines look like "say: ...", "cut: 0-6.5" or "title: ...".`);
    const key = m[1].toLowerCase(), at = t ? t[2] : undefined, value = (t ? t[3] : m[2]).trim();
    if (key === 'say') {
      if (!value) return err(n, 'say: needs something to say.');
      let start = null;
      if (at !== undefined && (start = seconds(at)) === null) return err(n, `"${at}" isn't a time. Write it like 4, 4.5 or 0:04.5.`);
      return out.lines.push({ line: n, text: value, at: start });
    }
    if (at !== undefined) return err(n, `only say lines can have "at" (for now).`);
    if (key === 'cut') {
      const c = /^([\d:.]+)\s*-\s*([\d:.]+)$/.exec(value), a = c && seconds(c[1]), b = c && seconds(c[2]);
      if (a === null || b === null || !c) return err(n, `cut: needs a start and an end, like "cut: 0-6.5" or "cut: 0:12-0:20".`);
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
    } else out.settings[key] = value;
  });
  if (!out.settings.clip) out.errors.push('The script needs a clip, for example "clip: clips/bonito.mp4".');
  if (!out.lines.length) out.errors.push('The script has nothing to say yet. Add at least one "say: ..." line.');
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

module.exports = { parseScript, readScript, placeLines, seconds };
