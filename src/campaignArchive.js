const KIND_LABELS = {
  event: 'Acontecimento', session: 'Sessão', character: 'Pessoa / personagem',
  location: 'Local', evidence: 'Evidência', death: 'Morte', document: 'Documento'
};
const VISIBILITY_LABELS = {
  master: 'Somente Mestre', public: 'Todos os jogadores', group: 'Grupo selecionado', player: 'Jogador específico'
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}
function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}
function dateLabel(value, withTime = true) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleString('pt-BR', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}
function localDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function recordVisibility(item, isMaster) {
  if (!isMaster) return '';
  return `<span class="archive-visibility archive-vis-${esc(item.visibility || 'master')}">${esc(VISIBILITY_LABELS[item.visibility] || VISIBILITY_LABELS.master)}</span>`;
}
function archiveCard(item, { isMaster, players }) {
  const isArchived = Boolean(item.deleted_at);
  const linked = players.find(p => String(p.id) === String(item.linked_player_id || ''));
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const haystack = normalizeSearch([item.title, item.content, item.location, ...tags, KIND_LABELS[item.kind] || item.kind].join(' '));
  return `<article class="archive-entry" data-archive-card data-kind="${esc(item.kind)}" data-search="${esc(haystack)}">
    <div class="archive-entry-rail"><span class="archive-entry-mark" aria-hidden="true">${item.kind === 'death' ? '†' : item.kind === 'evidence' ? '⌕' : item.kind === 'document' ? '▤' : item.kind === 'location' ? '⌖' : item.kind === 'session' ? '◷' : '◇'}</span><i></i></div>
    <div class="archive-entry-main">
      <div class="archive-entry-top"><span class="archive-kind">${esc(KIND_LABELS[item.kind] || 'Registro')}</span><time>${esc(dateLabel(item.occurred_at))}</time></div>
      <h3>${esc(item.title)}</h3>
      ${item.location ? `<div class="archive-location">⌖ ${esc(item.location)}</div>` : ''}
      ${item.content ? `<p class="archive-entry-content">${esc(item.content)}</p>` : ''}
      ${linked ? `<div class="archive-linked">Relacionado a <strong>${esc(linked.name || linked.login || 'Personagem')}</strong></div>` : ''}
      ${tags.length ? `<div class="archive-tags">${tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
      <div class="archive-entry-bottom">${recordVisibility(item, isMaster)}${isMaster && isArchived ? '<span class="archive-archived-label">Arquivado</span>' : ''}${isMaster ? `<span class="archive-revision">Revisão ${Number(item.revision) || 1}</span>` : ''}</div>
      ${isMaster ? `<div class="archive-entry-actions"><button type="button" class="btn small" data-archive-history="${esc(item.id)}">Histórico</button>${isArchived ? `<button type="button" class="btn small primary" data-archive-restore="${esc(item.id)}">Restaurar</button>` : `<button type="button" class="btn small" data-archive-edit="${esc(item.id)}">Editar</button><button type="button" class="btn small danger" data-archive-delete="${esc(item.id)}">Arquivar</button>`}</div>` : ''}
    </div>
  </article>`;
}

export function campaignArchivePage({ items = [], isMaster = false, players = [], loading = false, error = '', showArchived = false } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safePlayers = Array.isArray(players) ? players.filter(p => p && p.id) : [];
  const countByKind = kind => safeItems.filter(item => item.kind === kind).length;
  const playerText = isMaster
    ? 'Registros separados dos dados globais: documentos restritos são filtrados no servidor antes de chegar aos jogadores.'
    : 'Este arquivo mostra somente registros compartilhados com todos ou com seu grupo/personagem.';
  return `<section class="campaign-archive" aria-label="Arquivo de Campanha" data-archive-master="${isMaster ? '1' : '0'}" data-archive-show-deleted="${showArchived ? '1' : '0'}">
    <header class="archive-hero">
      <div><span class="section-kicker">ASHEN TESTIMONY · MEMÓRIA DA CAMPANHA</span><h2>Arquivo de Campanha</h2><p>${playerText}</p></div>
      <div class="archive-hero-mark" aria-hidden="true">▤</div>
    </header>
    <div class="archive-summary">
      <div><span>REGISTROS</span><strong>${safeItems.length}</strong></div>
      <div><span>SESSÕES</span><strong>${countByKind('session')}</strong></div>
      <div><span>EVIDÊNCIAS</span><strong>${countByKind('evidence')}</strong></div>
      <div><span>ÓBITOS</span><strong>${countByKind('death')}</strong></div>
    </div>
    <div class="archive-toolbar">
      <label class="archive-search"><span aria-hidden="true">⌕</span><input type="search" id="archiveSearch" aria-label="Buscar no Arquivo de Campanha" placeholder="Buscar acontecimentos, nomes, locais ou pistas…" maxlength="100" autocomplete="off"></label>
      <select id="archiveKindFilter" aria-label="Filtrar por categoria"><option value="all">Todas as categorias</option>${Object.entries(KIND_LABELS).map(([key,label]) => `<option value="${key}">${esc(label)}</option>`).join('')}</select>
      <button type="button" class="btn" data-archive-refresh ${loading ? 'disabled' : ''}>${loading ? 'Atualizando…' : 'Atualizar'}</button>
      <button type="button" class="btn" data-archive-export>Exportar JSON</button>
      ${isMaster ? `<button type="button" class="btn" data-archive-toggle-deleted>${showArchived ? 'Voltar aos ativos' : 'Ver arquivados'}</button>` : ''}
      ${isMaster && !showArchived ? '<button type="button" class="btn primary" data-archive-new>+ Novo registro</button>' : ''}
    </div>
    ${error ? `<div class="archive-alert" role="status">${esc(error)}</div>` : ''}
    <div class="archive-feed" id="archiveFeed" role="feed" aria-label="Linha do tempo da campanha">${safeItems.length ? safeItems.map(item => archiveCard(item, { isMaster, players: safePlayers })).join('') : `<div class="archive-empty"><span>∅</span><strong>${loading ? 'Consultando os registros…' : 'Nenhum registro encontrado'}</strong><p>${isMaster ? (showArchived ? 'Não há registros arquivados.' : 'Crie o primeiro acontecimento, sessão, evidência ou documento da campanha.') : 'Ainda não há registros compartilhados com você.'}</p></div>`}</div>
    <div class="archive-empty archive-filter-empty" id="archiveFilterEmpty" hidden><strong>Nenhum resultado para esse filtro.</strong><p>Tente outro termo ou categoria.</p></div>
    <footer class="archive-footnote">${isMaster ? 'Alterações registram revisão e histórico. Registros arquivados podem ser consultados e restaurados.' : 'Os registros são somente leitura. A visibilidade é validada no servidor a cada consulta.'}</footer>
    ${isMaster ? archiveEditorMarkup(safePlayers) : ''}
  </section>`;
}

function archiveEditorMarkup(players) {
  const options = players.map(p => `<option value="${esc(p.id)}">${esc(p.name || p.login || p.id)}</option>`).join('');
  return `<div class="archive-modal-backdrop" id="archiveEditorBackdrop" hidden>
    <section class="archive-modal" role="dialog" aria-modal="true" aria-labelledby="archiveEditorTitle">
      <header><div><span class="section-kicker">REGISTRO DA CAMPANHA</span><h2 id="archiveEditorTitle">Novo registro</h2></div><button type="button" class="archive-modal-close" data-archive-close aria-label="Fechar">×</button></header>
      <form id="archiveEditorForm">
        <div class="archive-form-grid">
          <label class="archive-field archive-field-wide">Título<input id="archiveTitle" maxlength="180" required placeholder="Ex.: O sino tocou pela primeira vez"></label>
          <label class="archive-field">Categoria<select id="archiveType">${Object.entries(KIND_LABELS).map(([key,label]) => `<option value="${key}">${esc(label)}</option>`).join('')}</select></label>
          <label class="archive-field">Data e hora<input id="archiveOccurredAt" type="datetime-local" required></label>
          <label class="archive-field archive-field-wide">Descrição / conteúdo<textarea id="archiveContent" rows="6" maxlength="16000" placeholder="Registre o que aconteceu, o que foi descoberto ou o teor do documento…"></textarea></label>
          <label class="archive-field">Local<input id="archiveLocation" maxlength="180" placeholder="Onde aconteceu?" autocomplete="off"></label>
          <label class="archive-field">Personagem relacionado<select id="archiveLinkedPlayer"><option value="">Nenhum</option>${options}</select></label>
          <label class="archive-field archive-field-wide">Etiquetas<input id="archiveTags" maxlength="600" placeholder="Ex.: culto, igreja, desaparecimento (separadas por vírgula)"></label>
          <label class="archive-field archive-field-wide">Visibilidade<select id="archiveVisibility"><option value="master">Somente Mestre</option><option value="public">Todos os jogadores</option><option value="group">Grupo selecionado (2 ou mais)</option><option value="player">Um jogador específico</option></select></label>
          <label class="archive-field archive-field-wide" id="archiveTargetWrap" hidden>Jogadores autorizados<select id="archiveVisiblePlayers" multiple size="5">${options}</select><small>Use Ctrl (computador) ou toque para selecionar. No celular, selecione os jogadores desejados na lista.</small></label>
        </div>
        <div class="archive-form-warning" id="archiveFormWarning" role="alert" hidden></div>
        <footer><button type="button" class="btn" data-archive-close>Cancelar</button><button type="submit" class="btn primary" id="archiveSaveButton">Salvar registro</button></footer>
      </form>
    </section>
  </div>`;
}

function showHistory(item, events) {
  const rows = (Array.isArray(events) ? events : []).map(event => {
    const label = event.action === 'created' ? 'Registro criado' : event.action === 'deleted' ? 'Registro arquivado' : event.action === 'restored' ? 'Registro restaurado' : 'Registro atualizado';
    const before = event.before_data || null;
    const after = event.after_data || null;
    const beforeRevision = before?.revision ? ` · revisão anterior ${before.revision}` : '';
    const afterRevision = after?.revision ? ` · nova revisão ${after.revision}` : '';
    return `<article class="archive-history-row"><span>${esc(dateLabel(event.created_at))}</span><strong>${label}</strong><small>${beforeRevision}${afterRevision}</small></article>`;
  }).join('');
  const wrapper = document.createElement('div');
  wrapper.className = 'archive-modal-backdrop';
  wrapper.innerHTML = `<section class="archive-modal archive-history-modal" role="dialog" aria-modal="true" aria-labelledby="archiveHistoryTitle"><header><div><span class="section-kicker">AUDITORIA</span><h2 id="archiveHistoryTitle">Histórico · ${esc(item.title)}</h2></div><button type="button" class="archive-modal-close" data-history-close aria-label="Fechar">×</button></header><div class="archive-history-list">${rows || '<p class="muted">Nenhuma alteração registrada.</p>'}</div><footer><button type="button" class="btn" data-history-close>Fechar</button></footer></section>`;
  wrapper.querySelectorAll('[data-history-close]').forEach(button => button.addEventListener('click', () => wrapper.remove()));
  wrapper.addEventListener('click', event => { if (event.target === wrapper) wrapper.remove(); });
  document.body.appendChild(wrapper);
}

export function bindCampaignArchive({ items = [], isMaster = false, players = [], showArchived = false, onReload, onSave, onDelete, onRestore, onHistory, onToggleArchived, toast = () => {}, rerender = () => {} } = {}) {
  const root = document.querySelector('.campaign-archive');
  if (!root) return;
  const currentItems = () => Array.isArray(items) ? items : [];
  const findItem = id => currentItems().find(item => String(item.id) === String(id));
  const reloadAfterMutation = async message => {
    let refreshFailed = false;
    try { await onReload?.(); } catch { refreshFailed = true; }
    rerender();
    toast(refreshFailed ? `${message} A lista não atualizou; use o botão Atualizar.` : message);
  };
  const filterNow = () => {
    const query = normalizeSearch(root.querySelector('#archiveSearch')?.value.trim() || '');
    const kind = root.querySelector('#archiveKindFilter')?.value || 'all';
    let visible = 0;
    root.querySelectorAll('[data-archive-card]').forEach(card => {
      const matches = (!query || (card.dataset.search || '').includes(query)) && (kind === 'all' || card.dataset.kind === kind);
      card.hidden = !matches;
      if (matches) visible++;
    });
    const empty = root.querySelector('#archiveFilterEmpty');
    if (empty) empty.hidden = visible !== 0 || !currentItems().length;
  };
  root.querySelector('#archiveSearch')?.addEventListener('input', filterNow);
  root.querySelector('#archiveKindFilter')?.addEventListener('change', filterNow);

  const reload = async button => {
    if (button) { button.disabled = true; button.textContent = 'Atualizando…'; }
    try { await onReload?.(); rerender(); }
    catch (error) { toast(error?.message || 'Não foi possível atualizar o Arquivo.'); }
    finally { if (button) { button.disabled = false; button.textContent = 'Atualizar'; } }
  };
  root.querySelector('[data-archive-refresh]')?.addEventListener('click', event => reload(event.currentTarget));
  root.querySelector('[data-archive-toggle-deleted]')?.addEventListener('click', async () => {
    const button = root.querySelector('[data-archive-toggle-deleted]');
    if (button) { button.disabled = true; button.textContent = 'Carregando…'; }
    try { await onToggleArchived?.(!showArchived); rerender(); }
    catch (error) { toast(error?.message || 'Não foi possível consultar os registros arquivados.'); if (button) { button.disabled = false; button.textContent = showArchived ? 'Voltar aos ativos' : 'Ver arquivados'; } }
  });
  root.querySelector('[data-archive-export]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records: currentItems() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ashen-arquivo-campanha-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  if (!isMaster) return;
  const backdrop = root.querySelector('#archiveEditorBackdrop');
  const form = root.querySelector('#archiveEditorForm');
  const warning = root.querySelector('#archiveFormWarning');
  let editing = null;
  const visibilitySelect = root.querySelector('#archiveVisibility');
  const targets = root.querySelector('#archiveTargetWrap');
  const visiblePlayersSelect = root.querySelector('#archiveVisiblePlayers');
  const syncTargetVisibility = () => {
    const needsTargets = ['group', 'player'].includes(visibilitySelect?.value);
    if (targets) targets.hidden = !needsTargets;
  };
  visibilitySelect?.addEventListener('change', syncTargetVisibility);
  const closeEditor = () => { if (backdrop) backdrop.hidden = true; editing = null; form?.reset(); if (warning) warning.hidden = true; root.querySelector('[data-archive-new]')?.focus(); };
  backdrop?.addEventListener('click', event => { if (event.target === backdrop) closeEditor(); });
  if (!root.dataset.archiveEscapeBound) {
    root.dataset.archiveEscapeBound = '1';
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && backdrop && !backdrop.hidden) { event.preventDefault(); closeEditor(); return; }
      if (event.key === 'Tab' && backdrop && !backdrop.hidden) {
        const focusable = [...backdrop.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }
  root.querySelectorAll('[data-archive-close]').forEach(button => button.addEventListener('click', closeEditor));
  const openEditor = item => {
    editing = item || null;
    root.querySelector('#archiveEditorTitle').textContent = item ? 'Editar registro' : 'Novo registro';
    root.querySelector('#archiveTitle').value = item?.title || '';
    root.querySelector('#archiveType').value = item?.kind || 'event';
    root.querySelector('#archiveOccurredAt').value = localDateTime(item?.occurred_at || new Date());
    root.querySelector('#archiveContent').value = item?.content || '';
    root.querySelector('#archiveLocation').value = item?.location || '';
    root.querySelector('#archiveLinkedPlayer').value = item?.linked_player_id || '';
    root.querySelector('#archiveTags').value = Array.isArray(item?.tags) ? item.tags.join(', ') : '';
    visibilitySelect.value = item?.visibility || 'master';
    const selected = new Set(Array.isArray(item?.visible_player_ids) ? item.visible_player_ids.map(String) : []);
    [...visiblePlayersSelect.options].forEach(option => { option.selected = selected.has(String(option.value)); });
    syncTargetVisibility();
    if (warning) warning.hidden = true;
    backdrop.hidden = false;
    root.querySelector('#archiveTitle').focus();
  };
  root.querySelector('[data-archive-new]')?.addEventListener('click', () => openEditor(null));
  root.querySelectorAll('[data-archive-edit]').forEach(button => button.addEventListener('click', () => {
    const item = findItem(button.dataset.archiveEdit); if (item) openEditor(item);
  }));
  root.querySelectorAll('[data-archive-delete]').forEach(button => button.addEventListener('click', async () => {
    const item = findItem(button.dataset.archiveDelete); if (!item) return;
    if (!confirm(`Arquivar “${item.title}”? O registro será ocultado da linha do tempo, mas permanecerá no histórico de auditoria.`)) return;
    button.disabled = true;
    try { await onDelete?.(item.id, Number(item.revision) || 1); await reloadAfterMutation('Registro arquivado.'); }
    catch (error) { toast(error?.message || 'Não foi possível arquivar o registro.'); button.disabled = false; }
  }));
  root.querySelectorAll('[data-archive-restore]').forEach(button => button.addEventListener('click', async () => {
    const item = findItem(button.dataset.archiveRestore); if (!item) return;
    if (!confirm(`Restaurar “${item.title}” para a linha do tempo ativa?`)) return;
    button.disabled = true;
    try { await onRestore?.(item.id, Number(item.revision) || 1); await reloadAfterMutation('Registro restaurado.'); }
    catch (error) { toast(error?.message || 'Não foi possível restaurar o registro.'); button.disabled = false; }
  }));
  root.querySelectorAll('[data-archive-history]').forEach(button => button.addEventListener('click', async () => {
    const item = findItem(button.dataset.archiveHistory); if (!item) return;
    button.disabled = true;
    try { const events = await onHistory?.(item.id); showHistory(item, events); }
    catch (error) { toast(error?.message || 'Não foi possível consultar o histórico.'); }
    finally { button.disabled = false; }
  }));

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const title = root.querySelector('#archiveTitle').value.trim();
    const visibility = visibilitySelect.value;
    const visiblePlayerIds = [...visiblePlayersSelect.selectedOptions].map(option => option.value);
    if (!title) return;
    if (visibility === 'player' && visiblePlayerIds.length !== 1) {
      warning.textContent = 'Selecione exatamente um jogador para esta visibilidade.'; warning.hidden = false; return;
    }
    if (visibility === 'group' && visiblePlayerIds.length < 2) {
      warning.textContent = 'Selecione pelo menos dois jogadores para compartilhar com um grupo.'; warning.hidden = false; return;
    }
    const dateValue = root.querySelector('#archiveOccurredAt').value;
    const payload = {
      id: editing?.id || `archive-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`,
      kind: root.querySelector('#archiveType').value,
      title,
      content: root.querySelector('#archiveContent').value.trim(),
      occurredAt: dateValue ? new Date(dateValue).toISOString() : new Date().toISOString(),
      location: root.querySelector('#archiveLocation').value.trim(),
      linkedPlayerId: root.querySelector('#archiveLinkedPlayer').value,
      tags: root.querySelector('#archiveTags').value.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 20),
      visibility,
      visiblePlayerIds: visibility === 'group' || visibility === 'player' ? visiblePlayerIds : []
    };
    const saveButton = root.querySelector('#archiveSaveButton');
    saveButton.disabled = true; saveButton.textContent = 'Salvando…';
    try {
      const wasEditing = Boolean(editing);
      await onSave?.(payload, wasEditing ? Number(editing.revision) || 1 : null);
      closeEditor(); await reloadAfterMutation(wasEditing ? 'Registro atualizado.' : 'Registro criado.');
    } catch (error) {
      const messages = {
        ARQUIVO_CONFLITO: 'Este registro foi alterado em outro dispositivo. Atualize a lista e tente novamente.',
        ARQUIVO_SELECIONE_UM_PLAYER: 'Selecione exatamente um jogador.',
        ARQUIVO_SELECIONE_GRUPO: 'Selecione pelo menos dois jogadores.',
        ARQUIVO_PLAYER_INVALIDO: 'Um dos jogadores selecionados não está mais ativo.'
      };
      const raw = String(error?.message || error || '');
      warning.textContent = messages[raw] || (raw.includes('PGRST202') || raw.includes('not find the function')
        ? 'A migração do Arquivo de Campanha ainda não foi aplicada no Supabase.'
        : (raw || 'Não foi possível salvar o registro.'));
      warning.hidden = false;
    } finally {
      saveButton.disabled = false; saveButton.textContent = 'Salvar registro';
    }
  });
}
