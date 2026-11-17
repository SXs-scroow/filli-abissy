const AUDIO_EXTENSIONS = new Set(['mp3', 'mpeg', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'webm']);
const SPOTIFY_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function invalid(error) { return { provider: 'unsupported', error }; }

export function detectMusicSource(input) {
  const raw = String(input || '').trim();
  if (!raw) return invalid('empty_url');
  let url;
  try { url = new URL(raw); } catch { return invalid('invalid_url'); }
  if (!['http:', 'https:'].includes(url.protocol)) return invalid('invalid_url');

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'open.spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const offset = parts[0] === 'intl-en' || parts[0] === 'intl-pt' ? 1 : 0;
    const resource = parts[offset]?.toLowerCase();
    const id = parts[offset + 1];
    if (!SPOTIFY_TYPES.has(resource) || !id || !/^[A-Za-z0-9]+$/.test(id)) return invalid('invalid_spotify_url');
    return { provider: 'spotify', type: 'spotify', url: `https://open.spotify.com/${resource}/${id}`, id, resource };
  }

  if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
    else {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1] || '';
    }
    if (!VIDEO_ID.test(id)) return invalid('invalid_youtube_url');
    return { provider: 'youtube', type: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, id };
  }

  const extension = url.pathname.split('.').pop()?.toLowerCase();
  if (AUDIO_EXTENSIONS.has(extension)) return { provider: 'audio', type: 'audio', url: url.href, id: '', resource: 'file' };
  return invalid('unsupported_url');
}

export function normalizeMusicLibraryEntry(entry = {}) {
  const detected = detectMusicSource(entry.url);
  if (detected.error) return { ...entry, provider: entry.provider || 'audio', type: entry.type || 'audio' };
  return { ...entry, ...detected, title: String(entry.title || ''), kind: entry.kind || (detected.provider === 'audio' ? 'url' : detected.provider) };
}
