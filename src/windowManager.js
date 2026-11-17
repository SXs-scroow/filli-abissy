import { parseSessionCommand, resolveSessionTarget } from './ashenSessionAssistant.js';

const STORAGE_KEY = 'ashen.window-manager.v1';
const WINDOW_IDS = ['command', 'session', 'archive', 'investigation', 'entities', 'environment', 'ashen-ai'];

export function normalizeWindowPreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  const open = Array.isArray(source.open) ? source.open.filter((id) => WINDOW_IDS.includes(id)) : [];
  const minimized = Array.isArray(source.minimized) ? source.minimized.filter((id) => WINDOW_IDS.includes(id)) : [];
  return { open: [...new Set(open)], minimized: [...new Set(minimized)] };
}

export function clampWindowPosition(position, viewport = {}) {
  const width = Math.max(320, Number(viewport.width) || 320);
  const height = Math.max(240, Number(viewport.height) || 240);
  const x = Number(position?.x);
  const y = Number(position?.y);
  return {
    x: Math.min(Math.max(8, Number.isFinite(x) ? x : 24), Math.max(8, width - 320)),
    y: Math.min(Math.max(8, Number.isFinite(y) ? y : 80), Math.max(8, height - 180)),
  };
}

const WINDOWS = {
  command: { title: 'CENTRAL DE COMANDO', code: '00 // OVERVIEW', body: `<p class="ashen-wm-lead">A mesa está sob observação.</p><p>Use esta central para abrir os setores do Ashen Testimony. As janelas são independentes; os módulos originais continuam responsáveis pelos dados e operações.</p><div class="ashen-wm-grid"><button data-nav="session">Abrir Modo Sessão <span>→</span></button><button data-nav="master">Administração do Mestre <span>→</span></button><button data-nav="nexus">Conexão Nexus <span>→</span></button><button data-wm-open="ashen-ai">Consultar Ashen AI <span>→</span></button></div><div class="ashen-wm-note"><b>PROTOCOLO</b><span>O Mestre controla. Ashen organiza. Nexus apresenta.</span></div>` },
  session: { title: 'SALA DE SESSÃO', code: '01 // LIVE OPERATIONS', body: `<p class="ashen-wm-lead">Condução da mesa</p><p>Abra o modo de sessão existente para acompanhar participantes, combate e ferramentas já implementadas.</p><button class="ashen-wm-action" data-nav="session">ACESSAR MODO SESSÃO ↗</button>` },
  archive: { title: 'ARQUIVO DE CAMPANHA', code: '02 // RECORDS', body: `<p class="ashen-wm-lead">Memória da campanha</p><p>O arquivo e o histórico já existentes serão preservados. A integração de consulta para o Mestre será feita numa etapa posterior, sem duplicar registros.</p><span class="ashen-wm-status">INTEGRAÇÃO PLANEJADA</span>` },
  investigation: { title: 'QUADRO DE INVESTIGAÇÃO', code: '03 // EVIDENCE ROOM', body: `<p class="ashen-wm-lead">Pistas, suspeitos e teorias</p><p>Este setor será conectado ao sistema atual de pistas e segredos. Nenhuma pista será criada ou revelada por esta janela nesta primeira etapa.</p><span class="ashen-wm-status">INTEGRAÇÃO PLANEJADA</span>` },
  entities: { title: 'REGISTRO DE ENTIDADES', code: '04 // ENTITY INDEX', body: `<p class="ashen-wm-lead">Pessoas, criaturas e organizações</p><p>O cadastro unificado será planejado sobre os registros existentes, evitando duplicar fichas, monstros ou dados de Players.</p><span class="ashen-wm-status">INTEGRAÇÃO PLANEJADA</span>` },
  environment: { title: 'CONTROLE DE AMBIENTE', code: '05 // ATMOSPHERE', body: `<p class="ashen-wm-lead">Som, cenas e apresentação</p><p>As ferramentas de áudio, TV e apresentação continuarão funcionando como hoje. A centralização dos controles virá numa próxima etapa.</p><button class="ashen-wm-action" data-nav="nexus">ABRIR NEXUS ↗</button>` },
  'ashen-ai': { title: 'ASHEN AI', code: '06 // CAMPAIGN INTELLIGENCE', body: `<div class="ashen-ai-status"><span class="ashen-ai-indicator"></span><span>ASSISTENTE DO MESTRE · CONTEXTO DO ARQUIVO E INTEGRIDADE</span></div><div class="ashen-ai-log" data-ashen-ai-log aria-live="polite"><div class="ashen-ai-empty">Aguardando consulta. Nesta primeira etapa, a Ashen AI consulta registros do Arquivo de Campanha. Fichas, monstros e pistas fora do Arquivo ainda não fazem parte da memória conectada.</div></div><div class="ashen-ai-tools"><button type="button" data-ashen-ai-integrity>VERIFICAR INTEGRIDADE ↗</button></div><form class="ashen-ai-form" data-ashen-ai-form><textarea data-ashen-ai-input rows=3 maxlength=6000 placeholder="Pergunte sobre acontecimentos, pistas, documentos ou pessoas registradas…"></textarea><button type="submit" data-ashen-ai-send>CONSULTAR ↗</button></form><p class="ashen-ai-footnote">Somente Mestre · Consulta sem alterações · Conversas não são salvas</p><section class="ashen-presence"><div class="ashen-presence-head"><div><b>ASSISTENTE DE SESSÃO PRESENCIAL</b><small>Escuta comandos de jogo e pede aprovação privada ao Mestre.</small></div><button type="button" data-ashen-presence-toggle aria-pressed="false">INICIAR ESCUTA</button></div><div class="ashen-presence-state" data-ashen-presence-state>DESATIVADO · Nenhum áudio está sendo capturado.</div><div class="ashen-presence-queue" data-ashen-presence-queue aria-live="polite"><p>Nenhuma ação aguardando aprovação.</p></div><p class="ashen-ai-footnote">A captura só começa quando você ativar. O reconhecimento de fala depende do navegador e pode processar áudio pelo serviço de voz dele. A Ashen não grava nem armazena o áudio nesta aplicação.</p></section>` },
};

