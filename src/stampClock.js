// ===== Relógio dos carimbos de sincronização (V1.5.3) =====
// Antes, todo carimbo (_syncUpdatedAt, _pointsAt, _keyAt) era `Date.now()` do aparelho. Um celular com a hora
// atrasada (ou com a data errada) gerava carimbos MENORES que os do servidor: o salvamento dele perdia a
// disputa e os pontos voltavam ou ficavam travados — só naquele aparelho.
// Agora todo carimbo novo é MAIOR que o maior carimbo já visto (relógio lógico híbrido): uma edição feita
// DEPOIS de ver os dados do servidor sempre vence, mesmo com a hora do aparelho errada.
let floor = 0;
const STAMP_MAX = 4102444800000; // 01/01/2100: acima disso é lixo e não pode virar piso

export function observeStamp(v) {
  const n = Number(v);
  if (Number.isFinite(n) && n > floor && n < STAMP_MAX) floor = n;
}
export function nextStamp() { return Math.max(Date.now(), floor + 1); }
export function stampFloorValue() { return floor; }
export function resetStampClock() { floor = 0; }

// Aceita linhas do servidor ({data,updated_at}) ou fichas soltas ({_syncUpdatedAt,_pointsAt,_keyAt}).
export function observePlayerStamps(list) {
  try {
    for (const item of Array.isArray(list) ? list : []) {
      if (!item || typeof item !== 'object') continue;
      const d = item.data && typeof item.data === 'object' ? item.data : item;
      observeStamp(d._syncUpdatedAt);
      observeStamp(d._pointsAt);
      if (item.updated_at) observeStamp(Date.parse(item.updated_at));
      const ks = d._keyAt;
      if (ks && typeof ks === 'object') for (const v of Object.values(ks)) observeStamp(v);
    }
  } catch { /* observar carimbos nunca pode derrubar o sync */ }
}
