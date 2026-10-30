// The checks that read the script, the clip and the timeline (the ones that need the finished video are in
// make-short.js). Each returns report lines: [level, what, detail], level PASS, WARN or NOTE.
const W = 1080, H = 1920;
const s1 = n => n.toFixed(1);

// before anything is made (also shown by --check)
function clipChecks(clip, cuts, set) {
  const out = [], enlarge = Math.max(W / clip.width, H / clip.height);
  out.push(enlarge > 2
    ? ['WARN', 'Picture', `the clip is ${clip.width}x${clip.height}, so the picture is enlarged ${enlarge.toFixed(1)}x and will look soft; a sharper (1080p or bigger) copy of the clip looks much better`]
    : ['PASS', 'Picture', `the clip is ${clip.width}x${clip.height}${enlarge > 1.05 ? ` (enlarged ${enlarge.toFixed(1)}x)` : ''}`]);
  const long = cuts.filter(c => c.wanted > clip.duration + 0.05), short = cuts.filter(c => c.end - c.start < 0.4);
  out.push(long.length || short.length
    ? ['WARN', 'Cuts', [...long.map(c => `line ${c.line} ends at ${s1(c.wanted)}s, but the clip ends at ${s1(clip.duration)}s, so it stops there`),
      ...short.map(c => `line ${c.line} is only ${s1(c.end - c.start)}s long, which shows as a flash`)].join('; ')]
    : ['PASS', 'Cuts', cuts.length > 1 ? `${cuts.length} cuts, all inside the clip` : 'the whole clip']);
  const title = (set.title || '').replace(/\*/g, '');
  if (title.length > 100) out.push(['WARN', 'Title', `${title.length} characters; YouTube allows 100, so shorten it before uploading`]);
  else if (title.length > 60) out.push(['WARN', 'Title', `${title.length} characters; under 60 shows in full on phones`]);
  else if (set['title card'] && title.length > 32) out.push(['WARN', 'Title', `${title.length} characters makes the title card 2-3 lines, which can cover the step badge; under 32 fits on one or two`]);
  else out.push(['PASS', 'Title', title ? `"${title}"` : 'no title (the file name is used in the description)']);
  const tags = (set.hashtags || '').match(/#\w+/g) || [];
  out.push(tags.length > 15 ? ['WARN', 'Hashtags', `${tags.length}; with more than 15, YouTube ignores all of them`] : ['PASS', 'Hashtags', `${tags.length || 1} (${tags.length ? tags.slice(0, 5).join(' ') + (tags.length > 5 ? ' ...' : '') : '#shorts'})`]);
  return out;
}

// once the voice lines and markers are placed
function timelineChecks(lines, markers, total, captions) {
  const out = [], first = lines[0];
  const hook = [];
  if (first.start > 1) hook.push(`the first words come at ${s1(first.start)}s; start talking in the first second`);
  if (first.end - first.start > 4) hook.push(`the first line takes ${s1(first.end - first.start)}s to say; a hook under 3 s keeps people watching`);
  out.push(hook.length ? ['WARN', 'Hook', hook.join('; ')] : ['PASS', 'Hook', `"${first.text}" (${s1(first.end - first.start)}s)`]);
  const gaps = [];
  lines.forEach((l, i) => { const next = lines[i + 1]?.start ?? total - 0.6; if (next - l.end > 2.5) gaps.push(`${s1(l.end)}s-${s1(next)}s`); });
  out.push(gaps.length ? ['WARN', 'Silences', `nothing is said at ${gaps.join(', ')}; long quiet parts are where people swipe away`] : ['PASS', 'Silences', 'no quiet part longer than 2.5 s']);
  // the captions sit in a band at about 55-66 % of the height
  const band = [1060, 1270], over = !captions ? [] : markers.filter(m => {
    const y = m.y * H;
    if (m.kind === 'label') return y + 70 > band[0] && y - 70 < band[1];
    if (m.kind === 'circle') { const r = m.size / 100 * W / 2 + 10; return y + r > band[0] && y - r < band[1]; }
    if (m.kind === 'arrow') return y + 60 > band[0] && y - 60 < band[1];
    return false;
  });
  out.push(over.length ? ['WARN', 'Captions clear', `${over.map(m => `line ${m.line} (${m.kind})`).join(', ')} overlaps the captions; move it above 52 or below 70 "down"`] : ['PASS', 'Captions clear', 'no marker covers the captions']);
  return out;
}

module.exports = { clipChecks, timelineChecks };
