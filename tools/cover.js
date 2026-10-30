// The cover image (videos/<name>-cover.jpg): a clean frame of the Short (no captions or markers, with the logo),
// darkened behind a big title. *Words in stars* turn yellow, here and on the title card.
const { assText } = require('./captions.js');

// "How *bonito* is made" -> ASS text with the starred words in yellow
const richText = s => assText(s).replace(/\*([^*]+)\*/g, '{\\c&H00E6FF&}$1{\\c&HFFFFFF&}').replace(/\*/g, '');
const plainText = s => s.replace(/\*/g, '');

// the moment to take the cover from: "cover at", else the first zoom at its closest, else 40 % of the way in
function coverTime(setting, markers, total) {
  const zoom = markers.filter(m => m.kind === 'zoom').sort((a, b) => a.start - b.start)[0];
  const t = setting ?? (zoom ? zoom.start + Math.min(0.6, (zoom.end - zoom.start) / 2) : total * 0.4);
  return Math.max(0, Math.min(t, total - 0.05));
}

function coverAss(text) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cover,Anton,170,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,1,0,1,12,7,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Cover,,0,0,0,,{\\an5\\pos(540,640)}${richText(text)}
`;
}

// darkens a band around the text (strongest at a third of the way down) so the title reads on any picture
const DARKEN = (() => { const f = '(1-0.62*exp(-pow((Y-H*0.333)/(H*0.17),2)))'; return `format=gbrp,geq=r='r(X,Y)*${f}':g='g(X,Y)*${f}':b='b(X,Y)*${f}'`; })();

module.exports = { richText, plainText, coverTime, coverAss, DARKEN };
