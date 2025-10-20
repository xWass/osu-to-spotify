const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');

function makeApi() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:8888/callback';
  if (!id || !secret) throw new Error('SPOTIFY_CLIENT_ID/SECRET not set');
  return new SpotifyWebApi({ clientId: id, clientSecret: secret, redirectUri: redirect });
}

async function authInteractive(scopes = ['playlist-modify-public', 'playlist-modify-private', 'user-read-private']) {
  const api = makeApi();
  const app = express();
  let server;
  return new Promise((resolve, reject) => {
    const state = Math.random().toString(36).slice(2);
    const url = api.createAuthorizeURL(scopes, state);
    console.log('Open to authorize:\n', url);
    app.get('/callback', async (req, res) => {
      const code = req.query.code;
      if (!code) return reject(new Error('Missing code'));
      try {
        const data = await api.authorizationCodeGrant(code);
        if (!data?.body?.access_token) return reject(new Error('No access token'));
        api.setAccessToken(data.body.access_token);
        api.setRefreshToken(data.body.refresh_token);
        res.send('OK');
        resolve(api);
      } catch (e) { reject(e); } finally { setTimeout(() => server && server.close(), 1000); }
    });
    server = app.listen(8888, async () => {
      try { const openMod = await import('open'); const openFn = openMod.default || openMod; openFn(url); } catch (e) { console.log('Open this URL:', url); }
    });
  });
}

async function refreshIfNeeded(api) {
  try { const data = await api.refreshAccessToken(); api.setAccessToken(data.body.access_token); } catch (e) { console.error('refresh failed', e && e.message ? e.message : e); }
}

async function findTrack(api, artist, title) {
  const q = `artist:${artist} track:${title}`;
  try {
    const r = await api.searchTracks(q, { limit: 5 });
    const it = r?.body?.tracks?.items;
    if (it && it.length) return it[0];
    const fb = await api.searchTracks(`${artist} ${title}`, { limit: 5 });
    return fb?.body?.tracks?.items?.[0] || null;
  } catch (e) { console.error('search error', e && e.message ? e.message : e); return null; }
}

async function createPlaylist(api, userId, name, uris, isPublic = false) {
  const res = await api.createPlaylist(name, { public: !!isPublic, description: 'Imported from osu' });
  const id = res?.body?.id;
  if (!id) throw new Error('no playlist id');
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    try { await api.addTracksToPlaylist(id, batch); } catch (e) { console.error('add batch failed', e && e.message ? e.message : e); }
  }
  return res.body;
}

async function getUserId(api) { const me = await api.getMe(); const id = me?.body?.id; if (!id) throw new Error('no user id'); return id; }

module.exports = { authInteractive, makeApi, findTrack, createPlaylist, getUserId, refreshIfNeeded };
