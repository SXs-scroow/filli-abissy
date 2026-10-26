/**
 * Diagnóstico de cache/inicialização da versão publicada.
 * Faz somente uma leitura do HTML de entrada com cache desabilitado; não altera dados.
 */
export async function runDeploymentCacheCheck({
  fetchImpl = globalThis.fetch,
  locationObj = globalThis.location,
  buildInfo = globalThis.window?.__ASHEN_BUILD_INFO__ || null,
  serviceWorkerController = globalThis.navigator?.serviceWorker?.controller || null,
} = {}) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
  const buildId = buildInfo?.buildId || 'indisponível';
  const release = buildInfo?.release || 'indisponível';

  add('Identificação da compilação carregada', Boolean(buildInfo?.buildId), `release=${release}; build=${buildId}`);
  if (typeof fetchImpl !== 'function' || !locationObj?.origin) {
    add('Leitura atualizada do HTML', false, 'fetch ou origem da página indisponível');
    return { ok: false, checks, buildId, release, at: Date.now() };
  }

  try {
    const response = await fetchImpl(`${locationObj.origin}/`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      credentials: 'same-origin',
    });
    const html = await response.text();
    const cacheControl = response.headers?.get?.('cache-control') || '';
    const shellLooksValid = /<title>\s*Ashen Testimony\s*<\/title>/i.test(html)
      && (/<script[^>]+src=["'][^"']*\/src\/main\.js["']/i.test(html)
        || /<script[^>]+src=["'][^"']*\/assets\/[^"']+\.js["']/i.test(html));
    add('HTML de entrada responde', response.ok, `HTTP ${response.status}`);
    add('HTML identifica o Ashen Testimony e aponta para o JavaScript', shellLooksValid,
      shellLooksValid ? 'estrutura de entrada reconhecida' : 'título ou referência principal não reconhecidos');
    add('HTML configurado para não ficar preso em cache', /no-store/i.test(cacheControl) && /no-cache/i.test(cacheControl),
      cacheControl || 'cabeçalho Cache-Control ausente');
  } catch (error) {
    add('Leitura atualizada do HTML', false, String(error?.message || error));
  }

  add('Service worker não está prendendo a sessão em uma versão antiga', !serviceWorkerController,
    serviceWorkerController ? 'há um service worker controlando a página; investigar antes de concluir' : 'nenhum service worker controla esta página');
  return { ok: checks.every((check) => check.ok), checks, buildId, release, at: Date.now() };
}
