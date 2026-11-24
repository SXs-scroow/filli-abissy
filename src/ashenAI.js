import { cleanAshenMessages } from './ashenAIEngine.js';

const history = [];
let busy = false;
const pendingActions = [];
let errorMessage = '';
let boundRoot = null;
let activeToken = '';
let voiceOutputEnabled = false;
let listening = false;
let recognition = null;
let speechStatus = '';
let voiceDraft = '';


function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function actionLabel(action) {
  if (!action) return '';
  if (action.type === 'change_resource') return `${action.delta > 0 ? 'Recuperar' : 'Remover'} ${Math.abs(action.delta)} ${action.resource === 'hp' ? 'ponto(s) de vida' : 'ponto(s) de sanidade'} de ${action.targetName}`;
  if (action.type === 'set_initiative') return `Definir iniciativa de ${action.targetName} para ${action.value}`;
  if (action.type === 'advance_turn') return 'Avançar para o próximo turno';
  if (action.type === 'set_condition') return `Aplicar ${action.conditionName} em ${action.targetName}`;
  if (action.type === 'remove_condition') return `Remover ${action.conditionName} de ${action.targetName}`;
  if (action.type === 'manage_inventory') return `${action.operation === 'add' ? 'Adicionar' : 'Remover'} ${action.quantity} × ${action.itemName} ${action.operation === 'add' ? 'na mochila de' : 'da mochila de'} ${action.targetName}`;
  if (action.type === 'record_campaign_event') return `Registrar “${action.title}” no Arquivo da campanha`;
  if (action.type === 'save_memory') return `Guardar memória “${action.title}”`;
  if (action.type === 'archive_memory') return `Arquivar memória “${action.title}”`;
  return 'Ação não reconhecida';
}

