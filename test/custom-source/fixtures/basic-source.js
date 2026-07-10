/**
 * @name Mineradio Test Source
 * @description Local compatibility fixture
 * @version 1.0.0
 * @author Mineradio
 */
if (globalThis.lx) (async () => {
  if (typeof require !== 'undefined' || typeof process !== 'undefined') throw new Error('sandbox escape');
  if (globalThis.lx.utils.crypto.md5('abc') !== '900150983cd24fb0d6963f7d28e17f72') throw new Error('crypto bridge failed');
  let directNetworkBlocked = false;
  try { await fetch('https://example.com/direct-network-must-be-blocked'); }
  catch { directNetworkBlocked = true; }
  if (!directNetworkBlocked) throw new Error('direct network was not blocked');

  const { EVENT_NAMES, on, send } = globalThis.lx;
  await on(EVENT_NAMES.request, ({ source, action, info }) => {
    if (action !== 'musicUrl') throw new Error('unsupported action');
    const id = source === 'kg' ? info.musicInfo.hash : info.musicInfo.meta.songId;
    return `https://audio.example.com/${source}/${id}/${info.type}.mp3`;
  });
  await send(EVENT_NAMES.inited, {
    sources: {
      wy: { name: 'WY', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k', 'flac'] },
      kg: { name: 'KG', type: 'music', actions: ['musicUrl'], qualitys: ['128k', 'flac'] },
    },
  });
})().catch(error => { throw error; });
