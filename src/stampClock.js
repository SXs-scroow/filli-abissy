let floor = 0;
const STAMP_MAX = 4102444800000;

export function observeStamp(v) {
  const n = Number(v);
  if (Number.isFinite(n) && n > floor && n < STAMP_MAX) floor = n;
}
export function nextStamp() { return Math.max(Date.now(), floor + 1); }
export function stampFloorValue() { return floor; }
export function resetStampClock() { floor = 0; }

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
