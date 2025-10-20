const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const OsuDBParser = require('osu-db-parser');
const osuParser = require('./osu_parser');

function resolvePaths() {
  const local = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : null);
  if (!local) throw new Error('LOCALAPPDATA/USERPROFILE not found');
  const osuDbPath = path.join(local, 'osu!', 'osu!.db');
  const collectionPath = path.join(local, 'osu!', 'collection.db');
  return { osuDbPath, collectionPath };
}

function listCollections() {
  const { collectionPath } = resolvePaths();
  if (!fs.existsSync(collectionPath)) throw new Error(`collection.db not found: ${collectionPath}`);
  const buf = Buffer.from(fs.readFileSync(collectionPath));
  const parser = new OsuDBParser(null, buf);
  const collRaw = parser.getCollectionData();
  const collArr = Array.isArray(collRaw) ? collRaw : (collRaw && Array.isArray(collRaw.collection) ? collRaw.collection : []);
  return collArr.map(c => c.name);
}

function getSongsForCollection(name) {
  const { osuDbPath, collectionPath } = resolvePaths();
  if (!fs.existsSync(collectionPath)) throw new Error(`collection.db not found: ${collectionPath}`);
  if (!fs.existsSync(osuDbPath)) throw new Error(`osu!.db not found: ${osuDbPath}`);
  const collectionBuf = Buffer.from(fs.readFileSync(collectionPath));
  const parserCollection = new OsuDBParser(null, collectionBuf);
  const collRaw = parserCollection.getCollectionData();
  const collArr = Array.isArray(collRaw) ? collRaw : (collRaw && Array.isArray(collRaw.collection) ? collRaw.collection : []);
  const found = collArr.find(c => c.name === name);
  if (!found) return [];
  const md5s = found.beatmapsMd5 || [];
  try {
    if (!fs.existsSync(osuDbPath)) throw new Error('osu!.db missing');
    const osuBuf = Buffer.from(fs.readFileSync(osuDbPath));
    const parserFull = new OsuDBParser(osuBuf, collectionBuf);
    const osuData = parserFull.getOsuDBData();
    const md5set = new Set(md5s.map(m => String(m).toLowerCase()));
    const results = [];
    for (const entry of osuData && osuData.beatmaps ? osuData.beatmaps : []) {
      if (entry && entry.md5 && md5set.has(entry.md5.toLowerCase())) {
        results.push({ artist: entry.artist, title: entry.title, md5: entry.md5 });
      }
    }
    if (results.length > 0) return results;
  } catch (err) {}
  return md5s.map(m => ({ artist: null, title: null, md5: String(m) }));
}

function buildIndex(songsDir) {
  const idx = new Map();
  if (!fs.existsSync(songsDir)) return idx;
  const entries = fs.readdirSync(songsDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const folder = path.join(songsDir, e.name);
    const files = fs.readdirSync(folder);
    for (const f of files) {
      if (f.endsWith('.osu')) {
        const osuPath = path.join(folder, f);
        try {
          const data = fs.readFileSync(osuPath);
          const osuMd5 = crypto.createHash('md5').update(data).digest('hex');
          const meta = osuParser.parseBeatmap(osuPath);
          idx.set(osuMd5, { artist: meta.artist, title: meta.title, path: osuPath });
        } catch (err) {}
      }
      const lower = f.toLowerCase();
      if (lower.endsWith('.mp3') || lower.endsWith('.ogg') || lower.endsWith('.wav') || lower.endsWith('.flac')) {
        try {
          const data = fs.readFileSync(path.join(folder, f));
          const audioMd5 = crypto.createHash('md5').update(data).digest('hex');
          const osuFile = files.find(x => x.endsWith('.osu'));
          if (osuFile) {
            const meta = osuParser.parseBeatmap(path.join(folder, osuFile));
            idx.set(audioMd5, { artist: meta.artist, title: meta.title, path: path.join(folder, osuFile) });
          }
        } catch (err) {}
      }
    }
  }
  return idx;
}

function mapMd5List(md5List, songsDir) {
  const idx = buildIndex(songsDir);
  const out = [];
  const seen = new Set();
  for (const m of md5List) {
    const key = m.toLowerCase();
    if (!idx.has(key)) continue;
    const meta = idx.get(key);
    const norm = ((meta.artist || '') + ' ' + (meta.title || '')).toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(meta);
  }
  return out;
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]|\{.*?\}/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanList(list, collectionName) {
  const seen = new Set();
  const out = [];
  const collNorm = collectionName ? normalize(collectionName) : null;
  for (const raw of list) {
    if (!raw || typeof raw !== 'string') continue;
    const s = raw.trim();
    if (s.length < 3) continue;
    if (/^bpm\b/i.test(s)) continue;
    const cmp = normalize(s);
    if (!cmp) continue;
    if (collNorm && cmp === collNorm) continue;
    const punctRatio = (s.match(/[^A-Za-z0-9\s]/g) || []).length / s.length;
    if (punctRatio > 0.4) continue;
    if (seen.has(cmp)) continue;
    seen.add(cmp);
    out.push(s);
  }
  return out;
}

function writeCsv(rows, outPath) {
  const header = [
    'Track URI', 'Track Name', 'Album Name', 'Artist Name(s)', 'Release Date', 'Duration (ms)', 'Popularity', 'Explicit', 'Added By', 'Added At', 'Genres', 'Record Label',
    'Danceability', 'Energy', 'Key', 'Loudness', 'Mode', 'Speechiness', 'Acousticness', 'Instrumentalness', 'Liveness', 'Valence', 'Tempo', 'Time Signature'
  ];
  const lines = [header.join(',')];
  const escape = s => '"' + String(s || '').replace(/"/g, '""') + '"';
  for (const r of rows) {
    const trackUri = '';
    const trackName = r.title || '';
    const albumName = '';
    const artistNames = r.artist || '';
    const releaseDate = '';
    const durationMs = '';
    const popularity = '';
    const explicit = 'false';
    const addedBy = '';
    const addedAt = '';
    const genres = '';
    const recordLabel = '';
    const numericPlaceholders = Array(12).fill('');

    const row = [
      trackUri,
      escape(trackName),
      escape(albumName),
      escape(artistNames),
      releaseDate,
      durationMs,
      popularity,
      explicit,
      addedBy,
      addedAt,
      escape(genres),
      escape(recordLabel),
      ...numericPlaceholders
    ];
    lines.push(row.join(','));
  }
  fs.writeFileSync(outPath, lines.join('\r\n'), 'utf8');
}

module.exports = { listCollections, getSongsForCollection, buildIndex, mapMd5List, cleanList };