function readPreferences() {
  try { return normalizeWindowPreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return normalizeWindowPreferences(null); }
}
function savePreferences(preferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeWindowPreferences(preferences))); }
  catch { /* Preferências visuais são opcionais; a aplicação não depende do armazenamento. */ }
}

export function initWindowManager({ documentObj = document, windowObj = window } = {}) {
  const root = documentObj.getElementById('root');
  if (!root || root.dataset.ashenWindowManager === 'ready') return () => {};
  let mounted = false;
  let preferences = readPreferences();
  let highestZ = 40;
  let observer;
  const aiConversation = [];
  const presencePending = [];
  let aiBusy = false;
  let presenceRecognition = null;
  let presenceActive = false;

  const mount = () => {
    const isMaster = !!root.querySelector('.shell-master');
    if (!isMaster) {
      presenceActive = false; try { presenceRecognition?.stop(); } catch {} presenceRecognition = null;
      documentObj.getElementById('ashen-window-dock')?.remove();
      documentObj.getElementById('ashen-window-layer')?.remove();
      mounted = false;
      return;
    }
    if (mounted) return;
    mounted = true;
    root.dataset.ashenWindowManager = 'ready';
    const dock = documentObj.createElement('aside');
    dock.id = 'ashen-window-dock';
    dock.className = 'ashen-window-dock';
    dock.setAttribute('aria-label', 'Central de ferramentas Ashen');
    dock.innerHTML = `<span class="ashen-dock-mark">A</span><span class="ashen-dock-label">ASHEN <small>COMMAND DESK</small></span><button type="button" data-wm-open="command">CENTRAL</button><button type="button" data-wm-open="session">SESSÃO</button><button type="button" data-wm-open="archive">ARQUIVO</button><button type="button" data-wm-open="investigation">INVESTIGAÇÃO</button><button type="button" data-wm-open="entities">ENTIDADES</button><button type="button" data-wm-open="environment">AMBIENTE</button><button type="button" class="ashen-ai-dock-button" data-wm-open="ashen-ai">ASHEN AI</button>`;
    const layer = documentObj.createElement('div');
    layer.id = 'ashen-window-layer';
    layer.className = 'ashen-window-layer';
    documentObj.body.append(dock, layer);

    const appendAiMessage = (panel, role, content) => {
      const log = panel?.querySelector('[data-ashen-ai-log]');
      if (!log) return;
      log.querySelector('.ashen-ai-empty')?.remove();
      const item = documentObj.createElement('article');
      item.className = `ashen-ai-message ${role}`;
      const label = documentObj.createElement('b');
      label.textContent = role === 'assistant' ? 'ASHEN AI' : 'MESTRE';
      const text = documentObj.createElement('p');
      text.textContent = String(content || '');
      item.append(label, text);
      log.append(item);
      log.scrollTop = log.scrollHeight;
    };
    const renderAiConversation = (panel) => {
      const log = panel?.querySelector('[data-ashen-ai-log]');
      if (!log || !aiConversation.length) return;
      log.innerHTML = '';
      aiConversation.forEach((message) => appendAiMessage(panel, message.role, message.content));
    };
    const integritySnapshot = () => {
      let maintenance = null, campaign = null;
      try { maintenance = windowObj.__aProfeciaMaintenance ? { status: windowObj.__aProfeciaMaintenance.status(), proposal: windowObj.__aProfeciaMaintenance.proposal() } : null; } catch {}
      try { campaign = typeof windowObj.__aProfeciaIntegrityReport === 'function' ? windowObj.__aProfeciaIntegrityReport() : null; } catch {}
      return { maintenance, campaign };
    };
    const renderPresenceQueue = (panel) => {
      const queue = panel?.querySelector('[data-ashen-presence-queue]');
      if (!queue) return;
      queue.replaceChildren();
      if (!presencePending.length) { const empty = documentObj.createElement('p'); empty.textContent = 'Nenhuma ação aguardando aprovação.'; queue.append(empty); return; }
      presencePending.forEach((item) => {
        const card = documentObj.createElement('article'); card.className = 'ashen-presence-action';
        const title = documentObj.createElement('b'); title.textContent = item.title;
        const detail = documentObj.createElement('span'); detail.textContent = item.detail;
        const actions = documentObj.createElement('div'); actions.className = 'ashen-presence-actions';
        const approve = documentObj.createElement('button'); approve.type = 'button'; approve.textContent = 'CONFIRMAR'; approve.dataset.ashenApprove = item.id;
        const cancel = documentObj.createElement('button'); cancel.type = 'button'; cancel.textContent = 'CANCELAR'; cancel.dataset.ashenCancel = item.id;
        actions.append(approve, cancel); card.append(title, detail, actions); queue.append(card);
      });
    };
    const setPresenceState = (message, active = presenceActive) => {
      const panel = layer.querySelector('[data-wm-window="ashen-ai"]');
      const state = panel?.querySelector('[data-ashen-presence-state]');
      const button = panel?.querySelector('[data-ashen-presence-toggle]');
      if (state) state.textContent = message;
      if (button) { button.textContent = active ? 'ENCERRAR ESCUTA' : 'INICIAR ESCUTA'; button.setAttribute('aria-pressed', String(active)); }
    };
    const stopPresence = (message = 'DESATIVADO · Nenhum áudio está sendo capturado.') => {
      presenceActive = false;
      try { presenceRecognition?.stop(); } catch {}
      presenceRecognition = null;
      setPresenceState(message, false);
    };
    const queuePresenceCommand = (transcript, panel) => {
      const command = parseSessionCommand(transcript);
      if (!command) return;
      const roster = typeof windowObj.__ashenSessionPlayers === 'function' ? windowObj.__ashenSessionPlayers() : [];
      const resolved = resolveSessionTarget(command.targetName, roster);
      if (resolved.status !== 'found') {
        appendAiMessage(panel, 'assistant', resolved.status === 'ambiguous' ? `Comando reconhecido, mas há mais de um personagem chamado ${command.targetName}. Nenhuma alteração foi feita.` : `Comando reconhecido, mas não encontrei um personagem com o nome exato ${command.targetName}. Nenhuma alteração foi feita.`);
        return;
      }
      const target = resolved.target;
      const max = Number(target.hpMax) || 0;
      const current = Number(target.hp) || 0;
      const next = Math.max(0, Math.min(max || 9999, current + command.delta));
      const delta = next - current;
      if (!delta) { appendAiMessage(panel, 'assistant', `${target.name} já está no limite correspondente. Nenhuma alteração necessária.`); return; }
      const item = { id: `presence-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, command, playerId: String(target.id), expectedHp: current, nextHp: next, title: `${target.name}: ${delta < 0 ? 'perder' : 'recuperar'} ${Math.abs(delta)} PV`, detail: `PV: ${current} → ${next}. Reconhecido: “${transcript}”` };
      presencePending.push(item);
      setPresenceState(`COMANDO DETECTADO · ${presencePending.length} ação(ões) aguardando aprovação.`);
      renderPresenceQueue(panel);
    };
    const startPresence = (panel) => {
      const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
      if (!SpeechRecognition) { setPresenceState('INDISPONÍVEL · Este navegador não oferece reconhecimento de fala compatível.', false); return; }
      try {
        const recognition = new SpeechRecognition(); presenceRecognition = recognition; presenceActive = true;
        recognition.lang = 'pt-BR'; recognition.continuous = true; recognition.interimResults = false; recognition.maxAlternatives = 1;
        recognition.onresult = (event) => { for (let i = event.resultIndex; i < event.results.length; i++) { if (event.results[i].isFinal) queuePresenceCommand(event.results[i][0]?.transcript || '', panel); } };
        recognition.onerror = (event) => { if (event.error === 'not-allowed' || event.error === 'service-not-allowed') stopPresence('PERMISSÃO NEGADA · Libere o microfone no navegador para iniciar.'); else setPresenceState(`ESCUTA COM AVISO · ${event.error || 'falha no reconhecimento'}`); };
        recognition.onend = () => { if (presenceActive && presenceRecognition === recognition) { try { recognition.start(); } catch { setPresenceState('RECONEXÃO DE ÁUDIO · Tentando retomar a escuta.'); } } };
        recognition.start(); setPresenceState('ESCUTANDO · Aguardando comandos de PV. A Ashen permanecerá em silêncio.', true);
      } catch { stopPresence('NÃO FOI POSSÍVEL INICIAR · Verifique a permissão do microfone e o HTTPS.'); }
    };
    const sendAshenMessage = async (panel, forcedQuestion = '') => {
      const input = panel?.querySelector('[data-ashen-ai-input]');
      const button = panel?.querySelector('[data-ashen-ai-send]');
      const question = String(forcedQuestion || input?.value || '').trim();
      if (!question || aiBusy) return;
      const token = (() => { try { return windowObj.sessionStorage.getItem('a_profecia_auth_token_v1') || ''; } catch { return ''; } })();
      if (!token) { appendAiMessage(panel, 'assistant', 'Sua sessão não foi encontrada. Entre novamente como Mestre.'); return; }
      aiBusy = true;
      if (input && !forcedQuestion) input.value = '';
      aiConversation.push({ role: 'user', content: question });
      appendAiMessage(panel, 'user', question);
      if (button) { button.disabled = true; button.textContent = 'CONSULTANDO…'; }
      const moduleName = String(documentObj.querySelector('#main-content')?.className || 'geral').replace(/^.*\b(main-[a-z-]+)\b.*$/, '$1').slice(0, 60);
      try {
        const response = await fetch('/api/ashen-ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ module: moduleName, messages: aiConversation.slice(-12), integrity: integritySnapshot() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.ok) throw new Error(result?.message || result?.error || 'Não foi possível consultar a Ashen AI.');
        const answer = String(result.message || '').trim();
        aiConversation.push({ role: 'assistant', content: answer });
        appendAiMessage(panel, 'assistant', answer);
        if (result.context?.sources?.length) {
          const sourceNames = result.context.sources.map((source) => source.title).filter(Boolean).join(' · ');
          appendAiMessage(panel, 'assistant', `FONTES CONSULTADAS: ${sourceNames}`);
        } else {
          appendAiMessage(panel, 'assistant', 'CONTEXTO: nenhum registro relevante encontrado no Arquivo de Campanha.');
        }
      } catch (error) {
        appendAiMessage(panel, 'assistant', String(error?.message || 'Falha ao consultar a Ashen AI.'));
      } finally {
        aiBusy = false;
        if (button) { button.disabled = false; button.textContent = 'CONSULTAR ↗'; }
        input?.focus();
      }
    };

    const open = (id) => {
      const config = WINDOWS[id];
      if (!config) return;
      let panel = layer.querySelector(`[data-wm-window="${id}"]`);
      if (!panel) {
        panel = documentObj.createElement('section');
        panel.className = 'ashen-float-window';
        panel.dataset.wmWindow = id;
        panel.style.zIndex = String(++highestZ);
        panel.innerHTML = `<header class="ashen-float-head"><div><small>${config.code}</small><strong>${config.title}</strong></div><div class="ashen-float-controls"><button type="button" data-wm-min="${id}" aria-label="Minimizar">−</button><button type="button" data-wm-close="${id}" aria-label="Fechar">×</button></div></header><div class="ashen-float-content">${config.body}</div><footer><span>ASHEN TESTIMONY</span><span>LOCAL WORKSPACE // ${id.toUpperCase()}</span></footer>`;
        const offset = layer.querySelectorAll('.ashen-float-window').length;
        panel.style.left = `${Math.max(12, windowObj.innerWidth - 430 - offset * 28)}px`;
        panel.style.top = `${Math.max(72, 96 + offset * 26)}px`;
        layer.append(panel);
        if (id === 'ashen-ai') { renderAiConversation(panel); renderPresenceQueue(panel); setPresenceState(presenceActive ? 'ESCUTANDO · Aguardando comandos de PV. A Ashen permanecerá em silêncio.' : 'DESATIVADO · Nenhum áudio está sendo capturado.'); }
      }
      panel.hidden = false;
      panel.classList.remove('is-minimized');
      panel.style.zIndex = String(++highestZ);
      preferences.open = [...new Set([...preferences.open, id])];
      preferences.minimized = preferences.minimized.filter((item) => item !== id);
      savePreferences(preferences);
    };
    const close = (id) => {
      if (id === 'ashen-ai') stopPresence();
      layer.querySelector(`[data-wm-window="${id}"]`)?.remove();
      preferences.open = preferences.open.filter((item) => item !== id);
      preferences.minimized = preferences.minimized.filter((item) => item !== id);
      savePreferences(preferences);
    };
    const minimize = (id) => {
      const panel = layer.querySelector(`[data-wm-window="${id}"]`);
      if (!panel) return;
      panel.classList.toggle('is-minimized');
      const isMinimized = panel.classList.contains('is-minimized');
      preferences.minimized = isMinimized ? [...new Set([...preferences.minimized, id])] : preferences.minimized.filter((item) => item !== id);
      savePreferences(preferences);
    };

    dock.addEventListener('click', (event) => {
      const button = event.target.closest('[data-wm-open]');
      if (button) open(button.dataset.wmOpen);
    });
    layer.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-ashen-ai-form]');
      if (!form) return;
      event.preventDefault();
      sendAshenMessage(form.closest('[data-wm-window="ashen-ai"]'));
    });
    layer.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || !event.target.matches('[data-ashen-ai-input]')) return;
      event.preventDefault();
      sendAshenMessage(event.target.closest('[data-wm-window="ashen-ai"]'));
    });
    layer.addEventListener('click', async (event) => {
      const presenceToggle = event.target.closest('[data-ashen-presence-toggle]');
      const presenceApprove = event.target.closest('[data-ashen-approve]');
      const presenceCancel = event.target.closest('[data-ashen-cancel]');
      const integrityButton = event.target.closest('[data-ashen-ai-integrity]');
      const activePanel = event.target.closest('[data-wm-window="ashen-ai"]');
      if (presenceToggle && activePanel) { if (presenceActive) stopPresence(); else startPresence(activePanel); return; }
      if (presenceCancel) { const index = presencePending.findIndex((item) => item.id === presenceCancel.dataset.ashenCancel); if (index >= 0) presencePending.splice(index, 1); renderPresenceQueue(activePanel); setPresenceState(`${presencePending.length} ação(ões) aguardando aprovação.`); return; }
      if (presenceApprove) {
        const index = presencePending.findIndex((item) => item.id === presenceApprove.dataset.ashenApprove);
        if (index < 0) return;
        const item = presencePending[index]; presenceApprove.disabled = true;
        try {
          if (typeof windowObj.__ashenApplySessionHp !== 'function') throw new Error('A integração com as fichas ainda não está disponível.');
          const result = await windowObj.__ashenApplySessionHp({ playerId: item.playerId, delta: item.nextHp - item.expectedHp, expectedHp: item.expectedHp });
          if (!result?.ok) throw new Error(result?.message || 'Não foi possível aplicar a alteração.');
          presencePending.splice(index, 1); appendAiMessage(activePanel, 'assistant', `${result.name}: PV atualizados de ${result.previousHp} para ${result.hp}.`);
        } catch (error) { appendAiMessage(activePanel, 'assistant', String(error?.message || error)); }
        renderPresenceQueue(activePanel); setPresenceState(`${presencePending.length} ação(ões) aguardando aprovação.`); return;
      }
      if (integrityButton && activePanel) {
        const question = 'Analise a verificação de integridade atual do site. Diferencie problemas confirmados, alertas e limitações do diagnóstico. Não afirme que corrigiu nada; recomende os próximos passos seguros.';
        integrityButton.disabled = true; integrityButton.textContent = 'ANALISANDO…';
        const input = activePanel.querySelector('[data-ashen-ai-input]');
        if (input) input.value = question;
        try { if (typeof windowObj.__aProfeciaRunIntegrityCheck === 'function') await windowObj.__aProfeciaRunIntegrityCheck(); await sendAshenMessage(activePanel, question); } finally { integrityButton.disabled = false; integrityButton.textContent = 'VERIFICAR INTEGRIDADE ↗'; if (input) input.value = ''; }
        return;
      }
      const closeButton = event.target.closest('[data-wm-close]');
      const minButton = event.target.closest('[data-wm-min]');
      const panel = event.target.closest('.ashen-float-window');
      if (panel) panel.style.zIndex = String(++highestZ);
      if (closeButton) close(closeButton.dataset.wmClose);
      if (minButton) minimize(minButton.dataset.wmMin);
      const openButton = event.target.closest('[data-wm-open]');
      if (openButton && layer.contains(openButton)) open(openButton.dataset.wmOpen);
    });
    layer.addEventListener('pointerdown', (event) => {
      const head = event.target.closest('.ashen-float-head');
      if (!head || event.target.closest('button')) return;
      const panel = head.closest('.ashen-float-window');
      const startX = event.clientX, startY = event.clientY;
      const rect = panel.getBoundingClientRect();
      const move = (moveEvent) => {
        const next = clampWindowPosition({ x: rect.left + moveEvent.clientX - startX, y: rect.top + moveEvent.clientY - startY }, { width: windowObj.innerWidth - panel.offsetWidth + 320, height: windowObj.innerHeight - 120 + 240 });
        panel.style.left = `${next.x}px`; panel.style.top = `${next.y}px`;
      };
      const stop = () => { documentObj.removeEventListener('pointermove', move); documentObj.removeEventListener('pointerup', stop); };
      documentObj.addEventListener('pointermove', move); documentObj.addEventListener('pointerup', stop, { once: true });
    });
    preferences.open.forEach((id) => open(id));
    preferences.minimized.forEach((id) => minimize(id));
  };

  observer = new MutationObserver(mount);
  observer.observe(root, { childList: true, subtree: false });
  mount();
  return () => { presenceActive = false; try { presenceRecognition?.stop(); } catch {} observer?.disconnect(); documentObj.getElementById('ashen-window-dock')?.remove(); documentObj.getElementById('ashen-window-layer')?.remove(); delete root.dataset.ashenWindowManager; };
}
