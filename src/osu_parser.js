const fs = require('fs');
function parseBeatmap(p) {
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split(/\r?\n/);
  let inMeta = false;
  const out = {};
  for (const l of lines) {
    if (l.trim() === '[Metadata]') {
      inMeta = true; continue;
    }
    if (!inMeta) continue;
    if (l.startsWith('[')) break;
    const m = l.match(/^([^:]+):\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return { artist: out.Artist || out.Creator || '', title: out.Title || '', source: p };
}

module.exports = { parseBeatmap };
