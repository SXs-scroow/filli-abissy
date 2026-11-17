const NUMBER_WORDS = new Map([
  ['um', 1], ['uma', 1], ['dois', 2], ['duas', 2], ['tres', 3], ['quatro', 4],
  ['cinco', 5], ['seis', 6], ['sete', 7], ['oito', 8], ['nove', 9], ['dez', 10],
]);

function cleanName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N} .'-]/gu, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(?:o|a|do|da|dos|das)\s+/i, '').slice(0, 80);
}

function amountValue(value) {
  const raw = String(value || '').toLocaleLowerCase('pt-BR');
  return /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS.get(raw) || 0;
}

export function parseSessionCommand(transcript) {
  let text = String(transcript || '').trim().replace(/[.!?]+$/, '');
  if (!text || text.length > 240) return null;
  text = text.replace(/^ashen[,:;\s]+/i, '').trim();
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = text.match(/^(?<name>[^,]{1,80}?)(?:,\s*|\s+)(?:(?:voce|tu)\s+)?(?<verb>perde|perdeu|retira|retire|tira|tire|recebe|recupera|recupere|ganha|ganhe)\s+(?<amount>\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:pontos?\s+de\s+vida|pv)\b/i);
  if (!match?.groups) return null;
  const targetName = cleanName(match.groups.name);
  const amount = amountValue(match.groups.amount);
  if (!targetName || !amount || amount > 100) return null;
  const verb = match.groups.verb.toLocaleLowerCase('pt-BR');
  const positive = ['recebe', 'recupera', 'recupere', 'ganha', 'ganhe'].includes(verb);
  return { type: 'hp', targetName, delta: positive ? amount : -amount, resource: 'hp', requiresConfirmation: true };
}

export function resolveSessionTarget(name, players = []) {
  const normalized = cleanName(name).toLocaleLowerCase('pt-BR');
  const matches = (Array.isArray(players) ? players : []).filter((player) => {
    if (!player || player.deletedAt || player._deleted || player.deleted_at) return false;
    return cleanName(player.name).toLocaleLowerCase('pt-BR') === normalized;
  });
  if (!matches.length) return { status: 'missing', matches: [] };
  if (matches.length > 1) return { status: 'ambiguous', matches };
  return { status: 'found', target: matches[0], matches };
}

export function calculateHpChange(currentHp, maxHp, delta) {
  const current = Number(currentHp);
  const maximum = Number(maxHp);
  const change = Number(delta);
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || !Number.isFinite(change) || maximum < 0) return null;
  const hp = Math.max(0, Math.min(maximum, current + change));
  return { previousHp: current, hp, appliedDelta: hp - current };
}
