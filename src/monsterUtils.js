// Funções puras de monstros/combate (sem acesso ao DOM nem ao estado global),
// para poderem ser testadas isoladamente.

const escapeRegExp = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "Zumbi 3" / "Zumbi (cópia)" → "Zumbi" */
export function baseMonsterName(name) {
  return String(name || 'Monstro')
    .replace(/\s*\((?:cópia)\)\s*$/i, '')
    .replace(/\s+\d+$/, '')
    .trim() || 'Monstro';
}

/** Próximo nome livre da série: Zumbi, Zumbi 2, Zumbi 3… */
export function nextMonsterCopyName(name, creatures) {
  const base = baseMonsterName(name);
  const re = new RegExp(`^${escapeRegExp(base)}(?:\\s+(\\d+))?$`, 'i');
  let max = 0;
  for (const m of creatures || []) {
    const hit = re.exec(String(m?.name || '').trim());
    if (hit) max = Math.max(max, hit[1] ? Number(hit[1]) : 1);
  }
  return `${base} ${max + 1}`;
}

/** Aplica dano (delta < 0) ou cura (delta > 0) respeitando 0..máx. Aceita HP salvo como texto. */
export function applyMonsterHpDelta(monster, delta) {
  const cap = Math.max(1, Math.round(Number(monster?.hpMax)) || 1);
  const raw = Number(monster?.hp);
  const before = Number.isFinite(raw) ? Math.max(0, Math.min(cap, Math.round(raw))) : cap;
  const after = Math.max(0, Math.min(cap, before + Math.round(Number(delta) || 0)));
  return { before, after, cap };
}

/** Monstro caído = tem vida máxima e vida atual 0. */
export function isMonsterDown(monster) {
  if (!monster) return false;
  const cap = Number(monster.hpMax) || 0;
  const hp = Number(monster.hp);
  return cap > 0 && Number.isFinite(hp) && hp <= 0;
}

/**
 * Próximo participante a agir, pulando monstros caídos.
 * rows: participantes em ordem; acted: Set de chaves já usadas; isDown(row) → boolean.
 * Retorna { next, newRound }.
 */
export function pickNextParticipant(rows, idx, acted, isDown = () => false) {
  const n = rows.length;
  for (let step = 1; step <= n; step++) {
    const cand = rows[(idx + step) % n];
    if (!acted.has(String(cand.key)) && !isDown(cand)) return { next: cand, newRound: false };
  }
  const first = rows.find(r => !isDown(r)) || rows[0];
  return { next: first, newRound: true };
}
