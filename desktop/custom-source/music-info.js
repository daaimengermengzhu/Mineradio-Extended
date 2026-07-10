function providerName(song) {
  return String(song?.provider || song?.source || song?.type || '').toLowerCase();
}

function platformKey(song) {
  const provider = providerName(song);
  if (provider === 'qq' || provider === 'tx') return 'tx';
  if (provider === 'netease' || provider === 'wy') return 'wy';
  if (provider === 'kugou' || provider === 'kugoumusic' || provider === 'kg') return 'kg';
  return null;
}

function formatSeconds(rawSeconds) {
  const seconds = Math.max(0, Number(rawSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function songDurationSeconds(song, source) {
  const value = Number(song?.duration ?? song?.dt ?? song?.interval) || 0;
  if ((source === 'wy' || source === 'kg') && (song?.duration != null || song?.dt != null)) return value / 1000;
  return value > 10_000 ? value / 1000 : value;
}

function artistText(value) {
  if (Array.isArray(value)) {
    return value.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean).join('、');
  }
  return String(value || '');
}

function albumName(song) {
  if (song?.album && typeof song.album === 'object') return String(song.album.name || '');
  return String(song?.album || song?.albumName || '');
}

function toLxMusicInfo(song) {
  const source = platformKey(song);
  if (!source) throw new Error('SOURCE_UNSUPPORTED: Unknown Mineradio provider');

  const albumId = song?.albumMid || song?.album_mid || song?.albumId || song?.album_id || '';
  const name = String(song?.name || song?.title || '');
  const singer = artistText(song?.artist || song?.artists || song?.singer);
  const interval = formatSeconds(songDurationSeconds(song, source));
  const cover = song?.cover || song?.picUrl || null;

  if (source === 'kg') {
    const hash = String(song?.hash || song?.songmid || song?.id || '').trim().toLowerCase();
    if (!hash) throw new Error('SOURCE_UNSUPPORTED: Missing KuGou hash');
    const albumAudioId = song?.albumAudioId || song?.album_audio_id || '';
    return {
      id: String(song?.id ?? hash),
      name,
      singer,
      source,
      interval,
      hash,
      songmid: hash,
      albumId,
      albumAudioId,
      meta: {
        songId: song?.id ?? hash,
        albumName: albumName(song),
        albumId,
        albumAudioId,
        hash,
        picUrl: cover,
        qualitys: [],
        _qualitys: {},
      },
    };
  }

  const songId = source === 'tx'
    ? (song?.mid || song?.songmid || song?.id)
    : song?.id;
  if (songId == null || songId === '') throw new Error('SOURCE_UNSUPPORTED: Missing song id');
  const meta = {
    songId,
    albumName: albumName(song),
    albumId,
    picUrl: cover,
    qualitys: [],
    _qualitys: {},
  };
  if (source === 'tx') {
    meta.strMediaMid = String(song?.mediaMid || song?.media_mid || song?.strMediaMid || song?.songId || songId);
    meta.id = Number(song?.qqId || song?.songId || 0) || undefined;
    meta.albumMid = String(song?.albumMid || song?.album_mid || albumId);
  }
  return {
    id: String(song?.id ?? songId),
    name,
    singer,
    source,
    interval,
    meta,
    songmid: songId,
    albumId,
    strMediaMid: meta.strMediaMid || '',
    copyrightId: '',
    hash: '',
  };
}

module.exports = { platformKey, formatSeconds, toLxMusicInfo };
