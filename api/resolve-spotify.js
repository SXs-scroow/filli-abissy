// Resolve links curtos do Spotify (spotify.link, spoti.fi, open.spotify.com/s/...) para o link final.
const ALLOWED_INPUT = /^https?:\/\/(open\.spotify\.com\/s\/|spotify\.link\/|spoti\.fi\/)/i;
const ALLOWED_FINAL = /^https:\/\/open\.spotify\.com\//i;

export default async function handler(req, res) {
  const raw = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
  const url = String(raw || '');
  if (!ALLOWED_INPUT.test(url)) return res.status(400).json({ error: 'invalid_url' });
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (!ALLOWED_FINAL.test(r.url)) return res.status(502).json({ error: 'resolve_failed' });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ url: r.url });
  } catch {
    return res.status(502).json({ error: 'resolve_failed' });
  }
}
