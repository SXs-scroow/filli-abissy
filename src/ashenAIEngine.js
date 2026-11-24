const MAX_MESSAGE_LENGTH = 6000;
const MAX_HISTORY = 20;
const ACTION_TYPES = new Set([
  'change_resource', 'set_initiative', 'advance_turn', 'set_condition',
  'remove_condition', 'manage_inventory', 'record_campaign_event', 'save_memory', 'archive_memory'
]);
const ARCHIVE_KINDS = new Set(['event', 'session', 'character', 'location', 'evidence', 'death', 'document']);
const MEMORY_CATEGORIES = new Set(['fact', 'event', 'character', 'location', 'clue', 'preference']);
const TRAINED_ONLY_SKILLS = new Set(['Adestramento','Artes','Ciências','Crime','Ocultismo','Pilotagem','Profissão','Religião','Tática','Tecnologia']);
const SKILL_ATTRIBUTE_MAP = Object.freeze({
  'Acrobacia':'Agilidade','Furtividade':'Agilidade','Iniciativa':'Agilidade','Reflexo':'Agilidade','Crime':'Agilidade','Pontaria':'Agilidade','Pilotagem':'Agilidade','Esquiva':'Agilidade',
  'Atletismo':'Força','Luta':'Força','Armas Brancas':'Força','Fortitude':'Corpo','Resistência':'Corpo','Tolerância à Dor':'Tolerância à Dor',
  'Percepção':'Percepção','Intuição':'Percepção','Caça':'Percepção','Rastreamento':'Percepção','Adestramento':'Lábia','Artes':'Lábia','Diplomacia':'Lábia','Enganação':'Lábia','Intimidação':'Lábia','Persuasão':'Lábia','Empatia':'Lábia','Liderança':'Lábia',
  'Vontade':'Determinação','Concentração':'Determinação','Resistência Mental':'Sanidade','Religião':'Fé','Rituais':'Fé','Ocultismo':'Conhecimento','Atualidades':'Conhecimento','Ciências':'Conhecimento','Investigação':'Conhecimento','Medicina':'Conhecimento','Profissão':'Conhecimento','Tática':'Conhecimento','Tecnologia':'Conhecimento','Sobrevivência':'Conhecimento','Alquimia':'Conhecimento','História':'Conhecimento','Herbalismo':'Conhecimento','Armadilhas':'Conhecimento'
});

function boundedString(value, max = 240) { return String(value ?? '').trim().slice(0, max); }
function safeNumber(value, fallback = 0, min = -100000, max = 100000) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function safeMap(value, limit = 40) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, limit).map(([key, val]) => [boundedString(key, 80), safeNumber(val, 0, -999, 999)]));
}
function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
function matchByIdOrName(list, target, idKey = 'id') {
  const wanted = boundedString(target, 180);
  if (!wanted) return null;
  const exact = list.filter(item => String(item?.[idKey] ?? '') === wanted);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const normalized = normalizeSearch(wanted);
  const named = list.filter(item => normalizeSearch(item?.name) === normalized);
  return named.length === 1 ? named[0] : null;
}
function allTargets(context) {
  return [
    ...(context.players || []).map(item => ({ ...item, targetType: 'player' })),
    ...(context.monsters || []).map(item => ({ ...item, targetType: 'monster' }))
  ];
}

export function cleanAshenMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const clean = messages.slice(-MAX_HISTORY).map(message => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: String(message?.content || '').slice(0, MAX_MESSAGE_LENGTH).trim()
  })).filter(message => message.content);
  while (clean.length && clean[0].role !== 'user') clean.shift();
  return clean;
}

