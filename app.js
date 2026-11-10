import { remoteEnabled, fetchGlobal, pushGlobal, backupGlobal, listGlobalBackups, uploadGlobalFile, subscribeGlobal, subscribeLive, broadcastLive, authMasterLogin, authPlayerLogin, authRegisterPlayer, authLogout, authCheck, changeMasterPassword, changePlayerPassword, getPlayerMasterSecret, savePlayerMasterSecret, listSessionPuzzles, saveSessionPuzzle, deleteSessionPuzzle, unlockSessionPuzzle, getSessionMasterNotes, saveSessionMasterNotes, authErrorText, getAuthToken, syncHealth } from './src/globalSync.js';
import { buildTerminalModel, terminalDesktopMarkup as kitDesktopMarkup, bootDuration, terminalCommand, termAudioPrime, sfx, playBootSound, stopBootSound, disposeAudioPlayers, pauseAudioPlayers, bindAudioPlayers, bindTerminalAudioUi, bindLoginSfx, startTerminalClock, runFsckSim, clockText, corruptText, normalizeLevel, CORRUPTION_LEVELS, TERMINAL_FOLDERS } from './src/terminalKit.js';
import { playerStoreEnabled, fetchPlayers as fetchPlayerRows, fetchPlayersByIds, upsertPlayers, deletePlayerServer, restorePlayerServer, subscribePlayers, fetchPlayerHistory, fetchPlayerHistoryEntry } from './src/playerStore.js';
import { ps, initPlayers, PLAYER_ROSTER_CACHE_KEY, playerSyncKey, markLocalPlayerChanges, mergePlayersRemote, playerRowDeletedStamp, fetchPlayerRowsConfirmed, applyPlayerRows, hydratePlayersDb, syncPlayersDbNow, queuePlayerDbSave, reconcilePlayersStability, mergeRollHistory } from './src/players.js';
import { nextStamp } from './src/stampClock.js';
import { configureSyncCoordinator, enqueueGlobalSnapshot } from './src/syncCoordinator.js';
import { campaignMapPage, bindCampaignMap } from './src/campaignMap.js';
import { loadAdmin, runPlayerStressTest, runPersistenceSelfTest, runDeploymentCacheSelfTest, runPerformanceDiagnosticsSelfTest, bindPerformanceReportExport } from './src/loadTest.js';
import { startPerformanceMonitor } from './src/performance/performanceDiagnostics.js';
try{startPerformanceMonitor()}catch{}
const APP_VERSION='V1.5.76 · ASHEN TESTIMONY · FINAL HARDENING';
try{window.__ASHEN_BUILD=APP_VERSION}catch{}
let loadFailed=false;
let saveTimer=0,saveDirty=false,saveFirstAt=0,lastRecoveryAt=0;
let stabilityPlayerPollTimer=0,globalPollTimer=0;
let stabilityOnlineHandlerBound=false;
let sessionGuardianTimer=0;
let sessionGuardianBusy=false;
let sessionGuardianBound=false;
const sessionGuardian={state:'checking',message:'Verificando o estado do site…',lastCheck:0,failures:0};
let lastRenderSig='',renderOpts={},renderSkipped=false,deferredRemoteRender=false;
const COMBAT_DEFAULT={atkMult:4,defMult:5,atkMin:0,defMin:0,atkCap:10,defCap:15};
const FRACTURE_DAMAGE=3;
const WEAKENED_PENALTY=2;
const DET_DEFAULT_MAX=12;
let immersiveTab='';
let immBagSel=-1;
let immBagMoveArmed=false,immBagPrevIds=null,immBagIntro=false,immBagFlashIdx=-1;
let immersiveViewMode='personal';
let immersivePuzzleCache=[];
let immersivePuzzleStatus='idle';
let immersivePuzzleStatusMessage='';
let puzzleSchemaWarningLogged=false;
let immersivePuzzleSessionId='';
let immersivePuzzleOwnerId='';
let immersivePuzzleUnlocked={};
let immersiveTerminalOpenFiles={};
let immersiveTerminalBooting={};
let immersiveTerminalBootStart={};
let immersiveTerminalBootTimers={};
let immersiveTerminalCwd={};
let immersiveTerminalHistory={};
let immersiveTerminalSince={};
let immersiveTerminalFresh=false;
function resetTerminalUiState(){Object.values(immersiveTerminalBootTimers).forEach(t=>clearTimeout(t));immersiveTerminalOpenFiles={};immersiveTerminalBooting={};immersiveTerminalBootStart={};immersiveTerminalBootTimers={};immersiveTerminalCwd={};immersiveTerminalHistory={};immersiveTerminalSince={};try{stopBootSound();disposeAudioPlayers()}catch{}}
function clearImmersivePuzzleState(){immersivePuzzleCache=[];immersivePuzzleStatus='idle';immersivePuzzleStatusMessage='';immersivePuzzleSessionId='';immersivePuzzleOwnerId='';immersivePuzzleUnlocked={};resetTerminalUiState();}
function prefersReducedMotion(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}}
function pushTerminalHistory(pid,entry){if(!entry)return;const h=immersiveTerminalHistory[pid]||(immersiveTerminalHistory[pid]=[]);h.push(entry);if(h.length>12)h.splice(0,h.length-12)}
function finishTerminalBoot(pid,sid,owner,skipped){
  clearTimeout(immersiveTerminalBootTimers[pid]);delete immersiveTerminalBootTimers[pid];
  if(!immersiveTerminalBooting[pid])return;
  if(String(state.combatSession?.sessionId||'')!==sid||String(state.session?.playerId||state.session?.login||'')!==owner)return;
  immersiveTerminalBooting[pid]=false;if(skipped){stopBootSound();sfx('open')}
  if(currentView==='immersive'&&immersiveTab==='puzzles'){immersiveTerminalFresh=true;try{render('immersive')}finally{immersiveTerminalFresh=false}}
}
function startTerminalBoot(pid,unlocked,label,sid,owner){
  const model=buildTerminalModel(pid,unlocked);
  immersiveTerminalSince[pid]=Date.now();
  if(prefersReducedMotion()){immersiveTerminalBooting[pid]=false;sfx('granted');return}
  immersiveTerminalBooting[pid]=true;immersiveTerminalBootStart[pid]=Date.now();
  playBootSound(model,label);
  clearTimeout(immersiveTerminalBootTimers[pid]);
  immersiveTerminalBootTimers[pid]=setTimeout(()=>finishTerminalBoot(pid,sid,owner,false),bootDuration(model,label)+60);
}
const immDraft={diary:null,notes:null};
const DET_SVG=`<svg class="det-sigil" viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor"><rect x="19" y="30" width="28" height="28" rx="13"/><rect x="12" y="15" width="7" height="27" rx="3.5" transform="rotate(-16 15 28)"/><rect x="22" y="5" width="7" height="33" rx="3.5"/><rect x="32" y="3" width="7" height="35" rx="3.5"/><rect x="42" y="9" width="7" height="31" rx="3.5" transform="rotate(11 45 24)"/><rect x="46" y="31" width="7" height="20" rx="3.5" transform="rotate(52 49 41)"/></g></svg>`;
const CURTAIN_CLOSED_SVG=`<svg class="curtain-sigil curtain-closed" viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor"><rect x="3" y="5" width="58" height="6" rx="3"/><path d="M6.0 12h5.3v41q-2.65 4-5.3 0z"/><path d="M12.5 12h5.3v44q-2.65 4-5.3 0z"/><path d="M19.0 12h5.3v41q-2.65 4-5.3 0z"/><path d="M25.5 12h5.3v44q-2.65 4-5.3 0z"/><path d="M32.0 12h5.3v41q-2.65 4-5.3 0z"/><path d="M38.5 12h5.3v44q-2.65 4-5.3 0z"/><path d="M45.0 12h5.3v41q-2.65 4-5.3 0z"/><path d="M51.5 12h5.3v44q-2.65 4-5.3 0z"/></g></svg>`;
const CURTAIN_SVG=`<svg class="curtain-sigil" viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor"><rect x="4" y="5" width="56" height="6" rx="3"/><path d="M8 12h16c-1 10-6 16-6 26 0 8 3 14 6 20H8z"/><path d="M56 12H40c1 10 6 16 6 26 0 8-3 14-6 20h16z"/></g></svg>`;

const MAX_HP=45, MAX_BAG=10, MAX_ATTR=8, MAX_SKILL=15, KEY='filii_abyssi_state_v15';
const DEFAULT_RULES={campaign:{attrPoints:8,skillPoints:15,hpMax:45},slasher:{attrPoints:30,skillPoints:30,hpMax:100}};
const CLASS_BONUSES_DEFAULTS_V107={Mercenário:{Força:2,'Tolerância à Dor':3},Ocultista:{Fé:2,Ocultismo:3},Herege:{Determinação:2,Sanidade:2},Guerreiro:{Corpo:2,Determinação:1},Caçador:{Percepção:3,Agilidade:1},'Mago Amarelo':{Fé:2,Determinação:3},Sacerdote:{Fé:3,Conhecimento:2},Atleta:{Agilidade:1,Atletismo:2},'Engenheiro civil':{Conhecimento:1,Investigação:2},Mecânico:{Reflexo:1,Conhecimento:2},'Lutador profissional':{Força:1,Luta:2},Herbalista:{Conhecimento:1,Herbalismo:2},Vigilante:{Percepção:1,Pontaria:2},Médico:{Conhecimento:1,Medicina:2}};
const DEFAULT_CLASS_BONUSES=CLASS_BONUSES_DEFAULTS_V107;
const BG_DB_NAME='a-profecia-backgrounds-v1', BG_STORE='backgrounds';
const BG_DEFS={global:['Fundo geral','fundo-geral.webp'],login:['Tela de login','fundo-geral.webp'],home:['Início / Home','inicio-moldura.webp'],sheet:['Ficha / Pergaminho','ficha-pergaminho.webp'],profile:['Cabeçalho da ficha','inicio-moldura.webp'],classes:['Página de Classes','fundo-geral.webp'],master:['Câmara do Mestre','fundo-geral.webp']};
const IMAGE_PICK_MAX_BYTES=40*1024*1024;
const SUPPORTED_IMAGE_EXT=/\.(png|jpe?g|jfif|webp|avif|gif|bmp|heic|heif)$/i;
function isSupportedImageFile(file){if(!file)return false;return /^image\//i.test(file.type||'')||SUPPORTED_IMAGE_EXT.test(file.name||'')}

const ATTRS=['Corpo','Força','Agilidade','Sanidade','Determinação','Percepção','Lábia','Fé','Tolerância à Dor','Conhecimento'];
const SKILLS=['Armas Brancas','Luta','Pontaria','Atletismo','Acrobacia','Esquiva','Tolerância à Dor','Resistência','Iniciativa','Sobrevivência','Caça','Rastreamento','Furtividade','Armadilhas','Medicina','Herbalismo','Adestramento','Crime','Percepção','Investigação','Reflexo','Ocultismo','Rituais','Religião','Alquimia','História','Intuição','Concentração','Resistência Mental','Persuasão','Enganação','Empatia','Liderança','Intimidação'];

const ATTR_ICONS={'Corpo':'◈','Força':'✦','Agilidade':'⌁','Sanidade':'◉','Determinação':'◒','Percepção':'◌','Lábia':'◍','Fé':'†','Tolerância à Dor':'⬢','Conhecimento':'✎'};
const DEFAULT_ATTR_ICONS={...ATTR_ICONS};
const DEFAULT_SKILL_ICONS=Object.fromEntries(SKILLS.map((s,i)=>[s,['◆','◇','✦','✧','◈','⌁','✥','✣','✺','✹'][i%10]]));
const INITIAL_SPELLS=[
 {id:'worm-rot',name:'Magia dos Vermes — Apodrecer',school:'Primeiro Círculo • Vermes',cost:'5 Mente',description:'Corrompe o alvo por dentro, deixando-o mais vulnerável e aumentando o dano recebido em 1d6.',image:''},
 {id:'flower-pheromones',name:'Magia de Flor — Feromônios',school:'Primeiro Círculo • Flor',cost:'5 Mente',description:'Marca uma criatura viva para atrair a atenção das demais criaturas contra ela, com vantagem para os ataques direcionados ao alvo.',image:''},
 {id:'blood-necromancy',name:'Magia de Sangue — Necromancia',school:'Primeiro Círculo • Sangue',cost:'8 Mente',description:'Tenta devolver movimento a um cadáver recente. Se o ritual falhar, o cadáver pode se tornar hostil; se funcionar, o conjurador pode impor ordens.',image:''},
 {id:'longinus',name:'Milagres de Providência — Longinus',school:'Primeiro Círculo • Providência',cost:'8 Mente',description:'Invoca uma lança de sangue sobrenatural para a batalha; após o confronto, a arma se desfaz.',image:''},
 {id:'blood-sword',name:'Milagres de Providência — Espada de Sangue',school:'Primeiro Círculo • Providência',cost:'5 Mente',description:'Invoca uma espada de sangue sobrenatural para combate; a arma desaparece depois da batalha.',image:''},
 {id:'reveal-aura',name:'Magia Onírica — Revelar Aura',school:'Primeiro Círculo • Onírica',cost:'—',description:'Revela a posição de criaturas com intenções hostis dentro de uma área de 15 metros.',image:''},
 {id:'needle-worm',name:'Magia Negra — Verme Agulha',school:'Primeiro Círculo • Negra',cost:'5 Mente',description:'Usa uma massa de parasitas para atingir o torso e recuperar Vida na mesma medida do dano causado.',image:''},
 {id:'pyromancy',name:'Magia da Terra — Truque de Piromancia',school:'Primeiro Círculo • Terra',cost:'9 Mente',description:'Um truque de fogo que causa 1d8 de dano e pode aplicar o estado Queimadura.',image:''}
,
 {id:'ward-of-ash',name:'Manto de Cinzas',school:'Proteção • Cinzas',cost:'4 Mente',description:'Cria uma película de cinzas que reduz o próximo dano sofrido em 1d6.',image:''},
 {id:'whisper-door',name:'Sussurro da Porta',school:'Ocultismo • Espaço',cost:'3 Mente',description:'Permite ouvir o outro lado de uma porta ou passagem por alguns instantes, sem abri-la.',image:''},
 {id:'black-thread',name:'Fio Negro',school:'Maldição • Sombra',cost:'6 Mente',description:'Liga o conjurador a um alvo visível. Enquanto o vínculo durar, o Mestre pode aplicar uma consequência narrativa quando o alvo fugir.',image:''},
 {id:'salt-circle',name:'Círculo de Sal',school:'Ritual • Proteção',cost:'2 Mente',description:'Marca uma área pequena que criaturas sobrenaturais hesitam em atravessar.',image:''},
 {id:'red-eye',name:'Olho Vermelho',school:'Percepção • Sangue',cost:'4 Mente',description:'Permite enxergar rastros recentes de sangue, feridas e sinais de luta.',image:''},
 {id:'memory-fragment',name:'Fragmento de Memória',school:'Onírica • Mente',cost:'7 Mente',description:'Recupera uma lembrança perdida ou parcialmente bloqueada. A cena pode vir incompleta ou distorcida.',image:''},
 {id:'bone-lock',name:'Tranca de Osso',school:'Ritual • Matéria',cost:'5 Mente',description:'Reforça uma porta, gaveta ou passagem com uma trava sobrenatural temporária.',image:''},
 {id:'hollow-step',name:'Passo Vazio',school:'Movimento • Sombra',cost:'8 Mente',description:'Apaga brevemente o som dos passos do conjurador e dificulta sua percepção.',image:''},
 {id:'sanguine-mark',name:'Marca Sanguínea',school:'Sangue • Vínculo',cost:'3 Mente',description:'Marca uma criatura ou objeto para que o conjurador possa reconhecê-lo novamente à distância curta.',image:''},
 {id:'fever-dream',name:'Sonho Febril',school:'Onírica • Controle',cost:'6 Mente',description:'Impõe uma sensação de sonho ou desorientação a um alvo por alguns instantes.',image:''},
 {id:'iron-breath',name:'Respiração de Ferro',school:'Corpo • Ritual',cost:'5 Mente',description:'Permite resistir a fumaça, poeira e ambientes de ar ruim por uma cena curta.',image:''},
 {id:'lantern-of-the-dead',name:'Lanterna dos Mortos',school:'Necromancia • Luz',cost:'10 Mente',description:'Revela presenças sobrenaturais próximas através de uma luz fria e instável.',image:''},
 {id:'miasma',name:'Miasma',school:'Morte 2',cost:'—',description:'Execução: padrão\nAlcance: médio\nÁrea: nuvem com 6m de raio\nDuração: instantânea\nResistência: Fortitude (veja texto)\n\nA área é coberta por emanações tóxicas letais. Criaturas na área sofrem 5d6 pontos de dano de veneno e ficam enjoadas por 1 rodada. Se passarem na resistência, sofrem metade do dano e não ficam enjoadas.\n\nDiscente (+3 PE): muda o tipo do dano para Morte.\n\nVerdadeiro (+7 PE): aumenta o dano para 8d6 e muda o tipo de dano para Morte. Personagens dentro da nuvem não podem respirar. Requer 4º círculo.',image:'/spells/miasma.webp'},
 {id:'chamas-do-caos',name:'Chamas do Caos',school:'Energia 2',cost:'—',description:'Execução: padrão\nAlcance: curto\nAlvo: veja texto\nDuração: cena\n\nVocê manipula o calor e o fogo. Ao conjurar o ritual, escolha um dos seguintes efeitos.\n\nChamejar: o alvo é uma arma corpo a corpo. Ela causa +1d6 pontos de dano de fogo.\n\nEsquentar: o alvo é um objeto, que começa a esquentar. Ele sofre 1d6 pontos de dano de fogo por rodada e causa o mesmo dano a qualquer ser que o esteja empunhando ou vestindo. A critério do mestre, o objeto ou o ser pode pegar fogo. Um ser pode gastar uma ação completa para resfriar o objeto (jogando areia ou se jogando numa fonte de água próxima, por exemplo) e cancelar o efeito do ritual.\n\nExtinguir: o alvo é uma chama de tamanho Grande ou menor, que é apagada. Isso cria uma nuvem de fumaça que ocupa uma esfera de 3m de raio centrada onde estava a chama. Dentro da fumaça, seres têm camuflagem.\n\nModelar: o alvo é uma chama de tamanho Grande ou menor. A cada rodada, você pode gastar uma ação livre para movimentá-la em 9m em qualquer direção. Se atravessar o espaço ocupado por um ser, ela causa 3d6 pontos de dano de fogo nele. Um ser só pode sofrer dano dessa maneira uma vez por rodada.\n\nDiscente (+3 PE): muda a duração para sustentada e adiciona “Resistência: Reflexos reduz à metade”. Em vez do normal, uma vez por rodada você pode gastar uma ação de movimento para projetar uma labareda, num alvo em alcance curto. O alvo sofre 4d6 pontos de dano de Energia (Reflexos reduz à metade).\n\nVerdadeiro (+7 PE): como discente, mas muda o dano para 8d6. Requer 3º círculo.',image:'/spells/chamas-do-caos.webp'},
 {id:'decadencia',name:'Decadência',school:'Morte 1',cost:'—',description:'Execução: padrão\nAlcance: toque\nAlvo: 1 criatura ou personagem\nDuração: instantânea\nResistência: Fortitude reduz à metade\n\nEspirais de trevas envolvem sua mão e definham o corpo do alvo ao toque, causando 2d8+2 pontos de dano de Morte.',image:'/spells/decadencia.webp'},
 {id:'ciclo-da-existencia',name:'Ciclo da Existência',school:'Morte 1',cost:'—',description:'Execução: Padrão\nAlcance: Curto\nAlvo: 1 ser\nDuração: Instantânea\n\nVocê se concentra no símbolo e então é tomado por um surto temporal, tendo sua idade drenada pelo outro lado. Para cada 2 anos envelhecidos pelo surto, cause 3d6 pontos de dano de morte ao alvo (Vontade anula). Você pode escolher quantos anos de vida “entregar” para o outro lado (Máximo de 10 anos).\n\nDicente (+2 PE): Permite uma pessoa, dentro do alcance, doe anos de vida para ultrapassar o limite máximo de 10 anos por uso. A cada 2 anos doados, aumenta em +3d6 de dano de morte (limite máximo de 10 anos).\n\nVerdadeiro (+5 PE): Muda dicente para “uma ou mais pessoas”',image:'/spells/ciclo-da-existencia.webp'}
];
const SEEDED_SPELL_IDS=['miasma','chamas-do-caos','decadencia','ciclo-da-existencia'];
function uiAttrIcon(name){const v=state?.uiIcons?.attrs?.[name]||DEFAULT_ATTR_ICONS[name]||'◇';return renderCustomIcon(v)}
function uiSkillIcon(name){const v=state?.uiIcons?.skills?.[name]||DEFAULT_SKILL_ICONS[name]||'◆';return renderCustomIcon(v)}
function renderCustomIcon(v){const x=String(v||'').trim();if(x.startsWith('sym:'))return customGlyphHtml(x.slice(4));if(x.startsWith('lib:')&&Object.prototype.hasOwnProperty.call(SESSION_GLYPHS,x.slice(4)))return sessGlyphSvg(SESSION_GLYPHS[x.slice(4)]);if(/^data:image\//i.test(x)||/^https?:\/\//i.test(x)||/^\.\/?/.test(x)||x.startsWith('assets/'))return `<img src="${esc(x)}" alt="" class="ui-symbol-image">`;return esc(x||'◇')}
const SESSION_GLYPH_GROUPS=['Runas','Selos rituais','Olhos','Sóis e luas','Alquimia','Sacrifício','Glifos de Ashen'];
const SESSION_GLYPH_LIST=[
['rune-fehu','Fehu',0,'<path d="M8 3v18M8 8l8-5M8 13l8-5"/>'],
['rune-algiz','Algiz',0,'<path d="M12 3v18M12 12L5 5M12 12l7-7"/>'],
['rune-othala','Othala',0,'<path d="M12 3L6 9l6 6 6-6zM8 21l4-6 4 6"/>'],
['rune-sowilo','Sowilo',0,'<path d="M15 3L9 11l6 3-6 7"/>'],
['rune-thurisaz','Thurisaz',0,'<path d="M9 3v18M9 8l7 4-7 4"/>'],
['rune-ehwaz','Ehwaz',0,'<path d="M6 21V3l6 8 6-8v18"/>'],
['seal-circle','Selo circular',1,'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v18M3 12h18"/>'],
['seal-pentagram','Pentagrama',1,'<circle cx="12" cy="12" r="9"/><path d="M12 3l5.3 16.3L3.4 9.2h17.2L6.7 19.3z"/>'],
['seal-hexagram','Hexagrama',1,'<circle cx="12" cy="12" r="9"/><path d="M12 5l5.2 9H6.8zM12 19L6.8 10h10.4z"/>'],
['seal-gate','Portal',1,'<path d="M5 21V10a7 7 0 0114 0v11M9 21v-8a3 3 0 016 0v8"/>'],
['seal-cross','Selo cruzado',1,'<circle cx="12" cy="12" r="9"/><path d="M12 6v12M6 12h12"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'],
['eye-open','Olho aberto',2,'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'],
['eye-closed','Olho fechado',2,'<path d="M3 10c3 5 15 5 18 0M7 14l-2 3M12 16v3M17 14l2 3"/>'],
['eye-triangle','Olho no triângulo',2,'<path d="M12 3l10 17H2z"/><circle cx="12" cy="14" r="2.3"/><path d="M7.5 15s2-3 4.5-3 4.5 3 4.5 3"/>'],
['eye-weeping','Olho que chora',2,'<path d="M2 8s4-6 10-6 10 6 10 6-4 6-10 6S2 8 2 8z"/><circle cx="12" cy="8" r="2.5"/><path d="M12 16c-1.500 2-2.500 3-2.500 4a2.500 2.500 0 005 0c0-1-1-2-2.500-4z"/>'],
['moon-crescent','Lua minguante',3,'<path d="M20 14.500A8.500 8.500 0 019.500 4 8.500 8.500 0 1020 14.500z"/>'],
['moon-half','Meia lua',3,'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18z" fill="currentColor"/>'],
['sun-rays','Sol',3,'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900L7 7M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100"/>'],
['sun-eclipse','Eclipse',3,'<circle cx="12" cy="12" r="6"/><circle cx="14" cy="11" r="5" fill="currentColor"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2"/>'],
['sun-moon','Sol e lua',3,'<circle cx="9" cy="12" r="5"/><path d="M19 7a6 6 0 010 10 4.500 4.500 0 000-10z"/>'],
['alch-fire','Fogo',4,'<path d="M12 4l8 15H4z"/>'],
['alch-water','Água',4,'<path d="M12 20L4 5h16z"/>'],
['alch-air','Ar',4,'<path d="M12 4l8 15H4zM7 14h10"/>'],
['alch-earth','Terra',4,'<path d="M12 20L4 5h16zM7 10h10"/>'],
['alch-mercury','Mercúrio',4,'<circle cx="12" cy="9" r="4"/><path d="M8 3a4 3 0 008 0M12 13v8M8 18h8"/>'],
['alch-sulfur','Enxofre',4,'<path d="M12 3l7 11H5zM12 14v8M9 19h6"/>'],
['mark-tally','Contagem',5,'<path d="M6 4v16M10 4v16M14 4v16M18 4v16M4 17L20 7"/>'],
['mark-dagger','Adaga ritual',5,'<path d="M12 2l2.500 12h-5zM7 14h10M12 14v8"/>'],
['mark-drop','Gota de sangue',5,'<path d="M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z"/>'],
['mark-chalice','Cálice',5,'<path d="M6 4h12c0 6-2 9-6 9s-6-3-6-9zM12 13v6M8 21h8"/>'],
['mark-skull','Caveira',5,'<path d="M5 11a7 7 0 0114 0c0 3-1 4-2 5v3H7v-3c-1-1-2-2-2-5z"/><circle cx="9.500" cy="11" r="1.500"/><circle cx="14.500" cy="11" r="1.500"/><path d="M10 19v-2M14 19v-2"/>'],
['mark-cross-out','Marca riscada',5,'<path d="M5 5l14 14M19 5L5 19"/><circle cx="12" cy="12" r="9"/>'],
['ash-testimony','Testemunho',6,'<circle cx="12" cy="12" r="9"/><path d="M7 12c1.500-3 3-4 5-4s3.500 1 5 4c-1.500 3-3 4-5 4s-3.500-1-5-4z"/><path d="M12 8V3M12 21v-5"/>'],
['ash-ember','Brasa',6,'<path d="M12 3c1 4 6 6 6 11a6 6 0 01-12 0c0-3 2-4 3-6 1 1 1 2 2 2 0-3 0-5 1-7z"/>'],
['ash-vigil','Vigília',6,'<path d="M12 3c1.500 2 2 3 0 5-2-2-1.500-3 0-5zM9 10h6v11H9zM7 21h10"/>'],
['ash-thorn-crown','Coroa de espinhos',6,'<path d="M3 17l2-9 4 5 3-7 3 7 4-5 2 9zM3 21h18"/>'],
['ash-lattice','Treliça',6,'<path d="M12 2l9 5v10l-9 5-9-5V7zM12 2v20M3 7l18 10M21 7L3 17"/>'],
['glyph-mark','Marca discreta',6,'<path d="M12 8l4 4-4 4-4-4z"/>'],
['glyph-corner','Canto gótico',6,'<path d="M3 21V9a6 6 0 016-6h12M3 14h5M14 3v5"/>']
];
const SESSION_GLYPHS=Object.fromEntries(SESSION_GLYPH_LIST.map(g=>[g[0],g]));
function sessGlyphSvg(g){return `<svg class="ash-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${g[3]}</svg>`}
const SESSION_THEME_DEFAULTS={emptySlot:'lib:glyph-mark',bagSeal:'lib:seal-circle',ornCorner:'lib:glyph-corner',ornDivider:'lib:moon-crescent',portraitSigil:'lib:ash-testimony',ornTone:'gold',slotStyle:'plate'};
const SESSION_TONES=[['gold','Ouro velho'],['blood','Sangue'],['wine','Vinho'],['silver','Prata fria']];
const SESSION_SLOT_STYLES=[['plate','Placa metálica'],['engraved','Gravado']];
const SESSION_THEME_TARGETS=[['emptySlot','Slot vazio','Símbolo exibido em cada espaço livre da mochila.'],['bagSeal','Selo da mochila','Selo no cabeçalho da mochila.'],['ornCorner','Canto da moldura','Ornamento nos quatro cantos das molduras.'],['ornDivider','Divisor','Ornamento central das linhas divisórias.'],['portraitSigil','Sigilo do retrato','Marca discreta atrás do personagem.']];
function sessionTheme(){const t=(typeof state!=='undefined'&&state?.uiIcons?.sessionTheme)||{},o={...SESSION_THEME_DEFAULTS};for(const k of Object.keys(o)){const v=imageValue(t[k]);if(v)o[k]=v}if(!SESSION_TONES.some(x=>x[0]===o.ornTone))o.ornTone='gold';if(!SESSION_SLOT_STYLES.some(x=>x[0]===o.slotStyle))o.slotStyle='plate';return o}
function sessionThemeAttrs(t){return ` data-tone="${esc(t.ornTone)}" data-slot-style="${esc(t.slotStyle)}"`}
function safeGlyphPath(d){const x=String(d||'').slice(0,2000).trim();return /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]*$/.test(x)?x:''}
function parseCustomGlyph(raw){try{const o=JSON.parse(raw);if(!o||o.deleted||!['path','text','image'].includes(o.type))return null;return{name:String(o.name||'Símbolo').slice(0,40),type:o.type,value:String(o.value||'').slice(0,o.type==='path'?2000:2048),stroke:Math.min(3,Math.max(1,Number(o.stroke)||1.4)),fill:!!o.fill}}catch{return null}}
function customGlyphList(){const g=(typeof state!=='undefined'&&state?.uiIcons?.sessionGlyphs)||{};return Object.keys(g).map(id=>{const o=parseCustomGlyph(g[id]);return o?{id,...o}:null}).filter(Boolean)}
function customGlyphHtml(id){
  const g=state?.uiIcons?.sessionGlyphs,raw=g&&Object.prototype.hasOwnProperty.call(g,id)?g[id]:'',o=parseCustomGlyph(raw);
  return o?customGlyphRender(o):'◇';
}
function customGlyphRender(o){
  if(o.type==='path'){const d=safeGlyphPath(o.value);return d?`<svg class="ash-glyph" viewBox="0 0 24 24" fill="${o.fill?'currentColor':'none'}" stroke="currentColor" stroke-width="${esc(String(o.stroke))}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${esc(d)}"/></svg>`:'◇'}
  return renderCustomIcon(o.value);
}


const CONDITION_DEFS=[
 {id:'bleeding',name:'Sangramento (Bleed)',icon:'╱╲',image:'/condition-icons/condition-01.webp',hint:'Perda de sangue.',effect:'Sofre 2 de dano ao fim de cada rodada.',damage:2},
 {id:'blinded',name:'Cegueira',icon:'◐',image:'/condition-icons/condition-02.webp',hint:'Visão comprometida.',effect:'Fica cego por 3 turnos.',turns:3},
 {id:'fractured',name:'Fratura',icon:'⌁',image:'/condition-icons/condition-03.webp',hint:'Fratura ou dano estrutural.',effect:'Movimentos e ações físicas ficam prejudicados até tratamento. Causa 3 de dano ao ser aplicada e deixa o alvo Debilitado.'},
 {id:'weakened',name:'Debilitado',icon:'⇣',hint:'Corpo enfraquecido.',effect:'Ataque e Defesa reduzidos em 2 enquanto durar.'},
 {id:'bruised',name:'Contusão',icon:'✣',image:'/condition-icons/condition-04.webp',hint:'Trauma físico sem fratura.',effect:'Fica desorientado/girando por 3 turnos.',turns:3},
 {id:'infection',name:'Infecções',icon:'☣',image:'/condition-icons/condition-05.webp',hint:'Infecção ou contaminação.',effect:'Permanece ativa até ser tratada; o Mestre pode aplicar consequências narrativas.'},
 {id:'poison',name:'Veneno',icon:'☠',image:'/condition-icons/condition-06.webp',hint:'Veneno ativo.',effect:'Sofre 1 de dano por rodada até tratamento.',damage:1},
 {id:'parasites',name:'Parasitas',icon:'⊙',hint:'Presença de parasitas.',effect:'Permanece ativa até ser tratada e pode gerar efeitos narrativos.'},
 {id:'temporary-paralysis',name:'Paralisia temporária',icon:'ϟ',hint:'Perda temporária de mobilidade.',effect:'Não pode realizar ações físicas por 2 turnos.',turns:2},
 {id:'severe-physical-damage',name:'Dano físico severo',icon:'✜',hint:'Dano físico grave.',effect:'Condição grave persistente; exige tratamento antes de ser removida.'},
 {id:'heavy-anal-bleeding',name:'Sangramento severo',icon:'╳',hint:'Condição física severa.',effect:'Sofre 3 de dano por rodada até tratamento.',damage:3},
 {id:'intense-fear',name:'Medo intenso',icon:'☾',hint:'Medo intenso.',effect:'Ações sob pressão ficam prejudicadas por 3 turnos.',turns:3},
 {id:'flower-brain',name:'Flower brain',icon:'✤',hint:'Alteração mental estranha.',effect:'Estado mental persistente até ser removido por efeito apropriado.'},
 {id:'intense-hunger',name:'Fome intensa',icon:'◇',hint:'Fome intensa.',effect:'Estado persistente; exige alimentação para ser removido.'}
];
function conditionById(id){return allConditions().find(c=>c.id===id)}
function conditionTurnsLeft(e,id){return Number(e?.conditionTurns?.[id]||0)}
function conditionEffectText(id,e){const c=conditionById(id);if(!c)return '';const left=conditionTurnsLeft(e,id);return `${c.effect||c.hint||''}${left>0?` Restam ${left} turno(s).`:''}`}
function tickSessionEffects(e){
  if(!e||!Array.isArray(e.sessionEffects)||!e.sessionEffects.length)return [];
  const events=[];
  e.sessionEffects=e.sessionEffects.map(effect=>({...effect,remainingTurns:Math.max(0,(Number(effect.remainingTurns)||0)-1)})).filter(effect=>{
    if(effect.remainingTurns<=0){events.push(`${effect.name||'Efeito temporário'}: efeito encerrado`);return false}
    return true;
  });
  return events;
}

function applyConditionRound(e){
 if(!e)return [];
 e.conditionTurns=e.conditionTurns||{};
 const events=[];
 const active=[...(e.conditions||[])];
 for(const id of active){
   const c=conditionById(id); if(!c)continue;
   if(c.damage){const before=e.hp||0;e.hp=clamp(before-c.damage,0,e.hpMax||MAX_HP);events.push(`${c.name}: -${before-e.hp} Vida`)}
   if(Number(e.conditionTurns[id])>0){e.conditionTurns[id]-=1;if(e.conditionTurns[id]<=0){delete e.conditionTurns[id];e.conditions=e.conditions.filter(x=>x!==id);events.push(`${c.name}: efeito encerrado`)}}
 }
 return events;
}
function initializeConditionTurns(e){e.conditionTurns=e.conditionTurns||{};for(const id of (e.conditions||[])){const c=conditionById(id);if(c?.turns&&!(Number(e.conditionTurns[id])>0))e.conditionTurns[id]=c.turns}}

const SKILL_GROUPS={
 'Combate e Físico':['Armas Brancas','Luta','Pontaria','Atletismo','Acrobacia','Esquiva','Tolerância à Dor','Resistência','Iniciativa'],
 'Sobrevivência':['Sobrevivência','Caça','Rastreamento','Furtividade','Armadilhas','Medicina','Herbalismo','Adestramento','Crime','Percepção','Investigação','Reflexo'],
 'Conhecimento Oculto':['Ocultismo','Rituais','Religião','Alquimia','História'],
 'Mente':['Percepção','Intuição','Concentração','Resistência Mental'],
 'Social':['Persuasão','Enganação','Empatia','Liderança','Intimidação']
};
const SLASHER_PROFESSION_NAMES=['Atleta','Engenheiro civil','Mecânico','Lutador profissional','Herbalista','Vigilante','Médico'];
const CLASSES={
 'Mercenário':{bonus:'+2 Força • +3 Tolerância à Dor',desc:'Mercenários vivem pela próxima recompensa e aprenderam que a força vale mais do que promessas.',abilities:[['Roubo','Uma vez por combate, pode tentar furtar um item pequeno carregado pelo inimigo.'],['Táticas Sujas','Duas vezes por combate, pode realizar uma ação desleal para obter vantagem no próximo ataque ou teste.'],['Arrombamento','Recebe vantagem em testes de Arrombamento e pode abrir fechaduras simples com ferramentas adequadas.'],['Fúria Sanguinária','Antes de um ataque, pode sacrificar até 3 pontos de Sanidade para receber +1d4 de dano por ponto perdido.'],['Frenesi','Ao chegar a 0 de Sanidade, recebe +2 Força e +2 Agilidade; não pode usar itens, magia ou recuar.']]},
 'Ocultista':{bonus:'+2 Fé • +3 Ocultismo',desc:'Ocultistas conversam com aquilo que vive no vazio e se aproximam dos mistérios do Abismo.',abilities:[['Ritual Proibido','Começa conhecendo um Ritual à sua escolha.'],['Olhos do Abismo','Custo: 2 Sanidade. Percebe passagens ocultas, armadilhas, rituais e manifestações sobrenaturais.'],['Sacrifício de Carne','Uma vez por combate, pode perder até 5 Vida para recuperar a mesma quantidade de Sanidade.'],['Deuses Antigos','Recebe +1 de Afinidade com um Deus Antigo à sua escolha.'],['Conhecimento do Oculto','Recebe vantagem ao investigar fenômenos ocultos.']]},
 'Herege':{bonus:'+2 Determinação • +2 Sanidade',desc:'Hereges renegararam os deuses e desafiam forças que até os Novos Deuses temem.',abilities:[['Profanação da Carne','Preço: 4 Sanidade. Uma vez por combate, recebe +2 Força e +1d4 de dano.'],['Mente Quebrada','Custo: 10 Sanidade. Por 2 turnos, recebe +4 de dano e +2 em Intimidação.'],['Inimigo dos Deuses','-2 em testes ligados a milagres, mas +2 para resistir a maldições divinas e controle mental.']]},
 'Guerreiro':{bonus:'+2 Corpo • +1 Determinação',desc:'Veteranos que trocaram a inocência pela disciplina e foram treinados para suportar dor, fome e medo.',abilities:[['Postura de Combate','Ofensiva: +2 dano corpo a corpo. Defensiva: +2 Defesa. Equilibrada: +1 ataques e resistência.'],['Mestre das Armas','Vantagem no primeiro ataque com uma arma usada pela primeira vez no combate.'],['Inabalável','Duas vezes por combate, pode ignorar efeitos negativos do golpe até o fim do turno e contra-atacar.'],['Tática de Batalha','Pode gastar um turno planejando uma tática para receber uma vantagem determinada pelo Mestre.']]},
 'Caçador':{bonus:'+3 Percepção • +1 Agilidade',desc:'Caçadores aprenderam a viver longe dos reinos, sobrevivendo onde outros só encontram fome.',abilities:[['Tiro Preciso','Se atacar uma criatura que não percebeu sua presença, causa +1d4 de dano e aplica Sangramento.'],['Armadilhas','Pode montar uma armadilha simples durante viagens ou antes de um combate.'],['Sobrevivente','Pode realizar um teste de Sobrevivência em viagens para encontrar recursos.']]},
 'Atleta':{slasher:true,bonus:'+1 Agilidade • +2 Atletismo',desc:'Treinamento físico constante. O conhecimento vem do corpo, da disciplina e da leitura de seus próprios limites.',abilities:[['Condicionamento','Recebe +2 em testes de Atletismo e pode avaliar rapidamente se uma tarefa física está além de seu condicionamento.'],['Movimento Eficiente','Uma vez por cena, pode repetir um teste simples de corrida, salto ou escalada que acabou de falhar.']]},
 'Engenheiro civil':{slasher:true,bonus:'+1 Conhecimento • +2 Investigação',desc:'Acostumado a estruturas, materiais, medidas e riscos. Sabe observar um ambiente construído com outros olhos.',abilities:[['Leitura Estrutural','Recebe +2 em testes para avaliar estruturas, plantas, suportes, paredes, portas e possíveis riscos de um local.'],['Improviso Técnico','Pode identificar materiais e soluções simples para estabilizar ou contornar uma estrutura danificada.']]},
 'Mecânico':{slasher:true,bonus:'+1 Reflexo • +2 Conhecimento',desc:'Experiência prática com máquinas, ferramentas, motores e problemas que precisam ser resolvidos com as próprias mãos.',abilities:[['Diagnóstico Mecânico','Recebe +2 em testes para identificar falhas, peças, mecanismos e problemas em veículos ou máquinas.'],['Gambiarra Segura','Pode improvisar um reparo simples quando possui ferramentas e materiais adequados, sem criar uma vantagem de combate automática.']]},
 'Lutador profissional':{slasher:true,bonus:'+1 Força • +2 Luta',desc:'Treinamento de combate disciplinado. Sabe controlar distância, postura e esforço sem depender de força sobrenatural.',abilities:[['Técnica de Combate','Recebe +2 em testes de Luta quando estiver desarmado.'],['Controle Corporal','Pode reconhecer rapidamente sinais básicos de fadiga, desequilíbrio e postura durante um confronto.']]},
 'Herbalista':{slasher:true,bonus:'+1 Conhecimento • +2 Herbalismo',desc:'Conhece plantas, preparos tradicionais e os cuidados necessários para reconhecer recursos naturais.',abilities:[['Conhecimento Botânico','Recebe +2 em testes para identificar plantas, ervas, fungos e possíveis usos naturais.'],['Preparação Simples','Pode preparar um recurso herbal comum quando encontra os ingredientes adequados; o efeito deve ser definido pelo Mestre.']]},
 'Vigilante':{slasher:true,bonus:'+1 Percepção • +2 Pontaria',desc:'Acostumado a observar áreas, reconhecer comportamentos estranhos e agir sob pressão.',abilities:[['Olho Atento','Recebe +2 em testes de Percepção para notar movimentação, portas abertas, objetos deslocados ou sinais recentes.'],['Rotina de Vigilância','Pode estabelecer uma área de observação e recebe +1 em testes para perceber acontecimentos dentro dela enquanto permanecer atento.']]},
 'Médico':{slasher:true,bonus:'+1 Conhecimento • +2 Medicina',desc:'Formação médica aplicada a emergências, sintomas, ferimentos e decisões rápidas sob pressão.',abilities:[['Avaliação Clínica','Recebe +2 em testes de Medicina para identificar sintomas, gravidade aparente e cuidados imediatos.'],['Primeiros Socorros','Pode estabilizar um ferimento comum quando possui os materiais necessários; recuperação efetiva continua sob as regras do Mestre.']]},
 'Mago Amarelo':{bonus:'+2 Fé • +3 Determinação',magic:true,desc:'Discípulos do Caminho de Nas\'hra em busca de grimórios, rituais e verdades proibidas.',abilities:[['Conhecimento Proibido','Pode testar Conhecimento para revelar informação importante sobre livro, ritual, criatura ou símbolo desconhecido.'],['Arrogância do Saber','Uma vez por combate, pode tentar refazer sua própria rolagem relacionada à situação.'],['Contra-Magia','Custo: 7 Sanidade. Pode testar Conhecimento contra uma conjuração para anulá-la.']]},
 'Sacerdote':{bonus:'+3 Fé • +2 Conhecimento',magic:true,desc:'Sacerdotes dedicam suas vidas à fé, às escrituras e aos mistérios dos deuses.',abilities:[['Magia Divina','Inicia o jogo conhecendo uma magia ligada ao Deus escolhido.'],['Oração','Gaste 1 turno para orar e faça um teste de Fé para receber um pequeno milagre.'],['Pacto de Sangue','Pode oferecer a própria carne para recuperar Sanidade ou reduzir o custo de uma magia.'],['Purificação','Fora de combate, pode sacrificar Vida para remover doenças, infecções, parasitas e venenos comuns.']]}
};
const CATEGORIES={
 'Armas':['Espada','Adaga','Machado de Mão','Lança','Arco Curto','Arco Longo','Besta'],
 'Itens Chave':['Chave','Chave Enferrujada','Chave de Ferro','Chave Ornada','Chave do Santuário'],
 'Comida':['Pão Duro','Carne Seca','Ensopado','Maçã','Peixe Salgado','Ração','Guisado'],
 'Livros':['Livro Antigo','Grimório Rasgado','Diário de Viagem','Tratado de Ocultismo','Livro de Receitas','Caderno de Anotações'],
 'Armas de Fogo':['Pistola','Revólver','Espingarda','Carabina','Rifle'],
 'Munição':['Munição de Pistola','Munição de Revólver','Cartuchos','Munição de Rifle'],
 'Consumíveis':['Bandagem','Antisséptico','Antídoto','Tônico de Sanidade','Erva Medicinal','Frasco Vazio'],
 'Relíquias':['Moeda Antiga','Olho Petrificado','Ídolo Velado','Fragmento Antigo','Máscara Antiga','Cálice Profano'],
 'Materiais':['Ferro','Aço','Prata','Ouro','Couro','Tecido','Osso','Cristal'],
 'Diversos':['Corda','Tocha','Lanterna','Pederneira','Vela','Canivete','Cantil','Giz','Espelho']
};
const ITEM_CATS=Object.keys(CATEGORIES);
const ICONS={weapons:'asset:weapon',keys:'asset:key',food:'asset:food',books:'asset:book',firearms:'asset:weapon'};
const CURATED_ITEMS=[
 [1,'Espada','Uma lâmina simples, mas confiável.','Armas',3,'asset:weapon','Dano depende dos atributos da arma.','Comum'],
 [2,'Adaga','Pequena lâmina fácil de esconder e transportar.','Armas',1,'asset:weapon','Boa para ataques rápidos.','Comum'],
 [3,'Machado de Mão','Machado curto e pesado.','Armas',2,'asset:weapon','Pode ser usado como ferramenta.','Comum'],
 [4,'Lança','Arma longa e simples.','Armas',3,'asset:weapon','Alcance maior em combate.','Comum'],
 [5,'Arco Curto','Arco compacto para caça e combate.','Armas',2,'asset:weapon','Requer munição adequada.','Comum'],
 [6,'Arco Longo','Arco de maior alcance.','Armas',3,'asset:weapon','Requer munição adequada.','Raro'],
 [7,'Besta','Arma de disparo lenta e potente.','Armas',3,'asset:weapon','Requer virotes.','Raro'],
 [10,'Chave','Uma chave simples para uma fechadura compatível.','Itens Chave',1,'asset:key','Abre fechaduras compatíveis.','Comum'],
 [11,'Chave Enferrujada','Uma chave antiga, coberta por ferrugem.','Itens Chave',1,'asset:key','Pode abrir uma fechadura específica.','Comum'],
 [12,'Chave de Ferro','Chave pesada para fechaduras resistentes.','Itens Chave',1,'asset:key','Abre fechaduras de ferro compatíveis.','Comum'],
 [13,'Chave Ornada','Uma chave decorada com símbolos estranhos.','Itens Chave',1,'asset:key','Sua função depende da fechadura.','Raro'],
 [14,'Chave do Santuário','Uma chave antiga que parece pertencer a um lugar proibido.','Itens Chave',1,'asset:key','Item de missão.','Épico'],
 [300,'Chave','Uma chave simples para uma fechadura compatível.','Itens Chave',1,'asset:key','Abre fechaduras compatíveis.','Comum'],
 [20,'Pão Duro','Comida simples e resistente ao tempo.','Comida',1,'asset:food','Recupera uma pequena quantidade de recursos conforme as regras da campanha.','Comum'],
 [21,'Carne Seca','Carne salgada para viagens longas.','Comida',1,'asset:food','Alimento de viagem.','Comum'],
 [22,'Ensopado','Uma refeição simples e reconfortante.','Comida',2,'asset:food','Alimento preparado.','Comum'],
 [23,'Maçã','Uma fruta comum.','Comida',1,'asset:food','Alimento.','Comum'],
 [24,'Peixe Salgado','Peixe conservado para durar mais.','Comida',1,'asset:food','Alimento de viagem.','Comum'],
 [25,'Ração','Pacote compacto de comida.','Comida',1,'asset:food','Alimento de viagem.','Comum'],
 [26,'Guisado','Refeição pesada preparada para recuperar as forças.','Comida',2,'asset:food','Alimento preparado.','Raro'],
 [30,'Livro Antigo','Livro de procedência desconhecida, cheio de anotações.','Livros',2,'asset:book','Pode conter informações úteis.','Comum'],
 [31,'Grimório Rasgado','Páginas de um grimório incompleto.','Livros',2,'asset:book','Pode revelar conhecimento oculto.','Raro'],
 [32,'Diário de Viagem','Relatos de alguém que atravessou terras perigosas.','Livros',1,'asset:book','Pode fornecer pistas.','Comum'],
 [33,'Tratado de Ocultismo','Texto sobre símbolos, rituais e fenômenos inexplicáveis.','Livros',2,'asset:book','Fonte de conhecimento oculto.','Raro'],
 [34,'Livro de Receitas','Receitas simples de comida e preparos de viagem.','Livros',1,'asset:book','Pode servir como referência.','Comum'],
 [35,'Caderno de Anotações','Caderno usado para registrar descobertas.','Livros',1,'asset:book','Pode receber anotações do personagem.','Comum'],
 [40,'Pistola','Arma de fogo compacta.','Armas de Fogo',2,'asset:weapon','Requer munição.','Raro'],
 [41,'Revólver','Arma de fogo robusta e pesada.','Armas de Fogo',2,'asset:weapon','Requer munição.','Raro'],
 [42,'Espingarda','Arma de fogo longa e pesada.','Armas de Fogo',3,'asset:weapon','Requer cartuchos.','Raro'],
 [43,'Carabina','Arma de fogo longa, relativamente compacta.','Armas de Fogo',3,'asset:weapon','Requer munição.','Épico'],
 [44,'Rifle','Arma longa e pesada.','Armas de Fogo',3,'asset:weapon','Requer munição.','Épico'],
 [50,'Munição de Pistola','Munição compatível com pistolas.','Munição',1,'◇','Usada por armas compatíveis.','Comum'],
 [51,'Munição de Revólver','Munição compatível com revólveres.','Munição',1,'◇','Usada por armas compatíveis.','Comum'],
 [52,'Cartuchos','Cartuchos para armas compatíveis.','Munição',1,'◇','Usados por espingardas e armas compatíveis.','Comum'],
 [53,'Munição de Rifle','Munição para rifles e carabinas compatíveis.','Munição',1,'◇','Usada por armas compatíveis.','Comum'],
 [60,'Bandagem','Material simples para cuidados de emergência.','Consumíveis',1,'◆','Uso conforme as regras da campanha.','Comum'],
 [61,'Antisséptico','Frasco usado para limpeza e cuidados.','Consumíveis',1,'◆','Uso conforme as regras da campanha.','Comum'],
 [62,'Antídoto','Preparado contra determinados venenos.','Consumíveis',1,'◆','Remove efeitos definidos pelo Mestre.','Raro'],
 [63,'Tônico de Sanidade','Tônico usado para recuperar a mente.','Consumíveis',1,'◆','Recupera recurso conforme as regras da campanha.','Raro'],
 [64,'Erva Medicinal','Erva preparada para uso medicinal.','Consumíveis',1,'◆','Uso conforme as regras da campanha.','Comum'],
 [70,'Moeda Antiga','Moeda de origem desconhecida.','Relíquias',1,'◇','Pode ter valor especial.','Raro'],
 [71,'Olho Petrificado','Peça estranha encontrada entre ruínas.','Relíquias',1,'◇','Pode interagir com fenômenos ocultos.','Épico'],
 [72,'Ídolo Velado','Pequena relíquia ligada a crenças antigas.','Relíquias',2,'◇','Uso narrativo ou ritual.','Épico'],
 [73,'Fragmento Antigo','Fragmento de um objeto de origem incerta.','Relíquias',1,'◇','Pode fazer parte de um artefato maior.','Raro'],
 [74,'Máscara Antiga','Máscara pesada com símbolos gastos.','Relíquias',2,'◇','Objeto de valor narrativo.','Raro'],
 [75,'Cálice Profano','Cálice antigo usado em cerimônias desconhecidas.','Relíquias',2,'◇','Objeto de ritual.','Épico'],
 [80,'Corda','Corda resistente para usos diversos.','Diversos',2,'◇','Ferramenta de exploração.','Comum'],
 [81,'Tocha','Fonte de luz portátil.','Diversos',1,'◇','Ilumina áreas escuras.','Comum'],
 [82,'Lanterna','Lanterna metálica portátil.','Diversos',2,'◇','Ilumina áreas escuras.','Comum'],
 [83,'Pederneira','Ferramenta para produzir faíscas.','Diversos',1,'◇','Pode acender fontes adequadas.','Comum'],
 [84,'Vela','Pequena fonte de luz.','Diversos',1,'◇','Iluminação curta.','Comum'],
 [85,'Canivete','Ferramenta pequena e versátil.','Diversos',1,'◇','Uso utilitário.','Comum'],
 [86,'Cantil','Recipiente para água.','Diversos',1,'◇','Transporta líquidos.','Comum'],
 [87,'Giz','Giz para marcar caminhos e superfícies.','Diversos',1,'◇','Pode deixar marcações.','Comum'],
 [88,'Espelho','Pequeno espelho de bolso.','Diversos',1,'◇','Uso utilitário e narrativo.','Comum'],
 [90,'Blue Sin','Arma de aparência estranha ligada a um passado sombrio.','Armas',3,'asset:weapon','Item inspirado em Fear & Hunger; efeitos definidos pelo Mestre.','Épico'],
 [91,'Miasma','Arma rara de aparência incomum.','Armas',3,'asset:weapon','Item inspirado em Fear & Hunger; efeitos definidos pelo Mestre.','Épico'],
 [92,'Serpent Spear','Lança antiga associada a histórias esquecidas.','Armas',3,'asset:weapon','Item inspirado em Fear & Hunger; efeitos definidos pelo Mestre.','Raro'],
 [93,'White Angel','Arma lendária de origem misteriosa.','Armas',3,'asset:weapon','Item inspirado em Fear & Hunger; efeitos definidos pelo Mestre.','Lendário'],
 [94,'Soul Stone','Pedra ligada à essência de uma alma.','Relíquias',1,'◇','Item inspirado em Fear & Hunger; uso narrativo definido pelo Mestre.','Épico']
];
CURATED_ITEMS.push([89,'Mochila','Uma mochila resistente que aumenta a capacidade da mochila normal em 8 espaços.','Diversos',1,'◇','Aumenta a capacidade de 10 para 18 espaços enquanto estiver na mochila.','Comum']);
const WEAPON_DAMAGE_DEFAULTS={
  'espada':'1d8','adaga':'1d4','machado de mão':'1d8','lança':'1d8','arco curto':'1d6','arco longo':'1d8','besta':'1d8',
  'pistola':'1d8','revólver':'1d8','espingarda':'1d10','carabina':'1d10','rifle':'1d10'
};
function weaponDamageFallback(i){
  const name=String(i?.name||'').trim().toLowerCase();
  if(WEAPON_DAMAGE_DEFAULTS[name])return WEAPON_DAMAGE_DEFAULTS[name];
  const cat=String(i?.category||'').toLowerCase();
  if(cat==='armas de fogo')return '1d10';
  if(cat==='armas'){
    const w=Number(i?.weight)||2;
    return w>=3?'1d8':'1d6';
  }
  return '';
}
function isWeaponItem(i){const c=String(i?.category||'').trim().toLowerCase();return c==='armas'||c==='armas de fogo'||i?.weapon===true;}
function makeItems(){return CURATED_ITEMS.map(([id,name,description,category,weight,icon,effects,rarity])=>({id,name,description,category,maxQty:10,weight,icon,effects,rarity,damage:isWeaponItem({category,name})?weaponDamageFallback({category,name,weight}):''}));}
function customList(key){try{const source=typeof state!=='undefined'?state:null;return Array.isArray(source?.customContent?.[key])?source.customContent[key]:[]}catch{return []}}
function allAttrs(){return [...ATTRS,...customList('attrs').map(x=>x.name).filter(Boolean).filter(x=>!ATTRS.includes(x))]}
function allSkills(){return [...SKILLS,...customList('skills').map(x=>x.name).filter(Boolean).filter(x=>!SKILLS.includes(x))]}
function allConditions(){return [...CONDITION_DEFS,...customList('conditions').map(x=>({id:x.id,name:x.name,icon:x.icon||'◇',image:x.image||'',hint:x.hint||'',effect:x.effect||''})).filter(x=>x.name)]}
function allDeities(){return customList('deities')}
function isMochilaItem(i){return Number(i?.id)===89 || String(i?.name||'').trim().toLowerCase()==='mochila'}
function hasMochila(p){return (p?.backpack||[]).some(b=>isMochilaItem(item(b.id)))}
function bagCapacity(p){return MAX_BAG+(hasMochila(p)?8:0)}

const FEAR_THEMED_FAMILIES = [
  {cat:'Armas', weight:3, icon:'asset:weapon', rarity:'Raro', pre:['Lâmina','Cutelo','Machado','Lança','Espada','Foice','Adaga','Porrete','Martelo','Bastão'], post:['do Corredor do Medo','do Santuário Afundado','de Gro-goroth','de Sylvian','de Vinushka','de Rher','do Tribunal','da Torre de Ma’habre','do Culto do Sangue','do Castelo Antigo']},
  {cat:'Armas', weight:2, icon:'asset:weapon', rarity:'Épico', pre:['Lâmina','Estocada','Sabre','Alfange','Gadanha','Lança','Espada','Adaga','Machado','Maça'], post:['da Lua Amarela','do Vazio Dourado','do Sacerdote Sem Face','do Rei Amarelo','da Cidade de Ma’habre','do Guardião de Masoquismo','da Carne Ascendente','do Trono do Deus Morto','do Sonho Lunar','da Câmara de Rher']},
  {cat:'Armas', weight:3, icon:'asset:weapon', rarity:'Lendário', pre:['Relíquia','Lâmina','Arma','Lança','Espada','Foice','Machado','Martelo','Adaga','Cajado'], post:['de Alll-mer','de Gro-goroth','de Sylvian','de Vinushka','de Rher','de Nas’hrah','do Rei Amarelo','da Era Antiga','da Ascensão','do Abismo']},
  {cat:'Itens Chave', weight:1, icon:'asset:key', rarity:'Raro', pre:['Chave','Selo','Medalhão','Fragmento','Placa','Insígnia','Amuleto','Sinete','Marca','Talismã'], post:['da Cela do Prisioneiro','do Portão de Ma’habre','do Santuário de Gro-goroth','do Templo de Sylvian','do Jardim de Vinushka','da Câmara de Rher','do Castelo do Rei Amarelo','da Torre de Marfim','do Altar Esquecido','do Corredor Sem Luz']},
  {cat:'Itens Chave', weight:1, icon:'asset:key', rarity:'Épico', pre:['Chave','Selo','Medalhão','Fragmento','Placa','Insígnia','Sinete','Talismã','Cilindro','Relicário'], post:['do Portão Lunar','do Cofre de Ma’habre','da Cripta dos Antigos','do Altar de Alll-mer','da Porta de Sangue','do Santuário Profanado','da Câmara do Deus','do Observatório de Rher','da Catedral Abandonada','do Trono Partido']},
  {cat:'Comida', weight:1, icon:'asset:food', rarity:'Comum', pre:['Ração','Ensopado','Carne','Pão','Sopa','Caldo','Raiz','Fruta','Peixe','Mingau'], post:['de sobrevivente de Prehevil','de taverna de Ma’habre','de acampamento de Vinushka','de viagem pela floresta','do abrigo dos mercenários','de cozinha do castelo','de mercado de Prehevil','de expedição subterrânea','de peregrino de Alll-mer','de vigia do acampamento']},
  {cat:'Comida', weight:2, icon:'asset:food', rarity:'Raro', pre:['Ensopado','Carne','Caldo','Pão','Torta','Guisado','Peixe','Conserva','Mingau','Prato'], post:['do Banquete de Sylvian','de cogumelos da floresta de Vinushka','de caça do castelo','de cozinha de Ma’habre','do acampamento de Prehevil','do culto de Rher','da despensa do Rei Amarelo','da ceia do templo antigo','do mercado noturno','da cozinha do Santuário']},
  {cat:'Livros', weight:2, icon:'asset:book', rarity:'Raro', pre:['Códice','Diário','Tratado','Grimório','Evangelho','Crônica','Manuscrito','Pergaminho','Relatório','Livro'], post:['das Máscaras de Ma’habre','sobre os Novos Deuses','do Culto de Gro-goroth','dos Jardins de Sylvian','da Floresta de Vinushka','sobre a Lua de Rher','sobre a Ascensão','dos Templos Antigos','sobre o Trono Amarelo','das Ruínas de Prehevil']},
  {cat:'Livros', weight:2, icon:'asset:book', rarity:'Épico', pre:['Códice','Grimório','Manuscrito','Evangelho','Crônica','Livro','Tratado','Pergaminho','Atlas','Registro'], post:['de Nas’hrah','de Alll-mer','de Gro-goroth','de Sylvian','de Vinushka','de Rher','dos Antigos','da Era de Ma’habre','do Rei Amarelo','da Torre do Deus Morto']},
  {cat:'Armas de Fogo', weight:2, icon:'asset:weapon', rarity:'Raro', pre:['Pistola','Revólver','Carabina','Espingarda','Mosquete','Fuzil','Pistola de Bolso','Carabina Curta','Rifle','Arma de Caça'], post:['de Prehevil','dos Soldados do Castelo','do Esquadrão da Cidade','do Caçador de Rher','do Guarda do Museu','do Mercenário do Sul','da Guarda da Prisão','do Vigia da Catedral','do Oficial do Mercado','da Patrulha Noturna']},
  {cat:'Armas de Fogo', weight:3, icon:'asset:weapon', rarity:'Épico', pre:['Pistola','Revólver','Carabina','Espingarda','Rifle','Mosquete','Fuzil','Pistola Dupla','Rifle de Precisão','Espingarda de Caça'], post:['da Guarda de Prehevil','do Arsenal de Ma’habre','do Comandante Sem Rosto','do Caçador da Lua','da Milícia do Castelo','do Executor de Rher','do Atirador do Culto','do Sentinela do Santuário','da Patrulha de Sangue','do Vigia da Torre']},
  {cat:'Munição', weight:1, icon:'◇', rarity:'Comum', pre:['Cartuchos','Balas','Munição','Projéteis','Cargas','Cartuchos Reforçados','Balas de Chumbo','Balas de Ferro','Cargas de Pólvora','Munição Selada'], post:['de Prehevil','de caça ao Rher','da guarda do castelo','do arsenal antigo','do mercado de armas','da patrulha da prisão','da milícia de Ma’habre','do culto armado','da torre de vigia','do caçador de Vinushka']},
  {cat:'Consumíveis', weight:1, icon:'◆', rarity:'Raro', pre:['Elixir','Poção','Tônico','Frasco','Unguento','Solução','Extrato','Mistura','Infusão','Ampola'], post:['de sangue coagulado','de sal de Ma’habre','de erva de Vinushka','do alquimista de Prehevil','de purificação de Alll-mer','de transe de Rher','de carne de Sylvian','de resistência do Abismo','de lucidez lunar','de cura do peregrino']},
  {cat:'Consumíveis', weight:1, icon:'◆', rarity:'Épico', pre:['Elixir','Poção','Tônico','Unguento','Extrato','Infusão','Ampola','Essência','Soro','Destilado'], post:['da Ascensão','de Gro-goroth','de Sylvian','de Vinushka','de Rher','de Alll-mer','do Rei Amarelo','de Ma’habre','do Abismo','da Lua Amarela']},
  {cat:'Relíquias', weight:1, icon:'◇', rarity:'Épico', pre:['Ídolo','Máscara','Cálice','Olho','Relicário','Estatueta','Amuleto','Fragmento','Coração de Pedra','Medalhão'], post:['de Gro-goroth','de Sylvian','de Vinushka','de Rher','de Alll-mer','de Nas’hrah','do Rei Amarelo','de Ma’habre','do Deus Morto','da Lua Amarela']},
  {cat:'Relíquias', weight:2, icon:'◇', rarity:'Lendário', pre:['Coroa','Ídolo','Máscara','Cálice','Relicário','Estátua','Olho','Coração','Fragmento','Trono em Miniatura'], post:['do Deus da Carne','da Deusa do Amor','do Deus da Natureza','do Deus da Lua','do Salvador','do Mago Amarelo','dos Novos Deuses','da Cidade Antiga','da Ascensão','do Abismo']},
  {cat:'Materiais', weight:1, icon:'◇', rarity:'Comum', pre:['Fragmento','Pó','Lascas','Tecido','Metal','Osso','Couro','Raiz','Pedra','Cinza'], post:['de Ma’habre','da floresta de Vinushka','do templo de Gro-goroth','do jardim de Sylvian','da noite de Rher','das ruínas de Prehevil','do castelo antigo','da cripta dos Antigos','do altar de Alll-mer','do mercado subterrâneo']},
  {cat:'Materiais', weight:2, icon:'◇', rarity:'Raro', pre:['Liga','Minério','Fragmento','Cristal','Metal','Osso','Couro','Madeira','Pedra','Vidro'], post:['da Era Antiga','do Templo Lunar','do Santuário de Gro-goroth','da Câmara de Sylvian','do Jardim de Vinushka','do Observatório de Rher','da Cidade de Ma’habre','do Trono dos Deuses','do Castelo do Rei Amarelo','do Abismo']},
  {cat:'Diversos', weight:1, icon:'◇', rarity:'Comum', pre:['Vela','Lanterna','Corda','Sino','Frasco','Ferramenta','Caderno','Chaveiro','Mochila','Kit'], post:['de Prehevil','de Ma’habre','de peregrino de Alll-mer','de explorador do Abismo','de vigia de Rher','de caçador de Vinushka','de devoto de Sylvian','de mercenário do castelo','de estudioso dos Antigos','de sobrevivente do porão']}
];
function makeFearItems(){
  const out=[]; let id=1000;
  FEAR_THEMED_FAMILIES.forEach((f,fi)=>{
    f.pre.forEach((a,ai)=>f.post.forEach((b,bi)=>{
      const n=`${a} ${b}`;
      let desc='';
      if(f.cat==='Armas') desc=`Arma de fantasia sombria ligada a ${b.toLowerCase()}. O Mestre define dano, alcance e efeitos especiais.`;
      else if(f.cat==='Armas de Fogo') desc=`Arma de fogo encontrada em conflitos de Prehevil e arredores; seu estado e funcionamento ficam a critério do Mestre.`;
      else if(f.cat==='Munição') desc=`Munição compatível com armas de fogo da campanha, marcada por sua origem: ${b.toLowerCase()}.`;
      else if(f.cat==='Livros') desc=`Registro ligado aos deuses, cultos e lugares de Fear & Hunger; pode conter pistas sobre ${b.toLowerCase()}.`;
      else if(f.cat==='Itens Chave') desc=`Objeto de acesso associado a ${b.toLowerCase()}; sua fechadura, porta ou ritual correspondente é decidido pelo Mestre.`;
      else if(f.cat==='Comida') desc=`Alimento de sobrevivência com origem em ${b.toLowerCase()}; representa os recursos escassos das jornadas.`;
      else if(f.cat==='Consumíveis') desc=`Preparado alquímico associado a ${b.toLowerCase()}; efeitos exatos devem seguir as regras da campanha.`;
      else if(f.cat==='Relíquias') desc=`Relíquia profundamente ligada à mitologia de Fear & Hunger e a ${b.toLowerCase()}; seu poder pode exigir condições narrativas.`;
      else if(f.cat==='Materiais') desc=`Material raro de ${b.toLowerCase()}, útil para rituais, fabricação ou comércio conforme a campanha.`;
      else desc=`Objeto de viagem encontrado em ${b.toLowerCase()}, com utilidade prática ou ritualística no cenário.`;
      out.push({id:id++,name:n,description:desc,category:f.cat,maxQty:f.cat==='Armas'||f.cat==='Armas de Fogo'?1:10,weight:f.weight,icon:f.icon,effects:`Baseado na estética, mitologia e atmosfera de Fear & Hunger; efeitos mecânicos definidos pelo Mestre.`,rarity:f.rarity,damage:isWeaponItem({category:f.cat,name:n,weight:f.weight})?weaponDamageFallback({category:f.cat,name:n,weight:f.weight}):''});
    }));
  });
  return out;
}
const DEFAULT_ITEMS=makeItems().concat(makeFearItems());
function inferWeight(i){if(Number(i?.weight)>=1&&Number(i?.weight)<=3)return Number(i.weight);const n=String(i?.name||'').toLowerCase(),c=String(i?.category||'').toLowerCase();if(n.includes('lanterna')||n.includes('livro')||n.includes('corda')||c.includes('arma de fogo')||n.includes('rifle')||n.includes('espingarda'))return 2;if(c==='armas'||c==='armadura'||n.includes('espada')||n.includes('machado'))return 3;return 1}
function oldAutoItem(i){return i&&typeof i.name==='string'&&(/\s\d+$/.test(i.name))&&String(i.description||'').includes('para uso nas jornadas de Filii Abyssi.')}
var _defItemSigs=null;
const itemSig=i=>JSON.stringify(i,Object.keys(i).sort());
function defaultItemSigs(){if(!_defItemSigs){_defItemSigs=new Map();for(const i of migrateItems([]))_defItemSigs.set(Number(i.id),itemSig(i))}return _defItemSigs}
function slimItems(items){const sigs=defaultItemSigs();return (Array.isArray(items)?items:[]).filter(i=>i&&sigs.get(Number(i.id))!==itemSig(i))}
function serializeState(){const full=state.items;try{state.items=slimItems(full);return JSON.stringify(state)}finally{state.items=full}}
function migrateItems(items){const current=Array.isArray(items)?items:[];const kept=current.filter(i=>!oldAutoItem(i));const ids=new Set(kept.map(i=>Number(i.id)));DEFAULT_ITEMS.forEach(i=>{if(!ids.has(i.id))kept.push(clone(i))});kept.forEach(i=>{const legacy={Arma:'Armas',Missão:'Itens Chave',Consumível:'Consumíveis',Material:'Materiais',Relíquia:'Relíquias',Mágico:'Relíquias',Armadura:'Diversos',Comum:'Diversos'};if(legacy[i.category])i.category=legacy[i.category];i.weight=inferWeight(i);i.maxQty=Math.max(1,Number(i.maxQty)||10);if(isWeaponItem(i)&&!String(i.damage||'').trim())i.damage=weaponDamageFallback(i);if(i.id===300){i.name='Chave';i.category='Itens Chave';i.icon='asset:key';i.weight=1}});return kept}

function blankLimits(){return Object.fromEntries(ATTRS.map(a=>[a,{min:0,max:MAX_ATTR}]));}
function blankAttrs(){return Object.fromEntries(ATTRS.map(a=>[a,0]));}
function blankSkills(){return Object.fromEntries(SKILLS.map(s=>[s,0]));}

function classBonusMap(name){const overrides=state?.classBonuses||{};return overrides[name]||CLASS_BONUSES_DEFAULTS_V107[name]||{}}
function classBonusText(name){const b=classBonusMap(name);const entries=Object.entries(b).filter(([,v])=>Number(v));return entries.length?entries.map(([k,v])=>`${Number(v)>0?'+':''}${Number(v)} ${k}`).join(' • '):'Nenhum bônus de classe ainda.'}
function effectiveAttr(e,name){return Math.min(MAX_ATTR,Number(e?.attrs?.[name])||0)+(Number(classBonusMap(e?.class)?.[name])||0)}
function effectiveSkill(e,name){return Math.min(MAX_SKILL,Number(e?.skills?.[name])||0)+(Number(classBonusMap(e?.class)?.[name])||0)}
function getSpells(){return (Array.isArray(state.spells)&&state.spells.length?state.spells:INITIAL_SPELLS).map(x=>({...x}));}
function hasMagicClass(name){return ['Mago Amarelo','Ocultista','Sacerdote'].includes(name)||!!CLASSES[name]?.magic;}
function classChosen(p){return !!String(p?.class||'').trim()}
function defaultCombatSession(){return {active:false,sessionId:'',title:'Sessão atual',scene:'',round:1,turn:0,currentKey:'',participants:[],actedKeys:[],history:[],updatedAt:0}}
function normalizeCombatSession(){
  state.combatSession={...defaultCombatSession(),...(state.combatSession||{})};
  const c=state.combatSession;
  c.sessionId=String(c.sessionId||'');
  if(!c.sessionId)c.sessionId=cryptoRandomId('combat');
  c.round=Math.max(1,Number(c.round)||1);
  c.turn=Math.max(0,Number(c.turn)||0);
  c.participants=Array.isArray(c.participants)?c.participants:[];
  c.actedKeys=Array.isArray(c.actedKeys)?c.actedKeys.map(String):[];
  c.history=Array.isArray(c.history)?c.history:[];
  return c;
}
function defaultTerrorMode(){return {active:false,title:'MODO TERROR',message:'',subtext:'',image:'',updatedAt:0}}
function terrorOverlay(){
  const t={...defaultTerrorMode(),...(state.terrorMode||{})};
  const image=t.image?`<img class="terror-image" src="${esc(safeImgSrc(t.image,''))}" alt="">`:'';
  return `<div id="terrorOverlay" class="terror-overlay" role="dialog" aria-modal="true" aria-label="Modo Terror">
    <div class="terror-vignette" aria-hidden="true"></div>
    <section class="terror-panel">
      <div class="terror-mark" aria-hidden="true">☩</div>
      <div class="terror-kicker">ASHEN TESTIMONY · AVISO</div>
      ${image}
      <h1 class="terror-title">${esc(t.title||'MODO TERROR')}</h1>
      <p class="terror-message">${esc(t.message||'Algo mudou.\nVocê percebeu tarde demais.')}</p>
      ${t.subtext?`<p class="terror-subtext">${esc(t.subtext)}</p>`:''}
      <button type="button" class="btn danger terror-close" id="forceDisableTerror">Continuar</button>
    </section>
  </div>`;
}
function openTerrorEditor(){
  const t={...defaultTerrorMode(),...(state.terrorMode||{})};
  openModal(`<div class="modal" id="terrorEditorModal"><div class="modal-card terror-admin-preview">
    <button class="modal-close" id="closeTerrorEditor">×</button>
    <span class="badge">ATMOSFERA</span><h2>Modo Terror</h2>
    <p class="small muted">Crie uma cena curta de tensão para todos os Players. Prefira sugestão e expectativa a sustos repetidos.</p>
    <div class="field"><label>Título</label><input id="terrorTitle" maxlength="80" value="${esc(t.title)}" placeholder="Ex.: NÃO OLHE PARA TRÁS"></div>
    <div class="field"><label>Mensagem</label><textarea id="terrorMessage" rows="6" maxlength="1200" placeholder="Algo está acontecendo...">${esc(t.message)}</textarea></div>
    <div class="field"><label>Subtexto</label><input id="terrorSubtext" maxlength="220" value="${esc(t.subtext)}" placeholder="Uma frase curta, quase sussurrada."></div>
    <div class="field"><label>Imagem opcional</label><input id="terrorImage" value="${esc(t.image)}" placeholder="URL de uma imagem já disponível no projeto"></div>
    <label class="row small" style="gap:8px;margin:12px 0"><input id="terrorActive" type="checkbox" ${t.active?'checked':''}> Ativar imediatamente para a sessão</label>
    <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn" id="cancelTerrorEditor">Cancelar</button><button class="btn danger" id="saveTerrorEditor">${t.active?'Atualizar cena':'Ativar modo terror'}</button></div>
  </div></div>`);
  const close=()=>document.getElementById('terrorEditorModal')?.remove();
  document.getElementById('closeTerrorEditor')?.addEventListener('click',close);
  document.getElementById('cancelTerrorEditor')?.addEventListener('click',close);
  document.getElementById('saveTerrorEditor')?.addEventListener('click',async()=>{
    const next={...defaultTerrorMode(),title:document.getElementById('terrorTitle')?.value.trim()||'MODO TERROR',message:document.getElementById('terrorMessage')?.value.trim()||'Algo mudou.\nVocê percebeu tarde demais.',subtext:document.getElementById('terrorSubtext')?.value.trim()||'',image:document.getElementById('terrorImage')?.value.trim()||'',active:!!document.getElementById('terrorActive')?.checked,updatedAt:Date.now()};
    state.terrorMode=next;
    close();
    try{await saveGlobalNow();toast(next.active?'O Modo Terror foi transmitido.':'O Modo Terror foi salvo desativado.');}
    catch(e){toast('A cena foi salva localmente, mas não foi possível sincronizar agora.');console.warn(e)}
    render(currentView||'home');
  });
}
function defaultTvScreen(){return {active:false,kind:'black',url:'',title:'',loop:false,upscale:false,commandAt:0,updatedAt:0}}
function normalizeTvScreen(){state.tvScreen={...defaultTvScreen(),...(state.tvScreen||{})};}
function normalizeTerrorMode(){state.terrorMode={...defaultTerrorMode(),...(state.terrorMode||{})}}

const DEFAULT={version:1.0,siteBrand:{name:'Ashen Testimony',image:'runa-gold.png'},session:null,characterRules:clone(DEFAULT_RULES),classBonuses:clone(CLASS_BONUSES_DEFAULTS_V107),music:{type:'',url:'',title:'',kind:'url',mediaId:''},musicLibrary:[],slasherIntroMusic:{url:'',title:'',kind:'url'},sounds:[],players:[],creatures:[],items:DEFAULT_ITEMS,spells:INITIAL_SPELLS,uiIcons:{attrs:{...DEFAULT_ATTR_ICONS},skills:{...DEFAULT_SKILL_ICONS},conditions:{},sessionSlots:{main:'⚔',off:'◈',consumable:'✦',tool:'⚒',relic:'☽',free:'◇'}},backgrounds:{},customContent:{attrs:[],skills:[],conditions:[],deities:[]},combatSession:defaultCombatSession(),terrorMode:defaultTerrorMode(),nexus:{active:false,title:'Nexus Tabletop',url:'',updatedAt:0},tvScreen:defaultTvScreen(),tvScenes:[],soundboard:{volume:0.85,enabled:true},secretClues:[],rulesBook:{title:'Livro de Regras',url:'',kind:'url'}};
let memoryStore={};
let bgObjectUrls={};
function bgOpen(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(BG_DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(BG_STORE))r.result.createObjectStore(BG_STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB indisponível'));}catch(e){reject(e)}})}
async function bgPut(id,blob){const db=await bgOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(BG_STORE,'readwrite');tx.objectStore(BG_STORE).put(blob,id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error||new Error('Não foi possível salvar o fundo'))}})}
async function bgGet(id){const db=await bgOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(BG_STORE,'readonly');const r=tx.objectStore(BG_STORE).get(id);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error||new Error('Não foi possível carregar o fundo'))}})}
async function bgDelete(id){const db=await bgOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(BG_STORE,'readwrite');tx.objectStore(BG_STORE).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error||new Error('Não foi possível remover o fundo'))}})}
function bgFallback(kind){return assetUrl(BG_DEFS[kind]?.[1]||'fundo-geral.webp')}
function applyBgVar(kind,url){const root=document.documentElement;const safe=safeImgSrc(assetUrl(url),bgFallback(kind)).replace(/[\\"]/g,c=>'\\'+c).replace(/[\r\n]/g,'');root.style.setProperty(`--bg-${kind}`,`url("${safe}")`)}
let bgAppliedSignature='';
async function applyBackgrounds(force=false){
  const configured=state.backgrounds||{};
  const signature=Object.keys(BG_DEFS).map(kind=>`${kind}:${configured[kind]?.mediaId||'default'}:${configured[kind]?.url||''}`).join('|');
  if(!force&&signature===bgAppliedSignature)return;
  for(const kind of Object.keys(BG_DEFS)){
    const cfg=configured[kind]||{};
    const remoteUrl=cfg.url||'';
    if(remoteUrl){applyBgVar(kind,remoteUrl);continue;}
    const id=cfg.mediaId;
    if(id){
      try{
        const blob=await bgGet(id);
        if(blob){
          if(bgObjectUrls[kind])URL.revokeObjectURL(bgObjectUrls[kind]);
          const u=URL.createObjectURL(blob);bgObjectUrls[kind]=u;applyBgVar(kind,u);continue;
        }
      }catch{}
    }
    if(bgObjectUrls[kind]){URL.revokeObjectURL(bgObjectUrls[kind]);delete bgObjectUrls[kind];}
    applyBgVar(kind,bgFallback(kind));
  }
  bgAppliedSignature=signature;
}

/* Armazenamento de mídia: arquivos grandes ficam fora do LocalStorage para evitar travamentos. */
const MEDIA_DB_NAME='a-profecia-media-v1',MEDIA_DB_VERSION=1;
const MEDIA_STORES={music:'music',sounds:'sounds'};
function mediaOpen(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(MEDIA_DB_NAME,MEDIA_DB_VERSION);r.onupgradeneeded=()=>{for(const name of Object.values(MEDIA_STORES))if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB indisponível'));}catch(e){reject(e)}})}
async function mediaPut(store,id,blob){const db=await mediaOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(blob,id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error||new Error('Não foi possível salvar o arquivo'))}})}
async function mediaGet(store,id){const db=await mediaOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(id);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error||new Error('Não foi possível carregar o arquivo'))}})}
async function mediaDelete(store,id){const db=await mediaOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error||new Error('Não foi possível remover o arquivo'))}})}
const idbPutMusic=(id,blob)=>mediaPut(MEDIA_STORES.music,id,blob);
const idbGetMusic=id=>mediaGet(MEDIA_STORES.music,id);
const idbDeleteMusic=id=>mediaDelete(MEDIA_STORES.music,id);
const idbPutSound=(id,blob)=>mediaPut(MEDIA_STORES.sounds,id,blob);
const idbGetSound=id=>mediaGet(MEDIA_STORES.sounds,id);
const idbDeleteSound=id=>mediaDelete(MEDIA_STORES.sounds,id);
const STATE_BACKUP_DB='a-profecia-recovery-v1',STATE_BACKUP_STORE='snapshots';
function stateBackupOpen(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(STATE_BACKUP_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STATE_BACKUP_STORE))r.result.createObjectStore(STATE_BACKUP_STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB indisponível'));}catch(e){reject(e)}})}
async function saveLocalRecovery(label='auto'){if(label==='save'||label==='global-save'){const t=Date.now();if(t-lastRecoveryAt<45000)return;lastRecoveryAt=t}try{const db=await stateBackupOpen();const snap={label,createdAt:Date.now(),state:JSON.parse(serializeState())};await new Promise((resolve,reject)=>{const tx=db.transaction(STATE_BACKUP_STORE,'readwrite');tx.objectStore(STATE_BACKUP_STORE).put(snap,String(snap.createdAt));tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error||new Error('backup'))}});const db2=await stateBackupOpen();await new Promise((resolve,reject)=>{const tx=db2.transaction(STATE_BACKUP_STORE,'readwrite'),store=tx.objectStore(STATE_BACKUP_STORE),req=store.getAllKeys();req.onsuccess=()=>{const keys=(req.result||[]).map(Number).sort((a,b)=>b-a);keys.slice(8).forEach(k=>store.delete(String(k)))};tx.oncomplete=()=>{db2.close();resolve()};tx.onerror=()=>{db2.close();reject(tx.error||new Error('cleanup'))}})}catch(e){console.warn('Backup local de recuperação falhou:',e)}}
const PLAYER_SHEET_BACKUP_DB='a-profecia-player-sheet-backups-v1',PLAYER_SHEET_BACKUP_STORE='snapshots';
let playerSheetBackupTimer=0,playerSheetBackupPending=null;
function playerSheetBackupOpen(){return new Promise((resolve,reject)=>{try{if(typeof indexedDB==='undefined')throw new Error('IndexedDB indisponível');const r=indexedDB.open(PLAYER_SHEET_BACKUP_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PLAYER_SHEET_BACKUP_STORE))r.result.createObjectStore(PLAYER_SHEET_BACKUP_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Não foi possível abrir o backup da ficha'))}catch(e){reject(e)}})}
async function persistPlayerSheetBackup(snap){const db=await playerSheetBackupOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(PLAYER_SHEET_BACKUP_STORE,'readwrite'),store=tx.objectStore(PLAYER_SHEET_BACKUP_STORE);store.put(snap,snap.key);const req=store.getAll();req.onsuccess=()=>{const own=(req.result||[]).filter(x=>String(x?.playerId||'')===snap.playerId).sort((a,b)=>(Number(b?.createdAt)||0)-(Number(a?.createdAt)||0));for(const old of own.slice(40))if(old?.key)store.delete(old.key)};tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=tx.onabort=()=>{const err=tx.error||new Error('Não foi possível gravar o backup local');db.close();reject(err)}})}
function schedulePlayerSheetBackup(p,draft=null,delay=250){if(state.session?.role!=='player'||!p)return;const playerId=String(p.id||state.session.playerId||'').trim();if(!playerId)return;let safePlayer;try{safePlayer=clone(p)}catch{return}delete safePlayer.password;delete safePlayer.newPassword;delete safePlayer.secretLovedEffect;const pointDraft=draft&&String(draft.pid||'')===playerId?{pid:playerId,attrs:clone(draft.attrs||{}),skills:clone(draft.skills||{}),at:Number(draft.at)||Date.now(),basePts:Number(draft.basePts)||0}:null;const createdAt=Date.now(),snap={key:playerId+':'+createdAt+':'+Math.random().toString(36).slice(2,8),playerId,login:String(p.login||''),createdAt,player:safePlayer,pointDraft};if(delay<=0){clearTimeout(playerSheetBackupTimer);playerSheetBackupTimer=0;playerSheetBackupPending=null;persistPlayerSheetBackup(snap).catch(err=>console.warn('Backup local da ficha não foi gravado:',err));return}clearTimeout(playerSheetBackupTimer);playerSheetBackupPending=snap;playerSheetBackupTimer=setTimeout(()=>{const pending=playerSheetBackupPending;playerSheetBackupPending=null;playerSheetBackupTimer=0;if(pending)persistPlayerSheetBackup(pending).catch(err=>console.warn('Backup local da ficha não foi gravado:',err))},delay)}
const PLAYER_TRASH_DB='a-profecia-player-trash-v1',PLAYER_TRASH_STORE='players';
function playerTrashOpen(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(PLAYER_TRASH_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PLAYER_TRASH_STORE))r.result.createObjectStore(PLAYER_TRASH_STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB indisponível'));}catch(e){reject(e)}})}
async function savePlayerTrash(player){if(!player?.id)return;try{const db=await playerTrashOpen();const snap={id:String(player.id),deletedAt:Date.now(),player:clone(player)};await new Promise((resolve,reject)=>{const tx=db.transaction(PLAYER_TRASH_STORE,'readwrite');tx.objectStore(PLAYER_TRASH_STORE).put(snap,snap.id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error||new Error('trash'))}})}catch(e){console.warn('Lixeira local do Player falhou:',e)}}
async function getPlayerTrash(){try{const db=await playerTrashOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction(PLAYER_TRASH_STORE,'readonly'),req=tx.objectStore(PLAYER_TRASH_STORE).getAll();req.onsuccess=()=>{db.close();resolve((req.result||[]).sort((a,b)=>b.deletedAt-a.deletedAt))};req.onerror=()=>{db.close();reject(req.error)}})}catch{return []}}
async function removePlayerTrash(id){try{const db=await playerTrashOpen();await new Promise((resolve,reject)=>{const tx=db.transaction(PLAYER_TRASH_STORE,'readwrite');tx.objectStore(PLAYER_TRASH_STORE).delete(String(id));tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}catch{}}
async function restoreDeletedPlayerFromTrash(id){const rows=await getPlayerTrash(),snap=rows.find(x=>String(x.id)===String(id));if(!snap?.player)throw new Error('PLAYER_NAO_ENCONTRADO');await saveLocalRecovery('antes-da-restauracao-player');await restorePlayerServer(snap.player);const restored=clone(snap.player);restored._syncUpdatedAt=nextStamp();state.players=[...state.players.filter(p=>playerSyncKey(p)!==String(id)),restored];state.playerTombstones=state.playerTombstones||{};delete state.playerTombstones[String(id)];await removePlayerTrash(id);await integrityAudit('player-restored',{playerId:String(id)});persistCriticalCache();persistSessionCache();storageSet(KEY,serializeState());return restored}
const INTEGRITY_AUDIT_DB='a-profecia-integrity-v1',INTEGRITY_AUDIT_STORE='events';
function integrityAuditOpen(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(INTEGRITY_AUDIT_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(INTEGRITY_AUDIT_STORE))r.result.createObjectStore(INTEGRITY_AUDIT_STORE,{keyPath:'id',autoIncrement:true});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB indisponível'))}catch(e){reject(e)}})}
async function integrityAudit(action,details={}){try{const db=await integrityAuditOpen();await new Promise((resolve,reject)=>{const tx=db.transaction(INTEGRITY_AUDIT_STORE,'readwrite');tx.objectStore(INTEGRITY_AUDIT_STORE).add({at:Date.now(),action:String(action),role:state.session?.role||'',playerId:state.session?.playerId||'',details});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}catch(e){console.warn('Auditoria local indisponível:',e)}}
function campaignIntegrityReport(){const players=Array.isArray(state.players)?state.players:[],ids=new Set(),duplicates=[],missingId=[],invalid=[];for(const p of players){const id=String(p?.id||'').trim();if(!id){missingId.push(p?.name||p?.login||'sem nome');continue}if(ids.has(id))duplicates.push(id);ids.add(id);if(!String(p?.login||'').trim())invalid.push(id)}const pending=(()=>{try{return Number(JSON.parse(localStorage.getItem('a_profecia_sync_health_v1')||'{}')?.pending?1:0)}catch{return 0}})();return {ok:!duplicates.length&&!missingId.length&&!invalid.length,players:players.length,uniqueIds:ids.size,duplicates,missingId,invalid,pendingSync:pending,checkedAt:Date.now()}}
function exportCampaignEmergency(){const report=campaignIntegrityReport();const payload={format:'A-PROFECIA-EMERGENCY-BACKUP',version:APP_VERSION,exportedAt:new Date().toISOString(),integrity:report,state:JSON.parse(serializeState())};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`a-profecia-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);integrityAudit('emergency-export',report);toast(report.ok?'Backup de emergência exportado.':'Backup exportado com alertas de integridade.');}
async function getLocalRecoveries(){try{const db=await stateBackupOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction(STATE_BACKUP_STORE,'readonly'),req=tx.objectStore(STATE_BACKUP_STORE).getAll();req.onsuccess=()=>{db.close();resolve((req.result||[]).sort((a,b)=>b.createdAt-a.createdAt))};req.onerror=()=>{db.close();reject(req.error)}})}catch{return []}}
async function restoreLocalRecovery(){const list=await getLocalRecoveries();if(list.length<2&&list.length<1)throw new Error('Nenhum backup local encontrado');const snap=list[0];await saveLocalRecovery('antes-da-restauracao');state=clone(snap.state);state.items=migrateItems(state.items);storageSet(KEY,serializeState());if(remoteEnabled){try{const old=await fetchGlobal();if(old?.data)await backupGlobal(old.data,'antes-da-restauracao-local');await pushGlobalTracked(globalPayload())}catch(e){console.warn('Falha ao enviar restauração ao Supabase:',e)}}render(currentView||'home');toast(`Backup restaurado: ${new Date(snap.createdAt).toLocaleString('pt-BR')}`)}
function localRichness(s){if(!s)return 0;const arr=k=>Array.isArray(s[k])?s[k].length:0;const obj=k=>s[k]&&typeof s[k]==='object'?Object.keys(s[k]).length:0;const cc=s.customContent||{};return arr('players')*100+arr('creatures')*70+arr('items')*3+arr('spells')*2+arr('sounds')*5+arr('musicLibrary')*6+arr('tvScenes')*10+obj('backgrounds')*15+obj('uiIcons')*2+Object.values(cc).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0)*8+(s.combatSession?.history?.length||0)*4+(s.combatSession?.participants?.length||0)*3}
function mergePreferRicherLocal(remote){if(!remote)return false;const before=clone(state);const localScore=localRichness(before),remoteState={...remote};const remoteScore=localRichness(remoteState);if(localScore<=remoteScore)return false;const arrays=['players','creatures','items','spells','sounds','tvScenes'];for(const k of arrays){if(Array.isArray(before[k])&&Array.isArray(remoteState[k])&&before[k].length>remoteState[k].length)remoteState[k]=before[k]}for(const k of ['backgrounds','uiIcons','customContent']){if(before[k]&&remoteState[k]&&Object.keys(before[k]).length>Object.keys(remoteState[k]).length)remoteState[k]=before[k]}mergeGlobal(remoteState);return true}

function storageGet(key){try{return localStorage.getItem(key)}catch{return memoryStore[key]??null}}
function storageSet(key,value){try{localStorage.setItem(key,value)}catch{memoryStore[key]=value}}
const SESSION_CACHE_KEY='a_profecia_session_v3';
const SESSION_TAB_KEY='a_profecia_session_tab_v1';
function tabSessionGet(){try{const t=sessionStorage.getItem(SESSION_TAB_KEY);if(t){const v=JSON.parse(t);if(v?.role)return v}}catch{}return null}
function readStoredSession(){const t=tabSessionGet();if(t)return t;try{const c=JSON.parse(storageGet(SESSION_CACHE_KEY)||'null');if(c?.role)return c}catch{}return null}
function clearSessionCache(){try{localStorage.removeItem(SESSION_CACHE_KEY)}catch{}try{delete memoryStore[SESSION_CACHE_KEY]}catch{}try{sessionStorage.removeItem(SESSION_TAB_KEY)}catch{}}
const GLOBAL_DIRTY_KEY='a_profecia_global_dirty_v1';
function markGlobalDirty(){const t=Date.now();storageSet(GLOBAL_DIRTY_KEY,String(t));return t}
function clearGlobalDirty(stamp){if(Number(storageGet(GLOBAL_DIRTY_KEY)||0)<=stamp)storageSet(GLOBAL_DIRTY_KEY,'0')}
function globalDirty(){return Number(storageGet(GLOBAL_DIRTY_KEY)||0)>0}
const MEDIA_CACHE_KEY='a_profecia_critical_media_v3';
const VIEW_CACHE_KEY='a_profecia_view_v1';
function viewCacheGet(){try{return sessionStorage.getItem(VIEW_CACHE_KEY)||''}catch{return ''}}
function viewCacheSet(view){try{sessionStorage.setItem(VIEW_CACHE_KEY,String(view||''))}catch{}}
function imageValue(v){return typeof v==='string'&&v.trim()?v.trim():''}
function criticalMediaSnapshot(s){
  const out={siteBrand:{image:imageValue(s?.siteBrand?.image)},backgrounds:{},spells:{},uiIcons:{attrs:{},skills:{},conditions:{},sessionSlots:{},sessionTheme:{},sessionGlyphs:{}},deities:{},players:{}};
  for(const [k,v] of Object.entries(s?.backgrounds||{})) if(v) out.backgrounds[k]={...v,url:imageValue(v.url),mediaId:v.mediaId||'',updatedAt:Number(v.updatedAt)||0};
  for(const sp of (Array.isArray(s?.spells)?s.spells:[])) if(sp?.id) out.spells[String(sp.id)]={image:imageValue(sp.image)};
  for(const group of ['attrs','skills','conditions','sessionSlots','sessionTheme','sessionGlyphs']) for(const [k,v] of Object.entries(s?.uiIcons?.[group]||{})) if(imageValue(v)) out.uiIcons[group][k]=v;
  for(const d of (s?.customContent?.deities||[])) if(d?.id&&imageValue(d.image)) out.deities[String(d.id)]={image:d.image};
  for(const pl of (s?.players||[])) if(pl?.id) out.players[String(pl.id)]={photo:imageValue(pl.photo),soulPhoto:imageValue(pl.soulPhoto),homeWallpaper:imageValue(pl.homeWallpaper)};
  return out;
}
function persistCriticalCache(){try{storageSet(MEDIA_CACHE_KEY,JSON.stringify(criticalMediaSnapshot(state)))}catch{}}
function persistSessionCache(){try{const ss=state?.session;if(!ss)return;const payload=JSON.stringify({role:ss.role,login:ss.login||'',playerId:ss.playerId||'',playerSnapshot:ss.playerSnapshot?clone(ss.playerSnapshot):null,at:Date.now()});storageSet(SESSION_CACHE_KEY,payload);try{sessionStorage.setItem(SESSION_TAB_KEY,payload)}catch{}}catch{}}
function mergeCriticalCacheIntoState(cache,target=state){
  if(!cache||typeof cache!=='object')return false; let changed=false;
  const state=target;
  state.siteBrand=state.siteBrand||{}; if(!imageValue(state.siteBrand.image)&&imageValue(cache.siteBrand?.image)){state.siteBrand.image=cache.siteBrand.image;changed=true}
  state.backgrounds=state.backgrounds||{}; for(const [k,v] of Object.entries(cache.backgrounds||{})){const cur=state.backgrounds[k]||{};if(!imageValue(cur.url)&&imageValue(v?.url)){cur.url=v.url;changed=true}if(!cur.mediaId&&v?.mediaId){cur.mediaId=v.mediaId;changed=true}if(!cur.name&&v?.name){cur.name=v.name;changed=true}state.backgrounds[k]=cur}
  state.spells=Array.isArray(state.spells)?state.spells:[];for(const sp of state.spells){const c=cache.spells?.[String(sp.id)];if(c&&!imageValue(sp.image)&&imageValue(c.image)){sp.image=c.image;changed=true}}
  state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};for(const g of ['attrs','skills','conditions','sessionSlots','sessionTheme','sessionGlyphs']){state.uiIcons[g]=state.uiIcons[g]||{};for(const [k,v] of Object.entries(cache.uiIcons?.[g]||{}))if(!imageValue(state.uiIcons[g][k])&&imageValue(v)){state.uiIcons[g][k]=v;changed=true}}
  state.customContent=state.customContent||{attrs:[],skills:[],conditions:[],deities:[]};state.customContent.deities=Array.isArray(state.customContent.deities)?state.customContent.deities:[];for(const d of state.customContent.deities){const c=cache.deities?.[String(d.id)];if(c&&!imageValue(d.image)&&imageValue(c.image)){d.image=c.image;changed=true}}
  for(const pl of (state.players||[])){const c=cache.players?.[String(pl.id)];if(!c)continue;for(const k of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(pl[k])&&imageValue(c[k])){pl[k]=c[k];changed=true}}
  return changed;
}
function clone(v){return JSON.parse(JSON.stringify(v))}
initPlayers({getState:()=>state,clone,storageGet,storageSet,KEY,serializeState,sameGlobalValue,normalize,imageValue,persistCriticalCache,persistSessionCache,refreshMasterPlayersAdminView,cryptoRandomId});
let state=clone(DEFAULT);
state=load();
ps.lastSnapshot=clone(state.players||[]);
function load(){try{const raw=storageGet(KEY)||storageGet('filii_abyssi_state_v10')||storageGet('filii_abyssi_state_v8');const saved=raw?JSON.parse(raw):null;if(!saved){const fresh=clone(DEFAULT);try{const cs=readStoredSession();if(cs?.role)fresh.session={role:cs.role,login:cs.login||'',playerId:cs.playerId||'',playerSnapshot:cs.playerSnapshot||null}}catch{}try{const cm=JSON.parse(storageGet(MEDIA_CACHE_KEY)||'null');mergeCriticalCacheIntoState(cm,fresh)}catch{}return fresh;}try{const tabS=tabSessionGet(),cs=tabS||(!saved.session?readStoredSession():null);if(cs?.role)saved.session={role:cs.role,login:cs.login||'',playerId:cs.playerId||'',playerSnapshot:cs.playerSnapshot||null}}catch{};try{const cachedMedia=storageGet(MEDIA_CACHE_KEY);if(cachedMedia)saved.__criticalMediaCache=JSON.parse(cachedMedia)}catch{};saved.siteBrand={name:'Ashen Testimony',image:'runa-gold.png',...(saved.siteBrand||{})};saved.siteBrand.name=String(saved.siteBrand.name||'Ashen Testimony').trim()||'Ashen Testimony';saved.siteBrand.image=saved.siteBrand.image||'runa-gold.png';saved.characterRules={campaign:{...DEFAULT_RULES.campaign,...(saved.characterRules?.campaign||{})},slasher:{...DEFAULT_RULES.slasher,...(saved.characterRules?.slasher||{})}};saved.classBonuses={...clone(CLASS_BONUSES_DEFAULTS_V107),...(saved.classBonuses||{})};saved.items=migrateItems(saved.items);saved.players=Array.isArray(saved.players)?saved.players:[];saved.playerTombstones=saved.playerTombstones&&typeof saved.playerTombstones==='object'?saved.playerTombstones:{};saved.creatures=Array.isArray(saved.creatures)?saved.creatures:[];saved.sounds=Array.isArray(saved.sounds)?saved.sounds:[];saved.musicLibrary=Array.isArray(saved.musicLibrary)?saved.musicLibrary:[];if(saved.music?.url&&!saved.musicLibrary.some(x=>String(x.url)===String(saved.music.url)))saved.musicLibrary.unshift({id:saved.music.mediaId||`music-${Date.now()}`,title:saved.music.title||'Trilha da campanha',url:saved.music.url,kind:saved.music.kind||'url',createdAt:Number(saved.music.commandAt)||Date.now()});saved.spells=Array.isArray(saved.spells)&&saved.spells.length?saved.spells:INITIAL_SPELLS.map(clone);saved.uiIcons=saved.uiIcons||{attrs:{},skills:{}};saved.uiIcons.attrs={...DEFAULT_ATTR_ICONS,...(saved.uiIcons.attrs||{})};saved.uiIcons.skills={...DEFAULT_SKILL_ICONS,...(saved.uiIcons.skills||{})};saved.uiIcons.conditions={...(saved.uiIcons.conditions||{})};saved.uiIcons.sessionSlots={main:'⚔',off:'◈',consumable:'✦',tool:'⚒',relic:'☽',free:'◇',...(saved.uiIcons.sessionSlots||{})};saved.backgrounds={...(saved.backgrounds||{})};saved.customContent={attrs:[],skills:[],conditions:[],deities:[],...(saved.customContent||{})};saved.combatSession={...defaultCombatSession(),...(saved.combatSession||{})};saved.combatSession.sessionId=String(saved.combatSession.sessionId||'')||cryptoRandomId('combat');saved.combatSession.round=Math.max(1,Number(saved.combatSession.round)||1);saved.combatSession.turn=Math.max(0,Number(saved.combatSession.turn)||0);saved.combatSession.participants=Array.isArray(saved.combatSession.participants)?saved.combatSession.participants:[];saved.combatSession.actedKeys=Array.isArray(saved.combatSession.actedKeys)?saved.combatSession.actedKeys.map(String):[];saved.combatSession.history=Array.isArray(saved.combatSession.history)?saved.combatSession.history:[];saved.terrorMode={...defaultTerrorMode(),...(saved.terrorMode||{})};saved.nexus={active:false,title:'Nexus Tabletop',url:'',...(saved.nexus||{})};saved.tvScreen={...defaultTvScreen(),...(saved.tvScreen||{})};saved.tvScenes=Array.isArray(saved.tvScenes)?saved.tvScenes:[];saved.soundboard={volume:.85,enabled:true,...(saved.soundboard||{})};saved.secretClues=Array.isArray(saved.secretClues)?saved.secretClues:[];saved.rulesBook={title:'Livro de Regras',url:'',kind:'url',...(saved.rulesBook||{})};if(typeof saved.music==='string')saved.music={type:'audio',url:saved.music,title:'Trilha da sessão'};saved.music=saved.music||{type:'',url:'',title:'',kind:'url',mediaId:''};saved.slasherIntroMusic=saved.slasherIntroMusic||{url:'',title:'',kind:'url'};if(typeof saved.music==='object'){saved.music.kind=saved.music.kind||'url';saved.music.mediaId=saved.music.mediaId||''}delete saved.sessionBoard;state=saved;saved.players.forEach(p=>{p.musicThemes=Array.isArray(p.musicThemes)?p.musicThemes:[];p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];p.homeWallpaper=p.homeWallpaper||'';normalize(p)});mergeCriticalCacheIntoState(saved.__criticalMediaCache,saved);delete saved.__criticalMediaCache;saved.version=1.0;return saved}catch(e){console.error('[Ashen Testimony] load() falhou; usando estado padrão:',e);loadFailed=true;try{const raw=storageGet(KEY);if(raw&&!storageGet(KEY+'_backup_loadfail'))storageSet(KEY+'_backup_loadfail',raw)}catch{}return clone(DEFAULT)}}
let remoteSaveTimer=null,remoteHydrated=false,remoteApplying=false;
let remoteRenderFrame=0,remoteRenderQueued=false;
function queueRemoteRender(view=currentView||'home'){
  if(document.hidden)return;
  if(remoteRenderQueued)return;
  remoteRenderQueued=true;
  clearTimeout(remoteRenderFrame);
  remoteRenderFrame=setTimeout(()=>{
    remoteRenderQueued=false;
    if(document.hidden||currentView!==view)return;
    render(view,{remote:true});
  },120);
}
function globalPayload(){
  const {session,sounds,players,playerTombstones,...shared}=state;
  const payload={version:shared.version,siteBrand:shared.siteBrand,creatures:shared.creatures,items:slimItems(shared.items),spells:shared.spells,uiIcons:shared.uiIcons,backgrounds:shared.backgrounds,music:shared.music,musicLibrary:shared.musicLibrary||[],slasherIntroMusic:shared.slasherIntroMusic,characterRules:shared.characterRules,classBonuses:shared.classBonuses,customContent:shared.customContent,combatSession:shared.combatSession,terrorMode:shared.terrorMode,nexus:shared.nexus,tvScreen:shared.tvScreen,tvScenes:shared.tvScenes,sounds:shared.sounds,soundboard:shared.soundboard,rulesBook:shared.rulesBook||{title:'Livro de Regras',url:'',kind:'url'}};
  if(!playerStoreEnabled){payload.players=players;payload.playerTombstones=playerTombstones||{}}
  return payload;
}

function globalPayloadSignature(payload){try{return JSON.stringify(payload??globalPayload())||''}catch{return ''}}
let lastConfirmedGlobalSignature='';
function rememberGlobalSignature(payload){const signature=globalPayloadSignature(payload);if(signature)lastConfirmedGlobalSignature=signature;return signature}
async function pushGlobalTracked(payload){const result=await pushGlobal(payload);rememberGlobalSignature(payload);return result}
function sameGlobalValue(a,b){
  if(a===b)return true;
  try{return JSON.stringify(a)===JSON.stringify(b)}catch{return false}
}
function mergeGlobal(remote){
  if(!remote||typeof remote!=='object')return {changed:false,domains:[]};
  const localSession=state.session;
  const keepLocalGlobal=localSession?.role==='master'&&globalDirty();
  const domains=[];
  if((!playerStoreEnabled||!ps.hydrated)&&remote.players!==undefined){if(mergePlayersRemote(remote.players,remote.playerTombstones))domains.push('players')}
  for(const key of ['siteBrand','creatures','items','spells','uiIcons','backgrounds','music','musicLibrary','slasherIntroMusic','characterRules','classBonuses','customContent','combatSession','terrorMode','nexus','tvScreen','tvScenes','sounds','soundboard','rulesBook']){
    if(remote[key]===undefined)continue;
    let next=clone(remote[key]);
    if(key==='siteBrand'){
      next={...(state.siteBrand||{}),...(next||{})};
      if(!imageValue(next.image)&&imageValue(state.siteBrand?.image))next.image=state.siteBrand.image;
    }
    if(key==='backgrounds'&&keepLocalGlobal){
      const local=state.backgrounds||{}; next=next||{};
      for(const [k,v] of Object.entries(local)){if(!next[k])next[k]=clone(v);else{if(!imageValue(next[k].url)&&imageValue(v?.url))next[k].url=v.url;if(!next[k].mediaId&&v?.mediaId)next[k].mediaId=v.mediaId;if(!next[k].name&&v?.name)next[k].name=v.name;if(!next[k].updatedAt&&v?.updatedAt)next[k].updatedAt=v.updatedAt;}}
    }
    if(key==='spells'){
      const localById=new Map((state.spells||[]).map(x=>[String(x.id),x]));
      next=(Array.isArray(next)?next:[]).map(sp=>{const l=localById.get(String(sp.id));if(l&&!imageValue(sp.image)&&imageValue(l.image))sp.image=l.image;return sp});
      for(const l of (state.spells||[]))if(!next.some(x=>String(x.id)===String(l.id)))next.push(clone(l));
    }
    if(key==='uiIcons'){
      next=next||{};const local=state.uiIcons||{};for(const g of ['attrs','skills','conditions','sessionSlots','sessionTheme','sessionGlyphs']){next[g]={...(next[g]||{})};for(const [k,v] of Object.entries(local[g]||{}))if(!imageValue(next[g][k])&&imageValue(v))next[g][k]=v;}
    }
    if(key==='customContent'){
      next={attrs:[],skills:[],conditions:[],deities:[],...(next||{})};const local=state.customContent||{};const localD=new Map((local.deities||[]).map(x=>[String(x.id),x]));next.deities=(next.deities||[]).map(d=>{const l=localD.get(String(d.id));if(l&&!imageValue(d.image)&&imageValue(l.image))d.image=l.image;return d});for(const l of (local.deities||[]))if(!next.deities.some(d=>String(d.id)===String(l.id)))next.deities.push(clone(l));
    }
    if(['combatSession','terrorMode','tvScreen','nexus'].includes(key)){
      const localObj=state[key]||{};
      const remoteTs=Number(next?.updatedAt)||0;
      const localTs=Number(localObj?.updatedAt)||0;
      if(remoteTs<localTs) next=clone(localObj);
    }
    const curCmp=key==='items'?slimItems(state[key]):state[key],nextCmp=key==='items'?slimItems(next):next;
    if(!sameGlobalValue(curCmp,nextCmp)){state[key]=next;domains.push(key);}
  }
  mergeCriticalCacheIntoState(criticalMediaSnapshot(state));
  persistCriticalCache();
  state.session=localSession;
  if(domains.length){
    state.siteBrand={name:'Ashen Testimony',image:'runa-gold.png',...(state.siteBrand||{})};state.siteBrand.name=String(state.siteBrand.name||'Ashen Testimony').trim()||'Ashen Testimony';state.siteBrand.image=state.siteBrand.image||'runa-gold.png';state.items=migrateItems(state.items);
    state.players=Array.isArray(state.players)?state.players:[];state.playerTombstones=state.playerTombstones&&typeof state.playerTombstones==='object'?state.playerTombstones:{};
    
    state.creatures=Array.isArray(state.creatures)?state.creatures:[];
    state.spells=Array.isArray(state.spells)&&state.spells.length?state.spells:INITIAL_SPELLS.map(clone);
    state.seededSpellIds=Array.isArray(state.seededSpellIds)?state.seededSpellIds:[];
    SEEDED_SPELL_IDS.forEach(id=>{if(state.seededSpellIds.includes(id))return;state.seededSpellIds.push(id);if(!state.spells.some(x=>String(x.id)===id)){const base=INITIAL_SPELLS.find(x=>x.id===id);if(base)state.spells.push(clone(base))}});
    state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};
    state.uiIcons.attrs={...DEFAULT_ATTR_ICONS,...(state.uiIcons.attrs||{})};
    state.uiIcons.skills={...DEFAULT_SKILL_ICONS,...(state.uiIcons.skills||{})};
    state.uiIcons.conditions={...(state.uiIcons.conditions||{})};state.uiIcons.sessionTheme={...(state.uiIcons.sessionTheme||{})};state.uiIcons.sessionGlyphs={...(state.uiIcons.sessionGlyphs||{})};
    state.backgrounds={...(state.backgrounds||{})};state.tvScreen={...defaultTvScreen(),...(state.tvScreen||{})};state.tvScenes=Array.isArray(state.tvScenes)?state.tvScenes:[];state.slasherIntroMusic=state.slasherIntroMusic||{url:'',title:'',kind:'url'};state.customContent={attrs:[],skills:[],conditions:[],deities:[],...(state.customContent||{})};
    state.characterRules={campaign:{...DEFAULT_RULES.campaign,...(state.characterRules?.campaign||{})},slasher:{...DEFAULT_RULES.slasher,...(state.characterRules?.slasher||{})}};state.classBonuses={...clone(CLASS_BONUSES_DEFAULTS_V107),...(state.classBonuses||{})};normalizeCombatSession();normalizeTerrorMode();state.nexus={active:false,title:'Nexus Tabletop',url:'',...(state.nexus||{})};state.soundboard={volume:.85,enabled:true,...(state.soundboard||{})};state.sounds=Array.isArray(state.sounds)?state.sounds:[];
    state.players.forEach(p=>{p.musicThemes=Array.isArray(p.musicThemes)?p.musicThemes:[];p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];p.homeWallpaper=p.homeWallpaper||'';normalize(p)});
    state.musicLibrary=Array.isArray(state.musicLibrary)?state.musicLibrary:[];
    state.creatures.forEach(normalize);
    state.version=1.0;
  }
  return {changed:domains.length>0,domains};
}
function hasRemoteSharedData(remote){
  return !!(remote&&typeof remote==='object'&&['siteBrand','players','playerTombstones','creatures','items','spells','uiIcons','backgrounds','music','musicLibrary','slasherIntroMusic','characterRules','classBonuses','customContent','combatSession','terrorMode','nexus','tvScreen','tvScenes','sounds','soundboard','rulesBook'].some(k=>remote[k]!==undefined));
}
let masterPlayersRefreshTimer=0;
function refreshMasterPlayersAdminView(){
  if(state.session?.role!=='master'||currentView!=='master'||adminTabCurrent!=='players')return;
  if(document.hidden)return;
  if(document.getElementById('entityModal'))return;
  const box=document.getElementById('adminContent');
  if(!box)return;
  const active=document.activeElement;
  if(active&&box.contains(active)&&/^(TEXTAREA|INPUT|SELECT)$/.test(active.tagName)){
    clearTimeout(masterPlayersRefreshTimer);
    masterPlayersRefreshTimer=setTimeout(()=>refreshMasterPlayersAdminView(),450);
    return;
  }
  clearTimeout(masterPlayersRefreshTimer);
  const pageY=window.scrollY;
  const top=box.scrollTop;
  const activeTab=adminTabCurrent;
  const oldHeight=Math.max(0,box.getBoundingClientRect().height);
  box.style.minHeight=`${Math.ceil(oldHeight)}px`;
  box.style.overflowAnchor='none';
  const nextHtml=playersAdmin();
  const sig=nextHtml.replace(/(id="playerSyncStatus">)[^<]*/,'$1');
  if(box.__playersSig===sig&&box.querySelector(':scope > .players-admin-card')){
    const st=document.getElementById('playerSyncStatus'),m=/id="playerSyncStatus">([^<]*)/.exec(nextHtml);
    if(st&&m)st.textContent=m[1].replace(/&amp;/g,'&');
    box.style.minHeight='';
    box.style.overflowAnchor='';
    return;
  }
  box.innerHTML=nextHtml;
  box.__playersSig=sig;
  bindAdminContent();
  box.scrollTop=top;
  const restore=()=>{
    if(currentView!=='master'||adminTabCurrent!==activeTab)return;
    box.scrollTop=top;
    const delta=Math.abs(window.scrollY-pageY);
    if(delta>1)window.scrollTo(0,pageY);
    requestAnimationFrame(()=>{
      if(currentView==='master'&&adminTabCurrent===activeTab){
        box.scrollTop=top;
        if(Math.abs(window.scrollY-pageY)>1)window.scrollTo(0,pageY);
        box.style.minHeight='';
        box.style.overflowAnchor='';
      }
    });
  };
  requestAnimationFrame(restore);
}

function historyDiagnosticText(error){
  const raw=String(error?.message||error||'');
  const code=String(error?.code||'');
  if(/SESSAO_INVALIDA/i.test(raw))return 'Sua sessão expirou. Saia e entre novamente como Mestre.';
  if(/NAO_AUTORIZADO/i.test(raw))return 'O servidor não reconheceu a permissão de Mestre para consultar o histórico.';
  if(/PGRST202|42883|function .*a_profecia_player_history_(list|get).*does not exist|Could not find the function/i.test(`${code} ${raw}`))return 'As funções do histórico não estão disponíveis no Supabase. A migração 20261005140000_player_history_and_field_merge.sql precisa estar aplicada no projeto conectado.';
  if(/Failed to fetch|NetworkError|fetch failed|OFFLINE/i.test(raw))return 'Sem conexão confirmada com o servidor. Confira a internet e tente novamente.';
  if(/Supabase não configurado/i.test(raw))return 'A configuração do Supabase não foi carregada neste ambiente.';
  return `${authErrorText(error)}${code?` (código ${code})`:''}`;
}
function bindPlayerHistoryUI(){
  if(window.__ashenHistoryBound)return;window.__ashenHistoryBound=true;
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-hist-p]');if(!b)return;
    e.preventDefault();e.stopPropagation();
    const p=state.players[Number(b.dataset.histP)];if(p)openPlayerHistory(p.id);
  },true);
}
async function openPlayerHistory(playerId){
  const p=state.players.find(x=>String(x.id)===String(playerId));if(!p)return;
  document.getElementById('historyModal')?.remove();
  const close=()=>document.getElementById('historyModal')?.remove();
  openModal(`<div class="modal" id="historyModal"><div class="modal-card"><button class="modal-close" id="closeHistory">×</button><span class="section-kicker">HISTÓRICO NO SERVIDOR</span><h2>${esc(p.name||p.login||'Player')}</h2><p class="small muted">Cada versão salva da ficha. Restaure só os pontos ou a ficha inteira.</p><div id="historyList"><div class="empty">Carregando…</div></div></div></div>`);
  document.getElementById('closeHistory').onclick=close;
  const box=document.getElementById('historyList');
  let rows=[];
  try{rows=await fetchPlayerHistory(p.id)}catch(err){box.innerHTML=`<div class="empty"><strong>Não foi possível carregar o histórico.</strong><p>${esc(historyDiagnosticText(err))}</p></div>`;return}
  if(!rows.length){box.innerHTML='<div class="empty">Ainda não há versões guardadas deste Player.</div>';return}
  const who={master:'Mestre',player:'Player',baseline:'Ponto de partida'};
  box.innerHTML=`<div class="list">${rows.map(r=>`<div class="item"><div class="item-meta"><strong>${esc(new Date(r.saved_at).toLocaleString('pt-BR'))}</strong><div class="line">${esc(who[r.saved_by]||'—')} • Vida ${esc(r.hp??'—')} • Sanidade ${esc(r.sanity??'—')} • Atributos ${esc(Number(r.attr_points)||0)} • Perícias ${esc(Number(r.skill_points)||0)}</div></div><div class="row"><button class="btn small" data-hist-restore="${esc(r.id)}" data-mode="points">Só pontos</button><button class="btn small danger" data-hist-restore="${esc(r.id)}" data-mode="full">Ficha inteira</button></div></div>`).join('')}</div>`;
  box.onclick=async ev=>{
    const btn=ev.target.closest('[data-hist-restore]');if(!btn)return;
    const mode=btn.dataset.mode;
    if(!confirm(mode==='points'?'Restaurar SÓ os atributos e perícias desta versão?':'Restaurar a FICHA INTEIRA para esta versão? O que foi alterado depois dela será substituído.'))return;
    btn.disabled=true;
    try{
      const snap=await fetchPlayerHistoryEntry(p.id,btn.dataset.histRestore);
      if(!snap||typeof snap!=='object')throw new Error('Versão não encontrada.');
      const target=state.players.find(x=>String(x.id)===String(p.id));if(!target)throw new Error('Player não encontrado.');
      restorePlayerFromSnapshot(target,snap,mode);
      toast(mode==='points'?'Pontos restaurados.':'Ficha restaurada.');
      close();render('master');
    }catch(err){btn.disabled=false;toast(historyDiagnosticText(err)||'Não foi possível restaurar.')}
  };
}
function restorePlayerFromSnapshot(target,snap,mode){
  const keep=new Set(['id','login','_syncUpdatedAt','_keyAt','_pointsAt','password','newPassword']);
  if(mode==='points'){target.attrs=clone(snap.attrs||{});target.skills=clone(snap.skills||{})}
  else{
    for(const k of Object.keys(target))if(!keep.has(k))delete target[k];
    for(const [k,v] of Object.entries(snap))if(!keep.has(k))target[k]=clone(v);
  }
  normalize(target);
  save();
}
function bindDurableSaveLifecycle(){
  if(window.__aProfeciaDurableSaveBound)return;
  window.__aProfeciaDurableSaveBound=true;
  const flush=()=>{try{flushSave(true)}catch{}};
  window.addEventListener('pagehide',flush,{capture:true});
  window.addEventListener('beforeunload',flush,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});
}
function startStabilityPatch(){
  bindDurableSaveLifecycle();
  bindPlayerHistoryUI();
  if(stabilityOnlineHandlerBound)return;
  stabilityOnlineHandlerBound=true;
  const onOnline=()=>{
    setTimeout(()=>{
      if(remoteEnabled&&state.session?.role==='master'&&!remoteApplying){
        saveGlobalNow().catch(()=>{});
      }
      reconcilePlayersStability();
    },900);
  };
  const onOffline=()=>{
    try{document.documentElement.dataset.aProfeciaOffline='1'}catch{}
  };
  const onConnection=()=>{
    try{
      document.documentElement.dataset.aProfeciaOffline=navigator.onLine?'0':'1';
      const status=document.getElementById('playerSyncStatus');
      if(status){const base=ps.lastSyncAt?`Última sincronização: ${new Date(ps.lastSyncAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Sincronização ainda não confirmada';status.textContent=base+(navigator.onLine===false?' • OFFLINE':'')}
    }catch{}
  };
  window.addEventListener('online',onOnline);
  window.addEventListener('offline',onOffline);
  window.addEventListener('online',onConnection);
  window.addEventListener('offline',onConnection);
  window.addEventListener('pageshow',()=>{
    if(document.hidden)return;
    setTimeout(()=>reconcilePlayersStability(),250);
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(()=>reconcilePlayersStability(),350);
  });
  onConnection();
  const mobile=matchMedia('(max-width: 800px)').matches;
  const delay=mobile?90000:60000;
  clearTimeout(stabilityPlayerPollTimer);
  const schedulePlayerReconcile=()=>{
    stabilityPlayerPollTimer=setTimeout(async()=>{
      try{await reconcilePlayersStability()}catch{}
      schedulePlayerReconcile();
    },Math.round(delay*(0.85+Math.random()*0.30)));
  };
  schedulePlayerReconcile();
}
function queueRemoteSave(){
  if(state.session?.role!=='master'||!remoteEnabled)return;
  if(remoteHydrated&&!remoteApplying&&!globalDirty()&&lastConfirmedGlobalSignature){
    const candidate=globalPayload();
    if(globalPayloadSignature(candidate)===lastConfirmedGlobalSignature)return;
  }
  const stamp=markGlobalDirty();
  if(!remoteHydrated||remoteApplying)return;
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer=setTimeout(async()=>{
    try{await queueGlobalRemoteSave(globalPayload());clearGlobalDirty(stamp)}
    catch(e){console.warn('Falha ao sincronizar dados globais; snapshot mantido na fila:',e)}
  },500);
}
function save(){saveDirty=true;try{const current=state.session?.role==='player'?(state.players.find(x=>playerSyncKey(x)===state.session.playerId)||state.players.find(x=>String(x.login||'').toLowerCase()===String(state.session.login||'').toLowerCase())):null;if(current)schedulePlayerSheetBackup(current,state.session?.sheetDraft,250)}catch(err){console.warn('Backup automático da ficha falhou:',err)}const now=Date.now();if(!saveFirstAt)saveFirstAt=now;clearTimeout(saveTimer);saveTimer=setTimeout(()=>flushSave(),Math.max(0,Math.min(450,1800-(now-saveFirstAt))))}
function flushSave(force=false,opts={}){clearTimeout(saveTimer);if(!saveDirty&&!force)return;saveDirty=false;saveFirstAt=0;markLocalPlayerChanges();persistCriticalCache();persistSessionCache();const isPlayer=state.session?.role==='player';if(isPlayer){const current=state.players.find(x=>playerSyncKey(x)===state.session.playerId)||state.players.find(x=>String(x.login||'').toLowerCase()===String(state.session.login||'').toLowerCase());if(current){state.session.playerId=current.id;state.session.playerSnapshot=clone(current);schedulePlayerSheetBackup(current,state.session?.sheetDraft,0)}}storageSet(KEY,serializeState());storageSet('a_profecia_local_changed_at',String(Date.now()));if(!opts.skipRemote){if(state.session?.role==='master')queueRemoteSave();queuePlayerDbSave();saveLocalRecovery('save').catch(()=>{})}}
configureSyncCoordinator(pushGlobalTracked).catch(()=>{});
function queueGlobalRemoteSave(payload){
  return enqueueGlobalSnapshot(clone(payload));
}

async function saveGlobalNow(){
  flushSave(true,{skipRemote:true});
  queuePlayerDbSave();
  saveLocalRecovery('global-save').catch(()=>{});
  if(state.session?.role!=='master')return null;
  if(!remoteEnabled)return null;
  const hadPendingGlobal=globalDirty();
  const stamp=markGlobalDirty();
  for(let i=0;i<50&&(remoteApplying||!remoteHydrated);i++)await new Promise(r=>setTimeout(r,100));
  if(remoteApplying||!remoteHydrated){toast('Alteração salva neste dispositivo, mas ainda NÃO foi enviada aos outros (sincronização indisponível). Ela será reenviada ao recarregar.');return null}

  const payload=globalPayload();
  if(!hadPendingGlobal&&lastConfirmedGlobalSignature&&globalPayloadSignature(payload)===lastConfirmedGlobalSignature){clearGlobalDirty(stamp);return {verified:true,unchanged:true}}
  try{
    const result=await queueGlobalRemoteSave(payload);
    clearGlobalDirty(stamp);
    return result;
  }catch(e){
    (/SESSAO_INVALIDA|NAO_AUTORIZADO/.test(String(e?.message||''))?console.warn:console.error)('Falha ao sincronizar alteração global:',e);
    toast(`Alteração salva neste dispositivo, mas NÃO foi enviada aos outros: ${e?.message||'erro de sincronização'}`);
    return null;
  }
}
function clamp(v,min,max){v=Number(v);if(!Number.isFinite(v))v=min;return Math.max(min,Math.min(max,Math.round(v)))}
function campaignResourceMax(points){const n=Math.max(0,Math.floor(Number(points)||0));if(n<=1)return 18;if(n===2)return 24;return Math.min(45,27+(n-3)*9)}
function derivedMax(e,attr){const r=characterRules(e?.campaignType);if(attr==='Corpo'){const corpo=Math.max(0,Number(effectiveAttr(e,attr))||0);if(e?.campaignType==='slasher')return Math.min(9999,Math.max(Number(r.hpMax)||1,corpo*9));return campaignResourceMax(corpo)}if(attr==='Sanidade'&&e?.campaignType!=='slasher')return campaignResourceMax(Math.max(0,Number(effectiveAttr(e,attr))||0));return Math.min(35,Math.max(0,effectiveAttr(e,attr)*9))}
function syncDerivedResources(e){if(!e)return e;const hpMax=derivedMax(e,'Corpo');const sanityMax=derivedMax(e,'Sanidade');e.hpMax=Math.max(1,hpMax);e.hp=clamp(e.hp??e.hpMax,0,e.hpMax);e.sanityMax=sanityMax;e.sanity=clamp(e.sanity??sanityMax,0,sanityMax);if('login' in e){const c=derivedCombat(e);e.attack=c.atk;e.defense=c.def}return e}
function punchDamage(e){const body=Math.max(0,effectiveAttr(e,'Corpo')),strength=Math.max(0,effectiveAttr(e,'Força'));return `1d4 + ${Math.floor((body+strength)/2)}`;}
function trainedSkills(e){return allSkills().filter(sk=>(effectiveSkill(e,sk)||0)>0).sort((a,b)=>(effectiveSkill(e,b)||0)-(effectiveSkill(e,a)||0));}
function tickPlayerHungerOnRound(players,round){if(!Number.isFinite(Number(round))||Number(round)<=0||Number(round)%5!==0)return [];const events=[];for(const p of (players||[])){normalize(p);const before=p.hunger;p.hunger=clamp((Number(p.hunger)||0)-10,0,100);p.hungerRoundCounter=Number(round);if(before!==p.hunger)events.push(`${p.name||p.login}: fome ${before}% → ${p.hunger}%`);if(p.hunger<=0&&!p.conditions.includes('intense-hunger')){p.conditions.push('intense-hunger');initializeConditionTurns(p);events.push(`${p.name||p.login}: Fome intensa aplicada`);}}return events;}
function hungerBarMarkup(p){const h=clamp(p?.hunger??100,0,100);const tone=h<=20?'danger':h<=50?'warn':'ok';const next=Math.max(5,(Math.floor(Number(p?.hungerRoundCounter||0)/5)+1)*5);return `<div class="player-hunger ${tone}"><div class="hunger-head"><span>FOME</span><strong>${h}%</strong></div><div class="hunger-track"><i style="width:${h}%"></i></div><small>${h<=0?'Fome intensa':`Próxima queda automática: rodada ${next}`}</small></div>`;}
function normalize(e){const isMonsterEntity=!!e&&(e.kind==='monster'||(Array.isArray(state?.creatures)&&state.creatures.includes(e)));if(isMonsterEntity){delete e.login;delete e.password}if(playerStoreEnabled&&e&&'password' in e&&!e.newPassword)delete e.password;if(e&&'login' in e){e.determinationMax=clamp(e.determinationMax??DET_DEFAULT_MAX,0,99);e.determination=clamp(e.determination??e.determinationMax,0,e.determinationMax)}const hpCap=isMonsterEntity?9999:(e?.campaignType==='slasher'?9999:45);e.hpMax=clamp(e.hpMax??35,1,hpCap);e.hp=clamp(e.hp??e.hpMax,0,e.hpMax);e.attrLimits=e.attrLimits||blankLimits();e.attrs=e.attrs||blankAttrs();e.skills=e.skills||blankSkills();e.soul=e.soul||'';e.soulPhoto=e.soulPhoto||'';e.belovedObjects=e.belovedObjects||'';e.personality=e.personality||'';e.destiny=e.destiny||'';e.description=e.description||'';e.history=e.history||'';e.conditions=Array.isArray(e.conditions)?e.conditions:[];e.conditionTurns=e.conditionTurns&&typeof e.conditionTurns==='object'?e.conditionTurns:{};initializeConditionTurns(e);e.rolls=mergeRollHistory(Array.isArray(e.rolls)?e.rolls:[],null);allAttrs().forEach(a=>{e.attrLimits[a]=e.attrLimits[a]||{min:0,max:MAX_ATTR};e.attrLimits[a].min=0;e.attrLimits[a].max=MAX_ATTR;e.attrs[a]=clamp(e.attrs[a]??0,0,MAX_ATTR)});allSkills().forEach(sk=>{e.skills[sk]=clamp(e.skills[sk]??0,0,MAX_SKILL)});e.backpack=Array.isArray(e.backpack)?e.backpack:[];e.bookPages=Array.isArray(e.bookPages)?e.bookPages:(e.bookContent?[String(e.bookContent)]:[]);e.backpack.forEach(b=>{b.qty=Math.max(1,Number(b.qty)||1);const it=item(b.id);if(it)b.qty=Math.min(it.maxQty,b.qty)});e.attack=Number(e.attack)||0;e.defense=Number(e.defense)||0;e.status=e.status||'Ativo';e.attrBonusPoints=Math.max(0,Number(e.attrBonusPoints)||0);e.skillBonusPoints=Math.max(0,Number(e.skillBonusPoints)||0);e.campaignType=e.campaignType==='slasher'?'slasher':'campaign';e.slasherReligion=e.slasherReligion==='yes'||e.slasherReligion==='no'?e.slasherReligion:'';e.slasherBelief=['only-self','occult','one-god'].includes(e.slasherBelief)?e.slasherBelief:'';e.initialSpell=e.initialSpell||'';e.personalSpells=Array.isArray(e.personalSpells)?e.personalSpells:[];e.grantedSpells=Array.isArray(e.grantedSpells)?e.grantedSpells:[];e.musicThemes=Array.isArray(e.musicThemes)?e.musicThemes:[];e.playerMusicLibrary=Array.isArray(e.playerMusicLibrary)?e.playerMusicLibrary:[];e.secretClues=Array.isArray(e.secretClues)?e.secretClues:[];e.element=['Sangue','Morte','Energia','Conhecimento'].includes(e.element)?e.element:'';e.hunger=clamp(e.hunger??100,0,100);e.hungerRoundCounter=Math.max(0,Number(e.hungerRoundCounter)||0);e.secretLovedEffect=e.secretLovedEffect||'';e.turnAlertSound=(e.turnAlertSound&&typeof e.turnAlertSound==='object')?e.turnAlertSound:{url:'',name:'',enabled:false};if(Object.prototype.hasOwnProperty.call(e,'login'))syncDerivedResources(e)}
function cryptoRandomId(prefix='id'){
  try{
    if(globalThis.crypto?.randomUUID)return `${prefix}-${globalThis.crypto.randomUUID()}`;
    const a=new Uint32Array(3);globalThis.crypto?.getRandomValues?.(a);
    return `${prefix}-${Date.now().toString(36)}-${Array.from(a).map(n=>n.toString(36)).join('')}`;
  }catch{return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
}
function rollDiceExpression(expr){const raw=String(expr||'').trim().replace(/\s+/g,'');const m=raw.match(/^(\d*)d(\d+)([+-]\d+)?$/i);if(!m)return null;const count=Math.max(1,Math.min(50,Number(m[1]||1))),sides=Math.max(2,Math.min(1000,Number(m[2]))),mod=Number(m[3]||0);const rolls=[];for(let i=0;i<count;i++){let n;if(window.crypto?.getRandomValues){const limit=Math.floor(0x100000000/sides)*sides,arr=new Uint32Array(1);do{crypto.getRandomValues(arr)}while(arr[0]>=limit);n=arr[0]%sides+1}else n=Math.floor(Math.random()*sides)+1;rolls.push(n)}const sum=rolls.reduce((a,b)=>a+b,0);return{rolls,mod,total:sum+mod,label:count+'d'+sides+(mod>0?'+'+mod:mod<0?String(mod):'')}}
function rollExpressionFor(p,expr){
 const raw=String(expr||'').trim().replace(/\s+/g,'');
 const m=raw.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
 if(!m){toast('Use um formato como d10+6, 2d6 ou 1d20-2.');return null}
 const count=Math.max(1,Math.min(50,Number(m[1]||1))),sides=Math.max(2,Math.min(1000,Number(m[2]))),mod=Number(m[3]||0);
 const rolls=[];for(let i=0;i<count;i++){let n;if(window.crypto?.getRandomValues){const limit=Math.floor(0x100000000/sides)*sides,arr=new Uint32Array(1);do{crypto.getRandomValues(arr)}while(arr[0]>=limit);n=arr[0]%sides+1}else n=Math.floor(Math.random()*sides)+1;rolls.push(n)}
 const diceTotal=rolls.reduce((a,b)=>a+b,0),value=diceTotal+mod;
 const label=`${count}d${sides}${mod>0?'+'+mod:mod<0?mod:''}`;
 const roll={id:cryptoRandomId('roll'),value,die:label,label,time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),rawRolls:rolls,modifier:mod,diceTotal,createdAt:Date.now()};
 p.rolls=mergeRollHistory(p.rolls,roll);save();updateDiceUI(roll);return roll;
}
function rollDiceFor(p,sides,label=null){
 if(!p)return null;const die=Math.max(2,Number(sides)||20);let n;if(window.crypto?.getRandomValues){const limit=Math.floor(0x100000000/die)*die,arr=new Uint32Array(1);do{crypto.getRandomValues(arr)}while(arr[0]>=limit);n=arr[0]%die+1}else n=Math.floor(Math.random()*die)+1;
 const roll={id:cryptoRandomId('roll'),value:n,label:label||`1d${die}`,die:`d${die}`,time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),rawRolls:[n],modifier:0,diceTotal:n,createdAt:Date.now()};p.rolls=mergeRollHistory(p.rolls,roll);save();updateDiceUI(roll);return roll;
}
function rollDisplayText(roll){const nums=Array.isArray(roll.rawRolls)&&roll.rawRolls.length?roll.rawRolls.join(' + '):String(roll.value);const mod=Number(roll.modifier||0);return mod?`${nums} ${mod>0?'+':'-'} ${Math.abs(mod)} = ${roll.value}`:`${nums} = ${roll.value}`}
function updateDiceUI(roll){
 const value=document.getElementById('diceResultValue'),die=document.getElementById('diceResultDie'),status=document.getElementById('rollStatus'),history=document.querySelector('.dice-history-v2');
 if(value)value.textContent=String(roll.value);if(die)die.textContent=String(roll.die||roll.label||'DADO');if(status)status.innerHTML=`Resultado: <strong>${esc(rollDisplayText(roll))}</strong> <span class="muted">(${esc(roll.die||roll.label||'d20')})</span>`;
 if(history){const empty=history.querySelector('.empty');if(empty)empty.remove();const rid=String(roll.id||`${roll.createdAt||''}|${roll.time||''}|${roll.value}`);if([...history.querySelectorAll('[data-roll-id]')].some(e=>e.dataset.rollId===rid))return;const entry=document.createElement('div');entry.dataset.rollId=rid;entry.className='roll-entry roll-entry-new';entry.innerHTML=`<strong>${esc(rollDisplayText(roll))}</strong><span>${esc(roll.die||roll.label)}</span><time>${esc(roll.time)}</time>`;history.prepend(entry);while(history.children.length>12)history.lastElementChild?.remove()}
}
async function confirmPlayerDeletion(playerId){
  if(!playerStoreEnabled||!playerId)return false;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const rows=await fetchPlayerRowsConfirmed([playerId]);
      const row=rows.find(r=>String(r.id)===String(playerId));
      if(row&&!row.deleted_at)return false;
      if(row?.deleted_at)return true;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
  return false;
}

function toggleCondition(p,id){p.conditions=Array.isArray(p.conditions)?p.conditions:[];const i=p.conditions.indexOf(id);if(i>=0)p.conditions.splice(i,1);else p.conditions.push(id);save();render('sheet')}
function conditionsMarkup(p,master=false){const active=new Set(p.conditions||[]);return `<div class="conditions-grid">${allConditions().map(c=>{const img=state.uiIcons?.conditions?.[c.id]||c.image;const left=conditionTurnsLeft(p,c.id);return `<button type="button" class="condition-chip ${active.has(c.id)?'active':''} ${master?'editable':'readonly'}" data-condition="${esc(c.id)}" ${master?'':'disabled'} title="${esc(conditionEffectText(c.id,p))}">${img?`<img class="condition-image" src="${esc(img)}" alt="" loading="lazy" decoding="async">`:`<span class="condition-glyph">${esc(c.icon)}</span>`}<span>${esc(c.name)}</span>${active.has(c.id)?`<small>${esc(conditionEffectText(c.id,p))}</small>`:''}</button>`}).join('')}</div>`}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function assetUrl(v){const t=String(v||'').trim();if(!t)return '';if(/^(https?:|data:image\/|blob:|\/)/i.test(t)||/^[a-z][a-z0-9+.\-]*:/i.test(t))return t;return '/'+t.replace(/^\.?\/+/,'')}
function safeImgSrc(v,fallback=''){const t=String(v||'').trim();if(!t)return fallback;if(/^https:\/\//i.test(t)||/^http:\/\//i.test(t)||/^blob:/i.test(t)||/^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+\/=]+$/i.test(t)||/^\/(?!\/)[^\s"'<>\\()]*$/.test(t))return t;if(/^[\w.\-\/]+$/.test(t))return '/'+t.replace(/^[.\/]+/,'');return fallback}
function safeCssImageUrl(v){const t=safeImgSrc(v,'');if(!t||/[\s"'()\\<>\x00-\x1f]/.test(t))return '';return t}
function safeHref(v,fallback='#'){const t=String(v||'').trim();if(/^(https?:\/\/|mailto:)/i.test(t))return t;return fallback}
const TRASH_KEY='ashen_trash_v1',TRASH_DAYS=14,TRASH_MAX=60;
function trashLoad(){try{const a=JSON.parse(storageGet(TRASH_KEY)||'[]');const now=Date.now();return (Array.isArray(a)?a:[]).filter(x=>x&&x.tid&&x.data!==undefined&&now-Number(x.deletedAt||0)<TRASH_DAYS*864e5)}catch{return []}}
function trashSave(list){try{localStorage.setItem(TRASH_KEY,JSON.stringify(list.slice(0,TRASH_MAX)));return true}catch{return false}}
function trashPush(kind,label,data,meta={}){const entry={tid:'t-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),kind,label:String(label||'Sem nome').slice(0,80),data:clone(data),meta,deletedAt:Date.now()};const ok=trashSave([entry,...trashLoad()]);if(!ok)setTimeout(()=>toast('Atenção: não foi possível guardar na Lixeira (armazenamento cheio). Este item não poderá ser restaurado.'),300);return entry}
function trashKindLabel(t){if(t.kind==='monster')return 'Monstro';if(t.kind==='item')return t.data?.category==='Armas'?'Arma':'Item';const k={attrs:'Atributo',skills:'Perícia',conditions:'Condição',deities:'Divindade',abilities:'Habilidade'};return k[t.meta?.key]||'Conteúdo'}
function trashAge(ms){const m=Math.max(1,Math.round((Date.now()-ms)/60000));if(m<60)return 'há '+m+' min';const h=Math.round(m/60);if(h<48)return 'há '+h+' h';return 'há '+Math.round(h/24)+' dias'}
async function trashRestore(tid){
  const list=trashLoad(),t=list.find(x=>x.tid===tid);if(!t)return null;
  if(t.kind==='monster'){const m=clone(t.data);if(state.creatures.some(c=>c.id===m.id))m.id='e-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);state.creatures.push(m);save();await saveGlobalNow().catch(()=>{})}
  else if(t.kind==='item'){const it=clone(t.data);if(state.items.some(i=>Number(i.id)===Number(it.id)))it.id=nextItemId();state.items.push(it);state.items.sort((a,b)=>Number(a.id)-Number(b.id));save()}
  else if(t.kind==='custom'){const key=t.meta?.key;if(!key)return null;const c=state.customContent=state.customContent||{};c[key]=Array.isArray(c[key])?c[key]:[];c[key].splice(Math.min(Math.max(0,Number(t.meta.index)||0),c[key].length),0,clone(t.data));save()}
  else return null;
  trashSave(list.filter(x=>x.tid!==tid));return t;
}
function toastUndo(msg,onUndo){const x=document.createElement('div');x.className='toast toast-undo';const t=document.createElement('span');t.textContent=msg;const b=document.createElement('button');b.type='button';b.className='btn small gold';b.textContent='Desfazer';b.onclick=()=>{x.remove();Promise.resolve(onUndo()).catch(err=>console.error('Falha ao desfazer:',err))};x.append(t,b);document.getElementById('toast-root')?.appendChild(x);setTimeout(()=>x.remove(),9000)}
function trashAdmin(){const list=trashLoad();return `<div class="card trash-admin"><div class="section-kicker">LIXEIRA</div><h2>Excluídos recentemente</h2><p class="small muted">Monstros, itens, armas e conteúdo personalizado excluídos ficam aqui por ${TRASH_DAYS} dias, somente neste aparelho. Restaure com um toque.</p>${list.length?`<div class="trash-list">${list.map(t=>`<div class="trash-row"><div class="trash-info"><strong>${esc(t.label)}</strong><small>${esc(trashKindLabel(t))} • excluído ${esc(trashAge(t.deletedAt))}</small></div><div class="row"><button class="btn small gold" data-trash-restore="${esc(t.tid)}">Restaurar</button><button class="btn small danger" data-trash-purge="${esc(t.tid)}">Apagar de vez</button></div></div>`).join('')}</div><div class="row"><button class="btn danger" id="trashEmpty">Esvaziar lixeira</button></div>`:'<div class="empty">A lixeira está vazia.</div>'}</div>`}
function bindTrash(){
  const refresh=()=>{document.getElementById('adminContent').innerHTML=trashAdmin();bindAdminContent()};
  document.querySelectorAll('[data-trash-restore]').forEach(b=>b.onclick=async()=>{const t=await trashRestore(b.dataset.trashRestore);toast(t?'Restaurado: '+t.label:'Não foi possível restaurar este item.');refresh()});
  document.querySelectorAll('[data-trash-purge]').forEach(b=>b.onclick=()=>{if(!confirm('Apagar de vez? Isso não pode ser desfeito.'))return;trashSave(trashLoad().filter(x=>x.tid!==b.dataset.trashPurge));refresh()});
  document.getElementById('trashEmpty')?.addEventListener('click',()=>{if(!confirm('Esvaziar a lixeira? Isso não pode ser desfeito.'))return;trashSave([]);refresh()});
}

function toast(msg){const x=document.createElement('div');x.className='toast';x.textContent=msg;document.getElementById('toast-root').appendChild(x);setTimeout(()=>x.remove(),2400)}
function vibratePhone(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern)}catch{}}
let lastKnownTurnParticipantId=null;
let turnAlertAudioEl=null;
function unlockTurnAlertAudioOnce(){
  if(turnAlertAudioEl)return;
  turnAlertAudioEl=new Audio();
  turnAlertAudioEl.muted=true;
  turnAlertAudioEl.play().catch(()=>{}).finally(()=>{turnAlertAudioEl.pause();turnAlertAudioEl.muted=false});
}
document.addEventListener('pointerdown',unlockTurnAlertAudioOnce,{once:true});
document.addEventListener('keydown',unlockTurnAlertAudioOnce,{once:true});
let turnChimeCtx=null;
function unlockTurnChime(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;turnChimeCtx=turnChimeCtx||new AC();if(turnChimeCtx.state==='suspended')turnChimeCtx.resume().catch(()=>{})}catch{}}
document.addEventListener('pointerdown',unlockTurnChime,{passive:true});
document.addEventListener('keydown',unlockTurnChime);
function playTurnChime(kind='turn'){
  try{
    const ctx=turnChimeCtx;if(!ctx)return;if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const notes=kind==='next'?[659.25]:kind==='hurt'?[196,155.56]:[523.25,783.99];
    const t0=ctx.currentTime+.02;
    notes.forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain(),t=t0+i*.17;o.type=kind==='hurt'?'triangle':'sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.22,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.55);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.6)});
  }catch{}
}
function alertVibrate(pattern){if(player()?.turnAlertSound?.vibrateOff)return;vibratePhone(pattern)}
function playTurnAlertSound(kind='turn'){
  const p=player();const cfg=p?.turnAlertSound;
  if(cfg?.enabled&&cfg?.url){
    try{
      const el=turnAlertAudioEl||new Audio();
      el.src=cfg.url;el.currentTime=0;el.play().catch(()=>{});
    }catch{}
    return;
  }
  if(cfg?.chimeOff)return;
  playTurnChime(kind);
}

function player(){
  const loginName=String(state.session?.login||'').trim().toLowerCase();
  return state.players.find(p=>String(p.login||'').trim().toLowerCase()===loginName)||state.session?.playerSnapshot||null;
}
function item(id){try{const source=typeof state!=='undefined'?state:null;return source?.items?.find(i=>i.id===Number(id))}catch{return undefined}}
function bagWeight(p){return (p?.backpack||[]).reduce((sum,b)=>{const it=item(b.id);return sum+(it?inferWeight(it)*Math.max(0,Number(b.qty)||0):0)},0)}
function itemIcon(i){const icon=i?.icon||'✦';if(icon.startsWith('asset:')){const map={weapon:'/icon-weapon.png',key:'/icon-key.png',food:'/icon-food.png',book:'/icon-book.png'};return map[icon.slice(6)]?`<img src="${map[icon.slice(6)]}" alt="" class="item-image-icon" loading="lazy" decoding="async">`:esc(icon)}return esc(icon)}
function loadImageElement(file){return new Promise((resolve,reject)=>{
  if(!file||!isSupportedImageFile(file)){reject(new Error('Imagem inválida'));return}
  const url=URL.createObjectURL(file),img=new Image();
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Imagem inválida'))};
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
  img.src=url;
})}
function drawImageToCanvas(img,maxSize){
  const ratio=Math.min(1,maxSize/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)),w=Math.max(1,Math.round((img.naturalWidth||img.width)*ratio)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*ratio));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
  return canvas;
}
async function imageFileToDataURL(file,maxSize=700,quality=.82){
  const img=await loadImageElement(file),canvas=drawImageToCanvas(img,maxSize);
  let out=canvas.toDataURL('image/webp',quality);
  if(!out.startsWith('data:image/webp')||out.length>900000)out=canvas.toDataURL('image/jpeg',.72);
  return out;
}
async function imageFileToBlob(file,maxSize=900,quality=.82){
  const img=await loadImageElement(file),canvas=drawImageToCanvas(img,maxSize);
  const toBlob=(type,q)=>new Promise(res=>canvas.toBlob(b=>res(b),type,q));
  let blob=await toBlob('image/webp',quality);
  if(blob&&blob.type==='image/webp')return{blob,ext:'webp'};
  blob=await toBlob('image/jpeg',.85);
  if(!blob)throw new Error('Não foi possível preparar a imagem');
  return{blob,ext:'jpg'};
}
async function imageFileToRemoteURL(file,path,maxSize=900,quality=.82){
  if(!remoteEnabled)return imageFileToDataURL(file,maxSize,quality);
  if(!file||!isSupportedImageFile(file))throw new Error('Imagem inválida');
  const isPlayerImage=String(path||'').startsWith('players/');
  try{
    const{blob,ext}=await imageFileToBlob(file,maxSize,quality);
    const safePath=String(path||`images/${Date.now()}.webp`).replace(/\\/g,'/').replace(/\.webp$/i,`.${ext}`);
    const url=await uploadGlobalFile(safePath,new File([blob],`image.${ext}`,{type:blob.type}));
    if(url)return url;
    throw new Error('O envio não devolveu o endereço da imagem');
  }catch(err){
    if(!isPlayerImage)throw err;
    console.warn('Envio da imagem ao Storage falhou; guardando uma cópia compacta na ficha:',err);
    return imageFileToDataURL(file,Math.min(maxSize,720),.74);
  }
}
async function saveMasterGlobalAndRefresh(message='Alteração salva e sincronizada.'){
  await saveGlobalNow();
  toast(message);
}

function spotifyEmbed(url){try{const raw=String(url||'').trim();if(!raw)return '';if(raw.startsWith('spotify:')){const bits=raw.split(':').filter(Boolean);if(bits.length>=3&&['track','album','playlist','artist','show','episode'].includes(bits[1]))return `https://open.spotify.com/embed/${encodeURIComponent(bits[1])}/${encodeURIComponent(bits[2])}?utm_source=generator&theme=0`;return ''}const u=new URL(raw);const host=u.hostname.toLowerCase();if(!host.endsWith('spotify.com'))return '';const parts=u.pathname.split('/').filter(Boolean);const types=['track','album','playlist','artist','show','episode'];const index=parts.findIndex(x=>types.includes(x.toLowerCase()));if(index<0||!parts[index+1])return '';const type=parts[index].toLowerCase(),id=parts[index+1].split('?')[0];if(!/^[A-Za-z0-9_-]+$/.test(id))return '';return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`}catch{return ''}}
function isSpotifyShortLink(url){return /^https?:\/\/(open\.spotify\.com\/s\/|spotify\.link\/|spoti\.fi\/)/i.test(String(url||'').trim())}
const SPOTIFY_CLIENT_KEY='filii_abyssi_spotify_client_id';
const SPOTIFY_TOKEN_KEY='filii_abyssi_spotify_token';
const SPOTIFY_REFRESH_KEY='filii_abyssi_spotify_refresh';
const SPOTIFY_EXP_KEY='filii_abyssi_spotify_exp';
const SPOTIFY_VERIFIER_KEY='filii_abyssi_spotify_verifier';
const SPOTIFY_OAUTH_STATE_KEY='filii_abyssi_spotify_oauth_state';
const SPOTIFY_SCOPES=['streaming','user-read-email','user-read-private','user-read-playback-state','user-modify-playback-state','user-read-currently-playing'].join(' ');
function spotifyIdentity(){return 'browser'}
function spotifyKey(base,identity=spotifyIdentity()){return `${base}:${encodeURIComponent(identity)}`}
function localGet(key){try{return localStorage.getItem(key)||''}catch{return memoryStore[key]||''}}
function localSet(key,value){try{localStorage.setItem(key,value)}catch{memoryStore[key]=String(value)}}
function localRemove(key){try{localStorage.removeItem(key)}catch{delete memoryStore[key]}}
function spotifySessionGet(base){try{return sessionStorage.getItem(spotifyKey(base))||''}catch{return ''}}
function spotifySessionSet(base,value){try{sessionStorage.setItem(spotifyKey(base),value)}catch{}}
function spotifySessionRemove(base){try{sessionStorage.removeItem(spotifyKey(base))}catch{}}
function spotifyRefreshGet(){return localGet(spotifyKey(SPOTIFY_REFRESH_KEY))}
function spotifyRefreshSet(value){if(value)localSet(spotifyKey(SPOTIFY_REFRESH_KEY),value);else localRemove(spotifyKey(SPOTIFY_REFRESH_KEY))}
function spotifyClientId(){try{return localStorage.getItem(SPOTIFY_CLIENT_KEY)||window.SPOTIFY_CLIENT_ID||''}catch{return window.SPOTIFY_CLIENT_ID||''}}
function spotifyRedirectUri(){const u=new URL(window.location.href);u.search='';u.hash='';return u.href}
function spotifyOriginIsUsable(){return window.location.protocol==='https:'||(window.location.protocol==='http:'&&(location.hostname==='127.0.0.1'||location.hostname==='localhost'))}
function base64Url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function randomVerifier(){const a=new Uint8Array(64);crypto.getRandomValues(a);return base64Url(a)}
async function sha256Text(text){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))}
async function spotifyLogin(){
  if(!spotifyOriginIsUsable()){toast('O Spotify exige HTTPS (ou 127.0.0.1 em desenvolvimento).');return}
  const clientId=document.getElementById('spotifyClientId')?.value.trim()||document.getElementById('spotifyClientIdGlobal')?.value.trim()||spotifyClientId();
  if(!clientId){toast('Informe o Client ID do Spotify primeiro.');return}
  localSet(SPOTIFY_CLIENT_KEY,clientId);
  const verifier=randomVerifier();
  const challenge=base64Url(new Uint8Array(await sha256Text(verifier)));
  const oauthState=base64Url(crypto.getRandomValues(new Uint8Array(24)));
  localSet(spotifyKey(SPOTIFY_VERIFIER_KEY),verifier);
  localSet(spotifyKey(SPOTIFY_OAUTH_STATE_KEY),oauthState);
  const params=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:spotifyRedirectUri(),scope:SPOTIFY_SCOPES,code_challenge_method:'S256',code_challenge:challenge,state:oauthState});
  window.location.assign('https://accounts.spotify.com/authorize?'+params.toString());
}
async function spotifyExchangeCode(code){
  const verifier=localGet(spotifyKey(SPOTIFY_VERIFIER_KEY)),clientId=spotifyClientId();
  if(!verifier||!clientId)return false;
  const body=new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code,redirect_uri:spotifyRedirectUri(),code_verifier:verifier});
  const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error_description||'Falha ao trocar o código do Spotify');
  spotifySessionSet(SPOTIFY_TOKEN_KEY,data.access_token);
  if(data.refresh_token)spotifyRefreshSet(data.refresh_token);
  spotifySessionSet(SPOTIFY_EXP_KEY,String(Date.now()+Math.max(60,(data.expires_in||3600)-60)*1000));
  return true;
}
async function spotifyRefresh(){
  const refresh=spotifyRefreshGet(),clientId=spotifyClientId();
  if(!refresh||!clientId)return false;
  const body=new URLSearchParams({client_id:clientId,grant_type:'refresh_token',refresh_token:refresh});
  const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){spotifyRefreshSet('');spotifySessionRemove(SPOTIFY_TOKEN_KEY);spotifySessionRemove(SPOTIFY_EXP_KEY);return false}
  spotifySessionSet(SPOTIFY_TOKEN_KEY,data.access_token);
  if(data.refresh_token)spotifyRefreshSet(data.refresh_token);
  spotifySessionSet(SPOTIFY_EXP_KEY,String(Date.now()+Math.max(60,(data.expires_in||3600)-60)*1000));
  return true;
}
async function spotifyToken(forceRefresh=false){
  const token=spotifySessionGet(SPOTIFY_TOKEN_KEY),exp=Number(spotifySessionGet(SPOTIFY_EXP_KEY)||0);
  if(!forceRefresh&&token&&Date.now()<exp)return token;
  if(await spotifyRefresh())return spotifySessionGet(SPOTIFY_TOKEN_KEY);
  return null;
}
function spotifyLogout(){
  spotifySessionRemove(SPOTIFY_TOKEN_KEY);spotifySessionRemove(SPOTIFY_EXP_KEY);spotifyRefreshSet('');
  localRemove(spotifyKey(SPOTIFY_VERIFIER_KEY));localRemove(spotifyKey(SPOTIFY_OAUTH_STATE_KEY));
  if(spotifyPlayer){try{spotifyPlayer.disconnect()}catch{}spotifyPlayer=null;spotifyDeviceId=''}
  syncGlobalMusic();
}
function spotifyLogged(){return !!spotifySessionGet(SPOTIFY_TOKEN_KEY)||!!spotifyRefreshGet()}
let spotifyPlayer=null,spotifyDeviceId='',spotifySdkPromise=null;
function loadSpotifySdk(){
  if(window.Spotify)return Promise.resolve(window.Spotify);
  if(spotifySdkPromise)return spotifySdkPromise;
  spotifySdkPromise=new Promise((resolve,reject)=>{
    const previous=window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady=()=>{if(typeof previous==='function')try{previous()}catch{};resolve(window.Spotify)};
    const sc=document.createElement('script');sc.src='https://sdk.scdn.co/spotify-player.js';sc.async=true;sc.onerror=()=>reject(new Error('SDK do Spotify não carregou'));document.head.appendChild(sc);
  });
  return spotifySdkPromise;
}
async function ensureSpotifyPlayer(){
  const token=await spotifyToken();if(!token)return false;
  if(spotifyPlayer&&spotifyDeviceId)return true;
  try{
    const SDK=await loadSpotifySdk();
    spotifyPlayer=new SDK.Player({name:`Ashen Testimony • ${state.session?.role==='master'?'Mestre':'Player'}`,volume:.8,getOAuthToken:async cb=>cb(await spotifyToken())});
    spotifyPlayer.addListener('ready',({device_id})=>{spotifyDeviceId=device_id;syncGlobalMusic()});
    spotifyPlayer.addListener('not_ready',()=>{spotifyDeviceId=''});
    spotifyPlayer.addListener('initialization_error',({message})=>toast(`Spotify: ${message||'falha ao iniciar o player'}`));
    spotifyPlayer.addListener('authentication_error',()=>toast('A sessão do Spotify expirou. Conecte novamente.'));
    spotifyPlayer.addListener('account_error',()=>toast('A reprodução completa no navegador exige Spotify Premium.'));
    spotifyPlayer.addListener('playback_error',({message})=>toast(`Spotify: ${message||'erro de reprodução'}`));
    await spotifyPlayer.connect();
    return true;
  }catch(e){toast(e?.message||'Não foi possível iniciar o player do Spotify.');return false}
}
function spotifyResource(url){
  try{
    const raw=String(url||'').trim();
    if(raw.startsWith('spotify:')){const p=raw.split(':').filter(Boolean);return p.length>=3&&/^[A-Za-z0-9_-]+$/.test(p[2])?{type:p[1],id:p[2],uri:`spotify:${p[1]}:${p[2]}`} : null}
    const u=new URL(raw);if(u.hostname!=='open.spotify.com'&&!u.hostname.endsWith('.spotify.com'))return null;
    const parts=u.pathname.split('/').filter(Boolean),types=['track','album','playlist','artist','show','episode'],i=parts.findIndex(x=>types.includes(x.toLowerCase()));if(i<0)return null;
    const type=parts[i].toLowerCase(),id=parts[i+1]?.split('?')[0];return id&&/^[A-Za-z0-9_-]+$/.test(id)?{type,id,uri:`spotify:${type}:${id}`}:null;
  }catch{return null}
}
async function spotifyApi(path,options={}){
  let token=await spotifyToken();if(!token)throw new Error('SPOTIFY_NOT_CONNECTED');
  let res=await fetch(`https://api.spotify.com/v1${path}`,{...options,headers:{...(options.headers||{}),Authorization:`Bearer ${token}`}});
  if(res.status===401&&await spotifyToken(true)){token=await spotifyToken();res=await fetch(`https://api.spotify.com/v1${path}`,{...options,headers:{...(options.headers||{}),Authorization:`Bearer ${token}`}})}
  return res;
}
async function spotifyPlayCurrent(){
  const m=state.music||{},r=spotifyResource(m.url);if(!r){toast('Link/URI do Spotify inválido.');return}
  if(!spotifyLogged()){ await spotifyLogin(); return; }
  if(!(await ensureSpotifyPlayer())){toast('Conecte uma conta Spotify Premium para reprodução completa.');return}
  if(!spotifyDeviceId){toast('Aguarde o dispositivo Spotify ficar pronto e tente novamente.');return}
  const body=r.type==='track'?{uris:[r.uri],position_ms:0}:{context_uri:r.uri,position_ms:0};
  let res=await spotifyApi(`/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok){const data=await res.json().catch(()=>({}));toast(res.status===403?'O Spotify recusou a reprodução. Verifique Premium e as permissões da conta.':`Spotify: ${data.error?.message||'não foi possível reproduzir'}`);return}
  syncGlobalMusic();
}
async function spotifyPause(){if(spotifyPlayer){try{await spotifyPlayer.pause();return}catch{}}try{await spotifyApi('/me/player/pause',{method:'PUT'})}catch{}}
async function handleSpotifyCallback(){
  const u=new URL(window.location.href),code=u.searchParams.get('code'),stateParam=u.searchParams.get('state'),oauthError=u.searchParams.get('error'),oauthErrorDesc=u.searchParams.get('error_description');
  if(!code&&!oauthError)return;
  const expected=localGet(spotifyKey(SPOTIFY_OAUTH_STATE_KEY));
  if(oauthError){localRemove(spotifyKey(SPOTIFY_OAUTH_STATE_KEY));localRemove(spotifyKey(SPOTIFY_VERIFIER_KEY));history.replaceState({},document.title,spotifyRedirectUri());toast(`Spotify: ${oauthErrorDesc||oauthError}`);return}
  if(!expected||!stateParam||stateParam!==expected){toast('Falha de segurança na autenticação do Spotify. Tente conectar novamente.');return}
  try{await spotifyExchangeCode(code);localRemove(spotifyKey(SPOTIFY_OAUTH_STATE_KEY));localRemove(spotifyKey(SPOTIFY_VERIFIER_KEY));history.replaceState({},document.title,spotifyRedirectUri());toast('Spotify conectado com sucesso.');await ensureSpotifyPlayer()}catch(e){toast(e?.message||'Não foi possível concluir a conexão com o Spotify.');}
}
const MUSIC_UI_KEY='a_profecia_music_ui_v2';
let globalMusicAudio=null;
let globalMusicBlocked=false;
let globalMusicSrc='';
let globalMusicLastCommand=0;
function musicUiState(){
  try{return JSON.parse(localStorage.getItem(MUSIC_UI_KEY)||localStorage.getItem('a_profecia_music_ui_v1')||'{}')}catch{return {}}
}
function setMusicUiState(patch){
  const next={...musicUiState(),...patch};
  try{localStorage.setItem(MUSIC_UI_KEY,JSON.stringify(next))}catch{}
  return next;
}
function musicIsMaster(){return state.session?.role==='master'}
function normalizeMusic(){
  const m=state.music||{};
  return {type:m.type||'audio',title:m.title||'',url:m.url||'',kind:m.kind||'url',playing:!!m.playing,loop:!!m.loop,position:Math.max(0,Number(m.position)||0),commandAt:Number(m.commandAt)||0,startedAt:Number(m.startedAt)||0,mediaId:m.mediaId||''};
}
function musicTargetPosition(m){
  if(!m.playing)return Math.max(0,Number(m.position)||0);
  return m.startedAt?Math.max(0,(Date.now()-Number(m.startedAt))/1000):Math.max(0,Number(m.position)||0);
}
async function saveMusicCommand(patch){
  const current=normalizeMusic();
  state.music={...current,...patch,commandAt:Date.now()};
  if(state.music.playing)state.music.startedAt=Date.now()-Math.max(0,Number(state.music.position)||0)*1000;
  await saveGlobalNow();
  syncGlobalMusic(true);
}
function musicIcon(){return `<img class="music-volume-icon" src="/volume-control.png" alt="Volume">`;}
function ensureGlobalMusicAudio(){
  if(globalMusicAudio)return globalMusicAudio;
  const audio=new Audio();
  audio.preload='metadata';
  audio.playsInline=true;
  audio.crossOrigin='anonymous';
  audio.addEventListener('error',()=>{console.warn('Falha ao carregar áudio global');});
  audio.addEventListener('ended',()=>{if(!audio.loop&&musicIsMaster()&&normalizeMusic().playing){saveMusicCommand({playing:false,position:0,startedAt:0}).catch(()=>{});}});
  globalMusicAudio=audio;
  return audio;
}
function releaseGlobalMusicAudio(){
  if(!globalMusicAudio)return;
  try{globalMusicAudio.pause();globalMusicAudio.removeAttribute('src');globalMusicAudio.load()}catch{}
  globalMusicSrc='';globalMusicLastCommand=0;
}
function applyGlobalMusicPlayback(m,localVolume,force=false){
  if(m.type==='spotify'||!m.url){releaseGlobalMusicAudio();return null;}
  const audio=ensureGlobalMusicAudio();
  audio.loop=!!m.loop;
  audio.volume=localVolume;
  const srcChanged=globalMusicSrc!==m.url;
  if(srcChanged){
    try{audio.pause();audio.src=m.url;audio.load()}catch{}
    globalMusicSrc=m.url;
    globalMusicLastCommand=0;
  }
  const applyPosition=()=>{
    const target=musicTargetPosition(m);
    if(Number.isFinite(target)&&target>=0&&Math.abs((audio.currentTime||0)-target)>2){
      try{audio.currentTime=Math.min(target,Math.max(0,(audio.duration||target)-.05));}catch{}
    }
  };
  if(srcChanged||force||globalMusicLastCommand!==m.commandAt){
    if(audio.readyState>=1)applyPosition();else audio.addEventListener('loadedmetadata',applyPosition,{once:true});
    globalMusicLastCommand=m.commandAt;
  }
  if(m.playing){
    audio.play().then(()=>{globalMusicBlocked=false;}).catch(()=>{globalMusicBlocked=true;});
  }else{try{audio.pause();}catch{}}
  return audio;
}
function bindMusicUi(root,m,audio,localVolume){
  root.querySelector('#musicMinimize')?.addEventListener('click',()=>{setMusicUiState({minimized:true,closed:false});syncGlobalMusic(true)});
  root.querySelector('#musicClose')?.addEventListener('click',()=>{setMusicUiState({closed:true,minimized:false});syncGlobalMusic(true)});
  root.querySelector('#musicReopen')?.addEventListener('click',()=>{setMusicUiState({closed:false,minimized:false});syncGlobalMusic(true)});
  root.querySelector('#musicExpand')?.addEventListener('click',()=>{setMusicUiState({minimized:false,closed:false});syncGlobalMusic(true)});
  root.querySelector('#musicEnable')?.addEventListener('click',async()=>{try{await audio?.play();globalMusicBlocked=false;syncGlobalMusic(true)}catch{toast('O navegador ainda bloqueou o áudio. Tente novamente.')}});
  root.querySelector('#musicLocalVolume')?.addEventListener('input',e=>{
    const v=Math.max(0,Math.min(100,Number(e.target.value)||0));
    if(audio)audio.volume=v/100;setMusicUiState({volume:v/100});
    const label=root.querySelector('#musicVolumeValue');if(label)label.textContent=`${v}%`;
  });
  if(musicIsMaster()){
    root.querySelector('#musicGlobalPlay')?.addEventListener('click',async()=>{
      const nowPos=m.playing?(audio?.currentTime||musicTargetPosition(m)):Math.max(0,audio?.currentTime||m.position||0);
      await saveMusicCommand({playing:!m.playing,position:nowPos,startedAt:!m.playing?Date.now()-nowPos*1000:0});
    });
    root.querySelector('#musicGlobalStop')?.addEventListener('click',async()=>{if(audio){audio.pause();try{audio.currentTime=0}catch{}}await saveMusicCommand({playing:false,position:0,startedAt:0});});
    root.querySelector('#musicGlobalLoop')?.addEventListener('click',async()=>{await saveMusicCommand({loop:!m.loop});});
  }
}
function syncGlobalMusic(force=false){
  const root=document.getElementById('global-player');if(!root)return;
  const m=normalizeMusic();
  if(!m.url&&!m.mediaId){releaseGlobalMusicAudio();root.replaceChildren();delete root.dataset.signature;return;}
  const ui=musicUiState();
  const localVolume=Math.max(0,Math.min(1,Number(ui.volume??0.8)));
  const audio=applyGlobalMusicPlayback(m,localVolume,force);
  const signature=`${m.type}|${m.url}|${m.title}|${m.playing}|${m.loop}|${m.commandAt}|${ui.closed?'c':''}|${ui.minimized?'m':''}|${globalMusicBlocked?'b':''}`;
  if(!force&&root.dataset.signature===signature)return;
  if(m.type==='spotify'){
    root.innerHTML=`<div class="global-music spotify"><div class="global-music-head"><div><span class="muted">Trilha Spotify</span><strong>${esc(m.title||'Spotify')}</strong></div></div><div class="spotify-controls"><button class="btn gold" id="spotifyPlayGlobal">▶ Reproduzir</button><button class="btn" id="spotifyPauseGlobal">Ⅱ Pausar</button><button class="btn ghost" id="musicClose">×</button></div><p class="tiny muted">Spotify continua individual por conta/dispositivo.</p></div>`;
    root.querySelector('#spotifyPlayGlobal')?.addEventListener('click',spotifyPlayCurrent);
    root.querySelector('#spotifyPauseGlobal')?.addEventListener('click',spotifyPause);
    bindMusicUi(root,m,null,localVolume);root.dataset.signature=signature;return;
  }
  if(ui.closed){root.innerHTML=`<button class="music-reopen" id="musicReopen" title="Abrir controle de música">♪</button>`;bindMusicUi(root,m,audio,localVolume);root.dataset.signature=signature;return;}
  if(ui.minimized){root.innerHTML=`<div class="global-music music-minimized"><button class="music-mini-main" id="musicExpand"><span class="music-note">♪</span><span>${esc(m.title||'Trilha da campanha')}</span><small>${m.playing?'TOCANDO':'PAUSADA'}</small></button><button class="music-mini-close" id="musicClose" title="Fechar">×</button></div>`;bindMusicUi(root,m,audio,localVolume);root.dataset.signature=signature;return;}
  const master=musicIsMaster();
  root.innerHTML=`<div class="global-music music-panel"><div class="global-music-head"><div><span class="muted">TRILHA DA CAMPANHA</span><strong>${esc(m.title||'Áudio')}</strong></div><div class="music-window-controls"><button class="music-window-btn" id="musicMinimize" title="Minimizar">−</button><button class="music-window-btn" id="musicClose" title="Fechar">×</button></div></div><div class="music-status"><span class="music-status-dot ${m.playing?'on':''}"></span>${m.playing?'Tocando para a sessão':'Pausada'}</div>${master?`<div class="music-master-controls"><button class="music-control" id="musicGlobalPlay">${m.playing?'Ⅱ':'▶'}</button><button class="music-control" id="musicGlobalStop">■</button><button class="music-loop ${m.loop?'active':''}" id="musicGlobalLoop" title="Repetição global">↻ ${m.loop?'LOOP ATIVO':'LOOP'}</button></div>`:`<div class="music-player-note">O Mestre controla a trilha. Você controla apenas seu volume.</div>`}<div class="music-volume-row">${musicIcon()}<input id="musicLocalVolume" type="range" min="0" max="100" value="${Math.round(localVolume*100)}" aria-label="Volume local"><span id="musicVolumeValue">${Math.round(localVolume*100)}%</span></div>${globalMusicBlocked?`<button class="btn primary music-enable-btn" id="musicEnable">Ativar áudio da sessão</button>`:''}</div>`;
  bindMusicUi(root,m,audio,localVolume);root.dataset.signature=signature;
}

let activeSoundAudio=null,activeSoundUrl='',activeSoundAudios=[];
let soundAudioUnlocked=false;
function unlockSoundAudio(){soundAudioUnlocked=true;document.documentElement.classList.add('audio-unlocked');return true}
function soundSource(s){return s?.url||''}
function stopAllSounds(){activeSoundAudios.forEach(a=>{try{a.pause();a.currentTime=0}catch{}});activeSoundAudios=[];if(activeSoundAudio){try{activeSoundAudio.pause()}catch{}}if(activeSoundUrl){try{URL.revokeObjectURL(activeSoundUrl)}catch{}}activeSoundAudio=null;activeSoundUrl=''}
async function playSoundEntry(s,{remote=false}={}){
  if(!s)return;
  unlockSoundAudio();
  let src=s.url||'';
  let revoke='';
  if(s.kind==='file'&&!src){
    try{const blob=await idbGetSound(s.id);if(blob){src=URL.createObjectURL(blob);revoke=src}}catch{}
  }
  if(!src){toast('Este som ainda não possui um arquivo global. Reenvie-o pela Caixa de Sons.');return}
  try{
    const a=new Audio(src);a.preload='auto';a.volume=Math.max(0,Math.min(1,Number(state.soundboard?.volume??.85)));a.onended=()=>{activeSoundAudios=activeSoundAudios.filter(x=>x!==a);if(revoke)URL.revokeObjectURL(revoke)};activeSoundAudios.push(a);await a.play();
  }catch(e){if(revoke)URL.revokeObjectURL(revoke);if(!remote)toast('Clique em Ativar sons e tente novamente.');}
}
async function triggerSound(s){if(!s)return;await playSoundEntry(s);if(remoteEnabled)broadcastLive('sound-trigger',{soundId:s.id,at:Date.now()}).catch(()=>{});}
function soundboardSignature(){return (state.sounds||[]).map(s=>`${s.id}|${s.name}|${s.kind}|${s.url||''}|${s.category||''}`).join('~')}
function syncSoundboard(){
  const root=document.getElementById('soundboard-root');if(!root)return;
  const sounds=Array.isArray(state.sounds)?state.sounds:[];
  const signature=soundboardSignature();
  if(!sounds.length){root.innerHTML='';root.dataset.signature='';return}
  if(root.dataset.signature===signature)return;
  root.innerHTML=`<div class="soundboard-mini"><div class="soundboard-head"><span class="soundboard-title">SOUNDBOARD</span><button type="button" class="soundboard-mini-btn" id="soundEnable">${soundAudioUnlocked?'ÁUDIO ATIVO':'ATIVAR SONS'}</button><button type="button" class="soundboard-mini-btn" id="soundStop">■</button><label class="soundboard-volume" title="Volume dos efeitos">🔊<input id="soundVolume" type="range" min="0" max="100" value="${Math.round(Number(state.soundboard?.volume??.85)*100)}"></label></div><div class="soundboard-buttons">${sounds.map(s=>`<button type="button" class="soundboard-button" data-sound-play="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div></div>`;
  root.querySelector('#soundEnable')?.addEventListener('click',()=>{unlockSoundAudio();root.querySelector('#soundEnable').textContent='ÁUDIO ATIVO';toast('Sons ativados neste dispositivo.')});
  root.querySelector('#soundStop')?.addEventListener('click',stopAllSounds);root.querySelector('#soundVolume')?.addEventListener('input',e=>{state.soundboard=state.soundboard||{volume:.85,enabled:true};state.soundboard.volume=Math.max(0,Math.min(1,Number(e.target.value)/100));storageSet(KEY,serializeState());});
  root.querySelectorAll('[data-sound-play]').forEach(b=>b.onclick=()=>{const s=sounds.find(x=>String(x.id)===String(b.dataset.soundPlay));if(s)triggerSound(s)});
  root.dataset.signature=signature;
}

async function playStoredSound(id){
  try{
    const blob=await idbGetSound(id);
    if(!blob){toast('Este som não existe neste navegador.');return}
    if(activeSoundAudio){try{activeSoundAudio.pause()}catch{}}
    if(activeSoundUrl)URL.revokeObjectURL(activeSoundUrl);
    activeSoundUrl=URL.createObjectURL(blob);activeSoundAudio=new Audio(activeSoundUrl);
    activeSoundAudio.onended=()=>{if(activeSoundUrl){URL.revokeObjectURL(activeSoundUrl);activeSoundUrl=''}};
    await activeSoundAudio.play();
  }catch{toast('Não foi possível reproduzir o som.');}
}
function spotifyHomePanel(){const m=state.music||{};if(m.type!=='spotify'||!m.url)return '';return `<section class="home-panel spotify-home-panel"><div class="section-kicker">TRILHA SPOTIFY</div><h2>${esc(m.title||'Trilha da campanha')}</h2><p>Conecte sua própria conta Spotify para reproduzir a trilha no seu navegador. A escolha da trilha continua sob controle do Mestre.</p><div class="row">${spotifyLogged()?`<button class="btn gold" id="spotifyHomePlay">▶ Reproduzir</button><button class="btn" id="spotifyHomePause">Ⅱ Pausar</button>`:`<button class="btn gold" id="spotifyHomeLogin">Entrar com Spotify</button>`}<a class="btn ghost" href="${esc(safeHref(m.url))}" target="_blank" rel="noopener">Abrir</a></div></section>`}
function siteBrand(){const b=state?.siteBrand||{};const rawName=String(b.name||'').trim();return {name:(!rawName||rawName==='A Profecia')?'Ashen Testimony':rawName,image:safeImgSrc(assetUrl(b.image||'runa-gold.png'),'/runa-gold.png')}}
function applySiteBrand(){const b=siteBrand();document.title=b.name;const meta=document.querySelector('meta[name=description]');if(meta)meta.setAttribute('content',`${b.name} — sistema de RPG sombrio.`);}
function openPersonalSpellEditor(p,id=null,view='sheet'){
  const list=normalizePersonalSpells(p), existing=id?list.find(x=>String(x.id)===String(id)):null;
  const s=existing?clone(existing):{id:`personal-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:'',school:'Magia pessoal',cost:'',description:'',image:''};
  openModal(`<div class="modal" id="personalSpellModal"><div class="modal-card"><button class="modal-close" id="closePersonalSpell">×</button><span class="badge">GRIMÓRIO PESSOAL</span><h2>${existing?'Editar magia':'Criar magia pessoal'}</h2>
  <div class="field"><label>Nome</label><input id="psName" value="${esc(s.name)}" placeholder="Nome da magia"></div>
  <div class="input-grid"><div class="field"><label>Escola / tipo</label><input id="psSchool" value="${esc(s.school)}"></div><div class="field"><label>Custo em Sanidade</label><input id="psCost" type="number" min="0" step="1" inputmode="numeric" value="${spellCost(s)}"></div></div>
  <div class="input-grid"><label class="spell-check"><input type="checkbox" id="psRitual" ${spellIsRitual(s)?'checked':''}> <span>É um ritual</span></label><div class="field"><label>Turnos para completar</label><input id="psTurns" type="number" min="0" step="1" inputmode="numeric" value="${spellRitualTurns(s)}"></div></div>
  <div class="field"><label>Descrição / efeito</label><textarea id="psDesc" rows="6">${esc(s.description)}</textarea></div>
  <div class="field"><label>Imagem (URL opcional)</label><input id="psImage" value="${esc(s.image||'')}" placeholder="https://..."></div>
  <div class="row" style="justify-content:flex-end"><button class="btn" id="cancelPersonalSpell">Cancelar</button><button class="btn gold" id="savePersonalSpell">Salvar magia</button></div></div></div>`);
  const close=()=>document.getElementById('personalSpellModal')?.remove();
  document.getElementById('closePersonalSpell').onclick=close;document.getElementById('cancelPersonalSpell').onclick=close;
  document.getElementById('savePersonalSpell').onclick=()=>{
    const next={...s,name:document.getElementById('psName').value.trim(),school:document.getElementById('psSchool').value.trim()||'Magia pessoal',cost:`${Math.max(0,Math.floor(Number(document.getElementById('psCost').value)||0))} Sanidade`,sanityCost:Math.max(0,Math.floor(Number(document.getElementById('psCost').value)||0)),ritual:document.getElementById('psRitual').checked,ritualTurns:document.getElementById('psRitual').checked?Math.max(0,Math.floor(Number(document.getElementById('psTurns').value)||0)):0,description:document.getElementById('psDesc').value.trim(),image:document.getElementById('psImage').value.trim()};
    if(!next.name){toast('Informe o nome da magia.');return}
    const i=list.findIndex(x=>String(x.id)===String(next.id));if(i>=0)list[i]=next;else list.push(next);
    save();close();toast(existing?'Magia pessoal atualizada.':'Magia pessoal criada.');render(view);
  };
}
function spellCost(sp){
  if(sp&&sp.sanityCost!==undefined&&sp.sanityCost!==null&&sp.sanityCost!==''){const n=Number(sp.sanityCost);if(Number.isFinite(n))return Math.max(0,n)}
  const m=String(sp?.cost||'').match(/(-?\d+(?:[.,]\d+)?)/);return m?Math.max(0,Number(String(m[1]).replace(',','.'))):0
}
function spellIsRitual(sp){if(!sp)return false;if(typeof sp.ritual==='boolean')return sp.ritual;return /ritual/i.test(String(sp.school||''))}
function spellRitualTurns(sp){const n=Math.floor(Number(sp?.ritualTurns));return Number.isFinite(n)&&n>0?n:0}
function spellRitualText(sp){if(!spellIsRitual(sp))return '';const t=spellRitualTurns(sp);return t>0?`Ritual • ${t} ${t===1?'turno':'turnos'} para completar`:'Ritual • turnos a definir pelo Mestre'}
function isCustomSpell(sp){return !!sp&&!getSpells().some(b=>String(b.id)===String(sp.id))}
function grantedSpellIds(p){p.grantedSpells=Array.isArray(p.grantedSpells)?p.grantedSpells:[];return p.grantedSpells}
function playerKnowsSpell(p,id){const k=String(id);return String(p?.initialSpell||'')===k||(Array.isArray(p?.grantedSpells)&&p.grantedSpells.some(x=>String(x)===k))||(Array.isArray(p?.personalSpells)&&p.personalSpells.some(x=>String(x?.id)===k))}
function normalizePersonalSpells(p){
  if(!p)return [];
  p.personalSpells=Array.isArray(p.personalSpells)?p.personalSpells:[];
  return p.personalSpells;
}
function getAvailableSpells(p){
  const bank=getSpells();
  const personal=normalizePersonalSpells(p);
  const byId=new Map(bank.map(s=>[String(s.id),s]));
  const granted=new Set([...grantedSpellIds(p).map(String),...(p.initialSpell?[String(p.initialSpell)]:[]),...personal.map(x=>String(x.id))]);
  return [...bank.filter(s=>granted.has(String(s.id))),...personal.filter(s=>!byId.has(String(s.id)))];
}
function spellByPlayer(p,id){
  return getAvailableSpells(p).find(s=>String(s.id)===String(id));
}
function personalSpellCard(sp,action='use'){
  const cost=spellCost(sp),ritual=spellRitualText(sp),custom=isCustomSpell(sp);
  return `<div class="personal-spell-card"><div class="spell-player-art">${sp.image?`<img src="${esc(sp.image)}" alt="">`:'✦'}</div><div class="spell-player-copy"><strong>${esc(sp.name)}</strong><span>${esc(sp.school||'Magia')}</span><small>${esc(sp.description||'Sem descrição.')}</small><div class="spell-meta"><span class="spell-chip spell-chip-san">☾ ${cost>0?`${esc(cost)} de Sanidade`:'Sem custo de Sanidade'}</span>${ritual?`<span class="spell-chip spell-chip-ritual">⛧ ${esc(ritual)}</span>`:''}</div><div class="row" style="margin-top:6px">${action==='use'?`<button type="button" class="btn small gold" data-use-spell="${esc(sp.id)}">Usar</button>`:''}${custom?`<button type="button" class="btn small" data-edit-personal-spell="${esc(sp.id)}">Editar</button><button type="button" class="btn small danger" data-delete-personal-spell="${esc(sp.id)}">Excluir</button>`:''}</div></div></div>`;
}
function playerSpellPanel(p){
  const available=getAvailableSpells(p);
  const granted=available.filter(s=>!isCustomSpell(s)),mine=available.filter(s=>isCustomSpell(s));
  return `<article class="sheet-card spell-sheet-card"><div class="section-heading"><div><span class="section-kicker">MAGIAS</span><h2>Meu grimório</h2></div><span class="corner-mark">${available.length} ${available.length===1?'conhecida':'conhecidas'}</span></div>
  <p class="small muted">Cada magia mostra o custo em Sanidade e, quando for um ritual, quantos turnos leva para ser completada. Magias concedidas pelo Mestre aparecem aqui junto das que você criar.</p>
  <div class="row" style="margin:10px 0"><button type="button" class="btn gold" id="newPersonalSpell">＋ Criar magia pessoal</button></div>
  ${granted.length?`<div class="spell-player-grid">${granted.map(s=>personalSpellCard(s)).join('')}</div>`:(mine.length?'':'<div class="empty">Nenhuma magia concedida ainda.</div>')}
  ${mine.length?`<div class="section-heading" style="margin-top:18px"><div><span class="section-kicker">CRIADAS POR VOCÊ</span><h3>Magias personalizadas</h3></div></div><div class="spell-player-grid">${mine.map(s=>personalSpellCard(s)).join('')}</div>`:''}
  </article>`;
}

function spellMarkup(p){
  if(!p)return '';
  const available=getAvailableSpells(p), chosen=p?.initialSpell?spellByPlayer(p,p.initialSpell):null;
  if(hasMagicClass(p.class)&&!normalizePersonalSpells(p).length&&chosen){
    return `<article class="sheet-card spell-sheet-card"><div class="section-heading"><div><span class="section-kicker">MAGIAS</span><h2>Magia conhecida</h2></div><span class="corner-mark">CUSTO EM SANIDADE</span></div><div class="spell-player-grid">${personalSpellCard(chosen)}</div></article>`;
  }
  return playerSpellPanel(p);
}

function guardianBadge(){const map={ok:['🟢','SITE OK'],attention:['🟡','ATENÇÃO'],offline:['🔴','OFFLINE'],checking:['🔵','VERIFICANDO'],session:['🟣','SESSÃO']};const [icon,label]=map[sessionGuardian.state]||map.checking;return `<button type="button" class="site-status-indicator status-${esc(sessionGuardian.state)}" id="siteStatusIndicator" title="${esc(sessionGuardian.message)}"><span>${icon}</span><b>${label}</b></button>`}
function shell(content,active='home'){const brand=siteBrand();const master=state.session?.role==='master';const libraryActive=active==='library';const diaryActive=active==='diary';const nexusActive=active==='nexus';return `<div class="shell ${master?'shell-master':''}"><a class="skip-link" href="#main-content" data-skip-main>Pular para o conteúdo</a><header class="topbar"><div class="topbar-inner"><div class="brand"><img src="${esc(brand.image)}" alt=""><span class="brand-name">${esc(brand.name)}</span></div><div class="topbar-status">${guardianBadge()}</div><nav class="nav"><button data-nav="home" class="${active==='home'?'active':''}${master?'':' nav-curtain'}"${master?'':' type="button" aria-label="Modo sessão" title="Modo sessão"'}>${master?'Início':CURTAIN_CLOSED_SVG}</button><button data-nav="sheet" class="${active==='sheet'?'active':''}">Ficha</button><button data-nav="classes" class="${active==='classes'?'active':''}">Classes</button><button data-nav="nexus" class="${nexusActive?'active':''}">Nexus</button>${master?`<button data-nav="master" class="${active==='master'?'active':''}">Mestre</button>`:`<button data-nav="spells" class="${active==='spells'?'active':''}">Magias</button><button data-nav="map" class="${active==='map'?'active':''}">Mapa</button><button data-nav="diary" class="${diaryActive?'active':''}">Diário</button><button data-nav="library" class="${libraryActive?'active':''}">Biblioteca</button>`}<button id="logout" type="button">Sair</button></nav></div></header><main id="main-content" tabindex="-1" class="main ${['sheet','classes','master','map','diary','library','nexus','spells'].includes(active)?`main-${active}`:'main-home'}">${content}</main><div id="personal-player" aria-live="polite"></div></div>`}
async function deletePlayerConfirmed(player){
  const id=playerSyncKey(player);
  if(!id)throw new Error('PLAYER_ID_INVALIDO');
  if(!playerStoreEnabled){
    const when=Date.now();
    state.playerTombstones=state.playerTombstones||{};
    state.playerTombstones[id]=Math.max(Number(state.playerTombstones[id])||0,when);
    return {id,found:true,already_deleted:false,deleted_at:new Date(when).toISOString()};
  }
  if(ps.syncBusy&&ps.syncPromise){
    try{await ps.syncPromise}catch{}
  }
  const result=await deletePlayerServer(id);
  try{
    const rows=await fetchPlayerRowsConfirmed([id]);
    const serverRow=rows.find(r=>String(r.id)===String(id));
    if(serverRow&&!serverRow.deleted_at)throw new Error('EXCLUSAO_NAO_CONFIRMADA');
  }catch(error){
    if(/EXCLUSAO_NAO_CONFIRMADA/.test(String(error?.message||'')))throw error;
    console.warn('Exclusão confirmada, mas a verificação de leitura falhou:',error);
  }
  const deletedAt=Date.parse(result?.deleted_at||'')||Number(result?.sync_updated_at)||Date.now();
  state.playerTombstones=state.playerTombstones||{};
  state.playerTombstones[id]=Math.max(Number(state.playerTombstones[id])||0,deletedAt);
  try{
    const raw=storageGet(PLAYER_ROSTER_CACHE_KEY),cached=raw?JSON.parse(raw):null;
    if(cached&&Array.isArray(cached.rows)){
      cached.rows=cached.rows.filter(r=>String(r?.id||'')!==String(id));
      cached.deleted={...(cached.deleted&&typeof cached.deleted==='object'?cached.deleted:{}),[id]:deletedAt};
      cached.version=2;cached.savedAt=Date.now();
      storageSet(PLAYER_ROSTER_CACHE_KEY,JSON.stringify(cached));
    }
  }catch{}
  return result;
}

function bindMasterFicha(){const root=document.querySelector('.master-player-grid');if(!root)return;root.onclick=async e=>{const view=e.target.closest('[data-view-player]');if(view){e.preventDefault();e.stopPropagation();const p=state.players.find(x=>x.id===view.dataset.playerId)||state.players[Number(view.dataset.viewPlayer)];if(p)openPlayerViewById(p.id);return}const edit=e.target.closest('[data-edit-p]');if(edit){e.preventDefault();e.stopPropagation();const key=edit.dataset.editP,i=state.players.findIndex(p=>String(p.id||p.login)===String(key));if(i>=0)openEntity('player',i);return}const bag=e.target.closest('[data-bag-p]');if(bag){e.preventDefault();e.stopPropagation();const key=bag.dataset.bagP,i=state.players.findIndex(p=>String(p.id||p.login)===String(key));if(i>=0){openModal(bagAdminModal(i));bindBagAdmin(i)}return}const del=e.target.closest('[data-del-p]');if(del){e.preventDefault();e.stopPropagation();const i=Number(del.dataset.delP),p=state.players[i];if(!p||!confirm('Excluir este Player?'))return;del.disabled=true;const oldText=del.textContent;del.textContent='Excluindo...';try{await savePlayerTrash(p);await deletePlayerConfirmed(p);const k=playerSyncKey(p);state.players=state.players.filter(x=>playerSyncKey(x)!==k);ps.lastSnapshot=clone(state.players);persistCriticalCache();persistSessionCache();storageSet(KEY,serializeState());toast('Player excluído e confirmado no servidor.');render('master')}catch(err){toast(authErrorText(err));del.disabled=false;del.textContent=oldText}}}}
function openPlayerViewById(id){const index=state.players.findIndex(p=>p.id===id);if(index>=0)openPlayerView(index)}
function openPlayerView(index){const p=state.players[index];if(!p)return;syncDerivedResources(p);const bonus=classBonusMap(p.class);openModal(`<div class="modal" id="playerViewModal"><div class="modal-card player-view-card"><button class="modal-close" id="closePlayerView">×</button><span class="badge">FICHA DO PLAYER</span><h2>${esc(p.name)}</h2><p class="muted">${esc(p.class||'Classe não escolhida')} • ${esc(p.status||'Ativo')}</p><div class="player-view-grid"><div><h3>Recursos</h3>${resourceBarMarkup('Vida',p.hp,derivedMax(p,'Corpo'),'health',false)}${resourceBarMarkup('Sanidade',p.sanity,derivedMax(p,'Sanidade'),'sanity',false)}</div><div><h3>Atributos</h3>${allAttrs().map(a=>`<div class="view-line"><span>${uiAttrIcon(a)} ${esc(a)}</span><b>${p.attrs?.[a]||0}${bonus[a]?` + ${bonus[a]}`:''}</b></div>`).join('')}</div><div><h3>Perícias</h3>${allSkills().map(sk=>`<div class="view-line"><span>${uiSkillIcon(sk)} ${esc(sk)}</span><b>${p.skills?.[sk]||0}${bonus[sk]?` + ${bonus[sk]}`:''}</b></div>`).join('')}</div><div><h3>História</h3><p>${esc(p.history||'—')}</p><h3>Anotações do Mestre</h3><textarea id="masterNotesView" rows="6">${esc(p.masterNotes||'')}</textarea><button class="btn primary small" id="saveMasterNotesView">Salvar anotação</button><h3>Descrição</h3><p>${esc(p.description||'—')}</p></div></div></div></div>`);document.getElementById('closePlayerView').onclick=()=>document.getElementById('playerViewModal')?.remove();document.getElementById('saveMasterNotesView').onclick=()=>{p.masterNotes=document.getElementById('masterNotesView').value;save();toast('Anotação do Mestre salva.')}}
let navDelegationBound=false;
function bindNav(){
  if(navDelegationBound)return;
  navDelegationBound=true;
  document.addEventListener('click',ev=>{
    const button=ev.target?.closest?.('[data-nav]');
    if(button){
      ev.preventDefault();
      ev.stopPropagation();
      const target=button.dataset.nav;
      if(target==='home'&&state.session?.role==='player'){if(!curtainBusy)curtainTransition(()=>render('home'));return}
      if(target)render(target);
      return;
    }
    const logout=ev.target?.closest?.('#logout');
    if(logout){
      ev.preventDefault();
      ev.stopPropagation();
      authLogout().catch(()=>{});
      clearImmersivePuzzleState();
      state.session=null;
      clearSessionCache();
      save();
      render();
    }
  },true);
}
function playerMusicLibraryMarkup(p){const lib=Array.isArray(p.playerMusicLibrary)?p.playerMusicLibrary:[];return `<article class="sheet-card player-music-library"><div class="section-heading"><div><span class="section-kicker">BIBLIOTECA PESSOAL</span><h2>Suas trilhas salvas</h2></div><span class="corner-mark">${lib.length} música(s)</span></div><p class="muted small">Crie seu banco de músicas para usar durante a sessão. Envie o MP3 baixado no seu aparelho.</p><div class="library-add-grid"><input id="libMusicTitle" placeholder="Ex.: Tema de combate" maxlength="80"><label class="btn small gold">🎵 Enviar MP3<input id="libMusicFile" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus" hidden></label></div><small class="muted">Preencha o título (opcional) e escolha o arquivo (até 25 MB).</small><div class="library-list">${lib.length?lib.map((m,i)=>`<div class="library-item"><div><strong>${esc(m.title||'Sem nome')}</strong><small>${m.kind==='file'?'Arquivo enviado do aparelho':esc(m.url||'')}</small></div><div class="row"><button type="button" class="btn small gold" data-play-library="${i}">▶</button><button type="button" class="btn small" data-pause-library="${i}">Ⅱ</button><button type="button" class="btn small" data-stop-library="${i}">■</button><button type="button" class="btn small danger" data-remove-library="${i}">✕</button></div></div>`).join(''):'<div class="empty">Sem músicas na sua biblioteca.</div>'}</div></article>`}
function playerThemesMarkup(p){const themes=Array.isArray(p.musicThemes)?p.musicThemes:[];return `<article class="sheet-card character-themes"><div class="section-heading"><div><span class="section-kicker">TRILHAS DO PERSONAGEM</span><h2>A música que acompanha sua história</h2></div></div><p class="muted small">Crie trilhas separadas, como Música de Morte, Tema de Combate ou Tema Pessoal. Você escolhe o título e o link.</p><div class="theme-add-grid"><input id="themeLabel" placeholder="Ex.: Música de morte"><input id="themeTitle" placeholder="Ex.: Old Doll"><input id="themeUrl" placeholder="Link do Spotify ou URL da música"><button class="btn gold" id="addTheme">Adicionar trilha</button></div><div class="theme-upload-row"><label class="btn small gold">🎵 Enviar MP3 do celular<input id="themeFile" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus" hidden></label><small class="muted">Preencha o tipo e o nome acima (opcional) e escolha o arquivo (até 25 MB).</small></div><div class="character-theme-list">${themes.length?themes.map((t,i)=>`<div class="character-theme-card"><div><span class="theme-label">${esc(t.label||'TRILHA')}</span><h3>${esc(t.title||'Sem título')}</h3><small>${t.kind==='file'?'Arquivo enviado do aparelho':esc(t.url||'')}</small></div><div class="row">${themeIsAudio(t)?`<button type="button" class="btn small gold" data-play-theme="${i}">▶ Tocar</button><button type="button" class="btn small" data-pause-theme="${i}">Ⅱ Pausar</button><button type="button" class="btn small" data-stop-theme="${i}">■ Parar</button>`:''}<a class="btn small" href="${esc(safeHref(t.url))}" target="_blank" rel="noopener">Abrir</a><button class="btn small danger" data-remove-theme="${i}">Remover</button></div></div>`).join(''):'<div class="empty">Nenhuma trilha cadastrada para este personagem.</div>'}</div></article>`}
function playerWallpaperMarkup(p){return `<article class="sheet-card character-wallpaper"><div class="section-heading"><div><span class="section-kicker">WALLPAPER PESSOAL</span><h2>Fundo do seu personagem</h2></div></div><p class="muted small">Escolha uma imagem para personalizar o início do seu próprio registro.</p><div class="wallpaper-preview" id="playerWallpaperPreview" style="${p.homeWallpaper?`background-image:linear-gradient(90deg,rgba(0,0,0,.5),rgba(0,0,0,.15)),url('${esc(p.homeWallpaper)}')`:''}"></div><label class="upload-label">Alterar wallpaper<input id="playerWallpaperInput" type="file" accept="image/png,image/jpeg,image/webp,.jfif" hidden></label>${p.homeWallpaper?'<button class="btn small danger" id="clearPlayerWallpaper">Remover wallpaper</button>':''}</article>`}
function openBookReader(id){const it=item(id);if(!it)return;const pages=Array.isArray(it.bookPages)&&it.bookPages.length?it.bookPages:(it.bookContent?[String(it.bookContent)]:[]);let page=0;openModal(`<div class="modal" id="bookReader"><div class="modal-card book-reader"><button class="modal-close" id="closeBook">×</button><span class="badge">LIVRO</span><h2>${esc(it.name)}</h2><div class="book-reader-page" id="bookReaderPage">${pages.length?esc(pages[0]).replace(/\n/g,'<br>'):'Este livro ainda não possui conteúdo. O Mestre pode escrever as páginas na administração do item.'}</div><div class="book-reader-controls"><button class="btn small" id="bookPrev" ${pages.length<=1?'disabled':''}>← Anterior</button><span id="bookPageCount">${pages.length?`Página 1 de ${pages.length}`:'Sem páginas'}</span><button class="btn small" id="bookNext" ${pages.length<=1?'disabled':''}>Próxima →</button></div></div></div>`);const renderPage=()=>{const el=document.getElementById('bookReaderPage'),count=document.getElementById('bookPageCount');if(el)el.innerHTML=pages.length?esc(pages[page]).replace(/\n/g,'<br>'):'Este livro ainda não possui conteúdo.';if(count)count.textContent=pages.length?`Página ${page+1} de ${pages.length}`:'Sem páginas';document.getElementById('bookPrev')?.toggleAttribute('disabled',page<=0);document.getElementById('bookNext')?.toggleAttribute('disabled',page>=pages.length-1)};document.getElementById('closeBook').onclick=()=>document.getElementById('bookReader')?.remove();document.getElementById('bookPrev')?.addEventListener('click',()=>{if(page>0){page--;renderPage()}});document.getElementById('bookNext')?.addEventListener('click',()=>{if(page<pages.length-1){page++;renderPage()}})}
function updateResourceBars(p,type){const max=type==='sanity'?derivedMax(p,'Sanidade'):derivedMax(p,'Corpo'),value=type==='sanity'?clamp(p.sanity??max,0,max):clamp(p.hp??max,0,max);document.querySelectorAll(`[data-resource-bar="${esc(type)}"]`).forEach(bar=>{const old=Number(bar.dataset.value||value),pct=Math.max(0,Math.min(100,(value/max)*100));bar.dataset.value=value;const fill=bar.querySelector('.horror-bar-fill');if(fill){if(value<old){bar.classList.remove('damage');void bar.offsetWidth;bar.classList.add('damage')}fill.style.width=`${pct}%`}const strong=bar.querySelector('.horror-resource-head strong');if(strong)strong.innerHTML=`${value}<small> / ${max}</small>`;const foot=bar.querySelector('.horror-resource-foot span');if(foot)foot.textContent=`${Math.round(pct)}%`;const st=resourceState(value,max);bar.dataset.state=st;const stEl=bar.querySelector('.horror-resource-foot span:last-child');if(stEl)stEl.textContent=resourceStateLabel(type,st);});}

function printSheetAsPdf(p){
  const prevTitle=document.title;
  document.title=`Ficha - ${p?.name||'Personagem'}`;
  window.print();
  setTimeout(()=>{document.title=prevTitle},600);
}
async function persistPlayerMusicChange(p,successMessage){
  p._syncUpdatedAt=nextStamp();
  save();
  const ok=await syncPlayersDbNow();
  if(ok===false){toast('A alteração foi mantida neste aparelho, mas não foi possível sincronizá-la com o servidor. Tente novamente.');return false}
  if(successMessage)toast(successMessage);
  return true;
}
function bindSheet(){const p=player();if(!p)return;syncDerivedResources(p);document.querySelectorAll('[data-resource-input]').forEach(inp=>inp.addEventListener('input',()=>{const type=inp.dataset.resourceInput,max=type==='sanity'?derivedMax(p,'Sanidade'):derivedMax(p,'Corpo'),v=clamp(inp.value,0,max);if(type==='sanity')p.sanity=v;else p.hp=v;const hidden=document.getElementById(type==='sanity'?'sanity':'hp');if(hidden)hidden.value=v;save();updateResourceBars(p,type)}));const saveId=document.getElementById('saveIdentity');const pdfBtn=document.getElementById('downloadSheetPdf');if(pdfBtn)pdfBtn.onclick=()=>printSheetAsPdf(p);const cls=document.getElementById('pClass');if(cls)cls.onchange=()=>{if(classChosen(p)){toast('A classe já está selada.');render('sheet');return}if(!cls.value)return;if(!confirm(`Escolher ${cls.value}?\n\nEsta escolha é definitiva para este personagem.`)){render('sheet');return}p.class=cls.value;p.initialSpell='';save();toast('Seu destino está selado.');render('sheet')};if(saveId)saveId.onclick=()=>{captureSheetDraft();p.name=document.getElementById('pName').value.trim()||p.name;if(!classChosen(p)&&document.getElementById('pClass'))p.class=document.getElementById('pClass').value;p.extra=Math.max(0,Number(document.getElementById('extra')?.value)||p.extra||0);p.soul=document.getElementById('soul').value.trim();p.belovedObjects=document.getElementById('belovedObjects').value.trim();p.personality=document.getElementById('personality').value.trim();p.destiny=document.getElementById('destiny').value.trim();p.description=document.getElementById('description').value.trim();p.history=document.getElementById('history').value.trim();p.attrs.Corpo=clamp(p.attrs.Corpo,0,MAX_ATTR);p.attrs.Sanidade=clamp(p.attrs.Sanidade,0,MAX_ATTR);syncDerivedResources(p);p.hp=clamp(document.getElementById('hp').value,0,p.hpMax);p.sanity=clamp(document.getElementById('sanity').value,0,p.sanityMax);if(document.getElementById('attack'))p.attack=Number(document.getElementById('attack').value)||0;if(document.getElementById('defense'))p.defense=Number(document.getElementById('defense').value)||0;save();toast('Ficha atualizada.');render('sheet')};const history=document.getElementById('saveHistory');if(history)history.onclick=()=>{captureSheetDraft();p.description=document.getElementById('description').value;p.history=document.getElementById('history').value;save();toast('Descrição e história salvas.');render('sheet')};const photo=document.getElementById('photoInput');if(photo)photo.onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Imagem inválida ou maior que 40 MB.');return}toast('Enviando retrato…');try{const data=await imageFileToRemoteURL(f,`players/${p.id}/portrait.webp`,900,.8);p.photo=data;save();document.getElementById('charPhoto').src=data;toast('Retrato salvo e sincronizado.')}catch(err){console.error(err);toast('Não foi possível salvar o retrato.')}};const soulPhoto=document.getElementById('soulPhotoInput');if(soulPhoto)soulPhoto.onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Imagem inválida ou maior que 40 MB.');return}toast('Enviando imagem da alma…');try{const data=await imageFileToRemoteURL(f,`players/${p.id}/soul.webp`,700,.8);p.soulPhoto=data;save();document.getElementById('soulPhoto').src=data;toast('Imagem da alma salva e sincronizada.')}catch(err){console.error(err);toast('Não foi possível salvar a imagem da alma.')}};const captureSheetDraft=()=>{const attrs={...p.attrs},skills={...p.skills};document.querySelectorAll('.pAttr').forEach(x=>attrs[x.dataset.attr]=clamp(x.value,0,MAX_ATTR));document.querySelectorAll('.pSkill').forEach(x=>skills[x.dataset.skill]=clamp(x.value,0,MAX_SKILL));const draft={attrs,skills,pid:String(p.id),at:Date.now(),basePts:Number(p._pointsAt)||0};state.session=state.session||{};state.session.sheetDraft=draft;return draft};const sa=document.getElementById('saveAttrs');if(sa)sa.onclick=()=>{const draft=captureSheetDraft(),oldAttrs=p.attrs,oldSkills=p.skills;p.attrs=draft.attrs;p.skills=draft.skills;const err=validateAllocation(p,{attrs:oldAttrs,skills:oldSkills});if(err){p.attrs=oldAttrs;p.skills=oldSkills;toast(err);return}syncDerivedResources(p);state.session.sheetDraft=null;save();toast('Atributos salvos sem apagar as perícias.');render('sheet')};const ss=document.getElementById('saveSkills');if(ss)ss.onclick=()=>{const draft=captureSheetDraft(),oldAttrs=p.attrs,oldSkills=p.skills;p.attrs=draft.attrs;p.skills=draft.skills;const err=validateAllocation(p,{attrs:oldAttrs,skills:oldSkills});if(err){p.attrs=oldAttrs;p.skills=oldSkills;toast(err);return}state.session.sheetDraft=null;save();toast('Perícias salvas sem apagar os atributos.');render('sheet')};const wp=document.getElementById('playerWallpaperInput');if(wp)wp.onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Wallpaper inválido ou maior que 40 MB.');return}toast('Enviando wallpaper…');try{const data=await imageFileToRemoteURL(f,`players/${p.id}/wallpaper.webp`,1400,.82);p.homeWallpaper=data;save();toast('Wallpaper do personagem salvo e sincronizado.');render('sheet')}catch(err){console.error(err);toast('Não foi possível salvar o wallpaper.')}};const cwp=document.getElementById('clearPlayerWallpaper');if(cwp)cwp.onclick=()=>{p.homeWallpaper='';save();toast('Wallpaper removido.');render('sheet')};
const taEnabled=document.getElementById('turnAlertEnabled');if(taEnabled)taEnabled.onchange=()=>{p.turnAlertSound=p.turnAlertSound||{url:'',name:'',enabled:false};p.turnAlertSound.enabled=taEnabled.checked;save()};
const taUrlInput=document.getElementById('turnAlertUrl');if(taUrlInput)taUrlInput.onchange=()=>{const url=taUrlInput.value.trim();if(!url)return;p.turnAlertSound=p.turnAlertSound||{url:'',name:'',enabled:false};p.turnAlertSound.url=url;p.turnAlertSound.name='';save();toast('Som do alerta atualizado.')};
const taFile=document.getElementById('turnAlertFile');if(taFile)taFile.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024){toast('O som deve ter até 8 MB.');return}if(!remoteEnabled){toast('Configure o Supabase para enviar um som próprio.');return}try{const ext=(f.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp3';const url=await uploadGlobalFile(`players/${p.id}/turn-alert-${Date.now()}.${ext}`,f);if(!url)throw new Error('sem URL');p.turnAlertSound=p.turnAlertSound||{url:'',name:'',enabled:false};p.turnAlertSound.url=url;p.turnAlertSound.name=f.name;save();toast('Som enviado e sincronizado.');render('sheet')}catch(err){console.error(err);toast('Não foi possível enviar o som.')}};
const taVib=document.getElementById('turnVibrateEnabled');if(taVib)taVib.onchange=()=>{p.turnAlertSound=p.turnAlertSound||{url:'',name:'',enabled:false};p.turnAlertSound.vibrateOff=!taVib.checked;save();if(taVib.checked)vibratePhone([80])};const taChime=document.getElementById('turnChimeEnabled');if(taChime)taChime.onchange=()=>{p.turnAlertSound=p.turnAlertSound||{url:'',name:'',enabled:false};p.turnAlertSound.chimeOff=!taChime.checked;save();if(taChime.checked){unlockTurnChime();playTurnChime('turn')}};const taTest=document.getElementById('testTurnAlert');if(taTest)taTest.onclick=()=>{const url=p.turnAlertSound?.url||document.getElementById('turnAlertUrl')?.value.trim();if(!url){unlockTurnChime();playTurnChime('turn');vibratePhone([80]);return}unlockTurnAlertAudioOnce();new Audio(url).play().catch(()=>toast('Não foi possível tocar este som.'))};
const taClear=document.getElementById('clearTurnAlert');if(taClear)taClear.onclick=()=>{p.turnAlertSound={url:'',name:'',enabled:false,chimeOff:!!p.turnAlertSound?.chimeOff,vibrateOff:!!p.turnAlertSound?.vibrateOff};save();toast('Alerta sonoro removido.');render('sheet')};
const addTheme=document.getElementById('addTheme');if(addTheme)addTheme.onclick=async()=>{const label=document.getElementById('themeLabel')?.value.trim(),title=document.getElementById('themeTitle')?.value.trim(),url=document.getElementById('themeUrl')?.value.trim();if(!label||!title||!url){toast('Preencha tipo, nome e link da trilha.');return}p.musicThemes=p.musicThemes||[];p.musicThemes.push({label,title,url});await persistPlayerMusicChange(p,'Trilha do personagem adicionada e salva no servidor.');render('sheet')};document.querySelectorAll('[data-remove-theme]').forEach(b=>b.onclick=async()=>{p.musicThemes.splice(Number(b.dataset.removeTheme),1);await persistPlayerMusicChange(p,'Trilha removida e salva no servidor.');render('sheet')});document.querySelectorAll('[data-play-theme]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.playTheme),t=p.musicThemes?.[i];if(t)playPersonalTheme(t.url,t.title,i)});document.querySelectorAll('[data-pause-theme]').forEach(b=>b.onclick=()=>pausePersonalTheme());document.querySelectorAll('[data-stop-theme]').forEach(b=>b.onclick=()=>stopPersonalTheme());document.querySelectorAll('[data-remove-library]').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset.removeLibrary);if(p.playerMusicLibrary&&i>=0&&i<p.playerMusicLibrary.length){p.playerMusicLibrary.splice(i,1);await persistPlayerMusicChange(p,'Música removida e salva no servidor.');render('sheet')}});document.querySelectorAll('[data-play-library]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.playLibrary),m=p.playerMusicLibrary?.[i];if(m)playPersonalTheme(m.url,m.title,i)});document.querySelectorAll('[data-pause-library]').forEach(b=>b.onclick=()=>pausePersonalTheme());document.querySelectorAll('[data-stop-library]').forEach(b=>b.onclick=()=>stopPersonalTheme());document.querySelectorAll('[data-roll-die]').forEach(button=>button.onclick=()=>{
 const sides=Number(button.dataset.rollDie);
 const visual=document.getElementById('diceSkullVisual');
 if(visual){
  visual.classList.remove('throw');
  void visual.offsetWidth;
  visual.classList.add('throw');
 }
 button.disabled=true;
 rollDiceFor(p,sides,`1d${sides}`);
 requestAnimationFrame(()=>requestAnimationFrame(()=>{button.disabled=false}));
});const dex=document.getElementById('diceExpression'),dxb=document.getElementById('rollExpression');if(dxb)dxb.onclick=()=>rollExpressionFor(p,dex?.value||'d20');
 document.querySelectorAll('[data-deity-choice]').forEach(b=>b.onclick=()=>{if(p.class!=='Ocultista'||p.deityId)return;const d=allDeities().find(x=>x.id===b.dataset.deityChoice);if(!d)return;if(!confirm(`Escolher ${d.name}?\n\nEsta afinidade será definitiva para este personagem.`))return;p.deityId=d.id;save();toast('Sua afinidade foi selada.');render('sheet')});
 bindPointInputs(p,captureSheetDraft);
 const pn=document.getElementById('playerNotes');if(pn)pn.onchange=()=>{p.playerNotes=pn.value;save()};
document.querySelectorAll('[data-spell-choice]').forEach(b=>b.onclick=()=>{if(!hasMagicClass(p.class)||p.initialSpell)return;const sp=getSpells().find(x=>x.id===b.dataset.spellChoice);if(!sp)return;if(!confirm(`Escolher ${sp.name}?\n\nVocê só poderá escolher uma magia inicial.`))return;p.initialSpell=b.dataset.spellChoice;save();toast('Magia inicial escolhida.');render('sheet')});document.querySelectorAll('[data-use-spell]').forEach(b=>b.onclick=()=>castSpell(p,b.dataset.useSpell,'sheet'));
document.getElementById('newPersonalSpell')?.addEventListener('click',()=>openPersonalSpellEditor(p,null,'sheet'));
document.querySelectorAll('[data-edit-personal-spell]').forEach(b=>b.onclick=()=>openPersonalSpellEditor(p,b.dataset.editPersonalSpell,'sheet'));
document.querySelectorAll('[data-delete-personal-spell]').forEach(b=>b.onclick=()=>{
  const id=String(b.dataset.deletePersonalSpell), list=normalizePersonalSpells(p), idx=list.findIndex(x=>String(x.id)===id);
  if(idx<0)return;
  if(!confirm('Excluir esta magia pessoal?'))return;
  list.splice(idx,1);save();toast('Magia pessoal excluída.');render('sheet');
});
document.querySelectorAll('[data-read-book]').forEach(b=>b.onclick=()=>openBookReader(Number(b.dataset.readBook)));
document.querySelectorAll('[data-remove-slot]').forEach(b=>b.onclick=()=>{p.backpack.splice(Number(b.dataset.removeSlot),1);save();render('sheet')});const add=document.getElementById('addBagItem');if(add)add.onclick=()=>addBag(p)}

function combatParticipantKey(kind,id){return `${kind}:${String(id||'').trim()}`}
function combatEntityForParticipant(row){
  if(!row)return null;
  const list=row.kind==='monster'?state.creatures:state.players;
  return (list||[]).find(e=>String(e.id||'')===String(row.entityId||''))||
    (list||[]).find(e=>String(e.login||'').toLowerCase()===String(row.entityLogin||'').toLowerCase())||null;
}
function normalizeCombatParticipants(){
  const c=normalizeCombatSession();
  const old=new Map((c.participants||[]).map(x=>[String(x.key||combatParticipantKey(x.kind,x.entityId)),x]));
  const next=[];const seen=new Set();
  for(const row of old.values()){
    if(row.kind!=='player')continue;
    const p=(state.players||[]).find(e=>String(e.id||'')===String(row.entityId||'')||String(e.login||'').toLowerCase()===String(row.entityLogin||'').toLowerCase());
    if(!p)continue;
    const key=combatParticipantKey('player',p.id||p.login);if(seen.has(key))continue;seen.add(key);
    next.push({...row,key,kind:'player',entityId:String(p.id||p.login||''),entityLogin:String(p.login||''),name:String(p.name||p.login||'Player'),initiative:Number(row.initiative)||0,turnOrder:Number.isFinite(Number(row.turnOrder))?Number(row.turnOrder):next.length,enabled:row.enabled!==false});
  }
  for(const row of old.values()){
    if(row.kind!=='monster')continue;
    const m=combatEntityForParticipant(row);if(!m)continue;
    const key=combatParticipantKey('monster',m.id||m.name);if(seen.has(key))continue;seen.add(key);
    next.push({...row,key,entityId:String(m.id||m.name||''),name:String(m.name||'Monstro'),turnOrder:Number.isFinite(Number(row.turnOrder))?Number(row.turnOrder):next.length,enabled:row.enabled!==false});
  }
  const ordered=[...next].sort((a,b)=>{
    const ao=Number.isFinite(Number(a.turnOrder))?Number(a.turnOrder):Number.MAX_SAFE_INTEGER;
    const bo=Number.isFinite(Number(b.turnOrder))?Number(b.turnOrder):Number.MAX_SAFE_INTEGER;
    return ao-bo||String(a.key).localeCompare(String(b.key));
  });
  ordered.forEach((entry,index)=>{entry.turnOrder=index});
  c.participants=ordered;
  c.actedKeys=(c.actedKeys||[]).filter(k=>ordered.some(x=>x.key===k));
  if(c.currentKey&&!ordered.some(x=>x.key===c.currentKey&&x.enabled!==false))c.currentKey='';
  return c;
}
function combatOrderedParticipants(c=normalizeCombatParticipants()){
  return [...(c.participants||[])].filter(x=>x.enabled!==false).sort((a,b)=>{
    const ao=Number.isFinite(Number(a.turnOrder))?Number(a.turnOrder):Number.MAX_SAFE_INTEGER;
    const bo=Number.isFinite(Number(b.turnOrder))?Number(b.turnOrder):Number.MAX_SAFE_INTEGER;
    if(ao!==bo)return ao-bo;
    return String(a.key).localeCompare(String(b.key));
  });
}
function combatCurrent(c=normalizeCombatParticipants()){
  return combatOrderedParticipants(c).find(x=>String(x.key)===String(c.currentKey))||null;
}
function combatLog(c,message){
  c.history=Array.isArray(c.history)?c.history:[];
  c.history.unshift({id:cryptoRandomId('combat-log'),at:Date.now(),round:Number(c.round)||1,turn:Number(c.turn)||0,message:String(message)});
  if(c.history.length>80)c.history.length=80;
}
function buildCombatSessionParticipants(players,selectedIds){const selected=new Set(Array.from(selectedIds||[],x=>String(x)));const seen=new Set();return (Array.isArray(players)?players:[]).filter(p=>{const id=String(p?.id||p?.login||'');if(!id||!selected.has(id)||seen.has(id))return false;seen.add(id);return true}).map((p,i)=>({key:combatParticipantKey('player',p.id||p.login),kind:'player',entityId:String(p.id||p.login||''),entityLogin:String(p.login||''),name:String(p.name||p.login||'Player'),initiative:0,turnOrder:i,enabled:true}))}
function combatNewSession(){return {...defaultCombatSession(),sessionId:cryptoRandomId('combat'),updatedAt:Date.now()}}
function combatResetState(c){c.active=false;c.round=1;c.turn=0;c.currentKey='';c.actedKeys=[];c.history=[];c.updatedAt=Date.now()}
function combatStart(c){
  const rows=combatOrderedParticipants(c);if(!rows.length){toast('Cadastre pelo menos um Player antes de iniciar.');return false;}
  c.active=true;c.round=1;c.turn=1;c.actedKeys=[];c.currentKey=rows[0].key;c.updatedAt=Date.now();return true;
}
async function advanceCombatTurn(){
  const c=normalizeCombatParticipants(),rows=combatOrderedParticipants(c);
  if(!rows.length){toast('Nenhum participante disponível.');return false;}
  if(!c.active){const started=combatStart(c);if(started){save();await saveGlobalNow().catch(()=>{});}return started;}
  let idx=rows.findIndex(x=>x.key===c.currentKey);if(idx<0)idx=0;
  const current=rows[idx];
  const acted=new Set((c.actedKeys||[]).map(String));acted.add(String(current.key));
  let next=null;
  for(let step=1;step<=rows.length;step++){
    const candidate=rows[(idx+step)%rows.length];
    if(!acted.has(String(candidate.key))){next=candidate;break;}
  }
  let newRound=false;
  if(!next){newRound=true;c.round=Math.max(1,Number(c.round)||1)+1;acted.clear();next=rows[0];if(c.round%5===0){const hungerEvents=tickPlayerHungerOnRound(state.players,c.round);hungerEvents.forEach(ev=>combatLog(c,ev));}}
  c.actedKeys=[...acted];c.currentKey=next.key;c.turn=Math.max(1,Number(c.turn)||1)+1;c.updatedAt=Date.now();
  const endedEntity=combatEntityForParticipant(current);const expiredEffects=tickSessionEffects(endedEntity);if(expiredEffects.length)combatLog(c,`${current.name}: ${expiredEffects.join(' • ')}`);
  const nextEntity=combatEntityForParticipant(next);if(nextEntity){const conditionEvents=tickConditions(nextEntity,c.round);if(conditionEvents.length)combatLog(c,`${next.name}: ${conditionEvents.join(' • ')}`);}
  combatLog(c,`${current.name} já agiu. Vez de ${next.name}.${newRound?' Nova rodada.':''}`);
  save();await saveGlobalNow().catch(()=>{});return true;
}
async function persistCombat(message=''){
  const c=normalizeCombatParticipants();if(message)combatLog(c,message);c.updatedAt=Date.now();save();await saveGlobalNow().catch(()=>{});render('home');
}
function combatMasterHome(){
  const c=normalizeCombatParticipants(),rows=combatOrderedParticipants(c),current=combatCurrent(c),acted=new Set(c.actedKeys||[]),m=normalizeMusic();
  const cardOf=p=>{
    const playerIdentity=String(p?.id||p?.login||'');
    const row=rows.find(x=>x.kind==='player'&&(String(x.entityId||'')===playerIdentity||(!x.entityId&&String(x.entityLogin||'').toLowerCase()===String(p?.login||'').toLowerCase())));const isCurrent=!!row&&row.key===c.currentKey;const didAct=!!row&&acted.has(row.key);const hp=Number(p.hp)||0,hpMax=Number(p.hpMax)||0,san=Number(p.sanity)||0,sanMax=Number(p.sanityMax)||derivedMax(p,'Sanidade')||10;
    const conditions=(p.conditions||[]).map(id=>conditionById(id)).filter(Boolean);
    const effects=Array.isArray(p.sessionEffects)?p.sessionEffects:[];
    const conditionTags=[...conditions.map(x=>`${x.name}${conditionTurnsLeft(p,x.id)>0?` · ${conditionTurnsLeft(p,x.id)} turno(s)`:''}`),...effects.map(x=>`${x.name} · ${Number(x.remainingTurns)||0} turno(s)`)].slice(0,6);
    return `<article class="combat-player-card ${isCurrent?'is-current':''} ${didAct?'has-acted':''}"><div class="combat-player-avatar"><img src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt="" loading="lazy" decoding="async"></div><div class="combat-player-main"><div class="combat-player-top"><div><span class="section-kicker">PLAYER</span><h3>${esc(p.name||p.login)}</h3><small>${esc(p.class||'Sem classe')}</small></div><span class="combat-state-badge">${isCurrent?'▶ VEZ':didAct?'✓ JÁ AGIU':'AGUARDANDO'}</span></div><div class="combat-mini-stats"><span>VIDA <b>${hp}/${hpMax||'—'}</b></span><span>SAN <b>${san}/${sanMax}</b></span><span>FOME <b>${Number(p.hunger??100)}%</b></span><label>ORDEM <strong>${row?rows.findIndex(x=>x.key===row.key)+1:'—'}</strong></label></div><div class="combat-vital-bars"><div><span>VIDA</span><div class="combat-vital-track health"><i style="width:${hpMax?clamp(hp/hpMax*100,0,100):0}%"></i></div></div><div><span>SANIDADE</span><div class="combat-vital-track sanity"><i style="width:${sanMax?clamp(san/sanMax*100,0,100):0}%"></i></div></div></div>${conditionTags.length?`<div class="combat-status-tags">${conditionTags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>`:'<div class="combat-status-clear">SEM CONDIÇÕES ATIVAS</div>'}<div class="row"><button class="btn small" data-combat-order="${esc(p.id||p.login)}" data-order-dir="-1" aria-label="Mover ${esc(p.name||p.login)} para cima" ${!row?'disabled':''}>↑ Ordem</button><button class="btn small" data-combat-order="${esc(p.id||p.login)}" data-order-dir="1" aria-label="Mover ${esc(p.name||p.login)} para baixo" ${!row?'disabled':''}>↓ Ordem</button><button class="btn small ${row?'':'gold'}" data-combat-toggle-player="${esc(p.id||p.login)}">${row?'✓ Na sessão':'＋ Incluir na sessão'}</button><button class="btn small primary" data-master-open-player="${esc(p.id)}">Abrir ficha</button><button class="btn small" data-combat-player-action="${esc(p.id)}">Ações rápidas</button></div></div></article>`;
  };
  const isMember=p=>rows.some(x=>x.kind==='player'&&(String(x.entityId||'')===String(p?.id||p?.login||'')||(!x.entityId&&String(x.entityLogin||'').toLowerCase()===String(p?.login||'').toLowerCase())));
  const members=(state.players||[]).filter(isMember),outsiders=(state.players||[]).filter(p=>!isMember(p));
  const playerCards=members.map(cardOf).join(''),outsideCards=outsiders.map(cardOf).join('');
  const history=(c.history||[]).slice(0,10).map(h=>`<div class="combat-history-item"><small>R${Number(h.round)||1} • T${Number(h.turn)||0}</small><span>${esc(h.message)}</span></div>`).join('');
  const currentIndex=rows.findIndex(x=>x.key===c.currentKey);const nextUp=rows.length?(currentIndex>=0?rows[(currentIndex+1)%rows.length]:rows[0]):null;
  return shell(`<section class="master-control-hero combat-control-hero"><div><span class="badge">CENTRO DE CONTROLE DO MESTRE</span><h1>${esc(c.title||'Sessão atual')}</h1><p>${esc(c.scene||'Tudo que o Mestre precisa para conduzir a sessão, agora em uma única tela.')}</p></div><div class="master-control-status"><span>${c.active?'● COMBATE ATIVO':'○ ANTES DO PRIMEIRO SINAL'}</span><strong>${current?`Vez: ${esc(current.name)}`:'Pronto para iniciar'}</strong><small>Rodada ${Number(c.round)||1} • Turno ${Number(c.turn)||0}</small></div></section>
  <section class="combat-control-grid">
    <article class="card combat-turn-panel"><div class="row space"><div><span class="section-kicker">CONTROLE DE TURNO</span><h2>${current?esc(current.name):'Nenhum turno iniciado'}</h2><p class="small muted">Clique uma vez para encerrar a vez atual. O sistema marca automaticamente quem já agiu e passa para o próximo.</p></div><span class="corner-mark">R${Number(c.round)||1} • T${Number(c.turn)||0}</span></div><div class="combat-big-status">${current?`<strong>${esc(current.name)}</strong><span>${acted.has(current.key)?'JÁ AGIU':'AGUARDANDO AÇÃO'}</span>`:'<strong>Preparação</strong><span>Defina as iniciativas e inicie o combate.</span>'}</div><div class="combat-next-spotlight"><span>PRÓXIMO A AGIR</span><strong>${nextUp?esc(nextUp.name):'Aguardando participantes'}</strong><small>${nextUp&&current&&nextUp.key===current.key?'Inicie a rodada para revelar a ordem.':'A ordem pode ser reorganizada pelo Mestre.'}</small></div><div class="row combat-main-actions"><button class="btn primary" id="combatStart">${c.active?'↻ Reiniciar combate':'▶ Iniciar combate'}</button><button class="btn gold" id="combatNext">${c.active?'⏭ Próximo turno':'▶ Iniciar pela ordem'}</button><button class="btn" id="combatResetRound">↺ Reiniciar rodada</button><button class="btn danger" id="combatEnd">■ Encerrar</button><button class="btn" id="combatNewSession">＋ Nova sessão</button></div><div class="combat-order-strip">${rows.map((x,i)=>`<div class="combat-order-chip ${x.key===c.currentKey?'current':''} ${acted.has(x.key)?'acted':''}"><b>${i+1}</b><span>${esc(x.name)}</span>${acted.has(x.key)?'<small>✓</small>':''}</div>`).join('')||'<span class="muted">Nenhum participante.</span>'}</div></article>
    <aside class="card combat-session-meta"><div class="section-heading"><div><span class="section-kicker">SESSÃO</span><h2>Estado da aventura</h2></div></div><div class="field"><label>Nome da sessão</label><input id="combatTitle" value="${esc(c.title||'Sessão atual')}"></div><div class="field"><label>Cena atual</label><input id="combatScene" value="${esc(c.scene||'')}" placeholder="Ex.: Mansão Drevis — salão principal"></div><button class="btn primary full" id="combatSaveMeta">Salvar sessão</button><div class="combat-history"><div class="section-kicker">HISTÓRICO</div>${history||'<div class="small muted">O histórico aparecerá aqui.</div>'}</div></aside>
  </section>
  <section class="card combat-players-panel"><div class="row space"><div><span class="section-kicker">PARTICIPANTES</span><h2>Na sessão (${members.length})</h2><p class="small muted">Vida, Sanidade, condições, efeitos temporários e ordem em uma única leitura.</p></div><div class="row"><button class="btn" id="combatAddMonster">+ Adicionar monstro</button><button class="btn" data-nav="master">Gerenciar Players</button></div></div><div class="combat-player-grid">${playerCards||'<div class="empty combat-no-session"><strong>Nenhuma sessão em andamento</strong><p>Crie uma nova sessão e escolha quais Players participam. Só eles aparecem aqui e recebem os avisos de vez.</p><button class="btn primary" id="combatNewSessionEmpty">＋ Nova sessão</button></div>'}</div>${outsideCards?`<details class="combat-outside"><summary>Fora da sessão (${outsiders.length}) — fichas preservadas</summary><div class="combat-player-grid">${outsideCards}</div></details>`:''}</section>
  <section class="card session-archive-tools"><div><span class="section-kicker">ARQUIVO RESTRITO</span><h2>Terminais e segredos desta sessão</h2><p class="small muted">Crie puzzles com login e senha fictícios para os jogadores descobrirem arquivos. As respostas e o conteúdo desbloqueável ficam no servidor, fora do estado global compartilhado.</p></div><div class="row session-archive-actions"><button class="btn primary" id="openSessionPuzzleManager">⌘ Gerenciar puzzles</button><button class="btn danger" id="openSessionMasterNotes">✦ Segredos do Mestre</button></div></section>
  <details class="player-utilities combat-secondary-tools"><summary>Ferramentas auxiliares <span>Trilha sonora, pistas secretas e atmosfera</span></summary><section class="combat-utilities-grid"><article class="card"><div class="row space"><div><span class="section-kicker">TRILHA</span><h2>${esc(m.title||'Nenhuma trilha')}</h2></div><button class="btn" data-nav="master">Biblioteca</button></div><p class="small muted">${m.url?(m.playing?'Tocando para todos os Players.':'Trilha carregada e persistida.'):'Nenhuma trilha global selecionada.'}</p><div class="row"><button class="btn primary" id="masterMusicPlay">${m.playing?'Ⅱ Pausar':'▶ Tocar'}</button><button class="btn" id="masterMusicStop">■ Parar</button></div></article><article class="card"><div class="row space"><div><span class="section-kicker">PISTA SECRETA</span><h2>Enviar para um Player</h2></div><button class="btn" data-nav="master">Biblioteca</button></div><div class="field"><label>Player</label><select id="masterSecretTarget">${state.players.map(p=>`<option value="${esc(p.login)}">${esc(p.name||p.login)}</option>`).join('')}</select></div><div class="field"><label>Título</label><input id="masterSecretTitle" placeholder="Ex.: A porta está aberta"></div><div class="field"><label>Mensagem</label><textarea id="masterSecretMessage" rows="3" placeholder="Somente esse Player verá esta pista."></textarea></div><button class="btn gold" id="masterSendSecret">Enviar pista</button></article><article class="card"><div class="row space"><div><span class="section-kicker">ATMOSFERA</span><h2>Modo Terror</h2></div><button class="btn danger" id="masterTerrorMode">${state.terrorMode?.active?'Editar / Encerrar':'Ativar'}</button></div><p class="small muted">Mostra uma cena de tensão para todos os Players.</p></article></section></details>`,'home');
}
function bindMasterHome(){
  const saveCombat=async(msg)=>{const c=normalizeCombatParticipants();if(msg)combatLog(c,msg);c.updatedAt=Date.now();save();await saveGlobalNow().catch(()=>{});render('home');};
  document.getElementById('combatStart')?.addEventListener('click',async()=>{const c=normalizeCombatParticipants();if(c.active){if(!confirm('Reiniciar o combate? A rodada e as marcações de ação serão zeradas.'))return;combatResetState(c);}if(combatStart(c)){await saveCombat(`Combate iniciado. Vez de ${combatCurrent(c)?.name||'participante'}.`);}});
  document.getElementById('combatNext')?.addEventListener('click',async()=>{if(await advanceCombatTurn())render('home')});
  document.getElementById('combatNewSession')?.addEventListener('click',openCombatNewSessionPicker);document.getElementById('combatNewSessionEmpty')?.addEventListener('click',openCombatNewSessionPicker);
  document.querySelectorAll('[data-combat-order]').forEach(b=>b.addEventListener('click',async()=>{const c=normalizeCombatParticipants(),rows=combatOrderedParticipants(c),idx=rows.findIndex(x=>x.kind==='player'&&String(x.entityId)===String(b.dataset.combatOrder)),nextIdx=idx+(Number(b.dataset.orderDir)||0);if(idx<0||nextIdx<0||nextIdx>=rows.length)return;const [moved]=rows.splice(idx,1);rows.splice(nextIdx,0,moved);rows.forEach((entry,i)=>{entry.turnOrder=i});c.participants.filter(x=>x.enabled===false).forEach((entry,i)=>{entry.turnOrder=rows.length+i});c.updatedAt=Date.now();save();const saved=await saveGlobalNow().catch(()=>null);render('home');if(saved===null)toast('Ordem salva neste aparelho; confirmação do servidor pendente.') }));
  document.querySelectorAll('[data-combat-toggle-player]').forEach(b=>b.addEventListener('click',async()=>{const c=normalizeCombatParticipants(),id=String(b.dataset.combatTogglePlayer||''),source=(state.players||[]).find(x=>String(x.id||x.login||'')===id);let entry=c.participants.find(x=>x.kind==='player'&&String(x.entityId)===id);if(!entry){if(!source)return;entry=buildCombatSessionParticipants([source],[source.id||source.login])[0];if(!entry)return;c.participants.push(entry)}else{const wasEnabled=entry.enabled!==false;entry.enabled=!wasEnabled;if(wasEnabled&&c.currentKey===entry.key){c.currentKey='';c.actedKeys=(c.actedKeys||[]).filter(k=>k!==entry.key);if(c.active){const rows=combatOrderedParticipants(c);if(rows.length)c.currentKey=rows[0].key;else c.active=false;}}if(!entry.enabled)c.actedKeys=(c.actedKeys||[]).filter(k=>k!==entry.key)}c.updatedAt=Date.now();save();const saved=await saveGlobalNow().catch(()=>null);render('home');toast(saved===null?'Participação alterada localmente; confirmação do servidor pendente.':entry.enabled?'Player incluído na sessão.':'Player retirado da sessão; a ficha foi preservada.')}));
  document.getElementById('combatResetRound')?.addEventListener('click',async()=>{const c=normalizeCombatParticipants();c.round=1;c.turn=0;c.currentKey='';c.actedKeys=[];c.active=false;c.updatedAt=Date.now();await saveCombat('Combate reiniciado para uma nova rodada.');});
  document.getElementById('combatEnd')?.addEventListener('click',async()=>{const c=normalizeCombatParticipants();c.active=false;c.currentKey='';c.actedKeys=[];c.updatedAt=Date.now();await saveCombat('Combate encerrado.');});
  document.querySelectorAll('[data-combat-initiative]').forEach(inp=>inp.addEventListener('change',async()=>{const c=normalizeCombatParticipants(),p=c.participants.find(x=>x.kind==='player'&&String(x.entityId)===String(inp.dataset.combatInitiative));if(!p)return;p.initiative=Math.max(0,Number(inp.value)||0);c.updatedAt=Date.now();save();await saveGlobalNow().catch(()=>{});render('home')}));
  document.getElementById('combatSaveMeta')?.addEventListener('click',async()=>{const c=normalizeCombatParticipants();c.title=document.getElementById('combatTitle').value.trim()||'Sessão atual';c.scene=document.getElementById('combatScene').value.trim();await saveCombat('Dados da sessão atualizados.');});
  document.getElementById('combatAddMonster')?.addEventListener('click',()=>openCombatMonsterPicker());
  document.getElementById('masterMusicPlay')?.addEventListener('click',async()=>{const mm=normalizeMusic();if(!mm.url){render('master');toast('Escolha uma trilha na Biblioteca.');return}await saveMusicCommand({playing:!mm.playing,position:musicTargetPosition(mm),startedAt:!mm.playing?Date.now()-musicTargetPosition(mm)*1000:0});render('home')});
  document.getElementById('masterMusicStop')?.addEventListener('click',async()=>{await saveMusicCommand({playing:false,position:0,startedAt:0});render('home')});
  document.getElementById('masterSendSecret')?.addEventListener('click',async()=>{const target=document.getElementById('masterSecretTarget')?.value||'',title=document.getElementById('masterSecretTitle')?.value.trim()||'Informação confidencial',message=document.getElementById('masterSecretMessage')?.value.trim()||'';const p=state.players.find(x=>String(x.login).toLowerCase()===String(target).toLowerCase());if(!p||!message){toast('Escolha um Player e escreva a pista.');return}const clue={id:`secret-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title,message,receivedAt:Date.now()};try{await persistSecretClue(p,clue)}catch(e){console.error('Falha ao confirmar pista secreta:',e);toast('A pista NÃO foi confirmada pelo servidor. Verifique a conexão e tente novamente.');return}broadcastLive('secret-clue',{targetLogin:target,clue}).catch(()=>{});toast(`Pista salva para ${p.name||p.login}.`);document.getElementById('masterSecretMessage').value='';});
  document.getElementById('masterTerrorMode')?.addEventListener('click',openTerrorEditor);
  document.getElementById('openSessionPuzzleManager')?.addEventListener('click',openSessionPuzzleManager);
  document.getElementById('openSessionMasterNotes')?.addEventListener('click',openSessionMasterNotes);
  document.querySelectorAll('[data-master-open-player]').forEach(b=>b.onclick=()=>openPlayerViewById(b.dataset.masterOpenPlayer));
  document.querySelectorAll('[data-combat-player-action]').forEach(b=>b.onclick=()=>openCombatStatusEditor(b.dataset.combatPlayerAction));
}
function openCombatNewSessionPicker(){
  if(state.session?.role!=='master'){toast('Somente o Mestre pode iniciar uma sessão.');return}
  const players=Array.isArray(state.players)?state.players:[];
  const options=players.map(p=>{
    const id=String(p?.id||p?.login||'');
    if(!id)return '';
    const meta=[p.class||'Sem classe','Vida '+(Number(p.hp)||0)+'/'+(Number(p.hpMax)||derivedMax(p,'Corpo')||0)].join(' · ');
    return `<label class="combat-session-player-option"><input type="checkbox" data-new-session-player="${esc(id)}"><img class="combat-session-player-avatar" src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt="" loading="lazy" decoding="async"><span class="combat-session-player-copy"><strong>${esc(p.name||p.login||'Player')}</strong><small>${esc(meta||'Ficha cadastrada')}</small></span><span class="combat-session-player-mark">+</span></label>`;
  }).filter(Boolean).join('');
  openModal(`<div class="modal" id="combatNewSessionModal"><div class="modal-card combat-new-session-modal"><button type="button" class="modal-close" id="closeCombatNewSession">×</button><span class="badge">NOVA SESSÃO</span><h2>Preparar a próxima vigília</h2><p class="small muted">Escolha quem estará nesta mesa. Criar uma sessão nova limpa apenas o histórico, os turnos e os participantes do encontro anterior. As fichas dos Players, seus dados, os monstros cadastrados e os registros da biblioteca permanecem intactos.</p><div class="input-grid combat-session-meta-inputs"><div class="field"><label>Nome da sessão</label><input id="newCombatTitle" maxlength="120" value="Nova sessão" placeholder="Ex.: Mansão Drevis"></div><div class="field"><label>Cena inicial (opcional)</label><input id="newCombatScene" maxlength="240" placeholder="Ex.: Portões da mansão"></div></div><div class="divider"></div><div class="row space combat-session-picker-heading"><div><span class="section-kicker">ELENCO</span><h3>Players que participarão</h3><p class="small muted">As caixas começam desmarcadas para você escolher o grupo da vez.</p></div><span id="newCombatSelectedCount" class="corner-mark">0 SELECIONADOS</span></div><div class="row combat-session-picker-tools"><button type="button" class="btn small" id="newCombatSelectAll" ${players.length?'':'disabled'}>Selecionar todos</button><button type="button" class="btn small" id="newCombatClearSelection" ${players.length?'':'disabled'}>Limpar seleção</button></div><div class="combat-session-player-picker">${options||'<div class="empty">Nenhuma ficha cadastrada. Crie os Players primeiro em Câmara do Mestre → Players.</div>'}</div><div class="row combat-session-picker-actions"><button type="button" class="btn" id="cancelCombatNewSession">Cancelar</button><button type="button" class="btn primary" id="createCombatNewSession" ${players.length?'':'disabled'}>Criar sessão selecionada</button></div></div></div>`);
  const modal=document.getElementById('combatNewSessionModal');
  const close=()=>modal?.remove();
  const checkboxes=()=>[...(modal?.querySelectorAll('[data-new-session-player]')||[])];
  const updateCount=()=>{const count=checkboxes().filter(x=>x.checked).length;const el=document.getElementById('newCombatSelectedCount');if(el)el.textContent=`${count} SELECIONADO${count===1?'':'S'}`;const create=document.getElementById('createCombatNewSession');if(create)create.disabled=count===0};
  document.getElementById('closeCombatNewSession')?.addEventListener('click',close);
  document.getElementById('cancelCombatNewSession')?.addEventListener('click',close);
  modal?.addEventListener('click',e=>{if(e.target===modal)close()});
  checkboxes().forEach(input=>input.addEventListener('change',updateCount));
  document.getElementById('newCombatSelectAll')?.addEventListener('click',()=>{checkboxes().forEach(x=>x.checked=true);updateCount()});
  document.getElementById('newCombatClearSelection')?.addEventListener('click',()=>{checkboxes().forEach(x=>x.checked=false);updateCount()});
  document.getElementById('createCombatNewSession')?.addEventListener('click',async()=>{
    const selected=checkboxes().filter(x=>x.checked).map(x=>x.dataset.newSessionPlayer);
    if(!selected.length){toast('Selecione pelo menos um Player para iniciar a sessão.');return}
    const button=document.getElementById('createCombatNewSession');if(!button)return;
    button.disabled=true;button.textContent='Criando sessão…';
    const fresh=combatNewSession();
    fresh.title=String(document.getElementById('newCombatTitle')?.value||'').trim().slice(0,120)||'Nova sessão';
    fresh.scene=String(document.getElementById('newCombatScene')?.value||'').trim().slice(0,240);
    fresh.active=false;fresh.round=1;fresh.turn=0;fresh.currentKey='';fresh.actedKeys=[];fresh.history=[];
    fresh.participants=buildCombatSessionParticipants(players,selected);
    if(!fresh.participants.length){button.disabled=false;button.textContent='Criar sessão selecionada';toast('Não foi possível encontrar as fichas selecionadas. Atualize a lista e tente novamente.');return}
    state.combatSession=fresh;
    combatLog(fresh,`Nova sessão criada com ${fresh.participants.length} Player(s).`);
    save();
    let saved=null;
    try{saved=await saveGlobalNow().catch(()=>null)}finally{close();render('home')}
    toast(saved===null?'Sessão criada neste aparelho; a sincronização com o servidor ainda está pendente. As fichas foram preservadas.':'Nova sessão criada e sincronizada com os Players selecionados. As demais fichas foram preservadas.');
  });
  updateCount();
}

function openCombatMonsterPicker(){
  const c=normalizeCombatParticipants(),used=new Set(c.participants.filter(x=>x.kind==='monster').map(x=>String(x.entityId)));
  const available=(state.creatures||[]).filter(m=>!used.has(String(m.id)));
  openModal(`<div class="modal" id="combatMonsterModal"><div class="modal-card"><button class="modal-close" id="closeCombatMonster">×</button><span class="badge">COMBATE</span><h2>Adicionar monstro</h2><p class="small muted">Escolha um monstro já cadastrado na Câmara do Mestre.</p><div class="combat-monster-list">${available.length?available.map(m=>`<button type="button" class="combat-monster-option" data-add-combat-monster="${esc(m.id)}"><strong>${esc(m.name)}</strong><span>Vida ${Number(m.hp)||0}/${Number(m.hpMax)||0}</span></button>`).join(''):'<div class="empty">Nenhum monstro disponível. Cadastre um primeiro em Mestre → Monstros.</div>'}</div></div></div>`);
  document.getElementById('closeCombatMonster').onclick=()=>document.getElementById('combatMonsterModal')?.remove();
  document.querySelectorAll('[data-add-combat-monster]').forEach(b=>b.onclick=async()=>{const m=state.creatures.find(x=>String(x.id)===String(b.dataset.addCombatMonster));if(!m)return;c.participants.push({key:combatParticipantKey('monster',m.id),kind:'monster',entityId:String(m.id),entityLogin:'',name:String(m.name||'Monstro'),initiative:0,enabled:true});c.updatedAt=Date.now();save();await saveGlobalNow().catch(()=>{});document.getElementById('combatMonsterModal')?.remove();toast(`${m.name} adicionado ao combate.`);render('home')});
}
function openCombatStatusEditor(playerId){
  const p=state.players.find(x=>String(x.id)===String(playerId));if(!p)return;const hpMax=Number(p.hpMax)||35,sanMax=Number(p.sanityMax)||derivedMax(p,'Sanidade')||10,det=detValues(p);
  const activeEffects=Array.isArray(p.sessionEffects)?p.sessionEffects:[];
  const conditionOptions=allConditions().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  const effectOptionsMarkup=()=>activeEffects.map(e=>`<option value="${esc(e.id)}">${esc(e.name)} · ${Number(e.remainingTurns)||0} turno(s)</option>`).join('');
  openModal(`<div class="modal" id="combatStatusModal"><div class="modal-card combat-status-modal"><button class="modal-close" id="closeCombatStatus">×</button><span class="badge">AÇÃO RÁPIDA</span><h2>${esc(p.name||p.login)}</h2><div class="session-status-edit-grid"><label>Vida<input id="cHp" type="number" min="0" max="${hpMax}" value="${clamp(p.hp,0,hpMax)}"></label><label>Sanidade<input id="cSan" type="number" min="0" max="${sanMax}" value="${clamp(p.sanity??sanMax,0,sanMax)}"></label><label>Determinação<input id="cDet" type="number" min="0" max="${det.max}" value="${det.cur}"></label></div><div class="divider"></div><div class="section-heading"><div><span class="section-kicker">CONDIÇÕES</span><h3>Aplicar ou remover estado</h3></div></div><div class="session-status-edit-grid"><label>Ação<select id="cConditionAction"><option value="none">Não alterar condições</option><option value="apply">Aplicar condição</option><option value="remove">Remover condição</option></select></label><label>Condição<select id="cCondition">${conditionOptions}</select></label><label>Duração (turnos)<input id="cConditionDuration" type="number" min="0" max="99" value="0"><small>0 = permanente, salvo regra da condição.</small></label></div><div class="divider"></div><div class="section-heading"><div><span class="section-kicker">EFEITO TEMPORÁRIO</span><h3>Registro personalizado</h3></div></div><p class="small muted">Use para bônus, penalidades ou estados especiais definidos pelo Mestre. O texto não aplica cálculos automaticamente.</p><div class="field"><label>Adicionar efeito</label><input id="cEffectName" maxlength="120" placeholder="Ex.: Mão ferida — −2 em ações delicadas"></div><div class="field"><label>Duração em turnos do personagem</label><input id="cEffectDuration" type="number" min="1" max="99" value="2"></div>${activeEffects.length?`<div class="field"><label>Remover efeito existente</label><select id="cRemoveEffect"><option value="">Não remover efeito</option>${effectOptionsMarkup()}</select></div>`:''}<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="cancelCombatStatus">Cancelar</button><button class="btn primary" id="saveCombatStatus">Salvar estado</button></div></div></div>`);
  const close=()=>document.getElementById('combatStatusModal')?.remove();document.getElementById('closeCombatStatus').onclick=close;document.getElementById('cancelCombatStatus').onclick=close;
  document.getElementById('cCondition')?.addEventListener('change',()=>{const def=conditionById(document.getElementById('cCondition')?.value||'');document.getElementById('cConditionDuration').value=Number(def?.turns)||0});
  document.getElementById('saveCombatStatus').onclick=async()=>{
    p.hp=clamp(document.getElementById('cHp').value,0,hpMax);p.sanity=clamp(document.getElementById('cSan').value,0,sanMax);p.determination=clamp(document.getElementById('cDet').value,0,det.max);
    const action=document.getElementById('cConditionAction')?.value||'none',condId=document.getElementById('cCondition')?.value||'',rounds=clamp(document.getElementById('cConditionDuration')?.value||0,0,99);
    p.conditions=Array.isArray(p.conditions)?p.conditions:[];p.conditionTurns=p.conditionTurns||{};p.conditionTick=p.conditionTick||{};
    if(action==='apply'&&condId){const fresh=!p.conditions.includes(condId);if(fresh){p.conditions.push(condId);applyConditionOnAdd(p,condId)}if(rounds>0)p.conditionTurns[condId]=rounds;else delete p.conditionTurns[condId];}
    if(action==='remove'&&condId){p.conditions=p.conditions.filter(x=>x!==condId);delete p.conditionTurns[condId];delete p.conditionTick[condId];if(condId==='fractured'&&p.weakenedByFracture){p.conditions=p.conditions.filter(x=>x!=='weakened');delete p.conditionTurns.weakened;delete p.weakenedByFracture}}
    p.sessionEffects=Array.isArray(p.sessionEffects)?p.sessionEffects:[];
    const removeEffect=document.getElementById('cRemoveEffect')?.value||'';if(removeEffect)p.sessionEffects=p.sessionEffects.filter(x=>String(x.id)!==removeEffect);
    const effectName=document.getElementById('cEffectName')?.value.trim()||'';const effectTurns=clamp(document.getElementById('cEffectDuration')?.value||1,1,99);
    if(effectName){p.sessionEffects=p.sessionEffects.filter(x=>String(x.name||'').toLowerCase()!==effectName.toLowerCase());p.sessionEffects.push({id:cryptoRandomId('effect'),name:effectName,remainingTurns:effectTurns,createdAt:Date.now()});}
    p._syncUpdatedAt=nextStamp();save();await saveGlobalNow().catch(()=>{});close();toast('Estado de combate atualizado. Efeitos personalizados não alteram cálculos automaticamente.');render('home')
  };
}

async function openSessionPuzzleManager(){
  if(state.session?.role!=='master'){toast('Somente o Mestre pode administrar terminais.');return}
  const sid=String(state.combatSession?.sessionId||'');if(!sid){toast('Crie ou carregue uma sessão antes de cadastrar puzzles.');return}
  let puzzles=[];try{const data=await listSessionPuzzles(sid);puzzles=Array.isArray(data)?data:[]}catch(err){console.warn('Puzzle manager list failed:',err);toast(puzzleRpcErrorText(err));return}
  let draftAudioFiles=[];
  let draftExtraFiles=[];let mainSeed=0;
  const optList=(list,sel)=>list.map(([v,l])=>`<option value="${esc(v)}"${v===sel?' selected':''}>${esc(l)}</option>`).join('');
  const renderExtraList=()=>{const box=document.getElementById('spExtraList');if(!box)return;
    box.innerHTML=draftExtraFiles.length?draftExtraFiles.map((f,i)=>`<div class="sp-extra-row" data-extra="${i}"><div class="sp-row"><div class="field"><label>Nome do arquivo</label><input data-x="name" maxlength="120" value="${esc(f.name)}" placeholder="ex.: carta_rasgada.txt"></div><div class="field"><label>Pasta</label><select data-x="folder">${optList(TERMINAL_FOLDERS,f.folder)}</select></div></div><div class="field"><label>Conteúdo</label><textarea data-x="content" rows="4" maxlength="20000" placeholder="Texto do arquivo">${esc(f.content)}</textarea></div><div class="sp-corrupt-box"><label class="row"><input type="checkbox" data-x="corrupted"${f.corrupted?' checked':''}> Corrompido</label><div class="row" data-x-opts${f.corrupted?'':' hidden'}><select data-x="level">${optList(CORRUPTION_LEVELS,f.level)}</select><button type="button" class="btn small" data-x-preview>Pré-visualizar / sortear de novo</button></div><pre class="sp-corrupt-preview" data-x-out hidden></pre></div><div class="row" style="justify-content:flex-end"><button type="button" class="btn small danger" data-x-remove>Remover</button></div></div>`).join(''):'<span class="tiny muted">Nenhum arquivo adicional.</span>';
    box.querySelectorAll('[data-extra]').forEach(row=>{const i=Number(row.dataset.extra),f=draftExtraFiles[i];if(!f)return;
      row.querySelectorAll('[data-x]').forEach(el=>{const k=el.dataset.x;el.addEventListener(el.type==='checkbox'||el.tagName==='SELECT'?'change':'input',()=>{f[k]=el.type==='checkbox'?el.checked:el.value;f.shown='';if(k==='corrupted')row.querySelector('[data-x-opts]').hidden=!f.corrupted})});
      row.querySelector('[data-x-preview]').onclick=()=>{f.seed=(f.seed||0)+1;f.shown=corruptText(f.content,f.level,`${f.id}:${f.seed}`);const out=row.querySelector('[data-x-out]');out.textContent=f.shown||'(arquivo vazio)';out.hidden=false};
      row.querySelector('[data-x-remove]').onclick=()=>{draftExtraFiles.splice(i,1);renderExtraList()}})};
  const buildExtraPayload=()=>draftExtraFiles.filter(f=>String(f.name||'').trim()||String(f.content||'').trim()).slice(0,12).map(f=>{const level=normalizeLevel(f.level),corrupted=!!f.corrupted;return{id:String(f.id),name:String(f.name||'').trim().slice(0,120),folder:f.folder,content:String(f.content||'').slice(0,20000),corrupted,level,shown:corrupted?(f.shown||corruptText(f.content,level,`${f.id}:${f.seed||0}`)):''}});
  const buildMainCorruption=id=>{const corrupted=document.getElementById('spMainCorrupt').checked,level=normalizeLevel(document.getElementById('spMainCorruptLevel').value);return{corrupted,level,shown:corrupted?corruptText(document.getElementById('spFileContent').value,level,`${id}:main:${mainSeed}`):''}};
  const renderAudioList=()=>{const box=document.getElementById('spAudioList');if(!box)return;box.innerHTML=draftAudioFiles.length?draftAudioFiles.map((a,i)=>`<div class="session-puzzle-audio-item"><span>♫</span><span><b>${esc(a.name||`Gravação ${i+1}`)}</b><small>${Math.max(1,Math.round((Number(a.size)||0)/1024))} KB</small></span><button type="button" class="btn small danger" data-remove-sp-audio="${i}">Remover</button><div class="sp-audio-corrupt"><label class="row"><input type="checkbox" data-sp-audio-corrupt="${i}"${a.corrupted?' checked':''}> Corrompida</label><select data-sp-audio-mode="${i}"${a.corrupted?'':' disabled'}><option value="glitch"${a.corruptMode!=='dead'?' selected':''}>Com falhas (toca distorcida)</option><option value="dead"${a.corruptMode==='dead'?' selected':''}>Ilegível (não toca)</option></select></div></div>`).join(''):'<span class="tiny muted">Nenhuma gravação anexada.</span>';box.querySelectorAll('[data-remove-sp-audio]').forEach(b=>b.onclick=()=>{draftAudioFiles.splice(Number(b.dataset.removeSpAudio),1);renderAudioList()});box.querySelectorAll('[data-sp-audio-corrupt]').forEach(c=>c.onchange=()=>{const a=draftAudioFiles[Number(c.dataset.spAudioCorrupt)];if(!a)return;a.corrupted=c.checked;a.corruptMode=a.corruptMode==='dead'?'dead':'glitch';renderAudioList()});box.querySelectorAll('[data-sp-audio-mode]').forEach(m=>m.onchange=()=>{const a=draftAudioFiles[Number(m.dataset.spAudioMode)];if(a)a.corruptMode=m.value==='dead'?'dead':'glitch'})};
  const formMarkup=()=>`<div class="session-puzzle-editor"><input id="spId" type="hidden"><div class="field"><label>Nome do arquivo / puzzle</label><input id="spTitle" maxlength="160" placeholder="Ex.: Registro de entrada — subsolo" required></div><div class="field"><label>Nome do terminal</label><input id="spTerminal" maxlength="100" value="TERMINAL RESTRITO" placeholder="Ex.: SISTEMA DA MANSÃO"></div><div class="field"><label>Enunciado visível aos jogadores</label><textarea id="spPrompt" rows="4" maxlength="6000" placeholder="O que aparece na tela antes do login?" required></textarea></div><div class="field"><label>Pista opcional visível aos jogadores</label><textarea id="spHint" rows="2" maxlength="2000" placeholder="Dica que eles podem consultar no terminal"></textarea></div><div class="session-puzzle-credentials"><div class="field"><label>Login correto</label><input id="spLogin" maxlength="160" placeholder="Credencial de ficção" required></div><div class="field"><label>Senha (obrigatória em novos; em edição, vazio mantém a atual)</label><input id="spPassword" type="password" maxlength="128" autocomplete="new-password" placeholder="Senha que os jogadores precisam descobrir"></div></div><div class="field"><label>Título do arquivo após desbloquear</label><input id="spFileTitle" maxlength="180" placeholder="Ex.: Relatório 04-B" required></div><div class="field"><label>Conteúdo secreto do arquivo</label><textarea id="spFileContent" rows="8" maxlength="30000" placeholder="Texto, registros, nomes, datas, revelações…" required></textarea><small class="tiny muted">O conteúdo é entregue pelo servidor só depois da validação das credenciais.</small></div><div class="field sp-corrupt-box"><label class="row"><input type="checkbox" id="spMainCorrupt"> Exibir o arquivo principal como corrompido</label><div class="row"><select id="spMainCorruptLevel">${CORRUPTION_LEVELS.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select><button type="button" class="btn small" id="spMainCorruptPreview">Pré-visualizar / sortear de novo</button></div><pre class="sp-corrupt-preview" id="spMainCorruptOut" hidden></pre><small class="tiny muted">Os jogadores recebem só a versão corrompida: o texto original não sai do servidor.</small></div><div class="field"><label>Arquivos adicionais do terminal</label><p class="tiny muted">Até 12 arquivos de texto. Cada um fica numa pasta e pode ser marcado como corrompido (leve, grave ou total).</p><div id="spExtraList"></div><button type="button" class="btn small" id="spAddExtra">+ Adicionar arquivo</button></div><div class="field session-puzzle-audio-field"><label>Gravações de áudio recuperáveis</label><p class="tiny muted">Até 3 áudios por terminal, com até 750 KB cada. Os áudios só são enviados ao jogador depois do login correto.</p><input id="spAudioUpload" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"><div id="spAudioList" class="session-puzzle-audio-list"><span class="tiny muted">Nenhuma gravação anexada.</span></div></div><label class="row session-puzzle-active"><input type="checkbox" id="spActive" checked> Terminal ativo e visível aos jogadores</label><div class="row session-puzzle-editor-actions"><button type="button" class="btn" id="spClear">Novo puzzle / limpar</button><button type="button" class="btn primary" id="spSave">Salvar terminal</button></div></div>`;
  const listMarkup=()=>puzzles.length?puzzles.map((p,i)=>`<article class="session-puzzle-admin-row"><div><span class="section-kicker">${p.active?'ATIVO':'DESATIVADO'} · ${p.hasPassword?'CREDENCIAL DEFINIDA':'SEM SENHA'}</span><h3>${esc(p.title)}</h3><p>${esc(p.terminalLabel||'TERMINAL OFFLINE')} · ${esc(p.loginName||'Sem login')}${Array.isArray(p.extraFiles)&&p.extraFiles.length?` · ${p.extraFiles.length} arquivo(s) extra(s)`:''}${(()=>{const n=(p.fileCorruption?.corrupted?1:0)+(Array.isArray(p.extraFiles)?p.extraFiles.filter(f=>f.corrupted).length:0)+(Array.isArray(p.audioFiles)?p.audioFiles.filter(a=>a.corrupted).length:0);return n?` · ${n} corrompido(s)`:''})()}</p></div><div class="row"><button type="button" class="btn small" data-edit-session-puzzle="${i}">Editar</button><button type="button" class="btn small danger" data-delete-session-puzzle="${esc(p.id)}">Excluir</button></div></article>`).join(''):'<div class="empty">Nenhum puzzle nesta sessão. Crie o primeiro terminal abaixo.</div>';
  openModal(`<div class="modal" id="sessionPuzzleManagerModal"><div class="modal-card session-puzzle-manager-modal"><button type="button" class="modal-close" id="closeSessionPuzzleManager">×</button><span class="badge">CENTRAL DE PUZZLES</span><h2>Terminais e arquivos bloqueados</h2><p class="small muted">As credenciais são guardadas como hash no banco. O login esperado e o arquivo secreto nunca são enviados no pacote global compartilhado.</p><div class="session-puzzle-list" id="sessionPuzzleList">${listMarkup()}</div><div class="divider"></div><div class="section-heading"><div><span class="section-kicker">EDITOR</span><h3>Configuração do terminal</h3></div></div>${formMarkup()}</div></div>`);
  const close=()=>document.getElementById('sessionPuzzleManagerModal')?.remove();document.getElementById('closeSessionPuzzleManager').onclick=close;
  const clear=()=>{draftAudioFiles=[];draftExtraFiles=[];mainSeed=0;renderAudioList();renderExtraList();document.getElementById('spMainCorrupt').checked=false;document.getElementById('spMainCorruptLevel').value='partial';document.getElementById('spMainCorruptOut').hidden=true;document.getElementById('spAudioUpload').value='';document.getElementById('spId').value='';document.getElementById('spTitle').value='';document.getElementById('spTerminal').value='TERMINAL RESTRITO';document.getElementById('spPrompt').value='';document.getElementById('spHint').value='';document.getElementById('spLogin').value='';document.getElementById('spPassword').value='';document.getElementById('spFileTitle').value='';document.getElementById('spFileContent').value='';document.getElementById('spActive').checked=true;document.getElementById('spSave').textContent='Criar terminal'};
  const fill=row=>{draftAudioFiles=Array.isArray(row.audioFiles)?row.audioFiles.map(a=>({...a})):[];draftExtraFiles=Array.isArray(row.extraFiles)?row.extraFiles.map(f=>({id:String(f.id||cryptoRandomId('file')),name:String(f.name||''),folder:f.folder||'evidence',content:String(f.content||''),corrupted:!!f.corrupted,level:normalizeLevel(f.level),shown:String(f.shown||''),seed:0})):[];mainSeed=0;renderAudioList();renderExtraList();document.getElementById('spMainCorrupt').checked=!!row.fileCorruption?.corrupted;document.getElementById('spMainCorruptLevel').value=normalizeLevel(row.fileCorruption?.level);document.getElementById('spMainCorruptOut').hidden=true;document.getElementById('spAudioUpload').value='';document.getElementById('spId').value=row.id;document.getElementById('spTitle').value=row.title||'';document.getElementById('spTerminal').value=row.terminalLabel||'TERMINAL RESTRITO';document.getElementById('spPrompt').value=row.prompt||'';document.getElementById('spHint').value=row.hint||'';document.getElementById('spLogin').value=row.loginName||'';document.getElementById('spPassword').value='';document.getElementById('spFileTitle').value=row.fileTitle||'';document.getElementById('spFileContent').value=row.fileContent||'';document.getElementById('spActive').checked=row.active!==false;document.getElementById('spSave').textContent='Salvar alterações';document.getElementById('spTitle').focus()};
  const bindList=()=>{document.querySelectorAll('[data-edit-session-puzzle]').forEach(b=>b.onclick=()=>{const row=puzzles[Number(b.dataset.editSessionPuzzle)];if(row)fill(row)});document.querySelectorAll('[data-delete-session-puzzle]').forEach(b=>b.onclick=async()=>{const id=b.dataset.deleteSessionPuzzle;if(!confirm('Excluir este terminal e suas tentativas registradas?'))return;try{await deleteSessionPuzzle(sid,id);puzzles=puzzles.filter(x=>String(x.id)!==String(id));document.getElementById('sessionPuzzleList').innerHTML=listMarkup();bindList();clear();toast('Terminal removido.')}catch(err){toast(puzzleRpcErrorText(err))}})};
  document.getElementById('spClear').onclick=clear;
  document.getElementById('spAddExtra').onclick=()=>{if(draftExtraFiles.length>=12){toast('Máximo de 12 arquivos adicionais.');return}draftExtraFiles.push({id:cryptoRandomId('file'),name:'',folder:'evidence',content:'',corrupted:false,level:'partial',shown:'',seed:0});renderExtraList()};
  document.getElementById('spMainCorruptPreview').onclick=()=>{mainSeed++;const level=normalizeLevel(document.getElementById('spMainCorruptLevel').value),out=document.getElementById('spMainCorruptOut');out.textContent=corruptText(document.getElementById('spFileContent').value,level,`${document.getElementById('spId').value||'novo'}:main:${mainSeed}`)||'(arquivo vazio)';out.hidden=false;document.getElementById('spMainCorrupt').checked=true};
  document.getElementById('spAudioUpload').addEventListener('change',async ev=>{const input=ev.currentTarget;const file=input.files?.[0];if(!file)return;input.value='';if(!String(file.type||'').startsWith('audio/')){toast('Escolha um arquivo de áudio válido.');return}if(file.size>750*1024){toast('Cada gravação deve ter no máximo 750 KB.');return}if(draftAudioFiles.length>=3){toast('Este terminal já tem o máximo de 3 gravações.');return}try{const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Não foi possível ler o áudio.'));reader.readAsDataURL(file)});draftAudioFiles.push({name:String(file.name||'Gravação').slice(0,180),type:String(file.type||'audio/mpeg').slice(0,80),size:file.size,dataUrl});renderAudioList()}catch(err){toast('Não foi possível carregar esta gravação.')}});
  document.getElementById('spSave').onclick=async()=>{const btn=document.getElementById('spSave');const data={id:document.getElementById('spId').value||cryptoRandomId('puzzle'),title:document.getElementById('spTitle').value.trim(),terminalLabel:document.getElementById('spTerminal').value.trim()||'TERMINAL RESTRITO',prompt:document.getElementById('spPrompt').value.trim(),hint:document.getElementById('spHint').value.trim(),loginName:document.getElementById('spLogin').value.trim(),password:document.getElementById('spPassword').value,fileTitle:document.getElementById('spFileTitle').value.trim()||'Arquivo recuperado',fileContent:document.getElementById('spFileContent').value,audioFiles:draftAudioFiles,active:document.getElementById('spActive').checked,extraFiles:buildExtraPayload()};data.fileCorruption=buildMainCorruption(data.id);if(data.extraFiles.length>12||data.extraFiles.some(f=>!f.name)){toast('Use no máximo 12 arquivos adicionais e dê um nome a cada arquivo.');return}if(data.audioFiles.length>3||data.audioFiles.some(a=>!String(a.type||'').startsWith('audio/')||Number(a.size)>750*1024)){toast('Cada terminal aceita até 3 áudios válidos de no máximo 750 KB.');return}if(JSON.stringify(data.audioFiles).length>3200000||JSON.stringify(data.extraFiles).length>550000){toast('Os anexos excedem o limite seguro de tamanho deste terminal. Reduza os arquivos e tente novamente.');return}if(!data.title||!data.prompt||!data.loginName||!data.fileContent.trim()){toast('Preencha nome, enunciado, login correto e conteúdo secreto.');return}if(!document.getElementById('spId').value&&!data.password){toast('Defina a senha que os jogadores precisarão descobrir.');return}const savingSessionId=String(state.combatSession?.sessionId||'');if(savingSessionId!==sid){toast('A sessão mudou. Reabra o gerenciador de terminais antes de salvar.');return}btn.disabled=true;btn.textContent='Salvando…';try{await saveSessionPuzzle(sid,data);if(String(state.combatSession?.sessionId||'')!==sid)throw new Error('SESSAO_PUZZLE_EXPIRADA');const rows=await listSessionPuzzles(sid);const refreshed=Array.isArray(rows)?rows:[];const savedRow=refreshed.find(x=>String(x.id)===String(data.id));if(!savedRow)throw new Error('PUZZLE_SAVE_NOT_CONFIRMED');puzzles=refreshed;const needsMigration=!Array.isArray(savedRow.extraFiles)&&(data.extraFiles.length||data.fileCorruption.corrupted||data.audioFiles.some(a=>a.corrupted));document.getElementById('sessionPuzzleList').innerHTML=listMarkup();bindList();clear();toast(needsMigration?'Terminal salvo, mas os anexos/corrupções não foram confirmados. Aplique a migração de reparo de puzzles e tente novamente.':'Terminal salvo e confirmado no servidor.')}catch(err){console.warn('Puzzle save failed:',err);toast(err?.message==='PUZZLE_SAVE_NOT_CONFIRMED'?'O servidor não confirmou o terminal na releitura. Seus dados continuam no editor; tente novamente.':puzzleRpcErrorText(err))}finally{btn.disabled=false;btn.textContent=document.getElementById('spId').value?'Salvar alterações':'Salvar terminal'}};
  bindList();
}
async function openSessionMasterNotes(){
  if(state.session?.role!=='master'){toast('Somente o Mestre pode consultar essas notas.');return}
  const sid=String(state.combatSession?.sessionId||'');if(!sid){toast('Crie ou carregue uma sessão antes de registrar segredos.');return}
  let notes='';try{const data=await getSessionMasterNotes(sid);notes=String(data?.notes||'')}catch(err){toast(puzzleRpcErrorText(err));return}
  openModal(`<div class="modal" id="sessionMasterNotesModal"><div class="modal-card session-master-notes-modal"><button class="modal-close" id="closeSessionMasterNotes">×</button><span class="badge">CONFIDENCIAL · SOMENTE MESTRE</span><h2>Segredos da sessão</h2><p class="small muted">Notas narrativas privadas. O servidor valida a permissão de Mestre; este conteúdo não vai para o estado global visível aos jogadores.</p><textarea id="sessionMasterNotesText" rows="16" maxlength="30000" placeholder="Motivações ocultas, solução real do mistério, gatilhos de cena, consequências e revelações…">${esc(notes)}</textarea><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="cancelSessionMasterNotes">Fechar</button><button class="btn danger" id="saveSessionMasterNotes">Guardar segredo</button></div></div></div>`);
  const close=()=>document.getElementById('sessionMasterNotesModal')?.remove();document.getElementById('closeSessionMasterNotes').onclick=close;document.getElementById('cancelSessionMasterNotes').onclick=close;
  document.getElementById('saveSessionMasterNotes').onclick=async()=>{const btn=document.getElementById('saveSessionMasterNotes');btn.disabled=true;try{await saveSessionMasterNotes(sid,document.getElementById('sessionMasterNotesText')?.value||'');toast('Segredos do Mestre salvos de forma privada.');close()}catch(err){toast(puzzleRpcErrorText(err))}finally{btn.disabled=false}};
}

function masterHomeControl(){
  return combatMasterHome();
}

function home(){
 const master=state.session.role==='master',p=player();
 if(master)return masterHomeControl();
 syncDerivedResources(p);
 const combatBanner=state.combatSession?.active?`<section class="player-combat-banner">${sessionDiamondCard(p,{controls:true,big:true})}</section>`:'';
 const trained=[...new Set(allSkills().filter(sk=>(effectiveSkill(p,sk)||0)>0))];
 const wallpaperUrl=safeCssImageUrl(p?.homeWallpaper);const wallpaper=wallpaperUrl?` style="--player-wallpaper:url('${wallpaperUrl}')"`:'';const themes=Array.isArray(p?.musicThemes)?p.musicThemes:[];return shell(`<section class="op-home-sheet player-personalized"${wallpaper}><div class="op-topline"><div><span class="badge">DOSSIÊ DE SOBREVIVÊNCIA</span><h1>${esc(p?.name||'Player')}</h1><p>${esc(p?.class||'Classe não escolhida')} • ${esc(p?.status||'Ativo')}</p></div><div class="op-resource-strip horror-home-bars">${determinationBadge(p,true)}${resourceBarMarkup('Vida',p?.hp||0,derivedMax(p,'Corpo'),'health',false)}${resourceBarMarkup('Sanidade',p?.sanity||0,derivedMax(p,'Sanidade'),'sanity',false)}</div></div>${combatBanner}<div class="op-dossier-grid"><section class="op-attributes"><div class="section-heading"><div><span class="section-kicker">ATRIBUTOS REGISTRADOS</span><h2>Condição do portador</h2></div><span class="corner-mark">SOMENTE LEITURA</span></div><div class="op-attr-list">${ATTRS.map(a=>`<div class="op-attr-row"><span class="op-attr-symbol">${uiAttrIcon(a)}</span><span>${esc(a)}</span><b>${effectiveAttr(p,a)}</b></div>`).join('')}</div></section><section class="op-trained"><div class="section-heading"><div><span class="section-kicker">PERÍCIAS DOMINADAS</span><h2>O que o corpo aprendeu</h2></div><span class="corner-mark">${trained.length}</span></div><div class="op-trained-list">${trained.length?trained.map(sk=>`<div class="op-skill-row"><span>${uiSkillIcon(sk)} ${esc(sk)}</span><b>${effectiveSkill(p,sk)}</b></div>`).join(''):'<div class="empty">Nenhuma perícia foi registrada neste arquivo.</div>'}</div></section><aside class="op-profile"><div class="op-portrait-frame"><img src="${esc(p?.photo||'ritual.webp')}" alt="Retrato do personagem"><span class="portrait-mark">✦</span></div><div><span class="section-kicker">REGISTRO</span><h2>${esc(p?.class||'Sem classe')}</h2><p>Uma leitura rápida do que ainda resta do portador antes que a próxima noite comece.</p></div></aside></div><div class="op-home-actions"><button class="btn primary" data-nav="sheet">Abrir dossiê completo</button><button class="btn gold" data-open-secret-clues>Fragmentos ocultos</button><button class="btn gold" data-nav="classes">${classChosen(p)?'Consultar Classes':'Escolher Classe'}</button></div></section><section class="home-player-themes"><div class="section-heading"><div><span class="section-kicker">CANÇÕES DO FIM</span><h2>A trilha que acompanha o portador</h2></div></div><div class="home-theme-grid">${themes.length?themes.map((t,i)=>`<div class="home-theme-card"><span>${esc(t.label)}</span><strong>${esc(t.title)}</strong><div class="row"><button type="button" class="btn small gold" data-play-theme="${i}">▶ Tocar</button><button type="button" class="btn small" data-pause-theme="${i}">Ⅱ</button><button type="button" class="btn small" data-stop-theme="${i}">■</button><a class="btn small" href="${esc(safeHref(t.url))}" target="_blank" rel="noopener">Abrir ↗</a></div></div>`).join(''):'<div class="empty">Nenhuma melodia foi guardada neste arquivo.</div>'}</div></section>${spotifyHomePanel()}<section class="immersive-cta"><button type="button" class="btn curtain-btn" data-enter-immersive>${CURTAIN_SVG}<span>Entrar em modo sessão</span></button><small>Atravesse o véu para a sessão: recursos, pertences, registros e habilidades estarão ao alcance durante a noite.</small></section>`,'home')}

function classesPage(){
 const p=player();
 const chosen=classChosen(p);
 const isSlasher=p?.campaignType==='slasher';
 const visibleEntries=Object.entries(CLASSES).filter(([n,c])=>isSlasher?!!c.slasher:!c.slasher);
 const intro=(()=>{
   if(!isSlasher)return '';
   const religion=p?.slasherReligion||'';
   const belief=p?.slasherBelief||'';
   const music=state.slasherIntroMusic?.url;
   return `<section class="slasher-origin-card ${religion?'answered':''}">
     <div class="slasher-origin-kicker">ANTES DE ESCOLHER SUA PROFISSÃO</div>
     <h2>O que seu personagem acredita?</h2>
     <p>Responda às perguntas abaixo. Elas fazem parte da criação da ficha Slasher.</p>
     <div class="slasher-question">
       <span>Seu personagem é religioso?</span>
       <div class="slasher-options">
         <button type="button" class="slasher-option ${religion==='yes'?'selected':''}" data-slasher-religion="yes">Sim</button>
         <button type="button" class="slasher-option ${religion==='no'?'selected':''}" data-slasher-religion="no">Não</button>
       </div>
     </div>
     ${religion==='yes'?`<div class="slasher-question slasher-question-secondary">
       <span>Seu personagem é assumidamente religioso pra um Deus só ou seu personagem só aproveita dos deuses pra benefício próprio?</span>
       <div class="slasher-options">
         <button type="button" class="slasher-option ${belief==='only-self'?'selected':''}" data-slasher-belief="only-self">Só se aproveita</button>
         <button type="button" class="slasher-option ${belief==='occult'?'selected':''}" data-slasher-belief="occult">gosta de ocultismo</button>
         <button type="button" class="slasher-option ${belief==='one-god'?'selected':''}" data-slasher-belief="one-god">apenas um deus</button>
       </div>
     </div>`:''}
     ${music?`<div class="slasher-intro-music"><span>TRILHA</span><strong>${esc(state.slasherIntroMusic.title||'Trilha do Slasher')}</strong><audio controls preload="none" src="${esc(music)}"></audio></div>`:''}
   </section>`;
 })();
 const canChoose=!!p && (!isSlasher || (p.slasherReligion==='no' || (p.slasherReligion==='yes' && p.slasherBelief)));
 return shell(`<section class="classes-hero ${isSlasher?'slasher-classes-hero':''}"><div class="classes-hero-copy"><span class="badge">${isSlasher?'SLASHER':'CAMINHOS'}</span><h1>${isSlasher?'Profissões':'Classes'}</h1><p>${chosen?'Seu caminho já foi escolhido. O destino não pode ser alterado depois da confirmação.':isSlasher?'Escolha uma profissão. Conhecimento e experiência ajudam a sobreviver, mas nenhuma profissão torna alguém invencível.':'Escolha com cuidado. A classe pode ser escolhida apenas uma vez e os bônus serão gravados na ficha.'}</p><div class="destiny-phrase ${chosen?'show':''}" id="destinyPhrase">${chosen?'Seu destino está selado':'Seu destino aguarda'}</div></div></section>${intro}<div class="class-book-grid ${isSlasher?'slasher-profession-grid':''}">${visibleEntries.map(([n,c])=>`<article class="class-book-card ${c.slasher?'slasher-profession-card':''} ${chosen&&p.class===n?'chosen-class':''} ${chosen&&p.class!==n?'locked-class':''} ${!canChoose?'class-choice-disabled':''}" data-class-choice="${esc(n)}"><div class="class-card-ornament">${chosen&&p.class===n?'✦':'◇'}</div><div class="class-card-head"><h2>${esc(n)}</h2>${c.slasher?'<span class="badge">SLASHER</span>':hasMagicClass(n)?'<span class="badge">MAGIA / RITUAL</span>':''}</div><p>${esc(c.desc)}</p><div class="class-bonus-line"><strong>Bônus</strong><span>${esc(c.bonus)}</span></div><div class="ability-list">${c.abilities.map(a=>`<div class="ability"><b>${esc(a[0])}</b><div class="small muted">${esc(a[1])}</div></div>`).join('')}</div>${chosen&&p.class===n?'<div class="class-choice-seal">CLASSE ESCOLHIDA</div>':''}</article>`).join('')}</div>`,`classes`)
}
function resourceState(value,max){return value<=0?'empty':value<=max*.2?'critical':'stable'}
function resourceStateLabel(type,st){return st==='empty'?(type==='sanity'?'MENTE VAZIA':'CAÍDO'):st==='critical'?'CRÍTICO':'ESTÁVEL'}
function resourceBarMarkup(label,current,max,type,editable=true){const safeMax=Math.max(1,Number(max)||1),value=clamp(current,0,safeMax),pct=Math.max(0,Math.min(100,(value/safeMax)*100));const cls=type==='sanity'?'sanity-bar':'blood-bar';return `<div class="horror-resource ${cls}" data-resource-bar="${esc(type)}" data-value="${value}" data-state="${resourceState(value,safeMax)}"><div class="horror-resource-head"><span>${type==='sanity'?'SANIDADE':'VIDA'}</span><strong>${value}<small> / ${safeMax}</small></strong></div><div class="horror-bar-track"><div class="horror-bar-fill" style="width:${pct}%"><i class="drip drip-a"></i><i class="drip drip-b"></i><i class="drip drip-c"></i></div><div class="horror-bar-gloss"></div></div>${editable?`<div class="horror-resource-input"><input data-resource-input="${esc(type)}" type="number" min="0" max="${safeMax}" value="${value}" aria-label="${type}"></div>`:''}<div class="horror-resource-foot"><span>${Math.round(pct)}%</span><span>${resourceStateLabel(type,resourceState(value,safeMax))}</span></div></div>`}
function hpFields(e,editable=true){const dis=editable?'':'disabled';const hpMax=derivedMax(e,'Corpo')||1;const sanityMax=derivedMax(e,'Sanidade');const hp=clamp(e.hp??hpMax,0,hpMax);const sanity=clamp(e.sanity??sanityMax,0,sanityMax);return `<div class="horror-resource-grid">${resourceBarMarkup('Vida',hp,hpMax,'health',editable)}${resourceBarMarkup('Sanidade',sanity,sanityMax,'sanity',editable)}</div><div class="input-grid resource-grid-compact">${combatBoxes(e,dis)}<input id="hp" type="hidden" value="${hp}"><input id="sanity" type="hidden" value="${sanity}"></div><p class="resource-rule">A barra acompanha a porcentagem exata do recurso. Ao perder Vida, a animação de sangue escorre para baixo antes de a nova porcentagem ficar estável.</p>`}

function playerTurnAlertMarkup(p){
  const cfg=p.turnAlertSound||{url:'',name:'',enabled:false};
  return `<article class="sheet-card character-turn-alert"><div class="section-heading"><div><span class="section-kicker">ALERTA DE VEZ</span><h2>Avisos de vez e de dano</h2></div></div><p class="muted small">O celular vibra e toca um sinal quando for a sua vez, quando você for o próximo e quando perder vida. Só vale para quem está na sessão do Mestre. Se quiser, escolha um som seu: um arquivo de áudio ou uma URL direta.</p><label class="checkline"><input id="turnVibrateEnabled" type="checkbox" ${cfg.vibrateOff?'':'checked'}> Vibrar quando chegar a minha vez (Android)</label><label class="checkline"><input id="turnChimeEnabled" type="checkbox" ${cfg.chimeOff?'':'checked'}> Tocar o sinal padrão (quando eu não escolher um som próprio)</label><label class="checkline"><input id="turnAlertEnabled" type="checkbox" ${cfg.enabled?'checked':''}> Usar meu próprio som</label><div class="theme-add-grid"><input id="turnAlertUrl" placeholder="URL direta de um som (.mp3/.ogg/.wav)" value="${esc(cfg.url&&!cfg.name?cfg.url:'')}"><label class="upload-label">Enviar som<input id="turnAlertFile" type="file" accept="audio/*" hidden></label><button class="btn" id="testTurnAlert">Testar som</button>${cfg.url?'<button class="btn danger" id="clearTurnAlert">Remover</button>':''}</div>${cfg.name?`<p class="small muted">Som atual: ${esc(cfg.name)}</p>`:''}</article>`;
}
function sheetInternal(){const p=player();if(!p)return shell('<div class="empty">Player não encontrado.</div>','sheet');syncDerivedResources(p);const draft=activeSheetDraft(p)||{};const draftAttrs={...p.attrs,...(draft.attrs||{})};const draftSkills={...p.skills,...(draft.skills||{})};const last=p.rolls?.[p.rolls.length-1];const hpMax=derivedMax(p,'Corpo')||1;const sanityMax=derivedMax(p,'Sanidade');const bonus=classBonusMap(p.class);const chosen=classChosen(p);const currentClass=CLASSES[p.class]||{desc:'Escolha uma classe para revelar suas habilidades e bônus.',bonus:'—',abilities:[]};return shell(`<section class="profile-header has-det">${determinationBadge(p,true)}<div><span class="badge">DOSSIÊ DO PORTADOR</span><h1>${esc(p.name)}</h1><p>${esc(p.class||'Classe não escolhida')} <span class="sep">•</span> ${esc(p.status)}</p><div class="destiny-phrase" id="destinyPhrase">Seu destino está selado</div></div><div class="profile-seal"><img src="/runa-gold.png" alt=""></div></section>${state.combatSession?.active?`<section class="sess-strip">${sessionDiamondCard(p,{controls:true})}</section>`:''}<div class="sheet-layout"><section class="sheet-main"><article class="sheet-card character-card"><div class="character-portrait"><img class="photo" id="charPhoto" src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt="Retrato"><label class="upload-label">Substituir retrato<input id="photoInput" type="file" accept="image/png,image/jpeg,image/webp,.jfif" hidden></label></div><div class="character-info"><div class="eyebrow">IDENTIDADE EXTRAÍDA</div><div class="field-inline"><label>Nome registrado</label><input id="pName" value="${esc(p.name)}"></div><div class="field-inline"><label>Classe</label><div class="class-lock-field">${chosen?`<strong>${esc(p.class)}</strong><span>Escolha já selada</span>`:`<select id="pClass"><option value="">Escolha sua classe</option>${Object.entries(CLASSES).filter(([c,v])=>p.campaignType==='slasher'?!!v.slasher:!v.slasher).map(([c])=>`<option ${p.class===c?'selected':''}>${esc(c)}</option>`).join('')}</select>`}</div></div><div class="small-stat-row"><div><span>SANGUE RESTANTE</span><strong>${clamp(p.hp??hpMax,0,hpMax)} / ${hpMax}</strong></div><div><span>SANIDADE RESTANTE</span><strong>${clamp(p.sanity??sanityMax,0,sanityMax)} / ${sanityMax}</strong></div><div><span>PONTOS EXTRAS</span><strong>${p.extra||0}</strong></div></div><div class="class-bonus-summary"><span>DÁDIVAS DA CLASSE</span><strong>${esc(classBonusText(p.class))}</strong></div><button class="btn primary" id="saveIdentity">Salvar ficha</button><button type="button" class="btn" id="downloadSheetPdf">Imprimir dossiê (PDF)</button></div></article>${playerMusicLibraryMarkup(p)}${playerThemesMarkup(p)}${playerWallpaperMarkup(p)}${playerTurnAlertMarkup(p)}<article class="sheet-card resources-card"><div class="section-heading"><div><span class="section-kicker">SINAIS VITAIS</span><h2>O estado do corpo e da mente</h2></div></div>${hpFields(p,true)}</article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">PROGRESSO DO PORTADOR</span><h2>Pontos ainda disponíveis</h2></div></div><div class="point-summary-grid"><div class="resource-box"><span>ATRIBUTOS</span><strong>${allocationTotals(p).attrs} / ${Number(characterRules(p.campaignType).attrPoints)+(Number(p.attrBonusPoints)||0)}</strong><small>${pointsRemainText(p,'attrs')}</small></div><div class="resource-box"><span>PERÍCIAS</span><strong>${allocationTotals(p).skills} / ${Number(characterRules(p.campaignType).skillPoints)+(Number(p.skillBonusPoints)||0)}</strong><small>${pointsRemainText(p,'skills')}</small></div><div class="resource-box"><span>VIDA TOTAL</span><strong>${hpMax}</strong><small>Calculada pelo Corpo</small></div><div class="resource-box"><span>SANIDADE TOTAL</span><strong>${sanityMax}</strong><small>Calculada pela Sanidade</small></div></div></article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ATRIBUTOS DO PORTADOR</span><h2>Forças e fragilidades</h2></div><span class="corner-mark">${Number(characterRules(p.campaignType).attrPoints)+(Number(p.attrBonusPoints)||0)} pontos totais • <b id="attrRemaining">${pointsRemainText(p,'attrs')}</b></span></div><div class="attribute-grid">${allAttrs().map(a=>{const b=bonus[a]||0;return `<div class="attribute-box pt-row"><span class="attr-icon">${uiAttrIcon(a)}</span><span class="attr-name">${esc(a)}</span>${pointField("pAttr","attr",a,draftAttrs[a],MAX_ATTR)}<span class="attr-cap">/ 8</span>${b?`<small class="attr-bonus">+${Number(b)||0} classe • efetivo ${effectiveAttr(p,a)}</small>`:''}</div>`}).join('')}</div><p class="resource-rule">Corpo e Sanidade determinam automaticamente os limites de Vida e Sanidade. Máximo de 35.</p><button class="btn primary" id="saveAttrs">Salvar atributos</button></article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">PERÍCIAS DOMINADAS</span><h2>Conhecimentos e técnicas</h2><p class="small muted">Distribuídos: ${allocationTotals(p).skills} / ${Number(characterRules(p.campaignType).skillPoints)+(Number(p.skillBonusPoints)||0)} • <strong id="skillRemaining">${pointsRemainText(p,'skills')}</strong></p></div><span class="corner-mark">${Number(characterRules(p.campaignType).skillPoints)+(Number(p.skillBonusPoints)||0)} pontos totais</span></div><div class="skills-groups">${Object.entries({...SKILL_GROUPS,'Personalizadas':customList('skills').map(x=>x.name).filter(Boolean)}).map(([g,items])=>`<div class="skill-group"><div class="skill-group-title">${esc(g)}</div>${items.map(sk=>`<div class="skill-line pt-row"><span class="skill-name"><i class="skill-icon">${uiSkillIcon(sk)}</i><span>${esc(sk)}${classBonusMap(p.class)[sk]?`<small class="skill-bonus">+${classBonusMap(p.class)[sk]} classe • efetivo ${effectiveSkill(p,sk)}</small>`:''}</span></span>${pointField("pSkill","skill",sk,draftSkills[sk],MAX_SKILL)}<b>/15</b></div>`).join('')}</div>`).join('')}</div><button class="btn primary" id="saveSkills">Salvar perícias</button></article><article class="sheet-card dice-section-fixed dice-v2">
<div class="section-heading">
 <div><span class="section-kicker">ORÁCULO DE OSSOS</span><h2>Consulte os ossos</h2></div>
 <span class="dice-type">DADOS</span>
</div>
<div class="dice-v2-layout">
 <div class="dice-skull-wrap">
  <div class="dice-skull-visual" id="diceSkullVisual">
   <img src="/d20-skull.jpg" alt="Símbolo da rolagem">
   <div class="dice-result-overlay">
    <span id="diceResultValue">${last?esc(last.value):'—'}</span>
    <small id="diceResultDie">${esc(last?.die||last?.label||'ESCOLHA UM DADO')}</small>
   </div>
  </div>
 </div>
 <div class="dice-controls">
  <p class="dice-description">Escolha o dado ou use uma expressão como <strong>d10+6</strong>, <strong>2d6</strong> ou <strong>1d20-2</strong>.</p><div class="dice-expression-row"><input id="diceExpression" placeholder="Ex.: d10+6"><button class="btn gold" type="button" id="rollExpression">Rolar expressão</button></div>
  <div class="dice-buttons">
   ${[4,6,8,10,12,20,100].map(d=>`<button type="button" class="dice-choice ${d===20?'featured':''}" data-roll-die="${d}"><b>D${d}</b><span>Rolar</span></button>`).join('')}
  </div>
  <div class="dice-current" id="rollStatus">
   ${last?`Último resultado: <strong>${esc(last.value)}</strong> em ${esc(last.die||last.label||'d20')}`:'Os ossos aguardam. Escolha um dado acima.'}
  </div>
 </div>
</div>
<div class="roll-history dice-history-v2">
 ${(p.rolls||[]).slice().reverse().slice(0,12).map(r=>`<div class="roll-entry" data-roll-id="${esc(r.id||'')}"><strong>${esc(rollDisplayText(r))}</strong><span>${esc(r.die||r.label)}</span><time>${esc(r.time)}</time></div>`).join('')||'<div class="empty">Os ossos ainda não deixaram um registro.</div>'}
</div>
</article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">FERIDAS E MARCAS</span><h2>Condições do portador</h2></div></div><div class="condition-legend">O Mestre registra aqui as marcas que alteram seu estado.</div>${conditionsMarkup(p)}</article>${spellMarkup(p)}<article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">RESÍDUOS DA ALMA</span><h2>Os vínculos que ainda prendem você</h2></div></div><div class="soul-layout"><div class="photo-wrap"><img class="photo soul-photo" id="soulPhoto" src="${esc(safeImgSrc(p.soulPhoto,'/runa-gold.png'))}" alt="Alma"><label class="upload-label">Imagem da alma<input id="soulPhotoInput" type="file" accept="image/png,image/jpeg,image/webp,.jfif" hidden></label></div><div class="text-fields"><div class="field"><label>Fragmento de alma</label><input id="soul" value="${esc(p.soul)}"></div><div class="field"><label>Relíquias afetivas</label><textarea id="belovedObjects" rows="4">${esc(p.belovedObjects)}</textarea></div></div></div><div class="story-grid"><div class="field"><label>Personalidade</label><textarea id="personality" rows="5">${esc(p.personality)}</textarea></div><div class="field"><label>Destino</label><textarea id="destiny" rows="5">${esc(p.destiny)}</textarea></div></div>${p.class==='Ocultista'&&p.deityId&&allDeities().find(d=>d.id===p.deityId)?.image?`<div class="deity-soul-symbol"><img src="${esc(allDeities().find(d=>d.id===p.deityId).image)}" alt="Símbolo do Deus escolhido"></div>`:''}</article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ARQUIVO DE ORIGEM</span><h2>A vida antes da queda</h2></div></div><div class="story-grid"><div class="field"><label>Aparência e presença</label><textarea id="description" rows="6" placeholder="Aparência, presença, voz e detalhes que definem este personagem.">${esc(p.description||'')}</textarea></div><div class="field"><label>Passado e acontecimentos</label><textarea id="history" rows="6" placeholder="Registre os fatos, as perdas e as escolhas que deixaram marcas neste portador.">${esc(p.history||'')}</textarea></div></div><button class="btn primary" id="saveHistory">Salvar origem</button></article><article class="sheet-card notes-card"><div class="section-heading"><div><span class="section-kicker">NOTAS SOB SIGILO</span><h2>O que não deve ser esquecido</h2></div></div><textarea id="playerNotes" rows="6" placeholder="Anotações que somente você verá...">${esc(p.playerNotes||'')}</textarea><p class="tiny muted">Estas anotações não aparecem para o Mestre.</p></article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">MOCHILA</span><h2>${bagCapacity(p)} espaços • peso dinâmico</h2></div></div>${slots(p,true)}</article></section><aside class="sheet-side"><article class="sheet-card sticky-card"><div class="section-heading"><div><span class="section-kicker">CLASSE ATUAL</span><h2>${esc(p.class)}</h2></div></div><p class="muted">${esc(currentClass.desc)}</p><div class="class-bonus-summary"><span>BÔNUS</span><strong>${esc(currentClass.bonus)}</strong></div><div class="ability-list">${[...currentClass.abilities,...customAbilitiesFor(p).map(a=>[a.name,a.description||''])].map(a=>`<div class="ability"><b>${esc(a[0])}</b><div class="small muted">${esc(a[1])}</div></div>`).join('')}</div></article><article class="sheet-card sticky-card"><div class="section-heading"><div><span class="section-kicker">RESUMO</span><h2>Estado atual</h2></div></div><div class="active-conditions">${(p.conditions||[]).map(id=>{const c=conditionById(id);const img=state.uiIcons?.conditions?.[c?.id]||c?.image;return c?`<div class="active-condition">${img?`<img src="${esc(img)}" alt="">`:`<span>${esc(c.icon)}</span>`}<div><b>${esc(c.name)}</b><small>${esc(conditionEffectText(c.id,p))}</small></div></div>`:''}).join('')||'<div class="empty">Nenhuma condição ativa.</div>'}</div></article></aside></div>`,'sheet')}

function slots(p,editable=false){
  const cap=bagCapacity(p),backpack=Array.isArray(p?.backpack)?p.backpack:[];
  const cells=Array.from({length:cap},(_,i)=>{
    const b=backpack[i],it=b&&item(b.id);
    if(!it)return `<div class="slot"><div class="slot-icon" style="opacity:.15">◇</div><div class="small muted">Espaço vazio</div></div>`;
    const qty=Math.max(1,Number(b.qty)||1),w=inferWeight(it);
    const isBook=String(it.category||'').toLowerCase().includes('livro')||!!it.bookContent||(Array.isArray(it.bookPages)&&it.bookPages.length>0);
    return `<div class="slot filled">${editable?`<button type="button" data-remove-slot="${i}">×</button>`:''}<div class="slot-icon">${itemIcon(it)}</div><div class="slot-name">${esc(it.name)}</div>${isWeaponItem(it)?`<div class="slot-damage">⚔️ Dano: ${esc(it.damage||weaponDamageFallback(it))}</div>`:''}${isBook?`<button type="button" class="book-read-btn" data-read-book="${esc(it.id)}">Ler</button>`:''}<div class="slot-id">Peso ${w}</div><div class="slot-qty">Qtd. ${qty} • ${w*qty} espaço${w*qty===1?'':'s'}</div></div>`;
  }).join('');
  return `<div class="slot-grid">${cells}</div>${editable?'<div class="row" style="margin-top:12px"><button type="button" class="btn small" id="addBagItem">Adicionar item</button></div>':''}`;
}
function addBag(p){
  if(!p)return;
  document.getElementById('bagPlayerModal')?.remove();
  const used=bagWeight(p);
  openModal(`<div class="modal" id="bagPlayerModal"><div class="modal-card"><button type="button" class="modal-close" id="closeBagPlayer">×</button><h2>Adicionar à mochila</h2><p class="small ${used>bagCapacity(p)?'danger-text':'muted'}">${used}/${bagCapacity(p)} espaços usados. O peso é por unidade e varia de 1 a 3.</p><div class="searchbar"><div class="field"><label>ID ou nome do item</label><input id="bagPlayerSearch" placeholder="Ex.: 300 ou Chave" autocomplete="off"></div><div class="field"><label>Quantidade</label><input id="bagPlayerQty" type="number" min="1" value="1"></div><button type="button" class="btn primary" id="bagPlayerAdd">Adicionar</button></div></div></div>`);
  const close=()=>document.getElementById('bagPlayerModal')?.remove();
  document.getElementById('closeBagPlayer').onclick=close;
  document.getElementById('bagPlayerAdd').onclick=()=>{
    const q=String(document.getElementById('bagPlayerSearch').value||'').trim().toLowerCase();
    if(!q){toast('Digite o ID ou o nome do item.');return}
    const it=state.items.find(x=>String(x.id)===q||String(x.name||'').toLowerCase().includes(q));
    if(!it){toast('Item não encontrado.');return}
    p.backpack=Array.isArray(p.backpack)?p.backpack:[];
    const qty=Math.max(1,Number(document.getElementById('bagPlayerQty').value)||1),weight=inferWeight(it),used2=bagWeight(p),ex=p.backpack.find(x=>x.id===it.id),current=ex?.qty||0;
    const maxByWeight=Math.floor((bagCapacity(p)-(used2-weight*current))/weight),add=Math.min((Number(it.maxQty)||1)-current,qty,maxByWeight);
    if(add<=0){toast('Não há espaço suficiente.');return}
    if(ex)ex.qty=current+add;else p.backpack.push({id:it.id,qty:add});
    save();close();toast('Item adicionado à mochila.');render('sheet');
  };
  document.getElementById('bagPlayerSearch').focus();
}
function playerSheetFallback(error){
  const p=player();
  if(!p)return shell('<div class="empty">Player não encontrado.</div>','sheet');
  console.error('Falha ao renderizar uma parte da ficha completa:',error);
  const attrs=allAttrs(),skills=allSkills();
  const hpMax=Number(p.hpMax)||derivedMax(p,'Corpo')||1;
  const sanityMax=derivedMax(p,'Sanidade')||1;
  const draft=activeSheetDraft(p)||{};const draftAttrs={...p.attrs,...(draft.attrs||{})};const draftSkills={...p.skills,...(draft.skills||{})};const rolls=Array.isArray(p.rolls)?p.rolls:[];
  const last=rolls[rolls.length-1];
  const backpack=Array.isArray(p.backpack)?p.backpack:[];
  const cap=bagCapacity(p);
  const bagHtml=Array.from({length:cap},(_,i)=>{
    const b=backpack[i],it=b&&item(b.id);
    return `<div class="slot ${it?'filled':''}">${it?`<button type="button" data-remove-slot="${i}">×</button><div class="slot-icon">${itemIcon(it)}</div><div class="slot-name">${esc(it.name)}</div>${isWeaponItem(it)?`<div class="slot-damage">⚔️ Dano: ${esc(it.damage||weaponDamageFallback(it))}</div>`:''}<div class="slot-id">Peso ${inferWeight(it)}</div><div class="slot-qty">Qtd. ${b.qty||1} • ${inferWeight(it)*(b.qty||1)} espaço${inferWeight(it)*(b.qty||1)===1?'':'s'}</div>`:'<div class="slot-icon" style="opacity:.15">◇</div><div class="small muted">Espaço vazio</div>'}</div>`;
  }).join('');
  return shell(`<section class="profile-header"><div><span class="badge">DOSSIÊ DO PORTADOR</span><h1>${esc(p.name||'Ficha')}</h1><p>${esc(p.class||'Classe não escolhida')} <span class="sep">•</span> ${esc(p.status||'Ativo')}</p></div><div class="profile-seal"><img src="runa-gold.png" alt=""></div></section>
  <div class="sheet-layout"><section class="sheet-main">
  <article class="sheet-card character-card"><div class="character-portrait"><img class="photo" id="charPhoto" src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt="Retrato"></div><div class="character-info"><div class="eyebrow">IDENTIDADE EXTRAÍDA</div><div class="field-inline"><label>Nome registrado</label><input id="pName" value="${esc(p.name||'')}" /></div><div class="small-stat-row"><div><span>SANGUE RESTANTE</span><strong>${clamp(p.hp??hpMax,0,hpMax)} / ${hpMax}</strong></div><div><span>SANIDADE RESTANTE</span><strong>${clamp(p.sanity??sanityMax,0,sanityMax)} / ${sanityMax}</strong></div><div><span>ESPAÇOS</span><strong>${cap}</strong></div></div><button class="btn primary" id="saveIdentity">Salvar ficha</button><button type="button" class="btn" id="downloadSheetPdf">Imprimir dossiê (PDF)</button></div></article>
  <article class="sheet-card resources-card"><div class="section-heading"><div><span class="section-kicker">SINAIS VITAIS</span><h2>O estado do corpo e da mente</h2></div></div>${hpFields(p,true)}</article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ATRIBUTOS DO PORTADOR</span><h2>Forças e fragilidades</h2></div><strong id="attrRemaining">${pointsRemainText(p,'attrs')}</strong></div><div class="attribute-grid">${attrs.map(a=>`<div class="attribute-box pt-row"><span class="attr-icon">${uiAttrIcon(a)}</span><span class="attr-name">${esc(a)}</span>${pointField("pAttr","attr",a,draftAttrs?.[a],MAX_ATTR)}<span class="attr-cap">/ 8</span></div>`).join('')}</div><button class="btn primary" id="saveAttrs">Salvar atributos</button></article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">PERÍCIAS DOMINADAS</span><h2>Conhecimentos e técnicas</h2></div><strong id="skillRemaining">${pointsRemainText(p,'skills')}</strong></div><div class="skills-groups"><div class="skill-group">${skills.map(sk=>`<div class="skill-line pt-row"><span class="skill-name"><i class="skill-icon">${uiSkillIcon(sk)}</i><span>${esc(sk)}</span></span>${pointField("pSkill","skill",sk,draftSkills?.[sk],MAX_SKILL)}<b>/15</b></div>`).join('')}</div></div><button class="btn primary" id="saveSkills">Salvar perícias</button></article>
  <article class="sheet-card dice-section-fixed dice-v2"><div class="section-heading"><div><span class="section-kicker">ORÁCULO DE OSSOS</span><h2>Consulte os ossos</h2></div><span class="dice-type">DADOS</span></div><div class="dice-v2-layout"><div class="dice-skull-wrap"><div class="dice-skull-visual" id="diceSkullVisual"><img src="/d20-skull.jpg" alt="Símbolo da rolagem"><div class="dice-result-overlay"><span id="diceResultValue">${last?esc(last.value):'—'}</span><small id="diceResultDie">${esc(last?.die||last?.label||'ESCOLHA UM DADO')}</small></div></div></div><div class="dice-controls"><p class="dice-description">Escolha o dado ou use uma expressão como <strong>d10+6</strong>, <strong>2d6</strong> ou <strong>1d20-2</strong>.</p><div class="dice-expression-row"><input id="diceExpression" placeholder="Ex.: d10+6"><button class="btn gold" type="button" id="rollExpression">Rolar expressão</button></div><div class="dice-buttons">${[4,6,8,10,12,20,100].map(d=>`<button type="button" class="dice-choice ${d===20?'featured':''}" data-roll-die="${d}"><b>D${d}</b><span>Rolar</span></button>`).join('')}</div><div class="dice-current" id="rollStatus">${last?`Último resultado: <strong>${esc(last.value)}</strong> em ${esc(last.die||last.label||'d20')}`:'Os ossos aguardam. Escolha um dado acima.'}</div></div></div><div class="roll-history dice-history-v2">${rolls.slice().reverse().slice(0,12).map(r=>`<div class="roll-entry" data-roll-id="${esc(r.id||'')}"><strong>${esc(rollDisplayText(r))}</strong><span>${esc(r.die||r.label||'d20')}</span><time>${esc(r.time||'')}</time></div>`).join('')||'<div class="empty">Os ossos ainda não deixaram um registro.</div>'}</div></article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">FERIDAS E MARCAS</span><h2>Condições do portador</h2></div></div>${conditionsMarkup(p)}</article>
  ${spellMarkup(p)}
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">RESÍDUOS DA ALMA</span><h2>Os vínculos que ainda prendem você</h2></div></div><div class="field"><label>Fragmento de alma</label><input id="soul" value="${esc(p.soul||'')}"></div><div class="field"><label>Relíquias afetivas</label><textarea id="belovedObjects" rows="4">${esc(p.belovedObjects||'')}</textarea></div><div class="story-grid"><div class="field"><label>Personalidade</label><textarea id="personality" rows="5">${esc(p.personality||'')}</textarea></div><div class="field"><label>Destino</label><textarea id="destiny" rows="5">${esc(p.destiny||'')}</textarea></div></div></article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ARQUIVO DE ORIGEM</span><h2>A vida antes da queda</h2></div></div><div class="story-grid"><div class="field"><label>Aparência e presença</label><textarea id="description" rows="6">${esc(p.description||'')}</textarea></div><div class="field"><label>Passado e acontecimentos</label><textarea id="history" rows="6">${esc(p.history||'')}</textarea></div></div><button class="btn primary" id="saveHistory">Salvar origem</button></article>
  <article class="sheet-card notes-card"><div class="section-heading"><div><span class="section-kicker">NOTAS SOB SIGILO</span><h2>O que não deve ser esquecido</h2></div></div><textarea id="playerNotes" rows="6">${esc(p.playerNotes||'')}</textarea></article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">PERTENCES RECUPERADOS</span><h2>${cap} espaços • carga contabilizada</h2></div></div><div class="slot-grid">${bagHtml}</div><div class="row" style="margin-top:12px"><button class="btn small" id="addBagItem">Registrar pertence</button></div></article>
  </section><aside class="sheet-side"><article class="sheet-card sticky-card"><div class="section-heading"><div><span class="section-kicker">CLASSE SELADA</span><h2>${esc(p.class||'Não escolhida')}</h2></div></div><p class="muted">Os registros essenciais permanecem acessíveis enquanto este dossiê é recuperado.</p></article></aside></div>`,'sheet');
}
function sheet(){
  try{return sheetInternal();}
  catch(error){return playerSheetFallback(error)}
}

function defaultNexus(){return {active:false,title:'Nexus Tabletop',url:'',updatedAt:0}}
let nexusLocalStream=null,nexusRemoteStream=null,nexusStopping=false,nexusMasterPeers=new Map(),nexusPlayerPc=null,nexusPeerId=`peer-${Math.random().toString(36).slice(2)}-${Date.now()}`,nexusMasterPeerId='';
function nexusIsMaster(){return state.session?.role==='master'}
function nexusClosePlayer(){if(nexusPlayerPc){try{nexusPlayerPc.close()}catch{}nexusPlayerPc=null}nexusMasterPeerId='';nexusRemoteStream=null;const v=document.getElementById('nexusPlayerVideo');if(v){v.srcObject=null}document.getElementById('nexusPlaceholder')?.classList.remove('hidden');updateNexusViewerState(false)}
function nexusStopMasterPeers(){for(const pc of nexusMasterPeers.values()){try{pc.close()}catch{}}nexusMasterPeers.clear()}
async function nexusHandleLive(message){
  const {event,payload}=message||{};if(!event||!payload)return;
  if(event==='sound-trigger'){const s=(state.sounds||[]).find(x=>String(x.id)===String(payload.soundId));if(s&&payload.sender!==nexusPeerId)await playSoundEntry(s,{remote:true});return}
  if(event==='secret-clue'){if(nexusIsMaster()||String(payload.targetLogin||'').toLowerCase()!==String(state.session?.login||'').toLowerCase())return;storeSecretClue(payload.clue||{});toast('Você recebeu uma informação secreta.');queueRemoteRender(currentView||'home');return}
  if(event==='nexus-join'&&nexusIsMaster()){await nexusCreatePeer(payload.from);return}
  if(event==='nexus-offer'&&!nexusIsMaster()&&payload.target===nexusPeerId){await nexusAcceptOffer(payload);return}
  if(event==='nexus-answer'&&nexusIsMaster()&&payload.target===nexusPeerId){const pc=nexusMasterPeers.get(payload.from);if(pc)await pc.setRemoteDescription(payload.answer).catch(()=>{});return}
  if(event==='nexus-ice'){
    if(nexusIsMaster()&&payload.target===nexusPeerId){const pc=nexusMasterPeers.get(payload.from);if(pc&&payload.candidate)await pc.addIceCandidate(payload.candidate).catch(()=>{});}
    else if(!nexusIsMaster()&&payload.target===nexusPeerId&&nexusPlayerPc&&payload.candidate)await nexusPlayerPc.addIceCandidate(payload.candidate).catch(()=>{});
    return;
  }
  if(event==='nexus-stop'&&!nexusIsMaster()){nexusClosePlayer();updateNexusViewerState(false);}
  if(event==='nexus-start'&&!nexusIsMaster()){setTimeout(nexusJoin,250);}
}
async function nexusCreatePeer(playerPeer){
  if(!playerPeer||!nexusLocalStream||!window.RTCPeerConnection)return;
  const old=nexusMasterPeers.get(playerPeer);if(old){try{old.close()}catch{}}
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});nexusMasterPeers.set(playerPeer,pc);
  nexusLocalStream.getTracks().forEach(t=>pc.addTrack(t,nexusLocalStream));
  pc.onicecandidate=e=>{if(e.candidate)broadcastLive('nexus-ice',{from:nexusPeerId,target:playerPeer,candidate:e.candidate.toJSON?.()||e.candidate}).catch(()=>{})};
  pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState))nexusMasterPeers.delete(playerPeer)};
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);await broadcastLive('nexus-offer',{from:nexusPeerId,target:playerPeer,offer:pc.localDescription});
}
async function nexusStartShare(){
  if(!nexusIsMaster())return;
  if(!navigator.mediaDevices?.getDisplayMedia){toast('Este navegador não permite transmissão de tela. Use Chrome/Edge em HTTPS.');return}
  try{
    nexusLocalStream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:24},width:{ideal:1920,max:1920},height:{ideal:1080,max:1080}},audio:true});
    const track=nexusLocalStream.getVideoTracks()[0];if(track)track.onended=()=>nexusStopShare();
    state.nexus={...defaultNexus(),...(state.nexus||{}),active:true,updatedAt:Date.now()};await saveGlobalNow().catch(()=>{});await broadcastLive('nexus-start',{at:Date.now()});toast('Nexus sendo transmitido.');render('nexus');
  }catch(e){toast('A transmissão foi cancelada ou não pôde ser iniciada.');}
}
async function nexusStopShare(){if(!nexusIsMaster()||nexusStopping)return;nexusStopping=true;nexusLocalStream?.getTracks().forEach(t=>{try{t.stop()}catch{}});nexusLocalStream=null;nexusStopMasterPeers();state.nexus={...defaultNexus(),...(state.nexus||{}),active:false,updatedAt:Date.now()};nexusStopping=false;await saveGlobalNow().catch(()=>{});await broadcastLive('nexus-stop',{at:Date.now()}).catch(()=>{});render('nexus')}
async function nexusJoin(){if(nexusIsMaster()||!state.nexus?.active||!remoteEnabled)return;if(!window.RTCPeerConnection)return;await broadcastLive('nexus-join',{from:nexusPeerId,login:state.session?.login||''})}
async function nexusAcceptOffer(payload){
  if(nexusPlayerPc)try{nexusPlayerPc.close()}catch{}
  nexusMasterPeerId=payload.from;nexusPlayerPc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  nexusPlayerPc.ontrack=e=>{if(e.streams[0]){nexusRemoteStream=e.streams[0];const v=document.getElementById('nexusPlayerVideo');if(v){v.srcObject=nexusRemoteStream;v.play().catch(()=>{});document.getElementById('nexusPlaceholder')?.classList.add('hidden')}updateNexusViewerState(true)}};
  nexusPlayerPc.onicecandidate=e=>{if(e.candidate)broadcastLive('nexus-ice',{from:nexusPeerId,target:payload.from,candidate:e.candidate.toJSON?.()||e.candidate}).catch(()=>{})};
  await nexusPlayerPc.setRemoteDescription(payload.offer);const answer=await nexusPlayerPc.createAnswer();await nexusPlayerPc.setLocalDescription(answer);await broadcastLive('nexus-answer',{from:nexusPeerId,target:payload.from,answer:nexusPlayerPc.localDescription});
}
function updateNexusViewerState(active){const s=document.getElementById('nexusViewerState');if(s)s.textContent=active?'CONEXÃO ATIVA':'AGUARDANDO TRANSMISSÃO'}
function nexusPage(){const n={...defaultNexus(),...(state.nexus||{})};const master=nexusIsMaster();return shell(`<section class="hero nexus-hero"><span class="badge">NEXUS TABLETOP</span><h1>${esc(n.title||'Nexus Tabletop')}</h1><p>${master?'Transmita a janela ou tela do Nexus para os Players. O vídeo é enviado diretamente entre os navegadores.':'Acompanhe a transmissão do Mestre sem sair de Ashen Testimony.'}</p><div class="nexus-status ${n.active?'live':''}"><span id="nexusViewerState">${n.active?(master?'TRANSMISSÃO ATIVA':'CONECTANDO...'):'AGUARDANDO TRANSMISSÃO'}</span></div></section><section class="nexus-stage"><div class="nexus-video-wrap"><video id="nexusPlayerVideo" autoplay playsinline controls></video><div class="nexus-placeholder" id="nexusPlaceholder"><span>◇</span><strong>${n.active?'Conectando ao Nexus…':'Nenhuma transmissão ativa'}</strong><small>${master?'Clique em transmitir e escolha a janela do Nexus.':'Quando o Mestre iniciar, a imagem aparecerá aqui.'}</small></div></div><div class="nexus-controls">${master?`<div class="field"><label>Nome da transmissão</label><input id="nexusTitle" value="${esc(n.title||'Nexus Tabletop')}" placeholder="Nexus Tabletop"></div><div class="field"><label>Link opcional do Nexus</label><input id="nexusUrl" value="${esc(n.url||'')}" placeholder="https://..."></div><div class="row"><button class="btn primary" id="nexusStart">${n.active?'Transmitindo…':'Transmitir Nexus'}</button>${n.active?'<button class="btn danger" id="nexusStop">Parar transmissão</button>':''}${n.url?`<a class="btn ghost" href="${esc(safeHref(n.url))}" target="_blank" rel="noopener">Abrir Nexus</a>`:''}</div><p class="tiny muted">A transmissão depende do suporte WebRTC do navegador e de HTTPS. O áudio da aba pode ser compartilhado quando o navegador oferecer essa opção.</p>`:`<div class="nexus-player-note"><strong>Visualização dos Players</strong><p>Esta tela mostra somente a transmissão do Mestre. O controle do Nexus continua com quem estiver conduzindo a mesa.</p><button class="btn gold" id="nexusReconnect">Conectar novamente</button></div>`}</div></section>`,'nexus')}
function bindNexus(){const video=document.getElementById('nexusPlayerVideo');if(!nexusIsMaster()&&nexusRemoteStream&&video){video.srcObject=nexusRemoteStream;video.play().catch(()=>{});document.getElementById('nexusPlaceholder')?.classList.add('hidden');updateNexusViewerState(true)}if(nexusIsMaster()&&nexusLocalStream&&video){video.srcObject=nexusLocalStream;document.getElementById('nexusPlaceholder')?.classList.add('hidden')}if(!nexusIsMaster()&&nexusPlayerPc){video?.addEventListener('loadedmetadata',()=>{document.getElementById('nexusPlaceholder')?.classList.add('hidden')},{once:true})}if(nexusIsMaster()){document.getElementById('nexusStart')?.addEventListener('click',async()=>{const title=document.getElementById('nexusTitle')?.value.trim()||'Nexus Tabletop',url=document.getElementById('nexusUrl')?.value.trim()||'';state.nexus={...defaultNexus(),...(state.nexus||{}),title,url};await saveGlobalNow().catch(()=>{});if(!state.nexus.active)await nexusStartShare()});document.getElementById('nexusStop')?.addEventListener('click',nexusStopShare);if(state.nexus?.active&&!nexusLocalStream){state.nexus.active=false;saveGlobalNow().catch(()=>{});toast('A transmissão anterior foi encerrada porque o Mestre recarregou a página.');}}else{document.getElementById('nexusReconnect')?.addEventListener('click',nexusJoin);if(state.nexus?.active){setTimeout(nexusJoin,250)}}}
let nexusViewerJoinAt=0;
function bindNexusViewer(){
  const video=document.getElementById('nexusPlayerVideo');
  if(nexusRemoteStream&&video){video.srcObject=nexusRemoteStream;video.play().catch(()=>{});document.getElementById('nexusPlaceholder')?.classList.add('hidden');updateNexusViewerState(true)}
  const join=()=>{nexusViewerJoinAt=Date.now();nexusJoin()};
  document.getElementById('nexusReconnect')?.addEventListener('click',join);
  if(state.nexus?.active&&!nexusRemoteStream&&Date.now()-nexusViewerJoinAt>4000)setTimeout(join,250);
}
function secretCluesKey(){return `a_profecia_secret_clues_${String(state.session?.login||'').toLowerCase()}`}
function getSecretClues(){const p=player();if(p&&Array.isArray(p.secretClues))return p.secretClues;try{return JSON.parse(localStorage.getItem(secretCluesKey())||'[]')||[]}catch{return []}}
function storeSecretClue(clue){const p=player();const safe={...clue,id:clue.id||`secret-${Date.now()}`,receivedAt:Number(clue.receivedAt)||Date.now()};if(p){p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];if(!p.secretClues.some(x=>String(x.id)===String(safe.id)))p.secretClues.unshift(safe);p._syncUpdatedAt=nextStamp();save();syncPlayersDbNow().catch(()=>{});}try{const list=getSecretClues();if(!list.some(x=>String(x.id)===String(safe.id))){list.unshift(safe);localStorage.setItem(secretCluesKey(),JSON.stringify(list.slice(0,100)))}}catch{}}
function secretCluesPage(){const clues=getSecretClues();return shell(`<section class="hero"><span class="badge">REGISTRO OCULTO</span><h1>Pistas secretas</h1><p>Informações enviadas somente para este personagem. Elas ficam salvas na ficha do Player.</p></section><section class="secret-clue-grid">${clues.length?clues.map(c=>`<article class="card secret-clue-card"><div class="secret-clue-mark">?</div><div><span class="section-kicker">CONFIDENCIAL</span><h2>${esc(c.title||'Informação')}</h2><p>${esc(c.message||'')}</p><small>${new Date(c.receivedAt||Date.now()).toLocaleString('pt-BR')}</small></div></article>`).join(''):'<div class="card empty">Nenhuma informação secreta foi recebida.</div>'}</section>`,'home')}
function secretCluesAdmin(){return `<div class="card"><div class="row space"><div><h2>Pistas secretas</h2><p class="small muted">A pista é gravada diretamente na ficha do Player escolhido e também enviada em tempo real.</p></div></div><div class="secret-send-grid"><div class="field"><label>Player</label><select id="secretTarget">${state.players.map(p=>`<option value="${esc(p.login)}">${esc(p.name||p.login)} • ${esc(p.login)}</option>`).join('')}</select></div><div class="field"><label>Título</label><input id="secretTitle" placeholder="Ex.: Você ouviu alguma coisa"></div><div class="field secret-message-field"><label>Informação</label><textarea id="secretMessage" rows="7" placeholder="Somente esse Player verá esta mensagem."></textarea></div></div><div class="row"><button class="btn primary" id="sendSecretClue">Enviar informação secreta</button></div><p class="tiny muted">Mesmo que o Player esteja offline, a pista permanecerá na ficha e aparecerá quando ele entrar.</p></div>`}
async function persistSecretClue(p,clue){
  p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];
  if(!p.secretClues.some(x=>String(x.id)===String(clue.id)))p.secretClues.unshift(clue);
  p._syncUpdatedAt=nextStamp();
  save();
  if(!playerStoreEnabled){await syncPlayersDbNow(true);return true}
  const savedRows=await upsertPlayers([p]);
  const saved=savedRows?.[0];
  const confirmed=!!saved?.data&&Array.isArray(saved.data.secretClues)&&saved.data.secretClues.some(x=>String(x.id)===String(clue.id));
  if(!confirmed)throw new Error('PISTA_NAO_CONFIRMADA');
  return true;
}
async function sendSecretClue(){const target=String(document.getElementById('secretTarget')?.value||'').trim(),title=document.getElementById('secretTitle')?.value.trim()||'Informação confidencial',message=document.getElementById('secretMessage')?.value.trim()||'';if(!target||!message){toast('Escolha um Player e escreva a informação.');return}const p=state.players.find(x=>String(x.login||'').toLowerCase()===target.toLowerCase());if(!p){toast('Player não encontrado.');return}const clue={id:`secret-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title,message,receivedAt:Date.now()};try{await persistSecretClue(p,clue)}catch(e){console.error('Falha ao confirmar pista secreta:',e);toast('A pista NÃO foi confirmada pelo servidor. Verifique a conexão e tente novamente.');return}broadcastLive('secret-clue',{targetLogin:target,clue}).catch(()=>{});toast(`Informação enviada e salva na ficha de ${target}.`);document.getElementById('secretMessage').value='';}

function soundsAdmin(){return `<div class="card"><div class="row space"><div><h2>Soundboard sincronizado</h2><p class="small muted">Salve seus áudios no armazenamento da campanha. O Mestre dispara um efeito e todos os Players recebem o mesmo som em tempo real.</p></div><button class="btn" id="soundStopMaster">■ Parar sons locais</button></div><div class="sound-upload-panel"><div class="input-grid"><div class="field"><label>Nome</label><input id="soundName" placeholder="Ex.: Porta pesada, passos, grito..."></div><div class="field"><label>Categoria</label><select id="soundCategory"><option>Ambiente</option><option>Impacto</option><option>Terror</option><option>Vozes</option><option>Natureza</option><option>Objetos</option><option>Outros</option></select></div><div class="field"><label>Arquivo de áudio</label><input id="soundFile" type="file" accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.opus,.webm"></div></div><div class="field"><label>Ou URL direta</label><input id="soundUrl" placeholder="https://.../som.mp3"></div><div class="row"><button class="btn primary" id="addSound">+ Salvar som na biblioteca</button><span class="tiny muted">Arquivos até 25 MB • MP3/WAV/OGG/M4A e formatos compatíveis com o navegador.</span></div></div><div class="sound-library-grid">${state.sounds?.length?state.sounds.map(s=>`<article class="sound-library-card"><div class="sound-library-icon">♪</div><div class="sound-library-meta"><span>${esc(s.category||'Outros')}</span><strong>${esc(s.name)}</strong><small>${s.kind==='file'?'Arquivo local antigo — reenvie para sincronizar':'Áudio global'}</small></div><div class="row"><button class="btn small" data-play-sound="${esc(s.id)}">▶ Testar</button><button class="btn small danger" data-del-sound="${esc(s.id)}">Excluir</button></div></article>`).join(''):'<div class="empty">Sua biblioteca de sons está vazia.</div>'}</div></div>`}

function symbolsAdmin(){return `<div class="card"><div class="row space"><div><h2>Símbolos da ficha</h2><p class="small muted">Somente o Mestre pode alterar os símbolos de atributos, perícias e condições. Você pode usar texto/emoji ou enviar uma imagem; imagens pequenas são otimizadas antes de salvar.</p></div></div><div class="symbol-editor"><div><h3>Atributos</h3>${allAttrs().map(a=>`<div class="symbol-row"><span>${uiAttrIcon(a)} ${esc(a)}</span><div class="symbol-controls"><input class="uiAttrIconInput" data-symbol-attr="${esc(a)}" value="${esc(state.uiIcons?.attrs?.[a]||DEFAULT_ATTR_ICONS[a])}"><label class="btn small">Imagem<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-symbol-file="attr" data-symbol-key="${esc(a)}" hidden></label></div></div>`).join('')}</div><div><h3>Perícias</h3>${allSkills().map(sk=>`<div class="symbol-row"><span>${uiSkillIcon(sk)} ${esc(sk)}</span><div class="symbol-controls"><input class="uiSkillIconInput" data-symbol-skill="${esc(sk)}" value="${esc(state.uiIcons?.skills?.[sk]||DEFAULT_SKILL_ICONS[sk])}"><label class="btn small">Imagem<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-symbol-file="skill" data-symbol-key="${esc(sk)}" hidden></label></div></div>`).join('')}</div></div><div class="divider"></div><h3>Registro de sessão — símbolos e ornamentos</h3><p class="small muted">Personalize os símbolos da mochila e os ornamentos do modo sessão. As mudanças só valem para os Players depois de aplicadas.</p><div id="sessThemeEditor">${sessionThemeEditorMarkup()}</div><div class="divider"></div><h3>Ícones das condições</h3><div class="condition-upload-admin">${CONDITION_DEFS.map(c=>{const img=state.uiIcons?.conditions?.[c.id]||c.image;return `<div class="condition-admin-row"><div>${img?`<img class="condition-admin-icon" src="${esc(img)}" alt="">`:''}<strong>${esc(c.name)}</strong></div><label class="btn small">Alterar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-condition-image="${esc(c.id)}" hidden></label></div>`}).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" id="saveSymbols">Salvar símbolos de texto</button></div></div>`}
function zeroPlayerPoints(p,kind){
  const names=kind==='attrs'?allAttrs():allSkills();
  p[kind]=p[kind]&&typeof p[kind]==='object'?p[kind]:{};
  for(const k of new Set([...Object.keys(p[kind]),...names]))p[kind][k]=0;
}
async function persistPointChanges(players){
  players.forEach(p=>{syncDerivedResources(p);p._syncUpdatedAt=nextStamp()});
  save();
  let synced=false;try{synced=!!(await syncPlayersDbNow(false,{fresh:true}))}catch(err){console.error('Sync de pontos falhou:',err)}
  return synced;
}
function pointsMeter(label,spent,limit,bonus){
  const free=Math.max(0,limit-spent),over=Math.max(0,spent-limit),pct=limit>0?Math.min(100,Math.round(spent/limit*100)):(spent>0?100:0);
  return `<div class="points-meter${over?' is-over':''}"><div class="points-meter-top"><span>${label}</span><b>${esc(spent)}/${esc(limit)}</b></div><div class="points-bar"><i style="width:${pct}%"></i></div><small>${over?`Excedido em ${esc(over)}`:`${esc(free)} livre${free===1?'':'s'}`}${bonus?` • +${esc(bonus)} do Mestre`:''}</small></div>`;
}
function pointsStepper(id,kind,label){
  const btn=(d,sym,txt)=>`<button type="button" class="points-step-btn" data-points-step data-step-id="${esc(id)}" data-step-kind="${kind}" data-step-delta="${d}" aria-label="${txt} 1 ponto de ${label}" title="${txt} 1 ponto de ${label}">${sym}</button>`;
  return `<div class="points-step">${btn(-1,'−','Retirar')}${btn(1,'+','Dar')}</div>`;
}
function pointsSummaryMarkup(){
  const list=activePlayersList();
  let ab=0,sb=0,af=0,sf=0,over=0;
  list.forEach(p=>{normalize(p);const r=characterRules(p.campaignType),rem=allocationRemaining(p),ov=allocationOver(p);ab+=Number(p.attrBonusPoints)||0;sb+=Number(p.skillBonusPoints)||0;af+=rem.attrs;sf+=rem.skills;if(ov.attrs||ov.skills)over++});
  const cell=(v,l)=>`<div class="points-sum-cell"><b>${esc(v)}</b><span>${l}</span></div>`;
  return `<div class="points-summary">${cell(list.length,'Players')}${cell(`+${ab}`,'Atributo concedido')}${cell(`+${sb}`,'Perícia concedida')}${cell(af,'Atributo livre')}${cell(sf,'Perícia livre')}${over?cell(over,'Acima do limite'):''}</div>`;
}
function pointsManagerRows(){
  const list=activePlayersList();
  if(!list.length)return '<div class="empty">Nenhum Player criado ainda.</div>';
  return list.map(p=>{
    normalize(p);
    const r=characterRules(p.campaignType),t=allocationTotals(p),ab=Number(p.attrBonusPoints)||0,sb=Number(p.skillBonusPoints)||0,ov=allocationOver(p);
    const al=Number(r.attrPoints)+ab,sl=Number(r.skillPoints)+sb,id=String(p.id);
    return `<div class="points-row${ov.attrs||ov.skills?' has-warn':''}"><label class="points-pick"><input type="checkbox" data-points-pick="${esc(id)}"><span><b>${esc(p.name||p.login||'Player')}</b><small>${esc(p.class||'Sem classe')}</small></span></label><div class="points-meters"><div class="points-meter-wrap">${pointsMeter('Atributos',t.attrs,al,ab)}${pointsStepper(id,'attr','atributo')}</div><div class="points-meter-wrap">${pointsMeter('Perícias',t.skills,sl,sb)}${pointsStepper(id,'skill','perícia')}</div></div>${ov.attrs||ov.skills?`<div class="points-warn">⚠ Acima do limite: ${ov.attrs?`Atributos +${esc(ov.attrs)} `:''}${ov.skills?`Perícias +${esc(ov.skills)}`:''}</div>`:''}<button type="button" class="btn small danger points-refund" data-points-refund="${esc(id)}">Devolver pontos gastos</button></div>`;
  }).join('');
}
function openPointsManager(){
  document.getElementById('pointsModal')?.remove();
  const chips=id=>`<div class="points-chips" data-chips-for="${id}">${[1,2,3,5].map(n=>`<button type="button" class="points-chip" data-chip="${n}">${n}</button>`).join('')}</div>`;
  openModal(`<div class="modal" id="pointsModal"><div class="modal-card points-modal"><button class="modal-close" id="closePoints">×</button><span class="badge">MESTRE</span><h2>Distribuir pontos</h2>
  <p class="small muted">Use os botões <b>−</b> e <b>+</b> em cada Player para ajustar 1 ponto na hora, ou marque vários Players e aplique de uma vez. Isto muda só os pontos <b>concedidos</b>; o que o Player já distribuiu não é alterado, a não ser que você marque a opção de zerar.</p>
  <div id="pointsSummary">${pointsSummaryMarkup()}</div>
  <div class="points-form"><div class="field"><label>Ação</label><select id="ptMode"><option value="add">Dar (+)</option><option value="remove">Retirar (−)</option><option value="set">Definir total concedido</option></select></div><div class="field"><label>Pontos de Atributo</label><input id="ptAttr" type="number" min="0" step="1" inputmode="numeric" placeholder="—">${chips('ptAttr')}</div><div class="field"><label>Pontos de Perícia</label><input id="ptSkill" type="number" min="0" step="1" inputmode="numeric" placeholder="—">${chips('ptSkill')}</div></div>
  <label class="spell-check"><input type="checkbox" id="ptReset"> <span>Se o Player ficar acima do limite, zerar a distribuição dessa categoria (ele redistribui)</span></label>
  <div class="row" style="margin:8px 0"><button type="button" class="btn small" id="ptAll">Marcar todos</button><button type="button" class="btn small" id="ptNone">Desmarcar</button></div>
  <div id="pointsRows" class="points-rows">${pointsManagerRows()}</div>
  <div class="points-apply-bar"><div class="points-preview" id="ptPreview" aria-live="polite"></div><div class="row"><button type="button" class="btn" id="ptClose2">Fechar</button><button type="button" class="btn gold" id="ptApply">Aplicar aos marcados</button></div></div></div></div>`);
  bindPointsManager();
}
function bindPointsManager(){
  const close=()=>document.getElementById('pointsModal')?.remove();
  const picked=()=>[...document.querySelectorAll('[data-points-pick]:checked')].map(x=>String(x.dataset.pointsPick));
  const byId=id=>(state.players||[]).find(x=>String(x.id)===String(id));
  const parse=id=>{const v=document.getElementById(id).value.trim();return v===''?null:Math.max(0,Math.floor(Number(v)||0))};
  const updatePreview=()=>{
    const box=document.getElementById('ptPreview'),btn=document.getElementById('ptApply');if(!box)return;
    const n=picked().length,aN=parse('ptAttr'),sN=parse('ptSkill'),mode=document.getElementById('ptMode').value;
    const sign=mode==='add'?'+':mode==='remove'?'−':'';
    const parts=[aN!==null?`${sign}${aN} de Atributo`:'',sN!==null?`${sign}${sN} de Perícia`:''].filter(Boolean);
    let txt='',ok=false;
    if(!n)txt='Marque os Players que vão receber a mudança.';
    else if(!parts.length)txt='Informe os pontos de Atributo e/ou Perícia.';
    else{ok=true;txt=`${mode==='set'?'Definir total concedido':mode==='add'?'Dar':'Retirar'}: <b>${parts.join(' e ')}</b> — ${n} Player${n>1?'s':''} marcado${n>1?'s':''}.`}
    box.innerHTML=txt;if(btn)btn.disabled=!ok;
  };
  const refresh=keep=>{
    const box=document.getElementById('pointsRows');if(!box)return;
    box.innerHTML=pointsManagerRows();
    const sum=document.getElementById('pointsSummary');if(sum)sum.innerHTML=pointsSummaryMarkup();
    keep.forEach(id=>{const c=[...document.querySelectorAll('[data-points-pick]')].find(x=>String(x.dataset.pointsPick)===String(id));if(c)c.checked=true});
    bindRows();updatePreview();
  };
  const bindRows=()=>{
    document.querySelectorAll('[data-points-pick]').forEach(c=>c.onchange=updatePreview);
    document.querySelectorAll('[data-points-step]').forEach(b=>b.onclick=async()=>{
      const p=byId(b.dataset.stepId);if(!p)return;normalize(p);
      const key=b.dataset.stepKind==='attr'?'attrBonusPoints':'skillBonusPoints',cur=Number(p[key])||0,nb=Math.max(0,Math.min(999,cur+Number(b.dataset.stepDelta)));
      if(nb===cur){toast(nb===0?'Este Player não tem pontos concedidos para retirar.':'Limite de pontos concedidos atingido.');return}
      document.querySelectorAll('[data-points-step]').forEach(x=>x.disabled=true);
      const keep=picked();p[key]=nb;
      const synced=await persistPointChanges([p]);
      toast(`${p.name||'Player'}: ${b.dataset.stepKind==='attr'?'Atributo':'Perícia'} ${Number(b.dataset.stepDelta)>0?'+':'−'}1 (concedido: ${nb}).${synced?'':' Salvo neste aparelho; sincroniza quando a conexão voltar.'}`);
      refresh(keep);
    });
    document.querySelectorAll('[data-points-refund]').forEach(b=>b.onclick=async()=>{
      const p=byId(b.dataset.pointsRefund);if(!p)return;
      if(!confirm(`Devolver todos os pontos gastos de ${p.name||'Player'}?\n\nAtributos e Perícias voltam a 0 e ele redistribui do zero.`))return;
      const keep=picked();
      zeroPlayerPoints(p,'attrs');zeroPlayerPoints(p,'skills');
      const synced=await persistPointChanges([p]);
      toast(synced?`${p.name||'Player'}: pontos devolvidos.`:`${p.name||'Player'}: pontos devolvidos neste aparelho; sincroniza quando a conexão voltar.`);
      refresh(keep);
    });
  };
  document.getElementById('closePoints').onclick=close;document.getElementById('ptClose2').onclick=close;
  document.getElementById('ptAll').onclick=()=>{document.querySelectorAll('[data-points-pick]').forEach(c=>c.checked=true);updatePreview()};
  document.getElementById('ptNone').onclick=()=>{document.querySelectorAll('[data-points-pick]').forEach(c=>c.checked=false);updatePreview()};
  document.querySelectorAll('[data-chips-for]').forEach(box=>{
    const input=document.getElementById(box.dataset.chipsFor);
    box.querySelectorAll('[data-chip]').forEach(c=>c.onclick=()=>{input.value=c.dataset.chip;updatePreview()});
  });
  ['ptAttr','ptSkill'].forEach(id=>document.getElementById(id).addEventListener('input',updatePreview));
  document.getElementById('ptMode').addEventListener('change',updatePreview);
  bindRows();updatePreview();
  document.getElementById('ptApply').onclick=async()=>{
    const ids=picked();
    if(!ids.length){toast('Marque pelo menos um Player.');return}
    const mode=document.getElementById('ptMode').value;
    const aN=parse('ptAttr'),sN=parse('ptSkill');
    if(aN===null&&sN===null){toast('Informe quantos pontos de Atributo e/ou Perícia.');return}
    const next=(cur,n)=>Math.min(999,mode==='add'?cur+n:mode==='remove'?Math.max(0,cur-n):n);
    const zero=document.getElementById('ptReset').checked;
    const changed=[],over=[];
    for(const id of ids){
      const p=byId(id);if(!p)continue;normalize(p);
      let touched=false;
      if(aN!==null){const cur=Number(p.attrBonusPoints)||0,nb=next(cur,aN);if(nb!==cur){p.attrBonusPoints=nb;touched=true}}
      if(sN!==null){const cur=Number(p.skillBonusPoints)||0,nb=next(cur,sN);if(nb!==cur){p.skillBonusPoints=nb;touched=true}}
      let ov=allocationOver(p);
      if(zero&&ov.attrs){zeroPlayerPoints(p,'attrs');touched=true}
      if(zero&&ov.skills){zeroPlayerPoints(p,'skills');touched=true}
      ov=allocationOver(p);
      if(ov.attrs||ov.skills)over.push(p.name||'Player');
      if(touched)changed.push(p);
    }
    if(!changed.length){toast('Nada mudou: os Players marcados já estavam com esses valores.');return}
    const synced=await persistPointChanges(changed);
    toast(`Pontos atualizados em ${changed.length} Player${changed.length>1?'s':''}.${synced?'':' Salvo neste aparelho; sincroniza quando a conexão voltar.'}${over.length?` Acima do limite: ${over.join(', ')}.`:''}`);
    refresh(ids);
  };
}
function activePlayersList(){return (state.players||[]).filter(p=>p&&!p.deletedAt&&!p._deleted&&!p.deleted_at)}
function spellsAdmin(){
  const players=activePlayersList(),list=getSpells();
  return `<div class="card spells-admin"><div class="row space"><div><h2>Grimório da campanha</h2><p class="small muted">Crie e edite as magias, defina o custo em Sanidade, se é ritual e quantos turnos leva, e escolha quais Players a conhecem. Cada Player vê as magias dele na aba <b>Magias</b>.</p></div><button type="button" class="btn gold" id="spellAdminNew">＋ Nova magia</button></div>
  <div class="spell-admin-grid">${list.map(sp=>{const known=players.filter(pl=>playerKnowsSpell(pl,sp.id)).map(pl=>pl.name||pl.login||'Player'),cost=spellCost(sp),ritual=spellRitualText(sp);
    return `<div class="spell-admin-card">${sp.image?`<img class="spell-image" src="${esc(sp.image)}" alt="">`:'<div class="spell-upload-placeholder">✦</div>'}<strong>${esc(sp.name)}</strong><small>${esc(sp.school||'')}</small><div class="spell-meta"><span class="spell-chip spell-chip-san">☾ ${esc(cost)} Sanidade</span>${ritual?`<span class="spell-chip spell-chip-ritual">⛧ ${esc(ritual)}</span>`:''}</div><small class="spell-known">${known.length?`Conhecida por: ${esc(known.join(', '))}`:'Nenhum Player conhece esta magia.'}</small><div class="row" style="margin-top:6px"><button type="button" class="btn small gold" data-spell-edit="${esc(sp.id)}">Editar / conceder</button><button type="button" class="btn small danger" data-spell-delete="${esc(sp.id)}">Excluir</button></div><label class="upload-label">Enviar imagem<input type="file" accept="image/png,image/jpeg,image/webp,.jfif" data-spell-image="${esc(sp.id)}" hidden></label>${sp.image?'<button class="btn small danger" data-clear-spell-image="'+esc(sp.id)+'">Remover imagem</button>':''}</div>`}).join('')||'<div class="empty">Nenhuma magia criada.</div>'}</div></div>`;
}
function openSpellAdminModal(id=null){
  const existing=id?getSpells().find(x=>String(x.id)===String(id)):null;
  const s=existing?clone(existing):{id:`spell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,name:'',school:'',cost:'',sanityCost:0,ritual:false,ritualTurns:0,description:'',image:''};
  const players=activePlayersList();
  openModal(`<div class="modal" id="spellAdminModal"><div class="modal-card"><button class="modal-close" id="closeSpellAdmin">×</button><span class="badge">GRIMÓRIO DA CAMPANHA</span><h2>${existing?'Editar magia':'Nova magia'}</h2>
  <div class="field"><label>Nome da magia</label><input id="saName" value="${esc(s.name)}" placeholder="Nome da magia"></div>
  <div class="field"><label>Tipo / escola</label><input id="saSchool" value="${esc(s.school||'')}" placeholder="Ex.: Primeiro Círculo • Sangue"></div>
  <div class="field"><label>Descrição</label><textarea id="saDesc" rows="6" placeholder="O que a magia faz">${esc(s.description||'')}</textarea></div>
  <div class="input-grid"><div class="field"><label>Sanidade gasta</label><input id="saCost" type="number" min="0" step="1" inputmode="numeric" value="${spellCost(s)}"></div>
  <div class="field"><label>Turnos para completar</label><input id="saTurns" type="number" min="0" step="1" inputmode="numeric" value="${spellRitualTurns(s)}"></div></div>
  <label class="spell-check"><input type="checkbox" id="saRitual" ${spellIsRitual(s)?'checked':''}> <span>É um ritual (leva turnos para ser completado)</span></label>
  <div class="field"><label>Players que conhecem esta magia</label><div class="spell-player-checks">${players.length?players.map(pl=>`<label class="spell-check"><input type="checkbox" data-sa-player="${esc(pl.id)}" ${playerKnowsSpell(pl,s.id)?'checked':''}> <span>${esc(pl.name||pl.login||'Player')}</span></label>`).join(''):'<small class="muted">Nenhum Player criado ainda.</small>'}</div></div>
  <div class="row" style="justify-content:flex-end"><button class="btn" id="cancelSpellAdmin">Cancelar</button><button class="btn gold" id="saveSpellAdmin">Salvar magia</button></div></div></div>`);
  const close=()=>document.getElementById('spellAdminModal')?.remove();
  document.getElementById('closeSpellAdmin').onclick=close;document.getElementById('cancelSpellAdmin').onclick=close;
  const turnsInput=document.getElementById('saTurns'),ritualInput=document.getElementById('saRitual');
  const syncTurns=()=>{turnsInput.disabled=!ritualInput.checked};ritualInput.addEventListener('change',syncTurns);syncTurns();
  document.getElementById('saveSpellAdmin').onclick=async()=>{
    const name=document.getElementById('saName').value.trim();
    if(!name){toast('Informe o nome da magia.');return}
    const san=Math.max(0,Math.floor(Number(document.getElementById('saCost').value)||0));
    const ritual=ritualInput.checked;
    const next={...s,name,school:document.getElementById('saSchool').value.trim(),description:document.getElementById('saDesc').value.trim(),cost:`${san} Sanidade`,sanityCost:san,ritual,ritualTurns:ritual?Math.max(0,Math.floor(Number(turnsInput.value)||0)):0};
    state.spells=Array.isArray(state.spells)&&state.spells.length?state.spells:INITIAL_SPELLS.map(clone);
    const idx=state.spells.findIndex(x=>String(x.id)===String(next.id));
    if(idx>=0)state.spells[idx]=next;else state.spells.push(next);
    const changed=[];
    document.querySelectorAll('[data-sa-player]').forEach(box=>{
      const pl=state.players.find(x=>String(x.id)===String(box.dataset.saPlayer));if(!pl)return;
      const knows=playerKnowsSpell(pl,next.id);
      if(box.checked&&!knows){grantedSpellIds(pl).push(String(next.id));changed.push(pl)}
      else if(!box.checked&&knows){
        pl.grantedSpells=grantedSpellIds(pl).filter(x=>String(x)!==String(next.id));
        pl.personalSpells=normalizePersonalSpells(pl).filter(x=>String(x.id)!==String(next.id));
        if(String(pl.initialSpell||'')===String(next.id))pl.initialSpell='';
        changed.push(pl);
      }
    });
    try{await saveGlobalNow()}catch(e){console.warn('Falha ao sincronizar magia:',e)}
    if(changed.length){changed.forEach(pl=>{pl._syncUpdatedAt=nextStamp()});save();await syncPlayersDbNow(true).catch(()=>{})}
    close();toast(existing?'Magia atualizada.':'Magia criada.');
    const box=document.getElementById('adminContent');if(box){box.innerHTML=spellsAdmin();bindAdminContent()}
  };
}
function bindSpellsAdminExtras(){
  document.getElementById('spellAdminNew')?.addEventListener('click',()=>openSpellAdminModal(null));
  document.querySelectorAll('[data-spell-edit]').forEach(b=>b.onclick=()=>openSpellAdminModal(b.dataset.spellEdit));
  document.querySelectorAll('[data-spell-delete]').forEach(b=>b.onclick=async()=>{
    const sp=getSpells().find(x=>String(x.id)===String(b.dataset.spellDelete));if(!sp)return;
    if(!confirm(`Excluir "${sp.name}"?\n\nEla também será removida dos Players que a conhecem.`))return;
    state.spells=(state.spells||[]).filter(x=>String(x.id)!==String(sp.id));
    const changed=[];
    for(const pl of state.players||[]){
      if(!playerKnowsSpell(pl,sp.id))continue;
      pl.grantedSpells=grantedSpellIds(pl).filter(x=>String(x)!==String(sp.id));
      pl.personalSpells=normalizePersonalSpells(pl).filter(x=>String(x.id)!==String(sp.id));
      if(String(pl.initialSpell||'')===String(sp.id))pl.initialSpell='';
      pl._syncUpdatedAt=nextStamp();changed.push(pl);
    }
    try{await saveGlobalNow()}catch(e){console.warn('Falha ao sincronizar exclusão de magia:',e)}
    if(changed.length){save();await syncPlayersDbNow(true).catch(()=>{})}
    toast('Magia excluída.');
    const box=document.getElementById('adminContent');if(box){box.innerHTML=spellsAdmin();bindAdminContent()}
  });
}
function masterFicha(){return shell(`<section class="hero"><span class="badge">FICHAS</span><h1>Fichas dos Players</h1><p>Os Players criados pelo Mestre ficam reunidos aqui. Abra uma ficha para consultar seus dados ou edite pelo botão de edição.</p></section><div class="master-player-grid">${state.players.map((p,i)=>`<article class="master-player-card"><div class="master-player-avatar"><img src="${esc(p.photo||'ritual.webp')}" alt="" loading="lazy" decoding="async"></div><div class="master-player-info"><span class="section-kicker">PLAYER</span><h2>${esc(p.name||'Sem nome')}</h2><p>${esc(p.class||'Classe não escolhida')} • ${esc(p.status||'Ativo')}</p><div class="master-player-stats"><span>VIDA <b>${p.hp||0}/${derivedMax(p,'Corpo')||1}</b></span><span>SANIDADE <b>${p.sanity||0}/${derivedMax(p,'Sanidade')}</b></span><span>MOCHILA <b>${bagWeight(p)}/${MAX_BAG}</b></span></div><div class="row"><button class="btn small" data-view-player="${i}" data-player-id="${esc(p.id||String(i))}">Abrir ficha</button><button class="btn small" data-edit-p="${esc(p.id||p.login||i)}">Editar</button><button class="btn small" data-bag-p="${esc(p.id||p.login||i)}">Mochila</button><button class="btn small" data-hist-p="${i}">Histórico</button><button class="btn small danger" data-del-p="${i}">Excluir</button></div></div></article>`).join('')||'<div class="empty">Nenhum Player cadastrado.</div>'}</div><div class="master-ficha-note"><strong>Persistência</strong><span>Os registros permanecem salvos neste ambiente até o Mestre excluí-los.</span></div>`,`sheet`)}

function privateDiaryKey(){return `a_profecia_diary_${String(state.session?.login||'').toLowerCase()}`}
function getPrivateDiary(){try{return JSON.parse(localStorage.getItem(privateDiaryKey())||'{"text":"","updatedAt":0}')||{text:'',updatedAt:0}}catch{return {text:'',updatedAt:0}}}
function savePrivateDiary(text){try{localStorage.setItem(privateDiaryKey(),JSON.stringify({text:String(text||''),updatedAt:Date.now()}));return true}catch{return false}}
function diaryPage(){const p=player(),d=getPrivateDiary();return shell(`<section class="hero"><span class="badge">REGISTRO PRIVADO</span><h1>Meu Diário</h1><p>Suas anotações ficam neste dispositivo e não são enviadas para o Mestre nem para os outros Players.</p></section><section class="diary-layout diary-layout-single"><article class="card diary-editor"><div class="section-heading"><div><span class="section-kicker">ANOTAÇÕES PESSOAIS</span><h2>${esc(p?.name||'Player')}</h2></div><span class="corner-mark">PRIVADO</span></div><textarea id="privateDiaryText" rows="24" placeholder="Escreva pistas, teorias, nomes, suspeitas e acontecimentos...">${esc(d.text)}</textarea><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="savePrivateDiary">Salvar diário</button></div></article></section>`,'diary')}
function libraryPage(){const p=player();const books=(p?.backpack||[]).map(b=>item(b.id)).filter(it=>it&&(Array.isArray(it.bookPages)&&it.bookPages.length||it.bookContent||String(it.category||'').toLowerCase().includes('livro')));return shell(`<section class="hero"><span class="badge">ARQUIVO</span><h1>Biblioteca</h1><p>Livros que estão na sua mochila ficam disponíveis aqui para leitura.</p></section><section class="library-grid">${books.length?books.map(it=>`<article class="card library-book-card"><div class="library-book-icon">${itemIcon(it)}</div><div><span class="section-kicker">LIVRO</span><h2>${esc(it.name)}</h2><p class="small muted">${esc(it.description||'Sem descrição.')}</p><button class="btn gold" data-read-book="${esc(it.id)}">Ler livro</button></div></article>`).join(''):'<div class="card empty">Nenhum livro está na sua mochila no momento.</div>'}</section>`,'library')}

function isTvMode(){
  try{return new URLSearchParams(location.search).get('tv')==='1'||location.hash==='#tv'}catch{return false}
}
function tvSceneById(id){return (Array.isArray(state.tvScenes)?state.tvScenes:[]).find(s=>String(s.id)===String(id));}
function tvEnhanceVideo(v,stage){
  try{
    const cv=document.createElement('canvas');cv.className='tv-layer tv-enter tv-upscale-canvas';
    const gl=cv.getContext('webgl',{alpha:false,antialias:false});
    if(!gl)return null;
    const mk=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error('shader');return sh};
    const pr=gl.createProgram();
    gl.attachShader(pr,mk(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr,mk(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 uv;uniform sampler2D t;uniform vec2 px;void main(){vec3 c=texture2D(t,uv).rgb;vec3 b=(texture2D(t,uv+vec2(px.x,0.)).rgb+texture2D(t,uv-vec2(px.x,0.)).rgb+texture2D(t,uv+vec2(0.,px.y)).rgb+texture2D(t,uv-vec2(0.,px.y)).rgb)*.25;gl_FragColor=vec4(clamp(c+(c-b)*.6,0.,1.),1.);}'));
    gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error('link');
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const uPx=gl.getUniformLocation(pr,'px');
    const next=()=>v.requestVideoFrameCallback?v.requestVideoFrameCallback(draw):requestAnimationFrame(draw);
    const draw=()=>{
      if(!cv.isConnected||!v.isConnected)return;
      if(v.readyState>=2&&v.videoWidth){
        if(v.videoWidth>=3840){cv.style.display='none'}
        else{
          const tw=3840,th=Math.round(3840*v.videoHeight/v.videoWidth);
          if(cv.width!==tw||cv.height!==th){cv.width=tw;cv.height=th;gl.viewport(0,0,tw,th)}
          try{gl.uniform2f(uPx,1/v.videoWidth,1/v.videoHeight);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,v);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);cv.dataset.ready='1'}
          catch(e){console.warn('Realce 4K desativado:',e);cv.remove();v._tvCv=null;return}
        }
      }
      next();
    };
    stage.appendChild(cv);v._tvCv=cv;next();
    return cv;
  }catch(e){console.warn('Realce 4K indisponível:',e);return null}
}
function playTvVideo(v){if(!v)return;v.play().catch(()=>{if(!v.muted){v.muted=true;v.play().catch(()=>{})}})}
function tvCurrent(){normalizeTvScreen();return state.tvScreen;}
function tvPage(){
  const s=tvCurrent();
  return `<main class="tv-screen" id="tvScreen" data-kind="${esc(s.kind||'black')}">
    <div class="tv-stage" id="tvStage"></div>
    <div class="tv-overlay-ui" id="tvOverlayUi"><span class="tv-live-dot">●</span><span id="tvSceneTitle">${esc(s.title||'')}</span></div>
    <button class="tv-fullscreen-btn" id="tvFullscreen" title="Tela cheia">⛶</button>
    <div class="tv-start-overlay" id="tvStartOverlay"><button type="button" class="btn primary tv-start-btn" id="tvStartButton" autofocus>▶ Iniciar Tela da TV</button><p>Um toque aqui (ou "OK" no controle) libera o som dos vídeos e entra em tela cheia.</p></div>
  </main>`;
}
function tvStageMarkup(s){
  const kind=s?.active?s.kind:'black';
  if(kind==='video'&&s.url)return `<video id="tvVideo" autoplay playsinline ${s.loop?'loop':''} src="${esc(s.url)}"></video>`;
  if(kind==='image'&&s.url)return `<img id="tvImage" src="${esc(s.url)}" alt="">`;
  if(kind==='red')return `<div class="tv-solid tv-red"></div>`;
  return `<div class="tv-solid tv-black"></div>`;
}
function applyTvCommand(next,transition=true){
  const s={...defaultTvScreen(),...(next||{})};state.tvScreen=s;
  const screen=document.getElementById('tvScreen'),stage=document.getElementById('tvStage');
  if(!screen||!stage)return;
  const title=document.getElementById('tvSceneTitle');if(title)title.textContent=s.title||'';
  const finish=()=>{
    screen.dataset.kind=s.active?s.kind:'black';
    screen.classList.remove('tv-fading');
  };
  if(s.active&&s.kind==='video'&&s.url){
    const old=stage.querySelector('video');
    const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.preload='auto';v.loop=!!s.loop;if(s.upscale)v.crossOrigin='anonymous';v.src=s.url;v.className='tv-layer tv-enter';
    stage.appendChild(v);if(s.upscale)tvEnhanceVideo(v,stage);
    const swap=()=>{if(!v.isConnected)return;v.classList.remove('tv-enter');v.classList.add('tv-visible');if(v._tvCv){v._tvCv.classList.remove('tv-enter');v._tvCv.classList.add('tv-visible')}if(old&&old!==v){old.classList.add('tv-exit');old._tvCv?.classList.add('tv-exit');setTimeout(()=>{old._tvCv?.remove();old.remove()},280)}finish();playTvVideo(v)};
    v.addEventListener('canplay',swap,{once:true});
    let retried=false;const onErr=()=>{if(v._tvCv&&!retried){retried=true;v._tvCv.remove();v._tvCv=null;v.removeAttribute('crossorigin');v.src=s.url;v.addEventListener('error',onErr,{once:true});v.load();return}if(!old)v.remove();finish()};
    v.addEventListener('error',onErr,{once:true});
    v.load();
    if(!old)screen.classList.add('tv-fading');
    return;
  }
  screen.classList.add('tv-fading');
  setTimeout(()=>{
    if(!stage.isConnected)return;
    stage.innerHTML=tvStageMarkup(s);finish();
    requestAnimationFrame(()=>screen.classList.remove('tv-fading'));
    const v=document.getElementById('tvVideo');if(v)playTvVideo(v);
  },220);
}
function tvAdmin(){
  const scenes=Array.isArray(state.tvScenes)?state.tvScenes:[];
  const tvUrl=`${location.origin}${location.pathname}?tv=1`;
  return `<div class="card tv-admin">
    <div class="row space"><div><span class="section-kicker">TELA DA TV</span><h2>Cinemáticas da mesa</h2>
    <p class="small muted">O Mestre controla esta tela remotamente. A TV/dispositivo abre o endereço da Tela da TV e recebe as cenas pela sincronização global.</p></div>
    <a class="btn gold" href="${esc(safeHref(tvUrl))}" target="_blank" rel="noopener">Abrir Tela da TV</a>
    <button type="button" class="btn" id="copyTvUrl">Copiar link</button></div>
    <div class="tv-connect-note"><strong>Endereço da Tela da TV</strong><code>${esc(tvUrl)}</code><span>Fire TV Stick: instale o navegador "Silk Browser" (ou "Firefox for Fire TV") pela Amazon Appstore, abra-o e digite/cole este endereço. Depois de abrir, dê um OK no botão "Iniciar Tela da TV" que aparece na tela — isso libera o som dos vídeos no controle remoto. Roku: o site não consegue instalar/controlar um app Roku por conta própria; use um dispositivo com navegador (Fire TV, tablet, notebook) ligado à TV.</span></div>
    <div class="tv-upload-grid">
      <div class="field"><label>Nome da cinemática</label><input id="tvSceneName" placeholder="Ex.: A porta se abre"></div>
      <div class="field"><label>Vídeo local</label><input id="tvSceneFile" type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.ogg"></div>
      <div class="field"><label>Ou URL direta</label><input id="tvSceneUrl" placeholder="https://.../cena.mp4"></div>
      <label class="checkline"><input id="tvSceneLoop" type="checkbox"> Repetir em loop</label>
      <label class="checkline"><input id="tvSceneUpscale" type="checkbox"> Melhorar para 4K (ampliação + nitidez na TV)</label>
      <button class="btn primary" id="saveTvScene">+ Adicionar cinemática</button>
    </div>
    <div class="tv-quick-grid">
      <button class="btn danger" id="tvRed">🔴 Tela vermelha</button>
      <button class="btn" id="tvBlack">■ Tela preta</button>
    </div>
    <div class="tv-library">${scenes.length?scenes.map(s=>`<article class="tv-scene-card"><div class="tv-scene-thumb">${s.kind==='video'?'▶':s.kind==='image'?'▧':'●'}</div><div><strong>${esc(s.name)}</strong><small>${s.upscale?'4K • ':''}${s.loop?'Loop • ':''}Cinemática</small></div><div class="row"><button class="btn small primary" data-tv-play="${esc(s.id)}">Exibir</button><button class="btn small" data-tv-4k="${esc(s.id)}">4K: ${s.upscale?'ligado':'desligado'}</button><button class="btn small danger" data-tv-delete="${esc(s.id)}">Excluir</button></div></article>`).join(''):'<div class="empty">Nenhuma cinemática cadastrada ainda.</div>'}</div>
  </div>`;
}
function bindTvAdmin(){
  document.getElementById('copyTvUrl')?.addEventListener('click',async()=>{
    const url=`${location.origin}${location.pathname}?tv=1`;
    try{await navigator.clipboard.writeText(url);toast('Link da Tela da TV copiado.')}
    catch{toast('Não foi possível copiar automaticamente. Selecione o link acima manualmente.')}
  });
  document.getElementById('saveTvScene')?.addEventListener('click',async()=>{
    const btn=document.getElementById('saveTvScene'),file=document.getElementById('tvSceneFile')?.files?.[0],url=document.getElementById('tvSceneUrl')?.value.trim()||'',name=document.getElementById('tvSceneName')?.value.trim()||file?.name?.replace(/\.[^.]+$/,'')||'Cinemática',loop=!!document.getElementById('tvSceneLoop')?.checked,upscale=!!document.getElementById('tvSceneUpscale')?.checked;
    if(!file&&!url){toast('Escolha um vídeo ou informe uma URL direta.');return}
    if(file&&!/^(mp4|webm|mov|m4v|ogv|ogg)$/.test((file.name.split('.').pop()||'').toLowerCase())){toast('Formato não suportado. Use MP4, WebM, MOV, M4V ou OGV.');return}
    if(!file&&!/^https?:\/\//i.test(url)){toast('A URL precisa começar com http:// ou https://');return}
    try{
      btn.disabled=true;btn.textContent='Enviando...';
      let remoteUrl=url;
      if(file){
        if(!remoteEnabled){toast('Para a TV receber um vídeo local em outro dispositivo, configure o Supabase.');return}
        if(file.size>200*1024*1024){toast('O vídeo deve ter até 200 MB.');return}
        const ext=(file.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp4';
        remoteUrl=await uploadGlobalFile(`tv/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`,file);
        if(!remoteUrl)throw new Error('URL pública não disponível');
      }
      state.tvScenes=Array.isArray(state.tvScenes)?state.tvScenes:[];
      state.tvScenes.push({id:`tv-${Date.now()}`,name,url:remoteUrl,kind:'video',loop,upscale,createdAt:Date.now()});
      await saveGlobalNow();toast('Cinemática adicionada e sincronizada.');document.getElementById('adminContent').innerHTML=tvAdmin();bindTvAdmin();
    }catch(e){toast(`Não foi possível salvar a cinemática: ${e?.message||'erro'}`)}
    finally{btn.disabled=false;btn.textContent='+ Adicionar cinemática'}
  });
  document.querySelectorAll('[data-tv-play]').forEach(b=>b.onclick=async()=>{
    const scene=tvSceneById(b.dataset.tvPlay);if(!scene)return;
    state.tvScreen={active:true,kind:scene.kind||'video',url:scene.url||'',title:scene.name||'',loop:!!scene.loop,upscale:!!scene.upscale,commandAt:Date.now(),updatedAt:Date.now()};
    await saveGlobalNow().catch(()=>{});
    broadcastLive('tv-scene',{screen:state.tvScreen}).catch(()=>{});
    toast(`Exibindo: ${scene.name}`);
  });
  document.querySelectorAll('[data-tv-4k]').forEach(b=>b.onclick=async()=>{
    const scene=tvSceneById(b.dataset.tv4k);if(!scene)return;
    scene.upscale=!scene.upscale;await saveGlobalNow().catch(()=>{});
    document.getElementById('adminContent').innerHTML=tvAdmin();bindTvAdmin();
  });
  document.getElementById('tvRed')?.addEventListener('click',async()=>{
    state.tvScreen={...defaultTvScreen(),active:true,kind:'red',title:'',commandAt:Date.now(),updatedAt:Date.now()};
    await saveGlobalNow().catch(()=>{});broadcastLive('tv-scene',{screen:state.tvScreen}).catch(()=>{});toast('Tela vermelha enviada para a TV.');
  });
  document.getElementById('tvBlack')?.addEventListener('click',async()=>{
    state.tvScreen={...defaultTvScreen(),commandAt:Date.now(),updatedAt:Date.now()};
    await saveGlobalNow().catch(()=>{});broadcastLive('tv-scene',{screen:state.tvScreen}).catch(()=>{});toast('Tela da TV apagada.');
  });
  document.querySelectorAll('[data-tv-delete]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.tvDelete;if(!confirm('Excluir esta cinemática?'))return;
    state.tvScenes=(state.tvScenes||[]).filter(s=>String(s.id)!==String(id));await saveGlobalNow().catch(()=>{});
    document.getElementById('adminContent').innerHTML=tvAdmin();bindTvAdmin();
  });
}
function bindTvPage(){
  applyTvCommand(tvCurrent(),false);
  document.getElementById('tvFullscreen')?.addEventListener('click',()=>document.documentElement.requestFullscreen?.().catch(()=>{}));
  const startBtn=document.getElementById('tvStartButton'),startOverlay=document.getElementById('tvStartOverlay');
  startBtn?.focus();
  startBtn?.addEventListener('click',()=>{
    document.documentElement.requestFullscreen?.().catch(()=>{});
    const v=document.querySelector('#tvStage video');
    if(v){v.muted=false;v.play().catch(()=>{})}
    startOverlay?.remove();
  });
  if(!tvVisibilityBound){
    tvVisibilityBound=true;
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&currentView==='tv')applyTvCommand(tvCurrent(),false)});
    window.addEventListener('pageshow',e=>{if(e.persisted&&currentView==='tv')applyTvCommand(tvCurrent(),false)});
  }
}
let tvVisibilityBound=false;
function handleTvLive(payload){
  if(payload?.screen)applyTvCommand(payload.screen,true);
}
function combatStartLive(payload){try{navigator.vibrate?.(120)}catch{}}

function siteBrandAdmin(){const b=siteBrand();return `<div class="card"><div class="row space"><div><span class="section-kicker">IDENTIDADE DO SITE</span><h2>Nome e símbolo principal</h2><p class="small muted">O Mestre pode trocar o nome exibido no topo, na entrada e nos títulos do site, além da imagem amarela principal.</p></div></div><div class="input-grid"><div class="field"><label>Nome principal do site</label><input id="siteBrandName" value="${esc(b.name)}" placeholder="Ex.: Por Slash"></div><div class="field"><label>Imagem principal</label><input id="siteBrandImage" type="file" accept="image/png,image/jpeg,image/webp,image/avif,.jfif"></div></div><div class="brand-admin-preview"><img id="siteBrandPreview" src="${esc(b.image)}" alt="Imagem principal"><div><strong>${esc(b.name)}</strong><small>Pré-visualização da marca.</small></div></div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" id="clearSiteBrandImage">Restaurar imagem amarela</button><button class="btn primary" id="saveSiteBrand">Salvar identidade</button></div></div>`}
function bindSiteBrand(){const preview=document.getElementById('siteBrandPreview');const input=document.getElementById('siteBrandImage');input?.addEventListener('change',()=>{const f=input.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Imagem inválida ou maior que 40 MB.');input.value='';return}if(preview){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);const u=URL.createObjectURL(f);preview.dataset.objectUrl=u;preview.src=u;}});document.getElementById('clearSiteBrandImage')?.addEventListener('click',()=>{state.siteBrand=state.siteBrand||{};state.siteBrand.image='runa-gold.png';save();applySiteBrand();toast('Imagem principal restaurada.');document.getElementById('adminContent').innerHTML=siteBrandAdmin();bindSiteBrand()});document.getElementById('saveSiteBrand')?.addEventListener('click',async()=>{const name=document.getElementById('siteBrandName')?.value.trim()||'Ashen Testimony';const f=input?.files?.[0];try{let image=state.siteBrand?.image||'runa-gold.png';if(f){if(!remoteEnabled){const data=await imageFileToDataURL(f,900,.82);image=data}else{const ext=(f.name.split('.').pop()||'png').replace(/[^a-z0-9]/gi,'')||'png';image=await uploadGlobalFile(`branding/site-${Date.now()}.${ext}`,f);if(!image)throw new Error('URL da imagem não disponível')}}state.siteBrand={name,image};await saveGlobalNow();applySiteBrand();toast('Identidade do site atualizada globalmente.');render('master')}catch(e){toast('Não foi possível salvar a identidade do site.')}})}

function recoveryAdmin(){return `<div class="card"><div class="row space"><div><span class="section-kicker">SEGURANÇA</span><h2>Recuperação de dados</h2><p class="small muted">Backups locais e remotos protegem a campanha. Players excluídos também ficam em uma lixeira local até serem restaurados ou removidos definitivamente.</p></div></div><div class="row"><button class="btn primary" id="restoreLatestLocal">Restaurar último backup local</button><button class="btn" id="makeRecoveryNow">Criar backup agora</button><button class="btn" id="restoreRemoteBackup">Ver backups do Supabase</button><button class="btn" id="exportEmergencyBackup">Exportar backup de emergência</button><button class="btn" id="runIntegrityCheck">Verificar integridade</button></div><div id="recoveryList" class="recovery-list"></div><div class="divider"></div><div class="row space"><div><span class="section-kicker">LIXEIRA DE PLAYERS</span><h3>Players excluídos</h3><p class="small muted">Uma cópia local permite recuperar uma exclusão confirmada no servidor. A restauração usa uma operação exclusiva do Mestre.</p></div><button class="btn small" id="refreshPlayerTrash">Atualizar</button></div><div id="playerTrashList" class="recovery-list"></div></div>`}
async function bindRecovery(){document.getElementById('makeRecoveryNow')?.addEventListener('click',async()=>{await saveLocalRecovery('backup-manual');await integrityAudit('manual-snapshot');toast('Backup local criado.');});document.getElementById('exportEmergencyBackup')?.addEventListener('click',exportCampaignEmergency);document.getElementById('runIntegrityCheck')?.addEventListener('click',()=>{const r=campaignIntegrityReport();integrityAudit('integrity-check',r);toast(r.ok?`Integridade OK: ${r.players} Players, ${r.uniqueIds} IDs únicos.`:`Atenção: ${r.duplicates.length} duplicados, ${r.missingId.length} sem ID, ${r.invalid.length} inválidos.`)});document.getElementById('restoreLatestLocal')?.addEventListener('click',async()=>{if(!confirm('Restaurar o último backup local? O estado atual será salvo antes da restauração.'))return;try{await restoreLocalRecovery()}catch(e){toast(e?.message||'Não foi possível restaurar.')}});document.getElementById('restoreRemoteBackup')?.addEventListener('click',async()=>{const box=document.getElementById('recoveryList');if(!box)return;box.innerHTML='<div class="empty">Carregando backups...</div>';try{const rows=await listGlobalBackups(20);box.innerHTML=rows.length?rows.map((r,i)=>`<div class="recovery-row"><div><strong>Backup ${i+1}</strong><small>${new Date(r.updated_at).toLocaleString('pt-BR')}</small></div><button class="btn small" data-remote-recovery="${esc(r.id)}">Restaurar</button></div>`).join(''):'<div class="empty">Nenhum backup remoto disponível ainda.</div>';box.querySelectorAll('[data-remote-recovery]').forEach(b=>b.onclick=async()=>{const rows2=await listGlobalBackups(20),r=rows2.find(x=>x.id===b.dataset.remoteRecovery);if(!r?.data)return;if(!confirm('Restaurar este backup remoto? O estado atual será salvo antes.'))return;try{await saveLocalRecovery('antes-da-restauracao-remota');const d=clone(r.data);delete d.__backup;remoteApplying=true;mergeGlobal(d);await pushGlobalTracked(globalPayload());remoteApplying=false;storageSet(KEY,serializeState());render('master');toast('Backup remoto restaurado.')}catch(e){remoteApplying=false;toast(e?.message||'Falha ao restaurar backup remoto.')}})}catch(e){box.innerHTML='<div class="empty">Não foi possível consultar os backups.</div>'}})
async function renderPlayerTrash(){const box=document.getElementById('playerTrashList');if(!box)return;const rows=await getPlayerTrash();box.innerHTML=rows.length?rows.map(r=>`<div class="recovery-row"><div><strong>${esc(r.player?.name||r.player?.login||'Player')}</strong><small>Excluído em ${esc(new Date(r.deletedAt).toLocaleString('pt-BR'))}</small></div><button class="btn small primary" data-restore-player="${esc(r.id)}">Restaurar</button></div>`).join(''):'<div class="empty">A lixeira está vazia.</div>';box.querySelectorAll('[data-restore-player]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await restoreDeletedPlayerFromTrash(b.dataset.restorePlayer);toast('Player restaurado com sucesso.');render('master')}catch(e){toast(authErrorText(e));b.disabled=false}})}
document.getElementById('refreshPlayerTrash')?.addEventListener('click',renderPlayerTrash);await renderPlayerTrash();
}
const MASTER_MAIN_TABS=[['players','Players'],['map','Mapa'],['monsters','Monstros'],['classes','Classes'],['items','Itens'],['music','Trilha']];
function masterTabsMarkup(){const cur=adminTabCurrent||'players';const isMain=MASTER_MAIN_TABS.some(x=>x[0]===cur);return `<div class="panel-tabs">${MASTER_MAIN_TABS.map(([k,l])=>`<button type="button" class="${cur===k?'active':''}" data-tab="${esc(k)}">${esc(l)}</button>`).join('')}<button type="button" id="masterMoreBtn" class="master-more-btn ${isMain?'':'has-active'}" aria-haspopup="dialog" aria-expanded="false">Mais ferramentas <span aria-hidden="true">⌄</span></button></div>`}
function adminTabContent(t){return t==='players'?playersAdmin():t==='load'?loadAdmin(APP_VERSION):t==='map'?campaignMapPage(state,true,null):t==='monsters'?monstersAdmin():t==='classes'?classesAdmin():t==='items'?itemsAdmin():t==='sounds'?soundsAdmin():t==='secrets'?secretCluesAdmin():t==='symbols'?symbolsAdmin():t==='spells'?spellsAdmin():t==='content'?contentAdmin():t==='backgrounds'?backgroundsAdmin():t==='branding'?siteBrandAdmin():t==='tv'?tvAdmin():t==='recovery'?recoveryAdmin():t==='trash'?trashAdmin():musicAdmin()}
const MASTER_TOOLS=[['sounds','♪','Soundboard','Efeitos sonoros para tocar na mesa'],['secrets','✦','Pistas secretas','Segredos entregues aos Players'],['symbols','☉','Símbolos','Símbolos e ícones da campanha'],['spells','✧','Magias','Criar magias, custo em Sanidade, rituais e quem as conhece'],['content','❖','Conteúdo','Atributos, perícias, condições e habilidades'],['backgrounds','▣','Fundos','Planos de fundo do site'],['branding','◈','Identidade','Nome e brasão do site'],['tv','▶','Tela da TV','Cinemáticas e cenas'],['recovery','⟲','Recuperação','Backups e restauração'],['trash','⌫','Lixeira','Restaurar monstros, itens e conteúdo excluídos'],['load','⚙','Teste de carga','Diagnóstico de desempenho']];
function admin(){return shell(`<section class="hero master-hero"><div><span class="badge">MESTRE</span><h1>Câmara do Mestre</h1><p>Gerenciamento completo de Players, Monstros, classes, itens e trilha.</p></div><span class="app-version-corner">${APP_VERSION}</span></section>${masterTabsMarkup()}<div id="adminContent">${adminTabContent(adminTabCurrent)}</div>`,'master')}
window.__aProfeciaMaintenanceContext=()=>({guardian:{state:sessionGuardian.state,message:sessionGuardian.message,lastCheck:sessionGuardian.lastCheck},session:{role:state.session?.role||'',playerId:state.session?.playerId||'',login:state.session?.login||''},players:{count:Array.isArray(state.players)?state.players.filter(p=>!p.deletedAt&&!p._deleted&&!p.deleted_at).length:0,readOnly:!!ps.readOnly,circuitOpen:!!ps.circuitOpen,lastSyncAt:ps.lastSyncAt||0},stress:window.__aProfeciaStressReport||null,remoteEnabled:!!remoteEnabled});
window.__aProfeciaMaintenanceRecover=async()=>{try{await runSessionGuardian('maintenance');return true}catch(e){console.warn('Falha na recuperação segura:',e);return false}};
function updateSessionGuardian(stateName,message){sessionGuardian.state=stateName;sessionGuardian.message=message;sessionGuardian.lastCheck=Date.now();const el=document.getElementById('siteStatusIndicator');if(el){const map={ok:['🟢','SITE OK'],attention:['🟡','ATENÇÃO'],offline:['🔴','OFFLINE'],checking:['🔵','VERIFICANDO'],session:['🟣','SESSÃO']};const [icon,label]=map[stateName]||map.checking;el.className=`site-status-indicator status-${stateName}`;el.title=message;el.innerHTML=`<span>${icon}</span><b>${label}</b>`;el.setAttribute('aria-label',message)}}
function guardianSummary(){const last=ps.lastSyncAt?`Última sincronização: ${new Date(ps.lastSyncAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Ainda não confirmada nesta abertura';return `Guardião da Sessão\n${sessionGuardian.message}\n${last}`;}
async function runSessionGuardian(reason='timer'){if(sessionGuardianBusy)return;sessionGuardianBusy=true;updateSessionGuardian('checking','Verificando conexão, sessão e sincronização…');try{if(navigator.onLine===false){sessionGuardian.failures++;updateSessionGuardian('offline','Sem conexão de rede. Dados locais preservados; aguardando reconexão.');return}const token=getAuthToken();if(remoteEnabled&&!token){updateSessionGuardian('session','Nenhuma sessão autenticada nesta aba.');return}if(remoteEnabled&&token){try{const who=await authCheck();if(!who){updateSessionGuardian('session','A sessão não foi confirmada pelo servidor.');return}}catch(e){const msg=String(e?.message||e||'');if(/SESSAO_INVALIDA|SESSAO_INVALIDA|NAO_AUTORIZADO/.test(msg.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').toUpperCase())){updateSessionGuardian('session','O servidor rejeitou a sessão. É necessário entrar novamente.');return}sessionGuardian.failures++;updateSessionGuardian('attention','Servidor temporariamente indisponível; tentando novamente sem alterar seus dados.');return}}if(playerStoreEnabled&&state.session?.role){try{if(ps.circuitOpen){sessionGuardian.failures++;updateSessionGuardian('attention','Proteção de sincronização ativa após teste de carga/anomalia. Aguarde a revisão do Mestre.');return}if(!ps.hydrated)await hydratePlayersDb();if(ps.hydrated&&!ps.syncBusy)await syncPlayersDbNow();if(ps.readOnly){sessionGuardian.failures++;updateSessionGuardian('attention','Sincronização dos Players pausada após uma falha; aguardando recuperação segura.');return}}catch(e){sessionGuardian.failures++;updateSessionGuardian('attention','Falha temporária na sincronização; os dados locais foram preservados.');return}}sessionGuardian.failures=0;updateSessionGuardian('ok','Conexão, sessão e sincronização estão respondendo normalmente.')}finally{sessionGuardianBusy=false}}
function bindSessionGuardian(){if(sessionGuardianBound)return;sessionGuardianBound=true;const check=()=>{clearTimeout(sessionGuardianTimer);sessionGuardianTimer=setTimeout(()=>runSessionGuardian('event'),350)};window.addEventListener('online',check);window.addEventListener('offline',()=>updateSessionGuardian('offline','Sem conexão de rede. Dados locais preservados; aguardando reconexão.'));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});document.addEventListener('click',e=>{const b=e.target.closest?.('#siteStatusIndicator');if(!b)return;toast(guardianSummary())});sessionGuardianTimer=setTimeout(()=>runSessionGuardian('boot'),1200);setInterval(()=>runSessionGuardian('timer'),45000)}
function sessionDiagnosticsMarkup(){const online=navigator.onLine!==false;const sessionOk=!!state.session?.role;const syncOk=!!ps.lastSyncAt&&ps.hydrated&&!ps.readOnly;return `<section class="card session-diagnostics" id="sessionDiagnostics" style="margin-bottom:12px"><div class="row space"><div><span class="section-kicker">DIAGNÓSTICO DA SESSÃO</span><h3 style="margin:4px 0">Status do sistema</h3><p class="small muted">Use esta verificação antes e durante a sessão para confirmar conexão, sessão e sincronização.</p></div><button class="btn" id="runSessionDiagnostics">↻ Verificar agora</button></div><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px"><span class="badge" id="diagOnline">${online?'🟢 ONLINE':'🔴 OFFLINE'}</span><span class="badge" id="diagSession">${sessionOk?'🟢 SESSÃO VÁLIDA':'🔴 SEM SESSÃO'}</span><span class="badge" id="diagSupabase">${playerStoreEnabled?'🟢 SUPABASE ATIVO':'🔴 SUPABASE INDISPONÍVEL'}</span><span class="badge" id="diagPlayers">${state.players.length} PLAYERS CARREGADOS</span><span class="badge" id="diagSync">${syncOk?'🟢 SINCRONIZAÇÃO CONFIRMADA':'🟡 SINCRONIZAÇÃO A CONFIRMAR'}</span></div><p class="tiny muted" id="diagDetails" style="margin:9px 0 0">${ps.lastSyncAt?`Última sincronização: ${new Date(ps.lastSyncAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Ainda não houve confirmação de sincronização nesta abertura.'}</p></section>`}
function bindSessionDiagnostics(){const b=document.getElementById('runSessionDiagnostics');if(!b)return;b.onclick=async()=>{const old=b.textContent;b.disabled=true;b.textContent='Verificando...';try{const online=navigator.onLine!==false;let sessionValid=!!state.session?.role;if(remoteEnabled&&getAuthToken()){const checked=await authCheck();sessionValid=!!checked;if(!checked)toast('A sessão precisa ser autenticada novamente.')}if(playerStoreEnabled&&sessionValid&&online){ps.circuitOpen=false;await hydratePlayersDb();if(ps.hydrated)await syncPlayersDbNow(true)}const set=(id,t)=>{const e=document.getElementById(id);if(e)e.textContent=t};set('diagOnline',online?'🟢 ONLINE':'🔴 OFFLINE');set('diagSession',sessionValid?'🟢 SESSÃO VÁLIDA':'🔴 SEM SESSÃO');set('diagSupabase',playerStoreEnabled?'🟢 SUPABASE ATIVO':'🔴 SUPABASE INDISPONÍVEL');set('diagPlayers',`${state.players.length} PLAYERS CARREGADOS`);set('diagSync',ps.lastSyncAt?'🟢 SINCRONIZAÇÃO CONFIRMADA':'🟡 SINCRONIZAÇÃO A CONFIRMAR');const d=document.getElementById('diagDetails');if(d)d.textContent=ps.lastSyncAt?`Última sincronização: ${new Date(ps.lastSyncAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Ainda não houve confirmação de sincronização.';toast('Diagnóstico concluído.')}catch(e){toast(authErrorText(e));}finally{b.disabled=false;b.textContent=old}}}
function playerMasterDossierMarkup(p){
  normalize(p);syncDerivedResources(p);const hpMax=derivedMax(p,'Corpo')||1,sanMax=derivedMax(p,'Sanidade')||0,c=derivedCombat(p),trained=trainedSkills(p);const books=(p.backpack||[]).map(b=>item(b.id)).filter(it=>it&&((it.bookPages?.length)||it.bookContent));
  return `<div class="modal" id="playerDossierModal"><div class="modal-card player-dossier-modal"><button class="modal-close" id="closePlayerDossier">×</button><div class="player-dossier-hero" style="--player-bg:url('${esc(safeImgSrc(p.homeWallpaper||p.photo||'/ritual.webp','/ritual.webp'))}')"><img src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt="Retrato"><div><span class="badge">FICHA DO PLAYER</span><h2>${esc(p.name||p.login)}</h2><p>${esc(p.class||'Classe não escolhida')} • ${esc(p.element||'Elemento não definido')} • ${esc(p.status||'Ativo')}</p></div></div><div class="player-dossier-actions"><label class="btn">🖼 Wallpaper<input id="dossierWallpaper" type="file" accept="image/png,image/jpeg,image/webp,.jfif" hidden></label><button class="btn" id="dossierPrint">🖨 Imprimir ficha</button><button class="btn" id="dossierEdit">Editar ficha</button><button class="btn" id="dossierBag">Abrir bolsa</button></div><section class="player-dossier-stats"><div><small>VIDA TOTAL</small><strong>${hpMax}</strong><span>${clamp(p.hp??hpMax,0,hpMax)} atual</span></div><div><small>SANIDADE TOTAL</small><strong>${sanMax}</strong><span>${clamp(p.sanity??sanMax,0,sanMax)} atual</span></div><div><small>SOCO BASE</small><strong>${esc(punchDamage(p))}</strong><span>Corpo + Força</span></div><div><small>ATQ / DEF</small><strong>${c.atk} / ${c.def}</strong><span>totais</span></div><div><small>DETERMINAÇÃO</small><strong>${detValues(p).cur}/${detValues(p).max}</strong><span>recurso</span></div></section><section class="player-dossier-grid"><article><span class="section-kicker">ATRIBUTOS TOTAIS</span><h3>Estado do personagem</h3><div class="dossier-attribute-grid">${allAttrs().map(a=>`<div><span>${uiAttrIcon(a)} ${esc(a)}</span><b>${effectiveAttr(p,a)}</b></div>`).join('')}</div></article><article><span class="section-kicker">PERÍCIAS TREINADAS</span><h3>O que ele sabe fazer</h3><div class="dossier-skill-list">${trained.length?trained.map(sk=>`<div><span>${uiSkillIcon(sk)} ${esc(sk)}</span><b>${effectiveSkill(p,sk)}</b></div>`).join(''):'<div class="empty">Nenhuma perícia treinada.</div>'}</div></article></section><section class="player-dossier-grid"><article><span class="section-kicker">RECURSOS</span><h3>Vida, sanidade e fome</h3>${resourceBarMarkup('Vida',p.hp,hpMax,'health',false)}${resourceBarMarkup('Sanidade',p.sanity,sanMax,'sanity',false)}${hungerBarMarkup(p)}</article><article><span class="section-kicker">MAGIA INICIAL</span><h3>${hasMagicClass(p.class)?esc(p.class):'Sem acesso inicial'}</h3>${hasMagicClass(p.class)?`<div class="field"><label>Escolher magia inicial</label><select id="dossierInitialSpell"><option value="">Nenhuma definida</option>${getSpells().map(sp=>`<option value="${esc(sp.id)}" ${p.initialSpell===sp.id?'selected':''}>${esc(sp.name)}</option>`).join('')}</select></div><button class="btn primary" id="saveDossierSpell">Salvar magia inicial</button>`:'<p class="small muted">Esta classe não recebe magia inicial automaticamente.</p>'}</article></section><section class="player-dossier-grid"><article><span class="section-kicker">ELEMENTO</span><h3>Alinhamento do personagem</h3><div class="element-choice-grid">${['Sangue','Morte','Energia','Conhecimento'].map(x=>`<button type="button" class="element-choice ${p.element===x?'active':''}" data-dossier-element="${esc(x)}">${esc(x)}</button>`).join('')}</div></article><article><span class="section-kicker">ESTADOS</span><h3>Condições atuais</h3>${conditionsMarkup(p,true)}</article></section><section class="player-dossier-grid"><article><span class="section-kicker">BOLSA</span><h3>${bagWeight(p)}/${bagCapacity(p)} espaços</h3><div class="dossier-bag-list">${(p.backpack||[]).map(b=>{const it=item(b.id);return it?`<div><span>${itemIcon(it)} ${esc(it.name)}</span><b>${b.qty||1}</b></div>`:''}).join('')||'<div class="empty">Bolsa vazia.</div>'}</div></article><article class="secret-master-panel"><span class="section-kicker">MESTRE • SEGREDO</span><h3>♥ Efeito apaixonado</h3><p class="tiny muted">Este campo é exclusivo do Mestre e não é renderizado na ficha do Player.</p><textarea id="dossierSecretLoved" rows="4" placeholder="Descreva o efeito secreto...">${esc(p.secretLovedEffect||'')}</textarea><button class="btn danger" id="saveDossierSecret">Salvar segredo</button></article></section><section class="player-dossier-books"><span class="section-kicker">LEITURA</span><h3>Livros carregados na bolsa</h3><div class="row">${books.length?books.map(it=>`<button class="btn small" data-dossier-book="${esc(it.id)}">▤ ${esc(it.name)}</button>`).join(''):'<span class="small muted">Nenhum livro na bolsa.</span>'}</div></section></div></div>`;
}
function openPlayerMasterDossier(id){const p=state.players.find(x=>String(x.id)===String(id));if(!p)return;openModal(playerMasterDossierMarkup(p));const close=()=>document.getElementById('playerDossierModal')?.remove();document.getElementById('closePlayerDossier').onclick=close;getPlayerMasterSecret(p.id).then(r=>{const field=document.getElementById('dossierSecretLoved');if(field)field.value=String(r?.secret_loved_effect||'')}).catch(()=>{});document.getElementById('dossierEdit').onclick=()=>{close();openEntity('player',state.players.indexOf(p))};document.getElementById('dossierBag').onclick=()=>{close();openModal(bagAdminModal(state.players.indexOf(p)));bindBagAdmin(state.players.indexOf(p))};document.getElementById('dossierPrint').onclick=()=>printPlayerPhysicalSheet(p.id);document.getElementById('dossierWallpaper')?.addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Wallpaper inválido ou maior que 40 MB.');return}toast('Enviando wallpaper…');try{p.homeWallpaper=await imageFileToRemoteURL(f,`players/${p.id}/wallpaper.webp`,1600,.84);p._syncUpdatedAt=nextStamp();save();await syncPlayersDbNow(true);toast('Wallpaper do Player salvo.');close();openPlayerMasterDossier(p.id)}catch(err){console.error(err);toast('Não foi possível salvar o wallpaper.')}});document.getElementById('saveDossierSpell')?.addEventListener('click',async()=>{p.initialSpell=document.getElementById('dossierInitialSpell')?.value||'';p._syncUpdatedAt=nextStamp();save();await syncPlayersDbNow(true).catch(()=>{});toast('Magia inicial atualizada.');close();openPlayerMasterDossier(p.id)});document.querySelectorAll('[data-dossier-element]').forEach(b=>b.onclick=async()=>{p.element=b.dataset.dossierElement;p._syncUpdatedAt=nextStamp();save();await syncPlayersDbNow(true).catch(()=>{});toast(`Elemento de ${p.name||p.login}: ${p.element}.`);close();openPlayerMasterDossier(p.id)});document.querySelectorAll('#playerDossierModal .condition-chip').forEach(b=>b.onclick=async()=>{b.classList.toggle('active');const ids=[...document.querySelectorAll('#playerDossierModal .condition-chip.active')].map(x=>x.dataset.condition);p.conditions=ids;p.conditionTurns=p.conditionTurns||{};for(const id of ids){const c=conditionById(id);if(c?.turns&&!Number(p.conditionTurns[id]))p.conditionTurns[id]=c.turns}for(const id of Object.keys(p.conditionTurns)){if(!ids.includes(id))delete p.conditionTurns[id]}normalize(p);save();await syncPlayersDbNow(true).catch(()=>{});toast('Estados atualizados.');close();openPlayerMasterDossier(p.id)});document.getElementById('saveDossierSecret')?.addEventListener('click',async()=>{const secret=document.getElementById('dossierSecretLoved')?.value.trim()||'';try{await savePlayerMasterSecret(p.id,secret);p.secretLovedEffect=secret;toast('Efeito apaixonado secreto salvo pelo Mestre.')}catch(err){toast(authErrorText(err))}});document.querySelectorAll('[data-dossier-book]').forEach(b=>b.onclick=()=>openBookReader(Number(b.dataset.dossierBook)))}
function printPlayerPhysicalSheet(id){const p=state.players.find(x=>String(x.id)===String(id));if(!p)return;normalize(p);const hpMax=derivedMax(p,'Corpo')||1,sanMax=derivedMax(p,'Sanidade')||0;const attrs=allAttrs().map(a=>`<tr><th>${esc(a)}</th><td>${effectiveAttr(p,a)}</td></tr>`).join('');const skills=trainedSkills(p).map(sk=>`<tr><th>${esc(sk)}</th><td>${effectiveSkill(p,sk)}</td></tr>`).join('');const conditions=(p.conditions||[]).map(id=>conditionById(id)?.name).filter(Boolean).join(', ')||'Nenhuma';const w=window.open('','_blank','noopener,noreferrer');if(!w){toast('O navegador bloqueou a janela de impressão. Permita pop-ups para Ashen Testimony.');return}w.document.write(`<!doctype html><html><head><title>Ficha — ${esc(p.name||p.login)}</title><style>@page{size:A4;margin:12mm}body{font-family:Georgia,serif;color:#1d1615;background:#eee;margin:0}.sheet{background:#fff;padding:20px;border:2px solid #3b2420}.head{display:flex;gap:18px;border-bottom:2px solid #7a252b;padding-bottom:14px}.head img{width:90px;height:110px;object-fit:cover;border:1px solid #555}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.box{border:1px solid #bbb;padding:10px}.box h3{margin:0 0 7px;text-transform:uppercase;font-size:11px;letter-spacing:.12em;color:#7a252b}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:4px;border-bottom:1px solid #ddd;font-size:11px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.stat{border:1px solid #bbb;padding:7px}.stat b{display:block;font-size:17px;margin-top:3px}.footer{margin-top:18px;font-size:9px;color:#777}</style></head><body><main class="sheet"><header class="head"><img src="${esc(safeImgSrc(p.photo,''))}" onerror="this.style.display='none'"><div><h1>${esc(p.name||p.login)}</h1><p>${esc(p.class||'Sem classe')} • ${esc(p.element||'Elemento não definido')} • ${esc(p.status||'Ativo')}</p><p>Fome ${clamp(p.hunger??100,0,100)}% • Condições: ${esc(conditions)}</p></div></header><section class="stats" style="margin-top:14px"><div class="stat">Vida<b>${clamp(p.hp??hpMax,0,hpMax)}/${hpMax}</b></div><div class="stat">Sanidade<b>${clamp(p.sanity??sanMax,0,sanMax)}</b></div><div class="stat">Soco<b>${esc(punchDamage(p))}</b></div><div class="stat">Ataque<b>${derivedCombat(p).atk}</b></div><div class="stat">Defesa<b>${derivedCombat(p).def}</b></div></section><div class="grid"><section class="box"><h3>Atributos totais</h3><table>${attrs}</table></section><section class="box"><h3>Perícias treinadas</h3><table>${skills||'<tr><td>Nenhuma</td></tr>'}</table></section></div><div class="grid"><section class="box"><h3>Magia inicial</h3><p>${esc((getSpells().find(x=>x.id===p.initialSpell)||{}).name||'Nenhuma')}</p></section><section class="box"><h3>Alma / história</h3><p>${esc(p.soul||'')}</p><p>${esc(p.description||'')}</p></section></div><p class="footer">Ashen Testimony • Ficha física gerada pelo Mestre • ${new Date().toLocaleString('pt-BR')}</p></main><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);w.document.close()}
function playerMasterCard(p,i){
 normalize(p);const c=derivedCombat(p),hpMax=derivedMax(p,'Corpo')||1,sanMax=derivedMax(p,'Sanidade')||0;const skills=trainedSkills(p).slice(0,6),wallpaper=p.homeWallpaper||p.photo||'/ritual.webp';
 return `<article class="player-command-card" style="--player-bg:url('${esc(safeImgSrc(wallpaper,'/ritual.webp'))}')"><div class="player-command-cover"><img src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt="" loading="lazy"><div class="player-command-cover-fade"></div><div class="player-command-name"><span>${esc(p.element||'ELEMENTO NÃO DEFINIDO')}</span><h3>${esc(p.name||p.login||'Player')}</h3><small>${esc(p.class||'Classe não escolhida')} • ${esc(p.status||'Ativo')}</small></div></div><div class="player-command-body"><div class="player-total-grid"><div><small>VIDA</small><b>${clamp(p.hp??hpMax,0,hpMax)} / ${hpMax}</b></div><div><small>SANIDADE</small><b>${clamp(p.sanity??sanMax,0,sanMax)} / ${sanMax}</b></div><div><small>SOCO</small><b>${esc(punchDamage(p))}</b></div><div><small>ATQ / DEF</small><b>${c.atk} / ${c.def}</b></div></div>${hungerBarMarkup(p)}<div class="player-skill-preview"><div class="section-kicker">PERÍCIAS TREINADAS</div>${skills.length?skills.map(sk=>`<span>${esc(sk)} <b>${effectiveSkill(p,sk)}</b></span>`).join(''):'<em>Nenhuma perícia treinada</em>'}</div><div class="player-command-actions"><button class="btn small primary" data-view-player-detail="${esc(p.id)}">Ficha</button><button class="btn small" data-edit-p="${esc(p.id||p.login||i)}">Editar</button><button class="btn small" data-bag-p="${esc(p.id||p.login||i)}">Bolsa</button><button class="btn small" data-print-player="${esc(p.id)}">Imprimir</button><button class="btn small" data-hist-p="${i}">Histórico</button><button class="btn small danger" data-del-p="${i}">Excluir</button></div></div></article>`;
}
function updateSyncHealthUI(){
  const h=syncHealth();
  const el=document.getElementById('playerSyncStatus');
  if(!el)return;
  const labels={synced:'🟢 Sincronizado',syncing:'🟡 Sincronizando…',pending:'🟠 Alteração pendente',offline:'🔴 Offline — salvo neste dispositivo',error:'🟠 Sincronização pendente',idle:'⚪ Aguardando sincronização'};
  const base=labels[h.state]||h.message||'Sincronização';
  const last=h.lastSuccessAt?` • ${new Date(h.lastSuccessAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'';
  el.textContent=`${base}${last}`;
}
function bindSyncHealthUI(){
  if(window.__aProfeciaSyncHealthBound)return;
  window.__aProfeciaSyncHealthBound=true;
  window.addEventListener('a-profecia-sync-status',updateSyncHealthUI);
  window.addEventListener('online',updateSyncHealthUI);
  window.addEventListener('offline',updateSyncHealthUI);
}

function playersAdmin(){
 const syncLabel=ps.lastSyncAt?`Última sincronização: ${new Date(ps.lastSyncAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Última sincronização ainda não confirmada';const stress=window.__aProfeciaStressReport||null;const stressLabel=stress?.status==='passed'?`🟢 Último teste: ${stress.virtualClients||20} Players simulados • ${stress.serverReads||0} leituras reais`:(stress?.status==='failed'?`🔴 Último teste encontrou falha: ${stress.message||'ver relatório'}`:'⚪ Nenhum teste de carga executado nesta abertura');const rules=state.rulesBook||{title:'Livro de Regras',url:'',kind:'url'};const books=(state.items||[]).filter(it=>(Array.isArray(it.bookPages)&&it.bookPages.some(Boolean))||it.bookContent);
 return `<div class="card players-admin-card player-command-center">${sessionDiagnosticsMarkup()}<header class="player-command-header"><div><span class="badge">CÂMARA DOS PLAYERS</span><h2>Central de personagens</h2><p>Preparação, leitura e controle das fichas em uma única aba.</p><p class="tiny muted" id="playerSyncStatus">${esc(syncLabel)}${navigator.onLine===false?' • OFFLINE':''}</p></div><div class="player-command-toolbar"><button class="btn" id="syncPlayersNow">↻ Sincronizar agora</button><button class="btn" id="openPointsManager">✦ Pontos</button><button class="btn" id="openCharacterRules">⚙ Limites</button><button class="btn" id="changeMasterPw">🔑 Senha</button><button class="btn primary" id="newPlayer">+ Criar Player</button></div></header><section class="player-overview-strip"><div><small>PLAYERS ATIVOS</small><strong>${state.players.length}</strong></div><div><small>COM MAGIA</small><strong>${state.players.filter(p=>hasMagicClass(p.class)).length}</strong></div><div><small>FOME ≤ 50%</small><strong>${state.players.filter(p=>(p.hunger??100)<=50).length}</strong></div><div><small>ESTADOS</small><strong>${state.players.filter(p=>(p.conditions||[]).length).length}</strong></div><div><small>CARGA</small><strong>${stress?.status==='passed'?'OK':'—'}</strong></div></section><details class="player-utilities"><summary>Ferramentas auxiliares <span>Livro de regras, biblioteca e criação rápida de armas</span></summary><section class="player-tools-grid"><article class="player-tool-card"><span class="section-kicker">LIVRO DE REGRAS</span><h3>${esc(rules.title||'Livro de Regras')}</h3><p class="small muted">Livro usado pelo Mestre durante a preparação.</p><div class="field"><label>Título</label><input id="rulesBookTitle" value="${esc(rules.title||'Livro de Regras')}"></div><div class="field"><label>Enviar PDF</label><input id="rulesBookFile" type="file" accept="application/pdf,.pdf"><small class="tiny muted">Até 25 MB. O arquivo vai para o armazenamento do projeto.</small></div><div class="field"><label>Ou PDF / URL</label><input id="rulesBookUrl" value="${esc(rules.url||'')}" placeholder="https://.../livro.pdf"></div><div class="row"><button class="btn primary" id="saveRulesBook">Salvar livro</button>${rules.url?`<a class="btn" href="${esc(safeHref(rules.url))}" target="_blank" rel="noopener">Abrir ↗</a>`:''}</div></article><article class="player-tool-card"><span class="section-kicker">BIBLIOTECA</span><h3>Livros para ler</h3><div class="player-books-list">${books.length?books.slice(0,8).map(it=>`<button class="player-book-row" data-read-book="${esc(it.id)}"><span>▤</span><strong>${esc(it.name)}</strong><small>${Array.isArray(it.bookPages)?it.bookPages.length:1} pág.</small></button>`).join(''):'<div class="empty">Nenhum livro cadastrado.</div>'}</div></article><article class="player-tool-card"><span class="section-kicker">OFICINA</span><h3>Armas</h3><p class="small muted">Crie armas sem sair da aba Players.</p><button class="btn gold" id="createWeaponQuick">⚔ Criar arma</button><button class="btn" id="openItemBankFromPlayers">Abrir Banco de Itens</button></article></section></details><div class="player-roster-title"><div><span class="section-kicker">ELENCO</span><h2>Fichas dos Players</h2></div><span class="corner-mark">${state.players.length} cadastrados</span></div><section class="player-command-grid">${state.players.length?state.players.map((p,i)=>playerMasterCard(p,i)).join(''):'<div class="empty">Nenhum Player cadastrado.</div>'}</section><div class="player-command-note"><strong>Modo sessão:</strong><span>fica separado no Centro de Controle; esta aba é preparação e administração.</span><button class="btn small" data-nav="home">Abrir modo sessão</button></div></div>`;
}

function bagAdminModal(index){const p=state.players[index],used=bagWeight(p);return `<div class="modal" id="bagModal"><div class="modal-card"><button class="modal-close" id="closeBag">×</button><h2>Mochila de ${esc(p.name)}</h2><p class="small ${used>MAX_BAG?'danger-text':'muted'}">${used}/${bagCapacity(p)} espaços usados. O peso é por unidade e varia de 1 a 3.</p><div class="searchbar"><div class="field"><label>ID ou nome do item</label><input id="bagSearch" placeholder="Ex.: 300 ou Chave"></div><div class="field"><label>Quantidade</label><input id="bagQty" type="number" min="1" value="1"></div><button class="btn primary" id="bagAddAdmin">Adicionar</button></div><div class="slot-grid" style="margin-top:14px">${Array.from({length:bagCapacity(p)},(_,i)=>{const b=p.backpack[i],it=b&&item(b.id);return `<div class="slot ${it?'filled':''}">${it?`<button data-bag-remove-admin="${i}">×</button><div class="slot-icon">${itemIcon(it)}</div><div class="slot-name">${esc(it.name)}</div>${isWeaponItem(it)?`<div class="slot-damage">⚔️ Dano: ${esc(it.damage||weaponDamageFallback(it))}</div>`:''}${String(it.category||'').toLowerCase().includes('livro')||it.bookContent?`<button class="book-read-btn" data-read-book="${esc(it.id)}">Ler</button>`:''}<div class="slot-id">ID ${esc(String(it.id).padStart(3,'0'))} • Peso ${Number(inferWeight(it))}</div><div class="slot-qty">Qtd. ${Number(b.qty)||0} • ${Number(inferWeight(it)*b.qty)} espaço${inferWeight(it)*b.qty===1?'':'s'}</div>`:'<div class="slot-icon" style="opacity:.15">◇</div><div class="small muted">Espaço vazio</div>'}</div>`}).join('')}</div></div></div>`}
function bindBagAdmin(index){const close=()=>document.getElementById('bagModal')?.remove();document.getElementById('closeBag').onclick=close;document.getElementById('bagAddAdmin').onclick=()=>{const p=state.players[index],q=document.getElementById('bagSearch').value.trim().toLowerCase(),it=state.items.find(x=>String(x.id)===q||x.name.toLowerCase().includes(q));if(!it){toast('Item não encontrado.');return}const qty=Math.max(1,Number(document.getElementById('bagQty').value)||1),weight=inferWeight(it),used=bagWeight(p),ex=p.backpack.find(x=>x.id===it.id),current=ex?.qty||0,maxByWeight=Math.floor((bagCapacity(p)-(used-weight*current))/weight),add=Math.min(it.maxQty-current,qty,maxByWeight);if(add<=0){toast('Não há espaço suficiente.');return}if(ex)ex.qty=current+add;else p.backpack.push({id:it.id,qty:add});save();close();toast('Item adicionado à mochila.');openModal(bagAdminModal(index));bindBagAdmin(index)};document.querySelectorAll('[data-bag-remove-admin]').forEach(b=>b.onclick=()=>{state.players[index].backpack.splice(Number(b.dataset.bagRemoveAdmin),1);save();close();openModal(bagAdminModal(index));bindBagAdmin(index)})}
function monstersAdmin(){return `<div class="card monster-bank"><div class="row space"><div><span class="section-kicker">BANCO DE CRIATURAS</span><h2>Monstros</h2><p class="small muted">Crie fichas reutilizáveis, acompanhe Vida/Sanidade e adicione qualquer criatura à iniciativa do combate.</p></div><button class="btn primary" id="newMonster">+ Criar Monstro</button></div><div class="searchbar monster-search"><div class="field"><label>Pesquisar criatura</label><input id="monsterSearch" placeholder="Nome do monstro..."></div></div><div id="monsterResults" class="monster-bank-grid"></div></div>`}
function renderMonsters(){const q=(document.getElementById('monsterSearch')?.value||'').toLowerCase().trim();const list=state.creatures.filter(m=>!q||String(m.name||'').toLowerCase().includes(q));const box=document.getElementById('monsterResults');if(!box)return;box.innerHTML=list.length?list.map(m=>{const i=state.creatures.indexOf(m);return `<article class="monster-bank-card"><div class="monster-bank-head"><div><span class="section-kicker">CRIATURA</span><h3>${esc(m.name)}</h3><small>${esc(m.status||'Ativo')} • ATQ ${m.attack||0} • DEF ${m.defense||0}${m.damage?` • Dano ${esc(m.damage)}`:''}</small>${m.description?`<p class="tiny muted">${esc(String(m.description).slice(0,140))}${String(m.description).length>140?'…':''}</p>`:''}</div><div class="monster-sigil">☠</div></div>${resourceBarMarkup('Vida',m.hp,m.hpMax,'health',false)}${resourceBarMarkup('Sanidade',m.sanity||0,m.sanityMax||derivedMax(m,'Sanidade'),'sanity',false)}<div class="monster-bank-actions"><button class="btn small" data-edit-m="${i}">Editar</button><button class="btn small" data-monster-damage="${i}" data-delta="-5">−5 Vida</button><button class="btn small" data-monster-damage="${i}" data-delta="5">+5 Vida</button><button class="btn small" data-round-m="${i}">+ Rodada</button><button class="btn small" data-roll-m-atk="${i}">Rolar ataque</button>${m.damage?`<button class="btn small" data-roll-m-dmg="${i}">Rolar dano</button>`:''}<button class="btn small" data-dup-m="${i}">Duplicar</button><button class="btn small danger" data-del-m="${i}">Excluir</button></div></article>`}).join(''):'<div class="empty">Nenhum monstro encontrado.</div>'}
function itemsAdmin(){return `<div class="card"><div class="row space"><div><h2>Banco de Itens</h2><p class="small muted">${state.items.length} itens • ID 300 reservado para a Chave.</p></div><div class="row"><button class="btn" id="newWeapon">+ Nova arma</button><button class="btn primary" id="newItem">+ Novo item</button></div></div><div class="searchbar" style="margin:15px 0"><div class="field"><label>ID ou nome</label><input id="itemSearch" placeholder="300 ou Chave"></div><div class="field"><label>Categoria</label><select id="itemCat"><option value="">Todas</option>${ITEM_CATS.map(c=>`<option>${c}</option>`).join('')}</select></div><div class="field"><label>Raridade</label><select id="itemRar"><option value="">Todas</option><option>Comum</option><option>Raro</option><option>Épico</option><option>Lendário</option></select></div><button class="btn" id="clearItems">Limpar</button></div><div id="itemResults"></div></div>`}
function renderItems(){const q=(document.getElementById('itemSearch')?.value||'').toLowerCase().trim(),cat=document.getElementById('itemCat')?.value||'',rar=document.getElementById('itemRar')?.value||'';const found=state.items.filter(i=>(!q||String(i.id)===q||i.name.toLowerCase().includes(q))&&(!cat||i.category===cat)&&(!rar||i.rarity===rar)).slice(0,80);document.getElementById('itemResults').innerHTML=found.length?`<div class="list">${found.map(i=>`<div class="item item-card"><div class="item-icon">${itemIcon(i)}</div><div class="item-meta"><strong>${esc(i.name)}</strong><div class="line">ID ${String(i.id).padStart(3,'0')} • ${esc(i.category)} • ${esc(i.rarity)} • Máx. ${Math.max(1,Number(i.maxQty)||1)} • Peso ${inferWeight(i)}</div><div class="small muted">${esc(i.description)}</div></div><div class="row"><button class="btn small" data-edit-item="${Number(i.id)}">Editar</button>${i.id!==300?`<button class="btn small danger" data-del-item="${Number(i.id)}">Excluir</button>`:''}</div></div>`).join('')}</div><p class="tiny muted">Até 80 resultados exibidos. Use a pesquisa para refinar.</p>`:'<div class="empty">Nenhum item encontrado.</div>'}
function nextItemId(){let n=Math.max(0,...state.items.map(i=>Number(i.id)||0))+1;if(n===300)n++;return n}
function itemModal(id=null,preset=null){
 const e=id===null?{id:nextItemId(),name:'',description:'',category:'Diversos',maxQty:10,icon:'✦',effects:'',rarity:'Comum',damage:'',bookPages:[],...(preset||{})}:clone(item(id));
 const pages=Array.isArray(e.bookPages)&&e.bookPages.length?e.bookPages:(e.bookContent?[String(e.bookContent)]:['']);
 return `<div class="modal" id="itemModal"><div class="modal-card"><button class="modal-close" id="closeItem">×</button><h2>${id===null?'Adicionar novo item':'Editar item'}</h2><div class="input-grid"><div class="field"><label>ID</label><input id="iId" type="number" value="${esc(e.id)}" ${id===300?'disabled':''}></div><div class="field"><label>Nome</label><input id="iName" value="${esc(e.name)}"></div><div class="field"><label>Categoria</label><select id="iCat">${ITEM_CATS.map(c=>`<option ${e.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Quantidade máxima</label><input id="iMax" type="number" min="1" value="${e.maxQty}"></div><div class="field"><label>Peso por unidade (1–3 espaços)</label><input id="iWeight" type="number" min="1" max="3" value="${inferWeight(e)}"></div><div class="field"><label>Ícone</label><input id="iIcon" value="${esc(e.icon)}"></div><div class="field"><label>Dano da arma</label><input id="iDamage" value="${esc(e.damage||'')}" placeholder="Ex.: 1d8"><small class="tiny muted">Usado quando o item é classificado como Armas ou Armas de Fogo.</small></div><div class="field"><label>Raridade</label><select id="iRar">${['Comum','Raro','Épico','Lendário'].map(r=>`<option ${e.rarity===r?'selected':''}>${esc(r)}</option>`).join('')}</select></div></div><div class="field"><label>Descrição</label><textarea id="iDesc" rows="3">${esc(e.description)}</textarea></div><div class="field"><label>Efeitos</label><textarea id="iEffects" rows="3">${esc(e.effects)}</textarea></div><div class="field"><label>Páginas do livro (opcional)</label><p class="tiny muted">Cada página é independente e o Player poderá navegar entre elas.</p><div id="bookPagesEditor">${pages.map((pg,i)=>`<div class="book-page-editor" data-page-index="${i}"><div class="row space"><strong>Página ${i+1}</strong>${pages.length>1?`<button type="button" class="btn small danger" data-remove-book-page="${i}">Excluir página</button>`:''}</div><textarea class="book-page-input" rows="8" placeholder="Escreva o conteúdo da página ${i+1}...">${esc(pg||'')}</textarea></div>`).join('')}</div><button type="button" class="btn small" id="addBookPage">+ Adicionar página</button></div><div class="row" style="justify-content:flex-end"><button class="btn" id="cancelItem">Cancelar</button><button class="btn primary" id="saveItem">Salvar item</button></div></div></div>`;
}
function musicAdmin(){
  const m=normalizeMusic();
  const clientId=spotifyClientId(),redirect=spotifyRedirectUri();
  return `<div class="music-sound-grid">
    <section class="music-admin-section">
      <div class="section-kicker">TRILHA GLOBAL DA CAMPANHA</div>
      <h3>Áudio para todos os Players</h3>
      <p class="small muted">Envie uma música para o Supabase Storage. Qualquer Player poderá ouvir, sem Spotify. O Mestre controla Play, Pause, Stop e Loop; cada pessoa escolhe apenas o próprio volume.</p>
      <div class="input-grid">
        <div class="field"><label>Nome da trilha</label><input id="musicTitle" value="${esc(m.title||'')}" placeholder="Ex.: Floresta do Abismo"></div>
      </div>
      <div class="field"><label>Enviar arquivo de áudio</label><input id="musicFile" type="file" accept="audio/*,.mp3,.mpeg,.wav,.ogg,.oga,.m4a,.aac,.flac,.opus,.webm"><small class="tiny muted">MP3 recomendado. Também aceita WAV, OGG, M4A, AAC, FLAC, OPUS e WEBM quando suportados pelo navegador. Até 50 MB.</small></div>
      <div class="field"><label>Ou URL direta de áudio</label><input id="musicUrl" value="${m.kind==='url'?esc(m.url||''):''}" placeholder="https://.../musica.mp3"></div>
      ${m.url?`<div class="music-current-admin"><strong>Atual:</strong> ${esc(m.title||'Trilha da campanha')} ${m.playing?'<span>● TOCANDO</span>':'<span>● PAUSADA</span>'}</div>`:''}<div class="music-library-admin"><div class="section-kicker">BIBLIOTECA PERSISTENTE</div>${(state.musicLibrary||[]).length?(state.musicLibrary||[]).map(t=>`<div class="music-library-row ${String(t.url)===String(m.url)?'active':''}"><div><strong>${esc(t.title||'Sem nome')}</strong><small>${esc(t.url||'')}</small></div><div class="row"><button class="btn small" data-use-global-music="${esc(t.id)}">Usar</button><button class="btn small danger" data-delete-global-music="${esc(t.id)}">Excluir</button></div></div>`).join(''):'<div class="empty">Nenhuma trilha salva.</div>'}</div>
      <div class="row"><button class="btn primary" id="saveMusic">Enviar / salvar trilha global</button><button class="btn danger" id="clearMusic">Remover trilha</button></div>
    </section>
    <section class="music-admin-section">
      <div class="section-kicker">SPOTIFY • OPCIONAL</div>
      <h3>Conta do Mestre</h3>
      <p class="small muted">Mantido para uso pessoal do Mestre. Para música compartilhada com todos, use o upload de áudio ao lado.</p>
      <div class="field"><label>Client ID</label><input id="spotifyClientId" value="${esc(clientId)}" placeholder="Client ID do Spotify for Developers"></div>
      <div class="field"><label>Redirect URI exata</label><input value="${esc(redirect)}" readonly></div>
      <div class="row"><button class="btn gold" id="spotifyLogin">${spotifyLogged()?'Spotify conectado':'Entrar com Spotify'}</button>${spotifyLogged()?'<button class="btn" id="spotifyLogout">Desconectar</button>':''}</div>
      <div class="spotify-admin-note">Spotify não é necessário para os Players ouvirem os arquivos enviados pelo Mestre.</div>
    </section>
  </div>`
}
function backgroundsAdmin(){const b=state.backgrounds||{};return `<section class="background-admin"><div class="section-kicker">APARÊNCIA DO SITE</div><h2>Planos de fundo</h2><p class="small muted">O Mestre pode trocar cada fundo separadamente. Com Supabase configurado, os fundos são enviados para o armazenamento online e todos os dispositivos recebem a mesma imagem. Sem Supabase, permanece o modo local. O fundo original volta automaticamente se uma imagem for removida.</p><div class="background-grid">${Object.entries(BG_DEFS).map(([k,d])=>{const cfg=b[k]||{};return `<article class="background-card"><div class="background-preview" data-bg-preview="${k}" style="background-image:linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.15)),url('${esc(cfg.url||cfg.preview||d[1])}')"><span>${esc(d[0])}</span></div><div class="background-meta"><strong>${esc(d[0])}</strong><small>Original: ${esc(d[1])}</small><input type="file" accept="image/png,image/jpeg,image/webp,image/avif,.jfif" data-bg-upload="${k}"><div class="row"><button class="btn small primary" data-bg-save="${k}">Aplicar</button><button class="btn small danger" data-bg-clear="${k}">Restaurar original</button></div></div></article>`}).join('')}</div></section>`}
function bindBackgrounds(){Object.keys(BG_DEFS).forEach(kind=>{const cfg=state.backgrounds?.[kind];if(!cfg?.mediaId)return;bgGet(cfg.mediaId).then(blob=>{if(!blob)return;const u=URL.createObjectURL(blob),preview=document.querySelector(`[data-bg-preview=\"${kind}\"]`);if(preview){preview.style.backgroundImage=`linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.15)),url(\"${u}\")`;}else URL.revokeObjectURL(u)}).catch(()=>{})});document.querySelectorAll('[data-bg-upload]').forEach(inp=>inp.onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)){toast('Escolha uma imagem válida (PNG, JPG, JPEG, JFIF, WEBP ou AVIF).');inp.value='';return}if(f.size>10*1024*1024){toast('A imagem deve ter até 10 MB.');inp.value='';return}const kind=inp.dataset.bgUpload;const card=inp.closest('.background-card'),preview=card?.querySelector('[data-bg-preview]');if(preview){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);const u=URL.createObjectURL(f);preview.dataset.objectUrl=u;preview.style.backgroundImage=`linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.15)),url(\"${u}\")`;}inp.dataset.ready='1';});document.querySelectorAll('[data-bg-save]').forEach(btn=>btn.onclick=async()=>{const kind=btn.dataset.bgSave,input=document.querySelector(`[data-bg-upload="${kind}"]`),file=input?.files?.[0];if(!file){toast('Escolha uma imagem antes de aplicar.');return}try{const id=`bg-${kind}-${Date.now()}`;await bgPut(id,file);let remoteUrl='';if(remoteEnabled){const ext=(file.name.split('.').pop()||'img').replace(/[^a-z0-9]/gi,'');remoteUrl=await uploadGlobalFile(`backgrounds/${kind}-${Date.now()}.${ext}`,file)}const old=state.backgrounds?.[kind]?.mediaId;if(old&&old!==id)await bgDelete(old).catch(()=>{});state.backgrounds=state.backgrounds||{};state.backgrounds[kind]={mediaId:id,url:remoteUrl,name:file.name,updatedAt:Date.now()};await saveGlobalNow();await applyBackgrounds(true);toast(`${BG_DEFS[kind][0]} atualizado globalmente.`);document.getElementById('adminContent').innerHTML=backgroundsAdmin();bindBackgrounds()}catch(e){toast('Não foi possível salvar este fundo.');}});document.querySelectorAll('[data-bg-clear]').forEach(btn=>btn.onclick=async()=>{const kind=btn.dataset.bgClear;if(state.backgrounds?.[kind]?.mediaId)await bgDelete(state.backgrounds[kind].mediaId).catch(()=>{});if(state.backgrounds)delete state.backgrounds[kind];await saveGlobalNow();await applyBackgrounds(true);toast(`${BG_DEFS[kind][0]} restaurado globalmente.`);document.getElementById('adminContent').innerHTML=backgroundsAdmin();bindBackgrounds()});}
function classesAdmin(){const slasher=SLASHER_PROFESSION_NAMES.map(n=>[n,state.classBonuses?.[n]||CLASS_BONUSES_DEFAULTS_V107[n]||{}]);return `<div class="card"><div class="row space"><div><h2>Classes</h2><p class="small muted">Consulte as classes e ajuste os bônus das profissões Slasher sem alterar as regras das outras classes.</p></div></div><div class="class-book-grid admin-class-grid">${Object.entries(CLASSES).map(([n,c])=>`<article class="class-book-card"><div class="class-card-ornament">◇</div><div class="class-card-head"><h2>${esc(n)}</h2>${hasMagicClass(n)?'<span class="badge">MAGIA / RITUAL</span>':''}</div><p>${esc(c.desc)}</p><div class="class-bonus-line"><strong>Bônus</strong><span>${esc(classBonusText(n))}</span></div><div class="ability-list">${(c.abilities||[]).map(a=>`<div class="ability"><b>${esc(a[0])}</b><div class="small muted">${esc(a[1])}</div></div>`).join('')}${customList('abilities').filter(a=>a&&a.target==='class:'+n).map(a=>`<div class="ability"><b>${esc(a.name)} <span class="badge">DO MESTRE</span></b><div class="small muted">${esc(a.description||'')}</div></div>`).join('')}</div></article>`).join('')}</div><div class="divider"></div><section class="bonus-editor"><div class="section-heading"><div><span class="section-kicker">MESTRE</span><h3>Bônus das profissões Slasher</h3><p class="small muted">Altere os valores abaixo. Ao salvar, o novo bônus passa a ser usado automaticamente no total efetivo das fichas.</p></div></div><div class="bonus-editor-grid">${slasher.map(([n,b])=>`<div class="bonus-editor-card"><h3>${esc(n)}</h3>${Object.entries(b).map(([key,val])=>`<div class="bonus-editor-row"><span>${esc(key)}</span><input type="number" min="0" max="20" value="${Number(val)||0}" data-class-bonus="${esc(n)}" data-bonus-key="${esc(key)}"></div>`).join('')}</div>`).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" id="saveClassBonuses">Salvar bônus das profissões</button></div></section></div>`}
function customAbilitiesFor(p){return customList('abilities').filter(a=>a&&a.name&&(!a.target||a.target==='class:'+String(p?.class||'')||a.target==='player:'+String(p?.id||'')))}
function abilityTargetLabel(t){t=String(t||'');if(!t)return 'Todos';if(t.startsWith('class:'))return 'Classe: '+t.slice(6);const pl=(state.players||[]).find(x=>'player:'+x.id===t);return 'Player: '+(pl?.name||pl?.login||t.slice(7))}
function contentAdmin(){const c=state.customContent||{attrs:[],skills:[],conditions:[],deities:[]};return `<div class="card content-admin"><div class="section-heading"><div><span class="section-kicker">EDITOR DO MESTRE</span><h2>Conteúdo da campanha</h2></div></div><p class="small muted">Cadastre elementos novos aqui. Eles ficam salvos globalmente e não exigem novo commit.</p><div class="content-admin-grid"><section><h3>Atributo</h3><div class="field"><input id="newAttrName" placeholder="Ex.: Sorte"></div><button class="btn gold" id="addAttr">Adicionar atributo</button><div class="content-list">${(c.attrs||[]).map((x,i)=>`<span>${esc(x.name)} <button data-del-custom="attrs:${i}">×</button></span>`).join('')}</div></section><section><h3>Perícia</h3><div class="field"><input id="newSkillName" placeholder="Ex.: Navegação"></div><button class="btn gold" id="addSkill">Adicionar perícia</button><div class="content-list">${(c.skills||[]).map((x,i)=>`<span>${esc(x.name)} <button data-del-custom="skills:${i}">×</button></span>`).join('')}</div></section><section><h3>Condição</h3><div class="field"><input id="newCondName" placeholder="Nome"></div><div class="field"><input id="newCondEffect" placeholder="Efeito"></div><button class="btn gold" id="addCond">Adicionar condição</button><div class="content-list">${(c.conditions||[]).map((x,i)=>`<span>${esc(x.name)} <button data-del-custom="conditions:${i}">×</button></span>`).join('')}</div></section><section><h3>Deus do Ocultista</h3><div class="field"><input id="newDeityName" placeholder="Nome do Deus"></div><div class="field"><label>Imagem / símbolo</label><input id="newDeityImage" type="file" accept="image/*,.jfif"></div><button class="btn gold" id="addDeity">Adicionar Deus</button><div class="content-list">${(c.deities||[]).map((x,i)=>`<span>${x.image?`<img src="${esc(x.image)}" class="content-thumb" alt="" loading="lazy" decoding="async">`:''}${esc(x.name)} <button data-del-custom="deities:${i}">×</button></span>`).join('')}</div></section><section><h3>Trilha da introdução Slasher</h3><p class="small muted">Música exibida na tela das perguntas obrigatórias antes das profissões. Aceita URL direta ou arquivo de áudio.</p><div class="field"><input id="slasherMusicTitle" placeholder="Título da trilha" value="${esc(state.slasherIntroMusic?.title||'')}"></div><div class="field"><input id="slasherMusicUrl" placeholder="URL direta do áudio (mp3, wav, ogg...)" value="${esc(state.slasherIntroMusic?.url||'')}"></div><div class="field"><input id="slasherMusicFile" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.webm"></div><div class="row"><button class="btn gold" id="saveSlasherMusic">Salvar trilha do Slasher</button>${state.slasherIntroMusic?.url?'<button class="btn small danger" id="clearSlasherMusic">Remover</button>':''}</div></section><section><h3>Habilidade</h3><div class="field"><input id="newAbilityName" placeholder="Nome da habilidade"></div><div class="field"><label>Quem recebe</label><select id="newAbilityTarget"><option value="">Todos os Players</option><optgroup label="Uma classe">${Object.keys(CLASSES).map(n=>`<option value="class:${esc(n)}">${esc(n)}</option>`).join('')}</optgroup><optgroup label="Um Player">${(state.players||[]).map(pl=>`<option value="player:${esc(pl.id)}">${esc(pl.name||pl.login||pl.id)}</option>`).join('')}</optgroup></select></div><div class="field"><textarea id="newAbilityDesc" rows="4" placeholder="Descrição / efeito"></textarea></div><button class="btn gold" id="addAbility">Adicionar habilidade</button><div class="content-list">${(c.abilities||[]).map((x,i)=>`<span><b>${esc(x.name)}</b> <small>${esc(abilityTargetLabel(x.target))}</small> <button data-edit-ability="${i}" title="Editar">✎</button><button data-del-custom="abilities:${i}">×</button></span>`).join('')}</div></section><section><h3>Magia</h3><div class="field"><input id="newSpellName" placeholder="Nome da magia"></div><div class="input-grid"><div class="field"><input id="newSpellSchool" placeholder="Escola / círculo"></div><div class="field"><input id="newSpellCost" placeholder="Custo"></div></div><div class="field"><textarea id="newSpellDesc" rows="4" placeholder="Descrição"></textarea></div><div class="field"><label>Imagem</label><input id="newSpellImage" type="file" accept="image/*,.jfif"></div><button class="btn gold" id="addSpell">Adicionar magia</button><div class="content-list">${getSpells().map((x)=>`<span>${x.image?`<img src="${esc(x.image)}" class="content-thumb" alt="" loading="lazy" decoding="async">`:''}<b>${esc(x.name)}</b> <small>${esc(x.school||'')} • ${esc(x.cost||'—')}</small> <button data-del-spell="${esc(x.id)}">×</button></span>`).join('')}</div></section></div></div>`}
function bindContentAdmin(){const c=state.customContent||{attrs:[],skills:[],conditions:[],deities:[]};const saveSlasherMusic=document.getElementById('saveSlasherMusic');if(saveSlasherMusic)saveSlasherMusic.onclick=async()=>{const title=document.getElementById('slasherMusicTitle')?.value.trim()||'';const file=document.getElementById('slasherMusicFile')?.files?.[0];const url=document.getElementById('slasherMusicUrl')?.value.trim()||'';if(!file&&!url){toast('Informe uma URL ou escolha um arquivo de áudio.');return}try{saveSlasherMusic.disabled=true;let remoteUrl=url;if(file){const ext=(file.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp3';if(!file.type.startsWith('audio/')&&!['mp3','wav','ogg','oga','m4a','aac','flac','opus','webm'].includes(ext)){toast('Arquivo de áudio inválido.');return}if(file.size>50*1024*1024){toast('O arquivo deve ter até 50 MB.');return}if(!remoteEnabled){toast('Configure o Supabase global para enviar arquivos.');return}remoteUrl=await uploadGlobalFile(`slasher-music/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`,file);if(!remoteUrl)throw new Error('URL pública não disponível')}state.slasherIntroMusic={url:remoteUrl,title:title||file?.name?.replace(/\.[^.]+$/,'')||'Trilha do Slasher',kind:'url'};await saveGlobalNow();toast('Trilha da introdução Slasher salva.');document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()}catch(e){console.error(e);toast('Não foi possível salvar a trilha.')}finally{saveSlasherMusic.disabled=false}};document.getElementById('clearSlasherMusic')?.addEventListener('click',async()=>{state.slasherIntroMusic={url:'',title:'',kind:'url'};await saveGlobalNow();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()});const add=(key,val)=>{c[key]=c[key]||[];c[key].push(val);state.customContent=c;save();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()};document.getElementById('addAttr')?.addEventListener('click',()=>{const n=document.getElementById('newAttrName').value.trim();if(n)add('attrs',{id:'a-'+Date.now(),name:n})});document.getElementById('addSkill')?.addEventListener('click',()=>{const n=document.getElementById('newSkillName').value.trim();if(n)add('skills',{id:'s-'+Date.now(),name:n})});document.getElementById('addCond')?.addEventListener('click',()=>{const n=document.getElementById('newCondName').value.trim(),effect=document.getElementById('newCondEffect').value.trim();if(n)add('conditions',{id:'c-'+Date.now(),name:n,effect,icon:'◇'})});let abilityEdit=-1;document.querySelectorAll('[data-edit-ability]').forEach(b=>b.onclick=()=>{const a=(c.abilities||[])[Number(b.dataset.editAbility)];if(!a)return;abilityEdit=Number(b.dataset.editAbility);document.getElementById('newAbilityName').value=a.name||'';document.getElementById('newAbilityDesc').value=a.description||'';document.getElementById('newAbilityTarget').value=a.target||'';const btn=document.getElementById('addAbility');if(btn)btn.textContent='Salvar alterações';document.getElementById('newAbilityName').focus()});document.getElementById('addAbility')?.addEventListener('click',()=>{const n=document.getElementById('newAbilityName').value.trim(),d=document.getElementById('newAbilityDesc').value.trim(),t=document.getElementById('newAbilityTarget').value;if(!n){toast('Informe o nome da habilidade.');return}if(abilityEdit>=0&&c.abilities?.[abilityEdit]){c.abilities[abilityEdit]={...c.abilities[abilityEdit],name:n,description:d,target:t};state.customContent=c;save();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin();toast('Habilidade atualizada.');return}add('abilities',{id:'ab-'+Date.now(),name:n,description:d,target:t});toast('Habilidade adicionada.')});document.getElementById('addDeity')?.addEventListener('click',async()=>{const n=document.getElementById('newDeityName').value.trim(),f=document.getElementById('newDeityImage')?.files?.[0];if(!n){toast('Informe o nome do Deus.');return}try{const id='d-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);const image=f?await imageFileToRemoteURL(f,`deities/${id}.webp`,700,.82):'';await add('deities',{id,name:n,image});await saveGlobalNow();toast('Deus e imagem salvos no banco.')}catch(e){console.error(e);toast('Não foi possível salvar a imagem do Deus.')}});document.getElementById('addSpell')?.addEventListener('click',async()=>{const n=document.getElementById('newSpellName').value.trim(),school=document.getElementById('newSpellSchool').value.trim(),cost=document.getElementById('newSpellCost').value.trim(),description=document.getElementById('newSpellDesc').value.trim(),f=document.getElementById('newSpellImage')?.files?.[0];if(!n){toast('Informe o nome da magia.');return}const btn=document.getElementById('addSpell');try{if(btn){btn.disabled=true;btn.textContent='Enviando imagem...'}const id='spell-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);const image=f?await imageFileToRemoteURL(f,`spells/${id}.webp`,900,.82):'';state.spells=[...getSpells(),{id,name:n,school,cost,description,image}];await saveGlobalNow();toast('Magia e imagem salvas no banco.');document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()}catch(e){console.error(e);toast('Não foi possível salvar a magia.')}finally{if(btn){btn.disabled=false;btn.textContent='Adicionar magia'}}});document.querySelectorAll('[data-del-spell]').forEach(b=>b.onclick=()=>{state.spells=getSpells().filter(x=>x.id!==b.dataset.delSpell);save();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()});document.querySelectorAll('[data-del-custom]').forEach(b=>b.onclick=()=>{const [k,i]=b.dataset.delCustom.split(':'),idx=Number(i),removed=c[k]?.[idx];const entry=(removed===undefined||removed===null)?null:trashPush('custom',typeof removed==='object'?(removed.name||removed.title||removed.label||k):String(removed),removed,{key:k,index:idx});c[k].splice(idx,1);state.customContent=c;save();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin();if(entry)toastUndo('Conteúdo excluído.',async()=>{const r=await trashRestore(entry.tid);if(r){if(document.querySelector('.content-admin')){document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()}toast('Conteúdo restaurado.')}})})}
function closeMasterTools(){document.getElementById('masterToolsSheet')?.remove();const b=document.getElementById('masterMoreBtn');if(b)b.setAttribute('aria-expanded','false')}
function setAdminTab(t){
  adminTabCurrent=t;
  const isMain=MASTER_MAIN_TABS.some(x=>x[0]===t);
  document.querySelectorAll('.panel-tabs>[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));
  document.getElementById('masterMoreBtn')?.classList.toggle('has-active',!isMain);
  const box=document.getElementById('adminContent');if(!box)return;
  box.innerHTML=adminTabContent(t);bindAdminContent();
}
function openMasterTools(){
  if(document.getElementById('masterToolsSheet')){closeMasterTools();return}
  const wrap=document.createElement('div');wrap.id='masterToolsSheet';wrap.className='master-tools-overlay';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-label','Mais ferramentas');
  wrap.innerHTML=`<div class="master-tools-backdrop" data-tools-close></div><div class="master-tools-panel"><header class="master-tools-head"><strong>Mais ferramentas</strong><button type="button" class="master-tools-x" data-tools-close aria-label="Fechar">×</button></header><div class="master-tools-grid">${MASTER_TOOLS.map(([k,ico,name,desc])=>`<button type="button" data-tool="${esc(k)}" class="${adminTabCurrent===k?'active':''}"><span class="tool-ico" aria-hidden="true">${esc(ico)}</span><span class="tool-txt"><b>${esc(name)}</b><small>${esc(desc)}</small></span></button>`).join('')}</div></div>`;
  wrap.addEventListener('click',e=>{
    if(e.target.closest('[data-tools-close]')){closeMasterTools();return}
    const tool=e.target.closest('[data-tool]');
    if(tool){const k=tool.dataset.tool;closeMasterTools();setAdminTab(k);try{document.getElementById('adminContent')?.scrollIntoView({block:'start',behavior:prefersReducedMotion()?'auto':'smooth'})}catch{}}
  });
  document.body.appendChild(wrap);
  document.getElementById('masterMoreBtn')?.setAttribute('aria-expanded','true');
  wrap.querySelector('[data-tool]')?.focus({preventScroll:true});
}
if(!window.__masterToolsEsc){window.__masterToolsEsc=1;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('masterToolsSheet')){e.preventDefault();closeMasterTools();document.getElementById('masterMoreBtn')?.focus()}})}
function bindAdmin(){
  closeMasterTools();
  document.querySelectorAll('.panel-tabs>[data-tab]').forEach(b=>b.onclick=()=>setAdminTab(b.dataset.tab));
  const more=document.getElementById('masterMoreBtn');if(more)more.onclick=openMasterTools;
  bindAdminContent();
}
function bindClassBonuses(){const btn=document.getElementById('saveClassBonuses');if(!btn)return;btn.onclick=async()=>{const next=clone(CLASS_BONUSES_DEFAULTS_V107);document.querySelectorAll('[data-class-bonus]').forEach(x=>{const n=x.dataset.classBonus,k=x.dataset.bonusKey;next[n]=next[n]||{};next[n][k]=clamp(x.value,0,20)});state.classBonuses=next;save();await saveGlobalNow().catch(()=>{});toast('Bônus das profissões Slasher atualizados. As fichas já usam os novos totais.');document.getElementById('adminContent').innerHTML=classesAdmin();bindAdminContent()}}
function bindAdminContent(){bindPerformanceReportExport();if(document.getElementById('campaignMapSvg'))bindCampaignMap({state,isMaster:true,currentPlayer:null,save,saveGlobal:saveGlobalNow,toast,rerender:()=>{document.getElementById('adminContent').innerHTML=campaignMapPage(state,true,null);bindAdminContent()}});bindSessionDiagnostics();if(document.querySelector('.card')&&document.getElementById('restoreLatestLocal'))bindRecovery();if(document.querySelector('.bonus-editor'))bindClassBonuses();if(document.querySelector('.tv-admin'))bindTvAdmin();if(document.querySelector('#saveSiteBrand'))bindSiteBrand();if(document.querySelector('.content-admin'))bindContentAdmin();if(document.querySelector('.trash-admin'))bindTrash();document.getElementById('sendSecretClue')?.addEventListener('click',sendSecretClue);const playerGrid=document.querySelector('.master-player-grid');if(playerGrid&&!playerGrid.dataset.boundFicha){playerGrid.dataset.boundFicha='1';playerGrid.addEventListener('click',e=>{const view=e.target.closest('[data-view-player]');if(view){e.preventDefault();e.stopPropagation();const id=view.dataset.playerId;const p=state.players.find(x=>String(x.id)===String(id))||state.players[Number(view.dataset.viewPlayer)];if(p)openPlayerViewById(p.id);return}})}const rr=document.getElementById('openCharacterRules');if(rr)rr.onclick=()=>{document.getElementById('adminContent').innerHTML=rulesAdmin();bindRulesAdmin()};const stress=document.getElementById('runPlayerStressTest');if(stress)stress.onclick=()=>runPlayerStressTest({version:APP_VERSION,state,ps,applyPlayerRows,clone,playerStoreEnabled,getAuthToken,fetchPlayersByIds,toast});const deploymentCacheTest=document.getElementById('runDeploymentCacheCheck');if(deploymentCacheTest)deploymentCacheTest.onclick=async()=>{const report=await runDeploymentCacheSelfTest();if(report)toast(report.ok?'Verificação de versão/cache passou.':'Verificação de versão/cache encontrou pontos para revisar.');};const performanceTest=document.getElementById('runPerformanceDiagnostics');if(performanceTest)performanceTest.onclick=async()=>{const report=await runPerformanceDiagnosticsSelfTest();if(report)toast(report.error?'Medição de desempenho não concluída.':'Métricas locais coletadas; confira o relatório.');};const persistenceTest=document.getElementById('runPersistenceSelfTest');if(persistenceTest)persistenceTest.onclick=()=>{const report=runPersistenceSelfTest();if(report)toast(report.ok?'Teste de persistência passou (4/4).':'Teste de persistência encontrou falhas.');};const syncCheck=document.getElementById('runPlayerSyncCheck');if(syncCheck)syncCheck.onclick=async()=>{const status=document.getElementById('playerSyncCheckStatus');if(!confirm('Executar a sincronização real da sessão? Alterações locais pendentes podem ser enviadas ao servidor.'))return;syncCheck.disabled=true;const old=syncCheck.textContent;syncCheck.textContent='Sincronizando...';if(status)status.textContent='Executando verificação real...';try{if(!playerStoreEnabled)throw new Error('Armazenamento remoto de Players desativado');if(!getAuthToken())throw new Error('Sessão autenticada não encontrada');ps.circuitOpen=false;await hydratePlayersDb();if(ps.readOnly)throw new Error('Leitura do servidor falhou; dados locais preservados em modo somente leitura');const synced=await syncPlayersDbNow(true);if(!synced||ps.readOnly)throw new Error('Servidor não confirmou a sincronização');const report={ok:true,message:'🟢 Sincronização concluída sem erro',at:Date.now()};window.__aProfeciaSyncCheck=report;if(status)status.textContent=report.message;toast('Verificação de sincronização concluída.');}catch(err){const report={ok:false,message:`🔴 Falha na sincronização: ${authErrorText(err)}`,at:Date.now()};window.__aProfeciaSyncCheck=report;if(status)status.textContent=report.message;toast(authErrorText(err));}finally{syncCheck.disabled=false;syncCheck.textContent=old;}};const syncNow=document.getElementById('syncPlayersNow');if(syncNow)syncNow.onclick=async()=>{const oldText=syncNow.textContent;syncNow.disabled=true;syncNow.textContent='Sincronizando...';try{ps.circuitOpen=false;await hydratePlayersDb();if(ps.hydrated)await syncPlayersDbNow(true);toast('Players sincronizados com o servidor.');if(currentView==='master'&&adminTabCurrent==='players'&&!document.getElementById('entityModal')){document.getElementById('adminContent').innerHTML=playersAdmin();bindAdminContent()}}catch(err){toast(authErrorText(err))}finally{syncNow.disabled=false;syncNow.textContent=oldText}};document.querySelectorAll('[data-view-player-detail]').forEach(b=>b.onclick=()=>openPlayerMasterDossier(b.dataset.viewPlayerDetail));document.querySelectorAll('[data-print-player]').forEach(b=>b.onclick=()=>printPlayerPhysicalSheet(b.dataset.printPlayer));document.querySelectorAll('[data-read-book]').forEach(b=>b.onclick=()=>openBookReader(Number(b.dataset.readBook)));document.getElementById('saveRulesBook')?.addEventListener('click',async()=>{const btn=document.getElementById('saveRulesBook'),title=document.getElementById('rulesBookTitle')?.value.trim()||'Livro de Regras',file=document.getElementById('rulesBookFile')?.files?.[0],typedUrl=document.getElementById('rulesBookUrl')?.value.trim()||'';try{btn.disabled=true;btn.textContent=file?'Enviando PDF...':'Salvando...';let url=typedUrl;if(file){if(file.size>25*1024*1024){toast('O PDF deve ter até 25 MB.');return}if(!remoteEnabled){toast('Configure o Supabase para enviar o PDF.');return}url=await uploadGlobalFile(`rules/${Date.now()}-${Math.random().toString(36).slice(2,7)}.pdf`,file);if(!url)throw new Error('URL pública não disponível')}state.rulesBook={title,url,kind:'url',updatedAt:Date.now()};save();await saveGlobalNow().catch(()=>{});toast('Livro de regras salvo.');document.getElementById('adminContent').innerHTML=playersAdmin();bindAdminContent()}catch(err){console.error(err);toast('Não foi possível salvar o livro.')}finally{btn.disabled=false;btn.textContent='Salvar livro'}});document.getElementById('openItemBankFromPlayers')?.addEventListener('click',()=>{adminTabCurrent='items';document.getElementById('adminContent').innerHTML=itemsAdmin();bindAdminContent()});document.getElementById('createWeaponQuick')?.addEventListener('click',()=>{openModal(itemModal());bindItemModal(null);setTimeout(()=>{const cat=document.getElementById('iCat');if(cat)cat.value='Armas';const name=document.getElementById('iName');if(name&&!name.value)name.value='Nova arma';const dmg=document.getElementById('iDamage');if(dmg&&!dmg.value)dmg.value='1d8';},0)});const np=document.getElementById('newPlayer');if(np)np.onclick=()=>openEntity('player',null);document.querySelectorAll('[data-edit-p]').forEach(b=>b.onclick=()=>{const key=b.dataset.editP;const i=state.players.findIndex(p=>String(p.id||p.login)===String(key));if(i>=0)openEntity('player',i)});document.querySelectorAll('[data-bag-p]').forEach(b=>b.onclick=()=>{const key=b.dataset.bagP;const i=state.players.findIndex(p=>String(p.id||p.login)===String(key));if(i>=0){openModal(bagAdminModal(i));bindBagAdmin(i)}});document.querySelectorAll('[data-round-p]').forEach(b=>b.onclick=()=>{const p=state.players[Number(b.dataset.roundP)];if(!p)return;const events=applyConditionRound(p);save();toast(events.length?events.join(' • '):'Rodada avançada. Nenhum efeito automático ativo.');render('master')});document.querySelectorAll('[data-del-p]').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset.delP),p=state.players[i];if(!p||!confirm('Excluir este Player?'))return;b.disabled=true;const oldText=b.textContent;b.textContent='Excluindo...';try{await savePlayerTrash(p);await deletePlayerConfirmed(p);const k=playerSyncKey(p);state.players=state.players.filter(x=>playerSyncKey(x)!==k);ps.lastSnapshot=clone(state.players);persistCriticalCache();persistSessionCache();storageSet(KEY,serializeState());toast('Player excluído e confirmado no servidor.');render('master')}catch(err){toast(authErrorText(err));b.disabled=false;b.textContent=oldText}});const nm=document.getElementById('newMonster');if(nm)nm.onclick=()=>openEntity('monster',null);const ms=document.getElementById('monsterSearch');if(ms)ms.oninput=renderMonsters;document.querySelectorAll('[data-edit-m]').forEach(b=>b.onclick=()=>openEntity('monster',Number(b.dataset.editM)));document.querySelectorAll('[data-monster-damage]').forEach(b=>b.onclick=async()=>{const m=state.creatures[Number(b.dataset.monsterDamage)],delta=Number(b.dataset.delta)||0;if(!m)return;m.hp=clamp((m.hp??m.hpMax)+delta,0,m.hpMax);save();renderMonsters();await saveGlobalNow().catch(()=>{});toast(`${delta<0?'Dano':'Cura'} aplicado em ${m.name}.`)});document.querySelectorAll('[data-round-m]').forEach(b=>b.onclick=()=>{const m=state.creatures[Number(b.dataset.roundM)];if(!m)return;const events=applyConditionRound(m);save();toast(events.length?events.join(' • '):'Rodada avançada. Nenhum efeito automático ativo.');render('master')});document.querySelectorAll('[data-roll-m-atk]').forEach(b=>b.onclick=()=>{const m=state.creatures[Number(b.dataset.rollMAtk)];if(!m)return;const r=rollDiceExpression('1d20'+(Number(m.attack)>0?'+'+Number(m.attack):Number(m.attack)<0?String(Number(m.attack)):''));toast((m.name||'Monstro')+' ataca: '+r.rolls[0]+(r.mod?(r.mod>0?' + ':' − ')+Math.abs(r.mod):'')+' = '+r.total)});document.querySelectorAll('[data-roll-m-dmg]').forEach(b=>b.onclick=()=>{const m=state.creatures[Number(b.dataset.rollMDmg)];if(!m)return;const r=rollDiceExpression(m.damage);if(!r){toast('Dano inválido em '+(m.name||'Monstro')+'. Use um formato como 1d8+2.');return}toast((m.name||'Monstro')+' causa '+r.total+' de dano ('+r.label+': ['+r.rolls.join(', ')+']'+(r.mod?(r.mod>0?' + ':' − ')+Math.abs(r.mod):'')+')')});document.querySelectorAll('[data-dup-m]').forEach(b=>b.onclick=async()=>{const src=state.creatures[Number(b.dataset.dupM)];if(!src)return;const copy=clone(src);copy.id='e-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);copy.name=`${src.name||'Monstro'} (cópia)`;copy.hp=copy.hpMax;state.creatures.push(copy);save();await saveGlobalNow().catch(()=>{});toast('Monstro duplicado.');render('master')});document.querySelectorAll('[data-del-m]').forEach(b=>b.onclick=async()=>{const idx=Number(b.dataset.delM),m=state.creatures[idx];if(!m)return;if(!confirm('Excluir este Monstro? Ele vai para a Lixeira por '+TRASH_DAYS+' dias.'))return;const entry=trashPush('monster',m.name||'Monstro',m);state.creatures.splice(idx,1);save();await saveGlobalNow().catch(()=>{});render('master');toastUndo('Monstro excluído.',async()=>{const r=await trashRestore(entry.tid);if(r){render('master');toast('Monstro restaurado.')}})});if(document.getElementById('monsterResults'))renderMonsters();const ni=document.getElementById('newItem');if(ni)ni.onclick=()=>{openModal(itemModal());bindItemModal(null)};const nw=document.getElementById('newWeapon');if(nw)nw.onclick=()=>{openModal(itemModal(null,{category:'Armas',damage:'1d6',maxQty:1,weight:2,icon:'asset:weapon'}));bindItemModal(null)};let itemSearchTimer=0;['itemSearch','itemCat','itemRar'].forEach(id=>{const x=document.getElementById(id);if(!x)return;x.oninput=()=>{clearTimeout(itemSearchTimer);itemSearchTimer=setTimeout(renderItems,id==='itemSearch'?120:0)}});const ci=document.getElementById('clearItems');if(ci)ci.onclick=()=>{document.getElementById('itemSearch').value='';document.getElementById('itemCat').value='';document.getElementById('itemRar').value='';renderItems()};const itemResults=document.getElementById('itemResults');if(itemResults&&!itemResults.dataset.bound){itemResults.dataset.bound='1';itemResults.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-item]');if(edit){const id=Number(edit.dataset.editItem);openModal(itemModal(id));bindItemModal(id);return}const del=e.target.closest('[data-del-item]');if(del){const id=Number(del.dataset.delItem);if(confirm('Excluir este item? Ele vai para a Lixeira por '+TRASH_DAYS+' dias.')){const gone=state.items.find(i=>i.id===id),entry=gone?trashPush('item',gone.name||'Item',gone):null;state.items=state.items.filter(i=>i.id!==id);save();renderItems();if(entry)toastUndo('Item excluído.',async()=>{const r=await trashRestore(entry.tid);if(r){renderItems();toast('Item restaurado.')}});else toast('Item excluído.')}}})}const sm=document.getElementById('saveMusic');if(sm)sm.onclick=async()=>{
  const title=document.getElementById('musicTitle')?.value.trim()||'';
  const file=document.getElementById('musicFile')?.files?.[0];
  const url=document.getElementById('musicUrl')?.value.trim()||'';
  if(!file&&!url){toast('Escolha um arquivo de áudio ou informe uma URL direta.');return}
  try{
    sm.disabled=true;sm.textContent='Enviando...';
    let remoteUrl=url,kind='url',name=title;
    if(file){
      const ext=(file.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp3';
      const allowed=['mp3','mpeg','wav','ogg','oga','m4a','aac','flac','opus','webm'];
      if(!file.type.startsWith('audio/')&&!allowed.includes(ext)){toast('Escolha um arquivo de áudio válido.');return}
      if(file.size>50*1024*1024){toast('O arquivo deve ter até 50 MB.');return}
      if(!remoteEnabled){toast('O Supabase global não está disponível. Configure a conexão antes de enviar música.');return}
      const safeName=`music/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      remoteUrl=await uploadGlobalFile(safeName,file);
      if(!remoteUrl)throw new Error('Não foi possível obter a URL pública do áudio.');
      kind='url';name=title||file.name.replace(/\.[^.]+$/,'');
    }
    const trackId=`music-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;state.musicLibrary=Array.isArray(state.musicLibrary)?state.musicLibrary:[];state.musicLibrary=state.musicLibrary.filter(x=>String(x.url)!==String(remoteUrl));state.musicLibrary.unshift({id:trackId,title:name||'Trilha da campanha',url:remoteUrl,kind,createdAt:Date.now()});state.music={type:'audio',url:remoteUrl,title:name||'Trilha da campanha',kind,mediaId:trackId,playing:false,loop:!!state.music?.loop,position:0,startedAt:0,commandAt:Date.now()};
    await saveGlobalNow();
    globalMusicBlocked=false;
    syncGlobalMusic(true);
    toast('Trilha enviada e disponível para todos os Players.');
    render('master');
  }catch(e){
    console.error(e);toast(`Não foi possível enviar a trilha: ${e?.message||'erro desconhecido'}`);
  }finally{sm.disabled=false;sm.textContent='Enviar / salvar trilha global'}
};
const scid=document.getElementById('spotifyClientId');if(scid)scid.onchange=()=>{try{localStorage.setItem(SPOTIFY_CLIENT_KEY,scid.value.trim())}catch{}};const slog=document.getElementById('spotifyLogin');if(slog)slog.onclick=async()=>{try{if(scid?.value.trim())localStorage.setItem(SPOTIFY_CLIENT_KEY,scid.value.trim())}catch{};if(spotifyLogged()){await ensureSpotifyPlayer();syncGlobalMusic()}else await spotifyLogin()};const slout=document.getElementById('spotifyLogout');if(slout)slout.onclick=()=>{spotifyLogout();render('master')};const cm=document.getElementById('clearMusic');if(cm)cm.onclick=async()=>{state.music={type:'audio',url:'',title:'',kind:'url',mediaId:'',playing:false,loop:false,position:0,startedAt:0,commandAt:Date.now()};await saveGlobalNow();syncGlobalMusic(true);toast('Trilha removida globalmente.');render('master')};document.querySelectorAll('[data-use-global-music]').forEach(b=>b.onclick=async()=>{const t=(state.musicLibrary||[]).find(x=>String(x.id)===String(b.dataset.useGlobalMusic));if(!t)return;state.music={...normalizeMusic(),type:'audio',url:t.url,title:t.title,kind:t.kind||'url',mediaId:t.id,playing:false,position:0,startedAt:0,commandAt:Date.now()};await saveGlobalNow();syncGlobalMusic(true);toast('Trilha selecionada.');render('master')});document.querySelectorAll('[data-delete-global-music]').forEach(b=>b.onclick=async()=>{const id=String(b.dataset.deleteGlobalMusic),t=(state.musicLibrary||[]).find(x=>String(x.id)===id);if(!t)return;if(!confirm(`Excluir a trilha ${t.title||''} da biblioteca?`))return;state.musicLibrary=state.musicLibrary.filter(x=>String(x.id)!==id);if(String(state.music?.mediaId)===id)state.music={type:'audio',url:'',title:'',kind:'url',mediaId:'',playing:false,loop:false,position:0,startedAt:0,commandAt:Date.now()};await saveGlobalNow();render('master')});const as=document.getElementById('addSound');if(as)as.onclick=async()=>{const name=document.getElementById('soundName').value.trim(),file=document.getElementById('soundFile').files[0],url=document.getElementById('soundUrl').value.trim(),category=document.getElementById('soundCategory')?.value||'Outros';if(!name){toast('Informe o nome do som.');return}if(!file&&!url){toast('Envie um arquivo ou informe uma URL.');return}if(file&&file.size>25*1024*1024){toast('O arquivo deve ter até 25 MB.');return}try{as.disabled=true;as.textContent='Enviando...';let remoteUrl=url,kind='url';if(file){if(!remoteEnabled){toast('Configure o Supabase para sincronizar arquivos de som com os Players.');return}const ext=(file.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp3';remoteUrl=await uploadGlobalFile(`sounds/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`,file);if(!remoteUrl)throw new Error('URL pública não disponível');kind='url'}const id=`s-${Date.now()}`;state.sounds.push({id,name,kind,url:remoteUrl,category,createdAt:Date.now()});await saveGlobalNow();toast('Som salvo e sincronizado.');render('master')}catch(e){toast(`Não foi possível salvar o som: ${e?.message||'erro'}`)}finally{as.disabled=false;as.textContent='+ Salvar som na biblioteca'}};document.getElementById('soundStopMaster')?.addEventListener('click',stopAllSounds);document.querySelectorAll('[data-play-sound]').forEach(b=>b.onclick=()=>{const sound=state.sounds.find(x=>String(x.id)===String(b.dataset.playSound));if(sound)playSoundEntry(sound)});document.querySelectorAll('[data-del-sound]').forEach(b=>b.onclick=async()=>{const id=b.dataset.delSound;state.sounds=state.sounds.filter(x=>x.id!==id);await saveGlobalNow().catch(()=>{});render('master')});document.querySelectorAll('[data-class-choice]').forEach(b=>b.onclick=()=>{const p=player();if(!p)return;p.class=b.dataset.classChoice;if(!hasMagicClass(p.class))p.initialSpell='';save();const phrase=document.getElementById('destinyPhrase');if(phrase){phrase.classList.remove('show');void phrase.offsetWidth;phrase.classList.add('show')}toast('Seu destino está selado.');render('sheet')});const saveSymbols=document.getElementById('saveSymbols');if(saveSymbols)saveSymbols.onclick=()=>{state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};state.uiIcons.attrs=state.uiIcons.attrs||{};state.uiIcons.skills=state.uiIcons.skills||{};document.querySelectorAll('[data-symbol-attr]').forEach(x=>state.uiIcons.attrs[x.dataset.symbolAttr]=x.value.trim()||DEFAULT_ATTR_ICONS[x.dataset.symbolAttr]);document.querySelectorAll('[data-symbol-skill]').forEach(x=>state.uiIcons.skills[x.dataset.symbolSkill]=x.value.trim()||DEFAULT_SKILL_ICONS[x.dataset.symbolSkill]);save();toast('Símbolos atualizados.');render('master')};document.querySelectorAll('[data-symbol-file]').forEach(inp=>inp.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Imagem inválida ou maior que 40 MB.');inp.value='';return}try{const kind=inp.dataset.symbolFile,key=inp.dataset.symbolKey;const path=`symbols/${kind}-${key.replace(/[^a-z0-9_-]/gi,'-')}.webp`;const data=await imageFileToRemoteURL(f,path,256,.82);state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};if(kind==='attr')state.uiIcons.attrs[key]=data;else state.uiIcons.skills[key]=data;await saveGlobalNow();toast('Símbolo atualizado e salvo no banco.');document.getElementById('adminContent').innerHTML=symbolsAdmin();bindAdminContent()}catch(err){console.error(err);toast('Não foi possível salvar o símbolo.')}finally{inp.value=''}});document.querySelectorAll('[data-spell-image]').forEach(inp=>inp.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Imagem inválida ou maior que 40 MB.');inp.value='';return}try{const sp=state.spells.find(x=>x.id===inp.dataset.spellImage);if(!sp)return;const data=await imageFileToRemoteURL(f,`spells/${sp.id}.webp`,900,.82);sp.image=data;await saveGlobalNow();toast('Imagem da magia salva no banco.');render('master')}catch(err){console.error(err);toast('Não foi possível salvar a imagem da magia.')}finally{inp.value=''}});document.querySelectorAll('[data-clear-spell-image]').forEach(b=>b.onclick=async()=>{const sp=state.spells.find(x=>x.id===b.dataset.clearSpellImage);if(sp){sp.image='';await saveGlobalNow().catch(()=>{});toast('Imagem da magia removida.');render('master')}});bindSpellsAdminExtras();document.getElementById('openPointsManager')?.addEventListener('click',openPointsManager);document.querySelectorAll('[data-condition-image]').forEach(inp=>inp.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Imagem inválida ou maior que 40 MB.');inp.value='';return}try{const key=inp.dataset.conditionImage;const data=await imageFileToRemoteURL(f,`conditions/${key.replace(/[^a-z0-9_-]/gi,'-')}.webp`,512,.82);state.uiIcons=state.uiIcons||{};state.uiIcons.conditions=state.uiIcons.conditions||{};state.uiIcons.conditions[key]=data;await saveGlobalNow();toast('Símbolo da condição salvo no banco.');render('master')}catch(err){console.error(err);toast('Não foi possível salvar a imagem da condição.')}finally{inp.value=''}});if(document.getElementById('itemResults'))renderItems();if(document.querySelector('[data-bg-upload]'))bindBackgrounds();bindSessionThemeEditor()}
function openModal(html){const holder=document.createElement('div');holder.innerHTML=html.trim();document.body.appendChild(holder.firstElementChild)}
function characterRules(type='campaign'){const r=state.characterRules||DEFAULT_RULES;return r[type==='slasher'?'slasher':'campaign']||DEFAULT_RULES.campaign}
function activeSheetDraft(p){
  const d=state?.session?.sheetDraft;if(!d||!p)return null;
  if(String(d.pid||'')!==String(p.id)||Date.now()-(Number(d.at)||0)>1800000||(Number(d.basePts)||0)!==(Number(p._pointsAt)||0)){try{state.session.sheetDraft=null}catch{}return null}
  return d;
}
function allocationValues(e){
  const d=state?.session?.role==='player'?activeSheetDraft(e):null;
  return{attrs:{...(e?.attrs||{}),...(d?.attrs||{})},skills:{...(e?.skills||{}),...(d?.skills||{})}};
}
function allocationTotals(e){
  const v=allocationValues(e),A=new Set(allAttrs()),S=new Set(allSkills());
  const sum=(o,set)=>Object.entries(o).reduce((a,[k,x])=>set.has(k)?a+(Number(x)||0):a,0);
  return{attrs:sum(v.attrs,A),skills:sum(v.skills,S)};
}
function allocationRemaining(e){const t=allocationTotals(e),r=characterRules(e?.campaignType),ap=Number(e?.attrBonusPoints)||0,sp=Number(e?.skillBonusPoints)||0;return{attrs:Math.max(0,Number(r.attrPoints)+ap-t.attrs),skills:Math.max(0,Number(r.skillPoints)+sp-t.skills)}}
function pointsSum(o,names){const set=new Set(names);return Object.entries(o||{}).reduce((a,[k,x])=>set.has(k)?a+(Number(x)||0):a,0)}
function allocationOver(e){const t=allocationTotals(e),r=characterRules(e?.campaignType);return{attrs:Math.max(0,t.attrs-(Number(r.attrPoints)+(Number(e?.attrBonusPoints)||0))),skills:Math.max(0,t.skills-(Number(r.skillPoints)+(Number(e?.skillBonusPoints)||0)))}}
function pointsRemainText(e,kind){const o=allocationOver(e)[kind];return o>0?`Excedido em ${o} — reduza`:`Restam ${allocationRemaining(e)[kind]}`}
function validateAllocation(e,prev){const r=characterRules(e.campaignType),t=allocationTotals(e),ap=Number(e?.attrBonusPoints)||0,sp=Number(e?.skillBonusPoints)||0,al=Number(r.attrPoints)+ap,sl=Number(r.skillPoints)+sp;const prevA=prev?pointsSum(prev.attrs,allAttrs()):null,prevS=prev?pointsSum(prev.skills,allSkills()):null;const badA=t.attrs>al&&!(prevA!==null&&t.attrs<=prevA),badS=t.skills>sl&&!(prevS!==null&&t.skills<=prevS);if(badA||badS)return `Limite excedido: ${t.attrs}/${al} pontos de Atributos e ${t.skills}/${sl} de Perícias.`;return ''}
function normalizePointText(raw,max,prev=''){
  const mx=Math.max(0,Math.floor(Number(max))||0);
  const digits=String(raw??'').replace(/\D/g,'').replace(/^0+(?=\d)/,'');
  if(!digits)return null;
  let n=Number(digits.slice(0,4));
  if(n>mx){
    const pv=String(prev??'').replace(/\D/g,'');
    const last=Number(digits.slice(-1));
    if(pv&&digits.length>pv.length&&digits.startsWith(pv)&&last<=mx)n=last;
  }
  return Math.max(0,Math.min(mx,n));
}
function allowedPointValue(wanted,max,othersSum,limit){
  const w=Number(wanted)||0,mx=Number(max)||0,room=(Number(limit)||0)-(Number(othersSum)||0);
  return Math.max(0,Math.min(Math.floor(w),mx,Math.floor(room)));
}
function pointField(cls,kind,name,value,max){
  const v=normalizePointText(value,max,'')??0,n=esc(name);
  return `<span class="pt-ctl"><button type="button" class="pt-btn" data-pt-step="-1" aria-label="Diminuir ${n}">−</button><input class="${esc(cls)}" data-${esc(kind)}="${n}" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="3" aria-label="${n}" value="${Number(v)}"><button type="button" class="pt-btn" data-pt-step="1" aria-label="Aumentar ${n}">+</button></span>`;
}
function bindPointInputs(p,capture){
  const rules=()=>characterRules(p.campaignType);
  const groups=[
    {sel:'.pAttr',max:MAX_ATTR,out:'attrRemaining',limit:()=>(Number(rules().attrPoints)||0)+(Number(p.attrBonusPoints)||0)},
    {sel:'.pSkill',max:MAX_SKILL,out:'skillRemaining',limit:()=>(Number(rules().skillPoints)||0)+(Number(p.skillBonusPoints)||0)}
  ];
  let lastHint=0;
  const hint=msg=>{const t=Date.now();if(t-lastHint>1500){lastHint=t;try{toast(msg)}catch{}}};
  const safeCapture=()=>{try{capture&&capture();schedulePlayerSheetBackup(p,state?.session?.sheetDraft,250)}catch(err){console.warn('rascunho de pontos',err)}};
  for(const g of groups){
    const inputs=[...document.querySelectorAll(g.sel)];
    if(!inputs.length)continue;
    const val=el=>normalizePointText(el.value,g.max,'')||0;
    const othersOf=el=>inputs.reduce((a,i)=>i===el?a:a+val(i),0);
    const refresh=()=>{
      const rest=g.limit()-inputs.reduce((a,i)=>a+val(i),0);
      const out=document.getElementById(g.out);
      if(out)out.textContent=rest<0?`Excedido em ${-rest} — reduza`:`Restam ${rest}`;
    };
    const apply=(el,wanted)=>{
      const others=othersOf(el),room=Math.max(0,g.limit()-others);
      const capped=Math.min(wanted,g.max),v=allowedPointValue(capped,g.max,others,g.limit());
      if(wanted>g.max)hint(`O máximo deste campo é ${g.max}.`);
      else if(v<capped)hint(room>0?`Só restam ${room} pontos para este campo.`:'Não há pontos restantes.');
      const txt=String(v);
      if(el.value!==txt)el.value=txt;
      el.dataset.prev=txt;
      refresh();safeCapture();
      return v;
    };
    inputs.forEach(el=>{
      el.dataset.prev=el.value;
      el.addEventListener('input',()=>{
        const n=normalizePointText(el.value,g.max,el.dataset.prev);
        if(n===null){
          if(el.value!=='')el.value='';
          el.dataset.prev='';refresh();safeCapture();return;
        }
        apply(el,n);
      });
      el.addEventListener('focus',()=>{
        const sel=()=>{try{el.select();el.setSelectionRange(0,el.value.length)}catch{}};
        sel();setTimeout(sel,0);
      });
      const settle=()=>apply(el,normalizePointText(el.value,g.max,'')||0);
      el.addEventListener('blur',settle);
      el.addEventListener('change',settle);
      el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.blur()}});
      el.closest('.pt-ctl')?.querySelectorAll('.pt-btn').forEach(btn=>btn.addEventListener('click',e=>{
        e.preventDefault();
        apply(el,Math.max(0,val(el)+(Number(btn.dataset.ptStep)||0)));
      }));
    });
    refresh();
  }
}
function rulesAdmin(){const r=state.characterRules||DEFAULT_RULES;return `<div class="card character-rules-card"><div class="section-kicker">REGRAS DE CRIAÇÃO</div><h2>Limites de pontos</h2><p class="small muted">Defina quantos pontos cada tipo de ficha pode distribuir. Atributos e Perícias são contados separadamente.</p><div class="rules-grid"><section><h3>Campanha principal</h3><div class="field"><label>Pontos de Atributos</label><input id="ruleCampaignAttrs" type="number" min="0" max="999" value="${Number(r.campaign?.attrPoints)||0}"></div><div class="field"><label>Pontos de Perícias</label><input id="ruleCampaignSkills" type="number" min="0" max="999" value="${Number(r.campaign?.skillPoints)||0}"></div><div class="field"><label>Vida e Sanidade máximas (tabela fixa: 18, 24, 27, 36, 45)</label><input id="ruleCampaignHp" type="number" min="1" max="999" value="45" disabled></div></section><section><h3>Slasher</h3><div class="field"><label>Pontos de Atributos</label><input id="ruleSlasherAttrs" type="number" min="0" max="999" value="${Number(r.slasher?.attrPoints)||0}"></div><div class="field"><label>Pontos de Perícias</label><input id="ruleSlasherSkills" type="number" min="0" max="999" value="${Number(r.slasher?.skillPoints)||0}"></div><div class="field"><label>Vida máxima base</label><input id="ruleSlasherHp" type="number" min="1" max="9999" value="${Number(r.slasher?.hpMax)||100}"></div></section></div><div class="row" style="justify-content:flex-end"><button class="btn primary" id="saveCharacterRules">Salvar limites</button></div></div>`}
function bindRulesAdmin(){const b=document.getElementById('saveCharacterRules');if(!b)return;b.onclick=()=>{state.characterRules={campaign:{attrPoints:clamp(document.getElementById('ruleCampaignAttrs').value,0,999),skillPoints:clamp(document.getElementById('ruleCampaignSkills').value,0,999),hpMax:clamp(document.getElementById('ruleCampaignHp').value,1,999)},slasher:{attrPoints:clamp(document.getElementById('ruleSlasherAttrs').value,0,999),skillPoints:clamp(document.getElementById('ruleSlasherSkills').value,0,999),hpMax:clamp(document.getElementById('ruleSlasherHp').value,1,9999)}};save();toast('Limites de criação atualizados globalmente.');document.getElementById('adminContent').innerHTML=playersAdmin();bindAdminContent()}}
function registerPlayer(){lastRenderSig='';document.getElementById('root').innerHTML=`<div class="screen"><form class="login-card register-card" id="registerForm"><img class="sigil" src="/runa-gold.png" alt=""><h1 class="title">Criar Player</h1><p class="subtitle">Crie seu acesso e depois monte sua ficha.</p><div class="field"><label>Login</label><input id="regLogin" autocomplete="username" minlength="3" maxlength="32" required></div><div class="field"><label>Senha</label><input id="regPassword" type="password" autocomplete="new-password" minlength="4" maxlength="72" required></div><div class="field"><label>Tipo de ficha</label><select id="regType"><option value="campaign">Campanha principal</option><option value="slasher">Slasher</option></select></div><div class="field"><label>Nome do personagem</label><input id="regName" maxlength="60" placeholder="Pode preencher depois"></div><div class="row"><button type="button" class="btn" id="cancelRegister">Voltar</button><button class="btn primary" type="submit">Criar acesso</button></div></form></div>`;document.getElementById('cancelRegister').onclick=login;document.getElementById('registerForm').onsubmit=async e=>{e.preventDefault();const loginName=document.getElementById('regLogin').value.trim(),password=document.getElementById('regPassword').value,type=document.getElementById('regType').value==='slasher'?'slasher':'campaign',name=document.getElementById('regName').value.trim()||loginName;if(loginName.toLowerCase()==='sxscroow'){toast('Esse login é reservado ao Mestre.');return}if(state.players.some(p=>String(p.login||'').trim().toLowerCase()===loginName.toLowerCase())){toast('Esse login já existe.');return}if(!remoteEnabled){toast('O servidor de autenticação não está disponível. Tente novamente mais tarde.');return}if(playerStoreEnabled){try{const rows=await fetchPlayerRows();if(rows.some(r=>!r.deleted_at&&String(r.login||r.data?.login||'').trim().toLowerCase()===loginName.toLowerCase())){toast('Esse login já existe.');return}}catch(err){console.warn('Não foi possível consultar os Players antes do cadastro:',err)}}const r=characterRules(type);const p={id:'p-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),login:loginName,name,class:'',campaignType:type,photo:'',soul:'',soulPhoto:'',belovedObjects:'',personality:'',destiny:'',description:'',history:'',playerNotes:'',masterNotes:'',attrBonusPoints:0,skillBonusPoints:0,deityId:'',homeWallpaper:'',musicThemes:[],hp:Math.min(Number(r.hpMax)||35,MAX_HP),hpMax:Math.min(Number(r.hpMax)||35,MAX_HP),attack:0,defense:0,status:'Ativo',extra:0,attrs:blankAttrs(),attrLimits:blankLimits(),skills:blankSkills(),backpack:[],conditions:[],conditionTurns:{},rolls:[],slasherReligion:'',slasherBelief:'',element:'',hunger:100,hungerRoundCounter:0,secretLovedEffect:''};normalize(p);p._syncUpdatedAt=nextStamp();state.players.push(p);ps.lastSnapshot=clone(state.players);state.session={role:'player',login:loginName,playerId:p.id,playerSnapshot:clone(p)};storageSet(KEY,serializeState());try{if(playerStoreEnabled){const rr=await authRegisterPlayer(loginName,password,p);if(rr?.player?._syncUpdatedAt)p._syncUpdatedAt=Number(rr.player._syncUpdatedAt)||p._syncUpdatedAt;ps.hydrated=true}else{save();}}catch(err){state.players=state.players.filter(x=>playerSyncKey(x)!==p.id);state.session=null;storageSet(KEY,serializeState());console.error('Falha ao criar Player:',err);toast(/LOGIN_|SENHA_|MUITAS_/.test(String(err?.message))?authErrorText(err):'Não foi possível salvar o Player no banco. Tente novamente.');return}save();await saveGlobalNow().catch(()=>{});state.session.playerSnapshot=clone(player()||p);toast('Player criado com sucesso.');render('sheet')}}
function login(){lastRenderSig='';curtainRevealPending=true;const brand=siteBrand();document.getElementById('root').innerHTML=`<div class="screen"><form class="login-card" id="loginForm"><img class="sigil" src="${esc(brand.image)}" alt=""><h1 class="title">${esc(brand.name)}</h1><p class="welcome">Bem-vindos ao abismo</p><p class="subtitle">Entre para continuar sua jornada.</p><div class="field"><label>Login</label><input id="login" autocomplete="username" required></div><div class="field"><label>Senha</label><input id="password" type="password" autocomplete="current-password" required></div><button class="btn primary full">Entrar</button><button type="button" class="btn full" id="registerPlayerBtn">Criar login de Player</button></form></div>`;optimizeRenderedImages();document.getElementById('registerPlayerBtn').onclick=registerPlayer;document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const l=document.getElementById('login').value.trim(),p=document.getElementById('password').value;let found=null;
    const submitBtn=document.querySelector('#loginForm button.primary');if(submitBtn)submitBtn.disabled=true;
    try{
      if(!remoteEnabled){
        toast('O servidor de autenticação não está disponível. Tente novamente mais tarde.');
        return;
      }
      const passVariants=p!==p.trim()?[p,p.trim()]:[p];
      if(l.toLowerCase()==='sxscroow'){
        for(const v of passVariants){
          if(await authMasterLogin(v)){ps.readOnly=false;ps.hydrated=false;state.session={role:'master'};save();render('home');return}
        }
      }else{
        for(const v of passVariants){
          const playerResult=await authPlayerLogin(l,v);
          if(playerResult?.player){found=clone(playerResult.player);found._syncUpdatedAt=Number(found._syncUpdatedAt)||Date.now();break}
        }
      }
    }catch(err){toast(authErrorText(err));return}
    finally{if(submitBtn)submitBtn.disabled=false}
    if(found){
      delete found.secretLovedEffect;
      const oldPlayer=state.players.find(x=>playerSyncKey(x)===playerSyncKey(found));
      if(oldPlayer){for(const k of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(found[k])&&imageValue(oldPlayer[k]))found[k]=oldPlayer[k];}
      state.players=state.players.filter(x=>playerSyncKey(x)!==playerSyncKey(found));
      state.players.push(found);normalize(found);
      state.session={role:'player',login:found.login,playerId:found.id,playerSnapshot:clone(found)};
      storageSet(KEY,serializeState());
      save();render('home');return;
    }
    toast('Credenciais inválidas.');}}
function newMonsterDefaults(){return {id:'',name:'',status:'Ativo',hp:20,hpMax:20,sanity:10,sanityMax:10,attack:2,defense:1,damage:'1d6',description:'',abilitiesText:'',attrs:blankAttrs(),attrLimits:blankLimits(),skills:blankSkills(),backpack:[],conditions:[],conditionTurns:{},rolls:[],history:''}}
function entityModal(type,index){const isP=type==='player',e=index===null?(!isP?newMonsterDefaults():{id:'',name:'',login:'',password:'',class:'',status:'Ativo',hp:1,hpMax:1,sanity:1,sanityMax:1,attack:0,defense:0,extra:0,attrBonusPoints:0,skillBonusPoints:0,attrs:blankAttrs(),attrLimits:blankLimits(),skills:blankSkills(),backpack:[],conditions:[],conditionTurns:{},description:'',history:'',soul:'',belovedObjects:'',personality:'',destiny:'',initialSpell:'',personalSpells:[],element:'',hunger:100,hungerRoundCounter:0,secretLovedEffect:''}):clone((isP?state.players:state.creatures)[index]);const attrRows=allAttrs().map(a=>`<label class="skill-line"><span class="skill-name"><i class="skill-icon">${uiAttrIcon(a)}</i>${esc(a)}</span><input class="eAttr" data-attr="${esc(a)}" data-orig="${Number(e.attrs?.[a]??0)}" type="number" min="0" max="8" value="${e.attrs?.[a]??0}"><b>/8</b></label>`).join('');const skillRows=allSkills().map(sk=>`<label class="skill-line"><span class="skill-name"><i class="skill-icon">${uiSkillIcon(sk)}</i>${esc(sk)}</span><input class="eSkill" data-skill="${esc(sk)}" data-orig="${Number(e.skills?.[sk]??0)}" type="number" min="0" max="15" value="${e.skills?.[sk]??0}"><b>/15</b></label>`).join('');return `<div class="modal" id="entityModal"><div class="modal-card"><button class="modal-close" id="closeEntity">×</button><span class="badge">MESTRE</span><h2>${index===null?'Criar':'Editar'} ${isP?'Player':'Monstro'}</h2><div class="input-grid"><div class="field"><label>Nome</label><input id="eName" value="${esc(e.name||'')}"></div>${isP?`<div class="field"><label>Login</label><input id="eLogin" value="${esc(e.login||'')}"></div><div class="field"><label>Senha</label><input id="ePass" type="password" autocomplete="new-password" value="${playerStoreEnabled?'':esc(e.password||'')}" placeholder="${playerStoreEnabled&&index!==null?'Deixe em branco para manter':''}"></div><div class="field"><label>Tipo de ficha</label><select id="eCampaignType"><option value="campaign" ${e.campaignType!=='slasher'?'selected':''}>Campanha principal</option><option value="slasher" ${e.campaignType==='slasher'?'selected':''}>Slasher</option></select></div><div class="field"><label>Classe</label><select id="eClass"><option value="">Escolher depois pelo Player</option>${Object.keys(CLASSES).map(c=>`<option ${e.class===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Elemento</label><select id="eElement"><option value="">Não definido</option>${['Sangue','Morte','Energia','Conhecimento'].map(x=>`<option ${e.element===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Fome</label><input id="eHunger" type="number" min="0" max="100" value="${Number(e.hunger??100)}"><small class="tiny muted">−10 a cada 5 rodadas.</small></div>`:''}<div class="field"><label>Status</label><input id="eStatus" value="${esc(e.status||'Ativo')}"></div><div class="field"><label>Vida máxima</label><input id="hpMax" type="number" min="1" max="${(!isP?9999:(e.campaignType==='slasher'?9999:45))}" value="${Math.min((!isP?9999:(e.campaignType==='slasher'?9999:45)),e.hpMax||1)}"></div><div class="field"><label>Vida atual</label><input id="hp" type="number" min="0" max="${(!isP?9999:(e.campaignType==='slasher'?9999:45))}" value="${Math.min((!isP?9999:(e.campaignType==='slasher'?9999:45)),e.hp??1)}"></div><div class="field"><label>${isP?'Bônus de ataque (Mestre)':'Ataque'}</label><input id="attack" type="number" value="${isP?(e.attackBonus||0):(e.attack||0)}"></div><div class="field"><label>${isP?'Bônus de defesa (Mestre)':'Defesa'}</label><input id="defense" type="number" value="${isP?(e.defenseBonus||0):(e.defense||0)}"></div>${isP?`<div class="field"><label>Determinação máxima</label><input id="eDetMax" type="number" min="0" max="99" value="${e.determinationMax??12}"></div><div class="field"><label>Determinação atual</label><input id="eDet" type="number" min="0" max="99" value="${e.determination??(e.determinationMax??12)}"></div><div class="field"><label>Pontos extras</label><input id="eExtra" type="number" min="0" value="${e.extra||0}"></div><div class="field"><label>Pontos de Atributo concedidos</label><input id="eAttrBonus" type="number" min="0" data-orig="${Number(e.attrBonusPoints)||0}" value="${e.attrBonusPoints||0}"></div><div class="field"><label>Pontos de Perícia concedidos</label><input id="eSkillBonus" type="number" min="0" data-orig="${Number(e.skillBonusPoints)||0}" value="${e.skillBonusPoints||0}"></div>`:''}</div>${isP?`<div class="field"><label>Descrição</label><textarea id="eDescription" rows="3">${esc(e.description||'')}</textarea></div><div class="field"><label>História</label><textarea id="eHistory" rows="3">${esc(e.history||'')}</textarea></div><div class="field secret-master-field"><label>♥ Efeito apaixonado — secreto</label><input id="eSecretLoved" value="${esc(e.secretLovedEffect||'')}" placeholder="Somente o Mestre vê e aplica."><small class="tiny muted">Nunca aparece para o Player.</small></div><div class="input-grid"><div class="field"><label>Alma</label><input id="eSoul" value="${esc(e.soul||'')}"></div><div class="field"><label>Objetos queridos</label><input id="eBeloved" value="${esc(e.belovedObjects||'')}"></div><div class="field"><label>Personalidade</label><input id="ePersonality" value="${esc(e.personality||'')}"></div><div class="field"><label>Destino</label><input id="eDestiny" value="${esc(e.destiny||'')}"></div></div>`:''}${!isP?`<div class="divider"></div><div class="section-heading"><div><span class="section-kicker">CRIATURA</span><h3>Combate e anotações</h3></div></div>${index===null?`<div class="field"><label>Modelo rápido</label><select id="mPreset"><option value="">Personalizado</option><option value="weak">Fraco — 10 Vida, ATQ 1</option><option value="common">Comum — 20 Vida, ATQ 2</option><option value="elite">Elite — 45 Vida, ATQ 4, DEF 3</option><option value="boss">Chefe — 120 Vida, ATQ 6, DEF 5</option></select></div>`:''}<div class="input-grid"><div class="field"><label>Sanidade máxima</label><input id="mSanMax" type="number" min="0" max="999" value="${Number(e.sanityMax??10)}"></div><div class="field"><label>Sanidade atual</label><input id="mSan" type="number" min="0" max="999" value="${Number(e.sanity??e.sanityMax??10)}"></div><div class="field"><label>Dano</label><input id="mDamage" maxlength="40" value="${esc(e.damage||'')}" placeholder="Ex.: 1d8+2"></div></div><div class="field"><label>Descrição / aparência</label><textarea id="mDesc" rows="3" placeholder="Como a criatura se parece, comportamento, fraquezas...">${esc(e.description||'')}</textarea></div><div class="field"><label>Ataques e habilidades</label><textarea id="mAbilities" rows="4" placeholder="Um por linha. Ex.: Mordida — 1d8, causa Sangramento">${esc(e.abilitiesText||'')}</textarea></div>`:''}${isP?``:`<details class="monster-optional"><summary>Atributos e perícias (opcional)</summary>`}<div class="divider"></div><div class="section-heading"><div><span class="section-kicker">ATRIBUTOS</span><h3>Pontos do personagem</h3></div>${isP?`<span class="corner-mark">${characterRules(e.campaignType).attrPoints} pontos</span>`:''}</div><div class="attribute-admin-grid">${attrRows}</div><div class="section-heading" style="margin-top:18px"><div><span class="section-kicker">PERÍCIAS</span><h3>Distribuição</h3></div>${isP?`<span class="corner-mark">${characterRules(e.campaignType).skillPoints} pontos</span>`:''}</div><div class="skill-admin-grid">${skillRows}</div>${isP?``:`</details>`}<div class="section-heading" style="margin-top:18px"><div><span class="section-kicker">ESTADOS</span><h3>Condições</h3></div></div>${conditionsMarkup(e,true)}<div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn" id="cancelEntity">Cancelar</button><button class="btn primary" id="saveEntity">Salvar</button></div></div></div>`}
function openEntity(type,index){openModal(entityModal(type,index));bindEntity(type,index)}
function bindEntity(type,index){const close=()=>document.getElementById('entityModal')?.remove();const isExistingPlayer=type==='player'&&index!==null;if(isExistingPlayer)getPlayerMasterSecret(state.players[index]?.id).then(r=>{const f=document.getElementById('eSecretLoved');if(f)f.value=String(r?.secret_loved_effect||'')}).catch(()=>{});document.getElementById('closeEntity').onclick=close;document.getElementById('mPreset')?.addEventListener('change',ev=>{const P={weak:[10,1,0,'1d4',5],common:[20,2,1,'1d6',10],elite:[45,4,3,'1d8',20],boss:[120,6,5,'2d6',40]}[ev.target.value];if(!P)return;const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v};set('hpMax',P[0]);set('hp',P[0]);set('attack',P[1]);set('defense',P[2]);set('mDamage',P[3]);set('mSanMax',P[4]);set('mSan',P[4])});document.getElementById('cancelEntity').onclick=close;document.querySelectorAll('#entityModal .condition-chip').forEach(b=>b.onclick=()=>b.classList.toggle('active'));document.getElementById('saveEntity').onclick=async()=>{const isP=type==='player',list=isP?state.players:state.creatures;let passwordToSet='',secretLovedDraft='',grantedNote='';let e=index===null?{id:'e-'+Date.now(),name:'',login:'',password:'',class:'Guerreiro',hp:10,hpMax:10,attack:0,defense:0,status:'Ativo',attrs:blankAttrs(),attrLimits:blankLimits(),skills:blankSkills(),backpack:[],conditions:[],conditionTurns:{},rolls:[],history:'',initialSpell:'',personalSpells:[]}:list[index];e.name=document.getElementById('eName').value.trim();if(!e.name){toast('Informe um nome.');return}e.status=document.getElementById('eStatus').value.trim()||'Ativo';if(isP){e.description=document.getElementById('eDescription')?.value.trim()||'';e.extra=Math.max(0,Number(document.getElementById('eExtra')?.value)||0);{const ab=document.getElementById('eAttrBonus'),sb=document.getElementById('eSkillBonus');if(ab&&ab.value!==ab.dataset.orig)e.attrBonusPoints=Math.max(0,Math.floor(Number(ab.value)||0));if(sb&&sb.value!==sb.dataset.orig)e.skillBonusPoints=Math.max(0,Math.floor(Number(sb.value)||0))}}const previousConditions=new Set(e.conditions||[]);const nextConditions=[...document.querySelectorAll('#entityModal .condition-chip.active')].map(x=>x.dataset.condition);e.conditionTurns=e.conditionTurns||{};for(const id of Object.keys(e.conditionTurns)){if(!nextConditions.includes(id))delete e.conditionTurns[id]}e.conditions=nextConditions;for(const id of nextConditions){const c=conditionById(id);if(c?.turns&&!previousConditions.has(id))e.conditionTurns[id]=c.turns}if(isP)e.history=document.getElementById('eHistory')?.value.trim()||e.history||'';if(isP){e.soul=document.getElementById('eSoul')?.value.trim()||'';e.belovedObjects=document.getElementById('eBeloved')?.value.trim()||'';e.personality=document.getElementById('ePersonality')?.value.trim()||'';e.destiny=document.getElementById('eDestiny')?.value.trim()||'';}const hpCap=(!isP?9999:(e.campaignType==='slasher'?9999:45));e.hpMax=clamp(document.getElementById('hpMax').value,1,hpCap);e.hp=clamp(document.getElementById('hp').value,0,e.hpMax);if(isP){e.attackBonus=Number(document.getElementById('attack').value)||0;e.defenseBonus=Number(document.getElementById('defense').value)||0}else{e.attack=Number(document.getElementById('attack').value)||0;e.defense=Number(document.getElementById('defense').value)||0}if(isP){e.login=document.getElementById('eLogin').value.trim();const _np=document.getElementById('ePass').value;passwordToSet=playerStoreEnabled?String(_np||''):'';if(playerStoreEnabled){delete e.newPassword;delete e.password}else e.password=_np;e.determinationMax=clamp(document.getElementById('eDetMax')?.value??DET_DEFAULT_MAX,0,99);e.determination=clamp(document.getElementById('eDet')?.value??e.determinationMax,0,e.determinationMax);e.class=document.getElementById('eClass').value;e.element=document.getElementById('eElement')?.value||'';e.hunger=clamp(document.getElementById('eHunger')?.value??100,0,100);secretLovedDraft=document.getElementById('eSecretLoved')?.value.trim()||'';e.campaignType=document.getElementById('eCampaignType')?.value==='slasher'?'slasher':'campaign';e.initialSpell=e.initialSpell||'';if(!hasMagicClass(e.class))e.initialSpell='';if(!e.login||(playerStoreEnabled?(index===null&&!passwordToSet):!e.password)){toast('Login e senha são obrigatórios.');return}
if(e.login.toLowerCase()==='sxscroow'||state.players.some((p,i)=>i!==index&&String(p.login||'').trim().toLowerCase()===e.login.toLowerCase())){toast('Esse login já existe.');return}}let attrsEdited=false,skillsEdited=false;e.attrLimits=e.attrLimits||blankLimits();e.attrs=e.attrs||blankAttrs();document.querySelectorAll('.eMin').forEach(x=>e.attrLimits[x.dataset.attr].min=Number(x.value)||0);document.querySelectorAll('.eMax').forEach(x=>e.attrLimits[x.dataset.attr].max=Number(x.value)||10);document.querySelectorAll('.eAttr').forEach(x=>{if(x.dataset.orig!==undefined&&String(x.value)===x.dataset.orig)return;attrsEdited=true;e.attrs[x.dataset.attr]=clamp(x.value,0,MAX_ATTR)});e.skills=e.skills||blankSkills();document.querySelectorAll('.eSkill').forEach(x=>{if(x.dataset.orig!==undefined&&String(x.value)===x.dataset.orig)return;skillsEdited=true;e.skills[x.dataset.skill]=clamp(x.value,0,MAX_SKILL)});if(isP){const rr0=characterRules(e.campaignType),tt0=allocationTotals(e),needA=tt0.attrs-(Number(rr0.attrPoints)+(Number(e.attrBonusPoints)||0)),needS=tt0.skills-(Number(rr0.skillPoints)+(Number(e.skillBonusPoints)||0));if(needA>0&&attrsEdited){e.attrBonusPoints=(Number(e.attrBonusPoints)||0)+needA;grantedNote+=' +'+needA+' ponto(s) de Atributo concedido(s).'}if(needS>0&&skillsEdited){e.skillBonusPoints=(Number(e.skillBonusPoints)||0)+needS;grantedNote+=' +'+needS+' ponto(s) de Perícia concedido(s).'}const r=characterRules(e.campaignType);if(e.campaignType==='slasher'&&Number(r.hpMax)>MAX_HP){e.hpMax=Math.min(Number(r.hpMax),9999);e.hp=clamp(e.hp,0,e.hpMax)}}if(!isP){e.sanityMax=clamp(Number(document.getElementById('mSanMax')?.value)||0,0,999);e.sanity=clamp(Number(document.getElementById('mSan')?.value)||0,0,e.sanityMax);e.damage=document.getElementById('mDamage')?.value.trim()||'';e.description=document.getElementById('mDesc')?.value.trim()||'';e.abilitiesText=document.getElementById('mAbilities')?.value.trim()||'';e.kind='monster';delete e.login;delete e.password}const _ce=[];for(const id of nextConditions){if(!previousConditions.has(id))_ce.push(...applyConditionOnAdd(e,id))}if(previousConditions.has('fractured')&&!nextConditions.includes('fractured')&&e.weakenedByFracture){e.conditions=(e.conditions||[]).filter(x=>x!=='weakened');delete e.weakenedByFracture;if(e.conditionTurns)delete e.conditionTurns.weakened}if(isP)syncDerivedResources(e);normalize(e);if(index===null){if(playerStoreEnabled)e._pendingCreate=true;list.push(e)}else if(isP)delete e._pendingCreate;
if(isP&&playerStoreEnabled){
  if(passwordToSet&&(passwordToSet.length<4||passwordToSet.length>72)){toast('A senha do Player deve ter de 4 a 72 caracteres.');return}
  save();
  let synced=false;
  try{synced=!!(await syncPlayersDbNow(false,{fresh:true}))}catch(err){console.error('Sync do Player falhou:',err)}
  if(index===null&&!synced){toast('Não foi possível criar o Player no servidor. Confira a conexão e tente novamente.');return}
  if(passwordToSet){
    try{await changePlayerPassword(e.id,passwordToSet)}
    catch(err){
      console.error('Falha ao trocar senha do Player:',err);
      const raw=String(err?.message||err||'');
      toast(/SENHA_INVALIDA/.test(raw)?'A senha do Player deve ter de 4 a 72 caracteres.'
        :/NAO_AUTORIZADO|SESSAO_INVALIDA/.test(raw)?'Sessão do Mestre expirada. Entre novamente e repita a troca.'
        :/PLAYER_ID_INVALIDO/.test(raw)?'Este Player ainda não existe no servidor. Salve a ficha de novo e repita a troca.'
        :/PLAYER_EXCLUIDO/.test(raw)?'Este Player foi excluído; restaure-o antes de trocar a senha.'
        :/could not find the function|PGRST202|42883/i.test(raw)?'O banco não tem a função de troca de senha. Aplique as migrations do Supabase (supabase db push).'
        :'Não foi possível trocar a senha no servidor. Tente novamente.');
      return;
    }
  }
  let secretOk=true;
  try{await savePlayerMasterSecret(e.id,secretLovedDraft)}catch(err){secretOk=false;console.error('Falha ao salvar segredo do Mestre:',err)}
  delete e.newPassword;
  toast(passwordToSet?(synced?'Player e senha salvos no servidor.':'Senha trocada no servidor. A ficha sincroniza assim que a conexão voltar.')
    :(synced?'Player salvo no servidor.':'Player salvo neste aparelho; sincroniza quando a conexão voltar.')+(secretOk?'':' (anotação secreta não foi salva)'));
}else{
  save();
  if(!isP){try{await saveGlobalNow()}catch(err){console.error('Falha ao sincronizar Monstro:',err);toast('Monstro salvo neste aparelho, mas a sincronização falhou. Confira a conexão.');close();render('master');return}}
  toast(_ce.length?`${e.name||'Alvo'}: ${_ce.join(' • ')}`:`${isP?'Player':'Monstro'} salvo.`);
}
close();render('master');if(grantedNote)setTimeout(()=>toast('Limite de pontos ajustado pelo Mestre:'+grantedNote),1600);if(isP){const ov=allocationOver(e);if(ov.attrs||ov.skills)setTimeout(()=>toast(`${e.name}: pontos acima do limite (${ov.attrs?'Atributos +'+ov.attrs:''}${ov.attrs&&ov.skills?' • ':''}${ov.skills?'Perícias +'+ov.skills:''}). Use Pontos → Devolver pontos gastos, ou ele reduz sozinho.`),grantedNote?4200:1600)}}}
function bindItemModal(id){
 const close=()=>document.getElementById('itemModal')?.remove();
 document.getElementById('closeItem').onclick=close;document.getElementById('cancelItem').onclick=close;
 const rebuildPages=()=>{const box=document.getElementById('bookPagesEditor');if(!box)return;const vals=[...box.querySelectorAll('.book-page-input')].map(x=>x.value);box.innerHTML=vals.map((pg,i)=>`<div class="book-page-editor" data-page-index="${i}"><div class="row space"><strong>Página ${i+1}</strong>${vals.length>1?`<button type="button" class="btn small danger" data-remove-book-page="${i}">Excluir página</button>`:''}</div><textarea class="book-page-input" rows="8" placeholder="Escreva o conteúdo da página ${i+1}...">${esc(pg)}</textarea></div>`).join('');bindPageButtons()};
 const bindPageButtons=()=>document.querySelectorAll('#bookPagesEditor [data-remove-book-page]').forEach(b=>b.onclick=()=>{const box=document.getElementById('bookPagesEditor');const vals=[...box.querySelectorAll('.book-page-input')].map(x=>x.value);if(vals.length<=1)return;vals.splice(Number(b.dataset.removeBookPage),1);box.innerHTML=vals.map((pg,i)=>`<div class="book-page-editor" data-page-index="${i}"><div class="row space"><strong>Página ${i+1}</strong>${vals.length>1?`<button type="button" class="btn small danger" data-remove-book-page="${i}">Excluir página</button>`:''}</div><textarea class="book-page-input" rows="8" placeholder="Escreva o conteúdo da página ${i+1}...">${esc(pg)}</textarea></div>`).join('');bindPageButtons()});
 document.getElementById('addBookPage')?.addEventListener('click',()=>{const box=document.getElementById('bookPagesEditor');const vals=[...box.querySelectorAll('.book-page-input')].map(x=>x.value);vals.push('');box.innerHTML=vals.map((pg,i)=>`<div class="book-page-editor" data-page-index="${i}"><div class="row space"><strong>Página ${i+1}</strong>${vals.length>1?`<button type="button" class="btn small danger" data-remove-book-page="${i}">Excluir página</button>`:''}</div><textarea class="book-page-input" rows="8" placeholder="Escreva o conteúdo da página ${i+1}...">${esc(pg)}</textarea></div>`).join('');bindPageButtons()});
 bindPageButtons();
 document.getElementById('saveItem').onclick=()=>{let n=Number(document.getElementById('iId').value);if(!Number.isInteger(n)||n<1){toast('ID inválido.');return}if(id===null&&state.items.some(i=>i.id===n)){toast('Já existe um item com esse ID.');return}if(id===300)n=300;const e=id===null?{id:n}:item(id);e.id=n;if(n===300){e.name='Chave';e.category='Itens Chave';e.description=e.description||'Uma chave simples para uma fechadura compatível.';e.icon='asset:key';e.weight=1}e.name=document.getElementById('iName').value.trim();e.description=document.getElementById('iDesc').value.trim();e.category=document.getElementById('iCat').value;e.maxQty=Math.max(1,Number(document.getElementById('iMax').value)||1);e.weight=clamp(document.getElementById('iWeight').value,1,3);e.icon=document.getElementById('iIcon').value.trim()||'✦';e.damage=isWeaponItem(e)?(document.getElementById('iDamage')?.value.trim()||weaponDamageFallback(e)) : '';e.effects=document.getElementById('iEffects').value.trim();e.bookPages=[...document.querySelectorAll('#bookPagesEditor .book-page-input')].map(x=>x.value.trim()).filter(Boolean);e.bookContent=e.bookPages.join('\n\n')||'';e.rarity=document.getElementById('iRar').value;if(!e.name){toast('Informe o nome do item.');return}if(id===null)state.items.push(e);save();close();toast('Item salvo.');render('master')};
}
let currentView='home';
let curtainBusy=false,curtainRevealPending=true;
let adminTabCurrent='players';
function captureInnerScroll(root){if(!root)return [];const selectors=['.panel-tabs','.table-wrap','.panel-scroll','.horizontal-scroll','.slot-grid'];const out=[];for(const sel of selectors){for(const el of root.querySelectorAll(sel)){if(el.scrollLeft>0||el.scrollTop>0)out.push({sel,l:el.scrollLeft,t:el.scrollTop})}}return out}
function restoreInnerScroll(root,saved){if(!root||!saved?.length)return;const buckets=new Map();for(const it of saved){const list=buckets.get(it.sel)||[];list.push(it);buckets.set(it.sel,list)}for(const [sel,list] of buckets){const els=root.querySelectorAll(sel);list.forEach((it,i)=>{const el=els[i];if(el){el.scrollLeft=it.l;el.scrollTop=it.t}})}}
function jumpScroll(y){try{if(Math.abs(window.scrollY-y)>1)window.scrollTo({top:y,left:0,behavior:'auto'})}catch{if(Math.abs(window.scrollY-y)>1)window.scrollTo(0,y)}}
function render(view='home',opts={}){
  if(view==='home'&&state.session?.role==='player')view='immersive';
  const prev=currentView,same=prev===view,rootEl=document.getElementById('root');
  const ae=document.activeElement;
  if(opts?.remote&&ae&&/^(TEXTAREA|INPUT|SELECT)$/.test(ae.tagName)&&rootEl?.contains?.(ae)){deferredRemoteRender=true;return}
  const y=window.scrollY,inner=same?captureInnerScroll(rootEl):[];
  const oldRootHeight=Math.max(0,rootEl?.getBoundingClientRect?.().height||0);
  const oldOverflowAnchor=rootEl?.style?.overflowAnchor||'';
  if(same&&rootEl){
    rootEl.style.minHeight=`${Math.ceil(oldRootHeight)}px`;
    rootEl.style.overflowAnchor='none';
  }
  if(rootEl)rootEl.classList.toggle('no-enter-anim',!!same);
  renderOpts=opts||{};renderSkipped=false;
  try{renderCore(view)}finally{renderOpts={}}
  if(renderSkipped){if(rootEl){rootEl.style.minHeight='';rootEl.style.overflowAnchor=oldOverflowAnchor}return}
  if(same){jumpScroll(y);restoreInnerScroll(rootEl,inner);requestAnimationFrame(()=>{jumpScroll(y);restoreInnerScroll(rootEl,inner);if(rootEl){rootEl.style.minHeight='';rootEl.style.overflowAnchor=oldOverflowAnchor}})}
  else jumpScroll(0);
}
function makeRenderSignature(view,html){
  let h1=0x811c9dc5,h2=0x9e3779b9;
  for(let i=0;i<html.length;i++){
    const c=html.charCodeAt(i);
    h1=Math.imul(h1^c,0x01000193);
    h2=Math.imul(h2^c,0x85ebca6b);
  }
  const extra=JSON.stringify(state.terrorMode||{})+'\u0001'+JSON.stringify(state.siteBrand||{});
  for(let i=0;i<extra.length;i++){const c=extra.charCodeAt(i);h1=Math.imul(h1^c,0x01000193);h2=Math.imul(h2^c,0x85ebca6b)}
  return view+'\u0001'+html.length+'\u0001'+(h1>>>0).toString(36)+'-'+(h2>>>0).toString(36);
}

function optimizeRenderedImages(root=document.getElementById('root')){
  if(!root?.querySelectorAll)return;
  for(const img of root.querySelectorAll('img')){
    if(!img.hasAttribute('decoding'))img.decoding='async';
    if(!img.hasAttribute('loading'))img.loading=img.matches('.sigil,.brand img')?'eager':'lazy';
  }
}
function renderCore(view='home'){
  if(state.session?.role!=='player'&&immersivePuzzleUnlocked&&Object.keys(immersivePuzzleUnlocked).length)clearImmersivePuzzleState();
  if(isTvMode()){currentView='tv';lastRenderSig='';document.getElementById('root').innerHTML=tvPage();optimizeRenderedImages();bindNav();bindTvPage();return}
  const prevView=currentView;
  currentView=view;
  viewCacheSet(view);
  if(!state.session?.role && state.session?.playerSnapshot?.login)state.session={role:'player',login:state.session.playerSnapshot.login,playerId:state.session.playerSnapshot.id,playerSnapshot:clone(state.session.playerSnapshot)};
  if(!state.session?.role){
    try{
      const cached=readStoredSession();
      if(cached?.role==='master')state.session={role:'master'};
      else if(cached?.role==='player'&&String(cached.login||'').trim())state.session={role:'player',login:cached.login,playerId:cached.playerId||'',playerSnapshot:cached.playerSnapshot||null};
    }catch{}
  }
  if(remoteEnabled&&state.session?.role&&!getAuthToken()){state.session=null;clearSessionCache();setTimeout(()=>toast('Atualizamos a segurança do site. Entre novamente.'),300)}
  const validSession=state.session?.role==='master'||(state.session?.role==='player'&&!!String(state.session.login||'').trim());
  if(!validSession){
    if(state.session||storageGet(SESSION_CACHE_KEY))console.warn('[Ashen Testimony] Sessão inválida ao abrir a view "'+view+'"; voltando ao login.');
    applySiteBrand();login();syncSoundboard();return
  }
  let html;
  try{
    html=view==='sheet'?(state.session.role==='master'?masterFicha():sheet()):view==='classes'?classesPage():view==='master'&&state.session.role==='master'?admin():view==='map'&&state.session.role==='player'?shell(campaignMapPage(state,false,player()),'map'):view==='immersive'&&state.session.role==='player'?immersivePage():view==='diary'&&state.session.role==='player'?diaryPage():view==='library'&&state.session.role==='player'?libraryPage():view==='spells'&&state.session.role==='player'?spellsPage():view==='nexus'?nexusPage():view==='secrets'&&state.session.role==='player'?secretCluesPage():view==='tv'?tvPage():home();
  }catch(error){
    console.error('[Ashen Testimony] Falha ao montar a tela "'+view+'":',error);
    html=shell(`<div class="empty">Não foi possível carregar esta parte da ficha agora. Toque novamente na aba ou recarregue a página.<br><small class="muted">${esc(String(error?.message||error||''))}</small></div>`,view);
  }
  const keepViewScroll=prevView===view,savedTabsScroll=(keepViewScroll&&view==='master')?(document.querySelector('.panel-tabs')?.scrollLeft||0):0,savedScrollY=keepViewScroll?window.scrollY:0;if(view==='master'&&!keepViewScroll)adminTabCurrent='players';const renderSig=makeRenderSignature(view,html);if(renderOpts.remote&&prevView===view&&renderSig===lastRenderSig&&document.getElementById('root').firstElementChild){renderSkipped=true;return}lastRenderSig=renderSig;document.getElementById('root').innerHTML=html;optimizeRenderedImages();if(view==='immersive'&&state.session?.role==='player'&&!curtainBusy&&(prevView!=='immersive'||curtainRevealPending)){curtainRevealPending=false;curtainReveal()}applySiteBrand();document.getElementById('terrorOverlay')?.remove();if(state.terrorMode?.active){document.body.insertAdjacentHTML('beforeend',terrorOverlay());document.getElementById('forceDisableTerror')?.addEventListener('click',async()=>{if(!confirm('Desativar o Modo Terror para todos os Players?'))return;state.terrorMode={...defaultTerrorMode(),active:false,updatedAt:Date.now()};try{await saveGlobalNow()}catch(e){console.warn('Falha ao sincronizar a desativação do Modo Terror:',e)}document.getElementById('terrorOverlay')?.remove();save();render(currentView||'home')})}bindNav();document.querySelectorAll('[data-open-secret-clues]').forEach(b=>b.onclick=()=>render('secrets'));if(view==='home'){if(state.session?.role==='master')bindMasterHome();document.querySelectorAll('[data-play-theme]').forEach(b=>b.onclick=()=>{const p=player(),t=p?.musicThemes?.[Number(b.dataset.playTheme)];if(t)playPersonalTheme(t.url,t.title,Number(b.dataset.playTheme))});document.querySelectorAll('[data-pause-theme]').forEach(b=>b.onclick=()=>pausePersonalTheme());document.querySelectorAll('[data-stop-theme]').forEach(b=>b.onclick=()=>stopPersonalTheme());document.getElementById('spotifyHomePlay')?.addEventListener('click',spotifyPlayCurrent);document.getElementById('spotifyHomePause')?.addEventListener('click',spotifyPause);document.getElementById('spotifyHomeLogin')?.addEventListener('click',async()=>{let id=spotifyClientId();if(!id){id=prompt('Cole o Client ID do seu aplicativo Spotify:')?.trim()||'';if(id)try{localStorage.setItem(SPOTIFY_CLIENT_KEY,id)}catch{}}if(id)await spotifyLogin()})}if(view==='diary')document.getElementById('savePrivateDiary')?.addEventListener('click',()=>{savePrivateDiary(document.getElementById('privateDiaryText')?.value||'');toast('Diário salvo neste dispositivo.')});if(view==='library')document.querySelectorAll('[data-read-book]').forEach(b=>b.onclick=()=>openBookReader(Number(b.dataset.readBook)));if(view==='master'){bindAdmin();if(keepViewScroll){if(view==='master'&&adminTabCurrent!=='players')document.querySelector(`[data-tab="${adminTabCurrent}"]`)?.click();const tabsEl=document.querySelector('.panel-tabs');if(view==='master'&&tabsEl)tabsEl.scrollLeft=savedTabsScroll;window.scrollTo(0,savedScrollY);requestAnimationFrame(()=>window.scrollTo(0,savedScrollY))}}if(view==='map'&&state.session?.role==='player')bindCampaignMap({state,isMaster:false,currentPlayer:player(),save,saveGlobal:saveGlobalNow,toast,rerender:()=>render('map')});if(view==='nexus')bindNexus();if(view==='tv')bindTvPage();if(view==='immersive')bindImmersive();if(view==='spells'&&state.session?.role==='player')bindSpellsPage();if(view==='sheet'&&state.session.role==='master')bindMasterFicha();if(view==='sheet'&&state.session.role==='player')bindSheet();if(view==='classes'){const p=player();document.querySelectorAll('[data-slasher-religion]').forEach(b=>b.onclick=()=>{if(!p||p.campaignType!=='slasher')return;p.slasherReligion=b.dataset.slasherReligion;p.slasherBelief='';save();render('classes')});document.querySelectorAll('[data-slasher-belief]').forEach(b=>b.onclick=()=>{if(!p||p.campaignType!=='slasher'||p.slasherReligion!=='yes')return;p.slasherBelief=b.dataset.slasherBelief;save();render('classes')});const choose=b=>{if(!p||classChosen(p)){toast('A classe já foi escolhida e não pode ser alterada.');return}if(p.campaignType==='slasher'&&!(p.slasherReligion==='no'||(p.slasherReligion==='yes'&&p.slasherBelief))){toast('Responda às perguntas de origem antes de escolher uma profissão.');return}const name=b.dataset.classChoice;const c=CLASSES[name];if(!c||((p.campaignType==='slasher')!==!!c.slasher)){toast('Essa escolha não pertence a este tipo de ficha.');return}if(!confirm(`Escolher ${name}?\n\nEsta escolha é definitiva para este personagem.`))return;p.class=name;p.initialSpell='';save();toast('Seu destino está selado.');render('sheet')};document.querySelectorAll('[data-class-choice]').forEach(b=>{b.setAttribute('role','button');b.setAttribute('tabindex','0');b.onclick=()=>choose(b);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(b)}}})}syncGlobalMusic();syncSoundboard();applyBackgrounds()}
function combatRules(){return {...COMBAT_DEFAULT,...((state&&state.characterRules&&state.characterRules.combat)||{})}}
function derivedCombat(e){
  const r=combatRules(),corpo=effectiveAttr(e,'Corpo'),slasher=e?.campaignType==='slasher';
  let atk=Math.max(Number(r.atkMin)||0,corpo*(Number(r.atkMult)||0)),def=Math.max(Number(r.defMin)||0,corpo*(Number(r.defMult)||0));
  if(!slasher){atk=Math.min(atk,Number(r.atkCap)||atk);def=Math.min(def,Number(r.defCap)||def)}
  const weak=(e?.conditions||[]).includes('weakened')?WEAKENED_PENALTY:0;
  return {atk:Math.max(0,atk+(Number(e?.attackBonus)||0)-weak),def:Math.max(0,def+(Number(e?.defenseBonus)||0)-weak),baseAtk:atk,baseDef:def,weak,slasher,rules:r};
}
function combatBoxes(e,dis){
  if(e&&'login' in e){
    const c=derivedCombat(e),r=c.rules,note=(mult,cap)=>c.slasher?`Corpo × ${mult} (sem limite no Slasher)`:`Corpo × ${mult} (máx. ${cap})`;
    const weakNote=c.weak?`<small class="det-note">Debilitado −${c.weak}</small>`:'';
    return `<div class="resource-box"><span>ATAQUE</span><strong>${c.atk}</strong><small>${note(r.atkMult,r.atkCap)}</small>${weakNote}</div><div class="resource-box"><span>DEFESA</span><strong>${c.def}</strong><small>${note(r.defMult,r.defCap)}</small>${weakNote}</div>`;
  }
  return `<div class="resource-box"><span>ATAQUE</span><strong>${e.attack}</strong><div class="field"><input id="attack" type="number" value="${e.attack}" ${dis}></div></div><div class="resource-box"><span>DEFESA</span><strong>${e.defense}</strong><div class="field"><input id="defense" type="number" value="${e.defense}" ${dis}></div></div>`;
}

function detValues(p){const max=clamp(p?.determinationMax??DET_DEFAULT_MAX,0,99);return {max,cur:clamp(p?.determination??max,0,max)}}
function determinationBadge(p,controls=false){
  const {max,cur}=detValues(p);
  return `<div class="det-badge" title="Determinação restante">${controls?'<button type="button" class="det-btn" data-det-delta="-1" aria-label="Gastar 1 de determinação">−</button>':''}<span class="det-num"><b data-det-cur>${cur}</b>/<span data-det-max>${max}</span></span>${controls?'<button type="button" class="det-btn" data-det-delta="1" aria-label="Recuperar 1 de determinação">+</button>':''}</div>`;
}
function updateDeterminationUI(p){const {max,cur}=detValues(p);document.querySelectorAll('[data-det-cur]').forEach(x=>x.textContent=cur);document.querySelectorAll('[data-det-max]').forEach(x=>x.textContent=max)}
function sessionDiamondCard(p,{controls=false,big=false}={}){
  const c=state.combatSession||defaultCombatSession();
  const current=combatCurrent(c);const myKey=p?combatParticipantKey('player',p.id||p.login):'';
  const myTurn=!!current&&current.key===myKey;
  const acted=(c.actedKeys||[]).includes(myKey);
  const {max,cur}=detValues(p||{});
  return `<div class="sess-card ${big?'big':''} ${myTurn?'is-my-turn':''}"><div class="sess-diamond"><img src="${esc(safeImgSrc(p?.photo,'/ritual.webp'))}" alt=""></div><div class="sess-info"><strong class="sess-name">${esc(p?.name||'Player')}</strong><div class="sess-det"><b data-det-cur>${cur}</b><span class="sess-det-label"> determinação</span></div><div class="sess-turn-state">${c.active?(myTurn?'▶ SUA VEZ':acted?'✓ JÁ AGIU':'AGUARDANDO'):'COMBATE INATIVO'}</div>${controls?'<div class="sess-det-ctl"><button type="button" class="det-btn" data-det-delta="-1" aria-label="Gastar 1 de determinação">−</button><button type="button" class="det-btn" data-det-delta="1" aria-label="Recuperar 1 de determinação">+</button></div>':''}</div></div>`;
}

function applyConditionOnAdd(e,id){
  const ev=[];if(!e||!id)return ev;
  e.conditionTick=e.conditionTick&&typeof e.conditionTick==='object'?e.conditionTick:{};
  const b=normalizeCombatSession();e.conditionTick[id]=b?.active?Math.max(0,Number(b.round)||0):0;
  if(id==='fractured'){
    const before=Number(e.hp)||0;e.hp=clamp(before-FRACTURE_DAMAGE,0,e.hpMax||MAX_HP);ev.push(`Fratura: -${before-e.hp} Vida`);
    e.conditions=Array.isArray(e.conditions)?e.conditions:[];
    if(!e.conditions.includes('weakened')){e.conditions.push('weakened');e.weakenedByFracture=true;ev.push('Debilitado aplicado')}
  }
  return ev;
}
function tickConditions(e,round){
  const ev=[];if(!e)return ev;
  e.conditionTick=e.conditionTick&&typeof e.conditionTick==='object'?e.conditionTick:{};e.conditionTurns=e.conditionTurns||{};
  for(const id of [...(e.conditions||[])]){
    const c=conditionById(id);if(!c||!(c.damage||c.turns||Number(e.conditionTurns[id])>0))continue;
    if((Number(e.conditionTick[id])||0)>=round)continue;
    e.conditionTick[id]=round;
    if(c.damage){const before=Number(e.hp)||0;e.hp=clamp(before-c.damage,0,e.hpMax||MAX_HP);ev.push(`${c.name}: -${before-e.hp} Vida`)}
    if(Number(e.conditionTurns[id])>0){e.conditionTurns[id]-=1;if(e.conditionTurns[id]<=0){delete e.conditionTurns[id];delete e.conditionTick[id];e.conditions=e.conditions.filter(x=>x!==id);ev.push(`${c.name}: efeito encerrado`)}}
  }
  return ev;
}

function spellsPage(){
  const p=player();if(!p)return shell('<div class="empty">Player não encontrado.</div>','spells');
  normalize(p);syncDerivedResources(p);
  const sanMax=derivedMax(p,'Sanidade')||0,cur=clamp(p.sanity??sanMax,0,sanMax);
  return shell(`<section class="hero spells-hero"><span class="badge">GRIMÓRIO</span><h1>Magias</h1><p>As magias que você conhece, o quanto custam da sua Sanidade e quantos turnos cada ritual leva para ser completado.</p><div class="spells-san"><span>SANIDADE</span><b>${cur}</b><small>/ ${sanMax}</small></div></section>${playerSpellPanel(p)}`,'spells');
}
function bindSpellEditing(p,view){
  document.getElementById('newPersonalSpell')?.addEventListener('click',()=>openPersonalSpellEditor(p,null,view));
  document.querySelectorAll('[data-edit-personal-spell]').forEach(b=>b.onclick=()=>openPersonalSpellEditor(p,b.dataset.editPersonalSpell,view));
  document.querySelectorAll('[data-delete-personal-spell]').forEach(b=>b.onclick=()=>{
    const id=String(b.dataset.deletePersonalSpell),list=normalizePersonalSpells(p),idx=list.findIndex(x=>String(x.id)===id);
    if(idx<0)return;
    if(!confirm('Excluir esta magia pessoal?'))return;
    list.splice(idx,1);save();toast('Magia pessoal excluída.');render(view);
  });
}
function bindSpellsPage(){
  const p=player();if(!p)return;
  document.querySelectorAll('[data-use-spell]').forEach(b=>b.onclick=()=>castSpell(p,b.dataset.useSpell,'spells'));
  bindSpellEditing(p,'spells');
}

function castSpell(p,id,view='sheet'){
  const sp=spellByPlayer(p,id);if(!sp||!p)return;
  const cost=spellCost(sp),max=derivedMax(p,'Sanidade'),current=clamp(p.sanity??max,0,max);
  if(cost>current){toast(`Sanidade insuficiente. Necessário: ${cost}. Atual: ${current}.`);return}
  const ritualLine=spellIsRitual(sp)?`\n${spellRitualText(sp)}`:'';
  if(!confirm(`Usar ${sp.name}?\n\nCusto: ${cost} Sanidade${ritualLine}\nSanidade atual: ${current} / ${max}`))return;
  p.sanity=clamp(current-cost,0,max);save();updateResourceBars(p,'sanity');
  toast(spellIsRitual(sp)?`${sp.name} iniciada. -${cost} Sanidade (restam ${p.sanity}). ${spellRitualText(sp)}.`:`${sp.name} usada. -${cost} Sanidade (restam ${p.sanity}).`);render(view);
}

function themeIsAudio(t){return t?.kind==='file'||/\.(mp3|m4a|aac|wav|ogg|oga|opus)(\?|#|$)/i.test(String(t?.url||''))||!!spotifyResource(t?.url)||isSpotifyShortLink(t?.url)}
let personalAudio=null;
let personalAudioUrl='';
let personalAudioThemeIndex=-1;
let personalSpotifyPlaying=false;
let personalSpotifyResource=null;
function personalThemeRoot(){return document.getElementById('personal-player')}
async function stopPersonalTheme(renderControls=true){
  if(personalAudio){try{personalAudio.pause();personalAudio.currentTime=0}catch{}}
  if(personalSpotifyPlaying){try{await spotifyPause()}catch{}}
  if(personalAudioUrl){try{URL.revokeObjectURL(personalAudioUrl)}catch{} }
  personalAudio=null;personalAudioUrl='';personalAudioThemeIndex=-1;personalSpotifyPlaying=false;personalSpotifyResource=null;
  const root=personalThemeRoot();if(root&&renderControls)root.innerHTML='';
}
function updatePersonalPlayerTime(){
  const root=personalThemeRoot();if(!root||!personalAudio)return;
  const current=formatTime(personalAudio.currentTime||0);
  const duration=formatTime(personalAudio.duration||0);
  const timeEl=root.querySelector('[id="ppTime"]');
  if(timeEl)timeEl.textContent=`${current} / ${duration}`;
}
function formatTime(seconds){const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`}
function skipToNextPersonalTheme(currentIndex){
  const p=player();if(!p||!Array.isArray(p.musicThemes)||p.musicThemes.length===0)return;
  const themes=p.musicThemes;
  let nextIdx=Number(currentIndex)+1;
  if(!Number.isFinite(nextIdx)||nextIdx<0)nextIdx=0;
  if(nextIdx>=themes.length)nextIdx=0;
  const nextTheme=themes[nextIdx];
  if(nextTheme)playPersonalTheme(nextTheme.url,nextTheme.title,nextIdx);
}
async function pausePersonalTheme(){
  if(personalSpotifyPlaying){try{await spotifyPause()}catch{};personalSpotifyPlaying=false;syncPersonalPlayer();return}
  if(personalAudio){try{personalAudio.pause()}catch{}}
  syncPersonalPlayer();
}
function syncPersonalPlayer(){
  const root=personalThemeRoot();if(!root)return;
  const stateEl=root.querySelector('[data-personal-state]');
  if(stateEl)stateEl.textContent=personalSpotifyPlaying?'TOCANDO (SPOTIFY)':(personalAudio&&!personalAudio.paused?'TOCANDO':'PAUSADA');
  if(personalAudio)updatePersonalPlayerTime();
}
function renderPersonalPlayer(title,index){
  const root=personalThemeRoot();if(!root)return;
  root.innerHTML=`<div class="personal-player-box"><div class="pp-head"><div><span class="section-kicker">TRILHA PESSOAL</span><strong id="ppTitle"></strong><small data-personal-state>TOCANDO</small><span id="ppTime" class="muted">00:00 / 00:00</span></div><button type="button" id="ppClose" aria-label="Fechar">×</button></div><div class="pp-controls"><button type="button" class="btn small gold" id="ppRewind" title="Voltar para o início">↶</button><button type="button" class="btn small gold" id="ppPause">Ⅱ Pausar</button><button type="button" class="btn small" id="ppStop">■ Parar</button><button type="button" class="btn small gold" id="ppNext" title="Próxima trilha">↷</button><input id="ppVolume" type="range" min="0" max="100" value="85" aria-label="Volume da trilha pessoal"><span id="ppVolumeValue">85%</span></div></div>`;
  root.querySelector('#ppTitle').textContent=title||'Trilha do personagem';
  root.querySelector('#ppPause').onclick=async()=>{if(personalSpotifyPlaying){await pausePersonalTheme();return}if(personalAudio?.paused){personalAudio.play().catch(()=>{});syncPersonalPlayer()}else await pausePersonalTheme()};
  root.querySelector('#ppStop').onclick=()=>stopPersonalTheme();
  root.querySelector('#ppClose').onclick=()=>stopPersonalTheme();
  root.querySelector('#ppRewind').onclick=()=>{if(personalAudio){personalAudio.currentTime=0}else if(personalSpotifyPlaying){spotifyApi('/me/player/seek?position_ms=0',{method:'PUT'}).catch(()=>{})}};
  root.querySelector('#ppNext').onclick=()=>skipToNextPersonalTheme(index);
  root.querySelector('#ppVolume').oninput=e=>{const vol=Math.max(0,Math.min(1,Number(e.target.value)/100));if(personalAudio)personalAudio.volume=vol;if(spotifyPlayer)spotifyPlayer.setVolume(vol).catch(()=>{});root.querySelector('#ppVolumeValue').textContent=Math.round(Number(e.target.value))+'%'};
  if(personalAudio)personalAudio.ontimeupdate=()=>updatePersonalPlayerTime();
}
async function resolveSpotifyResource(url){
  const direct=spotifyResource(url);if(direct)return direct;
  const raw=String(url||'').trim();
  if(!isSpotifyShortLink(raw))return null;
  try{
    const res=await fetch(`/api/resolve-spotify?url=${encodeURIComponent(raw)}`);
    if(res.ok){const data=await res.json().catch(()=>null);const r=spotifyResource(data?.url||'');if(r)return r}
  }catch{}
  try{
    const res=await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(raw)}`);
    if(res.ok){const data=await res.json().catch(()=>null);const r=spotifyResource(data?.iframe_url||data?.url||'');if(r)return r}
  }catch{}
  return null;
}
async function playSpotifyPersonal(url,title,index){
  if(!spotifyLogged()){await spotifyLogin();return}
  const r=await resolveSpotifyResource(url);
  if(!r){toast('Não consegui identificar essa música do Spotify. Abra o link completo do Spotify e tente novamente.');return}
  if(!(await ensureSpotifyPlayer())){toast('Conecte uma conta Spotify Premium para reproduzir esta trilha.');return}
  if(!spotifyDeviceId){toast('Aguarde o dispositivo Spotify ficar pronto e tente novamente.');return}
  await stopPersonalTheme(false);
  const body=r.type==='track'?{uris:[r.uri],position_ms:0}:{context_uri:r.uri,position_ms:0};
  const res=await spotifyApi(`/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok){const data=await res.json().catch(()=>({}));toast(res.status===403?'O Spotify exige uma conta Premium para reprodução completa no navegador.':`Spotify: ${data.error?.message||'não foi possível reproduzir'}`);return}
  personalSpotifyPlaying=true;personalSpotifyResource=r;personalAudioThemeIndex=index;renderPersonalPlayer(title,index);syncPersonalPlayer();
}
async function playPersonalTheme(url,title,index=-1){
  const src=safeHref(url,'');if(!src)return;
  const r=spotifyResource(src);
  if(r||isSpotifyShortLink(src)){await playSpotifyPersonal(src,title,index);return}
  if(personalAudio&&personalAudio.src===src){personalAudio.play().catch(()=>{});syncPersonalPlayer();return}
  await stopPersonalTheme(false);
  personalAudio=new Audio(src);personalAudio.preload='metadata';personalAudio.volume=.85;personalAudioThemeIndex=index;personalAudio.onended=()=>stopPersonalTheme();personalAudio.onerror=()=>{toast('Não foi possível reproduzir esta trilha.');stopPersonalTheme()};
  renderPersonalPlayer(title,index);personalAudio.play().catch(()=>toast('Toque em Reproduzir para liberar o áudio neste aparelho.'));syncPersonalPlayer();
}
async function uploadThemeFile(inp){
  const p=player(),f=inp.files?.[0];inp.value='';if(!p||!f)return;
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  const MIME={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',webm:'audio/webm'};
  if(!MIME[ext]&&!String(f.type).startsWith('audio/')){toast('Escolha um arquivo de áudio (MP3, M4A, WAV, OGG).');return}
  if(f.size>25*1024*1024){toast('Arquivo maior que 25 MB. Escolha um áudio menor.');return}
  if(!remoteEnabled){toast('Enviar músicas precisa da conexão com o servidor, que está indisponível.');return}
  const label=document.getElementById('themeLabel')?.value.trim()||'Trilha pessoal';
  const title=document.getElementById('themeTitle')?.value.trim()||f.name.replace(/\.[^.]+$/,'').slice(0,80);
  const safe=f.name.replace(/\.[^.]+$/,'').normalize('NFD').replace(/[^\w-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'faixa';
  const useExt=MIME[ext]?ext:'mp3',type=MIME[ext]||f.type||'audio/mpeg';
  const upFile=f.type===type?f:new File([f],f.name,{type});
  try{
    toast('Enviando música...');
    const url=await uploadGlobalFile(`players/${p.id}/music/${Date.now()}-${safe}.${useExt}`,upFile);
    if(!url)throw new Error('sem URL');
    p.musicThemes=Array.isArray(p.musicThemes)?p.musicThemes:[];
    const entry={id:`theme-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label,title,url,kind:'file',createdAt:Date.now()};
    p.musicThemes.push(entry);p._syncUpdatedAt=nextStamp();save();await syncPlayersDbNow().catch(()=>{});
    toast('Música adicionada à trilha do personagem e salva no servidor.');render('sheet');
  }catch(err){console.error(err);toast('Não foi possível enviar a música. Verifique a conexão e o tamanho do arquivo.')}
}
async function uploadLibraryFile(inp){
  const p=player(),f=inp.files?.[0];inp.value='';if(!p||!f)return;
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  const MIME={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',webm:'audio/webm'};
  if(!MIME[ext]&&!String(f.type).startsWith('audio/')){toast('Escolha um arquivo de áudio (MP3, M4A, WAV, OGG).');return}
  if(f.size>25*1024*1024){toast('Arquivo maior que 25 MB. Escolha um áudio menor.');return}
  if(!remoteEnabled){toast('Enviar músicas precisa da conexão com o servidor, que está indisponível.');return}
  const title=document.getElementById('libMusicTitle')?.value.trim()||f.name.replace(/\.[^.]+$/,'').slice(0,80);
  const safe=f.name.replace(/\.[^.]+$/,'').normalize('NFD').replace(/[^\w-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'faixa';
  const useExt=MIME[ext]?ext:'mp3',type=MIME[ext]||f.type||'audio/mpeg';
  const upFile=f.type===type?f:new File([f],f.name,{type});
  try{
    toast('Enviando música...');
    const url=await uploadGlobalFile(`players/${p.id}/library/${Date.now()}-${safe}.${useExt}`,upFile);
    if(!url)throw new Error('sem URL');
    p.playerMusicLibrary=Array.isArray(p.playerMusicLibrary)?p.playerMusicLibrary:[];
    const entry={id:`lib-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title,url,kind:'file',addedAt:Date.now()};
    p.playerMusicLibrary.push(entry);
    const titleInput=document.getElementById('libMusicTitle');if(titleInput)titleInput.value='';
    await persistPlayerMusicChange(p,'Música adicionada à sua biblioteca e salva no servidor.');render('sheet');
  }catch(err){console.error(err);toast('Não foi possível enviar a música. Verifique a conexão e o tamanho do arquivo.')}
}

function immTrainedPanel(p){
  const attrs=allAttrs().map(a=>[a,Number(effectiveAttr(p,a))||0]).filter(([,v])=>v>0);
  const skills=[...new Set(allSkills())].map(sk=>[sk,Number(effectiveSkill(p,sk))||0]).filter(([,v])=>v>0);
  const pts=typeof immPoints==='function'?immPoints(p):null;
  const level=(v,max)=>Math.max(8,Math.min(100,Math.round(v/max*100)));
  const chips=(rows,icon,max,emptyText)=>rows.length?rows.map(([n,v])=>`<div class="imm-chip" style="--w:${level(v,max)}%"><span class="imm-chip-name">${icon(n)} ${esc(n)}</span><b>${v}</b></div>`).join(''):`<div class="empty">${emptyText}</div>`;
  return `<section class="imm-trained" aria-label="Atributos e perícias treinadas"><div class="imm-trained-col"><div class="imm-trained-head"><span class="section-kicker">ATRIBUTOS</span><span class="corner-mark" title="Pontos distribuídos / disponíveis">${pts?`${pts.attrs}/${pts.attrMax} PTS`:attrs.length}</span></div><div class="imm-chip-grid">${chips(attrs,uiAttrIcon,MAX_ATTR,'Nenhum atributo com pontos.')}</div></div><div class="imm-trained-col"><div class="imm-trained-head"><span class="section-kicker">PERÍCIAS TREINADAS</span><span class="corner-mark" title="Pontos distribuídos / disponíveis">${pts?`${pts.skills}/${pts.skillMax} PTS`:skills.length}</span></div><div class="imm-chip-grid">${chips(skills,uiSkillIcon,MAX_SKILL,'Nenhuma perícia treinada.')}</div></div></section>`;
}
function immPoints(p){try{const t=allocationTotals(p),r=characterRules(p.campaignType);return{attrs:t.attrs,attrMax:(Number(r.attrPoints)||0)+(Number(p.attrBonusPoints)||0),skills:t.skills,skillMax:(Number(r.skillPoints)||0)+(Number(p.skillBonusPoints)||0)}}catch{return null}}
function immAbilitiesPanel(p){const c=CLASSES[p.class];const abil=[...(c?.abilities||[]),...customAbilitiesFor(p).map(a=>[a.name,a.description||''])];return `<section class="imm-abilities" aria-label="Habilidades possuídas"><div class="imm-trained-head"><span class="section-kicker">HABILIDADES POSSUÍDAS</span><span class="corner-mark">${abil.length}</span></div>${abil.length?abil.map(([n,d])=>`<details class="imm-ability-item"><summary>${esc(n)}</summary><p>${esc(d)}</p></details>`).join(''):'<div class="empty">Escolha uma classe para revelar suas habilidades.</div>'}</section>`}
function bagBookItem(it){return String(it?.category||'').toLowerCase().includes('livro')||!!it?.bookContent||(Array.isArray(it?.bookPages)&&it.bookPages.length>0)}
function bagLayout(p){
  const entries=[];
  (Array.isArray(p?.backpack)?p.backpack:[]).forEach((b,i)=>{
    const it=b&&item(b.id);if(!it)return;
    const qty=Math.max(1,Number(b.qty)||1),w=inferWeight(it);
    entries.push({i,it,qty,w,span:w*qty});
  });
  const used=entries.reduce((sum,e)=>sum+e.span,0),cap=bagCapacity(p);
  return{entries,used,cap,total:Math.max(cap,used)};
}
const IMM_RARITY={'comum':['common','Comum'],'raro':['rare','Raro'],'épico':['epic','Épico'],'lendário':['legendary','Lendário']};
function immRarity(it){const r=IMM_RARITY[String(it?.rarity||'').trim().toLowerCase()];return r?{key:r[0],label:r[1]}:null}
function bagMoveEntry(p,from,to){
  const bag=Array.isArray(p?.backpack)?p.backpack:null;
  if(!bag||!Number.isInteger(from)||from<0||from>=bag.length)return -1;
  let dest=to==='end'?bag.length-1:Number(to);
  if(!Number.isInteger(dest)||dest<0)return -1;
  dest=Math.min(dest,bag.length-1);
  if(dest===from)return -1;
  const [moved]=bag.splice(from,1);bag.splice(dest,0,moved);return dest;
}
function immBagCells(p,L,total,sel,theme){
  const prev=immBagPrevIds,seen=new Set(),cells=[];
  const empty=`<div class="imm-cell is-empty" data-bag-drop="end" aria-hidden="true"><span class="imm-cell-sym">${renderCustomIcon(theme.emptySlot)}</span></div>`;
  L.entries.forEach(e=>{
    const label=`${e.it.name}${e.qty>1?` ×${e.qty}`:''}`,r=immRarity(e.it);seen.add(e.it.id);
    const fresh=(prev&&!prev.has(e.it.id))||e.i===immBagFlashIdx;
    for(let k=0;k<e.span;k++){
      const lead=k===0,over=cells.length>=L.cap;
      cells.push(`<button type="button" class="imm-cell ${lead?'is-lead':'is-tail'}${e.i===sel?' is-sel':''}${over?' is-over':''}${fresh&&lead?' fx-in':''}" draggable="true" data-bag-pick="${e.i}" data-bag-drop="${e.i}"${r?` data-rarity="${r.key}"`:''} title="${esc(label)}" aria-label="${esc(label)}" aria-pressed="${e.i===sel?'true':'false'}"><span class="imm-cell-ico">${itemIcon(e.it)}</span>${lead&&e.qty>1?`<em>${e.qty}</em>`:''}${lead&&isWeaponItem(e.it)?'<i class="bag-mark" aria-hidden="true">⚔</i>':''}</button>`);
    }
  });
  immBagPrevIds=seen;immBagFlashIdx=-1;
  while(cells.length<total)cells.push(empty);
  return cells.join('');
}
function bagDetailMarkup(p,i,armed){
  const b=(Array.isArray(p?.backpack)?p.backpack:[])[i],it=b&&item(b.id);
  if(!it)return `<div class="imm-detail-empty"><span class="imm-detail-rune">${renderCustomIcon(sessionTheme().emptySlot)}</span><p>Selecione um item para consultar o registro.</p></div>`;
  const qty=Math.max(1,Number(b.qty)||1),w=inferWeight(it),sp=w*qty,r=immRarity(it);
  const props=[['Peso',w],['Quantidade',qty],['Ocupa',`${sp} espaço${sp===1?'':'s'}`]];
  if(it.category)props.splice(0,0,['Categoria',it.category]);
  if(isWeaponItem(it))props.push(['Dano',it.damage||weaponDamageFallback(it)]);
  /* 'effects' é campo do Mestre (pode conter segredos): nunca é exibido ao Player. */
  return `<div class="imm-detail-top"><span class="imm-detail-ico"${r?` data-rarity="${r.key}"`:''}>${itemIcon(it)}</span><div class="imm-detail-title"><strong>${esc(it.name)}</strong>${r?`<span class="imm-rarity" data-rarity="${r.key}">${r.label}</span>`:''}</div></div>${it.description?`<p class="imm-detail-desc">${esc(it.description)}</p>`:''}<dl class="imm-detail-props">${props.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl><div class="imm-detail-actions">${bagBookItem(it)?`<button type="button" class="imm-act" data-read-book="${esc(it.id)}">Ler</button>`:''}<button type="button" class="imm-act${armed?' is-armed':''}" data-bag-move>${armed?'Toque no destino…':'Mover'}</button>${qty>1?'<button type="button" class="imm-act" data-bag-discard="one">Descartar 1</button>':''}<button type="button" class="imm-act is-danger" data-bag-discard="all">${qty>1?'Descartar tudo':'Descartar'}</button></div>`;
}
function immCornersMarkup(t){const g=renderCustomIcon(t.ornCorner);return ['tl','tr','bl','br'].map(c=>`<i class="orn orn-${c}" aria-hidden="true">${g}</i>`).join('')}
function immDividerMarkup(t){return `<div class="imm-rec-divider" aria-hidden="true"><span></span><i>${renderCustomIcon(t.ornDivider)}</i><span></span></div>`}
function immBagPanelMarkup(p,theme,intro){
  const L=bagLayout(p);
  if(!L.entries.some(e=>e.i===immBagSel))immBagSel=L.entries.length?L.entries[0].i:-1;
  const total=Math.max(12,Math.ceil(L.total/6)*6),pct=Math.min(100,Math.round(L.used/Math.max(1,L.cap)*100)),units=L.entries.reduce((n,e)=>n+e.qty,0);
  return `<article class="imm-rec-bag${intro?' is-opening':''}" id="immBagPanel"><span class="imm-rec-corners">${immCornersMarkup(theme)}</span><header class="imm-bag-head"><span class="imm-bag-seal">${renderCustomIcon(theme.bagSeal)}</span><div class="imm-bag-title"><h3>MOCHILA</h3><small>Inventário pessoal</small></div><div class="imm-bag-count"><b class="${L.used>L.cap?'is-over':''}">${L.used}/${L.cap}</b><small>Itens armazenados: ${units}</small></div></header>${immDividerMarkup(theme)}<div class="imm-bag-meter${L.used>L.cap?' is-over':''}" role="meter" aria-valuemin="0" aria-valuemax="${L.cap}" aria-valuenow="${L.used}"><i style="width:${pct}%"></i></div><div class="imm-bag-grid${immBagMoveArmed?' is-move-armed':''}" id="immBagGrid" aria-label="Mochila">${immBagCells(p,L,total,immBagSel,theme)}</div><div class="imm-bag-detail" id="immBagDetail" aria-live="polite">${bagDetailMarkup(p,immBagSel,immBagMoveArmed)}</div></article>`;
}
function immGamePanel(p,hpMax,sanMax){
  const theme=sessionTheme(),cls=CLASSES[p.class]?p.class:'Sem classe',combat=state.combatSession||defaultCombatSession();
  const intro=!immBagIntro;immBagIntro=true;
  const pct=(v,m)=>Math.max(0,Math.min(100,Math.round((Number(v)||0)/Math.max(1,Number(m)||1)*100)));
  const bar=(k,label,cur,max)=>`<div class="imm-field imm-field-bar"><span>${label}</span><div class="imm-bar" data-k="${k}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${Number(max)||0}" aria-valuenow="${Number(cur)||0}"><i style="width:${pct(cur,max)}%"></i></div><b>${Number(cur)||0}<small>/${Number(max)||0}</small></b></div>`;
  const menu=[['sheet','☰','Ficha'],['classes','✠','Classes'],['map','◎','Mapa'],['diary','✎','Diário'],['library','❖','Biblioteca'],['nexus','◈','Nexus']].map(([k,i,l])=>`<button type="button" class="imm-gbtn" data-nav="${k}"><span aria-hidden="true">${i}</span><small>${l}</small></button>`).join('')+`<button type="button" class="imm-gbtn" data-open-secret-clues><span aria-hidden="true">✧</span><small>Pistas</small></button><button type="button" class="imm-gbtn" data-imm-exit><span aria-hidden="true">${CURTAIN_SVG}</span><small>Sair</small></button>`;
  return `<section class="imm-rec"${sessionThemeAttrs(theme)} aria-label="Registro do personagem"><header class="imm-rec-head"><span class="imm-stamp">Registro de sessão</span><span class="imm-rec-sub">Ashen Testimony · Nº ${String(Math.max(1,Number(combat.round)||1)).padStart(3,'0')}</span></header>${immDividerMarkup(theme)}
<div class="imm-rec-body"><article class="imm-rec-char imm-rec-card"><span class="imm-rec-corners">${immCornersMarkup(theme)}</span><span class="imm-rec-sigil" aria-hidden="true">${renderCustomIcon(theme.portraitSigil)}</span><div class="imm-rec-frame"><i class="imm-tape imm-tape-l" aria-hidden="true"></i><i class="imm-tape imm-tape-r" aria-hidden="true"></i><div class="imm-rec-portrait">${sessionDiamondCard(p,{controls:true,big:true})}</div><div class="imm-rec-cap"><h2 class="imm-rec-name">${esc(p.name||'Sobrevivente')}</h2><p class="imm-rec-role">Personagem · <b>${esc(cls)}</b></p></div></div><div class="imm-rec-sheet">${bar('hp','Vida',p.hp,hpMax)}${bar('san','Sanidade',p.sanity,sanMax)}<div class="imm-fields"><div class="imm-field"><span>Ataque</span><b>${Number(p.attack)||0}</b></div><div class="imm-field"><span>Defesa</span><b>${Number(p.defense)||0}</b></div></div></div></article>${immBagPanelMarkup(p,theme,intro)}</div><nav class="imm-rec-menu" aria-label="Menu">${menu}</nav></section>`}
function bindImmBag(p){
  const panel=document.getElementById('immBagPanel');if(!panel)return;
  const cellsOf=i=>panel.querySelectorAll(`[data-bag-pick="${i}"]`);
  const refreshDetail=()=>{const box=document.getElementById('immBagDetail');if(box){box.innerHTML=bagDetailMarkup(p,immBagSel,immBagMoveArmed);bindDetail()}document.getElementById('immBagGrid')?.classList.toggle('is-move-armed',immBagMoveArmed)};
  const select=i=>{immBagSel=i;panel.querySelectorAll('[data-bag-pick]').forEach(x=>{const on=Number(x.dataset.bagPick)===i;x.classList.toggle('is-sel',on);x.setAttribute('aria-pressed',on?'true':'false')});refreshDetail()};
  const doMove=async(from,to)=>{
    const dest=bagMoveEntry(p,from,to);if(dest<0){immBagMoveArmed=false;refreshDetail();return}
    immBagSel=dest;immBagFlashIdx=dest;immBagMoveArmed=false;{const y=window.scrollY;render('immersive');window.scrollTo(0,y)}
    await persistPlayerMusicChange(p,'');
  };
  const doDiscard=async mode=>{
    const i=immBagSel,b=p.backpack?.[i],it=b&&item(b.id);if(!it)return;
    const qty=Math.max(1,Number(b.qty)||1),all=mode==='all'||qty<=1;
    if(!confirm(all?`Descartar ${it.name}${qty>1?` (×${qty})`:''}? O item será removido da mochila.`:`Descartar 1 unidade de ${it.name}?`))return;
    cellsOf(i).forEach(c=>c.classList.add('fx-out'));
    if(!prefersReducedMotion())await new Promise(r=>setTimeout(r,230));
    const cur=p.backpack?.[i];if(!cur||cur.id!==b.id)return;
    if(all)p.backpack.splice(i,1);else cur.qty=qty-1;
    immBagMoveArmed=false;{const y=window.scrollY;render('immersive');window.scrollTo(0,y)}
    await persistPlayerMusicChange(p,all?'Item descartado.':'1 unidade descartada.');
  };
  function bindDetail(){
    const box=document.getElementById('immBagDetail');if(!box)return;
    box.querySelectorAll('[data-read-book]').forEach(r=>r.onclick=()=>openBookReader(Number(r.dataset.readBook)));
    box.querySelector('[data-bag-move]')?.addEventListener('click',()=>{immBagMoveArmed=!immBagMoveArmed;refreshDetail()});
    box.querySelectorAll('[data-bag-discard]').forEach(b=>b.addEventListener('click',()=>doDiscard(b.dataset.bagDiscard)));
  }
  let dragFrom=-1;
  const clearDrag=()=>{dragFrom=-1;panel.classList.remove('is-dragging');panel.querySelectorAll('.is-drag,.is-drop').forEach(x=>x.classList.remove('is-drag','is-drop'))};
  panel.querySelectorAll('[data-bag-pick]').forEach(c=>{
    c.addEventListener('click',()=>{const i=Number(c.dataset.bagPick);if(immBagMoveArmed&&i!==immBagSel)doMove(immBagSel,i);else select(i)});
    c.addEventListener('dragstart',e=>{dragFrom=Number(c.dataset.bagPick);immBagSel=dragFrom;try{e.dataTransfer.setData('text/plain',String(dragFrom));e.dataTransfer.effectAllowed='move'}catch{}panel.classList.add('is-dragging');cellsOf(dragFrom).forEach(x=>x.classList.add('is-drag'))});
    c.addEventListener('dragend',clearDrag);
  });
  /* Toque/caneta: arrastar com pressão longa (o arrastar nativo do navegador não é confiável no celular). */
  const buzz=ms=>{try{navigator.vibrate?.(ms)}catch{}};
  panel.querySelectorAll('[data-bag-pick]').forEach(c=>{
    let tp=null;
    const dropTarget=(x,y)=>document.elementFromPoint(x,y)?.closest?.('[data-bag-drop]')||null;
    const blockScroll=ev=>{if(ev.cancelable)ev.preventDefault()};
    const cleanup=()=>{
      if(!tp)return;clearTimeout(tp.timer);cancelAnimationFrame(tp.raf||0);
      document.removeEventListener('touchmove',blockScroll);
      tp.ghost?.remove();c.draggable=true;clearDrag();tp=null;
    };
    const autoScroll=()=>{
      if(!tp||!tp.started)return;
      const h=window.innerHeight,y=tp.y;
      if(y<90)window.scrollBy(0,-14);else if(y>h-90)window.scrollBy(0,14);
      tp.raf=requestAnimationFrame(autoScroll);
    };
    c.addEventListener('contextmenu',e=>{if(e.pointerType!=='mouse')e.preventDefault()});
    c.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'||e.button>0)return;
      c.draggable=false;
      tp={idx:Number(c.dataset.bagPick),x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,started:false,ghost:null,raf:0};
      tp.timer=setTimeout(()=>{
        if(!tp)return;tp.started=true;buzz(18);select(tp.idx);
        panel.classList.add('is-dragging');cellsOf(tp.idx).forEach(x=>x.classList.add('is-drag'));
        const g=document.createElement('div');g.className='imm-ghost';const ico=c.querySelector('.imm-cell-ico');if(ico)g.appendChild(ico.cloneNode(true));
        g.style.left=tp.x+'px';g.style.top=tp.y+'px';document.body.appendChild(g);tp.ghost=g;
        document.addEventListener('touchmove',blockScroll,{passive:false});
        tp.raf=requestAnimationFrame(autoScroll);
      },340);
    });
    c.addEventListener('pointermove',e=>{
      if(!tp||e.pointerType==='mouse')return;
      tp.x=e.clientX;tp.y=e.clientY;
      if(!tp.started){if(Math.hypot(e.clientX-tp.sx,e.clientY-tp.sy)>8){clearTimeout(tp.timer);tp=null;c.draggable=true}return}
      if(tp.ghost){tp.ghost.style.left=e.clientX+'px';tp.ghost.style.top=e.clientY+'px'}
      panel.querySelectorAll('.is-drop').forEach(x=>x.classList.remove('is-drop'));
      dropTarget(e.clientX,e.clientY)?.classList.add('is-drop');
    });
    const finish=e=>{
      if(!tp)return;
      const started=tp.started,from=tp.idx,t=started&&e.type==='pointerup'?dropTarget(e.clientX,e.clientY):null;
      cleanup();
      if(started){buzz(10);if(t)doMove(from,t.dataset.bagDrop)}
    };
    c.addEventListener('pointerup',finish);
    c.addEventListener('pointercancel',finish);
  });
  panel.querySelectorAll('[data-bag-drop]').forEach(c=>{
    if(c.classList.contains('is-empty'))c.addEventListener('click',()=>{if(immBagMoveArmed)doMove(immBagSel,'end')});
    c.addEventListener('dragover',e=>{if(dragFrom<0)return;e.preventDefault();try{e.dataTransfer.dropEffect='move'}catch{}c.classList.add('is-drop')});
    c.addEventListener('dragleave',()=>c.classList.remove('is-drop'));
    c.addEventListener('drop',e=>{e.preventDefault();const from=dragFrom,to=c.dataset.bagDrop;clearDrag();if(from>=0)doMove(from,to)});
  });
  bindDetail();
}
let sessThemeDraft=null,sessThemeTarget='emptySlot';
function sessionThemePreviewMarkup(t){
  const sample=(state.items||[]).slice(0,3),cells=[];
  sample.forEach((it,k)=>cells.push(`<div class="imm-cell is-lead${k===0?' is-sel':''}"${immRarity(it)?` data-rarity="${immRarity(it).key}"`:''}><span class="imm-cell-ico">${itemIcon(it)}</span>${k===1?'<em>3</em>':''}</div>`));
  while(cells.length<12)cells.push(`<div class="imm-cell is-empty"><span class="imm-cell-sym">${renderCustomIcon(t.emptySlot)}</span></div>`);
  return `<div class="imm-rec imm-rec-preview"${sessionThemeAttrs(t)}><span class="imm-rec-corners">${immCornersMarkup(t)}</span><span class="imm-rec-sigil" aria-hidden="true">${renderCustomIcon(t.portraitSigil)}</span><header class="imm-bag-head"><span class="imm-bag-seal">${renderCustomIcon(t.bagSeal)}</span><div class="imm-bag-title"><h3>MOCHILA</h3><small>Inventário pessoal</small></div></header>${immDividerMarkup(t)}<div class="imm-bag-grid" style="--cols:6">${cells.join('')}</div></div>`;
}
let sessGlyphEdit=null;
function sgStrokeOptions(v){return [[1,'Fino'],[1.6,'Médio'],[2.4,'Grosso']].map(([k,l])=>`<option value="${k}"${Number(v)===k?' selected':''}>${l}</option>`).join('')}
function sgPadMarkup(e){
  const d=safeGlyphPath(e.value);
  return `<svg class="st-pad" viewBox="0 0 24 24" data-sg-pad aria-label="Quadro de desenho"><path class="st-pad-grid" d="M4 0v24M8 0v24M12 0v24M16 0v24M20 0v24M0 4h24M0 8h24M0 12h24M0 16h24M0 20h24"/><path class="st-pad-line" id="sgPadPath" d="${esc(d)}" fill="${e.fill?'currentColor':'none'}" stroke="currentColor" stroke-width="${esc(String(e.stroke))}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function sgFormMarkup(){
  const e=sessGlyphEdit;if(!e)return '';
  const body=e.type==='path'
    ?`<div class="st-pad-wrap">${sgPadMarkup(e)}<div class="st-pad-side"><p class="small muted">Clique no quadro para marcar pontos. Cada ponto liga ao anterior.</p><div class="row" style="gap:6px"><button type="button" class="btn small" data-sg-newstroke>Novo traço</button><button type="button" class="btn small" data-sg-undo>Desfazer</button><button type="button" class="btn small" data-sg-clear>Limpar</button></div><div class="field"><label>Espessura</label><select data-sg-stroke>${sgStrokeOptions(e.stroke)}</select></div><label class="small"><input type="checkbox" data-sg-fill${e.fill?' checked':''}> Preencher formas fechadas</label></div></div><div class="field"><label>Traçado (avançado: M L H V C Q A Z em grade 24×24)</label><textarea data-sg-value rows="3" spellcheck="false">${esc(e.value)}</textarea></div>`
    :e.type==='text'
      ?`<div class="field"><label>Caractere ou emoji</label><input data-sg-value maxlength="12" value="${esc(e.value)}"></div>`
      :`<div class="row"><label class="btn small">Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-sg-file hidden></label><span class="small muted">PNG, JPG, WEBP ou GIF.</span></div>`;
  return `<div class="st-custom-form"><div class="input-grid"><div class="field"><label>Nome do símbolo</label><input data-sg-name maxlength="40" value="${esc(e.name)}"></div><div class="field"><label>Tipo</label><select data-sg-type><option value="path"${e.type==='path'?' selected':''}>Desenho (traço)</option><option value="text"${e.type==='text'?' selected':''}>Caractere / emoji</option><option value="image"${e.type==='image'?' selected':''}>Imagem</option></select></div></div>${body}<div class="st-custom-foot"><span class="st-target-sym st-big" id="sgPreview">${customGlyphRender(e)}</span><div class="row" style="gap:8px"><button type="button" class="btn small" data-sg-cancel>Cancelar</button><button type="button" class="btn primary small" data-sg-save>Salvar símbolo</button></div></div></div>`;
}
function sessionThemeEditorMarkup(){
  if(!sessThemeDraft)sessThemeDraft={...sessionTheme()};
  const d=sessThemeDraft,applied=sessionTheme(),dirty=JSON.stringify(d)!==JSON.stringify(applied),cur=String(d[sessThemeTarget]||'');
  const tgt=SESSION_THEME_TARGETS.find(x=>x[0]===sessThemeTarget)||SESSION_THEME_TARGETS[0];
  const customs=customGlyphList();
  const mine=`<div class="st-group"><h4>Meus símbolos</h4><div class="st-glyphs">${customs.map(c=>`<span class="st-mine${cur==='sym:'+c.id?' active':''}"><button type="button" class="st-glyph${cur==='sym:'+c.id?' active':''}" data-st-custom="${esc(c.id)}" title="${esc(c.name)}" aria-label="${esc(c.name)}">${customGlyphRender(c)}</button><button type="button" class="st-mini" data-sg-edit="${esc(c.id)}" title="Editar" aria-label="Editar ${esc(c.name)}">✎</button><button type="button" class="st-mini" data-sg-del="${esc(c.id)}" title="Apagar" aria-label="Apagar ${esc(c.name)}">×</button></span>`).join('')}<button type="button" class="st-glyph st-add" data-sg-new title="Novo símbolo" aria-label="Novo símbolo">+</button></div></div>`;
  const lib=SESSION_GLYPH_GROUPS.map((g,gi)=>`<div class="st-group"><h4>${esc(g)}</h4><div class="st-glyphs">${SESSION_GLYPH_LIST.filter(x=>x[2]===gi).map(x=>`<button type="button" class="st-glyph${cur==='lib:'+x[0]?' active':''}" data-st-glyph="${x[0]}" title="${esc(x[1])}" aria-label="${esc(x[1])}">${sessGlyphSvg(x)}</button>`).join('')}</div></div>`).join('');
  const customVal=/^(lib:|sym:|data:|https?:|\/|\.)/i.test(cur)?'':cur;
  return `<div class="st-editor"><div class="st-targets">${SESSION_THEME_TARGETS.map(([k,l])=>`<button type="button" class="st-target${k===sessThemeTarget?' active':''}" data-st-target="${k}"><span class="st-target-sym">${renderCustomIcon(d[k])}</span><span>${esc(l)}</span></button>`).join('')}</div><p class="small muted">${esc(tgt[2])} Escolha da biblioteca, crie um símbolo seu, digite um caractere ou envie uma imagem.</p><div class="st-library">${mine}${sessGlyphEdit?sgFormMarkup():''}${lib}</div><div class="row st-custom"><input maxlength="12" data-st-text placeholder="Emoji ou caractere" value="${esc(customVal)}"><label class="btn small">Imagem<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-st-file hidden></label></div><div class="input-grid st-options"><div class="field"><label>Cor dos ornamentos</label><select data-st-tone>${SESSION_TONES.map(([k,l])=>`<option value="${k}"${d.ornTone===k?' selected':''}>${esc(l)}</option>`).join('')}</select></div><div class="field"><label>Estilo dos slots</label><select data-st-slotstyle>${SESSION_SLOT_STYLES.map(([k,l])=>`<option value="${k}"${d.slotStyle===k?' selected':''}>${esc(l)}</option>`).join('')}</select></div></div><div class="st-preview"><span class="section-kicker">PRÉVIA${dirty?' · AINDA NÃO APLICADA':''}</span>${sessionThemePreviewMarkup(d)}</div><div class="row" style="justify-content:flex-end;gap:8px;flex-wrap:wrap"><button type="button" class="btn small" data-st-reset>Restaurar padrão</button><button type="button" class="btn small" data-st-revert${dirty?'':' disabled'}>Descartar mudanças</button><button type="button" class="btn primary" data-st-apply${dirty?'':' disabled'}>Aplicar ao modo sessão</button></div></div>`;
}
function bindSessionThemeEditor(){
  const host=document.getElementById('sessThemeEditor');if(!host)return;
  const redraw=()=>{host.innerHTML=sessionThemeEditorMarkup()};
  const syncForm=()=>{const e=sessGlyphEdit;if(!e)return;const pv=document.getElementById('sgPreview');if(pv)pv.innerHTML=customGlyphRender(e);const pp=document.getElementById('sgPadPath');if(pp){pp.setAttribute('d',safeGlyphPath(e.value));pp.setAttribute('stroke-width',String(e.stroke));pp.setAttribute('fill',e.fill?'currentColor':'none')}const ta=host.querySelector('textarea[data-sg-value]');if(ta&&ta!==document.activeElement)ta.value=e.value};
  const saveGlyph=async()=>{
    const e=sessGlyphEdit;if(!e)return;
    const name=e.name.trim();if(!name){toast('Dê um nome ao símbolo.');return}
    let value=String(e.value||'').trim();
    if(e.type==='path'){value=safeGlyphPath(value);if(!/[Mm]/.test(value)){toast('Desenhe ao menos um traço.');return}}
    else if(!value){toast(e.type==='image'?'Escolha uma imagem.':'Informe um caractere.');return}
    const id=e.id||`c-${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;
    state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};state.uiIcons.sessionGlyphs=state.uiIcons.sessionGlyphs||{};
    state.uiIcons.sessionGlyphs[id]=JSON.stringify({name,type:e.type,value,stroke:e.stroke,fill:!!e.fill});
    if(!e.id)sessThemeDraft[sessThemeTarget]='sym:'+id;
    sessGlyphEdit=null;save();redraw();
    try{await saveGlobalNow();toast('Símbolo salvo na biblioteca.')}catch{toast('Salvo neste aparelho; não foi possível sincronizar agora.')}
  };
  host.onclick=async e=>{
    const t=e.target.closest?.('button,[data-sg-pad]');if(!t||!host.contains(t))return;
    const ds=t.dataset;
    if(t.hasAttribute('data-sg-pad')||t.closest('[data-sg-pad]')){
      const pad=host.querySelector('[data-sg-pad]');if(!pad||!sessGlyphEdit)return;
      const r=pad.getBoundingClientRect(),cl=v=>Math.min(24,Math.max(0,Math.round(v*2)/2));
      const x=cl((e.clientX-r.left)/r.width*24),y=cl((e.clientY-r.top)/r.height*24),v=sessGlyphEdit.value.trim();
      const startNew=!v||sessGlyphEdit.nextNew||!/[ML]/.test(v);
      sessGlyphEdit.value=(v?v+' ':'')+(startNew?'M':'L')+`${x} ${y}`;sessGlyphEdit.nextNew=false;syncForm();return;
    }
    if(ds.stTarget){sessThemeTarget=ds.stTarget;redraw();return}
    if(ds.stGlyph&&Object.prototype.hasOwnProperty.call(SESSION_GLYPHS,ds.stGlyph)){sessThemeDraft[sessThemeTarget]='lib:'+ds.stGlyph;redraw();return}
    if(ds.stCustom){sessThemeDraft[sessThemeTarget]='sym:'+ds.stCustom;redraw();return}
    if(t.hasAttribute('data-sg-new')){sessGlyphEdit={id:null,name:'',type:'path',value:'',stroke:1.4,fill:false,nextNew:true};redraw();return}
    if(ds.sgEdit){const o=parseCustomGlyph(state.uiIcons?.sessionGlyphs?.[ds.sgEdit]);if(o){sessGlyphEdit={id:ds.sgEdit,...o,nextNew:true};redraw()}return}
    if(ds.sgDel){
      const o=parseCustomGlyph(state.uiIcons?.sessionGlyphs?.[ds.sgDel]);if(!o||!confirm(`Apagar o símbolo "${o.name}"? Onde ele estiver em uso, volta ao padrão.`))return;
      state.uiIcons.sessionGlyphs[ds.sgDel]=JSON.stringify({deleted:true});
      for(const k of Object.keys(sessThemeDraft))if(sessThemeDraft[k]==='sym:'+ds.sgDel)sessThemeDraft[k]=SESSION_THEME_DEFAULTS[k];
      const ap=state.uiIcons.sessionTheme||{};let changed=false;for(const k of Object.keys(ap))if(ap[k]==='sym:'+ds.sgDel){ap[k]=SESSION_THEME_DEFAULTS[k];changed=true}
      if(sessGlyphEdit?.id===ds.sgDel)sessGlyphEdit=null;
      save();redraw();try{await saveGlobalNow();toast('Símbolo apagado.')}catch{toast('Apagado neste aparelho; não foi possível sincronizar agora.')}return;
    }
    if(t.hasAttribute('data-sg-newstroke')){if(sessGlyphEdit)sessGlyphEdit.nextNew=true;return}
    if(t.hasAttribute('data-sg-undo')){if(sessGlyphEdit){sessGlyphEdit.value=sessGlyphEdit.value.replace(/\s*[MLml][^MLml]*$/,'').trim();syncForm()}return}
    if(t.hasAttribute('data-sg-clear')){if(sessGlyphEdit){sessGlyphEdit.value='';sessGlyphEdit.nextNew=true;syncForm()}return}
    if(t.hasAttribute('data-sg-cancel')){sessGlyphEdit=null;redraw();return}
    if(t.hasAttribute('data-sg-save')){await saveGlyph();return}
    if(t.hasAttribute('data-st-reset')){sessThemeDraft={...SESSION_THEME_DEFAULTS};redraw();return}
    if(t.hasAttribute('data-st-revert')){sessThemeDraft={...sessionTheme()};redraw();return}
    if(t.hasAttribute('data-st-apply')){
      state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};
      state.uiIcons.sessionTheme={...sessThemeDraft};
      save();redraw();
      try{await saveGlobalNow();toast('Símbolos aplicados e sincronizados com os Players.')}catch{toast('Aplicado neste aparelho; não foi possível sincronizar agora.')}
    }
  };
  host.oninput=e=>{
    const el=e.target,g=sessGlyphEdit;if(!g)return;
    if(el.matches?.('[data-sg-name]'))g.name=el.value;
    else if(el.matches?.('textarea[data-sg-value],input[data-sg-value]')){g.value=el.value;syncForm()}
  };
  host.onchange=async e=>{
    const el=e.target;
    if(el.matches?.('[data-sg-type]')&&sessGlyphEdit){sessGlyphEdit.type=el.value;sessGlyphEdit.value='';redraw()}
    else if(el.matches?.('[data-sg-stroke]')&&sessGlyphEdit){sessGlyphEdit.stroke=Number(el.value)||1.4;syncForm()}
    else if(el.matches?.('[data-sg-fill]')&&sessGlyphEdit){sessGlyphEdit.fill=el.checked;syncForm()}
    else if(el.matches?.('[data-sg-file]')&&sessGlyphEdit){
      const f=el.files?.[0];if(!f)return;
      if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Imagem inválida ou maior que 40 MB.');el.value='';return}
      try{sessGlyphEdit.value=await imageFileToRemoteURL(f,`symbols/custom-${Date.now().toString(36)}.webp`,256,.82);syncForm()}catch(err){console.error(err);toast('Não foi possível enviar a imagem.')}
    }
    else if(el.matches?.('[data-st-text]')){sessThemeDraft[sessThemeTarget]=el.value.trim()||SESSION_THEME_DEFAULTS[sessThemeTarget];redraw()}
    else if(el.matches?.('[data-st-tone]')){sessThemeDraft.ornTone=el.value;redraw()}
    else if(el.matches?.('[data-st-slotstyle]')){sessThemeDraft.slotStyle=el.value;redraw()}
    else if(el.matches?.('[data-st-file]')){
      const f=el.files?.[0];if(!f)return;
      if(!isSupportedImageFile(f)||f.size>IMAGE_PICK_MAX_BYTES){toast('Imagem inválida ou maior que 40 MB.');el.value='';return}
      try{sessThemeDraft[sessThemeTarget]=await imageFileToRemoteURL(f,`symbols/session-${sessThemeTarget}.webp`,256,.82);redraw()}catch(err){console.error(err);toast('Não foi possível enviar a imagem.')}
    }
  };
}
function immQuickNav(){return '<nav class="imm-quicknav" aria-label="Atalhos"><button type="button" data-nav="sheet">Ficha</button><button type="button" data-nav="classes">Classes</button><button type="button" data-nav="map">Mapa</button><button type="button" data-nav="diary">Diário</button><button type="button" data-nav="library">Biblioteca</button><button type="button" data-nav="nexus">Nexus</button><button type="button" data-open-secret-clues>Fragmentos ocultos</button></nav>'}
function bindPlayerThemes(){document.querySelectorAll('[data-play-theme]').forEach(b=>b.onclick=()=>{const p=player(),t=p?.musicThemes?.[Number(b.dataset.playTheme)];if(t)playPersonalTheme(t.url,t.title,Number(b.dataset.playTheme))});document.querySelectorAll('[data-pause-theme]').forEach(b=>b.onclick=()=>pausePersonalTheme());document.querySelectorAll('[data-stop-theme]').forEach(b=>b.onclick=()=>stopPersonalTheme());document.getElementById('spotifyHomePlay')?.addEventListener('click',spotifyPlayCurrent);document.getElementById('spotifyHomePause')?.addEventListener('click',spotifyPause);document.getElementById('spotifyHomeLogin')?.addEventListener('click',async()=>{let id=spotifyClientId();if(!id){id=prompt('Cole o Client ID do seu aplicativo Spotify:')?.trim()||'';if(id)try{localStorage.setItem(SPOTIFY_CLIENT_KEY,id)}catch{}}if(id)await spotifyLogin()})}
function curtainReveal(){
  if(prefersReducedMotion())return;
  const el=document.createElement('div');el.className='curtain-fx closing instant';
  el.innerHTML=`<i class="cf-l"></i><i class="cf-r"></i><span class="cf-icon">${CURTAIN_SVG}</span>`;
  document.body.appendChild(el);
  setTimeout(()=>{el.classList.remove('instant');el.classList.remove('closing');el.classList.add('opening')},380);
  setTimeout(()=>el.remove(),2000);
}
function curtainTransition(mid){
  curtainBusy=true;setTimeout(()=>{curtainBusy=false},2100);
  const el=document.createElement('div');el.className='curtain-fx';
  el.innerHTML=`<i class="cf-l"></i><i class="cf-r"></i><span class="cf-icon">${CURTAIN_SVG}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('closing')));
  setTimeout(()=>{try{mid()}finally{el.classList.remove('closing');el.classList.add('opening')}},950);
  setTimeout(()=>el.remove(),2000);
}
function puzzleRpcErrorText(err){
  const raw=[err?.message,err?.details,err?.hint,err?.code,err?.status,err].map(x=>x==null?'':String(x)).join(' ');
  const code=String(err?.code||'');const status=Number(err?.status)||0;
  if(code==='PGRST202'||status===404||/Could not find the function|schema cache|PGRST202|404.*a_profecia_session_|a_profecia_session_.*not found/i.test(raw))return 'O Supabase não encontrou as funções de puzzles. No Dashboard do Supabase, abra SQL Editor e execute as migrações de puzzles em supabase/migrations; depois recarregue o site.';
  if(/SESSAO_PUZZLE_EXPIRADA/.test(raw))return 'Este terminal pertence a uma sessão anterior.';
  if(/SESSAO_PUZZLE_INVALIDA/.test(raw))return 'A sessão de puzzles não é válida. Crie uma nova sessão e tente novamente.';
  if(/SESSAO_INVALIDA/.test(raw))return 'Sua sessão expirou. Entre novamente.';
  if(/NAO_AUTORIZADO/.test(raw))return 'Seu acesso não permite essa operação.';
  if(/ARQUIVOS_PUZZLE_INVALIDOS/.test(raw))return 'Os arquivos adicionais precisam ter nome, pasta válida e até 20.000 caracteres cada (máximo de 12).';
  if(/AUDIO_PUZZLE_INVALIDO/.test(raw))return 'Os áudios precisam ser válidos: até 3 gravações de no máximo 750 KB cada.';
  if(/CAMPOS_PUZZLE_OBRIGATORIOS|SENHA_PUZZLE_OBRIGATORIA|SENHA_PUZZLE_INVALIDA/.test(raw))return 'Confira os campos obrigatórios e a senha do terminal.';
  return 'Não foi possível acessar o terminal. Verifique a conexão e tente novamente.';
}
function terminalDesktopMarkup(p,unlocked){
  const pid=String(p.id),label=p.terminalLabel||p.title||'RESTRICTED NODE';
  const start=immersiveTerminalBootStart[pid]||0,elapsed=start?Date.now()-start:0;
  const booting=!!immersiveTerminalBooting[pid]&&elapsed<bootDuration(buildTerminalModel(pid,unlocked),label);
  return kitDesktopMarkup(p,unlocked,{booting,bootElapsed:elapsed,cwd:immersiveTerminalCwd[pid]||'',openKey:immersiveTerminalOpenFiles[pid]||'',history:immersiveTerminalHistory[pid]||[],fresh:immersiveTerminalFresh,since:immersiveTerminalSince[pid]||Date.now()});
}
function terminalLoginMarkup(p){
 return `<section class="ashen-terminal-os ashen-terminal-login-os" aria-label="Login ${esc(p.terminalLabel||p.title)}"><header class="ashen-terminal-topbar"><span>ASHEN OS <i>SECURE ACCESS PROTOCOL</i></span><span class="ashen-terminal-top-status is-locked"><b></b> AUTH REQUIRED</span></header><div class="ashen-terminal-workspace"><aside class="ashen-terminal-telemetry"><div class="ashen-terminal-clock"><small>SYS.TIME</small><strong data-term-clock>${clockText()}</strong><span>UPTIME · LOCKED SESSION</span></div><div class="ashen-terminal-meter"><small>CPU PROCESS</small><div><i style="width:12%"></i></div><small>MEMORY CACHE</small><div><i style="width:21%"></i></div></div><div class="ashen-terminal-tiny-list"><b>BOOT SEQUENCE</b><span>POWER ........ OK</span><span>NETWORK ...... LINK</span><span>AUTH ........ LOCKED</span><span>FILES ........ SEALED</span></div></aside><main class="ashen-terminal-main"><div class="ashen-terminal-tabs"><span>MAIN SHELL</span><span>AUTH GATE</span><span>ENCRYPTED VOLUME</span></div><div class="ashen-terminal-login-stage"><div class="ashen-terminal-lock-mark">⌘</div><span class="section-kicker">PROTOCOLO DE AUTENTICAÇÃO</span><h2>${esc(p.terminalLabel||'TERMINAL RESTRITO')}</h2><p class="ashen-terminal-device-name">${esc(p.title||'ARQUIVO PROTEGIDO')}</p><p class="ashen-terminal-login-prompt">${esc(p.prompt||'Credenciais necessárias para continuar.')}</p>${p.hint?`<details class="session-puzzle-hint ashen-terminal-hint"><summary>CONSULTAR PISTA</summary><p>${esc(p.hint)}</p></details>`:''}<form data-puzzle-unlock-form="${esc(p.id)}" class="ashen-terminal-auth-form"><label>LOGIN<input name="login" autocomplete="off" maxlength="160" required placeholder="Identificador do operador"></label><label>SENHA<input name="password" type="password" autocomplete="off" maxlength="128" required placeholder="Código de acesso"></label><button type="submit" class="ashen-terminal-auth-button"><span>⏻</span> AUTENTICAR E MONTAR VOLUME</button><small>ACESSO REGISTRADO · ARQUIVOS CRIPTOGRAFADOS</small></form></div><div class="ashen-terminal-login-console"><span>ash@ashen-os:~$</span> waiting_for_credentials <i class="ashen-terminal-cursor">▌</i></div></main><aside class="ashen-terminal-network"><div class="ashen-network-status"><small>NETWORK STATUS</small><strong><b></b> LINK DETECTED</strong><span>STATE <i>LOCKED</i></span><span>AUTH <i>REQUIRED</i></span><span>FILES <i>SEALED</i></span></div><div class="ashen-network-map"><small>ENDPOINT VIEW</small><div class="ashen-network-globe is-locked" aria-hidden="true">◎<i></i></div><span>ENDPOINT: UNKNOWN NODE</span></div></aside></div><footer class="ashen-terminal-footer"><span>ASHEN TESTIMONY // RECOVERY TERMINAL</span><span>UNAUTHORIZED ACCESS PROHIBITED</span></footer></section>`;
}
function puzzleTerminalPanelMarkup(){
  if(immersivePuzzleStatus==='loading')return '<div class="section-heading"><div><span class="section-kicker">PROTOCOLO DE ACESSO</span><h2>Conectando aos terminais…</h2></div></div><div class="empty">Aguardando resposta do arquivo remoto.</div>';
  if(immersivePuzzleStatus==='error')return `<div class="section-heading"><div><span class="section-kicker">PROTOCOLO DE ACESSO</span><h2>Sinal interrompido</h2></div></div><div class="empty">${esc(immersivePuzzleStatusMessage||'Não foi possível carregar os terminais.')}</div><button class="btn primary" type="button" id="retryPuzzleLoad">Tentar novamente</button>`;
  const puzzles=(immersivePuzzleCache||[]).filter(x=>x&&x.active!==false);
  if(!puzzles.length)return '<div class="section-heading"><div><span class="section-kicker">DISPOSITIVOS RECUPERADOS</span><h2>Procurando terminais</h2></div></div><div class="empty">Nenhum terminal foi localizado nesta sessão. O silêncio também contém pistas.</div>';
  return `<div class="section-heading"><div><span class="section-kicker">ARQUIVO INTERDITADO</span><h2>Dispositivos recuperados</h2><p class="small muted">Autentique-se em cada terminal. As credenciais são verificadas no servidor e o conteúdo protegido só é entregue após o acesso correto.</p></div><span class="corner-mark">${puzzles.length} TERMINAL(IS)</span><button class="btn small" type="button" id="refreshPuzzles">Reconectar</button></div><div class="ashen-terminal-stack">${puzzles.map(p=>{const unlocked=immersivePuzzleUnlocked[p.id];return unlocked?terminalDesktopMarkup(p,unlocked):terminalLoginMarkup(p)}).join('')}</div>`;
}
async function refreshImmersivePuzzles(){
  const sid=String(state.combatSession?.sessionId||'');
  if(state.session?.role!=='player')return;
  const ownerId=String(state.session?.playerId||state.session?.login||'');
  if(!sid){immersivePuzzleSessionId='';immersivePuzzleOwnerId=ownerId;immersivePuzzleUnlocked={};immersivePuzzleCache=[];immersivePuzzleStatus='idle';immersivePuzzleStatusMessage='';return;}
  if(immersivePuzzleSessionId!==sid||immersivePuzzleOwnerId!==ownerId){immersivePuzzleSessionId=sid;immersivePuzzleOwnerId=ownerId;immersivePuzzleUnlocked={};resetTerminalUiState();immersivePuzzleCache=[];immersivePuzzleStatus='idle'}
  immersivePuzzleStatus='loading';immersivePuzzleStatusMessage='';
  try{
    const rows=await listSessionPuzzles(sid);
    if(immersivePuzzleSessionId!==sid||String(state.combatSession?.sessionId||'')!==sid)return;
    immersivePuzzleCache=Array.isArray(rows)?rows:[];immersivePuzzleStatus='ready';
  }catch(err){
    if(immersivePuzzleSessionId!==sid||String(state.combatSession?.sessionId||'')!==sid)return;
    immersivePuzzleStatus='error';immersivePuzzleStatusMessage=puzzleRpcErrorText(err);
    const schemaMissing=Boolean(err?.schemaMissing||String(err?.code||'')==='PGRST202'||Number(err?.status)===404);
    if(!schemaMissing||!puzzleSchemaWarningLogged){console.warn('Puzzle terminal list unavailable:',{message:String(err?.message||err||''),code:err?.code||'',status:err?.status||0,details:err?.details||'',hint:err?.hint||''});if(schemaMissing)puzzleSchemaWarningLogged=true;}
  }
  if(currentView==='immersive'&&immersiveTab==='puzzles'&&String(state.combatSession?.sessionId||'')===sid)render('immersive');
}

function immersivePanel(p){
  if(immersiveTab==='diary'){const d=getPrivateDiary();return `<div class="section-heading"><div><span class="section-kicker">DIÁRIO</span><h2>Registro privado</h2></div><span class="corner-mark">SÓ NESTE APARELHO</span></div><textarea id="immDiary" rows="14" placeholder="Pistas, nomes, suspeitas...">${esc(immDraft.diary??d.text)}</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn primary" id="immSaveDiary">Salvar diário</button></div>`}
  if(immersiveTab==='notes')return `<div class="section-heading"><div><span class="section-kicker">ANOTAÇÕES</span><h2>Notas do personagem</h2></div></div><textarea id="immNotes" rows="14" placeholder="Anotações da sessão...">${esc(immDraft.notes??(p.playerNotes||''))}</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn primary" id="immSaveNotes">Salvar anotações</button></div>`;
  if(immersiveTab==='music'){const themes=Array.isArray(p?.musicThemes)?p.musicThemes:[];return `<div class="section-heading"><div><span class="section-kicker">CANÇÕES DO FIM</span><h2>A trilha que acompanha o portador</h2></div></div><div class="home-theme-grid">${themes.length?themes.map((t,i)=>`<div class="home-theme-card"><span>${esc(t.label)}</span><strong>${esc(t.title)}</strong><div class="row"><button type="button" class="btn small gold" data-play-theme="${i}">▶ Tocar</button><button type="button" class="btn small" data-pause-theme="${i}">Ⅱ</button><button type="button" class="btn small" data-stop-theme="${i}">■</button><a class="btn small" href="${esc(safeHref(t.url))}" target="_blank" rel="noopener">Abrir ↗</a></div></div>`).join(''):'<div class="empty">Nenhuma melodia foi guardada neste arquivo.</div>'}</div>${spotifyHomePanel()}`}
  if(immersiveTab==='skills'){const trained=[...new Set(allSkills().filter(sk=>(effectiveSkill(p,sk)||0)>0))];return `<div class="section-heading"><div><span class="section-kicker">PERÍCIAS</span><h2>Treinadas</h2></div><span class="corner-mark">${trained.length}</span></div>${trained.length?trained.map(sk=>`<div class="op-skill-row"><span>${uiSkillIcon(sk)} ${esc(sk)}</span><b>${effectiveSkill(p,sk)}</b></div>`).join(''):'<div class="empty">Nenhuma perícia treinada.</div>'}<div class="section-heading" style="margin-top:16px"><div><span class="section-kicker">ATRIBUTOS</span><h2>Efetivos</h2></div></div>${allAttrs().map(a=>`<div class="op-skill-row"><span>${uiAttrIcon(a)} ${esc(a)}</span><b>${effectiveAttr(p,a)}</b></div>`).join('')}`}
  if(immersiveTab==='soul')return `<div class="section-heading"><div><span class="section-kicker">ALMA</span><h2>O que permanece</h2></div></div><div class="soul-layout"><div class="photo-wrap"><img class="photo soul-photo" src="${esc(safeImgSrc(p.soulPhoto,'/runa-gold.png'))}" alt="Alma"></div><div><h3>${esc(p.soul||'Sem nome de alma')}</h3><p class="small muted">${esc(p.belovedObjects||'')}</p></div></div>`;
  if(immersiveTab==='abilities'){const c=CLASSES[p.class];const abil=[...(c?.abilities||[]),...customAbilitiesFor(p).map(a=>[a.name,a.description||''])];return `<div class="section-heading"><div><span class="section-kicker">HABILIDADES</span><h2>${esc(p.class||'Sem classe')}</h2></div></div>${abil.length?abil.map(([n,d])=>`<div class="imm-ability"><strong>${esc(n)}</strong><p>${esc(d)}</p></div>`).join(''):'<div class="empty">Escolha uma classe para revelar suas habilidades.</div>'}`}
  if(immersiveTab==='nexus'){const n={...defaultNexus(),...(state.nexus||{})};return `<div class="section-heading"><div><span class="section-kicker">NEXUS TABLETOP</span><h2>${esc(n.title||'Nexus Tabletop')}</h2></div><span class="corner-mark" id="nexusViewerState">${n.active?'CONECTANDO...':'AGUARDANDO TRANSMISSÃO'}</span></div><div class="nexus-video-wrap imm-nexus-wrap"><video id="nexusPlayerVideo" autoplay playsinline controls></video><div class="nexus-placeholder" id="nexusPlaceholder"><span>◇</span><strong>${n.active?'Conectando ao Nexus…':'Nenhuma transmissão ativa'}</strong><small>Quando o Mestre compartilhar o mapa, a imagem aparecerá aqui.</small></div></div><div class="row" style="margin-top:10px;justify-content:flex-end"><button type="button" class="btn small gold" id="nexusReconnect">Conectar novamente</button></div>`}
  if(immersiveTab==='spells')return playerSpellPanel(p);
  if(immersiveTab==='puzzles')return puzzleTerminalPanelMarkup();
  return '';
}
function announceSessionJoin(p){return Promise.resolve();}
function immersivePage(){
  const p=player();if(!p)return shell('<div class="empty">Player não encontrado.</div>','home');
  syncDerivedResources(p);
  const nexusLive=!!state.nexus?.active;const tabs=[['diary','Diário'],['notes','Anotações'],['soul','Alma'],['nexus',nexusLive?'Nexus ●':'Nexus'],['music','Trilha'],['puzzles','Terminais']];
  if(hasMagicClass(p.class)||getAvailableSpells(p).length)tabs.push(['spells','Magias']);
  if(immersiveTab&&!tabs.some(t=>t[0]===immersiveTab))immersiveTab='';
  const hpMax=derivedMax(p,'Corpo')||1,sanMax=derivedMax(p,'Sanidade');
  const cond=(p.conditions||[]).map(id=>conditionById(id)).filter(Boolean);const sessionEffects=Array.isArray(p.sessionEffects)?p.sessionEffects:[];
  const wallpaperUrl=safeCssImageUrl(p?.homeWallpaper);const wallpaper=wallpaperUrl?` style="--player-wallpaper:url('${wallpaperUrl}')"`:'';
  const combat=state.combatSession||defaultCombatSession(); const current=combatCurrent(combat); const myKey=combatParticipantKey('player',p.id||p.login); const myTurn=!!current&&current.key===myKey; const acted=(combat.actedKeys||[]).includes(myKey); const inSession=combatOrderedParticipants(combat).some(x=>x.key===myKey);const sessionState=(!inSession&&(combat.participants||[]).length)?'FORA DESTA SESSÃO':combat.active?(myTurn?'SUA VEZ':acted?'VOCÊ JÁ AGIU':'AGUARDANDO'):'SESSÃO EM PREPARAÇÃO';
  if(immersiveViewMode==='shared'){
    const rows=combatOrderedParticipants(combat).map((entry,i)=>{const entity=combatEntityForParticipant(entry);const isCurrent=entry.key===combat.currentKey;const done=(combat.actedKeys||[]).includes(entry.key);return `<article class="imm-shared-participant ${isCurrent?'current':''} ${done?'acted':''}"><span class="imm-shared-order">${i+1}</span><div class="imm-shared-main"><strong>${esc(entry.name||'Participante')}</strong><small>${entry.kind==='monster'?'CRIATURA':'PLAYER'}${isCurrent?' • VEZ ATUAL':done?' • JÁ AGIU':''}</small></div><div class="imm-shared-vitals"><span>VIDA <b>${Number(entity?.hp)||0}/${Number(entity?.hpMax)||0}</b></span></div></article>`}).join('');
    return `<div class="immersive player-personalized immersive-shared"${wallpaper}><header class="imm-head"><div class="imm-session-title"><span class="section-kicker">ARQUIVO DA VIGÍLIA · VISÃO DO CÍRCULO</span><h1>${esc(combat.title||'Sessão atual')}</h1><p>${esc(combat.scene||'A noite ainda não terminou.')}</p><div class="imm-session-meta"><span class="imm-session-live ${combat.active?'active':''}">${combat.active?'● VIGÍLIA EM CURSO':'○ ANTES DO PRIMEIRO SINAL'}</span><span>RODADA ${Number(combat.round)||1}</span><span>TURNO ${Number(combat.turn)||0}</span></div></div><button type="button" class="imm-exit" data-imm-exit>${CURTAIN_SVG}<span>Ficha e menu</span></button></header><nav class="imm-view-switch" aria-label="Visão do modo sessão"><button type="button" data-imm-view="personal">Meu registro</button><button type="button" class="active" data-imm-view="shared" aria-current="page">Círculo dos sobreviventes</button></nav>${immQuickNav()}<section class="imm-shared-hero"><span class="section-kicker">SITUAÇÃO DOS SOBREVIVENTES</span><h2>${current?`Vez de ${esc(current.name)}`:'A vigília ainda não foi iniciada'}</h2><p>O círculo permanece unido nesta visão. Segredos e anotações particulares continuam ocultos.</p></section><section class="imm-shared-grid">${rows||'<div class="empty">Nenhuma presença foi inscrita no círculo desta vigília.</div>'}</section><section class="imm-panel imm-shared-scene"><span class="section-kicker">CENA ATUAL</span><h2>${esc(combat.scene||'Nenhuma ocorrência foi registrada nesta noite')}</h2><p>Nem toda verdade foi revelada. Aguarde os sinais do Mestre.</p></section></div>`;
  }
  return `<div class="immersive player-personalized"${wallpaper}><header class="imm-head"><div class="imm-session-title"><span class="section-kicker">A VIGÍLIA</span><h1>${esc(combat.title||'A Vigília')}</h1><p>${esc(combat.scene||'A noite ainda não terminou.')}</p><div class="imm-session-meta"><span class="imm-session-live ${combat.active?'active':''}">${combat.active?'● VIGÍLIA EM CURSO':'○ ANTES DO PRIMEIRO SINAL'}</span><span>RODADA ${Number(combat.round)||1}</span><span>TURNO ${Number(combat.turn)||0}</span></div></div><div class="imm-head-player"><div class="imm-turn-pill ${myTurn?'my-turn':''}"><span>${sessionState}</span>${current?`<small>Vez de ${esc(current.name)}</small>`:''}</div></div><button type="button" class="imm-exit" data-imm-exit>${CURTAIN_SVG}<span>Ficha e menu</span></button></header><nav class="imm-view-switch" aria-label="Visão do modo sessão"><button type="button" class="active" data-imm-view="personal" aria-current="page">Meu registro</button><button type="button" data-imm-view="shared">Círculo dos sobreviventes</button></nav>${immGamePanel(p,hpMax,sanMax)}<div class="imm-layout"><aside class="imm-rail" aria-label="Estado do personagem"><div class="imm-stats">${resourceBarMarkup('Vida',p.hp,hpMax,'health',false)}${resourceBarMarkup('Sanidade',p.sanity,sanMax,'sanity',false)}<div class="imm-combat"><span>ATQ <b>${p.attack}</b></span><span>DEF <b>${p.defense}</b></span></div></div>${immTrainedPanel(p)}${immAbilitiesPanel(p)}${cond.length||sessionEffects.length?`<div class="imm-conds">${cond.map(c=>`<span class="imm-cond" title="${esc(conditionEffectText(c.id,p))}">${esc(c.name)}${conditionTurnsLeft(p,c.id)>0?` (${conditionTurnsLeft(p,c.id)})`:''}</span>`).join('')}${sessionEffects.map(e=>`<span class="imm-cond imm-temp-effect" title="Efeito temporário; sem cálculo automático">${esc(e.name)} (${Number(e.remainingTurns)||0})</span>`).join('')}</div>`:''}</aside><div class="imm-main"><nav class="imm-tabs">${tabs.map(([k,l])=>`<button type="button" class="${immersiveTab===k?'active':''}" data-imm-tab="${k}" aria-expanded="${immersiveTab===k?'true':'false'}">${l}</button>`).join('')}</nav>${immersiveTab?`<section class="imm-panel">${immersivePanel(p)}</section>`:'<p class="imm-tabs-hint">Toque em uma aba para abri-la.</p>'}</div></div></div>`;
}
function bindImmersive(){
  const p=player();if(!p)return;
  announceSessionJoin(p);
  document.querySelectorAll('[data-imm-tab]').forEach(b=>b.onclick=()=>{immersiveTab=immersiveTab===b.dataset.immTab?'':b.dataset.immTab;render('immersive')});
  bindImmBag(p);
  document.querySelectorAll('[data-imm-view]').forEach(b=>b.onclick=()=>{immersiveViewMode=b.dataset.immView==='shared'?'shared':'personal';curtainTransition(()=>render('immersive'))});
  document.querySelectorAll('[data-imm-exit]').forEach(b=>b.addEventListener('click',()=>{immBagIntro=false;immBagPrevIds=null;immBagMoveArmed=false;curtainTransition(()=>render('sheet'))}));bindPlayerThemes();
  if(immersiveTab==='nexus')bindNexusViewer();
  try{document.querySelector('.imm-tabs button.active')?.scrollIntoView({inline:'center',block:'nearest'})}catch{}
  document.querySelectorAll('[data-read-book]').forEach(b=>b.onclick=()=>openBookReader(Number(b.dataset.readBook)));
  document.querySelectorAll('[data-use-spell]').forEach(b=>b.onclick=()=>castSpell(p,b.dataset.useSpell,'immersive'));if(immersiveTab==='spells')bindSpellEditing(p,'immersive');
  if(immersiveTab==='puzzles'){
    document.getElementById('retryPuzzleLoad')?.addEventListener('click',refreshImmersivePuzzles);
    document.getElementById('refreshPuzzles')?.addEventListener('click',refreshImmersivePuzzles);
    const activePuzzleSession=String(state.combatSession?.sessionId||'');
    if(immersivePuzzleStatus==='idle'||immersivePuzzleSessionId!==activePuzzleSession||immersivePuzzleOwnerId!==String(state.session?.playerId||state.session?.login||''))refreshImmersivePuzzles();
  }
  document.querySelectorAll('form[data-puzzle-unlock-form]').forEach(form=>form.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const puzzleId=form.dataset.puzzleUnlockForm||'',login=form.querySelector('[name=login]')?.value||'',password=form.querySelector('[name=password]')?.value||'',submit=form.querySelector('button[type=submit]');
    if(!puzzleId)return;
    termAudioPrime();
    const unlockSessionId=String(state.combatSession?.sessionId||'');
    const unlockOwnerId=String(state.session?.playerId||state.session?.login||'');
    if(submit){submit.disabled=true;submit.textContent='Verificando credenciais…'}
    let bootAfterRender='';
    try{
      const result=await unlockSessionPuzzle(unlockSessionId,puzzleId,login,password);
      if(String(state.combatSession?.sessionId||'')!==unlockSessionId||String(state.session?.playerId||state.session?.login||'')!==unlockOwnerId){toast('A sessão ou o usuário mudou durante a verificação. O arquivo não foi aberto.');await refreshImmersivePuzzles();render('immersive');return;}
      if(result?.ok){
        if(immersivePuzzleSessionId!==unlockSessionId||immersivePuzzleOwnerId!==unlockOwnerId){immersivePuzzleSessionId=unlockSessionId;immersivePuzzleOwnerId=unlockOwnerId;immersivePuzzleUnlocked={};resetTerminalUiState();immersivePuzzleCache=[];}
        immersivePuzzleUnlocked[puzzleId]={title:String(result.title||'Arquivo recuperado'),content:String(result.content||''),puzzleTitle:String(result.puzzleTitle||'Terminal'),audioFiles:Array.isArray(result.audioFiles)?result.audioFiles:[],extraFiles:Array.isArray(result.extraFiles)?result.extraFiles:[],fileCorruption:result.fileCorruption&&typeof result.fileCorruption==='object'?result.fileCorruption:null};
        immersiveTerminalOpenFiles[puzzleId]='';immersiveTerminalCwd[puzzleId]='';immersiveTerminalHistory[puzzleId]=[];bootAfterRender=puzzleId;
        const cachedPuzzle=(immersivePuzzleCache||[]).find(x=>String(x.id)===String(puzzleId));
        startTerminalBoot(puzzleId,immersivePuzzleUnlocked[puzzleId],cachedPuzzle?.terminalLabel||cachedPuzzle?.title||'RESTRICTED NODE',unlockSessionId,unlockOwnerId);
        toast('Acesso concedido. Inicializando terminal…');
      }else{sfx('denied');toast(result?.message||'Acesso negado.');}
      render('immersive');
    }catch(err){console.warn('Puzzle unlock failed:',err);toast(puzzleRpcErrorText(err));if(submit){submit.disabled=false;submit.textContent='Tentar acesso'}}
  }));
  const terminalCtx=btn=>{const pid=btn.dataset.terminalPuzzle||btn.dataset.terminalCloseFile||btn.dataset.terminalReboot||'';const unlocked=pid&&immersivePuzzleUnlocked[pid];return unlocked?{pid,unlocked,model:buildTerminalModel(pid,unlocked)}:null};
  const sessionKeys=()=>[String(state.combatSession?.sessionId||''),String(state.session?.playerId||state.session?.login||'')];
  document.querySelectorAll('[data-terminal-cd]').forEach(btn=>btn.addEventListener('click',()=>{const c=terminalCtx(btn);if(!c)return;const dest=btn.dataset.terminalCd||'';pauseAudioPlayers();const cmd=terminalCommand('cd',c.model,dest,immersiveTerminalCwd[c.pid]||'');pushTerminalHistory(c.pid,cmd);immersiveTerminalCwd[c.pid]=dest;immersiveTerminalOpenFiles[c.pid]='';sfx('folder');immersiveTerminalFresh=true;try{render('immersive')}finally{immersiveTerminalFresh=false}}));
  document.querySelectorAll('[data-terminal-open-file]').forEach(btn=>btn.addEventListener('click',()=>{const c=terminalCtx(btn);if(!c)return;const key=btn.dataset.terminalOpenFile||'';const it=c.model.byKey.get(key);if(!it)return;pauseAudioPlayers();pushTerminalHistory(c.pid,terminalCommand('open',c.model,key));immersiveTerminalOpenFiles[c.pid]=key;sfx(it.corrupted?'error':'open');render('immersive')}));
  document.querySelectorAll('[data-terminal-close-file]').forEach(btn=>btn.addEventListener('click',()=>{const pid=btn.dataset.terminalCloseFile||'';if(!pid)return;pauseAudioPlayers();immersiveTerminalOpenFiles[pid]='';sfx('close');render('immersive')}));
  document.querySelectorAll('[data-terminal-skip-boot]').forEach(btn=>btn.addEventListener('click',()=>{const pid=btn.closest('[data-terminal-os]')?.dataset.terminalOs||Object.keys(immersiveTerminalBooting).find(k=>immersiveTerminalBooting[k])||'';if(!pid)return;const [sid,owner]=sessionKeys();finishTerminalBoot(pid,sid,owner,true)}));
  document.querySelectorAll('[data-terminal-reboot]').forEach(btn=>btn.addEventListener('click',()=>{const c=terminalCtx(btn);if(!c)return;termAudioPrime();pauseAudioPlayers();const [sid,owner]=sessionKeys();const cached=(immersivePuzzleCache||[]).find(x=>String(x.id)===String(c.pid));immersiveTerminalOpenFiles[c.pid]='';immersiveTerminalCwd[c.pid]='';immersiveTerminalHistory[c.pid]=[];if(prefersReducedMotion()){sfx('granted');render('immersive');return}startTerminalBoot(c.pid,c.unlocked,cached?.terminalLabel||cached?.title||'RESTRICTED NODE',sid,owner);render('immersive')}));
  document.querySelectorAll('[data-terminal-fsck]').forEach(btn=>btn.addEventListener('click',()=>runFsckSim(btn.closest('[data-fsck]'))));
  if(immersiveTab==='puzzles'){
    bindTerminalAudioUi(document);bindLoginSfx(document);startTerminalClock();
    bindAudioPlayers(document,ck=>{const [pid,key]=String(ck).split('|');const u=immersivePuzzleUnlocked[pid];return u?buildTerminalModel(pid,u).byKey.get(key):null});
    document.querySelectorAll('.ashen-terminal-console').forEach(el=>{el.scrollTop=el.scrollHeight});
  }
  const dEl=document.getElementById('immDiary'),nEl=document.getElementById('immNotes');
  dEl?.addEventListener('input',()=>{immDraft.diary=dEl.value});nEl?.addEventListener('input',()=>{immDraft.notes=nEl.value});
  document.getElementById('immSaveDiary')?.addEventListener('click',()=>{savePrivateDiary(dEl?.value||'');immDraft.diary=null;toast('Diário salvo neste dispositivo.')});
  document.getElementById('immSaveNotes')?.addEventListener('click',()=>{p.playerNotes=String(nEl?.value||'').slice(0,20000);immDraft.notes=null;save();toast('Anotações salvas.')});
  try{navigator.wakeLock?.request('screen').catch(()=>{})}catch{}
}

document.addEventListener('click',ev=>{
  const t=ev.target;if(!t||!t.closest)return;
  const det=t.closest('[data-det-delta]');
  if(det){const p=player();if(p&&state.session?.role==='player'){const {max,cur}=detValues(p);p.determination=clamp(cur+(Number(det.dataset.detDelta)||0),0,max);save();updateDeterminationUI(p)}return}
  if(t.closest('[data-enter-immersive]')){curtainTransition(()=>render('immersive'));return}
  const play=t.closest('[data-play-theme]');
  if(play){const p=player(),th=p?.musicThemes?.[Number(play.dataset.playTheme)];if(th)playPersonalTheme(th.url,th.title);return}
  if(t.closest('#changeMasterPw')){openMasterPasswordModal();return}
});
document.addEventListener('change',ev=>{if(ev.target?.id==='themeFile')uploadThemeFile(ev.target)});
document.addEventListener('change',ev=>{if(ev.target?.id==='libMusicFile')uploadLibraryFile(ev.target)});
document.addEventListener('focusout',()=>{setTimeout(()=>{if(!deferredRemoteRender)return;const a=document.activeElement;if(a&&/^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName))return;deferredRemoteRender=false;render(currentView||'home',{remote:true})},300)});
window.addEventListener('pagehide',()=>flushSave());
window.addEventListener('beforeunload',()=>flushSave());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushSave()});
window.addEventListener('a-profecia-auth-expired',()=>{if(state.session?.role)forceRelogin('Sua sessão expirou. Entre novamente.')});

function forceRelogin(msg){
  clearImmersivePuzzleState();state.session=null;clearSessionCache();
  try{storageSet(KEY,serializeState())}catch{}
  render('home');
  if(msg)toast(msg);
}
function openMasterPasswordModal(){
  openModal(`<div class="modal" id="mpModal"><div class="modal-card"><button class="modal-close" id="mpClose">×</button><span class="badge">SEGURANÇA</span><h2>Trocar senha do Mestre</h2><p class="small muted">A senha fica guardada só no servidor, com criptografia. Ao trocar, os outros aparelhos do Mestre precisarão entrar de novo.</p><div class="field"><label>Senha atual</label><input id="mpOld" type="password" autocomplete="current-password"></div><div class="field"><label>Nova senha (mínimo 10 caracteres)</label><input id="mpNew" type="password" autocomplete="new-password"></div><div class="field"><label>Repita a nova senha</label><input id="mpNew2" type="password" autocomplete="new-password"></div><div class="row" style="justify-content:flex-end"><button class="btn" id="mpCancel">Cancelar</button><button class="btn primary" id="mpSave">Trocar senha</button></div></div></div>`);
  const close=()=>document.getElementById('mpModal')?.remove();
  document.getElementById('mpClose').onclick=close;document.getElementById('mpCancel').onclick=close;
  document.getElementById('mpSave').onclick=async()=>{
    const o=document.getElementById('mpOld').value,n=document.getElementById('mpNew').value,n2=document.getElementById('mpNew2').value;
    if(!remoteEnabled){toast('Disponível apenas com o servidor ativo.');return}
    if(n.length<10){toast('Use pelo menos 10 caracteres.');return}
    if(n!==n2){toast('As senhas novas não coincidem.');return}
    try{const ok=await changeMasterPassword(o,n);if(ok){close();toast('Senha do Mestre alterada.')}else toast('Senha atual incorreta.')}
    catch(err){toast(authErrorText(err))}
  };
}

function remoteRenderNeeded(view,domains){
  const ds=new Set(Array.isArray(domains)?domains:[]);
  if(ds.has('terrorMode'))return true;
  if(!ds.size)return false;
  const role=state.session?.role;
  let needed;
  if(view==='master'&&role==='master'){
    const tab=adminTabCurrent||'players';
    const tabDomains={
      players:['players','items','rulesBook'],
      monsters:['creatures'],
      classes:['customContent','characterRules','classBonuses'],
      items:['items'],
      music:['music','musicLibrary','slasherIntroMusic'],
      sounds:['sounds','soundboard'],
      secrets:['players'],
      symbols:['uiIcons'],
      spells:['spells'],
      content:['customContent','spells','slasherIntroMusic'],
      backgrounds:['backgrounds'],
      branding:['siteBrand'],
      tv:['tvScreen','tvScenes'],
      recovery:[],
      load:[]
    };
    needed=new Set(tabDomains[tab]||[]);
  }else if(view==='home'){
    needed=role==='master'
      ? new Set(['players','combatSession'])
      : new Set(['combatSession','uiIcons','customContent','characterRules','classBonuses']);
  }else if(view==='classes'){
    needed=new Set(['customContent','uiIcons','characterRules','classBonuses']);
  }else if(view==='library'){
    needed=new Set(['items']);
  }else if(view==='diary'){
    needed=new Set();
  }else if(view==='nexus'){
    needed=new Set(['nexus']);
  }else if(view==='immersive'){
    needed=new Set(['players','combatSession','uiIcons','customContent','characterRules','classBonuses','items','spells']);
  }else if(view==='sheet'){
    needed=new Set(['players','combatSession','uiIcons','customContent','characterRules','classBonuses']);
  }else{
    return false;
  }
  return [...ds].some(key=>needed.has(key));
}

async function boot(){
  if(remoteEnabled&&state.session?.role){
    try{
      const who=await authCheck();
      if(!who||who.role!==state.session.role||(who.role==='player'&&String(who.player_id||'')!==String(state.session.playerId||''))){
        forceRelogin('Sua sessão não foi aceita pelo servidor. Entre novamente.');
        return;
      }
    }catch(e){
      const msg=String(e?.message||e||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').toUpperCase();
      if(/SESSAO_INVALIDA|P0001.*SESSAO_INVALIDA/.test(msg) || !getAuthToken()){
        return;
      }
      console.warn('Não foi possível validar a sessão agora (sem rede?):',e);
    }
  }
  try{
    if(remoteEnabled){
      const remoteRow=await fetchGlobal();
      const remote=remoteRow?.data || remoteRow;
      const bootIsMaster=state.session?.role==='master';
      if(hasRemoteSharedData(remote)){
        await saveLocalRecovery('antes-da-sincronizacao');
        if(bootIsMaster&&globalDirty()&&!loadFailed){
          const stamp=Number(storageGet(GLOBAL_DIRTY_KEY)||0);
          try{await backupGlobal(remote,'antes-de-reenviar-alteracao-pendente')}catch(e){console.warn('Backup remoto indisponível:',e)}
          remoteApplying=true;
          try{await pushGlobalTracked(globalPayload());clearGlobalDirty(stamp)}finally{remoteApplying=false}
        }else{
          remoteApplying=true;
          try{mergeGlobal(remote);storageSet(KEY,serializeState());persistCriticalCache();persistSessionCache()}finally{remoteApplying=false}
        }
      }else if(bootIsMaster){
        await saveLocalRecovery('antes-do-primeiro-envio');
        remoteApplying=true;
        try{await pushGlobalTracked(globalPayload())}finally{remoteApplying=false}
      }
      remoteHydrated=true;
      if(!globalDirty())rememberGlobalSignature(globalPayload());
      if(bootIsMaster&&!loadFailed&&Array.isArray(remote?.items)&&remote.items.length>200)queueRemoteSave();
      await hydratePlayersDb();
      if(ps.hydrated)await syncPlayersDbNow();
      startStabilityPatch();
      normalizeCombatSession();
      if(bootIsMaster&&!remote?.combatSession){
        remoteApplying=true;
        try{await pushGlobalTracked(globalPayload())}finally{remoteApplying=false}
      }
      let lastRemoteStamp=remoteRow?.updated_at||'';
      try{const c0=combatCurrent(state.combatSession);if(lastKnownTurnParticipantId===null)lastKnownTurnParticipantId=c0?c0.key:''}catch{}
      const applyIncoming=async(row)=>{
        const data=row?.data||row;if(!hasRemoteSharedData(data)||remoteApplying)return;
        remoteApplying=true;
        const result=mergeGlobal(data);
        storageSet(KEY,serializeState());persistCriticalCache();persistSessionCache();remoteApplying=false;
        if(state.session?.role==='master'&&!globalDirty())rememberGlobalSignature(globalPayload());
        if(!result.changed)return;
        const d=result.domains;
        if(d.includes('backgrounds')){bgAppliedSignature='';await applyBackgrounds(true);}if(d.includes('siteBrand'))applySiteBrand();
        if(d.includes('combatSession')&&state.session?.role==='player'){
          const me=player(),current=combatCurrent(state.combatSession);
          const isMine=!!(me&&current&&current.kind==='player'&&String(current.entityId)===String(me.id));
          const rowsNow=combatOrderedParticipants(state.combatSession),curIdx=current?rowsNow.findIndex(x=>x.key===current.key):-1,nextRow=(curIdx>=0&&rowsNow.length>1)?rowsNow[(curIdx+1)%rowsNow.length]:null,nextIsMine=!!(me&&nextRow&&nextRow.kind==='player'&&String(nextRow.entityId)===String(me.id));
          if(isMine&&current.key!==lastKnownTurnParticipantId){alertVibrate([120,60,120,60,220]);playTurnAlertSound('turn');toast('É a sua vez!');}
          else if(!isMine&&nextIsMine&&current&&current.key!==lastKnownTurnParticipantId){alertVibrate([90]);playTurnAlertSound('next');toast('Prepare-se: você é o próximo.');}
          lastKnownTurnParticipantId=current?current.key:'';
        }
        if(currentView==='tv'){
          if(d.includes('tvScreen')||d.includes('tvScenes'))applyTvCommand(tvCurrent(),true);
        }else if(remoteRenderNeeded(currentView||'home',d)){
          if(!(state.session?.role==='player'&&currentView==='sheet')&&!(state.session?.role==='master'&&currentView==='master'))queueRemoteRender(currentView||'home');
        }
        if(d.some(x=>['music','backgrounds','sounds','soundboard'].includes(x))){syncGlobalMusic(true);syncSoundboard();}
      };
      subscribeGlobal(row=>{lastRemoteStamp=row?.updated_at||lastRemoteStamp;applyIncoming(row).catch(e=>console.warn('Falha ao aplicar atualização global:',e));});
      if(playerStoreEnabled){ps.unsubscribe=subscribePlayers(async row=>{
        if(!row||ps.applying)return;
        const activePlayerId=state.session?.role==='player'?String(state.session.playerId||''):'';
        const rowId=String(row.id||'');
        const affectsActive=!!activePlayerId&&rowId===activePlayerId;
        if(row.deleted_at&&affectsActive){
          const confirmed=await confirmPlayerDeletion(activePlayerId);
          if(!confirmed)return;
          ps.applying=true;
          try{
            state.playerTombstones=state.playerTombstones||{};
            state.playerTombstones[activePlayerId]=Math.max(Number(state.playerTombstones[activePlayerId])||0,playerRowDeletedStamp(row)||Date.now());
            const fallback=state.session?.playerSnapshot;
            if(fallback&&String(fallback.id)===activePlayerId){
              state.players=state.players.filter(p=>String(p.id)!==activePlayerId);
              storageSet(KEY,serializeState());
              toast('A ficha foi marcada como excluída pelo Mestre.');
            }
          }finally{ps.applying=false}
          return;
        }
        ps.applying=true;
        try{
          const beforeActive=player();
          const beforeRolls=Array.isArray(beforeActive?.rolls)?clone(beforeActive.rolls):[];
          applyPlayerRows([row],{authoritative:false});
          const after=player();
          if(after&&beforeActive&&String(after.id)===String(beforeActive.id)){
            after.rolls=mergeRollHistory(after.rolls||[], beforeRolls);
            normalize(after);
          }
          if(affectsActive&&beforeActive&&after&&state.session?.role==='player'){
            const hpBefore=Number(beforeActive.hp),hpAfter=Number(after.hp);
            if(Number.isFinite(hpBefore)&&Number.isFinite(hpAfter)&&hpAfter<hpBefore){
              alertVibrate([180,90,180]);
              playTurnAlertSound('hurt');
              toast(`Você perdeu ${hpBefore-hpAfter} de vida.`);
            }
          }
          if(beforeActive&&after&&String(beforeActive.id)===String(after.id)){
            const mediaChanged=['photo','soulPhoto','homeWallpaper'].some(k=>!imageValue(row?.data?.[k])&&imageValue(beforeActive?.[k])&&imageValue(after?.[k]));
            if(mediaChanged)after._syncUpdatedAt=nextStamp();
          }
          if(after&&state.session?.role==='player'){
            state.session.playerSnapshot=clone(after);
            storageSet(KEY,serializeState());
            if(currentView==='sheet'){
              const last=after.rolls?.[after.rolls.length-1];
              if(last)updateDiceUI(last);
              updateResourceBars(after,'health');
              updateResourceBars(after,'sanity');
            }else if(currentView&&affectsActive)queueRemoteRender(currentView);
          }else if(currentView&&state.session?.role==='master'){
            if(currentView==='master'&&adminTabCurrent==='players')refreshMasterPlayersAdminView();
            else if(!(currentView==='master'&&adminTabCurrent!=='players'))queueRemoteRender(currentView);
          }
        }finally{ps.applying=false}
      })}
      subscribeLive(msg=>{if(msg.event==='tv-scene')handleTvLive(msg.payload);if(msg.event==='combat-start')combatStartLive(msg.payload);nexusHandleLive(msg);});
      const isMobile=matchMedia('(max-width: 800px)').matches;
      const pollDelay=isMobile?90000:45000;
      const scheduleGlobalPoll=()=>{
        globalPollTimer=setTimeout(async()=>{
          try{
            if(!document.hidden&&remoteEnabled&&!remoteApplying){
              const row=await fetchGlobal();
              if(row?.updated_at&&row.updated_at!==lastRemoteStamp){
                lastRemoteStamp=row.updated_at;await applyIncoming(row);
              }
            }
          }catch(e){remoteApplying=false;}
          finally{scheduleGlobalPoll();}
        },Math.round(pollDelay*(0.85+Math.random()*0.30)));
      };
      clearTimeout(globalPollTimer);
      scheduleGlobalPoll();
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden||!remoteEnabled)return;
        setTimeout(async()=>{try{const row=await fetchGlobal();if(row?.updated_at&&row.updated_at!==lastRemoteStamp){lastRemoteStamp=row.updated_at;await applyIncoming(row)}}catch{}},700);
      });
    }
  }catch(e){console.warn('Modo global indisponível; usando dados locais.',e);remoteApplying=false;remoteHydrated=true;}
  if(playerStoreEnabled&&!ps.hydrated){await hydratePlayersDb();if(ps.hydrated)await syncPlayersDbNow();}
  startStabilityPatch();
  try{await handleSpotifyCallback();if(spotifyLogged())await ensureSpotifyPlayer();}finally{
    const savedView=viewCacheGet();
    bindSessionGuardian();
    bindSyncHealthUI();
    render(savedView||'home');
    updateSyncHealthUI();
    syncGlobalMusic();syncSoundboard();applyBackgrounds();
  }
}
boot();
if(!window.__a11yPolishBound){window.__a11yPolishBound=1;
  /* O CSP bloqueia handlers inline (onerror=): o fallback de imagem quebrada precisa ser delegado. */
  document.addEventListener('error',e=>{const im=e.target;if(!(im instanceof HTMLImageElement)||im.dataset.fb)return;if(!im.closest('.op-portrait-frame,.sess-diamond,.imm-rec-portrait,.content-thumb,.photo,.brand'))return;im.dataset.fb='1';if(im.classList.contains('content-thumb')||im.closest('.brand')){im.style.display='none';return}im.src='/ritual.webp'},true);
  document.addEventListener('click',e=>{const a=e.target.closest?.('[data-skip-main]');if(!a)return;e.preventDefault();const m=document.getElementById('main-content');if(m){m.focus({preventScroll:true});m.scrollIntoView({block:'start'})}});
}
if(!window.__escModalBound){window.__escModalBound=1;document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||document.getElementById('masterToolsSheet'))return;const mods=document.querySelectorAll('.modal');const top=mods[mods.length-1];top?.querySelector('.modal-close')?.click()})}