function voiceSupported() {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function speak(text) {
  if (!voiceOutputEnabled || typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 2500));
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.pitch = 0.96;
    window.speechSynthesis.speak(utterance);
  } catch { speechStatus = 'Não foi possível reproduzir áudio neste navegador.'; }
}
function render(root) {
  if (!root) return;
  const transcript = history.map(m => `<article class="ashen-ai-message ${m.role}"><b>${m.role === 'assistant' ? 'ASHEN' : 'VOCÊ'}</b><p>${esc(m.content)}</p></article>`).join('');
  const micAvailable = voiceSupported();
  const voiceAvailable = typeof window !== 'undefined' && Boolean(window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined');
  root.innerHTML = `<section class="ashen-ai-panel" aria-label="Ashen AI"><header class="ashen-ai-head"><div><span class="section-kicker">ASHEN TESTIMONY · ASSISTENTE DE SESSÃO</span><h2>✦ Ashen AI</h2><p>Conversa, consulta a sessão, lembra da campanha e prepara ações para o Mestre.</p></div><span class="ashen-ai-status">${busy ? 'PROCESSANDO' : listening ? 'OUVINDO' : 'MOTOR ATIVO'}</span></header><div class="ashen-ai-log" data-ashen-ai-log aria-live="polite">${transcript || '<div class="ashen-ai-empty">Pergunte sobre personagens, combate, regras, a cena ou os registros da campanha.</div>'}${busy ? '<div class="ashen-ai-message assistant"><b>ASHEN</b><p>Estou analisando o contexto da sessão…</p></div>' : ''}${errorMessage ? `<div class="ashen-ai-error">${esc(errorMessage)}</div>` : ''}</div>${pendingActions.length ? `<div class="ashen-ai-actions"><div class="section-kicker">${pendingActions.length} AÇÃO(ÕES) PROPOSTA(S) · CONFIRME INDIVIDUALMENTE</div>${pendingActions.map((action, index) => `<div class="ashen-ai-action" data-ashen-ai-action-row="${index}"><div><strong>${esc(actionLabel(action))}</strong></div><div class="row"><button type="button" class="btn primary" data-ashen-ai-confirm="${index}">Confirmar</button><button type="button" class="btn" data-ashen-ai-cancel="${index}">Cancelar</button></div></div>`).join('')}</div>` : ''}<form class="ashen-ai-form" data-ashen-ai-form><textarea name="message" rows="2" maxlength="6000" placeholder="Ex.: Engel falhou no teste de Fortitude. Aplique Sangramento e registre a descoberta no Arquivo." ${busy ? 'disabled' : ''}>${esc(voiceDraft)}</textarea><div class="ashen-ai-controls"><div class="ashen-ai-voice-controls"><button type="button" class="btn" data-ashen-ai-voice-input ${busy || !micAvailable ? 'disabled' : ''} aria-pressed="${listening ? 'true' : 'false'}" title="${micAvailable ? 'Falar com o Ashen' : 'Reconhecimento de voz não compatível neste navegador'}">${listening ? '■ Parar voz' : '🎙 Falar'}</button><button type="button" class="btn" data-ashen-ai-voice-toggle ${!voiceAvailable ? 'disabled' : ''} aria-pressed="${voiceOutputEnabled ? 'true' : 'false'}" title="${voiceAvailable ? 'Ativar/desativar respostas faladas' : 'Áudio não compatível neste navegador'}">${voiceOutputEnabled ? '🔊 Voz ligada' : '🔇 Voz desligada'}</button></div><button class="btn primary" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Pensando…' : 'Enviar'}</button></div></form>${speechStatus ? `<div class="ashen-ai-voice-status" role="status">${esc(speechStatus)}</div>` : ''}<footer>O Ashen consulta fichas, condições, inventário, combate, regras estruturadas, Arquivo e memória persistente. Ações que alteram dados só são aplicadas após sua confirmação.</footer></section>`;
  const log = root.querySelector('[data-ashen-ai-log]'); if (log) log.scrollTop = log.scrollHeight;
}

export function bindAshenAI({ root = document.querySelector('[data-ashen-ai-root]'), getToken, getContext, executeAction } = {}) {
  if (!root || boundRoot === root && root.dataset.ashenAiBound === '1') return;
  boundRoot = root;
  root.dataset.ashenAiBound = '1';
  render(root);
  root.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-ashen-ai-form]');
    if (!form || busy) return;
    event.preventDefault();
    const field = form.elements.message;
    const prompt = String(field?.value || '').trim();
    if (!prompt) return;
    const token = typeof getToken === 'function' ? getToken() : '';
    if (token && activeToken && token !== activeToken) {
      history.length = 0; pendingActions.length = 0; errorMessage = ''; voiceDraft = ''; speechStatus = '';
      if (recognition) { try { recognition.stop(); } catch {} recognition = null; }
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel?.();
    }
    if (token) activeToken = token;
    if (!token) { errorMessage = 'Sua sessão de Mestre não foi encontrada. Entre novamente.'; render(root); return; }
    voiceDraft = '';
    history.push({ role: 'user', content: prompt });
    busy = true; errorMessage = ''; pendingActions.length = 0; render(root);
    try {
      const context = await getContext();
      const response = await fetch('/api/ashen-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: cleanAshenMessages(history), context })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || `Falha ao consultar o Ashen (${response.status}).`);
      const reply = String(data.reply || 'Não consegui responder agora.');
      history.push({ role: 'assistant', content: reply });
      pendingActions.splice(0, pendingActions.length, ...(Array.isArray(data.actions) ? data.actions : data.action ? [data.action] : []));
      speak(reply);
    } catch (error) {
      history.pop();
      voiceDraft = prompt;
      errorMessage = String(error?.message || 'Não foi possível consultar o Ashen AI.');
    } finally { busy = false; render(boundRoot || root); }
  });
  root.addEventListener('input', event => {
    if (event.target.matches('[name="message"]')) voiceDraft = String(event.target.value || '').slice(0, 6000);
  });
  root.addEventListener('click', async (event) => {
    if (event.target.closest('[data-ashen-ai-voice-toggle]')) {
      if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') { speechStatus = 'Este navegador não oferece síntese de voz.'; render(root); return; }
      voiceOutputEnabled = !voiceOutputEnabled;
      speechStatus = voiceOutputEnabled ? 'Respostas faladas ativadas.' : 'Respostas faladas desativadas.';
      if (!voiceOutputEnabled) window.speechSynthesis.cancel();
      render(root); return;
    }
    if (event.target.closest('[data-ashen-ai-voice-input]')) {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) { speechStatus = 'Este navegador não oferece reconhecimento de voz. Use Chrome ou Edge em uma conexão segura.'; render(root); return; }
      if (listening && recognition) { recognition.stop(); return; }
      try {
        recognition = new Recognition(); recognition.lang = 'pt-BR'; recognition.interimResults = true; recognition.continuous = false;
        listening = true; speechStatus = 'Estou ouvindo. Fale seu pedido e depois revise o texto antes de enviar.'; render(root);
        recognition.onresult = event => {
          const transcriptText = [...event.results].filter(result => result.isFinal).map(result => result[0]?.transcript || '').join(' ').trim();
          const field = root.querySelector('[name="message"]');
          if (field && transcriptText) { voiceDraft = [voiceDraft, transcriptText].filter(Boolean).join(' ').slice(0, 6000); field.value = voiceDraft; }
        };
        recognition.onerror = event => { speechStatus = event.error === 'not-allowed' ? 'Permissão de microfone negada.' : `Falha no reconhecimento de voz: ${event.error || 'erro desconhecido'}.`; };
        recognition.onend = () => { listening = false; recognition = null; render(root); };
        recognition.start();
      } catch (error) { listening = false; recognition = null; speechStatus = String(error?.message || 'Não foi possível iniciar o microfone.'); render(root); }
      return;
    }
    const cancelButton = event.target.closest('[data-ashen-ai-cancel]');
    if (cancelButton) { const index = Number(cancelButton.dataset.ashenAiCancel); if (Number.isInteger(index) && index >= 0) pendingActions.splice(index, 1); render(root); return; }
    const confirmButton = event.target.closest('[data-ashen-ai-confirm]');
    if (!confirmButton || !pendingActions.length || busy) return;
    const index = Number(confirmButton.dataset.ashenAiConfirm);
    const action = pendingActions[Number.isInteger(index) && index >= 0 ? index : 0];
    if (!action) return;
    if (typeof executeAction !== 'function') { errorMessage = 'A execução de ações não está disponível nesta tela.'; render(root); return; }
    busy = true; errorMessage = ''; render(root);
    try {
      const result = await executeAction(action);
      const confirmation = result || 'Ação confirmada e executada.';
      history.push({ role: 'assistant', content: confirmation });
      pendingActions.splice(pendingActions.indexOf(action), 1);
      speak(confirmation);
    } catch (error) { errorMessage = String(error?.message || 'Não foi possível executar a ação.'); }
    finally { busy = false; render(boundRoot || root); }
  });
}
