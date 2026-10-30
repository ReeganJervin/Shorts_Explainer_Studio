// Downloads the Kokoro voice model (about 120 MB, once) into models/.
const https = require('https'), fs = require('fs'), path = require('path');
const BASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/';
const FILES = [['kokoro-v1.0.int8.onnx', 'kokoro.onnx'], ['voices-v1.0.bin', 'voices.bin']];
const dir = path.resolve(__dirname, '..', 'models');

function get(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'shorts-explainer-studio' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) { res.resume(); return resolve(get(new URL(res.headers.location, url).href, dest, redirects + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      const total = +res.headers['content-length'] || 0; let got = 0, shown = -1;
      const tmp = dest + '.part', out = fs.createWriteStream(tmp);
      res.on('data', d => {
        got += d.length;
        const pct = total ? Math.floor(got / total * 100) : -1;
        if (pct !== shown) { shown = pct; process.stdout.write(`\r  ${path.basename(dest)}: ${pct}%   `); }
      });
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(tmp, dest); process.stdout.write('\n'); resolve(); }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  for (const [remote, local] of FILES) {
    const dest = path.join(dir, local);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1e6) { console.log(`  ${local}: already downloaded`); continue; }
    await get(BASE + remote, dest);
  }
  console.log('Voice model ready.');
})().catch(e => { console.error('Download failed: ' + e.message); process.exit(1); });
