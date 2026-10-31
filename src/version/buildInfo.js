/**
 * Identificação da compilação injetada pelo Vite.
 * Ajuda a confirmar qual deploy um navegador está executando sem expor dados privados.
 */
export const BUILD_ID = typeof __ASHEN_BUILD_ID__ !== 'undefined'
  ? String(__ASHEN_BUILD_ID__)
  : 'build-id-unavailable';

export const APP_RELEASE = 'V1.5.61';

try {
  window.__ASHEN_BUILD_INFO__ = Object.freeze({
    release: APP_RELEASE,
    buildId: BUILD_ID,
    loadedAt: new Date().toISOString()
  });
  console.info('[Ashen Testimony] build info:', window.__ASHEN_BUILD_INFO__);
} catch {
  // Permite importar este módulo em ambientes de teste sem window.
}
