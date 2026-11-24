import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTubeUrl, youtubeWatchUrl, createYouTubeAudio } from '../../src/youtubeMusic.js';

test('reconhece links do YouTube e do YouTube Music', () => {
  const id = 'dQw4w9WgXcQ';
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}`, `https://music.youtube.com/watch?v=${id}&si=abc`,
    `https://m.youtube.com/watch?v=${id}`, `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`, `  https://youtu.be/${id}?t=42  `,
  ]) assert.equal(parseYouTubeUrl(url)?.id, id, url);
  assert.equal(parseYouTubeUrl(`https://music.youtube.com/watch?v=${id}`).music, true);
  assert.equal(parseYouTubeUrl(`https://www.youtube.com/watch?v=${id}`).music, false);
});

test('lê o ponto de início e playlists, ignorando mixes automáticos', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(parseYouTubeUrl(`https://youtu.be/${id}?t=90`).start, 90);
  assert.equal(parseYouTubeUrl(`https://youtu.be/${id}?t=1m30s`).start, 90);
  assert.equal(parseYouTubeUrl(`https://www.youtube.com/watch?v=${id}&list=PLabcdefghij123&start=5`).list, 'PLabcdefghij123');
  assert.equal(parseYouTubeUrl(`https://www.youtube.com/watch?v=${id}&list=RDdQw4w9WgXcQ`).list, '');
  const pl = parseYouTubeUrl('https://music.youtube.com/playlist?list=PLabcdefghij123');
  assert.deepEqual([pl.kind, pl.list, pl.music], ['playlist', 'PLabcdefghij123', true]);
});

test('recusa o que não é YouTube e ids inválidos', () => {
  for (const bad of ['', 'abc', 'https://open.spotify.com/track/123', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=curto',
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://www.youtube.com/', 'https://exemplo.com/musica.mp3', null, undefined])
    assert.equal(parseYouTubeUrl(bad), null, String(bad));
});

test('monta o link para abrir no app de origem', () => {
  assert.equal(youtubeWatchUrl(parseYouTubeUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')), 'https://music.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(youtubeWatchUrl(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

/** YT.Player falso, que deixa o teste disparar os eventos do player oficial. */
function fakeYT() {
  const made = [];
  class Player {
    constructor(mount, options) { this.mount = mount; this.options = options; this.calls = []; this.time = 0; made.push(this); }
    playVideo() { this.calls.push('play'); } pauseVideo() { this.calls.push('pause'); }
    seekTo(s) { this.calls.push(['seek', s]); this.time = s; } setVolume(v) { this.calls.push(['vol', v]); }
    getCurrentTime() { return this.time; } getDuration() { return 200; } destroy() { this.calls.push('destroy'); }
    emit(data) { this.options.events.onStateChange({ data }); }
  }
  return { YT: { Player, PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } }, made };
}

test('o adaptador se comporta como um Audio: play, pause, tempo, volume, duração', async () => {
  const { YT, made } = fakeYT();
  const a = createYouTubeAudio(YT, {}, parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=30'), { volume: 0.5, pollMs: 5 });
  const p = made[0];
  assert.equal(p.options.videoId, 'dQw4w9WgXcQ');
  assert.equal(p.options.playerVars.start, 30);
  assert.equal(p.options.host, 'https://www.youtube-nocookie.com');
  assert.equal(a.paused, true);
  const playing = a.play();
  p.options.events.onReady();
  assert.ok(p.calls.includes('play'));
  assert.deepEqual(p.calls.find((c) => Array.isArray(c) && c[0] === 'vol'), ['vol', 50]);
  p.emit(1);
  await playing;
  assert.equal(a.paused, false);
  a.currentTime = 0; assert.deepEqual(p.calls.at(-1), ['seek', 0]);
  a.volume = 0.2; assert.deepEqual(p.calls.at(-1), ['vol', 20]);
  assert.equal(a.duration, 200);
  let ticks = 0; a.ontimeupdate = () => { ticks += 1; };
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(ticks >= 1);
  a.pause(); p.emit(2); assert.equal(a.paused, true);
  a.destroy(); assert.ok(p.calls.includes('destroy'));
});

test('autoplay bloqueado rejeita o play, e fim da faixa chama onended', async () => {
  const { YT, made } = fakeYT();
  const a = createYouTubeAudio(YT, {}, parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), { playTimeoutMs: 20, pollMs: 1000 });
  made[0].options.events.onReady();
  await assert.rejects(a.play(), /AUTOPLAY_BLOCKED/);
  let ended = 0; a.onended = () => { ended += 1; };
  made[0].emit(0);
  assert.equal(ended, 1);
  a.destroy();
});

test('loop reinicia a faixa em vez de encerrar', () => {
  const { YT, made } = fakeYT();
  const a = createYouTubeAudio(YT, {}, parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), { pollMs: 1000 });
  let ended = 0; a.onended = () => { ended += 1; }; a.loop = true;
  made[0].emit(0);
  assert.equal(ended, 0);
  assert.deepEqual(made[0].calls.filter((c) => Array.isArray(c) && c[0] === 'seek').at(-1), ['seek', 0]);
  a.destroy();
});

test('erro 101 e 150 indicam que o vídeo não pode ser incorporado', () => {
  const { YT, made } = fakeYT();
  const a = createYouTubeAudio(YT, {}, parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), { pollMs: 1000 });
  const errors = []; a.onerror = (e) => errors.push(e);
  made[0].options.events.onError({ data: 150 });
  made[0].options.events.onError({ data: 100 });
  assert.equal(errors[0].embedBlocked, true);
  assert.equal(errors[1].embedBlocked, false);
  assert.equal(errors[1].notFound, true);
  a.destroy();
});

test('o site toca links do YouTube nas trilhas pessoais e a política de segurança permite o player', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(app, /const yt=parseYouTubeUrl\(src\);\s*if\(yt\)\{await playYoutubePersonal/);
  assert.match(app, /!!parseYouTubeUrl\(t\?\.url\)/);
  assert.match(app, /removeYoutubeHost\(\);/);
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /script-src[^;]*https:\/\/www\.youtube\.com/);
  assert.match(csp, /frame-src[^;]*https:\/\/www\.youtube-nocookie\.com/);
  assert.match(csp, /frame-src[^;]*https:\/\/www\.youtube\.com/);
});
