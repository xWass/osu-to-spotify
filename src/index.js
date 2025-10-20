#!/usr/bin/env node
const { Command } = require('commander');
const dotenv = require('dotenv');
const path = require('path');
const collection = require('./collection_parser');
const spotify = require('./spotify_client');

dotenv.config();

const program = new Command();
program
  .option('--playlist <name>', 'playlist name to create on Spotify')
  .option('--public', 'create public playlist')
  
  .option('--create-only', 'create playlist without importing collection')
  ;

program.parse(process.argv);

(async () => {
  try {
    const opts = program.opts();
    if (opts.createOnly) {
      if (!opts.playlist) { console.error('Provide --playlist when using --create-only'); process.exit(1); }
      const api = await spotify.authInteractive();
      const userId = await spotify.getUserId(api);
      const pl = await spotify.createPlaylist(api, userId, opts.playlist, [], !!opts.public);
      console.log('Playlist created:', pl.external_urls ? pl.external_urls.spotify : pl.id);
      process.exit(0);
    }

  {
      const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : null);
      if (!localAppData) { console.error('Unable to find LOCALAPPDATA/USERPROFILE'); process.exit(1); }
      const candidates = collection.listCollections();
      if (!candidates || !candidates.length) { console.error('No collections'); process.exit(1); }
      const inquirerModule = await import('inquirer');
      const inquirer = inquirerModule.default || inquirerModule;
      const { chosen } = await inquirer.prompt([{ type: 'list', name: 'chosen', message: 'Choose a collection:', choices: candidates.slice(0, 200) }]);
      const entries = collection.getSongsForCollection(chosen);
      const md5s = entries.map(e => e && e.md5).filter(Boolean);
      const songsDir = path.join(localAppData, 'osu!', 'Songs');
      let mapped = [];
      if (md5s.length) mapped = collection.mapMd5List(md5s, songsDir);
      const list = [];
      const seen = new Set();
      for (const m of mapped) {
        const t = `${m.artist} - ${m.title}`.trim();
        const k = t.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!k || seen.has(k)) continue; seen.add(k); list.push(t);
      }
      if (!list.length) {
        const textual = entries.map(r => (r && r.artist && r.title) ? `${r.artist} - ${r.title}` : null).filter(Boolean);
        for (const t of textual) { const k = String(t).toLowerCase().replace(/\s+/g, ' ').trim(); if (!k || seen.has(k)) continue; seen.add(k); list.push(t); }
      }
      if (!list.length) { console.error('No usable metadata'); process.exit(1); }
      const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: `Create Spotify playlist with ${list.length} songs?`, default: true }]);
      if (!confirm) process.exit(0);
      const api = await spotify.authInteractive();
      const userId = await spotify.getUserId(api);
      const foundUris = [];
      for (const s of list) {
        let artist = '';
        let title = s;
        if (s.includes(' - ')) { const parts = s.split(' - '); artist = parts[0]; title = parts.slice(1).join(' - '); }
        const hit = await spotify.findTrack(api, artist, title);
        if (hit) { console.log('Matched:', s, '->', hit.name, 'by', hit.artists.map(a => a.name).join(', ')); foundUris.push(hit.uri); } else { console.log('Not found on Spotify:', s); }
      }
      if (!foundUris.length) { console.log('No tracks matched'); process.exit(0); }
      const uniqueUris = [];
      const seenUris = new Set();
      for (const u of foundUris) { if (!seenUris.has(u)) { seenUris.add(u); uniqueUris.push(u); } }
      let playlistName = opts.playlist;
      if (!playlistName) {
        const ans = await inquirer.prompt([{ name: 'playlistName', message: 'Playlist name:', default: chosen }]);
        playlistName = ans.playlistName;
      }
      const playlist = await spotify.createPlaylist(api, userId, playlistName, uniqueUris, !!opts.public);
      console.log('Playlist created:', playlist.external_urls ? playlist.external_urls.spotify : playlist.id);
      process.exit(0);
    }
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
