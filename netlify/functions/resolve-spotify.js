export default async (req) => {
  const url = new URL(req.url).searchParams.get('url') || '';
  if (!/^https?:\/\/(open\.spotify\.com\/s\/|spotify\.link\/|spoti\.fi\/)/i.test(url)) {
    return new Response(JSON.stringify({ error: 'invalid_url' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return new Response(JSON.stringify({ url: res.url }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'resolve_failed' }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
};
