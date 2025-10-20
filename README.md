# osu! -> Spotify playlist tool

This tool imports an osu! collection into a Spotify playlist.

Quick start

1. Create a Spotify app at https://developer.spotify.com/dashboard and copy your Client ID and Client Secret.
2. In the project root create a `.env` file containing:

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:8888/callback
```

3. Install dependencies:

```powershell
npm install
```

4. Run the CLI (collection import is the default flow):

```powershell
npm start --public
```

Examples

- Import a collection and use a custom playlist name:

```powershell
npm start --playlist "My osu playlist" --public
```

Basic guide

- The CLI reads osu! data under `%LOCALAPPDATA%\osu!` on Windows. It uses `collection.db` to list collections and `osu!.db` to map md5s to beatmap metadata where possible.
- When importing a collection the CLI prompts you to choose which collection to import and to confirm before creating a playlist.
- Authorization uses Spotify's OAuth flow via your browser. After sign-in the CLI continues and creates the playlist.

In-depth — what the project does

1) Read osu! collection data

- `collection.db` is parsed with `osu-db-parser` to extract collection names and md5 lists.
- If `osu!.db` is available, it's parsed to look up artist/title for md5s.

2) Local mapping (optional)

- If a local Songs folder exists, the code can scan beatmap files and audio files, compute md5 hashes and parse `.osu` metadata to produce better search strings.

3) Normalize & dedupe

- Parsed strings are normalized (strip extra whitespace, remove bracketed sections, basic punctuation normalization) and deduplicated.

4) Search Spotify and create playlist

- Each normalized entry is searched on Spotify (using `artist:` and `track:` qualifiers with a plain-fallback). Matches are collected and added in batches to a new playlist.

Troubleshooting

- "collection.db not found": verify your osu! files are under `%LOCALAPPDATA%\osu!` or provide the proper environment variables.
- Spotify auth issues: ensure your Spotify app Redirect URI matches `SPOTIFY_REDIRECT_URI` in `.env`.

Possible improvements

- Add `--songs <path>` to point to a custom Songs folder.
- Improve matching heuristics and rate-limit handling.

License: MIT
