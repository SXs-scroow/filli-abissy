import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMusicSource, normalizeMusicLibraryEntry } from '../../src/musicSources.js';

test('detects Spotify track, album and playlist links without treating them as audio files', () => {
  assert.deepEqual(detectMusicSource('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc'), {
    provider: 'spotify', type: 'spotify', url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', id: '4uLU6hMCjMI75M1A2tKUQC', resource: 'track',
  });
  assert.equal(detectMusicSource('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M').resource, 'playlist');
});

test('detects YouTube and YouTube Music video URLs and produces an embed-safe ID', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?t=10',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  ]) {
    const source = detectMusicSource(url);
    assert.equal(source.provider, 'youtube');
    assert.equal(source.id, 'dQw4w9WgXcQ');
    assert.equal(source.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  }
});

test('accepts direct audio URLs but rejects unrelated web pages and unsafe protocols', () => {
  assert.equal(detectMusicSource('https://cdn.example.com/theme.mp3?token=abc').provider, 'audio');
  assert.equal(detectMusicSource('https://example.com/article').error, 'unsupported_url');
  assert.equal(detectMusicSource('javascript:alert(1)').error, 'invalid_url');
});

test('normalizes legacy and new library entries without losing their source type', () => {
  assert.equal(normalizeMusicLibraryEntry({ url: 'https://youtu.be/dQw4w9WgXcQ' }).provider, 'youtube');
  assert.equal(normalizeMusicLibraryEntry({ url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', title: 'Track' }).type, 'spotify');
  assert.equal(normalizeMusicLibraryEntry({ url: 'https://cdn.example.com/a.mp3', kind: 'url' }).provider, 'audio');
});
