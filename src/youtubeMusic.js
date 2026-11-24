/**
 * YouTube / YouTube Music nas trilhas pessoais.
 *
 * Usa somente o player oficial (IFrame Player API). Nada é baixado nem convertido, e o vídeo
 * permanece visível, como exigem as políticas do YouTube para players incorporados.
 */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const LIST_RE = /^[A-Za-z0-9_-]{10,64}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);

function parseStart(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Math.min(Number(raw), 86400);
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return 0;
  return Math.min((Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0), 86400);
}

/** Lê links do YouTube e do YouTube Music. Devolve { kind, id, list, start, music } ou null. */
export function parseYouTubeUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  const music = host === 'music.youtube.com';
  const list = url.searchParams.get('list') || '';
  const start = parseStart(url.searchParams.get('t') || url.searchParams.get('start'));
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/')[1] || '';
  else if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
  else {
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    if (m) id = m[1];
  }
  const validList = LIST_RE.test(list) && !/^RD/.test(list) ? list : '';
  if (ID_RE.test(id)) return { kind: 'video', id, list: validList, start, music };
  if (url.pathname === '/playlist' && validList) return { kind: 'playlist', id: '', list: validList, start: 0, music };
  return null;
}

export function youtubeWatchUrl(parsed) {
  if (!parsed) return '';
  const base = parsed.music ? 'https://music.youtube.com' : 'https://www.youtube.com';
  if (parsed.kind === 'playlist') return `${base}/playlist?list=${encodeURIComponent(parsed.list)}`;
  return `${base}/watch?v=${encodeURIComponent(parsed.id)}${parsed.list ? `&list=${encodeURIComponent(parsed.list)}` : ''}`;
}

let apiPromise = null;
/** Carrega a API oficial uma única vez. Rejeita se não carregar a tempo (rede ou bloqueio). */
export function loadYouTubeApi({ doc = globalThis.document, win = globalThis.window, timeoutMs = 12000 } = {}) {
  if (win?.YT?.Player) return Promise.resolve(win.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { apiPromise = null; reject(new Error('YT_TIMEOUT')); }, timeoutMs);
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      try { previous?.(); } catch { /* ignora */ }
      resolve(win.YT);
    };
    const script = doc.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { clearTimeout(timer); apiPromise = null; reject(new Error('YT_BLOCKED')); };
    doc.head.appendChild(script);
  });
  return apiPromise;
}

/**
 * Adaptador com a mesma forma de um HTMLAudioElement (play, pause, currentTime, duration, volume,
 * loop, paused, ontimeupdate, onended, onerror), para que os controles da trilha pessoal funcionem igual.
 */
export function createYouTubeAudio(YT, mount, parsed, { volume = 0.85, host = 'https://www.youtube-nocookie.com', pollMs = 500, playTimeoutMs = 3500 } = {}) {
  const S = YT.PlayerState || { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
  let state = S.UNSTARTED;
  let ready = false;
  let destroyed = false;
  let wantVolume = Math.max(0, Math.min(1, volume));
  let loop = false;
  const waiters = new Set();
  let player = null;

  const adapter = {
    src: '', ontimeupdate: null, onended: null, onerror: null, onstatechange: null,
    get paused() { return state !== S.PLAYING && state !== S.BUFFERING; },
    get currentTime() { try { return Number(player?.getCurrentTime?.()) || 0; } catch { return 0; } },
    set currentTime(v) { try { player?.seekTo?.(Math.max(0, Number(v) || 0), true); } catch { /* ignora */ } },
    get duration() { try { return Number(player?.getDuration?.()) || 0; } catch { return 0; } },
    get volume() { return wantVolume; },
    set volume(v) { wantVolume = Math.max(0, Math.min(1, Number(v) || 0)); if (ready) { try { player.setVolume(Math.round(wantVolume * 100)); } catch { /* ignora */ } } },
    get loop() { return loop; },
    set loop(v) { loop = !!v; },
    get destroyed() { return destroyed; },
    play() {
      if (destroyed) return Promise.reject(new Error('DESTROYED'));
      return new Promise((resolve, reject) => {
        if (state === S.PLAYING) { resolve(); return; }
        const waiter = { resolve, reject, timer: setTimeout(() => { waiters.delete(waiter); reject(new Error('AUTOPLAY_BLOCKED')); }, playTimeoutMs) };
        waiters.add(waiter);
        try { if (ready) player.playVideo(); } catch { /* o evento onReady tenta de novo */ }
      });
    },
    pause() { try { player?.pauseVideo?.(); } catch { /* ignora */ } },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(poll);
      for (const w of waiters) { clearTimeout(w.timer); w.reject(new Error('DESTROYED')); }
      waiters.clear();
      try { player?.destroy?.(); } catch { /* ignora */ }
    },
  };

  const onStateChange = (event) => {
    state = Number(event?.data);
    if (state === S.PLAYING) {
      for (const w of waiters) { clearTimeout(w.timer); w.resolve(); }
      waiters.clear();
    }
    if (state === S.ENDED) {
      if (loop && parsed.kind === 'video') { try { player.seekTo(0, true); player.playVideo(); } catch { /* ignora */ } }
      else adapter.onended?.();
    }
    adapter.onstatechange?.(state);
  };
  const onError = (event) => {
    const code = Number(event?.data);
    adapter.onerror?.({ code, embedBlocked: code === 101 || code === 150, notFound: code === 100 || code === 2 });
  };

  const vars = { playsinline: 1, controls: 1, rel: 0, fs: 0, iv_load_policy: 3, enablejsapi: 1, origin: globalThis.location?.origin };
  if (parsed.start) vars.start = parsed.start;
  const options = { host, width: '100%', height: '100%', playerVars: vars, events: {
    onReady: () => {
      ready = true;
      try { player.setVolume(Math.round(wantVolume * 100)); } catch { /* ignora */ }
      if (waiters.size) { try { player.playVideo(); } catch { /* ignora */ } }
    },
    onStateChange, onError,
  } };
  if (parsed.kind === 'playlist') { vars.listType = 'playlist'; vars.list = parsed.list; }
  else { options.videoId = parsed.id; if (parsed.list) vars.list = parsed.list; }
  player = new YT.Player(mount, options);
  const poll = setInterval(() => { if (!destroyed && state === S.PLAYING) adapter.ontimeupdate?.(); }, pollMs);
  return adapter;
}
