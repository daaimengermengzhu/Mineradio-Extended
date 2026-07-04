# KuGou Music Interface Notes

## Current Scope

This fork adds ordinary KuGou Music (`platform: music`) as a separate provider from KuGou Concept (`platform: lite`).

Implemented in `server.js`:

- `GET /api/kugou-music/login/status`
- `GET /api/kugou-music/login/qr/key`
- `GET /api/kugou-music/login/qr/create?key=...`
- `GET /api/kugou-music/login/qr/check?key=...`
- `POST /api/kugou-music/login/cookie`
- `GET /api/kugou-music/logout`
- `GET /api/kugou-music/search?keywords=...&limit=...`
- `GET /api/kugou-music/song/url?hash=...&albumId=...&albumAudioId=...&quality=...`
- `GET /api/kugou-music/user/playlists`
- `GET /api/kugou-music/playlist/tracks?id=...`
- `GET /api/kugou-music/lyric?hash=...&albumAudioId=...`
- `GET /api/kugou-music/song/comments?mixsongid=...`
- `GET /api/kugou-music/listen-counts?type=1`
- `POST /api/kugou-music/playlist/create`
- `POST /api/kugou-music/playlist/add-song`
- `GET /api/kugou-music/song/like/check?ids=...`
- `POST /api/kugou-music/song/like`

Implemented in `public/index.html`:

- Search tab `KGM` for ordinary KuGou Music.
- Login modal tab for ordinary KuGou Music QR login.
- Account modal display and logout for ordinary KuGou Music.
- All-source search now merges Netease, QQ, KuGou Concept, and ordinary KuGou Music.
- Ordinary KuGou Music results can request playback URLs through `/api/kugou-music/song/url`.
- User playlists, playlist details, queue loading, and the 3D playlist shelf can load ordinary KuGou Music playlists.
- Ordinary KuGou Music lyric and comment panels use ordinary KuGou Music routes.
- Ordinary KuGou Music playlist detail shows an extra `平台播放次数` sort option. It reads cumulative account listening rank data from `/api/kugou-music/listen-counts?type=1`.
- Ordinary KuGou Music heart sync, collect-to-playlist, and playlist creation use the `/api/kugou-music/*` write routes and the ordinary KuGou Music session.

## Notes

- Ordinary KuGou Music uses provider key `kugouMusic`.
- Ordinary KuGou Music login state is saved in `.kugou-music-cookie`; this is local private state and must stay ignored by Git.
- QR login uses ordinary KuGou Music app parameters (`appid = 1005`, `clientver = 20489`).
- Playback uses ordinary KuGou Music signing salts and `/v5/url`.
- Search currently uses the stable public KuGou catalog request path, then maps returned songs to `provider: 'kugouMusic'`. Login, playlists, playlist tracks, playback, lyrics, and comments still use the ordinary KuGou Music session where applicable.
- Some playlist tracks returned by ordinary KuGou Music can be readable but not playable through the ordinary `/v5/url` session. When ordinary KuGou Music returns no URL, playback falls back to KuGou Concept for the same song and returns `fallbackProvider: 'kugou'` so the UI can still play without pretending the ordinary session supplied the URL.
- Ordinary KuGou Music can also return a playable URL whose real bitrate is lower than the requested quality. The server must derive the resolved quality from the returned bitrate before displaying labels; if a higher KuGou Concept URL is available, `/api/kugou-music/song/url` returns `playbackProvider: 'kugou'` plus `originalProviderLevel` / `originalProviderQuality`.
- Platform play counts use `listenservice.kugou.com/v2/get_list`, `list_type = 1` for cumulative account listening rank, and response item field `listen_count`.
- `/api/kugou-music/listen-counts?type=1` also supplements those rank counts with paged recent play-history records from `gateway.kugou.com/playhistory/v1/get_songs`; that endpoint uses the `bp` cursor and item field `pc`.
- The play-history endpoint improves coverage but is still bounded by what KuGou returns for the current account. Playlist songs outside both sources should display `暂无` instead of a fake count.
- The listening rank endpoint itself returns the top 120 songs, not a complete account-wide per-song database.
- Ordinary KuGou Music write actions mutate the user's real account. Automated verification should avoid creating playlists, adding songs, or toggling hearts unless the user explicitly confirms.
- Platform audio effects such as KuGou sound effects, Viper, equalizer, or Dolby-style effects are not implemented yet. Current `effect` code in the UI is visual/animation behavior, not provider audio effects.
- This integration must not bypass VIP, paid music, copyright, region, or platform restrictions.

## Reference Sources

- Upstream Mineradio ordinary KuGou PR for interface facts: https://github.com/XxHuberrr/Mineradio/pull/236

## Next Steps

- Manually verify ordinary KuGou Music heart, collect-to-playlist, and playlist creation with a real account when account mutation is acceptable.
- Keep validating ordinary KuGou Music playlist track pagination and playback fallback behavior against real user playlists.