export function sanitizeAshenContext(input = {}) {
  const players = Array.isArray(input.players) ? input.players.slice(0, 40).map(player => ({
    id: boundedString(player?.id || player?.login, 120),
    name: boundedString(player?.name || player?.login || 'Player', 100),
    class: boundedString(player?.class, 80),
    campaignType: boundedString(player?.campaignType, 30),
    hp: safeNumber(player?.hp), hpMax: safeNumber(player?.hpMax),
    sanity: safeNumber(player?.sanity), sanityMax: safeNumber(player?.sanityMax),
    attrs: safeMap(player?.attrs), skills: safeMap(player?.skills),
    classAbilities: Array.isArray(player?.classAbilities) ? player.classAbilities.slice(0, 20).map(x => boundedString(x, 500)) : [],
    description: boundedString(player?.description, 1200), history: boundedString(player?.history, 1600),
    personality: boundedString(player?.personality, 600), fears: boundedString(player?.fears, 600),
    hunger: safeNumber(player?.hunger, 100, 0, 100),
    conditions: Array.isArray(player?.conditions) ? player.conditions.slice(0, 20).map(x => boundedString(x, 100)) : [],
    backpack: Array.isArray(player?.backpack) ? player.backpack.slice(0, 40).map(item => ({
      id: safeNumber(item?.id, 0, 0, 100000), name: boundedString(item?.name, 100), qty: safeNumber(item?.qty, 1, 1, 999)
    })) : []
  })) : [];
  const participants = Array.isArray(input.participants) ? input.participants.slice(0, 50).map(participant => ({
    key: boundedString(participant?.key, 180), kind: participant?.kind === 'monster' ? 'monster' : 'player',
    name: boundedString(participant?.name, 100), initiative: safeNumber(participant?.initiative, 0, -99, 999),
    hidden: participant?.hidden === true
  })) : [];
  const monsters = Array.isArray(input.monsters) ? input.monsters.slice(0, 40).map(monster => ({
    id: boundedString(monster?.id, 120), name: boundedString(monster?.name || 'Monstro', 100),
    hp: safeNumber(monster?.hp), hpMax: safeNumber(monster?.hpMax),
    sanity: safeNumber(monster?.sanity), sanityMax: safeNumber(monster?.sanityMax),
    attack: safeNumber(monster?.attack), defense: safeNumber(monster?.defense),
    attrs: safeMap(monster?.attrs), skills: safeMap(monster?.skills),
    damage: boundedString(monster?.damage, 80),
    description: boundedString(monster?.description, 1000),
    abilities: Array.isArray(monster?.abilities) ? monster.abilities.slice(0, 20).map(x => boundedString(x, 500)) : [],
    conditions: Array.isArray(monster?.conditions) ? monster.conditions.slice(0, 20).map(x => boundedString(x, 100)) : []
  })) : [];
  const archive = Array.isArray(input.archive) ? input.archive.slice(0, 80).map(record => ({
    id: boundedString(record?.id, 180), title: boundedString(record?.title, 180), kind: boundedString(record?.kind, 40),
    location: boundedString(record?.location, 140), content: boundedString(record?.content, 2400),
    tags: Array.isArray(record?.tags) ? record.tags.slice(0, 20).map(x => boundedString(x, 48)) : [],
    occurred_at: boundedString(record?.occurred_at || record?.occurredAt, 40)
  })) : [];
  const memories = Array.isArray(input.memories) ? input.memories.slice(0, 40).map(memory => ({
    id: boundedString(memory?.id, 180), title: boundedString(memory?.title, 180),
    content: boundedString(memory?.content, 2400), category: boundedString(memory?.category, 30),
    importance: safeNumber(memory?.importance, 3, 1, 5), created_at: boundedString(memory?.created_at, 40)
  })) : [];
  const items = Array.isArray(input.items) ? input.items.slice(0, 180).map(item => ({
    id: safeNumber(item?.id, 0, 0, 100000), name: boundedString(item?.name, 100),
    category: boundedString(item?.category, 60), description: boundedString(item?.description, 500),
    damage: boundedString(item?.damage, 40), maxQty: safeNumber(item?.maxQty, 99, 1, 999), weight: safeNumber(item?.weight, 1, 1, 3)
  })) : [];
  const spells = Array.isArray(input.spells) ? input.spells.slice(0, 120).map(spell => ({
    id: boundedString(spell?.id, 120), name: boundedString(spell?.name || spell?.title, 160),
    description: boundedString(spell?.description || spell?.effect, 900), cost: boundedString(spell?.cost, 100),
    element: boundedString(spell?.element, 80), type: boundedString(spell?.type, 80)
  })) : [];
  const rules = input.rules && typeof input.rules === 'object' ? {
    skillRollMode: boundedString(input.rules.skillRollMode, 20),
    campaign: boundedString(input.rules.campaign, 1200), slasher: boundedString(input.rules.slasher, 1200),
    bookTitle: boundedString(input.rules.bookTitle, 180), bookAvailable: input.rules.bookAvailable === true
  } : {};
  const conditionCatalog = Array.isArray(input.conditionCatalog) ? input.conditionCatalog.slice(0, 60).map(condition => ({
    id: boundedString(condition?.id, 100), name: boundedString(condition?.name, 100),
    effect: boundedString(condition?.effect || condition?.hint, 500), turns: safeNumber(condition?.turns, 0, 0, 100)
  })) : [];
  return {
    session: {
      id: boundedString(input.session?.id, 120), title: boundedString(input.session?.title || 'Sessão atual', 120),
      scene: boundedString(input.session?.scene, 240), active: input.session?.active === true,
      round: Math.max(1, safeNumber(input.session?.round, 1, 1, 9999)),
      turn: Math.max(0, safeNumber(input.session?.turn, 0, 0, 999999)),
      currentName: boundedString(input.session?.currentName, 100),
      history: Array.isArray(input.session?.history) ? input.session.history.slice(0, 12).map(x => boundedString(x?.message || x, 300)) : []
    },
    players, participants, monsters, archive, memories, items, conditionCatalog, spells, rules,
    memoryStatus: boundedString(input.memoryStatus, 40), archiveStatus: boundedString(input.archiveStatus, 40)
  };
}

