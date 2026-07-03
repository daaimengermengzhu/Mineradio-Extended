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

Implemented in `public/index.html`:

- Search tab `KGM` for ordinary KuGou Music.
- Login modal tab for ordinary KuGou Music QR login.
- Account modal display and logout for ordinary KuGou Music.
- All-source search now merges Netease, QQ, KuGou Concept, and ordinary KuGou Music.
- Ordinary KuGou Music results can request playback URLs through `/api/kugou-music/song/url`.
- User playlists, playlist details, queue loading, and the 3D playlist shelf can load ordinary KuGou Music playlists.
- Ordinary KuGou Music lyric and comment panels use ordinary KuGou Music routes.

## Notes

- Ordinary KuGou Music uses provider key `kugouMusic`.
- Ordinary KuGou Music login state is saved in `.kugou-music-cookie`; this is local private state and must stay ignored by Git.
- QR login uses ordinary KuGou Music app parameters (`appid = 1005`, `clientver = 20489`).
- Playback uses ordinary KuGou Music signing salts and `/v5/url`.
- Search currently uses the stable public KuGou catalog request path, then maps returned songs to `provider: 'kugouMusic'`. Login, playlists, playlist tracks, playback, lyrics, and comments still use the ordinary KuGou Music session where applicable.
- Write actions are intentionally deferred for this first phase. Heart sync, collect-to-playlist, and playlist creation for ordinary KuGou Music should not be wired until the read/play path is verified with real account login.
- This integration must not bypass VIP, paid music, copyright, region, or platform restrictions.

## Reference Sources

- Upstream Mineradio ordinary KuGou PR for interface facts: https://github.com/XxHuberrr/Mineradio/pull/236

## Next Steps

- Verify QR login with a real ordinary KuGou Music account.
- After login is verified, test account playlists and playlist track pagination.
- Only after read/play is stable, evaluate ordinary KuGou Music write routes for heart, collect, and playlist creation.
