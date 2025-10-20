# osu! -> Spotify playlist tool

This CLI scans your local osu! Songs folder, extracts Artist and Title from .osu beatmap files, searches Spotify for matching tracks, and creates a playlist with the found tracks.

Setup

1. Copy `.env.example` to `.env` and fill in `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI`.
2. Create a Spotify app at https://developer.spotify.com/dashboard and add the redirect URI.
3. Install dependencies:

```powershell
npm install
```

## osu! -> Spotify

This small CLI imports an osu! collection into a Spotify playlist.

Requirements

- Node.js 16+
- A Spotify developer app (client id & secret)

Setup

1. Create a file named `.env` in the project root with these values:

SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:8888/callback

2. Install dependencies:

```powershell
npm install
```

Run

Use the collection flow (default) to pick an osu! collection and create a playlist:

```powershell
npm start -- --collection
```

You can also pass `--playlist "Name"` to create a playlist with a specific name and `--public` to make it public.

Behavior notes

- The CLI reads `%LOCALAPPDATA%\osu!\collection.db` and `%LOCALAPPDATA%\osu!\osu!.db` to resolve beatmap metadata.
- It opens a browser to authorize Spotify. After authorization it builds a best-effort match for each entry and creates the playlist.
- If the local Songs folder is available the tool will try to map md5 hashes to beatmap metadata for better matching.

Troubleshooting

- If the tool cannot read collection.db or osu!.db ensure `%LOCALAPPDATA%` or `%USERPROFILE%` are present and the files exist.
- For Spotify auth issues, verify the redirect URI in your Spotify app matches `SPOTIFY_REDIRECT_URI`.

License: MIT