export function parseAshenDiceExpression(expression) {
  const raw = boundedString(expression, 32).replace(/\s+/g, '').toLowerCase();
  const match = raw.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) return null;
  const count = Number(match[1] || 1), sides = Number(match[2]), modifier = Number(match[3] || 0);
  if (!Number.isInteger(count) || count < 1 || count > 50 || !Number.isInteger(sides) || sides < 2 || sides > 1000 || !Number.isInteger(modifier) || Math.abs(modifier) > 10000) return null;
  const label = `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''}`;
  return { count, sides, modifier, label };
}

export async function executeAshenReadTool(name, args = {}, context = {}, rollRandomInt = (max) => Math.floor(Math.random() * max) + 1) {
  const query = boundedString(args.query || args.name, 180);
  if (name === 'search_archive' || name === 'search_memory') {
    const source = name === 'search_archive' ? (context.archive || []) : (context.memories || []);
    const q = normalizeSearch(query);
    const tokens = q.split(/\s+/).filter(Boolean);
    const results = source.map(item => {
      const haystack = normalizeSearch([item.title, item.content, item.location, ...(item.tags || [])].join(' '));
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { item, score };
    }).filter(entry => q ? entry.score > 0 : true).sort((a, b) => b.score - a.score || String(b.item.created_at || b.item.occurred_at || '').localeCompare(String(a.item.created_at || a.item.occurred_at || ''))).slice(0, 8);
    return { results: results.map(entry => entry.item), total: results.length };
  }
  if (name === 'get_character') {
    const character = matchByIdOrName([...(context.players || []), ...(context.monsters || [])], args.name || args.id);
    return character ? { character } : { error: 'Não encontrei um personagem ou criatura com esse nome. Se houver nomes repetidos, peça o ID ou esclareça o alvo.' };
  }
  if (name === 'get_combat_status') {
    return { session: context.session || {}, participants: context.participants || [], monsters: context.monsters || [] };
  }
  if (name === 'list_conditions') return { conditions: context.conditionCatalog || [] };
  if (name === 'roll_skill_check' || name === 'roll_attribute_check') {
    const target = matchByIdOrName([...(context.players || []), ...(context.monsters || [])], args.target);
    const field = name === 'roll_skill_check' ? 'skills' : 'attrs';
    const requested = boundedString(args.skill || args.attribute, 100);
    if (!target || !requested) return { error: 'Não encontrei o alvo ou a perícia/atributo solicitado.' };
    const value = Number(target[field]?.[requested]);
    if (!Number.isFinite(value)) return { error: `A ficha de ${target.name} não possui ${requested}.` };
    const attribute = name === 'roll_skill_check' ? SKILL_ATTRIBUTE_MAP[requested] : requested;
    const rollMode = context.rules?.skillRollMode === 'simple' ? 'simple' : context.rules?.skillRollMode === 'cris' ? 'cris' : 'limit';
    if (name === 'roll_skill_check' && !attribute && rollMode !== 'limit') return { error: `Não há atributo-base cadastrado para a perícia ${requested}.` };
    if (name === 'roll_skill_check' && TRAINED_ONLY_SKILLS.has(requested) && value <= 0) return { error: `${requested} só pode ser rolada por quem possui treinamento.` };
    if (rollMode === 'limit') {
      const points = Math.max(0, Math.floor(value));
      const count = Math.max(1, Math.min(3, points));
      const dice = Array.from({ length: count }, () => Math.max(1, Math.min(20, Number(rollRandomInt(20)) || 1)));
      const natural = Math.max(...dice);
      const modifier = Math.max(0, points - 3) * 2;
      return { target: target.name, check: requested, attribute: name === 'roll_skill_check' ? attribute : requested, mode: 'limit', points, pool: count, keep: 'highest', dice, natural, modifier, total: natural + modifier, critical: natural === 20, fumble: natural === 1, note: 'Sistema do Manual de Rolagens: até 3d20 (maior resultado), +2 por ponto acima de 3. 20 natural no maior dado é sucesso crítico; falha crítica só se todos os dados forem 1. Vantagem/desvantagem não foram aplicadas. A dificuldade não foi informada; não determine sucesso ou falha sem a DT.' };
    }
    const simpleMode = rollMode === 'simple';
    const poolValue = simpleMode ? 1 : (name === 'roll_skill_check' ? Number(target.attrs?.[attribute]) : value);
    if (!Number.isFinite(poolValue)) return { error: `A ficha de ${target.name} não possui o atributo-base ${attribute}.` };
    const pool = Math.max(0, Math.min(10, Math.floor(poolValue)));
    const count = pool > 0 ? pool : 2;
    const keep = pool > 0 ? 'highest' : 'lowest';
    const dice = Array.from({ length: count }, () => Math.max(1, Math.min(20, Number(rollRandomInt(20)) || 1)));
    const natural = keep === 'highest' ? Math.max(...dice) : Math.min(...dice);
    const modifier = name === 'roll_skill_check' ? Math.max(-100, Math.min(100, value)) : 0;
    return { target: target.name, check: requested, attribute, pool: count, keep, dice, natural, modifier, total: natural + modifier, critical: natural === 20, fumble: natural === 1, note: 'Resultado do dado. A dificuldade não foi informada; não determine sucesso ou falha sem a regra/DC aplicável.' };
  }
  if (name === 'search_rules') {
    const q = normalizeSearch(query);
    const tokens = q.split(/\s+/).filter(Boolean);
    const source = [...(context.spells || []).map(x => ({ ...x, kind: 'spell' }))];
    const results = source.map(item => ({ item, score: tokens.reduce((sum, token) => sum + (normalizeSearch([item.name, item.description, item.element, item.type].join(' ')).includes(token) ? 1 : 0), 0) })).filter(x => !q || x.score > 0).sort((a,b) => b.score-a.score).slice(0, 10);
    return { rulesSummary: context.rules || {}, results: results.map(x => x.item), total: results.length };
  }
  if (name === 'roll_dice') {
    const parsed = parseAshenDiceExpression(args.expression || args.dice);
    if (!parsed) return { error: 'Expressão inválida. Use, por exemplo, d20, 2d6+3 ou 1d8-1.' };
    const dice = Array.from({ length: parsed.count }, () => Math.max(1, Math.min(parsed.sides, Number(rollRandomInt(parsed.sides)) || 1)));
    const diceTotal = dice.reduce((sum, value) => sum + value, 0);
    return { expression: parsed.label, dice, modifier: parsed.modifier, total: diceTotal + parsed.modifier };
  }
  return { error: 'Ferramenta de consulta não reconhecida.' };
}

export function validateAshenResult(value, context = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { reply: 'Não consegui organizar uma resposta válida. Tente reformular a pergunta.', action: null };
  const reply = boundedString(value.reply || value.message || '', 5000) || 'Não consegui formular uma resposta.';
  const raw = value.action && typeof value.action === 'object' ? value.action : null;
  if (!raw || !ACTION_TYPES.has(String(raw.type || ''))) return { reply, action: null };

  if (raw.type === 'change_resource') {
    const target = matchByIdOrName(allTargets(context), raw.target);
    const resource = raw.resource === 'sanity' ? 'sanity' : raw.resource === 'hp' ? 'hp' : '';
    const delta = Number(raw.delta);
    if (!target || !resource || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) return { reply, action: null };
    return { reply, action: { type: 'change_resource', targetType: target.targetType, target: target.id, targetName: target.name, resource, delta } };
  }
  if (raw.type === 'set_initiative') {
    const participant = matchByIdOrName(context.participants || [], raw.target, 'key');
    const value = Number(raw.value);
    if (!participant || !Number.isInteger(value) || value < -99 || value > 999) return { reply, action: null };
    return { reply, action: { type: 'set_initiative', target: participant.key, targetName: participant.name, value } };
  }
  if (raw.type === 'advance_turn') {
    if (!context.session?.active || !context.participants?.length) return { reply, action: null };
    return { reply, action: { type: 'advance_turn' } };
  }
  if (raw.type === 'set_condition' || raw.type === 'remove_condition') {
    const target = matchByIdOrName(allTargets(context), raw.target);
    const condition = matchByIdOrName(context.conditionCatalog || [], raw.condition || raw.conditionId);
    if (!target || !condition) return { reply, action: null };
    if (raw.type === 'remove_condition' && !(target.conditions || []).some(value => normalizeSearch(value) === normalizeSearch(condition.id) || normalizeSearch(value) === normalizeSearch(condition.name))) return { reply, action: null };
    return { reply, action: { type: raw.type, targetType: target.targetType, target: target.id, targetName: target.name, conditionId: condition.id, conditionName: condition.name } };
  }
  if (raw.type === 'manage_inventory') {
    const target = matchByIdOrName(context.players || [], raw.target);
    const item = matchByIdOrName(context.items || [], raw.itemId ?? raw.item);
    const operation = raw.operation === 'remove' ? 'remove' : raw.operation === 'add' ? 'add' : '';
    const quantity = Number(raw.quantity ?? 1);
    if (!target || !item || !operation || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { reply, action: null };
    return { reply, action: { type: 'manage_inventory', target: target.id, targetName: target.name, operation, itemId: item.id, itemName: item.name, quantity } };
  }
  if (raw.type === 'record_campaign_event') {
    const title = boundedString(raw.title, 180), content = boundedString(raw.content, 16000);
    const kind = ARCHIVE_KINDS.has(String(raw.kind || 'event')) ? String(raw.kind || 'event') : 'event';
    const location = boundedString(raw.location, 180);
    const tags = Array.isArray(raw.tags) ? raw.tags.slice(0, 20).map(x => boundedString(x, 48)).filter(Boolean) : [];
    if (!title || !content) return { reply, action: null };
    return { reply, action: { type: 'record_campaign_event', kind, title, content, location, tags } };
  }
  if (raw.type === 'save_memory') {
    const title = boundedString(raw.title, 180), content = boundedString(raw.content, 4000);
    const category = MEMORY_CATEGORIES.has(String(raw.category || 'fact')) ? String(raw.category || 'fact') : 'fact';
    const importance = safeNumber(raw.importance, 3, 1, 5);
    if (!title || !content) return { reply, action: null };
    return { reply, action: { type: 'save_memory', title, content, category, importance } };
  }
  if (raw.type === 'archive_memory') {
    const memory = matchByIdOrName((context.memories || []).map(item => ({ ...item, name: item.title })), raw.memory || raw.memoryId);
    if (!memory) return { reply, action: null };
    return { reply, action: { type: 'archive_memory', memoryId: memory.id, title: memory.title } };
  }
  return { reply, action: null };
}

export function parseAshenProviderResponse(text, context = {}) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return validateAshenResult(JSON.parse(raw), context); }
  catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) { try { return validateAshenResult(JSON.parse(match[0]), context); } catch {} }
    return { reply: raw.slice(0, 5000) || 'O provedor retornou uma resposta vazia.', action: null };
  }
}

export const ASHEN_TOOL_NAMES = Object.freeze([
  'get_character', 'get_combat_status', 'search_archive', 'search_memory', 'search_rules', 'list_conditions', 'roll_dice', 'roll_skill_check', 'roll_attribute_check',
  'change_resource', 'set_initiative', 'advance_turn', 'set_condition', 'remove_condition',
  'manage_inventory', 'record_campaign_event', 'save_memory', 'archive_memory'
]);
export const ASHEN_ACTION_TYPES = Object.freeze([...ACTION_TYPES]);
