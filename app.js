import { remoteEnabled, fetchGlobal, pushGlobal, backupGlobal, listGlobalBackups, uploadGlobalFile, subscribeGlobal, subscribeLive, broadcastLive, authMasterLogin, authPlayerLogin, authRegisterPlayer, authLogout, authCheck, changeMasterPassword, authErrorText, getAuthToken } from './src/globalSync.js';
import { playerStoreEnabled, fetchPlayers as fetchPlayerRows, upsertPlayers, upsertPlayerTombstones, subscribePlayers } from './src/playerStore.js';
const APP_VERSION='V1.0.1 · CONTROLE DE SESSÃO REFEITO';
// ===== V66.1: declarações do Modo Sessão/segurança ficam AQUI, no topo. load() roda logo abaixo e chama normalize(),
// que usa estas constantes; declaradas mais adiante elas ainda estariam "não inicializadas" (erro do console). =====
let loadFailed=false;
let saveTimer=0,saveDirty=false,saveFirstAt=0,lastRecoveryAt=0;
let lastRenderSig='',renderOpts={},renderSkipped=false,deferredRemoteRender=false;
const COMBAT_DEFAULT={atkMult:4,defMult:5,atkMin:0,defMin:0,atkCap:10,defCap:15};
const FRACTURE_DAMAGE=3;
const WEAKENED_PENALTY=2;
const DET_DEFAULT_MAX=12;
let immersiveTab='bag';
const immDraft={diary:null,notes:null};
const DET_SVG=`<svg class="det-sigil" viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor"><rect x="19" y="30" width="28" height="28" rx="13"/><rect x="12" y="15" width="7" height="27" rx="3.5" transform="rotate(-16 15 28)"/><rect x="22" y="5" width="7" height="33" rx="3.5"/><rect x="32" y="3" width="7" height="35" rx="3.5"/><rect x="42" y="9" width="7" height="31" rx="3.5" transform="rotate(11 45 24)"/><rect x="46" y="31" width="7" height="20" rx="3.5" transform="rotate(52 49 41)"/></g></svg>`;
const CURTAIN_SVG=`<svg class="curtain-sigil" viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor"><rect x="4" y="5" width="56" height="6" rx="3"/><path d="M8 12h16c-1 10-6 16-6 26 0 8 3 14 6 20H8z"/><path d="M56 12H40c1 10 6 16 6 26 0 8-3 14-6 20h16z"/></g></svg>`;

// V66: a senha do Mestre deixou de ficar em texto puro no código. Só o hash SHA-256 (com sufixo fixo) é guardado.
const MASTER={login:'SXscroow',passwordHash:'5f9619c5ae8f2aacc3430624ff8b877ff8da3c9f16d27e0d63c67f86617aa7f4'};
const TEST={login:'teste',password:'Teste1234'};
const MAX_HP=35, MAX_BAG=10, MAX_ATTR=8, MAX_SKILL=15, KEY='filii_abyssi_state_v15';
const DEFAULT_RULES={campaign:{attrPoints:8,skillPoints:15,hpMax:35},slasher:{attrPoints:30,skillPoints:30,hpMax:100}};
const BG_DB_NAME='a-profecia-backgrounds-v1', BG_STORE='backgrounds';
const BG_DEFS={global:['Fundo geral','fundo-geral.webp'],login:['Tela de login','fundo-geral.webp'],home:['Início / Home','inicio-moldura.webp'],sheet:['Ficha / Pergaminho','ficha-pergaminho.webp'],profile:['Cabeçalho da ficha','inicio-moldura.webp'],classes:['Página de Classes','fundo-geral.webp'],master:['Câmara do Mestre','fundo-geral.webp']};
const SUPPORTED_IMAGE_EXT=/\.(png|jpe?g|jfif|webp|avif)$/i;
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
 {id:'lantern-of-the-dead',name:'Lanterna dos Mortos',school:'Necromancia • Luz',cost:'10 Mente',description:'Revela presenças sobrenaturais próximas através de uma luz fria e instável.',image:''}
];
function uiAttrIcon(name){const v=state?.uiIcons?.attrs?.[name]||DEFAULT_ATTR_ICONS[name]||'◇';return renderCustomIcon(v)}
function uiSkillIcon(name){const v=state?.uiIcons?.skills?.[name]||DEFAULT_SKILL_ICONS[name]||'◆';return renderCustomIcon(v)}
function renderCustomIcon(v){const x=String(v||'').trim();if(/^data:image\//i.test(x)||/^https?:\/\//i.test(x)||/^\.\/?/.test(x)||x.startsWith('assets/'))return `<img src="${esc(x)}" alt="" class="ui-symbol-image">`;return esc(x||'◇')}

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

// Condições usam símbolos próprios do site. URLs externas de arte podem ser configuradas futuramente com autorização de uso.
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
// V66.3: os 1.961 itens do catálogo vêm do código (CURATED_ITEMS). Guardá-los no estado global (~900 KB) fazia todo aparelho
// baixá-los ao abrir, regravá-los no navegador a cada alteração e o Mestre reenviá-los a cada salvamento. Agora só vão para
// o servidor/navegador os itens EDITADOS ou CRIADOS; o resto é recomposto pelo migrateItems() ao carregar.
var _defItemSigs=null;
const itemSig=i=>JSON.stringify(i,Object.keys(i).sort());
function defaultItemSigs(){if(!_defItemSigs){_defItemSigs=new Map();for(const i of migrateItems([]))_defItemSigs.set(Number(i.id),itemSig(i))}return _defItemSigs}
function slimItems(items){const sigs=defaultItemSigs();return (Array.isArray(items)?items:[]).filter(i=>i&&sigs.get(Number(i.id))!==itemSig(i))}
function serializeState(){const full=state.items;try{state.items=slimItems(full);return JSON.stringify(state)}finally{state.items=full}}
function migrateItems(items){const current=Array.isArray(items)?items:[];const kept=current.filter(i=>!oldAutoItem(i));const ids=new Set(kept.map(i=>Number(i.id)));DEFAULT_ITEMS.forEach(i=>{if(!ids.has(i.id))kept.push(clone(i))});kept.forEach(i=>{const legacy={Arma:'Armas',Missão:'Itens Chave',Consumível:'Consumíveis',Material:'Materiais',Relíquia:'Relíquias',Mágico:'Relíquias',Armadura:'Diversos',Comum:'Diversos'};if(legacy[i.category])i.category=legacy[i.category];i.weight=inferWeight(i);i.maxQty=Math.max(1,Number(i.maxQty)||10);if(isWeaponItem(i)&&!String(i.damage||'').trim())i.damage=weaponDamageFallback(i);if(i.id===300){i.name='Chave';i.category='Itens Chave';i.icon='asset:key';i.weight=1}});return kept}

function blankLimits(){return Object.fromEntries(ATTRS.map(a=>[a,{min:0,max:MAX_ATTR}]));}
function blankAttrs(){return Object.fromEntries(ATTRS.map(a=>[a,0]));}
function blankSkills(){return Object.fromEntries(SKILLS.map(s=>[s,0]));}
function basePlayer(){return{id:'p-test',login:TEST.login,password:TEST.password,name:'Aldren',class:'',campaignType:'campaign',photo:'',soul:'',soulPhoto:'',belovedObjects:'',personality:'',destiny:'',description:'',history:'',playerNotes:'',masterNotes:'',attrBonusPoints:0,skillBonusPoints:0,deityId:'',homeWallpaper:'',musicThemes:[],hp:20,hpMax:35,attack:4,defense:5,status:'Ativo',extra:0,attrs:{...blankAttrs(),Força:3,Agilidade:2,Sanidade:8,Determinação:3,Percepção:2},attrLimits:blankLimits(),skills:{...blankSkills(),'Armas Brancas':2,Esquiva:1},backpack:[],conditions:[],rolls:[],slasherReligion:'',slasherBelief:''}}
const DEFAULT_CLASS_BONUSES={Mercenário:{Força:2,'Tolerância à Dor':3},Ocultista:{Fé:2,Ocultismo:3},Herege:{Determinação:2,Sanidade:2},Guerreiro:{Corpo:2,Determinação:1},Caçador:{Percepção:3,Agilidade:1},'Mago Amarelo':{Fé:2,Determinação:3},Sacerdote:{Fé:3,Conhecimento:2},Atleta:{Agilidade:1,Atletismo:2},'Engenheiro civil':{Conhecimento:1,Investigação:2},Mecânico:{Reflexo:1,Conhecimento:2},'Lutador profissional':{Força:1,Luta:2},Herbalista:{Conhecimento:1,Herbalismo:2},Vigilante:{Percepção:1,Pontaria:2},Médico:{Conhecimento:1,Medicina:2}};
function classBonusMap(name){const overrides=state?.classBonuses||{};return overrides[name]||DEFAULT_CLASS_BONUSES[name]||{}}
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
function defaultTvScreen(){return {active:false,kind:'black',url:'',title:'',loop:false,commandAt:0,updatedAt:0}}
function normalizeTvScreen(){state.tvScreen={...defaultTvScreen(),...(state.tvScreen||{})};}
function normalizeTerrorMode(){state.terrorMode={...defaultTerrorMode(),...(state.terrorMode||{})}}

const DEFAULT={version:1.0,siteBrand:{name:'A Profecia',image:'runa-gold.png'},session:null,characterRules:clone(DEFAULT_RULES),classBonuses:clone(DEFAULT_CLASS_BONUSES),music:{type:'',url:'',title:'',kind:'url',mediaId:''},musicLibrary:[],slasherIntroMusic:{url:'',title:'',kind:'url'},sounds:[],players:[],creatures:[],items:DEFAULT_ITEMS,spells:INITIAL_SPELLS,uiIcons:{attrs:{...DEFAULT_ATTR_ICONS},skills:{...DEFAULT_SKILL_ICONS},conditions:{}},backgrounds:{},customContent:{attrs:[],skills:[],conditions:[],deities:[]},combatSession:defaultCombatSession(),terrorMode:defaultTerrorMode(),nexus:{active:false,title:'Nexus Tabletop',url:'',updatedAt:0},tvScreen:defaultTvScreen(),tvScenes:[],soundboard:{volume:0.85,enabled:true},secretClues:[]};
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
async function getLocalRecoveries(){try{const db=await stateBackupOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction(STATE_BACKUP_STORE,'readonly'),req=tx.objectStore(STATE_BACKUP_STORE).getAll();req.onsuccess=()=>{db.close();resolve((req.result||[]).sort((a,b)=>b.createdAt-a.createdAt))};req.onerror=()=>{db.close();reject(req.error)}})}catch{return []}}
async function restoreLocalRecovery(){const list=await getLocalRecoveries();if(list.length<2&&list.length<1)throw new Error('Nenhum backup local encontrado');const snap=list[0];await saveLocalRecovery('antes-da-restauracao');state=clone(snap.state);state.items=migrateItems(state.items);storageSet(KEY,serializeState());if(remoteEnabled){try{const old=await fetchGlobal();if(old?.data)await backupGlobal(old.data,'antes-da-restauracao-local');await pushGlobal(globalPayload())}catch(e){console.warn('Falha ao enviar restauração ao Supabase:',e)}}render(currentView||'home');toast(`Backup restaurado: ${new Date(snap.createdAt).toLocaleString('pt-BR')}`)}
function localRichness(s){if(!s)return 0;const arr=k=>Array.isArray(s[k])?s[k].length:0;const obj=k=>s[k]&&typeof s[k]==='object'?Object.keys(s[k]).length:0;const cc=s.customContent||{};return arr('players')*100+arr('creatures')*70+arr('items')*3+arr('spells')*2+arr('sounds')*5+arr('musicLibrary')*6+arr('tvScenes')*10+obj('backgrounds')*15+obj('uiIcons')*2+Object.values(cc).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0)*8+(s.combatSession?.history?.length||0)*4+(s.combatSession?.participants?.length||0)*3}
function mergePreferRicherLocal(remote){if(!remote)return false;const before=clone(state);const localScore=localRichness(before),remoteState={...remote};const remoteScore=localRichness(remoteState);if(localScore<=remoteScore)return false;const arrays=['players','creatures','items','spells','sounds','tvScenes'];for(const k of arrays){if(Array.isArray(before[k])&&Array.isArray(remoteState[k])&&before[k].length>remoteState[k].length)remoteState[k]=before[k]}for(const k of ['backgrounds','uiIcons','customContent']){if(before[k]&&remoteState[k]&&Object.keys(before[k]).length>Object.keys(remoteState[k]).length)remoteState[k]=before[k]}mergeGlobal(remoteState);return true}

function storageGet(key){try{return localStorage.getItem(key)}catch{return memoryStore[key]??null}}
function storageSet(key,value){try{localStorage.setItem(key,value)}catch{memoryStore[key]=value}}
const SESSION_CACHE_KEY='a_profecia_session_v3';
// V65.9: sessão POR ABA (sessionStorage). O localStorage é compartilhado entre todas as abas do mesmo
// navegador; sem isto, sair/entrar em uma aba trocava a sessão de outra aba no próximo recarregamento.
const SESSION_TAB_KEY='a_profecia_session_tab_v1';
function tabSessionGet(){try{const t=sessionStorage.getItem(SESSION_TAB_KEY);if(t){const v=JSON.parse(t);if(v?.role)return v}}catch{}return null}
function readStoredSession(){const t=tabSessionGet();if(t)return t;try{const c=JSON.parse(storageGet(SESSION_CACHE_KEY)||'null');if(c?.role)return c}catch{}return null}
function clearSessionCache(){try{localStorage.removeItem(SESSION_CACHE_KEY)}catch{}try{delete memoryStore[SESSION_CACHE_KEY]}catch{}try{sessionStorage.removeItem(SESSION_TAB_KEY)}catch{}}
// V65.9: só o Mestre escreve o estado global. Esta marca guarda "existe alteração do Mestre que ainda não chegou ao servidor".
const GLOBAL_DIRTY_KEY='a_profecia_global_dirty_v1';
function markGlobalDirty(){const t=Date.now();storageSet(GLOBAL_DIRTY_KEY,String(t));return t}
function clearGlobalDirty(stamp){if(Number(storageGet(GLOBAL_DIRTY_KEY)||0)<=stamp)storageSet(GLOBAL_DIRTY_KEY,'0')}
function globalDirty(){return Number(storageGet(GLOBAL_DIRTY_KEY)||0)>0}
const MEDIA_CACHE_KEY='a_profecia_critical_media_v3';
// V65.8: lembra em qual aba o usuário estava dentro desta mesma aba do
// navegador (sessionStorage), para que um reload/retomada da aba (comum no
// celular ao trocar de app) não jogue o Player de volta para "Informações
// básicas" no meio de uma sessão de jogo.
const VIEW_CACHE_KEY='a_profecia_view_v1';
function viewCacheGet(){try{return sessionStorage.getItem(VIEW_CACHE_KEY)||''}catch{return ''}}
function viewCacheSet(view){try{sessionStorage.setItem(VIEW_CACHE_KEY,String(view||''))}catch{}}
function imageValue(v){return typeof v==='string'&&v.trim()?v.trim():''}
function criticalMediaSnapshot(s){
  const out={siteBrand:{image:imageValue(s?.siteBrand?.image)},backgrounds:{},spells:{},uiIcons:{attrs:{},skills:{},conditions:{}},deities:{},players:{}};
  for(const [k,v] of Object.entries(s?.backgrounds||{})) if(v) out.backgrounds[k]={...v,url:imageValue(v.url),mediaId:v.mediaId||'',updatedAt:Number(v.updatedAt)||0};
  for(const sp of (Array.isArray(s?.spells)?s.spells:[])) if(sp?.id) out.spells[String(sp.id)]={image:imageValue(sp.image)};
  for(const group of ['attrs','skills','conditions']) for(const [k,v] of Object.entries(s?.uiIcons?.[group]||{})) if(imageValue(v)) out.uiIcons[group][k]=v;
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
  state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};for(const g of ['attrs','skills','conditions']){state.uiIcons[g]=state.uiIcons[g]||{};for(const [k,v] of Object.entries(cache.uiIcons?.[g]||{}))if(!imageValue(state.uiIcons[g][k])&&imageValue(v)){state.uiIcons[g][k]=v;changed=true}}
  state.customContent=state.customContent||{attrs:[],skills:[],conditions:[],deities:[]};state.customContent.deities=Array.isArray(state.customContent.deities)?state.customContent.deities:[];for(const d of state.customContent.deities){const c=cache.deities?.[String(d.id)];if(c&&!imageValue(d.image)&&imageValue(c.image)){d.image=c.image;changed=true}}
  for(const pl of (state.players||[])){const c=cache.players?.[String(pl.id)];if(!c)continue;for(const k of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(pl[k])&&imageValue(c[k])){pl[k]=c[k];changed=true}}
  return changed;
}
// V65.5: estado visual crítico possui cache independente do estado global.
// Uma resposta remota incompleta nunca deve apagar uma imagem que já foi salva localmente.
// V65: não substitui o estado vivo por uma cópia antiga de outra aba.
// O Supabase é a fonte de sincronização entre dispositivos/abas.
function clone(v){return JSON.parse(JSON.stringify(v))}
// V65.9: 'state' precisa existir ANTES de load() rodar. load() chama normalize() -> derivedMax() -> characterRules(),
// que lê 'state'. Antes isso lançava ReferenceError (zona morta do let); o catch de load() devolvia o estado PADRÃO
// e o app perdia a sessão e o estado local a cada recarga da página (=> voltava para o login).
let state=clone(DEFAULT);
state=load();
let lastPlayersSnapshot=clone(state.players||[]);
function load(){try{const raw=storageGet(KEY)||storageGet('filii_abyssi_state_v10')||storageGet('filii_abyssi_state_v8');const saved=raw?JSON.parse(raw):null;if(!saved){const fresh=clone(DEFAULT);try{const cs=readStoredSession();if(cs?.role)fresh.session={role:cs.role,login:cs.login||'',playerId:cs.playerId||'',playerSnapshot:cs.playerSnapshot||null}}catch{}try{const cm=JSON.parse(storageGet(MEDIA_CACHE_KEY)||'null');mergeCriticalCacheIntoState(cm,fresh)}catch{}return fresh;}try{const tabS=tabSessionGet(),cs=tabS||(!saved.session?readStoredSession():null);if(cs?.role)saved.session={role:cs.role,login:cs.login||'',playerId:cs.playerId||'',playerSnapshot:cs.playerSnapshot||null}}catch{};try{const cachedMedia=storageGet(MEDIA_CACHE_KEY);if(cachedMedia)saved.__criticalMediaCache=JSON.parse(cachedMedia)}catch{};saved.siteBrand={name:'A Profecia',image:'runa-gold.png',...(saved.siteBrand||{})};saved.siteBrand.name=String(saved.siteBrand.name||'A Profecia').trim()||'A Profecia';saved.siteBrand.image=saved.siteBrand.image||'runa-gold.png';saved.characterRules={campaign:{...DEFAULT_RULES.campaign,...(saved.characterRules?.campaign||{})},slasher:{...DEFAULT_RULES.slasher,...(saved.characterRules?.slasher||{})}};saved.classBonuses={...clone(DEFAULT_CLASS_BONUSES),...(saved.classBonuses||{})};saved.items=migrateItems(saved.items);saved.players=Array.isArray(saved.players)?saved.players:[];saved.playerTombstones=saved.playerTombstones&&typeof saved.playerTombstones==='object'?saved.playerTombstones:{};saved.creatures=Array.isArray(saved.creatures)?saved.creatures:[];saved.sounds=Array.isArray(saved.sounds)?saved.sounds:[];saved.musicLibrary=Array.isArray(saved.musicLibrary)?saved.musicLibrary:[];if(saved.music?.url&&!saved.musicLibrary.some(x=>String(x.url)===String(saved.music.url)))saved.musicLibrary.unshift({id:saved.music.mediaId||`music-${Date.now()}`,title:saved.music.title||'Trilha da campanha',url:saved.music.url,kind:saved.music.kind||'url',createdAt:Number(saved.music.commandAt)||Date.now()});saved.spells=Array.isArray(saved.spells)&&saved.spells.length?saved.spells:INITIAL_SPELLS.map(clone);saved.uiIcons=saved.uiIcons||{attrs:{},skills:{}};saved.uiIcons.attrs={...DEFAULT_ATTR_ICONS,...(saved.uiIcons.attrs||{})};saved.uiIcons.skills={...DEFAULT_SKILL_ICONS,...(saved.uiIcons.skills||{})};saved.uiIcons.conditions={...(saved.uiIcons.conditions||{})};saved.backgrounds={...(saved.backgrounds||{})};saved.customContent={attrs:[],skills:[],conditions:[],deities:[],...(saved.customContent||{})};saved.combatSession={...defaultCombatSession(),...(saved.combatSession||{})};saved.combatSession.sessionId=String(saved.combatSession.sessionId||'')||cryptoRandomId('combat');saved.combatSession.round=Math.max(1,Number(saved.combatSession.round)||1);saved.combatSession.turn=Math.max(0,Number(saved.combatSession.turn)||0);saved.combatSession.participants=Array.isArray(saved.combatSession.participants)?saved.combatSession.participants:[];saved.combatSession.actedKeys=Array.isArray(saved.combatSession.actedKeys)?saved.combatSession.actedKeys.map(String):[];saved.combatSession.history=Array.isArray(saved.combatSession.history)?saved.combatSession.history:[];saved.terrorMode={...defaultTerrorMode(),...(saved.terrorMode||{})};saved.nexus={active:false,title:'Nexus Tabletop',url:'',...(saved.nexus||{})};saved.tvScreen={...defaultTvScreen(),...(saved.tvScreen||{})};saved.tvScenes=Array.isArray(saved.tvScenes)?saved.tvScenes:[];saved.soundboard={volume:.85,enabled:true,...(saved.soundboard||{})};saved.secretClues=Array.isArray(saved.secretClues)?saved.secretClues:[];if(typeof saved.music==='string')saved.music={type:'audio',url:saved.music,title:'Trilha da sessão'};saved.music=saved.music||{type:'',url:'',title:'',kind:'url',mediaId:''};saved.slasherIntroMusic=saved.slasherIntroMusic||{url:'',title:'',kind:'url'};if(typeof saved.music==='object'){saved.music.kind=saved.music.kind||'url';saved.music.mediaId=saved.music.mediaId||''}delete saved.sessionBoard;state=saved;saved.players.forEach(p=>{p.musicThemes=Array.isArray(p.musicThemes)?p.musicThemes:[];p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];p.homeWallpaper=p.homeWallpaper||'';normalize(p)});mergeCriticalCacheIntoState(saved.__criticalMediaCache,saved);delete saved.__criticalMediaCache;saved.version=1.0;return saved}catch(e){console.error('[A Profecia] load() falhou; usando estado padrão:',e);loadFailed=true;try{const raw=storageGet(KEY);if(raw&&!storageGet(KEY+'_backup_loadfail'))storageSet(KEY+'_backup_loadfail',raw)}catch{}return clone(DEFAULT)}}
let remoteSaveTimer=null,remoteHydrated=false,remoteApplying=false;
let playerDbTimer=null,playerDbHydrated=false,playerDbApplying=false;
let playerDbUnsubscribe=null;
let playerDbSyncBusy=false;
function globalPayload(){
  const {session,sounds,players,playerTombstones,...shared}=state;
  const payload={version:shared.version,siteBrand:shared.siteBrand,creatures:shared.creatures,items:slimItems(shared.items),spells:shared.spells,uiIcons:shared.uiIcons,backgrounds:shared.backgrounds,music:shared.music,musicLibrary:shared.musicLibrary||[],slasherIntroMusic:shared.slasherIntroMusic,characterRules:shared.characterRules,classBonuses:shared.classBonuses,customContent:shared.customContent,combatSession:shared.combatSession,terrorMode:shared.terrorMode,nexus:shared.nexus,tvScreen:shared.tvScreen,tvScenes:shared.tvScenes,sounds:shared.sounds,soundboard:shared.soundboard};
  // Fallback temporário: se o banco de Players ainda não foi criado ou ficou
  // indisponível, mantém o formato antigo para que o site continue funcionando.
  if(!playerStoreEnabled||!playerDbHydrated){payload.players=players;payload.playerTombstones=playerTombstones||{}}
  return payload;
}

function sameGlobalValue(a,b){
  if(a===b)return true;
  try{return JSON.stringify(a)===JSON.stringify(b)}catch{return false}
}
function playerSyncKey(p){return String(p?.id||p?.login||'').trim()}
function markLocalPlayerChanges(){
  state.playerTombstones=state.playerTombstones&&typeof state.playerTombstones==='object'?state.playerTombstones:{};
  const previous=new Map((lastPlayersSnapshot||[]).map(p=>[playerSyncKey(p),p]));
  const current=new Map((state.players||[]).map(p=>[playerSyncKey(p),p]));
  const now=Date.now();
  for(const [key,p] of current){
    if(!key)continue;
    const old=previous.get(key);
    if(!old||!sameGlobalValue({...old,_syncUpdatedAt:0},{...p,_syncUpdatedAt:0})) p._syncUpdatedAt=Math.max(Number(p._syncUpdatedAt)||0,now);
    delete state.playerTombstones[key];
  }
  for(const [key,old] of previous){
    if(key&&!current.has(key)) state.playerTombstones[key]=Math.max(Number(state.playerTombstones[key])||0,Number(old?._syncUpdatedAt)||now);
  }
  lastPlayersSnapshot=clone(state.players||[]);
}
function mergePlayersRemote(remotePlayers,remoteTombstones){
  const local=Array.isArray(state.players)?state.players:[];
  const remote=Array.isArray(remotePlayers)?remotePlayers:[];
  const merged=new Map();
  for(const p of local){const k=playerSyncKey(p);if(k)merged.set(k,clone(p));}
  for(const p of remote){const k=playerSyncKey(p);if(!k)continue;const l=merged.get(k);if(!l){merged.set(k,clone(p));continue}const lt=Number(l._syncUpdatedAt)||0,rt=Number(p._syncUpdatedAt)||0;if(rt>=lt)merged.set(k,clone(p));}
  const tomb={...(state.playerTombstones||{})};
  for(const [k,v] of Object.entries(remoteTombstones||{})) tomb[k]=Math.max(Number(tomb[k])||0,Number(v)||0);
  for(const [k,t] of Object.entries(tomb)){
    const p=merged.get(k);if(p&&(Number(t)||0)>=(Number(p._syncUpdatedAt)||0))merged.delete(k);
  }
  const before=JSON.stringify(state.players||[]);state.players=[...merged.values()];state.playerTombstones=tomb;
  
  state.players.forEach(normalize);
  lastPlayersSnapshot=clone(state.players);
  return before!==JSON.stringify(state.players);
}
function mergeGlobal(remote){
  if(!remote||typeof remote!=='object')return {changed:false,domains:[]};
  const localSession=state.session;
  const keepLocalGlobal=localSession?.role==='master'&&globalDirty();
  const domains=[];
  if((!playerStoreEnabled||!playerDbHydrated)&&remote.players!==undefined){if(mergePlayersRemote(remote.players,remote.playerTombstones))domains.push('players')}
  for(const key of ['siteBrand','creatures','items','spells','uiIcons','backgrounds','music','musicLibrary','slasherIntroMusic','characterRules','classBonuses','customContent','combatSession','terrorMode','nexus','tvScreen','tvScenes','sounds','soundboard']){
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
      next=next||{};const local=state.uiIcons||{};for(const g of ['attrs','skills','conditions']){next[g]={...(next[g]||{})};for(const [k,v] of Object.entries(local[g]||{}))if(!imageValue(next[g][k])&&imageValue(v))next[g][k]=v;}
    }
    if(key==='customContent'){
      next={attrs:[],skills:[],conditions:[],deities:[],...(next||{})};const local=state.customContent||{};const localD=new Map((local.deities||[]).map(x=>[String(x.id),x]));next.deities=(next.deities||[]).map(d=>{const l=localD.get(String(d.id));if(l&&!imageValue(d.image)&&imageValue(l.image))d.image=l.image;return d});for(const l of (local.deities||[]))if(!next.deities.some(d=>String(d.id)===String(l.id)))next.deities.push(clone(l));
    }
    if(['combatSession','terrorMode','tvScreen','nexus'].includes(key)){
      // V66.6: estes objetos representam "o estado ao vivo da mesa" (turno atual, modo terror, tela da tv).
      // Antes, uma atualização remota atrasada (rede instável) podia sobrescrever uma mudança local mais
      // recente só porque chegou depois pelo tempo real — isso fazia "Avançar turno" voltar sempre para o
      // primeiro participante. Agora só aceitamos a versão remota se ela for igual ou mais nova.
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
    state.siteBrand={name:'A Profecia',image:'runa-gold.png',...(state.siteBrand||{})};state.siteBrand.name=String(state.siteBrand.name||'A Profecia').trim()||'A Profecia';state.siteBrand.image=state.siteBrand.image||'runa-gold.png';state.items=migrateItems(state.items);
    state.players=Array.isArray(state.players)?state.players:[];state.playerTombstones=state.playerTombstones&&typeof state.playerTombstones==='object'?state.playerTombstones:{};
    
    state.creatures=Array.isArray(state.creatures)?state.creatures:[];
    state.spells=Array.isArray(state.spells)&&state.spells.length?state.spells:INITIAL_SPELLS.map(clone);
    state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};
    state.uiIcons.attrs={...DEFAULT_ATTR_ICONS,...(state.uiIcons.attrs||{})};
    state.uiIcons.skills={...DEFAULT_SKILL_ICONS,...(state.uiIcons.skills||{})};
    state.uiIcons.conditions={...(state.uiIcons.conditions||{})};
    state.backgrounds={...(state.backgrounds||{})};state.tvScreen={...defaultTvScreen(),...(state.tvScreen||{})};state.tvScenes=Array.isArray(state.tvScenes)?state.tvScenes:[];state.slasherIntroMusic=state.slasherIntroMusic||{url:'',title:'',kind:'url'};state.customContent={attrs:[],skills:[],conditions:[],deities:[],...(state.customContent||{})};
    state.characterRules={campaign:{...DEFAULT_RULES.campaign,...(state.characterRules?.campaign||{})},slasher:{...DEFAULT_RULES.slasher,...(state.characterRules?.slasher||{})}};state.classBonuses={...clone(DEFAULT_CLASS_BONUSES),...(state.classBonuses||{})};normalizeCombatSession();normalizeTerrorMode();state.nexus={active:false,title:'Nexus Tabletop',url:'',...(state.nexus||{})};state.soundboard={volume:.85,enabled:true,...(state.soundboard||{})};state.sounds=Array.isArray(state.sounds)?state.sounds:[];
    state.players.forEach(p=>{p.musicThemes=Array.isArray(p.musicThemes)?p.musicThemes:[];p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];p.homeWallpaper=p.homeWallpaper||'';normalize(p)});
    state.musicLibrary=Array.isArray(state.musicLibrary)?state.musicLibrary:[];
    state.creatures.forEach(normalize);
    state.version=1.0;
  }
  return {changed:domains.length>0,domains};
}
function hasRemoteSharedData(remote){
  return !!(remote&&typeof remote==='object'&&['siteBrand','players','playerTombstones','creatures','items','spells','uiIcons','backgrounds','music','musicLibrary','slasherIntroMusic','characterRules','classBonuses','customContent','combatSession','terrorMode','nexus','tvScreen','tvScenes','sounds','soundboard'].some(k=>remote[k]!==undefined));
}
function playerRowStamp(row){return Date.parse(row?.updated_at||'')||Number(row?.data?._syncUpdatedAt)||0}
function playerRowDeletedStamp(row){return Date.parse(row?.deleted_at||'')||0}
function applyPlayerRows(rows,{initial=false}={}){
  const local=Array.isArray(state.players)?state.players:[];
  const byId=new Map(local.map(p=>[playerSyncKey(p),p]));
  const tomb={...(state.playerTombstones||{})};
  for(const row of (Array.isArray(rows)?rows:[])){
    const key=String(row?.id||'').trim(); if(!key)continue;
    const stamp=playerRowStamp(row), deleted=playerRowDeletedStamp(row);
    const localPlayer=byId.get(key), localStamp=Number(localPlayer?._syncUpdatedAt)||0;
    if(deleted&&deleted>=Math.max(stamp,localStamp)){
      byId.delete(key); tomb[key]=Math.max(Number(tomb[key])||0,deleted); continue;
    }
    if(row?.data&&typeof row.data==='object'&&(!localPlayer||stamp>localStamp)){
      const p=clone(row.data);
      if(localPlayer){
        for(const k of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(p[k])&&imageValue(localPlayer[k]))p[k]=localPlayer[k];
        p.rolls=mergeRollHistory(p.rolls||[],localPlayer.rolls||[]);
      }
      p._syncUpdatedAt=Math.max(Number(p._syncUpdatedAt)||0,stamp);byId.set(key,p);delete tomb[key];
    }
  }
  state.players=[...byId.values()];
  for(const [key,t] of Object.entries(tomb)){
    const p=byId.get(key);if(p&&Number(t)>=(Number(p._syncUpdatedAt)||0)){byId.delete(key)}
  }
  state.players=[...byId.values()];
  
  state.players.forEach(normalize);
  state.playerTombstones=tomb;
  lastPlayersSnapshot=clone(state.players);
  return {changed:true,empty:!rows?.length&&initial};
}
async function hydratePlayersDb(){
  if(!playerStoreEnabled)return;
  try{
    const rows=await fetchPlayerRows();
    if(rows.length){
      playerDbApplying=true;applyPlayerRows(rows,{initial:true});playerDbApplying=false;
      persistCriticalCache();persistSessionCache();storageSet(KEY,serializeState());
    }else{
      // Migração inicial: usa o estado local/global existente apenas uma vez.
      const list=Array.isArray(state.players)?state.players:[];
      list.forEach(p=>{if(!p._syncUpdatedAt)p._syncUpdatedAt=Date.now()});
      await upsertPlayers(list);
      playerDbApplying=true;lastPlayersSnapshot=clone(state.players);playerDbApplying=false;
    }
    playerDbHydrated=true;
  }catch(e){
    playerDbHydrated=false;
    console.warn('Banco de Players indisponível; usando recuperação local.',e);
  }
}
async function syncPlayersDbNow(){
  if(!playerStoreEnabled||!playerDbHydrated||playerDbApplying||playerDbSyncBusy)return;
  playerDbSyncBusy=true;
  try{
    const rows=await fetchPlayerRows();
    const remoteById=new Map(rows.map(r=>[String(r.id),r]));
    const localById=new Map((state.players||[]).map(p=>[playerSyncKey(p),p]));
    const toUpsert=[];
    for(const p of [...localById.values()]){
      const k=playerSyncKey(p); if(!k)continue;
      const remote=remoteById.get(k), localStamp=Number(p._syncUpdatedAt)||0, remoteStamp=playerRowStamp(remote);
      if(remote?.deleted_at && remoteStamp>localStamp){
        // A server deletion wins only when it is demonstrably newer than this local copy.
        localById.delete(k);
        state.playerTombstones=state.playerTombstones||{};
        state.playerTombstones[k]=Math.max(Number(state.playerTombstones[k])||0,remoteStamp);
      }else if(!remote){
        // A missing row is NOT a deletion. Recreate it from the local copy.
        p._syncUpdatedAt=localStamp||Date.now();
        toUpsert.push(p);
      }else if(remote.data){
        const rp=clone(remote.data);rp._syncUpdatedAt=Math.max(Number(rp._syncUpdatedAt)||0,remoteStamp);
        const localComparable=clone({...p,_syncUpdatedAt:0});
        const remoteComparable=clone({...rp,_syncUpdatedAt:0});
        if(localStamp>remoteStamp && !sameGlobalValue(localComparable,remoteComparable)){
          p._syncUpdatedAt=localStamp||Date.now();
          toUpsert.push(p);
        }else if(localStamp===remoteStamp && !sameGlobalValue(localComparable,remoteComparable)){
          // Equal timestamps are resolved in favor of the local copy only when it is
          // actually different; advance the stamp so the server can order the change.
          p._syncUpdatedAt=Date.now();
          toUpsert.push(p);
        }else if(remoteStamp>localStamp){
          let changed=false;
          if(Array.isArray(p.rolls)&&p.rolls.length){
            const mergedRolls=mergeRollHistory(rp.rolls||[],p.rolls);
            if(JSON.stringify(mergedRolls)!==JSON.stringify(rp.rolls||[])){rp.rolls=mergedRolls;changed=true;}
          }
          for(const key of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(rp[key])&&imageValue(p[key])){rp[key]=p[key];changed=true;}
          if(changed){rp._syncUpdatedAt=Date.now();localById.set(k,rp);toUpsert.push(rp)}
          else localById.set(k,rp);
        }
      }
    }
    // V65.9: um Player só grava a PRÓPRIA ficha. Antes, cada aparelho reenviava cópias (possivelmente velhas) das
    // fichas de todos os outros Players; o Mestre continua podendo gravar todas.
    const syncRole=state.session?.role,syncActiveId=String(state.session?.playerId||'');
    const canWriteRow=k=>syncRole==='master'||(syncRole==='player'&&!!syncActiveId&&String(k)===syncActiveId);
    const writable=toUpsert.filter(x=>canWriteRow(playerSyncKey(x)));
    if(writable.length)await upsertPlayers(writable);
    const tombRows=[];
    const index=Object.fromEntries((state.players||[]).map(p=>[playerSyncKey(p),p]));
    for(const [k,t] of Object.entries(state.playerTombstones||{})){
      const remote=remoteById.get(k), ts=Number(t)||0, rs=playerRowStamp(remote);
      if(ts>rs)tombRows.push({id:k,login:index[k]?.login||remote?.login||k,data:index[k]||remote?.data||{},_syncUpdatedAt:ts});
    }
    if(tombRows.length&&state.session?.role==='master')await upsertPlayerTombstones(Object.fromEntries(tombRows.map(x=>[x.id,x._syncUpdatedAt])),index);
    const before=JSON.stringify(state.players||[]);
    state.players=[...localById.values()];
    
    state.players.forEach(normalize);lastPlayersSnapshot=clone(state.players);
    if(before!==JSON.stringify(state.players||[]))storageSet(KEY,serializeState());
    // Never log the player out merely because a transient sync response omitted a row.
    // A confirmed deletion is handled by the realtime/delete confirmation path.
  }catch(e){console.warn('Falha ao sincronizar Players:',e)}
  finally{playerDbSyncBusy=false}
}
function queuePlayerDbSave(){
  if(!playerStoreEnabled||!playerDbHydrated||playerDbApplying)return;
  clearTimeout(playerDbTimer);playerDbTimer=setTimeout(()=>syncPlayersDbNow().catch(()=>{}),700);
}
function queueRemoteSave(){
  // V65.9: apenas o Mestre escreve o estado global. Antes, qualquer aba sem sessão de Player (inclusive quem
  // tinha acabado de sair) enviava o próprio estado local por cima do estado do Mestre.
  if(state.session?.role!=='master'||!remoteEnabled)return;
  const stamp=markGlobalDirty();
  if(!remoteHydrated||remoteApplying)return;
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer=setTimeout(async()=>{try{await pushGlobal(globalPayload());clearGlobalDirty(stamp)}catch(e){console.warn('Falha ao sincronizar dados globais:',e)}},500);
}
// V66 (desempenho): save() é chamado a cada tecla/clique. Antes ele serializava o estado inteiro (≈1 MB), gravava no
// localStorage e clonava tudo para o IndexedDB TODA vez, travando o site. Agora as gravações são agrupadas (~300 ms)
// e a cópia de recuperação é limitada; ao fechar/ocultar a página o que estiver pendente é gravado na hora.
function save(){saveDirty=true;const now=Date.now();if(!saveFirstAt)saveFirstAt=now;clearTimeout(saveTimer);saveTimer=setTimeout(()=>flushSave(),Math.max(0,Math.min(300,1500-(now-saveFirstAt))))}
function flushSave(force=false,opts={}){clearTimeout(saveTimer);if(!saveDirty&&!force)return;saveDirty=false;saveFirstAt=0;markLocalPlayerChanges();persistCriticalCache();persistSessionCache();const isPlayer=state.session?.role==='player';if(isPlayer){const current=state.players.find(x=>playerSyncKey(x)===state.session.playerId)||state.players.find(x=>String(x.login||'').toLowerCase()===String(state.session.login||'').toLowerCase());if(current){state.session.playerId=current.id;state.session.playerSnapshot=clone(current)}}storageSet(KEY,serializeState());storageSet('a_profecia_local_changed_at',String(Date.now()));if(!opts.skipRemote){if(state.session?.role==='master')queueRemoteSave();queuePlayerDbSave();saveLocalRecovery('save').catch(()=>{})}}
let globalSaveChain=Promise.resolve();
let pendingGlobalPayload=null;
let pendingGlobalWaiters=[];
let globalSaveRunning=false;

function queueGlobalRemoteSave(payload){
  pendingGlobalPayload=clone(payload);
  return new Promise((resolve,reject)=>{
    pendingGlobalWaiters.push({resolve,reject});
    if(globalSaveRunning)return;
    globalSaveRunning=true;
    globalSaveChain=globalSaveChain.then(async()=>{
      let lastResult=null;
      let lastError=null;
      try{
        while(pendingGlobalPayload){
          const next= pendingGlobalPayload;
          pendingGlobalPayload=null;
          try{
            lastResult=await pushGlobal(next);
          }catch(e){
            lastError=e;
            // Não descarta a alteração que falhou: ela continua pendente para
            // a próxima tentativa explícita, em vez de fingir que foi salva.
            pendingGlobalPayload=next;
            throw e;
          }
        }
        const waiters=pendingGlobalWaiters.splice(0);
        waiters.forEach(w=>w.resolve(lastResult));
      }catch(e){
        const waiters=pendingGlobalWaiters.splice(0);
        waiters.forEach(w=>w.reject(e));
      }finally{
        globalSaveRunning=false;
      }
    });
  });
}

async function saveGlobalNow(){
  flushSave(true,{skipRemote:true});
  queuePlayerDbSave();
  saveLocalRecovery('global-save').catch(()=>{});
  if(state.session?.role!=='master')return null;
  if(!remoteEnabled)return null;
  const stamp=markGlobalDirty();
  // V65.9: em vez de descartar o salvamento em silêncio quando uma sincronização está em andamento,
  // espera ela terminar (até 5s). Se não der, avisa — a alteração fica marcada e é reenviada no próximo carregamento.
  for(let i=0;i<50&&(remoteApplying||!remoteHydrated);i++)await new Promise(r=>setTimeout(r,100));
  if(remoteApplying||!remoteHydrated){toast('Alteração salva neste dispositivo, mas ainda NÃO foi enviada aos outros (sincronização indisponível). Ela será reenviada ao recarregar.');return null}

  const payload=globalPayload();
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
function derivedMax(e,attr){const r=characterRules(e?.campaignType);if(e?.campaignType==='slasher'&&attr==='Corpo')return Math.min(9999,Math.max(Number(r.hpMax)||1,effectiveAttr(e,attr)*9));return Math.min(35,Math.max(0,effectiveAttr(e,attr)*9))}
function syncDerivedResources(e){if(!e)return e;const hpMax=derivedMax(e,'Corpo');const sanityMax=derivedMax(e,'Sanidade');e.hpMax=Math.max(1,hpMax);e.hp=clamp(e.hp??e.hpMax,0,e.hpMax);e.sanityMax=sanityMax;e.sanity=clamp(e.sanity??sanityMax,0,sanityMax);if('login' in e){const c=derivedCombat(e);e.attack=c.atk;e.defense=c.def}return e}
function normalize(e){if(playerStoreEnabled&&e&&'password' in e&&!e.newPassword)delete e.password;if(e&&'login' in e){e.determinationMax=clamp(e.determinationMax??DET_DEFAULT_MAX,0,99);e.determination=clamp(e.determination??e.determinationMax,0,e.determinationMax)}const hpCap=e?.campaignType==='slasher'?9999:35;e.hpMax=clamp(e.hpMax??35,1,hpCap);e.hp=clamp(e.hp??e.hpMax,0,e.hpMax);e.attrLimits=e.attrLimits||blankLimits();e.attrs=e.attrs||blankAttrs();e.skills=e.skills||blankSkills();e.soul=e.soul||'';e.soulPhoto=e.soulPhoto||'';e.belovedObjects=e.belovedObjects||'';e.personality=e.personality||'';e.destiny=e.destiny||'';e.description=e.description||'';e.history=e.history||'';e.conditions=Array.isArray(e.conditions)?e.conditions:[];e.conditionTurns=e.conditionTurns&&typeof e.conditionTurns==='object'?e.conditionTurns:{};initializeConditionTurns(e);e.rolls=mergeRollHistory(Array.isArray(e.rolls)?e.rolls:[],null);allAttrs().forEach(a=>{e.attrLimits[a]=e.attrLimits[a]||{min:0,max:MAX_ATTR};e.attrLimits[a].min=0;e.attrLimits[a].max=MAX_ATTR;e.attrs[a]=clamp(e.attrs[a]??0,0,MAX_ATTR)});allSkills().forEach(sk=>{e.skills[sk]=clamp(e.skills[sk]??0,0,MAX_SKILL)});e.backpack=Array.isArray(e.backpack)?e.backpack:[];e.bookPages=Array.isArray(e.bookPages)?e.bookPages:(e.bookContent?[String(e.bookContent)]:[]);e.backpack.forEach(b=>{b.qty=Math.max(1,Number(b.qty)||1);const it=item(b.id);if(it)b.qty=Math.min(it.maxQty,b.qty)});e.attack=Number(e.attack)||0;e.defense=Number(e.defense)||0;e.status=e.status||'Ativo';e.attrBonusPoints=Math.max(0,Number(e.attrBonusPoints)||0);e.skillBonusPoints=Math.max(0,Number(e.skillBonusPoints)||0);e.campaignType=e.campaignType==='slasher'?'slasher':'campaign';e.slasherReligion=e.slasherReligion==='yes'||e.slasherReligion==='no'?e.slasherReligion:'';e.slasherBelief=['only-self','occult','one-god'].includes(e.slasherBelief)?e.slasherBelief:'';e.initialSpell=e.initialSpell||'';e.personalSpells=Array.isArray(e.personalSpells)?e.personalSpells:[];e.musicThemes=Array.isArray(e.musicThemes)?e.musicThemes:[];e.secretClues=Array.isArray(e.secretClues)?e.secretClues:[];e.turnAlertSound=(e.turnAlertSound&&typeof e.turnAlertSound==='object')?e.turnAlertSound:{url:'',name:'',enabled:false};if(Object.prototype.hasOwnProperty.call(e,'login'))syncDerivedResources(e)}
function cryptoRandomId(prefix='id'){
  try{
    if(globalThis.crypto?.randomUUID)return `${prefix}-${globalThis.crypto.randomUUID()}`;
    const a=new Uint32Array(3);globalThis.crypto?.getRandomValues?.(a);
    return `${prefix}-${Date.now().toString(36)}-${Array.from(a).map(n=>n.toString(36)).join('')}`;
  }catch{return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
}
function mergeRollHistory(existing, ...incoming){
  const list=Array.isArray(existing)?existing:[];
  const all=[...list,...incoming.flatMap(x=>Array.isArray(x)?x:[x])].filter(Boolean);
  const seen=new Set(), unique=[];
  for(const r of all){
    const id=String(r.id||'');
    const key=id||`${r.createdAt||''}|${r.time||''}|${r.die||r.label||''}|${r.value}|${JSON.stringify(r.rawRolls||[])}`;
    if(seen.has(key))continue;
    seen.add(key);unique.push({...r,id:id||cryptoRandomId('roll')});
  }
  unique.sort((x,y)=>(Number(x.createdAt)||0)-(Number(y.createdAt)||0));
  return unique.slice(-30);
}
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
// V65.9: idempotente — o eco do Realtime (ou qualquer atualização de outro Player) não duplica mais a rolagem na tela.
function updateDiceUI(roll){
 const value=document.getElementById('diceResultValue'),die=document.getElementById('diceResultDie'),status=document.getElementById('rollStatus'),history=document.querySelector('.dice-history-v2');
 if(value)value.textContent=String(roll.value);if(die)die.textContent=String(roll.die||roll.label||'DADO');if(status)status.innerHTML=`Resultado: <strong>${esc(rollDisplayText(roll))}</strong> <span class="muted">(${esc(roll.die||roll.label||'d20')})</span>`;
 if(history){const empty=history.querySelector('.empty');if(empty)empty.remove();const rid=String(roll.id||`${roll.createdAt||''}|${roll.time||''}|${roll.value}`);if([...history.querySelectorAll('[data-roll-id]')].some(e=>e.dataset.rollId===rid))return;const entry=document.createElement('div');entry.dataset.rollId=rid;entry.className='roll-entry roll-entry-new';entry.innerHTML=`<strong>${esc(rollDisplayText(roll))}</strong><span>${esc(roll.die||roll.label)}</span><time>${esc(roll.time)}</time>`;history.prepend(entry);while(history.children.length>12)history.lastElementChild?.remove()}
}
async function confirmPlayerDeletion(playerId){
  if(!playerStoreEnabled||!playerId)return false;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const rows=await fetchPlayerRows();
      const row=rows.find(r=>String(r.id)===String(playerId));
      if(row&&!row.deleted_at)return false;
      if(row?.deleted_at)return true;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
  // Network failure is not proof of deletion.
  return false;
}

function toggleCondition(p,id){p.conditions=Array.isArray(p.conditions)?p.conditions:[];const i=p.conditions.indexOf(id);if(i>=0)p.conditions.splice(i,1);else p.conditions.push(id);save();render('sheet')}
function conditionsMarkup(p,master=false){const active=new Set(p.conditions||[]);return `<div class="conditions-grid">${allConditions().map(c=>{const img=state.uiIcons?.conditions?.[c.id]||c.image;const left=conditionTurnsLeft(p,c.id);return `<button type="button" class="condition-chip ${active.has(c.id)?'active':''} ${master?'editable':'readonly'}" data-condition="${c.id}" ${master?'':'disabled'} title="${esc(conditionEffectText(c.id,p))}">${img?`<img class="condition-image" src="${esc(img)}" alt="">`:`<span class="condition-glyph">${esc(c.icon)}</span>`}<span>${esc(c.name)}</span>${active.has(c.id)?`<small>${esc(conditionEffectText(c.id,p))}</small>`:''}</button>`}).join('')}</div>`}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

// ===== V66: helpers de segurança e de caminhos de arquivos =====
// Caminho de arquivo da pasta public/: sempre absoluto. Caminhos relativos (ex.: 'fundo-geral.webp') eram resolvidos
// contra /assets/ (pasta do CSS) quando usados em variáveis CSS, o que gerava os 404 do console.
function assetUrl(v){const t=String(v||'').trim();if(!t)return '';if(/^(https?:|data:image\/|blob:|\/)/i.test(t)||/^[a-z][a-z0-9+.\-]*:/i.test(t))return t;return '/'+t.replace(/^\.?\/+/,'')}
// Só deixa passar URLs de imagem seguras (nada de javascript:, data:text/html, svg embutido etc.).
function safeImgSrc(v,fallback=''){const t=String(v||'').trim();if(!t)return fallback;if(/^https:\/\//i.test(t)||/^http:\/\//i.test(t)||/^blob:/i.test(t)||/^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+\/=]+$/i.test(t)||/^\/(?!\/)[^\s"'<>\\()]*$/.test(t))return t;if(/^[\w.\-\/]+$/.test(t))return '/'+t.replace(/^[.\/]+/,'');return fallback}
function safeHref(v,fallback='#'){const t=String(v||'').trim();if(/^(https?:\/\/|mailto:)/i.test(t))return t;return fallback}
function sha256Hex(str){
  const enc=new TextEncoder().encode(str);
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l=enc.length,padLen=((l+9+63)>>6)<<6,buf=new Uint8Array(padLen);buf.set(enc);buf[l]=0x80;
  const dv=new DataView(buf.buffer);dv.setUint32(padLen-8,Math.floor(l*8/4294967296));dv.setUint32(padLen-4,(l*8)>>>0);
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Uint32Array(64);
  for(let o=0;o<padLen;o+=64){
    for(let i=0;i<16;i++)w[i]=dv.getUint32(o+i*4);
    for(let i=16;i<64;i++){const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}
    let [a,b,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=rotr(a,2)^rotr(a,13)^rotr(a,22),mj=(a&b)^(a&c)^(b&c),t2=(S0+mj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  return H.map(x=>x.toString(16).padStart(8,'0')).join('');
}
async function masterPasswordOk(pw){
  const input='a-profecia|'+MASTER.login+'|'+String(pw||'');
  let hex='';
  try{
    if(globalThis.crypto?.subtle){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
  }catch{}
  if(!hex)hex=sha256Hex(input);
  return hex===MASTER.passwordHash;
}
function toast(msg){const x=document.createElement('div');x.className='toast';x.textContent=msg;document.getElementById('toast-root').appendChild(x);setTimeout(()=>x.remove(),2400)}
// V65.10: iOS Safari não implementa a Vibration API (navigator.vibrate não existe lá);
// em Android/Chrome funciona normalmente. Por isso isso é só um "bônus" silencioso —
// nunca deve travar nada nos aparelhos que não suportam.
function vibratePhone(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern)}catch{}}
// V65.11: alerta sonoro de "sua vez"/"perdeu vida" — pensado pra iPhone, que não
// tem Vibration API. iOS só deixa tocar áudio "programaticamente" (sem o dedo
// direto no botão) se ALGUM elemento de áudio já tiver sido tocado por um toque
// real antes; por isso "destravamos" um <audio> reaproveitável no primeiro toque
// em qualquer lugar da página, e é ELE que toca o alerta depois, quando chegar
// a vez pela sincronização em segundo plano.
let turnAlertAudioEl=null;
function unlockTurnAlertAudioOnce(){
  if(turnAlertAudioEl)return;
  turnAlertAudioEl=new Audio();
  turnAlertAudioEl.muted=true;
  turnAlertAudioEl.play().catch(()=>{}).finally(()=>{turnAlertAudioEl.pause();turnAlertAudioEl.muted=false});
}
document.addEventListener('pointerdown',unlockTurnAlertAudioOnce,{once:true});
document.addEventListener('keydown',unlockTurnAlertAudioOnce,{once:true});
function playTurnAlertSound(){
  const p=player();const cfg=p?.turnAlertSound;
  if(!cfg?.enabled||!cfg?.url)return;
  try{
    const el=turnAlertAudioEl||new Audio();
    el.src=cfg.url;el.currentTime=0;el.play().catch(()=>{});
  }catch{}
}

function player(){
  const loginName=String(state.session?.login||'').trim().toLowerCase();
  return state.players.find(p=>String(p.login||'').trim().toLowerCase()===loginName)||state.session?.playerSnapshot||null;
}
function item(id){try{const source=typeof state!=='undefined'?state:null;return source?.items?.find(i=>i.id===Number(id))}catch{return undefined}}
function bagWeight(p){return (p?.backpack||[]).reduce((sum,b)=>{const it=item(b.id);return sum+(it?inferWeight(it)*Math.max(0,Number(b.qty)||0):0)},0)}
function itemIcon(i){const icon=i?.icon||'✦';if(icon.startsWith('asset:')){const map={weapon:'/icon-weapon.png',key:'/icon-key.png',food:'/icon-food.png',book:'/icon-book.png'};return map[icon.slice(6)]?`<img src="${map[icon.slice(6)]}" alt="" class="item-image-icon">`:esc(icon)}return esc(icon)}
function imageFileToDataURL(file,maxSize=700,quality=.82){return new Promise((resolve,reject)=>{if(!file||!file.type.startsWith('image/')){reject(new Error('Imagem inválida'));return}const reader=new FileReader();reader.onerror=()=>reject(new Error('Não foi possível ler a imagem'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Imagem inválida'));img.onload=()=>{const ratio=Math.min(1,maxSize/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*ratio)),h=Math.max(1,Math.round(img.height*ratio));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);let out=canvas.toDataURL('image/webp',quality);if(out.length>900000)out=canvas.toDataURL('image/jpeg',.72);resolve(out)};img.src=reader.result};reader.readAsDataURL(file)})}
async function imageFileToRemoteURL(file,path,maxSize=900,quality=.82){
  if(!remoteEnabled) return imageFileToDataURL(file,maxSize,quality);
  if(!file||!file.type.startsWith('image/')) throw new Error('Imagem inválida');
  const blob=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Não foi possível ler a imagem'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Imagem inválida'));
      img.onload=()=>{
        const ratio=Math.min(1,maxSize/Math.max(img.width,img.height));
        const w=Math.max(1,Math.round(img.width*ratio)),h=Math.max(1,Math.round(img.height*ratio));
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
        canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível preparar a imagem')),'image/webp',quality);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
  const safePath=String(path||`images/${Date.now()}.webp`).replace(/\\/g,'/');
  return uploadGlobalFile(safePath, new File([blob], 'image.webp', {type:'image/webp'}));
}
async function saveMasterGlobalAndRefresh(message='Alteração salva e sincronizada.'){
  await saveGlobalNow();
  toast(message);
}

function spotifyEmbed(url){try{const raw=String(url||'').trim();if(!raw)return '';if(raw.startsWith('spotify:')){const bits=raw.split(':').filter(Boolean);if(bits.length>=3&&['track','album','playlist','artist','show','episode'].includes(bits[1]))return `https://open.spotify.com/embed/${encodeURIComponent(bits[1])}/${encodeURIComponent(bits[2])}?utm_source=generator&theme=0`;return ''}const u=new URL(raw);const host=u.hostname.toLowerCase();if(!host.endsWith('spotify.com'))return '';const parts=u.pathname.split('/').filter(Boolean);const types=['track','album','playlist','artist','show','episode'];const index=parts.findIndex(x=>types.includes(x.toLowerCase()));if(index<0||!parts[index+1])return '';const type=parts[index].toLowerCase(),id=parts[index+1].split('?')[0];if(!/^[A-Za-z0-9_-]+$/.test(id))return '';return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`}catch{return ''}}
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
    spotifyPlayer=new SDK.Player({name:`A Profecia • ${state.session?.role==='master'?'Mestre':'Player'}`,volume:.8,getOAuthToken:async cb=>cb(await spotifyToken())});
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
// V41: player de áudio desacoplado da renderização. O elemento Audio é único
// durante toda a sessão, evitando recriações, downloads e picos de memória no mobile.
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
function spotifyHomePanel(){const m=state.music||{};if(m.type!=='spotify'||!m.url)return '';return `<section class="home-panel spotify-home-panel"><div class="section-kicker">TRILHA SPOTIFY</div><h2>${esc(m.title||'Trilha da campanha')}</h2><p>Conecte sua própria conta Spotify para reproduzir a trilha no seu navegador. A escolha da trilha continua sob controle do Mestre.</p><div class="row">${spotifyLogged()?`<button class="btn gold" id="spotifyHomePlay">▶ Reproduzir</button><button class="btn" id="spotifyHomePause">Ⅱ Pausar</button>`:`<button class="btn gold" id="spotifyHomeLogin">Entrar com Spotify</button>`}<a class="btn ghost" href="${esc(m.url)}" target="_blank" rel="noopener">Abrir</a></div></section>`}
function siteBrand(){const b=state?.siteBrand||{};return {name:String(b.name||'A Profecia').trim()||'A Profecia',image:safeImgSrc(assetUrl(b.image||'runa-gold.png'),'/runa-gold.png')}}
function applySiteBrand(){const b=siteBrand();document.title=b.name;const meta=document.querySelector('meta[name=description]');if(meta)meta.setAttribute('content',`${b.name} — sistema de RPG sombrio.`);}
function openPersonalSpellEditor(p,id=null,view='sheet'){
  const list=normalizePersonalSpells(p), existing=id?list.find(x=>String(x.id)===String(id)):null;
  const s=existing?clone(existing):{id:`personal-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:'',school:'Magia pessoal',cost:'',description:'',image:''};
  openModal(`<div class="modal" id="personalSpellModal"><div class="modal-card"><button class="modal-close" id="closePersonalSpell">×</button><span class="badge">GRIMÓRIO PESSOAL</span><h2>${existing?'Editar magia':'Criar magia pessoal'}</h2>
  <div class="field"><label>Nome</label><input id="psName" value="${esc(s.name)}" placeholder="Nome da magia"></div>
  <div class="input-grid"><div class="field"><label>Escola / tipo</label><input id="psSchool" value="${esc(s.school)}"></div><div class="field"><label>Custo</label><input id="psCost" value="${esc(s.cost)}" placeholder="Ex.: 5 Mente"></div></div>
  <div class="field"><label>Descrição / efeito</label><textarea id="psDesc" rows="6">${esc(s.description)}</textarea></div>
  <div class="field"><label>Imagem (URL opcional)</label><input id="psImage" value="${esc(s.image||'')}" placeholder="https://..."></div>
  <div class="row" style="justify-content:flex-end"><button class="btn" id="cancelPersonalSpell">Cancelar</button><button class="btn gold" id="savePersonalSpell">Salvar magia</button></div></div></div>`);
  const close=()=>document.getElementById('personalSpellModal')?.remove();
  document.getElementById('closePersonalSpell').onclick=close;document.getElementById('cancelPersonalSpell').onclick=close;
  document.getElementById('savePersonalSpell').onclick=()=>{
    const next={...s,name:document.getElementById('psName').value.trim(),school:document.getElementById('psSchool').value.trim()||'Magia pessoal',cost:document.getElementById('psCost').value.trim(),description:document.getElementById('psDesc').value.trim(),image:document.getElementById('psImage').value.trim()};
    if(!next.name){toast('Informe o nome da magia.');return}
    const i=list.findIndex(x=>String(x.id)===String(next.id));if(i>=0)list[i]=next;else list.push(next);
    save();close();toast(existing?'Magia pessoal atualizada.':'Magia pessoal criada.');render(view);
  };
}
function spellCost(sp){const m=String(sp?.cost||'').match(/(-?\d+(?:[.,]\d+)?)/);return m?Math.max(0,Number(String(m[1]).replace(',','.'))):0}
function normalizePersonalSpells(p){
  if(!p)return [];
  p.personalSpells=Array.isArray(p.personalSpells)?p.personalSpells:[];
  return p.personalSpells;
}
function getAvailableSpells(p){
  const bank=getSpells();
  const personal=normalizePersonalSpells(p);
  const byId=new Map(bank.map(s=>[String(s.id),s]));
  return [...bank.filter(s=>personal.some(x=>String(x.id)===String(s.id))),...personal.filter(s=>!byId.has(String(s.id)))];
}
function spellByPlayer(p,id){
  return getAvailableSpells(p).find(s=>String(s.id)===String(id));
}
function personalSpellCard(sp,action='use'){
  return `<div class="personal-spell-card"><div class="spell-player-art">${sp.image?`<img src="${esc(sp.image)}" alt="">`:'✦'}</div><div class="spell-player-copy"><strong>${esc(sp.name)}</strong><span>${esc(sp.school||'Magia pessoal')}</span><small>${esc(sp.description||'')}</small><b>${spellCost(sp)>0?`${spellCost(sp)} Sanidade`:'Sem custo'}</b><div class="row" style="margin-top:6px">${action==='use'?`<button type="button" class="btn small gold" data-use-spell="${esc(sp.id)}">Usar</button>`:''}<button type="button" class="btn small" data-edit-personal-spell="${esc(sp.id)}">Editar</button><button type="button" class="btn small danger" data-delete-personal-spell="${esc(sp.id)}">Excluir</button></div></div></div>`;
}
function playerSpellPanel(p){
  const personal=normalizePersonalSpells(p), available=getAvailableSpells(p);
  return `<article class="sheet-card spell-sheet-card"><div class="section-heading"><div><span class="section-kicker">MAGIAS PESSOAIS</span><h2>Meu grimório</h2></div><span class="corner-mark">${available.length} conhecidas</span></div>
  <p class="small muted">Magias concedidas pelo Mestre aparecem aqui junto das suas magias pessoais. Você pode criar suas próprias magias para a campanha.</p>
  <div class="row" style="margin:10px 0"><button type="button" class="btn gold" id="newPersonalSpell">＋ Criar magia pessoal</button></div>
  <div class="spell-player-grid">${available.length?available.map(s=>personalSpellCard(s,personal.some(x=>String(x.id)===String(s.id))?'use':'use')).join(''):'<div class="empty">Nenhuma magia concedida ainda.</div>'}</div>
  ${personal.length?`<div class="section-heading" style="margin-top:18px"><div><span class="section-kicker">CRIADAS POR VOCÊ</span><h3>Magias personalizadas</h3></div></div><div class="spell-player-grid">${personal.map(s=>personalSpellCard(s)).join('')}</div>`:''}
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

function shell(content,active='home'){const brand=siteBrand();const master=state.session?.role==='master';const libraryActive=active==='library';const diaryActive=active==='diary';const nexusActive=active==='nexus';return `<div class="shell ${master?'shell-master':''}"><header class="topbar"><div class="topbar-inner"><div class="brand"><img src="${esc(brand.image)}" alt=""><span class="brand-name">${esc(brand.name)}</span></div><nav class="nav"><button data-nav="home" class="${active==='home'?'active':''}">${master?'Início':'Informações básicas'}</button><button data-nav="sheet" class="${active==='sheet'?'active':''}">Ficha</button><button data-nav="classes" class="${active==='classes'?'active':''}">Classes</button><button data-nav="nexus" class="${nexusActive?'active':''}">Nexus</button>${master?`<button data-nav="master" class="${active==='master'?'active':''}">Mestre</button>`:`<button data-nav="diary" class="${diaryActive?'active':''}">Diário</button><button data-nav="library" class="${libraryActive?'active':''}">Biblioteca</button>`}<button id="logout" type="button">Sair</button></nav></div></header><main class="main ${['sheet','classes','master','diary','library','nexus'].includes(active)?`main-${active}`:'main-home'}">${content}</main><div id="personal-player" aria-live="polite"></div></div>`}
function bindMasterFicha(){const root=document.querySelector('.master-player-grid');if(!root)return;root.onclick=e=>{const view=e.target.closest('[data-view-player]');if(view){e.preventDefault();e.stopPropagation();const p=state.players.find(x=>x.id===view.dataset.playerId)||state.players[Number(view.dataset.viewPlayer)];if(p)openPlayerViewById(p.id);return}const del=e.target.closest('[data-del-p]');if(del){e.preventDefault();e.stopPropagation();const i=Number(del.dataset.delP);if(state.players[i]&&confirm('Excluir este Player?')){const p=state.players[i];state.playerTombstones=state.playerTombstones||{};const k=playerSyncKey(p);if(k)state.playerTombstones[k]=Date.now();state.players.splice(i,1);save();render('master')}}}}
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
      if(target)render(target);
      return;
    }
    const logout=ev.target?.closest?.('#logout');
    if(logout){
      ev.preventDefault();
      ev.stopPropagation();
      authLogout().catch(()=>{});
      state.session=null;
      clearSessionCache();
      save();
      render();
    }
  },true);
}
function playerThemesMarkup(p){const themes=Array.isArray(p.musicThemes)?p.musicThemes:[];return `<article class="sheet-card character-themes"><div class="section-heading"><div><span class="section-kicker">TRILHAS DO PERSONAGEM</span><h2>A música que acompanha sua história</h2></div></div><p class="muted small">Crie trilhas separadas, como Música de Morte, Tema de Combate ou Tema Pessoal. Você escolhe o título e o link.</p><div class="theme-add-grid"><input id="themeLabel" placeholder="Ex.: Música de morte"><input id="themeTitle" placeholder="Ex.: Old Doll"><input id="themeUrl" placeholder="Link do Spotify ou URL da música"><button class="btn gold" id="addTheme">Adicionar trilha</button></div><div class="theme-upload-row"><label class="btn small gold">🎵 Enviar MP3 do celular<input id="themeFile" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus" hidden></label><small class="muted">Preencha o tipo e o nome acima (opcional) e escolha o arquivo (até 25 MB).</small></div><div class="character-theme-list">${themes.length?themes.map((t,i)=>`<div class="character-theme-card"><div><span class="theme-label">${esc(t.label||'TRILHA')}</span><h3>${esc(t.title||'Sem título')}</h3><small>${t.kind==='file'?'Arquivo enviado do aparelho':esc(t.url||'')}</small></div><div class="row">${themeIsAudio(t)?`<button type="button" class="btn small gold" data-play-theme="${i}">▶ Tocar</button><button type="button" class="btn small" data-pause-theme="${i}">Ⅱ Pausar</button><button type="button" class="btn small" data-stop-theme="${i}">■ Parar</button>`:''}<a class="btn small" href="${esc(safeHref(t.url))}" target="_blank" rel="noopener">Abrir</a><button class="btn small danger" data-remove-theme="${i}">Remover</button></div></div>`).join(''):'<div class="empty">Nenhuma trilha cadastrada para este personagem.</div>'}</div></article>`}
function playerWallpaperMarkup(p){return `<article class="sheet-card character-wallpaper"><div class="section-heading"><div><span class="section-kicker">WALLPAPER PESSOAL</span><h2>Fundo do seu personagem</h2></div></div><p class="muted small">Escolha uma imagem para personalizar o início do seu próprio registro.</p><div class="wallpaper-preview" id="playerWallpaperPreview" style="${p.homeWallpaper?`background-image:linear-gradient(90deg,rgba(0,0,0,.5),rgba(0,0,0,.15)),url('${esc(p.homeWallpaper)}')`:''}"></div><label class="upload-label">Alterar wallpaper<input id="playerWallpaperInput" type="file" accept="image/png,image/jpeg,image/webp,.jfif" hidden></label>${p.homeWallpaper?'<button class="btn small danger" id="clearPlayerWallpaper">Remover wallpaper</button>':''}</article>`}
function openBookReader(id){const it=item(id);if(!it)return;const pages=Array.isArray(it.bookPages)&&it.bookPages.length?it.bookPages:(it.bookContent?[String(it.bookContent)]:[]);let page=0;openModal(`<div class="modal" id="bookReader"><div class="modal-card book-reader"><button class="modal-close" id="closeBook">×</button><span class="badge">LIVRO</span><h2>${esc(it.name)}</h2><div class="book-reader-page" id="bookReaderPage">${pages.length?esc(pages[0]).replace(/\n/g,'<br>'):'Este livro ainda não possui conteúdo. O Mestre pode escrever as páginas na administração do item.'}</div><div class="book-reader-controls"><button class="btn small" id="bookPrev" ${pages.length<=1?'disabled':''}>← Anterior</button><span id="bookPageCount">${pages.length?`Página 1 de ${pages.length}`:'Sem páginas'}</span><button class="btn small" id="bookNext" ${pages.length<=1?'disabled':''}>Próxima →</button></div></div></div>`);const renderPage=()=>{const el=document.getElementById('bookReaderPage'),count=document.getElementById('bookPageCount');if(el)el.innerHTML=pages.length?esc(pages[page]).replace(/\n/g,'<br>'):'Este livro ainda não possui conteúdo.';if(count)count.textContent=pages.length?`Página ${page+1} de ${pages.length}`:'Sem páginas';document.getElementById('bookPrev')?.toggleAttribute('disabled',page<=0);document.getElementById('bookNext')?.toggleAttribute('disabled',page>=pages.length-1)};document.getElementById('closeBook').onclick=()=>document.getElementById('bookReader')?.remove();document.getElementById('bookPrev')?.addEventListener('click',()=>{if(page>0){page--;renderPage()}});document.getElementById('bookNext')?.addEventListener('click',()=>{if(page<pages.length-1){page++;renderPage()}})}
function updateResourceBars(p,type){const max=type==='sanity'?derivedMax(p,'Sanidade'):derivedMax(p,'Corpo'),value=type==='sanity'?clamp(p.sanity??max,0,max):clamp(p.hp??max,0,max);document.querySelectorAll(`[data-resource-bar="${type}"]`).forEach(bar=>{const old=Number(bar.dataset.value||value),pct=Math.max(0,Math.min(100,(value/max)*100));bar.dataset.value=value;const fill=bar.querySelector('.horror-bar-fill');if(fill){if(value<old){bar.classList.remove('damage');void bar.offsetWidth;bar.classList.add('damage')}fill.style.width=`${pct}%`}const strong=bar.querySelector('.horror-resource-head strong');if(strong)strong.innerHTML=`${value}<small> / ${max}</small>`;const foot=bar.querySelector('.horror-resource-foot span');if(foot)foot.textContent=`${Math.round(pct)}%`;});}

function printSheetAsPdf(p){
  // V65.10: gera o PDF pelo próprio navegador ("Salvar como PDF" na caixa de
  // impressão) em vez de adicionar uma biblioteca nova ao projeto.
  const prevTitle=document.title;
  document.title=`Ficha - ${p?.name||'Personagem'}`;
  window.print();
  setTimeout(()=>{document.title=prevTitle},600);
}
function bindSheet(){const p=player();if(!p)return;syncDerivedResources(p);document.querySelectorAll('[data-resource-input]').forEach(inp=>inp.addEventListener('input',()=>{const type=inp.dataset.resourceInput,max=type==='sanity'?derivedMax(p,'Sanidade'):derivedMax(p,'Corpo'),v=clamp(inp.value,0,max);if(type==='sanity')p.sanity=v;else p.hp=v;const hidden=document.getElementById(type==='sanity'?'sanity':'hp');if(hidden)hidden.value=v;save();updateResourceBars(p,type)}));const saveId=document.getElementById('saveIdentity');const pdfBtn=document.getElementById('downloadSheetPdf');if(pdfBtn)pdfBtn.onclick=()=>printSheetAsPdf(p);const cls=document.getElementById('pClass');if(cls)cls.onchange=()=>{if(classChosen(p)){toast('A classe já está selada.');render('sheet');return}if(!cls.value)return;if(!confirm(`Escolher ${cls.value}?\n\nEsta escolha é definitiva para este personagem.`)){render('sheet');return}p.class=cls.value;p.initialSpell='';save();toast('Seu destino está selado.');render('sheet')};if(saveId)saveId.onclick=()=>{captureSheetDraft();p.name=document.getElementById('pName').value.trim()||p.name;if(!classChosen(p)&&document.getElementById('pClass'))p.class=document.getElementById('pClass').value;p.extra=Math.max(0,Number(document.getElementById('extra')?.value)||p.extra||0);p.soul=document.getElementById('soul').value.trim();p.belovedObjects=document.getElementById('belovedObjects').value.trim();p.personality=document.getElementById('personality').value.trim();p.destiny=document.getElementById('destiny').value.trim();p.description=document.getElementById('description').value.trim();p.history=document.getElementById('history').value.trim();p.attrs.Corpo=clamp(p.attrs.Corpo,0,MAX_ATTR);p.attrs.Sanidade=clamp(p.attrs.Sanidade,0,MAX_ATTR);syncDerivedResources(p);p.hp=clamp(document.getElementById('hp').value,0,p.hpMax);p.sanity=clamp(document.getElementById('sanity').value,0,p.sanityMax);if(document.getElementById('attack'))p.attack=Number(document.getElementById('attack').value)||0;if(document.getElementById('defense'))p.defense=Number(document.getElementById('defense').value)||0;save();toast('Ficha atualizada.');render('sheet')};const history=document.getElementById('saveHistory');if(history)history.onclick=()=>{captureSheetDraft();p.description=document.getElementById('description').value;p.history=document.getElementById('history').value;save();toast('Descrição e história salvas.');render('sheet')};const photo=document.getElementById('photoInput');if(photo)photo.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>5*1024*1024){toast('Imagem inválida ou maior que 5 MB.');return}try{const data=await imageFileToRemoteURL(f,`players/${p.id}/portrait.webp`,900,.8);p.photo=data;save();document.getElementById('charPhoto').src=data;toast('Retrato salvo e sincronizado.')}catch(err){console.error(err);toast('Não foi possível salvar o retrato.')}};const soulPhoto=document.getElementById('soulPhotoInput');if(soulPhoto)soulPhoto.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>5*1024*1024){toast('Imagem inválida ou maior que 5 MB.');return}try{const data=await imageFileToRemoteURL(f,`players/${p.id}/soul.webp`,700,.8);p.soulPhoto=data;save();document.getElementById('soulPhoto').src=data;toast('Imagem da alma salva e sincronizada.')}catch(err){console.error(err);toast('Não foi possível salvar a imagem da alma.')}};const captureSheetDraft=()=>{const attrs={...p.attrs},skills={...p.skills};document.querySelectorAll('.pAttr').forEach(x=>attrs[x.dataset.attr]=clamp(x.value,0,MAX_ATTR));document.querySelectorAll('.pSkill').forEach(x=>skills[x.dataset.skill]=clamp(x.value,0,MAX_SKILL));const draft={attrs,skills};state.session=state.session||{};state.session.sheetDraft=draft;return draft};const sa=document.getElementById('saveAttrs');if(sa)sa.onclick=()=>{const draft=captureSheetDraft(),oldAttrs=p.attrs,oldSkills=p.skills;p.attrs=draft.attrs;p.skills=draft.skills;const err=validateAllocation(p);if(err){p.attrs=oldAttrs;p.skills=oldSkills;toast(err);return}syncDerivedResources(p);state.session.sheetDraft=null;save();toast('Atributos salvos sem apagar as perícias.');render('sheet')};const ss=document.getElementById('saveSkills');if(ss)ss.onclick=()=>{const draft=captureSheetDraft(),oldAttrs=p.attrs,oldSkills=p.skills;p.attrs=draft.attrs;p.skills=draft.skills;const err=validateAllocation(p);if(err){p.attrs=oldAttrs;p.skills=oldSkills;toast(err);return}state.session.sheetDraft=null;save();toast('Perícias salvas sem apagar os atributos.');render('sheet')};const wp=document.getElementById('playerWallpaperInput');if(wp)wp.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>5*1024*1024){toast('Wallpaper inválido ou maior que 5 MB.');return}try{const data=await imageFileToRemoteURL(f,`players/${p.id}/wallpaper.webp`,1400,.82);p.homeWallpaper=data;save();toast('Wallpaper do personagem salvo e sincronizado.');render('sheet')}catch(err){console.error(err);toast('Não foi possível salvar o wallpaper.')}};const cwp=document.getElementById('clearPlayerWallpaper');if(cwp)cwp.onclick=()=>{p.homeWallpaper='';save();toast('Wallpaper removido.');render('sheet')};
const taEnabled=document.getElementById('turnAlertEnabled');if(taEnabled)taEnabled.onchange=()=>{p.turnAlertSound=p.turnAlertSound||{url:'',name:'',enabled:false};p.turnAlertSound.enabled=taEnabled.checked;save()};
const taUrlInput=document.getElementById('turnAlertUrl');if(taUrlInput)taUrlInput.onchange=()=>{const url=taUrlInput.value.trim();if(!url)return;p.turnAlertSound=p.turnAlertSound||{url:'',name:'',enabled:false};p.turnAlertSound.url=url;p.turnAlertSound.name='';save();toast('Som do alerta atualizado.')};
const taFile=document.getElementById('turnAlertFile');if(taFile)taFile.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024){toast('O som deve ter até 8 MB.');return}if(!remoteEnabled){toast('Configure o Supabase para enviar um som próprio.');return}try{const ext=(f.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp3';const url=await uploadGlobalFile(`players/${p.id}/turn-alert-${Date.now()}.${ext}`,f);if(!url)throw new Error('sem URL');p.turnAlertSound=p.turnAlertSound||{url:'',name:'',enabled:false};p.turnAlertSound.url=url;p.turnAlertSound.name=f.name;save();toast('Som enviado e sincronizado.');render('sheet')}catch(err){console.error(err);toast('Não foi possível enviar o som.')}};
const taTest=document.getElementById('testTurnAlert');if(taTest)taTest.onclick=()=>{const url=p.turnAlertSound?.url||document.getElementById('turnAlertUrl')?.value.trim();if(!url){toast('Escolha ou envie um som primeiro.');return}unlockTurnAlertAudioOnce();new Audio(url).play().catch(()=>toast('Não foi possível tocar este som.'))};
const taClear=document.getElementById('clearTurnAlert');if(taClear)taClear.onclick=()=>{p.turnAlertSound={url:'',name:'',enabled:false};save();toast('Alerta sonoro removido.');render('sheet')};
const addTheme=document.getElementById('addTheme');if(addTheme)addTheme.onclick=()=>{const label=document.getElementById('themeLabel')?.value.trim(),title=document.getElementById('themeTitle')?.value.trim(),url=document.getElementById('themeUrl')?.value.trim();if(!label||!title||!url){toast('Preencha tipo, nome e link da trilha.');return}p.musicThemes=p.musicThemes||[];p.musicThemes.push({label,title,url});save();toast('Trilha do personagem adicionada.');render('sheet')};document.querySelectorAll('[data-remove-theme]').forEach(b=>b.onclick=async()=>{p.musicThemes.splice(Number(b.dataset.removeTheme),1);p._syncUpdatedAt=Date.now();save();await syncPlayersDbNow().catch(()=>{});toast('Trilha removida.');render('sheet')});document.querySelectorAll('[data-play-theme]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.playTheme),t=p.musicThemes?.[i];if(t)playPersonalTheme(t.url,t.title,i)});document.querySelectorAll('[data-pause-theme]').forEach(b=>b.onclick=()=>pausePersonalTheme());document.querySelectorAll('[data-stop-theme]').forEach(b=>b.onclick=()=>stopPersonalTheme());document.querySelectorAll('[data-roll-die]').forEach(button=>button.onclick=()=>{
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
 document.querySelectorAll('.pAttr').forEach(x=>x.addEventListener('input',()=>{const total=[...document.querySelectorAll('.pAttr')].reduce((a,i)=>a+Math.max(0,Number(i.value)||0),0);const lim=Number(characterRules(p.campaignType).attrPoints)+(Number(p.attrBonusPoints)||0);if(total>lim)x.value=Math.max(0,Number(x.value)-1);const rr=document.getElementById('attrRemaining');if(rr)rr.textContent=`Restam ${Math.max(0,lim-[...document.querySelectorAll('.pAttr')].reduce((a,i)=>a+(Number(i.value)||0),0))}`;captureSheetDraft();}));
 document.querySelectorAll('.pSkill').forEach(x=>x.addEventListener('input',()=>{const total=[...document.querySelectorAll('.pSkill')].reduce((a,i)=>a+Math.max(0,Number(i.value)||0),0);const lim=Number(characterRules(p.campaignType).skillPoints)+(Number(p.skillBonusPoints)||0);if(total>lim)x.value=Math.max(0,Number(x.value)-1);const rr=document.getElementById('skillRemaining');if(rr)rr.textContent=`Restam ${Math.max(0,lim-[...document.querySelectorAll('.pSkill')].reduce((a,i)=>a+(Number(i.value)||0),0))}`;captureSheetDraft();}));
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
  // Players are always part of the new combat controller. No join/leave event is needed.
  for(const p of (state.players||[])){
    const key=combatParticipantKey('player',p.id||p.login);if(seen.has(key))continue;seen.add(key);
    const prev=old.get(key)||{};
    next.push({key,kind:'player',entityId:String(p.id||p.login||''),entityLogin:String(p.login||''),name:String(p.name||p.login||'Player'),initiative:Number(prev.initiative)||0,enabled:prev.enabled!==false});
  }
  // Monsters/NPCs are only included when the Master explicitly adds them.
  for(const row of old.values()){
    if(row.kind!=='monster')continue;
    const m=combatEntityForParticipant(row);if(!m)continue;
    const key=combatParticipantKey('monster',m.id||m.name);if(seen.has(key))continue;seen.add(key);
    next.push({...row,key,entityId:String(m.id||m.name||''),name:String(m.name||'Monstro'),enabled:row.enabled!==false});
  }
  c.participants=next;
  c.actedKeys=(c.actedKeys||[]).filter(k=>next.some(x=>x.key===k));
  if(c.currentKey&&!next.some(x=>x.key===c.currentKey))c.currentKey='';
  return c;
}
function combatOrderedParticipants(c=normalizeCombatParticipants()){
  return [...(c.participants||[])].filter(x=>x.enabled!==false).sort((a,b)=>{
    const ai=Number(a.initiative)||0,bi=Number(b.initiative)||0;
    if(ai!==bi)return bi-ai; // maior iniciativa primeiro
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
  if(!next){newRound=true;c.round=Math.max(1,Number(c.round)||1)+1;acted.clear();next=rows[0];}
  c.actedKeys=[...acted];c.currentKey=next.key;c.turn=Math.max(1,Number(c.turn)||1)+1;c.updatedAt=Date.now();
  const ent=combatEntityForParticipant(next);if(ent){const effects=tickConditions(ent,c.round);if(effects.length)combatLog(c,`${next.name}: ${effects.join(' • ')}`);}
  combatLog(c,`${current.name} já agiu. Vez de ${next.name}.${newRound?' Nova rodada.':''}`);
  save();await saveGlobalNow().catch(()=>{});return true;
}
async function persistCombat(message=''){
  const c=normalizeCombatParticipants();if(message)combatLog(c,message);c.updatedAt=Date.now();save();await saveGlobalNow().catch(()=>{});render('home');
}
function combatMasterHome(){
  const c=normalizeCombatParticipants(),rows=combatOrderedParticipants(c),current=combatCurrent(c),acted=new Set(c.actedKeys||[]),m=normalizeMusic();
  const playerCards=(state.players||[]).map(p=>{
    const row=rows.find(x=>x.kind==='player'&&String(x.entityId)===String(p.id));const isCurrent=!!row&&row.key===c.currentKey;const didAct=!!row&&acted.has(row.key);const hp=Number(p.hp)||0,hpMax=Number(p.hpMax)||0,san=Number(p.sanity)||0;
    return `<article class="combat-player-card ${isCurrent?'is-current':''} ${didAct?'has-acted':''}"><div class="combat-player-avatar"><img src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt=""></div><div class="combat-player-main"><div class="combat-player-top"><div><span class="section-kicker">PLAYER</span><h3>${esc(p.name||p.login)}</h3><small>${esc(p.class||'Sem classe')}</small></div><span class="combat-state-badge">${isCurrent?'▶ VEZ':didAct?'✓ JÁ AGIU':'AGUARDANDO'}</span></div><div class="combat-mini-stats"><span>VIDA <b>${hp}/${hpMax||'—'}</b></span><span>SAN <b>${san}</b></span><label>INICIATIVA <input type="number" min="0" step="1" value="${row?.initiative?Number(row.initiative):''}" data-combat-initiative="${esc(p.id)}" placeholder="0"></label></div><div class="row"><button class="btn small primary" data-master-open-player="${esc(p.id)}">Abrir ficha</button><button class="btn small" data-combat-player-action="${esc(p.id)}">Ações rápidas</button></div></div></article>`;
  }).join('');
  const history=(c.history||[]).slice(0,10).map(h=>`<div class="combat-history-item"><small>R${Number(h.round)||1} • T${Number(h.turn)||0}</small><span>${esc(h.message)}</span></div>`).join('');
  return shell(`<section class="master-control-hero combat-control-hero"><div><span class="badge">CENTRO DE CONTROLE DO MESTRE</span><h1>${esc(c.title||'Sessão atual')}</h1><p>${esc(c.scene||'Tudo que o Mestre precisa para conduzir a sessão, agora em uma única tela.')}</p></div><div class="master-control-status"><span>${c.active?'● COMBATE ATIVO':'○ PREPARAÇÃO'}</span><strong>${current?`Vez: ${esc(current.name)}`:'Pronto para iniciar'}</strong><small>Rodada ${Number(c.round)||1} • Turno ${Number(c.turn)||0}</small></div></section>
  <section class="combat-control-grid">
    <article class="card combat-turn-panel"><div class="row space"><div><span class="section-kicker">CONTROLE DE TURNO</span><h2>${current?esc(current.name):'Nenhum turno iniciado'}</h2><p class="small muted">Clique uma vez para encerrar a vez atual. O sistema marca automaticamente quem já agiu e passa para o próximo.</p></div><span class="corner-mark">R${Number(c.round)||1} • T${Number(c.turn)||0}</span></div><div class="combat-big-status">${current?`<strong>${current.name}</strong><span>${acted.has(current.key)?'JÁ AGIU':'AGUARDANDO AÇÃO'}</span>`:'<strong>Preparação</strong><span>Defina as iniciativas e inicie o combate.</span>'}</div><div class="row combat-main-actions"><button class="btn primary" id="combatStart">${c.active?'↻ Reiniciar combate':'▶ Iniciar combate'}</button><button class="btn gold" id="combatNext">Próximo turno</button><button class="btn" id="combatResetRound">↺ Reiniciar rodada</button><button class="btn danger" id="combatEnd">■ Encerrar</button></div><div class="combat-order-strip">${rows.map((x,i)=>`<div class="combat-order-chip ${x.key===c.currentKey?'current':''} ${acted.has(x.key)?'acted':''}"><b>${i+1}</b><span>${esc(x.name)}</span>${acted.has(x.key)?'<small>✓</small>':''}</div>`).join('')||'<span class="muted">Nenhum participante.</span>'}</div></article>
    <aside class="card combat-session-meta"><div class="section-heading"><div><span class="section-kicker">SESSÃO</span><h2>Estado da aventura</h2></div></div><div class="field"><label>Nome da sessão</label><input id="combatTitle" value="${esc(c.title||'Sessão atual')}"></div><div class="field"><label>Cena atual</label><input id="combatScene" value="${esc(c.scene||'')}" placeholder="Ex.: Mansão Drevis — salão principal"></div><button class="btn primary full" id="combatSaveMeta">Salvar sessão</button><div class="combat-history"><div class="section-kicker">HISTÓRICO</div>${history||'<div class="small muted">O histórico aparecerá aqui.</div>'}</div></aside>
  </section>
  <section class="card combat-players-panel"><div class="row space"><div><span class="section-kicker">PARTICIPANTES</span><h2>Fichas em combate</h2><p class="small muted">Players entram automaticamente. Monstros podem ser adicionados pelo botão abaixo.</p></div><div class="row"><button class="btn" id="combatAddMonster">+ Adicionar monstro</button><button class="btn" data-nav="master">Gerenciar Players</button></div></div><div class="combat-player-grid">${playerCards||'<div class="empty">Nenhum Player cadastrado.</div>'}</div></section>
  <section class="combat-utilities-grid"><article class="card"><div class="row space"><div><span class="section-kicker">TRILHA</span><h2>${esc(m.title||'Nenhuma trilha')}</h2></div><button class="btn" data-nav="master">Biblioteca</button></div><p class="small muted">${m.url?(m.playing?'Tocando para todos os Players.':'Trilha carregada e persistida.'):'Nenhuma trilha global selecionada.'}</p><div class="row"><button class="btn primary" id="masterMusicPlay">${m.playing?'Ⅱ Pausar':'▶ Tocar'}</button><button class="btn" id="masterMusicStop">■ Parar</button></div></article><article class="card"><div class="row space"><div><span class="section-kicker">PISTA SECRETA</span><h2>Enviar para um Player</h2></div><button class="btn" data-nav="master">Biblioteca</button></div><div class="field"><label>Player</label><select id="masterSecretTarget">${state.players.map(p=>`<option value="${esc(p.login)}">${esc(p.name||p.login)}</option>`).join('')}</select></div><div class="field"><label>Título</label><input id="masterSecretTitle" placeholder="Ex.: A porta está aberta"></div><div class="field"><label>Mensagem</label><textarea id="masterSecretMessage" rows="3" placeholder="Somente esse Player verá esta pista."></textarea></div><button class="btn gold" id="masterSendSecret">Enviar pista</button></article><article class="card"><div class="row space"><div><span class="section-kicker">ATMOSFERA</span><h2>Modo Terror</h2></div><button class="btn danger" id="masterTerrorMode">${state.terrorMode?.active?'Editar / Encerrar':'Ativar'}</button></div><p class="small muted">Mostra uma cena de tensão para todos os Players.</p></article></section>`,'home');
}
function bindMasterHome(){
  const saveCombat=async(msg)=>{const c=normalizeCombatParticipants();if(msg)combatLog(c,msg);c.updatedAt=Date.now();save();await saveGlobalNow().catch(()=>{});render('home');};
  document.getElementById('combatStart')?.addEventListener('click',async()=>{const c=normalizeCombatParticipants();if(c.active){if(!confirm('Reiniciar o combate? A rodada e as marcações de ação serão zeradas.'))return;combatResetState(c);}if(combatStart(c)){await saveCombat(`Combate iniciado. Vez de ${combatCurrent(c)?.name||'participante'}.`);}});
  document.getElementById('combatNext')?.addEventListener('click',async()=>{if(await advanceCombatTurn())render('home')});
  document.getElementById('combatResetRound')?.addEventListener('click',async()=>{const c=normalizeCombatParticipants();c.round=1;c.turn=0;c.currentKey='';c.actedKeys=[];c.active=false;c.updatedAt=Date.now();await saveCombat('Combate reiniciado para uma nova rodada.');});
  document.getElementById('combatEnd')?.addEventListener('click',async()=>{const c=normalizeCombatParticipants();c.active=false;c.currentKey='';c.actedKeys=[];c.updatedAt=Date.now();await saveCombat('Combate encerrado.');});
  document.querySelectorAll('[data-combat-initiative]').forEach(inp=>inp.addEventListener('change',async()=>{const c=normalizeCombatParticipants(),p=c.participants.find(x=>x.kind==='player'&&String(x.entityId)===String(inp.dataset.combatInitiative));if(!p)return;p.initiative=Math.max(0,Number(inp.value)||0);c.updatedAt=Date.now();save();await saveGlobalNow().catch(()=>{});render('home')}));
  document.getElementById('combatSaveMeta')?.addEventListener('click',async()=>{const c=normalizeCombatParticipants();c.title=document.getElementById('combatTitle').value.trim()||'Sessão atual';c.scene=document.getElementById('combatScene').value.trim();await saveCombat('Dados da sessão atualizados.');});
  document.getElementById('combatAddMonster')?.addEventListener('click',()=>openCombatMonsterPicker());
  document.getElementById('masterMusicPlay')?.addEventListener('click',async()=>{const mm=normalizeMusic();if(!mm.url){render('master');toast('Escolha uma trilha na Biblioteca.');return}await saveMusicCommand({playing:!mm.playing,position:musicTargetPosition(mm),startedAt:!mm.playing?Date.now()-musicTargetPosition(mm)*1000:0});render('home')});
  document.getElementById('masterMusicStop')?.addEventListener('click',async()=>{await saveMusicCommand({playing:false,position:0,startedAt:0});render('home')});
  document.getElementById('masterSendSecret')?.addEventListener('click',async()=>{const target=document.getElementById('masterSecretTarget')?.value||'',title=document.getElementById('masterSecretTitle')?.value.trim()||'Informação confidencial',message=document.getElementById('masterSecretMessage')?.value.trim()||'';const p=state.players.find(x=>String(x.login).toLowerCase()===String(target).toLowerCase());if(!p||!message){toast('Escolha um Player e escreva a pista.');return}p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];const clue={id:`secret-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title,message,receivedAt:Date.now()};p.secretClues.unshift(clue);p._syncUpdatedAt=Date.now();save();await syncPlayersDbNow().catch(()=>{});broadcastLive('secret-clue',{targetLogin:target,clue}).catch(()=>{});toast(`Pista salva para ${p.name||p.login}.`);document.getElementById('masterSecretMessage').value='';});
  document.getElementById('masterTerrorMode')?.addEventListener('click',openTerrorEditor);
  document.querySelectorAll('[data-master-open-player]').forEach(b=>b.onclick=()=>openPlayerViewById(b.dataset.masterOpenPlayer));
  document.querySelectorAll('[data-combat-player-action]').forEach(b=>b.onclick=()=>openCombatStatusEditor(b.dataset.combatPlayerAction));
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
  openModal(`<div class="modal" id="combatStatusModal"><div class="modal-card"><button class="modal-close" id="closeCombatStatus">×</button><span class="badge">AÇÃO RÁPIDA</span><h2>${esc(p.name||p.login)}</h2><div class="session-status-edit-grid"><label>Vida<input id="cHp" type="number" min="0" max="${hpMax}" value="${clamp(p.hp,0,hpMax)}"></label><label>Sanidade<input id="cSan" type="number" min="0" max="${sanMax}" value="${clamp(p.sanity??sanMax,0,sanMax)}"></label><label>Determinação<input id="cDet" type="number" min="0" max="${det.max}" value="${det.cur}"></label></div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="cancelCombatStatus">Cancelar</button><button class="btn primary" id="saveCombatStatus">Salvar</button></div></div></div>`);
  const close=()=>document.getElementById('combatStatusModal')?.remove();document.getElementById('closeCombatStatus').onclick=close;document.getElementById('cancelCombatStatus').onclick=close;
  document.getElementById('saveCombatStatus').onclick=async()=>{p.hp=clamp(document.getElementById('cHp').value,0,hpMax);p.sanity=clamp(document.getElementById('cSan').value,0,sanMax);p.determination=clamp(document.getElementById('cDet').value,0,det.max);save();await saveGlobalNow().catch(()=>{});close();toast('Status do Player atualizado.');render('home')};
}
function masterHomeControl(){
  // O Centro de Controle do Mestre é a nova tela inicial da sessão.
  // Mantemos um único ponto de entrada para evitar referências quebradas ao antigo 'Mesa'.
  return combatMasterHome();
}

function home(){
 const master=state.session.role==='master',p=player();
 if(master)return masterHomeControl();
 syncDerivedResources(p);
 const combatBanner=state.combatSession?.active?`<section class="player-combat-banner">${sessionDiamondCard(p,{controls:true,big:true})}</section>`:'';
 const trained=[...new Set(allSkills().filter(sk=>(effectiveSkill(p,sk)||0)>0))];
 const wallpaper=p?.homeWallpaper?` style="--player-wallpaper:url('${esc(p.homeWallpaper)}')"`:'';const themes=Array.isArray(p?.musicThemes)?p.musicThemes:[];return shell(`<section class="op-home-sheet player-personalized"${wallpaper}><div class="op-topline"><div><span class="badge">PERSONAGEM</span><h1>${esc(p?.name||'Player')}</h1><p>${esc(p?.class||'Classe não escolhida')} • ${esc(p?.status||'Ativo')}</p></div><div class="op-resource-strip horror-home-bars">${determinationBadge(p,true)}${resourceBarMarkup('Vida',p?.hp||0,derivedMax(p,'Corpo'),'health',false)}${resourceBarMarkup('Sanidade',p?.sanity||0,derivedMax(p,'Sanidade'),'sanity',false)}</div></div>${combatBanner}<div class="op-dossier-grid"><section class="op-attributes"><div class="section-heading"><div><span class="section-kicker">ATRIBUTOS</span><h2>Estado atual</h2></div><span class="corner-mark">SOMENTE LEITURA</span></div><div class="op-attr-list">${ATTRS.map(a=>`<div class="op-attr-row"><span class="op-attr-symbol">${uiAttrIcon(a)}</span><span>${esc(a)}</span><b>${effectiveAttr(p,a)}</b></div>`).join('')}</div></section><section class="op-trained"><div class="section-heading"><div><span class="section-kicker">PERÍCIAS</span><h2>Treinadas</h2></div><span class="corner-mark">${trained.length}</span></div><div class="op-trained-list">${trained.length?trained.map(sk=>`<div class="op-skill-row"><span>${uiSkillIcon(sk)} ${esc(sk)}</span><b>${effectiveSkill(p,sk)}</b></div>`).join(''):'<div class="empty">Nenhuma perícia treinada.</div>'}</div></section><aside class="op-profile"><div class="op-portrait-frame"><img src="${esc(p?.photo||'ritual.webp')}" alt="Retrato do personagem"><span class="portrait-mark">✦</span></div><div><span class="section-kicker">REGISTRO</span><h2>${esc(p?.class||'Sem classe')}</h2><p>Ficha inicial inspirada em uma folha de personagem: leitura rápida, atributos totais e apenas perícias treinadas.</p></div></aside></div><div class="op-home-actions"><button class="btn primary" data-nav="sheet">Abrir ficha completa</button><button class="btn gold" data-open-secret-clues>Pistas secretas</button><button class="btn gold" data-nav="classes">${classChosen(p)?'Consultar Classes':'Escolher Classe'}</button></div></section><section class="home-player-themes"><div class="section-heading"><div><span class="section-kicker">TRILHAS PESSOAIS</span><h2>O som deste personagem</h2></div></div><div class="home-theme-grid">${themes.length?themes.map((t,i)=>themeIsAudio(t)?`<div class="home-theme-card"><span>${esc(t.label)}</span><strong>${esc(t.title)}</strong><div class="row"><button type="button" class="btn small gold" data-play-theme="${i}">▶ Tocar</button><button type="button" class="btn small" data-pause-theme="${i}">Ⅱ</button><button type="button" class="btn small" data-stop-theme="${i}">■</button></div></div>`:`<a class="home-theme-card" href="${esc(safeHref(t.url))}" target="_blank" rel="noopener"><span>${esc(t.label)}</span><strong>${esc(t.title)}</strong><small>Abrir trilha ↗</small></a>`).join(''):'<div class="empty">Este personagem ainda não registrou suas trilhas.</div>'}</div></section>${spotifyHomePanel()}<section class="immersive-cta"><button type="button" class="btn curtain-btn" data-enter-immersive>${CURTAIN_SVG}<span>Entrar em modo sessão</span></button><small>Tela imersiva para jogar: determinação, mochila, diário, anotações, perícias, alma e habilidades.</small></section>`,'home')}

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
function resourceBarMarkup(label,current,max,type,editable=true){const safeMax=Math.max(1,Number(max)||1),value=clamp(current,0,safeMax),pct=Math.max(0,Math.min(100,(value/safeMax)*100));const cls=type==='sanity'?'sanity-bar':'blood-bar';return `<div class="horror-resource ${cls}" data-resource-bar="${type}" data-value="${value}"><div class="horror-resource-head"><span>${type==='sanity'?'SANIDADE':'VIDA'}</span><strong>${value}<small> / ${safeMax}</small></strong></div><div class="horror-bar-track"><div class="horror-bar-fill" style="width:${pct}%"><i class="drip drip-a"></i><i class="drip drip-b"></i><i class="drip drip-c"></i></div><div class="horror-bar-gloss"></div></div>${editable?`<div class="horror-resource-input"><input data-resource-input="${type}" type="number" min="0" max="${safeMax}" value="${value}" aria-label="${type}"></div>`:''}<div class="horror-resource-foot"><span>${Math.round(pct)}%</span><span>${value===0?(type==='sanity'?'MENTE VAZIA':'CAÍDO'):value<=safeMax*.2?'CRÍTICO':'ESTÁVEL'}</span></div></div>`}
function hpFields(e,editable=true){const dis=editable?'':'disabled';const hpMax=derivedMax(e,'Corpo')||1;const sanityMax=derivedMax(e,'Sanidade');const hp=clamp(e.hp??hpMax,0,hpMax);const sanity=clamp(e.sanity??sanityMax,0,sanityMax);return `<div class="horror-resource-grid">${resourceBarMarkup('Vida',hp,hpMax,'health',editable)}${resourceBarMarkup('Sanidade',sanity,sanityMax,'sanity',editable)}</div><div class="input-grid resource-grid-compact">${combatBoxes(e,dis)}<input id="hp" type="hidden" value="${hp}"><input id="sanity" type="hidden" value="${sanity}"></div><p class="resource-rule">A barra acompanha a porcentagem exata do recurso. Ao perder Vida, a animação de sangue escorre para baixo antes de a nova porcentagem ficar estável.</p>`}

function playerTurnAlertMarkup(p){
  const cfg=p.turnAlertSound||{url:'',name:'',enabled:false};
  return `<article class="sheet-card character-turn-alert"><div class="section-heading"><div><span class="section-kicker">ALERTA DE VEZ</span><h2>Som quando chegar sua vez / perder vida</h2></div></div><p class="muted small">Pensado pra iPhone, que não vibra: toca este som quando o Mestre tirar sua vida ou quando a sessão passar a vez pra você. Escolha um arquivo de áudio ou cole uma URL direta.</p><label class="checkline"><input id="turnAlertEnabled" type="checkbox" ${cfg.enabled?'checked':''}> Ativar alerta sonoro</label><div class="theme-add-grid"><input id="turnAlertUrl" placeholder="URL direta de um som (.mp3/.ogg/.wav)" value="${esc(cfg.url&&!cfg.name?cfg.url:'')}"><label class="upload-label">Enviar som<input id="turnAlertFile" type="file" accept="audio/*" hidden></label><button class="btn" id="testTurnAlert">Testar som</button>${cfg.url?'<button class="btn danger" id="clearTurnAlert">Remover</button>':''}</div>${cfg.name?`<p class="small muted">Som atual: ${esc(cfg.name)}</p>`:''}</article>`;
}
function sheetInternal(){const p=player();if(!p)return shell('<div class="empty">Player não encontrado.</div>','sheet');syncDerivedResources(p);const draft=state.session?.sheetDraft||{};const draftAttrs={...p.attrs,...(draft.attrs||{})};const draftSkills={...p.skills,...(draft.skills||{})};const last=p.rolls?.[p.rolls.length-1];const hpMax=derivedMax(p,'Corpo')||1;const sanityMax=derivedMax(p,'Sanidade');const bonus=classBonusMap(p.class);const chosen=classChosen(p);const currentClass=CLASSES[p.class]||{desc:'Escolha uma classe para revelar suas habilidades e bônus.',bonus:'—',abilities:[]};return shell(`<section class="profile-header has-det">${determinationBadge(p,true)}<div><span class="badge">PLAYER</span><h1>${esc(p.name)}</h1><p>${esc(p.class||'Classe não escolhida')} <span class="sep">•</span> ${esc(p.status)}</p><div class="destiny-phrase" id="destinyPhrase">Seu destino está selado</div></div><div class="profile-seal"><img src="/runa-gold.png" alt=""></div></section>${state.combatSession?.active?`<section class="sess-strip">${sessionDiamondCard(p,{controls:true})}</section>`:''}<div class="sheet-layout"><section class="sheet-main"><article class="sheet-card character-card"><div class="character-portrait"><img class="photo" id="charPhoto" src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt="Retrato"><label class="upload-label">Alterar retrato<input id="photoInput" type="file" accept="image/png,image/jpeg,image/webp,.jfif" hidden></label></div><div class="character-info"><div class="eyebrow">IDENTIDADE</div><div class="field-inline"><label>Nome</label><input id="pName" value="${esc(p.name)}"></div><div class="field-inline"><label>Classe</label><div class="class-lock-field">${chosen?`<strong>${esc(p.class)}</strong><span>Escolha já selada</span>`:`<select id="pClass"><option value="">Escolha sua classe</option>${Object.entries(CLASSES).filter(([c,v])=>p.campaignType==='slasher'?!!v.slasher:!v.slasher).map(([c])=>`<option ${p.class===c?'selected':''}>${esc(c)}</option>`).join('')}</select>`}</div></div><div class="small-stat-row"><div><span>VIDA ATUAL</span><strong>${clamp(p.hp??hpMax,0,hpMax)} / ${hpMax}</strong></div><div><span>SANIDADE</span><strong>${clamp(p.sanity??sanityMax,0,sanityMax)} / ${sanityMax}</strong></div><div><span>PONTOS EXTRAS</span><strong>${p.extra||0}</strong></div></div><div class="class-bonus-summary"><span>BÔNUS DA CLASSE</span><strong>${esc(classBonusText(p.class))}</strong></div><button class="btn primary" id="saveIdentity">Salvar ficha</button><button type="button" class="btn" id="downloadSheetPdf">Baixar ficha em PDF</button></div></article>${playerThemesMarkup(p)}${playerWallpaperMarkup(p)}${playerTurnAlertMarkup(p)}<article class="sheet-card resources-card"><div class="section-heading"><div><span class="section-kicker">RECURSOS</span><h2>Estado do corpo e da mente</h2></div></div>${hpFields(p,true)}</article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">PROGRESSÃO</span><h2>Distribuição de pontos</h2></div></div><div class="point-summary-grid"><div class="resource-box"><span>ATRIBUTOS</span><strong>${allocationTotals(p).attrs} / ${Number(characterRules(p.campaignType).attrPoints)+(Number(p.attrBonusPoints)||0)}</strong><small>Restam ${allocationRemaining(p).attrs}</small></div><div class="resource-box"><span>PERÍCIAS</span><strong>${allocationTotals(p).skills} / ${Number(characterRules(p.campaignType).skillPoints)+(Number(p.skillBonusPoints)||0)}</strong><small>Restam ${allocationRemaining(p).skills}</small></div><div class="resource-box"><span>VIDA TOTAL</span><strong>${hpMax}</strong><small>Calculada pelo Corpo</small></div><div class="resource-box"><span>SANIDADE TOTAL</span><strong>${sanityMax}</strong><small>Calculada pela Sanidade</small></div></div></article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ATRIBUTOS</span><h2>Distribuição de Atributos</h2></div><span class="corner-mark">${Number(characterRules(p.campaignType).attrPoints)+(Number(p.attrBonusPoints)||0)} pontos totais • <b id="attrRemaining">Restam ${allocationRemaining(p).attrs}</b></span></div><div class="attribute-grid">${allAttrs().map(a=>{const b=bonus[a]||0;return `<label class="attribute-box"><span class="attr-icon">${uiAttrIcon(a)}</span><span class="attr-name">${esc(a)}</span><input class="pAttr" data-attr="${esc(a)}" type="number" min="0" max="8" value="${draftAttrs[a]}" ><span class="attr-cap">/ 8</span>${b?`<small class="attr-bonus">+${b} classe • efetivo ${effectiveAttr(p,a)}</small>`:''}</label>`}).join('')}</div><p class="resource-rule">Corpo e Sanidade determinam automaticamente os limites de Vida e Sanidade. Máximo de 35.</p><button class="btn primary" id="saveAttrs">Salvar atributos</button></article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">PERÍCIAS</span><h2>Distribuição de Perícias</h2><p class="small muted">Distribuídos: ${allocationTotals(p).skills} / ${characterRules(p.campaignType).skillPoints} • <strong id="skillRemaining">Restam ${allocationRemaining(p).skills}</strong></p></div><span class="corner-mark">${Number(characterRules(p.campaignType).skillPoints)+(Number(p.skillBonusPoints)||0)} pontos totais</span></div><div class="skills-groups">${Object.entries({...SKILL_GROUPS,'Personalizadas':customList('skills').map(x=>x.name).filter(Boolean)}).map(([g,items])=>`<div class="skill-group"><div class="skill-group-title">${esc(g)}</div>${items.map(sk=>`<label class="skill-line"><span class="skill-name"><i class="skill-icon">${uiSkillIcon(sk)}</i><span>${esc(sk)}${classBonusMap(p.class)[sk]?`<small class="skill-bonus">+${classBonusMap(p.class)[sk]} classe • efetivo ${effectiveSkill(p,sk)}</small>`:''}</span></span><input class="pSkill" data-skill="${esc(sk)}" type="number" min="0" max="15" value="${draftSkills[sk]||0}"><b>/15</b></label>`).join('')}</div>`).join('')}</div><button class="btn primary" id="saveSkills">Salvar perícias</button></article><article class="sheet-card dice-section-fixed dice-v2">
<div class="section-heading">
 <div><span class="section-kicker">ARS ALEAE</span><h2>Rolagem de dados</h2></div>
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
   ${last?`Último resultado: <strong>${esc(last.value)}</strong> em ${esc(last.die||last.label||'d20')}`:'Pronto para rolar. Escolha um dado acima.'}
  </div>
 </div>
</div>
<div class="roll-history dice-history-v2">
 ${(p.rolls||[]).slice().reverse().slice(0,12).map(r=>`<div class="roll-entry" data-roll-id="${esc(r.id||'')}"><strong>${esc(rollDisplayText(r))}</strong><span>${esc(r.die||r.label)}</span><time>${esc(r.time)}</time></div>`).join('')||'<div class="empty">Nenhuma rolagem ainda.</div>'}
</div>
</article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ESTADOS</span><h2>Condições atuais</h2></div></div><div class="condition-legend">Condições aplicadas pelo Mestre aparecem aqui.</div>${conditionsMarkup(p)}</article>${spellMarkup(p)}<article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ALMA</span><h2>O que permanece</h2></div></div><div class="soul-layout"><div class="photo-wrap"><img class="photo soul-photo" id="soulPhoto" src="${esc(safeImgSrc(p.soulPhoto,'/runa-gold.png'))}" alt="Alma"><label class="upload-label">Imagem da alma<input id="soulPhotoInput" type="file" accept="image/png,image/jpeg,image/webp,.jfif" hidden></label></div><div class="text-fields"><div class="field"><label>Sua alma</label><input id="soul" value="${esc(p.soul)}"></div><div class="field"><label>Objetos queridos</label><textarea id="belovedObjects" rows="4">${esc(p.belovedObjects)}</textarea></div></div></div><div class="story-grid"><div class="field"><label>Personalidade</label><textarea id="personality" rows="5">${esc(p.personality)}</textarea></div><div class="field"><label>Destino</label><textarea id="destiny" rows="5">${esc(p.destiny)}</textarea></div></div>${p.class==='Ocultista'&&p.deityId&&allDeities().find(d=>d.id===p.deityId)?.image?`<div class="deity-soul-symbol"><img src="${esc(allDeities().find(d=>d.id===p.deityId).image)}" alt="Símbolo do Deus escolhido"></div>`:''}</article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">DESCRIÇÃO & HISTÓRIA</span><h2>Sua história</h2></div></div><div class="story-grid"><div class="field"><label>Descrição</label><textarea id="description" rows="6" placeholder="Aparência, presença, voz e detalhes que definem este personagem.">${esc(p.description||'')}</textarea></div><div class="field"><label>História</label><textarea id="history" rows="6" placeholder="Escreva aqui a história, feitos, perdas e marcas que definem este personagem.">${esc(p.history||'')}</textarea></div></div><button class="btn primary" id="saveHistory">Salvar descrição e história</button></article><article class="sheet-card notes-card"><div class="section-heading"><div><span class="section-kicker">ANOTAÇÕES DO PLAYER</span><h2>Seu registro privado</h2></div></div><textarea id="playerNotes" rows="6" placeholder="Anotações que somente você verá...">${esc(p.playerNotes||'')}</textarea><p class="tiny muted">Estas anotações não aparecem para o Mestre.</p></article><article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">MOCHILA</span><h2>${bagCapacity(p)} espaços • peso dinâmico</h2></div></div>${slots(p,true)}</article></section><aside class="sheet-side"><article class="sheet-card sticky-card"><div class="section-heading"><div><span class="section-kicker">CLASSE ATUAL</span><h2>${esc(p.class)}</h2></div></div><p class="muted">${esc(currentClass.desc)}</p><div class="class-bonus-summary"><span>BÔNUS</span><strong>${esc(currentClass.bonus)}</strong></div><div class="ability-list">${currentClass.abilities.map(a=>`<div class="ability"><b>${esc(a[0])}</b><div class="small muted">${esc(a[1])}</div></div>`).join('')}</div></article><article class="sheet-card sticky-card"><div class="section-heading"><div><span class="section-kicker">RESUMO</span><h2>Estado atual</h2></div></div><div class="active-conditions">${(p.conditions||[]).map(id=>{const c=conditionById(id);const img=state.uiIcons?.conditions?.[c?.id]||c?.image;return c?`<div class="active-condition">${img?`<img src="${esc(img)}" alt="">`:`<span>${esc(c.icon)}</span>`}<div><b>${esc(c.name)}</b><small>${esc(conditionEffectText(c.id,p))}</small></div></div>`:''}).join('')||'<div class="empty">Nenhuma condição ativa.</div>'}</div></article></aside></div>`,'sheet')}

// V65.9: a ficha completa chamava slots() e addBag(), mas as duas funções tinham sumido do arquivo.
// slots() lançava ReferenceError, o que jogava TODO Player na "ficha em modo de recuperação" (sem upload de retrato/wallpaper).
function slots(p,editable=false){
  const cap=bagCapacity(p),backpack=Array.isArray(p?.backpack)?p.backpack:[];
  const cells=Array.from({length:cap},(_,i)=>{
    const b=backpack[i],it=b&&item(b.id);
    if(!it)return `<div class="slot"><div class="slot-icon" style="opacity:.15">◇</div><div class="small muted">Espaço vazio</div></div>`;
    const qty=Math.max(1,Number(b.qty)||1),w=inferWeight(it);
    const isBook=String(it.category||'').toLowerCase().includes('livro')||!!it.bookContent||(Array.isArray(it.bookPages)&&it.bookPages.length>0);
    return `<div class="slot filled">${editable?`<button type="button" data-remove-slot="${i}">×</button>`:''}<div class="slot-icon">${itemIcon(it)}</div><div class="slot-name">${esc(it.name)}</div>${isWeaponItem(it)?`<div class="slot-damage">⚔️ Dano: ${esc(it.damage||weaponDamageFallback(it))}</div>`:''}${isBook?`<button type="button" class="book-read-btn" data-read-book="${it.id}">Ler</button>`:''}<div class="slot-id">Peso ${w}</div><div class="slot-qty">Qtd. ${qty} • ${w*qty} espaço${w*qty===1?'':'s'}</div></div>`;
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
  const draft=state.session?.sheetDraft||{};const draftAttrs={...p.attrs,...(draft.attrs||{})};const draftSkills={...p.skills,...(draft.skills||{})};const rolls=Array.isArray(p.rolls)?p.rolls:[];
  const last=rolls[rolls.length-1];
  const backpack=Array.isArray(p.backpack)?p.backpack:[];
  const cap=bagCapacity(p);
  const bagHtml=Array.from({length:cap},(_,i)=>{
    const b=backpack[i],it=b&&item(b.id);
    return `<div class="slot ${it?'filled':''}">${it?`<button type="button" data-remove-slot="${i}">×</button><div class="slot-icon">${itemIcon(it)}</div><div class="slot-name">${esc(it.name)}</div>${isWeaponItem(it)?`<div class="slot-damage">⚔️ Dano: ${esc(it.damage||weaponDamageFallback(it))}</div>`:''}<div class="slot-id">Peso ${inferWeight(it)}</div><div class="slot-qty">Qtd. ${b.qty||1} • ${inferWeight(it)*(b.qty||1)} espaço${inferWeight(it)*(b.qty||1)===1?'':'s'}</div>`:'<div class="slot-icon" style="opacity:.15">◇</div><div class="small muted">Espaço vazio</div>'}</div>`;
  }).join('');
  return shell(`<section class="profile-header"><div><span class="badge">PLAYER</span><h1>${esc(p.name||'Ficha')}</h1><p>${esc(p.class||'Classe não escolhida')} <span class="sep">•</span> ${esc(p.status||'Ativo')}</p></div><div class="profile-seal"><img src="runa-gold.png" alt=""></div></section>
  <div class="sheet-layout"><section class="sheet-main">
  <article class="sheet-card character-card"><div class="character-portrait"><img class="photo" id="charPhoto" src="${esc(safeImgSrc(p.photo,'/ritual.webp'))}" alt="Retrato"></div><div class="character-info"><div class="eyebrow">IDENTIDADE</div><div class="field-inline"><label>Nome</label><input id="pName" value="${esc(p.name||'')}" /></div><div class="small-stat-row"><div><span>VIDA ATUAL</span><strong>${clamp(p.hp??hpMax,0,hpMax)} / ${hpMax}</strong></div><div><span>SANIDADE</span><strong>${clamp(p.sanity??sanityMax,0,sanityMax)} / ${sanityMax}</strong></div><div><span>ESPAÇOS</span><strong>${cap}</strong></div></div><button class="btn primary" id="saveIdentity">Salvar ficha</button><button type="button" class="btn" id="downloadSheetPdf">Baixar ficha em PDF</button></div></article>
  <article class="sheet-card resources-card"><div class="section-heading"><div><span class="section-kicker">RECURSOS</span><h2>Estado do corpo e da mente</h2></div></div>${hpFields(p,true)}</article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ATRIBUTOS</span><h2>Distribuição de Atributos</h2></div><strong id="attrRemaining">Restam ${allocationRemaining(p).attrs}</strong></div><div class="attribute-grid">${attrs.map(a=>`<label class="attribute-box"><span class="attr-icon">${uiAttrIcon(a)}</span><span class="attr-name">${esc(a)}</span><input class="pAttr" data-attr="${esc(a)}" type="number" min="0" max="8" value="${draftAttrs?.[a]||0}"><span class="attr-cap">/ 8</span></label>`).join('')}</div><button class="btn primary" id="saveAttrs">Salvar atributos</button></article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">PERÍCIAS</span><h2>Distribuição de Perícias</h2></div><strong id="skillRemaining">Restam ${allocationRemaining(p).skills}</strong></div><div class="skills-groups"><div class="skill-group">${skills.map(sk=>`<label class="skill-line"><span class="skill-name"><i class="skill-icon">${uiSkillIcon(sk)}</i><span>${esc(sk)}</span></span><input class="pSkill" data-skill="${esc(sk)}" type="number" min="0" max="15" value="${draftSkills?.[sk]||0}"><b>/15</b></label>`).join('')}</div></div><button class="btn primary" id="saveSkills">Salvar perícias</button></article>
  <article class="sheet-card dice-section-fixed dice-v2"><div class="section-heading"><div><span class="section-kicker">ARS ALEAE</span><h2>Rolagem de dados</h2></div><span class="dice-type">DADOS</span></div><div class="dice-v2-layout"><div class="dice-skull-wrap"><div class="dice-skull-visual" id="diceSkullVisual"><img src="/d20-skull.jpg" alt="Símbolo da rolagem"><div class="dice-result-overlay"><span id="diceResultValue">${last?esc(last.value):'—'}</span><small id="diceResultDie">${esc(last?.die||last?.label||'ESCOLHA UM DADO')}</small></div></div></div><div class="dice-controls"><p class="dice-description">Escolha o dado ou use uma expressão como <strong>d10+6</strong>, <strong>2d6</strong> ou <strong>1d20-2</strong>.</p><div class="dice-expression-row"><input id="diceExpression" placeholder="Ex.: d10+6"><button class="btn gold" type="button" id="rollExpression">Rolar expressão</button></div><div class="dice-buttons">${[4,6,8,10,12,20,100].map(d=>`<button type="button" class="dice-choice ${d===20?'featured':''}" data-roll-die="${d}"><b>D${d}</b><span>Rolar</span></button>`).join('')}</div><div class="dice-current" id="rollStatus">${last?`Último resultado: <strong>${esc(last.value)}</strong> em ${esc(last.die||last.label||'d20')}`:'Pronto para rolar. Escolha um dado acima.'}</div></div></div><div class="roll-history dice-history-v2">${rolls.slice().reverse().slice(0,12).map(r=>`<div class="roll-entry" data-roll-id="${esc(r.id||'')}"><strong>${esc(rollDisplayText(r))}</strong><span>${esc(r.die||r.label||'d20')}</span><time>${esc(r.time||'')}</time></div>`).join('')||'<div class="empty">Nenhuma rolagem ainda.</div>'}</div></article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ESTADOS</span><h2>Condições atuais</h2></div></div>${conditionsMarkup(p)}</article>
  ${spellMarkup(p)}
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">ALMA</span><h2>O que permanece</h2></div></div><div class="field"><label>Sua alma</label><input id="soul" value="${esc(p.soul||'')}"></div><div class="field"><label>Objetos queridos</label><textarea id="belovedObjects" rows="4">${esc(p.belovedObjects||'')}</textarea></div><div class="story-grid"><div class="field"><label>Personalidade</label><textarea id="personality" rows="5">${esc(p.personality||'')}</textarea></div><div class="field"><label>Destino</label><textarea id="destiny" rows="5">${esc(p.destiny||'')}</textarea></div></div></article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">DESCRIÇÃO & HISTÓRIA</span><h2>Sua história</h2></div></div><div class="story-grid"><div class="field"><label>Descrição</label><textarea id="description" rows="6">${esc(p.description||'')}</textarea></div><div class="field"><label>História</label><textarea id="history" rows="6">${esc(p.history||'')}</textarea></div></div><button class="btn primary" id="saveHistory">Salvar descrição e história</button></article>
  <article class="sheet-card notes-card"><div class="section-heading"><div><span class="section-kicker">ANOTAÇÕES DO PLAYER</span><h2>Seu registro privado</h2></div></div><textarea id="playerNotes" rows="6">${esc(p.playerNotes||'')}</textarea></article>
  <article class="sheet-card"><div class="section-heading"><div><span class="section-kicker">MOCHILA</span><h2>${cap} espaços • peso dinâmico</h2></div></div><div class="slot-grid">${bagHtml}</div><div class="row" style="margin-top:12px"><button class="btn small" id="addBagItem">Adicionar item</button></div></article>
  </section><aside class="sheet-side"><article class="sheet-card sticky-card"><div class="section-heading"><div><span class="section-kicker">CLASSE ATUAL</span><h2>${esc(p.class||'Não escolhida')}</h2></div></div><p class="muted">A ficha entrou no modo de recuperação visual, mas seus dados principais continuam disponíveis.</p></article></aside></div>`,'sheet');
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
  if(event==='secret-clue'){if(nexusIsMaster()||String(payload.targetLogin||'').toLowerCase()!==String(state.session?.login||'').toLowerCase())return;storeSecretClue(payload.clue||{});toast('Você recebeu uma informação secreta.');render(currentView||'home');return}
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
function nexusPage(){const n={...defaultNexus(),...(state.nexus||{})};const master=nexusIsMaster();return shell(`<section class="hero nexus-hero"><span class="badge">NEXUS TABLETOP</span><h1>${esc(n.title||'Nexus Tabletop')}</h1><p>${master?'Transmita a janela ou tela do Nexus para os Players. O vídeo é enviado diretamente entre os navegadores.':'Acompanhe a transmissão do Mestre sem sair de A Profecia.'}</p><div class="nexus-status ${n.active?'live':''}"><span id="nexusViewerState">${n.active?(master?'TRANSMISSÃO ATIVA':'CONECTANDO...'):'AGUARDANDO TRANSMISSÃO'}</span></div></section><section class="nexus-stage"><div class="nexus-video-wrap"><video id="nexusPlayerVideo" autoplay playsinline controls></video><div class="nexus-placeholder" id="nexusPlaceholder"><span>◇</span><strong>${n.active?'Conectando ao Nexus…':'Nenhuma transmissão ativa'}</strong><small>${master?'Clique em transmitir e escolha a janela do Nexus.':'Quando o Mestre iniciar, a imagem aparecerá aqui.'}</small></div></div><div class="nexus-controls">${master?`<div class="field"><label>Nome da transmissão</label><input id="nexusTitle" value="${esc(n.title||'Nexus Tabletop')}" placeholder="Nexus Tabletop"></div><div class="field"><label>Link opcional do Nexus</label><input id="nexusUrl" value="${esc(n.url||'')}" placeholder="https://..."></div><div class="row"><button class="btn primary" id="nexusStart">${n.active?'Transmitindo…':'Transmitir Nexus'}</button>${n.active?'<button class="btn danger" id="nexusStop">Parar transmissão</button>':''}${n.url?`<a class="btn ghost" href="${esc(safeHref(n.url))}" target="_blank" rel="noopener">Abrir Nexus</a>`:''}</div><p class="tiny muted">A transmissão depende do suporte WebRTC do navegador e de HTTPS. O áudio da aba pode ser compartilhado quando o navegador oferecer essa opção.</p>`:`<div class="nexus-player-note"><strong>Visualização dos Players</strong><p>Esta tela mostra somente a transmissão do Mestre. O controle do Nexus continua com quem estiver conduzindo a mesa.</p><button class="btn gold" id="nexusReconnect">Conectar novamente</button></div>`}</div></section>`,'nexus')}
function bindNexus(){const video=document.getElementById('nexusPlayerVideo');if(!nexusIsMaster()&&nexusRemoteStream&&video){video.srcObject=nexusRemoteStream;video.play().catch(()=>{});document.getElementById('nexusPlaceholder')?.classList.add('hidden');updateNexusViewerState(true)}if(nexusIsMaster()&&nexusLocalStream&&video){video.srcObject=nexusLocalStream;document.getElementById('nexusPlaceholder')?.classList.add('hidden')}if(!nexusIsMaster()&&nexusPlayerPc){video?.addEventListener('loadedmetadata',()=>{document.getElementById('nexusPlaceholder')?.classList.add('hidden')},{once:true})}if(nexusIsMaster()){document.getElementById('nexusStart')?.addEventListener('click',async()=>{const title=document.getElementById('nexusTitle')?.value.trim()||'Nexus Tabletop',url=document.getElementById('nexusUrl')?.value.trim()||'';state.nexus={...defaultNexus(),...(state.nexus||{}),title,url};await saveGlobalNow().catch(()=>{});if(!state.nexus.active)await nexusStartShare()});document.getElementById('nexusStop')?.addEventListener('click',nexusStopShare);if(state.nexus?.active&&!nexusLocalStream){state.nexus.active=false;saveGlobalNow().catch(()=>{});toast('A transmissão anterior foi encerrada porque o Mestre recarregou a página.');}}else{document.getElementById('nexusReconnect')?.addEventListener('click',nexusJoin);if(state.nexus?.active){setTimeout(nexusJoin,250)}}}
function secretCluesKey(){return `a_profecia_secret_clues_${String(state.session?.login||'').toLowerCase()}`}
function getSecretClues(){const p=player();if(p&&Array.isArray(p.secretClues))return p.secretClues;try{return JSON.parse(localStorage.getItem(secretCluesKey())||'[]')||[]}catch{return []}}
function storeSecretClue(clue){const p=player();const safe={...clue,id:clue.id||`secret-${Date.now()}`,receivedAt:Number(clue.receivedAt)||Date.now()};if(p){p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];if(!p.secretClues.some(x=>String(x.id)===String(safe.id)))p.secretClues.unshift(safe);p._syncUpdatedAt=Date.now();save();syncPlayersDbNow().catch(()=>{});}try{const list=getSecretClues();if(!list.some(x=>String(x.id)===String(safe.id))){list.unshift(safe);localStorage.setItem(secretCluesKey(),JSON.stringify(list.slice(0,100)))}}catch{}}
function secretCluesPage(){const clues=getSecretClues();return shell(`<section class="hero"><span class="badge">REGISTRO OCULTO</span><h1>Pistas secretas</h1><p>Informações enviadas somente para este personagem. Elas ficam salvas na ficha do Player.</p></section><section class="secret-clue-grid">${clues.length?clues.map(c=>`<article class="card secret-clue-card"><div class="secret-clue-mark">?</div><div><span class="section-kicker">CONFIDENCIAL</span><h2>${esc(c.title||'Informação')}</h2><p>${esc(c.message||'')}</p><small>${new Date(c.receivedAt||Date.now()).toLocaleString('pt-BR')}</small></div></article>`).join(''):'<div class="card empty">Nenhuma informação secreta foi recebida.</div>'}</section>`,'home')}
function secretCluesAdmin(){return `<div class="card"><div class="row space"><div><h2>Pistas secretas</h2><p class="small muted">A pista é gravada diretamente na ficha do Player escolhido e também enviada em tempo real.</p></div></div><div class="secret-send-grid"><div class="field"><label>Player</label><select id="secretTarget">${state.players.map(p=>`<option value="${esc(p.login)}">${esc(p.name||p.login)} • ${esc(p.login)}</option>`).join('')}</select></div><div class="field"><label>Título</label><input id="secretTitle" placeholder="Ex.: Você ouviu alguma coisa"></div><div class="field secret-message-field"><label>Informação</label><textarea id="secretMessage" rows="7" placeholder="Somente esse Player verá esta mensagem."></textarea></div></div><div class="row"><button class="btn primary" id="sendSecretClue">Enviar informação secreta</button></div><p class="tiny muted">Mesmo que o Player esteja offline, a pista permanecerá na ficha e aparecerá quando ele entrar.</p></div>`}
async function sendSecretClue(){const target=String(document.getElementById('secretTarget')?.value||'').trim(),title=document.getElementById('secretTitle')?.value.trim()||'Informação confidencial',message=document.getElementById('secretMessage')?.value.trim()||'';if(!target||!message){toast('Escolha um Player e escreva a informação.');return}const p=state.players.find(x=>String(x.login||'').toLowerCase()===target.toLowerCase());if(!p){toast('Player não encontrado.');return}p.secretClues=Array.isArray(p.secretClues)?p.secretClues:[];const clue={id:`secret-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title,message,receivedAt:Date.now()};p.secretClues.unshift(clue);p._syncUpdatedAt=Date.now();save();try{await syncPlayersDbNow();}catch(e){toast('A pista foi salva localmente, mas não foi possível sincronizá-la agora.');return}broadcastLive('secret-clue',{targetLogin:target,clue}).catch(()=>{});toast(`Informação enviada e salva na ficha de ${target}.`);document.getElementById('secretMessage').value='';}

function soundsAdmin(){return `<div class="card"><div class="row space"><div><h2>Soundboard sincronizado</h2><p class="small muted">Salve seus áudios no armazenamento da campanha. O Mestre dispara um efeito e todos os Players recebem o mesmo som em tempo real.</p></div><button class="btn" id="soundStopMaster">■ Parar sons locais</button></div><div class="sound-upload-panel"><div class="input-grid"><div class="field"><label>Nome</label><input id="soundName" placeholder="Ex.: Porta pesada, passos, grito..."></div><div class="field"><label>Categoria</label><select id="soundCategory"><option>Ambiente</option><option>Impacto</option><option>Terror</option><option>Vozes</option><option>Natureza</option><option>Objetos</option><option>Outros</option></select></div><div class="field"><label>Arquivo de áudio</label><input id="soundFile" type="file" accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.opus,.webm"></div></div><div class="field"><label>Ou URL direta</label><input id="soundUrl" placeholder="https://.../som.mp3"></div><div class="row"><button class="btn primary" id="addSound">+ Salvar som na biblioteca</button><span class="tiny muted">Arquivos até 25 MB • MP3/WAV/OGG/M4A e formatos compatíveis com o navegador.</span></div></div><div class="sound-library-grid">${state.sounds?.length?state.sounds.map(s=>`<article class="sound-library-card"><div class="sound-library-icon">♪</div><div class="sound-library-meta"><span>${esc(s.category||'Outros')}</span><strong>${esc(s.name)}</strong><small>${s.kind==='file'?'Arquivo local antigo — reenvie para sincronizar':'Áudio global'}</small></div><div class="row"><button class="btn small" data-play-sound="${esc(s.id)}">▶ Testar</button><button class="btn small danger" data-del-sound="${esc(s.id)}">Excluir</button></div></article>`).join(''):'<div class="empty">Sua biblioteca de sons está vazia.</div>'}</div></div>`}

function symbolsAdmin(){return `<div class="card"><div class="row space"><div><h2>Símbolos da ficha</h2><p class="small muted">Somente o Mestre pode alterar os símbolos de atributos, perícias e condições. Você pode usar texto/emoji ou enviar uma imagem; imagens pequenas são otimizadas antes de salvar.</p></div></div><div class="symbol-editor"><div><h3>Atributos</h3>${allAttrs().map(a=>`<div class="symbol-row"><span>${uiAttrIcon(a)} ${esc(a)}</span><div class="symbol-controls"><input class="uiAttrIconInput" data-symbol-attr="${esc(a)}" value="${esc(state.uiIcons?.attrs?.[a]||DEFAULT_ATTR_ICONS[a])}"><label class="btn small">Imagem<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-symbol-file="attr" data-symbol-key="${esc(a)}" hidden></label></div></div>`).join('')}</div><div><h3>Perícias</h3>${allSkills().map(sk=>`<div class="symbol-row"><span>${uiSkillIcon(sk)} ${esc(sk)}</span><div class="symbol-controls"><input class="uiSkillIconInput" data-symbol-skill="${esc(sk)}" value="${esc(state.uiIcons?.skills?.[sk]||DEFAULT_SKILL_ICONS[sk])}"><label class="btn small">Imagem<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-symbol-file="skill" data-symbol-key="${esc(sk)}" hidden></label></div></div>`).join('')}</div></div><div class="divider"></div><h3>Ícones das condições</h3><div class="condition-upload-admin">${CONDITION_DEFS.map(c=>{const img=state.uiIcons?.conditions?.[c.id]||c.image;return `<div class="condition-admin-row"><div>${img?`<img class="condition-admin-icon" src="${esc(img)}" alt="">`:''}<strong>${esc(c.name)}</strong></div><label class="btn small">Alterar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-condition-image="${c.id}" hidden></label></div>`}).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" id="saveSymbols">Salvar símbolos de texto</button></div></div>`}
function spellsAdmin(){return `<div class="card"><div class="row space"><div><h2>Magias iniciais</h2><p class="small muted">O Mestre controla as imagens. Os Players só podem escolher uma magia inicial quando a classe permitir.</p></div></div><div class="spell-admin-grid">${getSpells().map(sp=>`<div class="spell-admin-card">${sp.image?`<img class="spell-image" src="${esc(sp.image)}" alt="">`:'<div class="spell-upload-placeholder">✦</div>'}<strong>${esc(sp.name)}</strong><small>${esc(sp.school)} • ${esc(sp.cost)}</small><label class="upload-label">Enviar imagem<input type="file" accept="image/png,image/jpeg,image/webp,.jfif" data-spell-image="${esc(sp.id)}" hidden></label>${sp.image?'<button class="btn small danger" data-clear-spell-image="'+esc(sp.id)+'">Remover imagem</button>':''}</div>`).join('')}</div></div>`}

function masterFicha(){return shell(`<section class="hero"><span class="badge">FICHAS</span><h1>Fichas dos Players</h1><p>Os Players criados pelo Mestre ficam reunidos aqui. Abra uma ficha para consultar seus dados ou edite pelo botão de edição.</p></section><div class="master-player-grid">${state.players.map((p,i)=>`<article class="master-player-card"><div class="master-player-avatar"><img src="${esc(p.photo||'ritual.webp')}" alt=""></div><div class="master-player-info"><span class="section-kicker">PLAYER</span><h2>${esc(p.name||'Sem nome')}</h2><p>${esc(p.class||'Classe não escolhida')} • ${esc(p.status||'Ativo')}</p><div class="master-player-stats"><span>VIDA <b>${p.hp||0}/${derivedMax(p,'Corpo')||1}</b></span><span>SANIDADE <b>${p.sanity||0}/${derivedMax(p,'Sanidade')}</b></span><span>MOCHILA <b>${bagWeight(p)}/${MAX_BAG}</b></span></div><div class="row"><button class="btn small" data-view-player="${i}" data-player-id="${esc(p.id||String(i))}">Abrir ficha</button><button class="btn small" data-edit-p="${i}">Editar</button><button class="btn small" data-bag-p="${i}">Mochila</button><button class="btn small danger" data-del-p="${i}">Excluir</button></div></div></article>`).join('')||'<div class="empty">Nenhum Player cadastrado.</div>'}</div><div class="master-ficha-note"><strong>Persistência</strong><span>Os registros permanecem salvos neste ambiente até o Mestre excluí-los.</span></div>`,`sheet`)}

function privateDiaryKey(){return `a_profecia_diary_${String(state.session?.login||'').toLowerCase()}`}
function getPrivateDiary(){try{return JSON.parse(localStorage.getItem(privateDiaryKey())||'{"text":"","updatedAt":0}')||{text:'',updatedAt:0}}catch{return {text:'',updatedAt:0}}}
function savePrivateDiary(text){try{localStorage.setItem(privateDiaryKey(),JSON.stringify({text:String(text||''),updatedAt:Date.now()}));return true}catch{return false}}
function diaryPage(){const p=player(),d=getPrivateDiary();return shell(`<section class="hero"><span class="badge">REGISTRO PRIVADO</span><h1>Meu Diário</h1><p>Suas anotações ficam neste dispositivo e não são enviadas para o Mestre nem para os outros Players.</p></section><section class="diary-layout diary-layout-single"><article class="card diary-editor"><div class="section-heading"><div><span class="section-kicker">ANOTAÇÕES PESSOAIS</span><h2>${esc(p?.name||'Player')}</h2></div><span class="corner-mark">PRIVADO</span></div><textarea id="privateDiaryText" rows="24" placeholder="Escreva pistas, teorias, nomes, suspeitas e acontecimentos...">${esc(d.text)}</textarea><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="savePrivateDiary">Salvar diário</button></div></article></section>`,'diary')}
function libraryPage(){const p=player();const books=(p?.backpack||[]).map(b=>item(b.id)).filter(it=>it&&(Array.isArray(it.bookPages)&&it.bookPages.length||it.bookContent||String(it.category||'').toLowerCase().includes('livro')));return shell(`<section class="hero"><span class="badge">ARQUIVO</span><h1>Biblioteca</h1><p>Livros que estão na sua mochila ficam disponíveis aqui para leitura.</p></section><section class="library-grid">${books.length?books.map(it=>`<article class="card library-book-card"><div class="library-book-icon">${itemIcon(it)}</div><div><span class="section-kicker">LIVRO</span><h2>${esc(it.name)}</h2><p class="small muted">${esc(it.description||'Sem descrição.')}</p><button class="btn gold" data-read-book="${it.id}">Ler livro</button></div></article>`).join(''):'<div class="card empty">Nenhum livro está na sua mochila no momento.</div>'}</section>`,'library')}

function isTvMode(){
  try{return new URLSearchParams(location.search).get('tv')==='1'||location.hash==='#tv'}catch{return false}
}
function tvSceneById(id){return (Array.isArray(state.tvScenes)?state.tvScenes:[]).find(s=>String(s.id)===String(id));}
// V65.11: se o navegador bloquear o play() com som (antes do toque inicial em
// "Iniciar Tela da TV"), tenta de novo mudo — melhor mostrar a cena sem áudio
// do que a tela ficar travada/preta.
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
    const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.preload='auto';v.loop=!!s.loop;v.src=s.url;v.className='tv-layer tv-enter';
    stage.appendChild(v);
    const swap=()=>{if(!v.isConnected)return;v.classList.remove('tv-enter');v.classList.add('tv-visible');if(old&&old!==v){old.classList.add('tv-exit');setTimeout(()=>old.remove(),280)}finish();playTvVideo(v)};
    v.addEventListener('canplay',swap,{once:true});
    v.addEventListener('error',()=>{if(!old)v.remove();finish()},{once:true});
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
    <a class="btn gold" href="${esc(tvUrl)}" target="_blank" rel="noopener">Abrir Tela da TV</a>
    <button type="button" class="btn" id="copyTvUrl">Copiar link</button></div>
    <div class="tv-connect-note"><strong>Endereço da Tela da TV</strong><code>${esc(tvUrl)}</code><span>Fire TV Stick: instale o navegador "Silk Browser" (ou "Firefox for Fire TV") pela Amazon Appstore, abra-o e digite/cole este endereço. Depois de abrir, dê um OK no botão "Iniciar Tela da TV" que aparece na tela — isso libera o som dos vídeos no controle remoto. Roku: o site não consegue instalar/controlar um app Roku por conta própria; use um dispositivo com navegador (Fire TV, tablet, notebook) ligado à TV.</span></div>
    <div class="tv-upload-grid">
      <div class="field"><label>Nome da cinemática</label><input id="tvSceneName" placeholder="Ex.: A porta se abre"></div>
      <div class="field"><label>Vídeo local</label><input id="tvSceneFile" type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.ogg"></div>
      <div class="field"><label>Ou URL direta</label><input id="tvSceneUrl" placeholder="https://.../cena.mp4"></div>
      <label class="checkline"><input id="tvSceneLoop" type="checkbox"> Repetir em loop</label>
      <button class="btn primary" id="saveTvScene">+ Adicionar cinemática</button>
    </div>
    <div class="tv-quick-grid">
      <button class="btn danger" id="tvRed">🔴 Tela vermelha</button>
      <button class="btn" id="tvBlack">■ Tela preta</button>
    </div>
    <div class="tv-library">${scenes.length?scenes.map(s=>`<article class="tv-scene-card"><div class="tv-scene-thumb">${s.kind==='video'?'▶':s.kind==='image'?'▧':'●'}</div><div><strong>${esc(s.name)}</strong><small>${s.loop?'Loop • ':''}Cinemática</small></div><div class="row"><button class="btn small primary" data-tv-play="${esc(s.id)}">Exibir</button><button class="btn small danger" data-tv-delete="${esc(s.id)}">Excluir</button></div></article>`).join(''):'<div class="empty">Nenhuma cinemática cadastrada ainda.</div>'}</div>
  </div>`;
}
function bindTvAdmin(){
  document.getElementById('copyTvUrl')?.addEventListener('click',async()=>{
    const url=`${location.origin}${location.pathname}?tv=1`;
    try{await navigator.clipboard.writeText(url);toast('Link da Tela da TV copiado.')}
    catch{toast('Não foi possível copiar automaticamente. Selecione o link acima manualmente.')}
  });
  document.getElementById('saveTvScene')?.addEventListener('click',async()=>{
    const btn=document.getElementById('saveTvScene'),file=document.getElementById('tvSceneFile')?.files?.[0],url=document.getElementById('tvSceneUrl')?.value.trim()||'',name=document.getElementById('tvSceneName')?.value.trim()||file?.name?.replace(/\.[^.]+$/,'')||'Cinemática',loop=!!document.getElementById('tvSceneLoop')?.checked;
    if(!file&&!url){toast('Escolha um vídeo ou informe uma URL direta.');return}
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
      state.tvScenes.push({id:`tv-${Date.now()}`,name,url:remoteUrl,kind:'video',loop,createdAt:Date.now()});
      await saveGlobalNow();toast('Cinemática adicionada e sincronizada.');document.getElementById('adminContent').innerHTML=tvAdmin();bindTvAdmin();
    }catch(e){toast(`Não foi possível salvar a cinemática: ${e?.message||'erro'}`)}
    finally{btn.disabled=false;btn.textContent='+ Adicionar cinemática'}
  });
  document.querySelectorAll('[data-tv-play]').forEach(b=>b.onclick=async()=>{
    const scene=tvSceneById(b.dataset.tvPlay);if(!scene)return;
    state.tvScreen={active:true,kind:scene.kind||'video',url:scene.url||'',title:scene.name||'',loop:!!scene.loop,commandAt:Date.now(),updatedAt:Date.now()};
    await saveGlobalNow().catch(()=>{});
    broadcastLive('tv-scene',{screen:state.tvScreen}).catch(()=>{});
    toast(`Exibindo: ${scene.name}`);
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
  // V65.11: navegadores de TV (Fire TV/Silk, Chromecast com Google TV, tablets)
  // bloqueiam áudio/vídeo automático até um toque real do usuário. Sem isto, as
  // cinemáticas podiam simplesmente não tocar com som nesses aparelhos. Também
  // resolve o botão de tela cheia ser praticamente invisível sem mouse (dependia
  // de :hover, que controle remoto/toque não têm).
  const startBtn=document.getElementById('tvStartButton'),startOverlay=document.getElementById('tvStartOverlay');
  startBtn?.focus();
  startBtn?.addEventListener('click',()=>{
    document.documentElement.requestFullscreen?.().catch(()=>{});
    const v=document.querySelector('#tvStage video');
    if(v){v.muted=false;v.play().catch(()=>{})}
    startOverlay?.remove();
  });
  // V65.11: Fire TV e tablets suspendem a aba ao trocar de entrada HDMI ou app;
  // ao voltar a ficar visível, reaplica a cena atual em vez de arriscar ficar
  // com a tela travada num estado antigo.
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
function bindSiteBrand(){const preview=document.getElementById('siteBrandPreview');const input=document.getElementById('siteBrandImage');input?.addEventListener('change',()=>{const f=input.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>5*1024*1024){toast('Imagem inválida ou maior que 5 MB.');input.value='';return}if(preview){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);const u=URL.createObjectURL(f);preview.dataset.objectUrl=u;preview.src=u;}});document.getElementById('clearSiteBrandImage')?.addEventListener('click',()=>{state.siteBrand=state.siteBrand||{};state.siteBrand.image='runa-gold.png';save();applySiteBrand();toast('Imagem principal restaurada.');document.getElementById('adminContent').innerHTML=siteBrandAdmin();bindSiteBrand()});document.getElementById('saveSiteBrand')?.addEventListener('click',async()=>{const name=document.getElementById('siteBrandName')?.value.trim()||'A Profecia';const f=input?.files?.[0];try{let image=state.siteBrand?.image||'runa-gold.png';if(f){if(!remoteEnabled){const data=await imageFileToDataURL(f,900,.82);image=data}else{const ext=(f.name.split('.').pop()||'png').replace(/[^a-z0-9]/gi,'')||'png';image=await uploadGlobalFile(`branding/site-${Date.now()}.${ext}`,f);if(!image)throw new Error('URL da imagem não disponível')}}state.siteBrand={name,image};await saveGlobalNow();applySiteBrand();toast('Identidade do site atualizada globalmente.');render('master')}catch(e){toast('Não foi possível salvar a identidade do site.')}})}

function recoveryAdmin(){return `<div class="card"><div class="row space"><div><span class="section-kicker">SEGURANÇA</span><h2>Recuperação de dados</h2><p class="small muted">Esta versão cria cópias locais automáticas antes de sincronizar com o Supabase e impede que um estado remoto claramente menor substitua silenciosamente o estado local.</p></div></div><div class="row"><button class="btn primary" id="restoreLatestLocal">Restaurar último backup local</button><button class="btn" id="makeRecoveryNow">Criar backup agora</button><button class="btn" id="restoreRemoteBackup">Ver backups do Supabase</button></div><div id="recoveryList" class="recovery-list"></div><p class="tiny muted">Importante: backups automáticos desta proteção começam a existir a partir desta versão. Eles não conseguem recriar um arquivo que já tenha sido apagado do Supabase antes desta atualização.</p></div>`}
async function bindRecovery(){document.getElementById('makeRecoveryNow')?.addEventListener('click',async()=>{await saveLocalRecovery('backup-manual');toast('Backup local criado.');});document.getElementById('restoreLatestLocal')?.addEventListener('click',async()=>{if(!confirm('Restaurar o último backup local? O estado atual será salvo antes da restauração.'))return;try{await restoreLocalRecovery()}catch(e){toast(e?.message||'Não foi possível restaurar.')}});document.getElementById('restoreRemoteBackup')?.addEventListener('click',async()=>{const box=document.getElementById('recoveryList');if(!box)return;box.innerHTML='<div class="empty">Carregando backups...</div>';try{const rows=await listGlobalBackups(20);box.innerHTML=rows.length?rows.map((r,i)=>`<div class="recovery-row"><div><strong>Backup ${i+1}</strong><small>${new Date(r.updated_at).toLocaleString('pt-BR')}</small></div><button class="btn small" data-remote-recovery="${esc(r.id)}">Restaurar</button></div>`).join(''):'<div class="empty">Nenhum backup remoto disponível ainda.</div>';box.querySelectorAll('[data-remote-recovery]').forEach(b=>b.onclick=async()=>{const rows2=await listGlobalBackups(20),r=rows2.find(x=>x.id===b.dataset.remoteRecovery);if(!r?.data)return;if(!confirm('Restaurar este backup remoto? O estado atual será salvo antes.'))return;try{await saveLocalRecovery('antes-da-restauracao-remota');const d=clone(r.data);delete d.__backup;remoteApplying=true;mergeGlobal(d);await pushGlobal(globalPayload());remoteApplying=false;storageSet(KEY,serializeState());render('master');toast('Backup remoto restaurado.')}catch(e){remoteApplying=false;toast(e?.message||'Falha ao restaurar backup remoto.')}})}catch(e){box.innerHTML='<div class="empty">Não foi possível consultar os backups.</div>'}})}
function admin(){return shell(`<section class="hero master-hero"><div><span class="badge">MESTRE</span><h1>Câmara do Mestre</h1><p>Gerenciamento completo de Players, Monstros, classes, itens e trilha.</p></div><span class="app-version-corner">${APP_VERSION}</span></section><div class="panel-tabs"><button class="active" data-tab="players">Players</button><button data-tab="monsters">Monstros</button><button data-tab="classes">Classes</button><button data-tab="items">Banco de Itens</button><button data-tab="music">Trilha global</button><button data-tab="sounds">Soundboard</button><button data-tab="secrets">Pistas secretas</button><button data-tab="symbols">Símbolos</button><button data-tab="spells">Magias</button><button data-tab="content">Conteúdo</button><button data-tab="backgrounds">Fundos</button><button data-tab="branding">Identidade</button><button data-tab="tv">Tela da TV</button><button data-tab="recovery">RECUPERAÇÃO</button></div><div id="adminContent">${playersAdmin()}</div>`,'master')}
function playersAdmin(){return `<div class="card"><div class="row space"><div><h2>Players</h2><p class="small muted">Criar, editar, excluir e controlar fichas.</p></div><div class="row"><button class="btn" id="openCharacterRules">⚙ Limites de criação</button><button class="btn" id="changeMasterPw">🔑 Senha do Mestre</button><button class="btn primary" id="newPlayer">+ Criar Player</button></div></div><div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Nome</th><th>Login</th><th>Tipo</th><th>Classe</th><th>Vida</th><th>Ataque</th><th>Defesa</th><th>Mochila</th><th>Ações</th></tr></thead><tbody>${state.players.map((p,i)=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.login)}</td><td>${p.campaignType==='slasher'?'Slasher':'Campanha'}</td><td>${esc(p.class)}</td><td>${p.hp}/${p.hpMax}</td><td>${derivedCombat(p).atk}</td><td>${derivedCombat(p).def}</td><td>${bagWeight(p)}/${MAX_BAG}</td><td><button class="btn small" data-edit-p="${i}">Editar</button> <button class="btn small" data-bag-p="${i}">Mochila</button> <button class="btn small" data-round-p="${i}">+ Rodada</button> <button class="btn small danger" data-del-p="${i}">Excluir</button></td></tr>`).join('')}</tbody></table></div></div>`}

function bagAdminModal(index){const p=state.players[index],used=bagWeight(p);return `<div class="modal" id="bagModal"><div class="modal-card"><button class="modal-close" id="closeBag">×</button><h2>Mochila de ${esc(p.name)}</h2><p class="small ${used>MAX_BAG?'danger-text':'muted'}">${used}/${bagCapacity(p)} espaços usados. O peso é por unidade e varia de 1 a 3.</p><div class="searchbar"><div class="field"><label>ID ou nome do item</label><input id="bagSearch" placeholder="Ex.: 300 ou Chave"></div><div class="field"><label>Quantidade</label><input id="bagQty" type="number" min="1" value="1"></div><button class="btn primary" id="bagAddAdmin">Adicionar</button></div><div class="slot-grid" style="margin-top:14px">${Array.from({length:bagCapacity(p)},(_,i)=>{const b=p.backpack[i],it=b&&item(b.id);return `<div class="slot ${it?'filled':''}">${it?`<button data-bag-remove-admin="${i}">×</button><div class="slot-icon">${itemIcon(it)}</div><div class="slot-name">${esc(it.name)}</div>${isWeaponItem(it)?`<div class="slot-damage">⚔️ Dano: ${esc(it.damage||weaponDamageFallback(it))}</div>`:''}${String(it.category||'').toLowerCase().includes('livro')||it.bookContent?`<button class="book-read-btn" data-read-book="${it.id}">Ler</button>`:''}<div class="slot-id">ID ${String(it.id).padStart(3,'0')} • Peso ${inferWeight(it)}</div><div class="slot-qty">Qtd. ${b.qty} • ${inferWeight(it)*b.qty} espaço${inferWeight(it)*b.qty===1?'':'s'}</div>`:'<div class="slot-icon" style="opacity:.15">◇</div><div class="small muted">Espaço vazio</div>'}</div>`}).join('')}</div></div></div>`}
function bindBagAdmin(index){const close=()=>document.getElementById('bagModal')?.remove();document.getElementById('closeBag').onclick=close;document.getElementById('bagAddAdmin').onclick=()=>{const p=state.players[index],q=document.getElementById('bagSearch').value.trim().toLowerCase(),it=state.items.find(x=>String(x.id)===q||x.name.toLowerCase().includes(q));if(!it){toast('Item não encontrado.');return}const qty=Math.max(1,Number(document.getElementById('bagQty').value)||1),weight=inferWeight(it),used=bagWeight(p),ex=p.backpack.find(x=>x.id===it.id),current=ex?.qty||0,maxByWeight=Math.floor((bagCapacity(p)-(used-weight*current))/weight),add=Math.min(it.maxQty-current,qty,maxByWeight);if(add<=0){toast('Não há espaço suficiente.');return}if(ex)ex.qty=current+add;else p.backpack.push({id:it.id,qty:add});save();close();toast('Item adicionado à mochila.');openModal(bagAdminModal(index));bindBagAdmin(index)};document.querySelectorAll('[data-bag-remove-admin]').forEach(b=>b.onclick=()=>{state.players[index].backpack.splice(Number(b.dataset.bagRemoveAdmin),1);save();close();openModal(bagAdminModal(index));bindBagAdmin(index)})}
function monstersAdmin(){return `<div class="card monster-bank"><div class="row space"><div><span class="section-kicker">BANCO DE CRIATURAS</span><h2>Monstros</h2><p class="small muted">Crie fichas reutilizáveis, acompanhe Vida/Sanidade e adicione qualquer criatura à iniciativa do combate.</p></div><button class="btn primary" id="newMonster">+ Criar Monstro</button></div><div class="searchbar monster-search"><div class="field"><label>Pesquisar criatura</label><input id="monsterSearch" placeholder="Nome do monstro..."></div></div><div id="monsterResults" class="monster-bank-grid"></div></div>`}
function renderMonsters(){const q=(document.getElementById('monsterSearch')?.value||'').toLowerCase().trim();const list=state.creatures.filter(m=>!q||String(m.name||'').toLowerCase().includes(q));const box=document.getElementById('monsterResults');if(!box)return;box.innerHTML=list.length?list.map(m=>{const i=state.creatures.indexOf(m);return `<article class="monster-bank-card"><div class="monster-bank-head"><div><span class="section-kicker">CRIATURA</span><h3>${esc(m.name)}</h3><small>${esc(m.status||'Ativo')} • ATQ ${m.attack||0} • DEF ${m.defense||0}</small></div><div class="monster-sigil">☠</div></div>${resourceBarMarkup('Vida',m.hp,m.hpMax,'health',false)}${resourceBarMarkup('Sanidade',m.sanity||0,m.sanityMax||derivedMax(m,'Sanidade'),'sanity',false)}<div class="monster-bank-actions"><button class="btn small" data-edit-m="${i}">Editar</button><button class="btn small" data-monster-damage="${i}" data-delta="-5">−5 Vida</button><button class="btn small" data-monster-damage="${i}" data-delta="5">+5 Vida</button><button class="btn small" data-round-m="${i}">+ Rodada</button><button class="btn small danger" data-del-m="${i}">Excluir</button></div></article>`}).join(''):'<div class="empty">Nenhum monstro encontrado.</div>'}
function itemsAdmin(){return `<div class="card"><div class="row space"><div><h2>Banco de Itens</h2><p class="small muted">${state.items.length} itens • ID 300 reservado para a Chave.</p></div><button class="btn primary" id="newItem">+ Novo item</button></div><div class="searchbar" style="margin:15px 0"><div class="field"><label>ID ou nome</label><input id="itemSearch" placeholder="300 ou Chave"></div><div class="field"><label>Categoria</label><select id="itemCat"><option value="">Todas</option>${ITEM_CATS.map(c=>`<option>${c}</option>`).join('')}</select></div><div class="field"><label>Raridade</label><select id="itemRar"><option value="">Todas</option><option>Comum</option><option>Raro</option><option>Épico</option><option>Lendário</option></select></div><button class="btn" id="clearItems">Limpar</button></div><div id="itemResults"></div></div>`}
function renderItems(){const q=(document.getElementById('itemSearch')?.value||'').toLowerCase().trim(),cat=document.getElementById('itemCat')?.value||'',rar=document.getElementById('itemRar')?.value||'';const found=state.items.filter(i=>(!q||String(i.id)===q||i.name.toLowerCase().includes(q))&&(!cat||i.category===cat)&&(!rar||i.rarity===rar)).slice(0,80);document.getElementById('itemResults').innerHTML=found.length?`<div class="list">${found.map(i=>`<div class="item item-card"><div class="item-icon">${itemIcon(i)}</div><div class="item-meta"><strong>${esc(i.name)}</strong><div class="line">ID ${String(i.id).padStart(3,'0')} • ${esc(i.category)} • ${esc(i.rarity)} • Máx. ${i.maxQty} • Peso ${inferWeight(i)}</div><div class="small muted">${esc(i.description)}</div></div><div class="row"><button class="btn small" data-edit-item="${i.id}">Editar</button>${i.id!==300?`<button class="btn small danger" data-del-item="${i.id}">Excluir</button>`:''}</div></div>`).join('')}</div><p class="tiny muted">Até 80 resultados exibidos. Use a pesquisa para refinar.</p>`:'<div class="empty">Nenhum item encontrado.</div>'}
function itemModal(id=null){
 const e=id===null?{id:'',name:'',description:'',category:'Comum',maxQty:10,icon:'✦',effects:'',rarity:'Comum',damage:'',bookPages:[]}:clone(item(id));
 const pages=Array.isArray(e.bookPages)&&e.bookPages.length?e.bookPages:(e.bookContent?[String(e.bookContent)]:['']);
 return `<div class="modal" id="itemModal"><div class="modal-card"><button class="modal-close" id="closeItem">×</button><h2>${id===null?'Adicionar novo item':'Editar item'}</h2><div class="input-grid"><div class="field"><label>ID</label><input id="iId" type="number" value="${e.id}" ${id===300?'disabled':''}></div><div class="field"><label>Nome</label><input id="iName" value="${esc(e.name)}"></div><div class="field"><label>Categoria</label><select id="iCat">${ITEM_CATS.map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>Quantidade máxima</label><input id="iMax" type="number" min="1" value="${e.maxQty}"></div><div class="field"><label>Peso por unidade (1–3 espaços)</label><input id="iWeight" type="number" min="1" max="3" value="${inferWeight(e)}"></div><div class="field"><label>Ícone</label><input id="iIcon" value="${esc(e.icon)}"></div><div class="field"><label>Dano da arma</label><input id="iDamage" value="${esc(e.damage||'')}" placeholder="Ex.: 1d8"><small class="tiny muted">Usado quando o item é classificado como Armas ou Armas de Fogo.</small></div><div class="field"><label>Raridade</label><select id="iRar">${['Comum','Raro','Épico','Lendário'].map(r=>`<option ${e.rarity===r?'selected':''}>${r}</option>`).join('')}</select></div></div><div class="field"><label>Descrição</label><textarea id="iDesc" rows="3">${esc(e.description)}</textarea></div><div class="field"><label>Efeitos</label><textarea id="iEffects" rows="3">${esc(e.effects)}</textarea></div><div class="field"><label>Páginas do livro (opcional)</label><p class="tiny muted">Cada página é independente e o Player poderá navegar entre elas.</p><div id="bookPagesEditor">${pages.map((pg,i)=>`<div class="book-page-editor" data-page-index="${i}"><div class="row space"><strong>Página ${i+1}</strong>${pages.length>1?`<button type="button" class="btn small danger" data-remove-book-page="${i}">Excluir página</button>`:''}</div><textarea class="book-page-input" rows="8" placeholder="Escreva o conteúdo da página ${i+1}...">${esc(pg||'')}</textarea></div>`).join('')}</div><button type="button" class="btn small" id="addBookPage">+ Adicionar página</button></div><div class="row" style="justify-content:flex-end"><button class="btn" id="cancelItem">Cancelar</button><button class="btn primary" id="saveItem">Salvar item</button></div></div></div>`;
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
function backgroundsAdmin(){const b=state.backgrounds||{};return `<section class="background-admin"><div class="section-kicker">APARÊNCIA DA PROFECIA</div><h2>Planos de fundo</h2><p class="small muted">O Mestre pode trocar cada fundo separadamente. Com Supabase configurado, os fundos são enviados para o armazenamento online e todos os dispositivos recebem a mesma imagem. Sem Supabase, permanece o modo local. O fundo original volta automaticamente se uma imagem for removida.</p><div class="background-grid">${Object.entries(BG_DEFS).map(([k,d])=>{const cfg=b[k]||{};return `<article class="background-card"><div class="background-preview" data-bg-preview="${k}" style="background-image:linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.15)),url('${esc(cfg.url||cfg.preview||d[1])}')"><span>${esc(d[0])}</span></div><div class="background-meta"><strong>${esc(d[0])}</strong><small>Original: ${esc(d[1])}</small><input type="file" accept="image/png,image/jpeg,image/webp,image/avif,.jfif" data-bg-upload="${k}"><div class="row"><button class="btn small primary" data-bg-save="${k}">Aplicar</button><button class="btn small danger" data-bg-clear="${k}">Restaurar original</button></div></div></article>`}).join('')}</div></section>`}
function bindBackgrounds(){Object.keys(BG_DEFS).forEach(kind=>{const cfg=state.backgrounds?.[kind];if(!cfg?.mediaId)return;bgGet(cfg.mediaId).then(blob=>{if(!blob)return;const u=URL.createObjectURL(blob),preview=document.querySelector(`[data-bg-preview=\"${kind}\"]`);if(preview){preview.style.backgroundImage=`linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.15)),url(\"${u}\")`;}else URL.revokeObjectURL(u)}).catch(()=>{})});document.querySelectorAll('[data-bg-upload]').forEach(inp=>inp.onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)){toast('Escolha uma imagem válida (PNG, JPG, JPEG, JFIF, WEBP ou AVIF).');inp.value='';return}if(f.size>10*1024*1024){toast('A imagem deve ter até 10 MB.');inp.value='';return}const kind=inp.dataset.bgUpload;const card=inp.closest('.background-card'),preview=card?.querySelector('[data-bg-preview]');if(preview){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);const u=URL.createObjectURL(f);preview.dataset.objectUrl=u;preview.style.backgroundImage=`linear-gradient(90deg,rgba(0,0,0,.45),rgba(0,0,0,.15)),url(\"${u}\")`;}inp.dataset.ready='1';});document.querySelectorAll('[data-bg-save]').forEach(btn=>btn.onclick=async()=>{const kind=btn.dataset.bgSave,input=document.querySelector(`[data-bg-upload="${kind}"]`),file=input?.files?.[0];if(!file){toast('Escolha uma imagem antes de aplicar.');return}try{const id=`bg-${kind}-${Date.now()}`;await bgPut(id,file);let remoteUrl='';if(remoteEnabled){const ext=(file.name.split('.').pop()||'img').replace(/[^a-z0-9]/gi,'');remoteUrl=await uploadGlobalFile(`backgrounds/${kind}-${Date.now()}.${ext}`,file)}const old=state.backgrounds?.[kind]?.mediaId;if(old&&old!==id)await bgDelete(old).catch(()=>{});state.backgrounds=state.backgrounds||{};state.backgrounds[kind]={mediaId:id,url:remoteUrl,name:file.name,updatedAt:Date.now()};await saveGlobalNow();await applyBackgrounds(true);toast(`${BG_DEFS[kind][0]} atualizado globalmente.`);document.getElementById('adminContent').innerHTML=backgroundsAdmin();bindBackgrounds()}catch(e){toast('Não foi possível salvar este fundo.');}});document.querySelectorAll('[data-bg-clear]').forEach(btn=>btn.onclick=async()=>{const kind=btn.dataset.bgClear;if(state.backgrounds?.[kind]?.mediaId)await bgDelete(state.backgrounds[kind].mediaId).catch(()=>{});if(state.backgrounds)delete state.backgrounds[kind];await saveGlobalNow();await applyBackgrounds(true);toast(`${BG_DEFS[kind][0]} restaurado globalmente.`);document.getElementById('adminContent').innerHTML=backgroundsAdmin();bindBackgrounds()});}
function classesAdmin(){const slasher=SLASHER_PROFESSION_NAMES.map(n=>[n,state.classBonuses?.[n]||DEFAULT_CLASS_BONUSES[n]||{}]);return `<div class="card"><div class="row space"><div><h2>Classes</h2><p class="small muted">Consulte as classes e ajuste os bônus das profissões Slasher sem alterar as regras das outras classes.</p></div></div><div class="class-book-grid admin-class-grid">${Object.entries(CLASSES).map(([n,c])=>`<article class="class-book-card"><div class="class-card-ornament">◇</div><div class="class-card-head"><h2>${esc(n)}</h2>${hasMagicClass(n)?'<span class="badge">MAGIA / RITUAL</span>':''}</div><p>${esc(c.desc)}</p><div class="class-bonus-line"><strong>Bônus</strong><span>${esc(classBonusText(n))}</span></div><div class="ability-list">${(c.abilities||[]).map(a=>`<div class="ability"><b>${esc(a[0])}</b><div class="small muted">${esc(a[1])}</div></div>`).join('')}</div></article>`).join('')}</div><div class="divider"></div><section class="bonus-editor"><div class="section-heading"><div><span class="section-kicker">MESTRE</span><h3>Bônus das profissões Slasher</h3><p class="small muted">Altere os valores abaixo. Ao salvar, o novo bônus passa a ser usado automaticamente no total efetivo das fichas.</p></div></div><div class="bonus-editor-grid">${slasher.map(([n,b])=>`<div class="bonus-editor-card"><h3>${esc(n)}</h3>${Object.entries(b).map(([key,val])=>`<div class="bonus-editor-row"><span>${esc(key)}</span><input type="number" min="0" max="20" value="${Number(val)||0}" data-class-bonus="${esc(n)}" data-bonus-key="${esc(key)}"></div>`).join('')}</div>`).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" id="saveClassBonuses">Salvar bônus das profissões</button></div></section></div>`}
function contentAdmin(){const c=state.customContent||{attrs:[],skills:[],conditions:[],deities:[]};return `<div class="card content-admin"><div class="section-heading"><div><span class="section-kicker">EDITOR DO MESTRE</span><h2>Conteúdo da campanha</h2></div></div><p class="small muted">Cadastre elementos novos aqui. Eles ficam salvos globalmente e não exigem novo commit.</p><div class="content-admin-grid"><section><h3>Atributo</h3><div class="field"><input id="newAttrName" placeholder="Ex.: Sorte"></div><button class="btn gold" id="addAttr">Adicionar atributo</button><div class="content-list">${(c.attrs||[]).map((x,i)=>`<span>${esc(x.name)} <button data-del-custom="attrs:${i}">×</button></span>`).join('')}</div></section><section><h3>Perícia</h3><div class="field"><input id="newSkillName" placeholder="Ex.: Navegação"></div><button class="btn gold" id="addSkill">Adicionar perícia</button><div class="content-list">${(c.skills||[]).map((x,i)=>`<span>${esc(x.name)} <button data-del-custom="skills:${i}">×</button></span>`).join('')}</div></section><section><h3>Condição</h3><div class="field"><input id="newCondName" placeholder="Nome"></div><div class="field"><input id="newCondEffect" placeholder="Efeito"></div><button class="btn gold" id="addCond">Adicionar condição</button><div class="content-list">${(c.conditions||[]).map((x,i)=>`<span>${esc(x.name)} <button data-del-custom="conditions:${i}">×</button></span>`).join('')}</div></section><section><h3>Deus do Ocultista</h3><div class="field"><input id="newDeityName" placeholder="Nome do Deus"></div><div class="field"><label>Imagem / símbolo</label><input id="newDeityImage" type="file" accept="image/*,.jfif"></div><button class="btn gold" id="addDeity">Adicionar Deus</button><div class="content-list">${(c.deities||[]).map((x,i)=>`<span>${x.image?`<img src="${esc(x.image)}" class="content-thumb">`:''}${esc(x.name)} <button data-del-custom="deities:${i}">×</button></span>`).join('')}</div></section><section><h3>Trilha da introdução Slasher</h3><p class="small muted">Música exibida na tela das perguntas obrigatórias antes das profissões. Aceita URL direta ou arquivo de áudio.</p><div class="field"><input id="slasherMusicTitle" placeholder="Título da trilha" value="${esc(state.slasherIntroMusic?.title||'')}"></div><div class="field"><input id="slasherMusicUrl" placeholder="URL direta do áudio (mp3, wav, ogg...)" value="${esc(state.slasherIntroMusic?.url||'')}"></div><div class="field"><input id="slasherMusicFile" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.webm"></div><div class="row"><button class="btn gold" id="saveSlasherMusic">Salvar trilha do Slasher</button>${state.slasherIntroMusic?.url?'<button class="btn small danger" id="clearSlasherMusic">Remover</button>':''}</div></section><section><h3>Magia</h3><div class="field"><input id="newSpellName" placeholder="Nome da magia"></div><div class="input-grid"><div class="field"><input id="newSpellSchool" placeholder="Escola / círculo"></div><div class="field"><input id="newSpellCost" placeholder="Custo"></div></div><div class="field"><textarea id="newSpellDesc" rows="4" placeholder="Descrição"></textarea></div><div class="field"><label>Imagem</label><input id="newSpellImage" type="file" accept="image/*,.jfif"></div><button class="btn gold" id="addSpell">Adicionar magia</button><div class="content-list">${getSpells().map((x)=>`<span>${x.image?`<img src="${esc(x.image)}" class="content-thumb">`:''}<b>${esc(x.name)}</b> <small>${esc(x.school||'')} • ${esc(x.cost||'—')}</small> <button data-del-spell="${esc(x.id)}">×</button></span>`).join('')}</div></section></div></div>`}
function bindContentAdmin(){const c=state.customContent||{attrs:[],skills:[],conditions:[],deities:[]};const saveSlasherMusic=document.getElementById('saveSlasherMusic');if(saveSlasherMusic)saveSlasherMusic.onclick=async()=>{const title=document.getElementById('slasherMusicTitle')?.value.trim()||'';const file=document.getElementById('slasherMusicFile')?.files?.[0];const url=document.getElementById('slasherMusicUrl')?.value.trim()||'';if(!file&&!url){toast('Informe uma URL ou escolha um arquivo de áudio.');return}try{saveSlasherMusic.disabled=true;let remoteUrl=url;if(file){const ext=(file.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp3';if(!file.type.startsWith('audio/')&&!['mp3','wav','ogg','oga','m4a','aac','flac','opus','webm'].includes(ext)){toast('Arquivo de áudio inválido.');return}if(file.size>50*1024*1024){toast('O arquivo deve ter até 50 MB.');return}if(!remoteEnabled){toast('Configure o Supabase global para enviar arquivos.');return}remoteUrl=await uploadGlobalFile(`slasher-music/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`,file);if(!remoteUrl)throw new Error('URL pública não disponível')}state.slasherIntroMusic={url:remoteUrl,title:title||file?.name?.replace(/\.[^.]+$/,'')||'Trilha do Slasher',kind:'url'};await saveGlobalNow();toast('Trilha da introdução Slasher salva.');document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()}catch(e){console.error(e);toast('Não foi possível salvar a trilha.')}finally{saveSlasherMusic.disabled=false}};document.getElementById('clearSlasherMusic')?.addEventListener('click',async()=>{state.slasherIntroMusic={url:'',title:'',kind:'url'};await saveGlobalNow();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()});const add=(key,val)=>{c[key]=c[key]||[];c[key].push(val);state.customContent=c;save();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()};document.getElementById('addAttr')?.addEventListener('click',()=>{const n=document.getElementById('newAttrName').value.trim();if(n)add('attrs',{id:'a-'+Date.now(),name:n})});document.getElementById('addSkill')?.addEventListener('click',()=>{const n=document.getElementById('newSkillName').value.trim();if(n)add('skills',{id:'s-'+Date.now(),name:n})});document.getElementById('addCond')?.addEventListener('click',()=>{const n=document.getElementById('newCondName').value.trim(),effect=document.getElementById('newCondEffect').value.trim();if(n)add('conditions',{id:'c-'+Date.now(),name:n,effect,icon:'◇'})});document.getElementById('addDeity')?.addEventListener('click',async()=>{const n=document.getElementById('newDeityName').value.trim(),f=document.getElementById('newDeityImage')?.files?.[0];if(!n){toast('Informe o nome do Deus.');return}try{const id='d-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);const image=f?await imageFileToRemoteURL(f,`deities/${id}.webp`,700,.82):'';await add('deities',{id,name:n,image});await saveGlobalNow();toast('Deus e imagem salvos no banco.')}catch(e){console.error(e);toast('Não foi possível salvar a imagem do Deus.')}});document.getElementById('addSpell')?.addEventListener('click',async()=>{const n=document.getElementById('newSpellName').value.trim(),school=document.getElementById('newSpellSchool').value.trim(),cost=document.getElementById('newSpellCost').value.trim(),description=document.getElementById('newSpellDesc').value.trim(),f=document.getElementById('newSpellImage')?.files?.[0];if(!n){toast('Informe o nome da magia.');return}const btn=document.getElementById('addSpell');try{if(btn){btn.disabled=true;btn.textContent='Enviando imagem...'}const id='spell-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);const image=f?await imageFileToRemoteURL(f,`spells/${id}.webp`,900,.82):'';state.spells=[...getSpells(),{id,name:n,school,cost,description,image}];await saveGlobalNow();toast('Magia e imagem salvas no banco.');document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()}catch(e){console.error(e);toast('Não foi possível salvar a magia.')}finally{if(btn){btn.disabled=false;btn.textContent='Adicionar magia'}}});document.querySelectorAll('[data-del-spell]').forEach(b=>b.onclick=()=>{state.spells=getSpells().filter(x=>x.id!==b.dataset.delSpell);save();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()});document.querySelectorAll('[data-del-custom]').forEach(b=>b.onclick=()=>{const [k,i]=b.dataset.delCustom.split(':');c[k].splice(Number(i),1);state.customContent=c;save();document.getElementById('adminContent').innerHTML=contentAdmin();bindContentAdmin()})}
function bindAdmin(){document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=b.dataset.tab;adminTabCurrent=t;const content=t==='players'?playersAdmin():t==='monsters'?monstersAdmin():t==='classes'?classesAdmin():t==='items'?itemsAdmin():t==='sounds'?soundsAdmin():t==='secrets'?secretCluesAdmin():t==='symbols'?symbolsAdmin():t==='spells'?spellsAdmin():t==='content'?contentAdmin():t==='backgrounds'?backgroundsAdmin():t==='branding'?siteBrandAdmin():t==='tv'?tvAdmin():t==='recovery'?recoveryAdmin():musicAdmin();document.getElementById('adminContent').innerHTML=content;bindAdminContent()});bindAdminContent()}
function bindClassBonuses(){const btn=document.getElementById('saveClassBonuses');if(!btn)return;btn.onclick=async()=>{const next=clone(DEFAULT_CLASS_BONUSES);document.querySelectorAll('[data-class-bonus]').forEach(x=>{const n=x.dataset.classBonus,k=x.dataset.bonusKey;next[n]=next[n]||{};next[n][k]=clamp(x.value,0,20)});state.classBonuses=next;save();await saveGlobalNow().catch(()=>{});toast('Bônus das profissões Slasher atualizados. As fichas já usam os novos totais.');document.getElementById('adminContent').innerHTML=classesAdmin();bindAdminContent()}}
function bindAdminContent(){if(document.querySelector('.card')&&document.getElementById('restoreLatestLocal'))bindRecovery();if(document.querySelector('.bonus-editor'))bindClassBonuses();if(document.querySelector('.tv-admin'))bindTvAdmin();if(document.querySelector('#saveSiteBrand'))bindSiteBrand();if(document.querySelector('.content-admin'))bindContentAdmin();document.getElementById('sendSecretClue')?.addEventListener('click',sendSecretClue);const playerGrid=document.querySelector('.master-player-grid');if(playerGrid&&!playerGrid.dataset.boundFicha){playerGrid.dataset.boundFicha='1';playerGrid.addEventListener('click',e=>{const view=e.target.closest('[data-view-player]');if(view){e.preventDefault();e.stopPropagation();const id=view.dataset.playerId;const p=state.players.find(x=>String(x.id)===String(id))||state.players[Number(view.dataset.viewPlayer)];if(p)openPlayerViewById(p.id);return}})}const rr=document.getElementById('openCharacterRules');if(rr)rr.onclick=()=>{document.getElementById('adminContent').innerHTML=rulesAdmin();bindRulesAdmin()};const np=document.getElementById('newPlayer');if(np)np.onclick=()=>openEntity('player',null);document.querySelectorAll('[data-edit-p]').forEach(b=>b.onclick=()=>openEntity('player',Number(b.dataset.editP)));document.querySelectorAll('[data-bag-p]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.bagP);openModal(bagAdminModal(i));bindBagAdmin(i)});document.querySelectorAll('[data-round-p]').forEach(b=>b.onclick=()=>{const p=state.players[Number(b.dataset.roundP)];if(!p)return;const events=applyConditionRound(p);save();toast(events.length?events.join(' • '):'Rodada avançada. Nenhum efeito automático ativo.');render('master')});document.querySelectorAll('[data-del-p]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.delP);if(confirm('Excluir este Player?')){state.players.splice(i,1);save();render('master')}});const nm=document.getElementById('newMonster');if(nm)nm.onclick=()=>openEntity('monster',null);const ms=document.getElementById('monsterSearch');if(ms)ms.oninput=renderMonsters;document.querySelectorAll('[data-edit-m]').forEach(b=>b.onclick=()=>openEntity('monster',Number(b.dataset.editM)));document.querySelectorAll('[data-monster-damage]').forEach(b=>b.onclick=async()=>{const m=state.creatures[Number(b.dataset.monsterDamage)],delta=Number(b.dataset.delta)||0;if(!m)return;m.hp=clamp((m.hp??m.hpMax)+delta,0,m.hpMax);save();renderMonsters();await saveGlobalNow().catch(()=>{});toast(`${delta<0?'Dano':'Cura'} aplicado em ${m.name}.`)});document.querySelectorAll('[data-round-m]').forEach(b=>b.onclick=()=>{const m=state.creatures[Number(b.dataset.roundM)];if(!m)return;const events=applyConditionRound(m);save();toast(events.length?events.join(' • '):'Rodada avançada. Nenhum efeito automático ativo.');render('master')});document.querySelectorAll('[data-del-m]').forEach(b=>b.onclick=async()=>{if(confirm('Excluir este Monstro?')){state.creatures.splice(Number(b.dataset.delM),1);await saveGlobalNow().catch(()=>{});render('master')}});if(document.getElementById('monsterResults'))renderMonsters();const ni=document.getElementById('newItem');if(ni)ni.onclick=()=>{openModal(itemModal());bindItemModal(null)};let itemSearchTimer=0;['itemSearch','itemCat','itemRar'].forEach(id=>{const x=document.getElementById(id);if(!x)return;x.oninput=()=>{clearTimeout(itemSearchTimer);itemSearchTimer=setTimeout(renderItems,id==='itemSearch'?120:0)}});const ci=document.getElementById('clearItems');if(ci)ci.onclick=()=>{document.getElementById('itemSearch').value='';document.getElementById('itemCat').value='';document.getElementById('itemRar').value='';renderItems()};const itemResults=document.getElementById('itemResults');if(itemResults&&!itemResults.dataset.bound){itemResults.dataset.bound='1';itemResults.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-item]');if(edit){const id=Number(edit.dataset.editItem);openModal(itemModal(id));bindItemModal(id);return}const del=e.target.closest('[data-del-item]');if(del){const id=Number(del.dataset.delItem);if(confirm('Excluir este item?')){state.items=state.items.filter(i=>i.id!==id);save();renderItems();toast('Item excluído.')}}})}const sm=document.getElementById('saveMusic');if(sm)sm.onclick=async()=>{
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
const scid=document.getElementById('spotifyClientId');if(scid)scid.onchange=()=>{try{localStorage.setItem(SPOTIFY_CLIENT_KEY,scid.value.trim())}catch{}};const slog=document.getElementById('spotifyLogin');if(slog)slog.onclick=async()=>{try{if(scid?.value.trim())localStorage.setItem(SPOTIFY_CLIENT_KEY,scid.value.trim())}catch{};if(spotifyLogged()){await ensureSpotifyPlayer();syncGlobalMusic()}else await spotifyLogin()};const slout=document.getElementById('spotifyLogout');if(slout)slout.onclick=()=>{spotifyLogout();render('master')};const cm=document.getElementById('clearMusic');if(cm)cm.onclick=async()=>{state.music={type:'audio',url:'',title:'',kind:'url',mediaId:'',playing:false,loop:false,position:0,startedAt:0,commandAt:Date.now()};await saveGlobalNow();syncGlobalMusic(true);toast('Trilha removida globalmente.');render('master')};document.querySelectorAll('[data-use-global-music]').forEach(b=>b.onclick=async()=>{const t=(state.musicLibrary||[]).find(x=>String(x.id)===String(b.dataset.useGlobalMusic));if(!t)return;state.music={...normalizeMusic(),type:'audio',url:t.url,title:t.title,kind:t.kind||'url',mediaId:t.id,playing:false,position:0,startedAt:0,commandAt:Date.now()};await saveGlobalNow();syncGlobalMusic(true);toast('Trilha selecionada.');render('master')});document.querySelectorAll('[data-delete-global-music]').forEach(b=>b.onclick=async()=>{const id=String(b.dataset.deleteGlobalMusic),t=(state.musicLibrary||[]).find(x=>String(x.id)===id);if(!t)return;if(!confirm(`Excluir a trilha ${t.title||''} da biblioteca?`))return;state.musicLibrary=state.musicLibrary.filter(x=>String(x.id)!==id);if(String(state.music?.mediaId)===id)state.music={type:'audio',url:'',title:'',kind:'url',mediaId:'',playing:false,loop:false,position:0,startedAt:0,commandAt:Date.now()};await saveGlobalNow();render('master')});const as=document.getElementById('addSound');if(as)as.onclick=async()=>{const name=document.getElementById('soundName').value.trim(),file=document.getElementById('soundFile').files[0],url=document.getElementById('soundUrl').value.trim(),category=document.getElementById('soundCategory')?.value||'Outros';if(!name){toast('Informe o nome do som.');return}if(!file&&!url){toast('Envie um arquivo ou informe uma URL.');return}if(file&&file.size>25*1024*1024){toast('O arquivo deve ter até 25 MB.');return}try{as.disabled=true;as.textContent='Enviando...';let remoteUrl=url,kind='url';if(file){if(!remoteEnabled){toast('Configure o Supabase para sincronizar arquivos de som com os Players.');return}const ext=(file.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp3';remoteUrl=await uploadGlobalFile(`sounds/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`,file);if(!remoteUrl)throw new Error('URL pública não disponível');kind='url'}const id=`s-${Date.now()}`;state.sounds.push({id,name,kind,url:remoteUrl,category,createdAt:Date.now()});await saveGlobalNow();toast('Som salvo e sincronizado.');render('master')}catch(e){toast(`Não foi possível salvar o som: ${e?.message||'erro'}`)}finally{as.disabled=false;as.textContent='+ Salvar som na biblioteca'}};document.getElementById('soundStopMaster')?.addEventListener('click',stopAllSounds);document.querySelectorAll('[data-play-sound]').forEach(b=>b.onclick=()=>{const sound=state.sounds.find(x=>String(x.id)===String(b.dataset.playSound));if(sound)playSoundEntry(sound)});document.querySelectorAll('[data-del-sound]').forEach(b=>b.onclick=async()=>{const id=b.dataset.delSound;state.sounds=state.sounds.filter(x=>x.id!==id);await saveGlobalNow().catch(()=>{});render('master')});document.querySelectorAll('[data-class-choice]').forEach(b=>b.onclick=()=>{const p=player();if(!p)return;p.class=b.dataset.classChoice;if(!hasMagicClass(p.class))p.initialSpell='';save();const phrase=document.getElementById('destinyPhrase');if(phrase){phrase.classList.remove('show');void phrase.offsetWidth;phrase.classList.add('show')}toast('Seu destino está selado.');render('sheet')});const saveSymbols=document.getElementById('saveSymbols');if(saveSymbols)saveSymbols.onclick=()=>{state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};state.uiIcons.attrs=state.uiIcons.attrs||{};state.uiIcons.skills=state.uiIcons.skills||{};document.querySelectorAll('[data-symbol-attr]').forEach(x=>state.uiIcons.attrs[x.dataset.symbolAttr]=x.value.trim()||DEFAULT_ATTR_ICONS[x.dataset.symbolAttr]);document.querySelectorAll('[data-symbol-skill]').forEach(x=>state.uiIcons.skills[x.dataset.symbolSkill]=x.value.trim()||DEFAULT_SKILL_ICONS[x.dataset.symbolSkill]);save();toast('Símbolos atualizados.');render('master')};document.querySelectorAll('[data-symbol-file]').forEach(inp=>inp.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>5*1024*1024){toast('Imagem inválida ou maior que 5 MB.');inp.value='';return}try{const kind=inp.dataset.symbolFile,key=inp.dataset.symbolKey;const path=`symbols/${kind}-${key.replace(/[^a-z0-9_-]/gi,'-')}.webp`;const data=await imageFileToRemoteURL(f,path,256,.82);state.uiIcons=state.uiIcons||{attrs:{},skills:{},conditions:{}};if(kind==='attr')state.uiIcons.attrs[key]=data;else state.uiIcons.skills[key]=data;await saveGlobalNow();toast('Símbolo atualizado e salvo no banco.');document.getElementById('adminContent').innerHTML=symbolsAdmin();bindAdminContent()}catch(err){console.error(err);toast('Não foi possível salvar o símbolo.')}finally{inp.value=''}});document.querySelectorAll('[data-spell-image]').forEach(inp=>inp.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>5*1024*1024){toast('Imagem inválida ou maior que 5 MB.');inp.value='';return}try{const sp=state.spells.find(x=>x.id===inp.dataset.spellImage);if(!sp)return;const data=await imageFileToRemoteURL(f,`spells/${sp.id}.webp`,900,.82);sp.image=data;await saveGlobalNow();toast('Imagem da magia salva no banco.');render('master')}catch(err){console.error(err);toast('Não foi possível salvar a imagem da magia.')}finally{inp.value=''}});document.querySelectorAll('[data-clear-spell-image]').forEach(b=>b.onclick=async()=>{const sp=state.spells.find(x=>x.id===b.dataset.clearSpellImage);if(sp){sp.image='';await saveGlobalNow().catch(()=>{});toast('Imagem da magia removida.');render('master')}});document.querySelectorAll('[data-condition-image]').forEach(inp=>inp.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!isSupportedImageFile(f)||f.size>5*1024*1024){toast('Imagem inválida ou maior que 5 MB.');inp.value='';return}try{const key=inp.dataset.conditionImage;const data=await imageFileToRemoteURL(f,`conditions/${key.replace(/[^a-z0-9_-]/gi,'-')}.webp`,512,.82);state.uiIcons=state.uiIcons||{};state.uiIcons.conditions=state.uiIcons.conditions||{};state.uiIcons.conditions[key]=data;await saveGlobalNow();toast('Símbolo da condição salvo no banco.');render('master')}catch(err){console.error(err);toast('Não foi possível salvar a imagem da condição.')}finally{inp.value=''}});if(document.getElementById('itemResults'))renderItems();if(document.querySelector('[data-bg-upload]'))bindBackgrounds()}
function openModal(html){const holder=document.createElement('div');holder.innerHTML=html.trim();document.body.appendChild(holder.firstElementChild)}
function characterRules(type='campaign'){const r=state.characterRules||DEFAULT_RULES;return r[type==='slasher'?'slasher':'campaign']||DEFAULT_RULES.campaign}
function allocationTotals(e){return{attrs:Object.values(e?.attrs||{}).reduce((a,v)=>a+(Number(v)||0),0),skills:Object.values(e?.skills||{}).reduce((a,v)=>a+(Number(v)||0),0)}}
function allocationRemaining(e){const t=allocationTotals(e),r=characterRules(e?.campaignType),ap=Number(e?.attrBonusPoints)||0,sp=Number(e?.skillBonusPoints)||0;return{attrs:Math.max(0,Number(r.attrPoints)+ap-t.attrs),skills:Math.max(0,Number(r.skillPoints)+sp-t.skills)}}
function validateAllocation(e){const r=characterRules(e.campaignType),t=allocationTotals(e),ap=Number(e?.attrBonusPoints)||0,sp=Number(e?.skillBonusPoints)||0,al=Number(r.attrPoints)+ap,sl=Number(r.skillPoints)+sp;if(t.attrs>al||t.skills>sl)return `Limite excedido: ${t.attrs}/${al} pontos de Atributos e ${t.skills}/${sl} de Perícias.`;return ''}
function rulesAdmin(){const r=state.characterRules||DEFAULT_RULES;return `<div class="card character-rules-card"><div class="section-kicker">REGRAS DE CRIAÇÃO</div><h2>Limites de pontos</h2><p class="small muted">Defina quantos pontos cada tipo de ficha pode distribuir. Atributos e Perícias são contados separadamente.</p><div class="rules-grid"><section><h3>Campanha principal</h3><div class="field"><label>Pontos de Atributos</label><input id="ruleCampaignAttrs" type="number" min="0" max="999" value="${Number(r.campaign?.attrPoints)||0}"></div><div class="field"><label>Pontos de Perícias</label><input id="ruleCampaignSkills" type="number" min="0" max="999" value="${Number(r.campaign?.skillPoints)||0}"></div><div class="field"><label>Vida máxima base</label><input id="ruleCampaignHp" type="number" min="1" max="999" value="${Number(r.campaign?.hpMax)||35}"></div></section><section><h3>Slasher</h3><div class="field"><label>Pontos de Atributos</label><input id="ruleSlasherAttrs" type="number" min="0" max="999" value="${Number(r.slasher?.attrPoints)||0}"></div><div class="field"><label>Pontos de Perícias</label><input id="ruleSlasherSkills" type="number" min="0" max="999" value="${Number(r.slasher?.skillPoints)||0}"></div><div class="field"><label>Vida máxima base</label><input id="ruleSlasherHp" type="number" min="1" max="9999" value="${Number(r.slasher?.hpMax)||100}"></div></section></div><div class="row" style="justify-content:flex-end"><button class="btn primary" id="saveCharacterRules">Salvar limites</button></div></div>`}
function bindRulesAdmin(){const b=document.getElementById('saveCharacterRules');if(!b)return;b.onclick=()=>{state.characterRules={campaign:{attrPoints:clamp(document.getElementById('ruleCampaignAttrs').value,0,999),skillPoints:clamp(document.getElementById('ruleCampaignSkills').value,0,999),hpMax:clamp(document.getElementById('ruleCampaignHp').value,1,999)},slasher:{attrPoints:clamp(document.getElementById('ruleSlasherAttrs').value,0,999),skillPoints:clamp(document.getElementById('ruleSlasherSkills').value,0,999),hpMax:clamp(document.getElementById('ruleSlasherHp').value,1,9999)}};save();toast('Limites de criação atualizados globalmente.');document.getElementById('adminContent').innerHTML=playersAdmin();bindAdminContent()}}
function registerPlayer(){lastRenderSig='';document.getElementById('root').innerHTML=`<div class="screen"><form class="login-card register-card" id="registerForm"><img class="sigil" src="/runa-gold.png" alt=""><h1 class="title">Criar Player</h1><p class="subtitle">Crie seu acesso e depois monte sua ficha.</p><div class="field"><label>Login</label><input id="regLogin" autocomplete="username" minlength="3" maxlength="32" required></div><div class="field"><label>Senha</label><input id="regPassword" type="password" autocomplete="new-password" minlength="4" maxlength="72" required></div><div class="field"><label>Tipo de ficha</label><select id="regType"><option value="campaign">Campanha principal</option><option value="slasher">Slasher</option></select></div><div class="field"><label>Nome do personagem</label><input id="regName" maxlength="60" placeholder="Pode preencher depois"></div><div class="row"><button type="button" class="btn" id="cancelRegister">Voltar</button><button class="btn primary" type="submit">Criar acesso</button></div></form></div>`;document.getElementById('cancelRegister').onclick=login;document.getElementById('registerForm').onsubmit=async e=>{e.preventDefault();const loginName=document.getElementById('regLogin').value.trim(),password=document.getElementById('regPassword').value,type=document.getElementById('regType').value==='slasher'?'slasher':'campaign',name=document.getElementById('regName').value.trim()||loginName;if(loginName.toLowerCase()===MASTER.login.toLowerCase()){toast('Esse login é reservado ao Mestre.');return}if(state.players.some(p=>String(p.login||'').trim().toLowerCase()===loginName.toLowerCase())){toast('Esse login já existe.');return}if(playerStoreEnabled){try{const rows=await fetchPlayerRows();if(rows.some(r=>!r.deleted_at&&String(r.login||r.data?.login||'').trim().toLowerCase()===loginName.toLowerCase())){toast('Esse login já existe.');return}}catch(err){console.warn('Não foi possível consultar os Players antes do cadastro:',err)}}const r=characterRules(type);const p={id:'p-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),login:loginName,password,name,class:'',campaignType:type,photo:'',soul:'',soulPhoto:'',belovedObjects:'',personality:'',destiny:'',description:'',history:'',playerNotes:'',masterNotes:'',attrBonusPoints:0,skillBonusPoints:0,deityId:'',homeWallpaper:'',musicThemes:[],hp:Math.min(Number(r.hpMax)||35,MAX_HP),hpMax:Math.min(Number(r.hpMax)||35,MAX_HP),attack:0,defense:0,status:'Ativo',extra:0,attrs:blankAttrs(),attrLimits:blankLimits(),skills:blankSkills(),backpack:[],conditions:[],conditionTurns:{},rolls:[],slasherReligion:'',slasherBelief:''};normalize(p);p._syncUpdatedAt=Date.now();state.players.push(p);lastPlayersSnapshot=clone(state.players);state.session={role:'player',login:loginName,playerId:p.id,playerSnapshot:clone(p)};storageSet(KEY,serializeState());try{if(playerStoreEnabled){const rr=await authRegisterPlayer(loginName,password,p);if(rr?.player?._syncUpdatedAt)p._syncUpdatedAt=Number(rr.player._syncUpdatedAt)||p._syncUpdatedAt;playerDbHydrated=true}else{save();}}catch(err){state.players=state.players.filter(x=>playerSyncKey(x)!==p.id);state.session=null;storageSet(KEY,serializeState());console.error('Falha ao criar Player:',err);toast(/LOGIN_|SENHA_|MUITAS_/.test(String(err?.message))?authErrorText(err):'Não foi possível salvar o Player no banco. Tente novamente.');return}save();await saveGlobalNow().catch(()=>{});state.session.playerSnapshot=clone(player()||p);toast('Player criado com sucesso.');render('sheet')}}
function login(){lastRenderSig='';const brand=siteBrand();document.getElementById('root').innerHTML=`<div class="screen"><form class="login-card" id="loginForm"><img class="sigil" src="${esc(brand.image)}"><h1 class="title">${esc(brand.name)}</h1><p class="welcome">Bem-vindos ao abismo</p><p class="subtitle">Entre para continuar sua jornada.</p><div class="field"><label>Login</label><input id="login" autocomplete="username" required></div><div class="field"><label>Senha</label><input id="password" type="password" autocomplete="current-password" required></div><button class="btn primary full">Entrar</button><button type="button" class="btn full" id="registerPlayerBtn">Criar login de Player</button></form></div>`;document.getElementById('registerPlayerBtn').onclick=registerPlayer;document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const l=document.getElementById('login').value.trim(),p=document.getElementById('password').value;let found=null;
    const submitBtn=document.querySelector('#loginForm button.primary');if(submitBtn)submitBtn.disabled=true;
    try{
      if(remoteEnabled){
        // V66.3: teclados de celular põem maiúscula na 1ª letra e espaço no fim; tenta também a senha sem espaços nas pontas.
        const passVariants=p!==p.trim()?[p,p.trim()]:[p];
        if(l.toLowerCase()===MASTER.login.toLowerCase()){for(const v of passVariants){if(await authMasterLogin(v)){state.session={role:'master'};save();render('home');return}}}
        else{for(const v of passVariants){const r=await authPlayerLogin(l,v);if(r?.player){found=clone(r.player);found._syncUpdatedAt=Number(found._syncUpdatedAt)||Date.now();break}}}
      }else{
        if(l.toLowerCase()===MASTER.login.toLowerCase()&&await masterPasswordOk(p)){state.session={role:'master'};save();render('home');return}
        found=state.players.find(x=>String(x.login||'').trim().toLowerCase()===l.toLowerCase()&&String(x.password||'')===p)||null;
      }
    }catch(err){toast(authErrorText(err));return}
    finally{if(submitBtn)submitBtn.disabled=false}
    if(found){
      const oldPlayer=state.players.find(x=>playerSyncKey(x)===playerSyncKey(found));
      if(oldPlayer){for(const k of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(found[k])&&imageValue(oldPlayer[k]))found[k]=oldPlayer[k];}
      state.players=state.players.filter(x=>playerSyncKey(x)!==playerSyncKey(found));
      state.players.push(found);normalize(found);
      state.session={role:'player',login:found.login,playerId:found.id,playerSnapshot:clone(found)};
      storageSet(KEY,serializeState());
      save();render('home');return;
    }
    toast('Credenciais inválidas.');}}
function entityModal(type,index){const isP=type==='player',e=index===null?{id:'',name:'',login:'',password:'',class:'',status:'Ativo',hp:1,hpMax:1,sanity:1,sanityMax:1,attack:0,defense:0,extra:0,attrBonusPoints:0,skillBonusPoints:0,attrs:blankAttrs(),attrLimits:blankLimits(),skills:blankSkills(),backpack:[],conditions:[],conditionTurns:{},description:'',history:'',soul:'',belovedObjects:'',personality:'',destiny:'',initialSpell:'',personalSpells:[]}:clone((isP?state.players:state.creatures)[index]);const attrRows=allAttrs().map(a=>`<label class="skill-line"><span class="skill-name"><i class="skill-icon">${uiAttrIcon(a)}</i>${esc(a)}</span><input class="eAttr" data-attr="${esc(a)}" type="number" min="0" max="8" value="${e.attrs?.[a]??0}"><b>/8</b></label>`).join('');const skillRows=allSkills().map(sk=>`<label class="skill-line"><span class="skill-name"><i class="skill-icon">${uiSkillIcon(sk)}</i>${esc(sk)}</span><input class="eSkill" data-skill="${esc(sk)}" type="number" min="0" max="15" value="${e.skills?.[sk]??0}"><b>/15</b></label>`).join('');return `<div class="modal" id="entityModal"><div class="modal-card"><button class="modal-close" id="closeEntity">×</button><span class="badge">MESTRE</span><h2>${index===null?'Criar':'Editar'} ${isP?'Player':'Monstro'}</h2><div class="input-grid"><div class="field"><label>Nome</label><input id="eName" value="${esc(e.name||'')}"></div>${isP?`<div class="field"><label>Login</label><input id="eLogin" value="${esc(e.login||'')}"></div><div class="field"><label>Senha</label><input id="ePass" type="password" autocomplete="new-password" value="${playerStoreEnabled?'':esc(e.password||'')}" placeholder="${playerStoreEnabled&&index!==null?'Deixe em branco para manter':''}"></div><div class="field"><label>Tipo de ficha</label><select id="eCampaignType"><option value="campaign" ${e.campaignType!=='slasher'?'selected':''}>Campanha principal</option><option value="slasher" ${e.campaignType==='slasher'?'selected':''}>Slasher</option></select></div><div class="field"><label>Classe</label><select id="eClass"><option value="">Escolher depois pelo Player</option>${Object.keys(CLASSES).map(c=>`<option ${e.class===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>`:''}<div class="field"><label>Status</label><input id="eStatus" value="${esc(e.status||'Ativo')}"></div><div class="field"><label>Vida máxima</label><input id="hpMax" type="number" min="1" max="${e.campaignType==='slasher'?9999:35}" value="${Math.min(e.campaignType==='slasher'?9999:35,e.hpMax||1)}"></div><div class="field"><label>Vida atual</label><input id="hp" type="number" min="0" max="${e.campaignType==='slasher'?9999:35}" value="${Math.min(e.campaignType==='slasher'?9999:35,e.hp??1)}"></div><div class="field"><label>${isP?'Bônus de ataque (Mestre)':'Ataque'}</label><input id="attack" type="number" value="${isP?(e.attackBonus||0):(e.attack||0)}"></div><div class="field"><label>${isP?'Bônus de defesa (Mestre)':'Defesa'}</label><input id="defense" type="number" value="${isP?(e.defenseBonus||0):(e.defense||0)}"></div>${isP?`<div class="field"><label>Determinação máxima</label><input id="eDetMax" type="number" min="0" max="99" value="${e.determinationMax??12}"></div><div class="field"><label>Determinação atual</label><input id="eDet" type="number" min="0" max="99" value="${e.determination??(e.determinationMax??12)}"></div><div class="field"><label>Pontos extras</label><input id="eExtra" type="number" min="0" value="${e.extra||0}"></div><div class="field"><label>Pontos de Atributo concedidos</label><input id="eAttrBonus" type="number" min="0" value="${e.attrBonusPoints||0}"></div><div class="field"><label>Pontos de Perícia concedidos</label><input id="eSkillBonus" type="number" min="0" value="${e.skillBonusPoints||0}"></div>`:''}</div>${isP?`<div class="field"><label>Descrição</label><textarea id="eDescription" rows="3">${esc(e.description||'')}</textarea></div><div class="field"><label>História</label><textarea id="eHistory" rows="3">${esc(e.history||'')}</textarea></div><div class="input-grid"><div class="field"><label>Alma</label><input id="eSoul" value="${esc(e.soul||'')}"></div><div class="field"><label>Objetos queridos</label><input id="eBeloved" value="${esc(e.belovedObjects||'')}"></div><div class="field"><label>Personalidade</label><input id="ePersonality" value="${esc(e.personality||'')}"></div><div class="field"><label>Destino</label><input id="eDestiny" value="${esc(e.destiny||'')}"></div></div>`:''}<div class="divider"></div><div class="section-heading"><div><span class="section-kicker">ATRIBUTOS</span><h3>Pontos do personagem</h3></div><span class="corner-mark">${characterRules(e.campaignType).attrPoints} pontos</span></div><div class="attribute-admin-grid">${attrRows}</div><div class="section-heading" style="margin-top:18px"><div><span class="section-kicker">PERÍCIAS</span><h3>Distribuição</h3></div><span class="corner-mark">${characterRules(e.campaignType).skillPoints} pontos</span></div><div class="skill-admin-grid">${skillRows}</div><div class="section-heading" style="margin-top:18px"><div><span class="section-kicker">ESTADOS</span><h3>Condições</h3></div></div>${conditionsMarkup(e,true)}<div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn" id="cancelEntity">Cancelar</button><button class="btn primary" id="saveEntity">Salvar</button></div></div></div>`}
function openEntity(type,index){openModal(entityModal(type,index));bindEntity(type,index)}
function bindEntity(type,index){const close=()=>document.getElementById('entityModal')?.remove();document.getElementById('closeEntity').onclick=close;document.getElementById('cancelEntity').onclick=close;document.querySelectorAll('#entityModal .condition-chip').forEach(b=>b.onclick=()=>b.classList.toggle('active'));document.getElementById('saveEntity').onclick=()=>{const isP=type==='player',list=isP?state.players:state.creatures;let e=index===null?{id:'e-'+Date.now(),name:'',login:'',password:'',class:'Guerreiro',hp:10,hpMax:10,attack:0,defense:0,status:'Ativo',attrs:blankAttrs(),attrLimits:blankLimits(),skills:blankSkills(),backpack:[],conditions:[],conditionTurns:{},rolls:[],history:'',initialSpell:'',personalSpells:[]}:list[index];e.name=document.getElementById('eName').value.trim();if(!e.name){toast('Informe um nome.');return}e.status=document.getElementById('eStatus').value.trim()||'Ativo';if(isP){e.description=document.getElementById('eDescription')?.value.trim()||'';e.extra=Math.max(0,Number(document.getElementById('eExtra')?.value)||0);e.attrBonusPoints=Math.max(0,Number(document.getElementById('eAttrBonus')?.value)||0);e.skillBonusPoints=Math.max(0,Number(document.getElementById('eSkillBonus')?.value)||0)}const previousConditions=new Set(e.conditions||[]);const nextConditions=[...document.querySelectorAll('#entityModal .condition-chip.active')].map(x=>x.dataset.condition);e.conditionTurns=e.conditionTurns||{};for(const id of Object.keys(e.conditionTurns)){if(!nextConditions.includes(id))delete e.conditionTurns[id]}e.conditions=nextConditions;for(const id of nextConditions){const c=conditionById(id);if(c?.turns&&!previousConditions.has(id))e.conditionTurns[id]=c.turns}if(isP)e.history=document.getElementById('eHistory')?.value.trim()||e.history||'';if(isP){e.soul=document.getElementById('eSoul')?.value.trim()||'';e.belovedObjects=document.getElementById('eBeloved')?.value.trim()||'';e.personality=document.getElementById('ePersonality')?.value.trim()||'';e.destiny=document.getElementById('eDestiny')?.value.trim()||'';}const hpCap=e.campaignType==='slasher'?9999:35;e.hpMax=clamp(document.getElementById('hpMax').value,1,hpCap);e.hp=clamp(document.getElementById('hp').value,0,e.hpMax);if(isP){e.attackBonus=Number(document.getElementById('attack').value)||0;e.defenseBonus=Number(document.getElementById('defense').value)||0}else{e.attack=Number(document.getElementById('attack').value)||0;e.defense=Number(document.getElementById('defense').value)||0}if(isP){e.login=document.getElementById('eLogin').value.trim();const _np=document.getElementById('ePass').value;if(playerStoreEnabled){if(_np)e.newPassword=_np;delete e.password}else e.password=_np;e.determinationMax=clamp(document.getElementById('eDetMax')?.value??DET_DEFAULT_MAX,0,99);e.determination=clamp(document.getElementById('eDet')?.value??e.determinationMax,0,e.determinationMax);e.class=document.getElementById('eClass').value;e.campaignType=document.getElementById('eCampaignType')?.value==='slasher'?'slasher':'campaign';e.initialSpell=e.initialSpell||'';if(!hasMagicClass(e.class))e.initialSpell='';if(!e.login||(playerStoreEnabled?(index===null&&!e.newPassword):!e.password)){toast('Login e senha são obrigatórios.');return}
// V65.8: o banco trata login como único ignorando maiúsculas/minúsculas
// (índice lower(login)); a checagem aqui precisa ser igualmente
// case-insensitive, senão dois Players podem ficar com o "mesmo" login em
// letras diferentes — a partir daí o Supabase passa a rejeitar toda
// gravação desse Player, e a ficha dele para de sincronizar (parece "sumir").
if(e.login.toLowerCase()===MASTER.login.toLowerCase()||state.players.some((p,i)=>i!==index&&String(p.login||'').trim().toLowerCase()===e.login.toLowerCase())){toast('Esse login já existe.');return}}e.attrLimits=e.attrLimits||blankLimits();e.attrs=e.attrs||blankAttrs();document.querySelectorAll('.eMin').forEach(x=>e.attrLimits[x.dataset.attr].min=Number(x.value)||0);document.querySelectorAll('.eMax').forEach(x=>e.attrLimits[x.dataset.attr].max=Number(x.value)||10);document.querySelectorAll('.eAttr').forEach(x=>{const l=e.attrLimits[x.dataset.attr];e.attrs[x.dataset.attr]=clamp(x.value,0,MAX_ATTR)});e.skills=e.skills||blankSkills();document.querySelectorAll('.eSkill').forEach(x=>e.skills[x.dataset.skill]=clamp(x.value,0,MAX_SKILL));if(isP){const err=validateAllocation(e);if(err){toast(err);return}const r=characterRules(e.campaignType);if(e.campaignType==='slasher'&&Number(r.hpMax)>MAX_HP){e.hpMax=Math.min(Number(r.hpMax),9999);e.hp=clamp(e.hp,0,e.hpMax)}}const _ce=[];for(const id of nextConditions){if(!previousConditions.has(id))_ce.push(...applyConditionOnAdd(e,id))}if(previousConditions.has('fractured')&&!nextConditions.includes('fractured')&&e.weakenedByFracture){e.conditions=(e.conditions||[]).filter(x=>x!=='weakened');delete e.weakenedByFracture;if(e.conditionTurns)delete e.conditionTurns.weakened}if(isP)syncDerivedResources(e);normalize(e);if(index===null)list.push(e);save();close();toast(_ce.length?`${e.name||'Alvo'}: ${_ce.join(' • ')}`:`${isP?'Player':'Monstro'} salvo.`);render('master')}}
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
// V65.9: aba aberta na Câmara do Mestre. Antes, qualquer re-render da tela (ex.: um Player mudando a ficha via Realtime)
// reconstruía a página e voltava para a aba "Players" com a barra de abas rolada para o início.
let adminTabCurrent='players';
// V66: re-renderizar a tela (atualização em tempo real, salvar, etc.) NÃO pode mais jogar a página para o topo.
// O innerHTML do #root é trocado por inteiro; ao trocar, a altura da página encolhe por um instante e o navegador
// "puxa" a rolagem para cima. Agora a posição (e a rolagem interna de abas/tabelas) é guardada e restaurada,
// e atualizações remotas que não mudam nada na tela nem chegam a mexer no DOM.
function captureInnerScroll(root){const out=[];if(!root)return out;const all=root.querySelectorAll('*');for(let i=0;i<all.length;i++){const el=all[i];if(el.scrollLeft>0||el.scrollTop>0)out.push({i,tag:el.tagName,cls:el.className,l:el.scrollLeft,t:el.scrollTop})}return out}
function restoreInnerScroll(root,saved){if(!root||!saved?.length)return;const all=root.querySelectorAll('*');for(const it of saved){const el=all[it.i];if(el&&el.tagName===it.tag&&el.className===it.cls){el.scrollLeft=it.l;el.scrollTop=it.t}}}
function jumpScroll(y){try{window.scrollTo({top:y,left:0,behavior:'instant'})}catch{window.scrollTo(0,y)}}
function render(view='home',opts={}){
  const prev=currentView,same=prev===view,rootEl=document.getElementById('root');
  const ae=document.activeElement;
  if(opts?.remote&&ae&&/^(TEXTAREA|INPUT|SELECT)$/.test(ae.tagName)&&rootEl?.contains?.(ae)){deferredRemoteRender=true;return}
  const y=window.scrollY,inner=same?captureInnerScroll(rootEl):[];
  renderOpts=opts||{};renderSkipped=false;
  try{renderCore(view)}finally{renderOpts={}}
  if(renderSkipped)return;
  if(same){jumpScroll(y);restoreInnerScroll(rootEl,inner);requestAnimationFrame(()=>{jumpScroll(y);restoreInnerScroll(rootEl,inner)})}
  else jumpScroll(0);
}
function renderCore(view='home'){
  if(isTvMode()){currentView='tv';lastRenderSig='';document.getElementById('root').innerHTML=tvPage();bindNav();bindTvPage();return}
  const prevView=currentView;
  currentView=view;
  viewCacheSet(view);
  if(!state.session?.role && state.session?.playerSnapshot?.login)state.session={role:'player',login:state.session.playerSnapshot.login,playerId:state.session.playerSnapshot.id,playerSnapshot:clone(state.session.playerSnapshot)};
  if(!state.session?.role){
    // V65.8: antes de desistir da sessão, tenta recuperar do cache de sessão
    // (SESSION_CACHE_KEY) antes de mandar o usuário para o login. Isso evita
    // uma ida ao login causada por uma perda transitória de state.session em
    // memória (por exemplo durante uma sincronização), sem mudar nada quando
    // a sessão realmente não existe em lugar nenhum.
    try{
      const cached=readStoredSession();
      if(cached?.role==='master')state.session={role:'master'};
      else if(cached?.role==='player'&&String(cached.login||'').trim())state.session={role:'player',login:cached.login,playerId:cached.playerId||'',playerSnapshot:cached.playerSnapshot||null};
    }catch{}
  }
  // V66.1: com servidor ativo, sessão sem token válido (ex.: cache de antes da V66) não vale: pede login de novo.
  if(remoteEnabled&&state.session?.role&&!getAuthToken()){state.session=null;clearSessionCache();setTimeout(()=>toast('Atualizamos a segurança do site. Entre novamente.'),300)}
  const validSession=state.session?.role==='master'||(state.session?.role==='player'&&!!String(state.session.login||'').trim());
  if(!validSession){
    // V66: sem sessão nenhuma (primeiro acesso ou depois de "Sair") é o caminho normal e não deve poluir o console com aviso.
    if(state.session||storageGet(SESSION_CACHE_KEY))console.warn('[A Profecia] Sessão inválida ao abrir a view "'+view+'"; voltando ao login.');
    applySiteBrand();login();syncSoundboard();return
  }
  let html;
  try{
    html=view==='sheet'?(state.session.role==='master'?masterFicha():sheet()):view==='classes'?classesPage():view==='master'&&state.session.role==='master'?admin():view==='immersive'&&state.session.role==='player'?immersivePage():view==='diary'&&state.session.role==='player'?diaryPage():view==='library'&&state.session.role==='player'?libraryPage():view==='nexus'?nexusPage():view==='tv'?tvPage():home();
  }catch(error){
    // V65.8: uma falha ao montar UMA tela não pode mais deixar a página travada
    // nem jogar o usuário para outra aba. Mostra um aviso na própria aba atual,
    // com a sessão e a navegação intactas, em vez de propagar o erro.
    console.error('[A Profecia] Falha ao montar a tela "'+view+'":',error);
    html=shell(`<div class="empty">Não foi possível carregar esta parte da ficha agora. Toque novamente na aba ou recarregue a página.<br><small class="muted">${esc(String(error?.message||error||''))}</small></div>`,view);
  }
  const keepAdmin=prevView==='master'&&view==='master',savedTabsScroll=keepAdmin?(document.querySelector('.panel-tabs')?.scrollLeft||0):0,savedScrollY=keepAdmin?window.scrollY:0;if(view==='master'&&!keepAdmin)adminTabCurrent='players';const renderSig=view+'\u0001'+html+'\u0001'+JSON.stringify(state.terrorMode||{})+'\u0001'+JSON.stringify(state.siteBrand||{});if(renderOpts.remote&&prevView===view&&renderSig===lastRenderSig&&document.getElementById('root').firstElementChild){renderSkipped=true;return}lastRenderSig=renderSig;document.getElementById('root').innerHTML=html;applySiteBrand();document.getElementById('terrorOverlay')?.remove();if(state.terrorMode?.active){document.body.insertAdjacentHTML('beforeend',terrorOverlay());document.getElementById('forceDisableTerror')?.addEventListener('click',async()=>{if(!confirm('Desativar o Modo Terror para todos os Players?'))return;state.terrorMode={...defaultTerrorMode(),active:false,updatedAt:Date.now()};try{await saveGlobalNow()}catch(e){console.warn('Falha ao sincronizar a desativação do Modo Terror:',e)}document.getElementById('terrorOverlay')?.remove();render(currentView||'home')})}bindNav();document.querySelectorAll('[data-open-secret-clues]').forEach(b=>b.onclick=()=>secretCluesPage());if(view==='home'){if(state.session?.role==='master')bindMasterHome();document.querySelectorAll('[data-play-theme]').forEach(b=>b.onclick=()=>{const p=player(),t=p?.musicThemes?.[Number(b.dataset.playTheme)];if(t)playPersonalTheme(t.url,t.title,Number(b.dataset.playTheme))});document.querySelectorAll('[data-pause-theme]').forEach(b=>b.onclick=()=>pausePersonalTheme());document.querySelectorAll('[data-stop-theme]').forEach(b=>b.onclick=()=>stopPersonalTheme());document.getElementById('spotifyHomePlay')?.addEventListener('click',spotifyPlayCurrent);document.getElementById('spotifyHomePause')?.addEventListener('click',spotifyPause);document.getElementById('spotifyHomeLogin')?.addEventListener('click',async()=>{let id=spotifyClientId();if(!id){id=prompt('Cole o Client ID do seu aplicativo Spotify:')?.trim()||'';if(id)try{localStorage.setItem(SPOTIFY_CLIENT_KEY,id)}catch{}}if(id)await spotifyLogin()})}if(view==='diary')document.getElementById('savePrivateDiary')?.addEventListener('click',()=>{savePrivateDiary(document.getElementById('privateDiaryText')?.value||'');toast('Diário salvo neste dispositivo.')});if(view==='library')document.querySelectorAll('[data-read-book]').forEach(b=>b.onclick=()=>openBookReader(Number(b.dataset.readBook)));if(view==='master'){bindAdmin();if(keepAdmin){if(adminTabCurrent!=='players')document.querySelector(`[data-tab="${adminTabCurrent}"]`)?.click();const tabsEl=document.querySelector('.panel-tabs');if(tabsEl)tabsEl.scrollLeft=savedTabsScroll;window.scrollTo(0,savedScrollY)}}if(view==='nexus')bindNexus();if(view==='tv')bindTvPage();if(view==='immersive')bindImmersive();if(view==='sheet'&&state.session.role==='master')bindMasterFicha();if(view==='sheet'&&state.session.role==='player')bindSheet();if(view==='classes'){const p=player();document.querySelectorAll('[data-slasher-religion]').forEach(b=>b.onclick=()=>{if(!p||p.campaignType!=='slasher')return;p.slasherReligion=b.dataset.slasherReligion;p.slasherBelief='';save();render('classes')});document.querySelectorAll('[data-slasher-belief]').forEach(b=>b.onclick=()=>{if(!p||p.campaignType!=='slasher'||p.slasherReligion!=='yes')return;p.slasherBelief=b.dataset.slasherBelief;save();render('classes')});const choose=b=>{if(!p||classChosen(p)){toast('A classe já foi escolhida e não pode ser alterada.');return}if(p.campaignType==='slasher'&&!(p.slasherReligion==='no'||(p.slasherReligion==='yes'&&p.slasherBelief))){toast('Responda às perguntas de origem antes de escolher uma profissão.');return}const name=b.dataset.classChoice;const c=CLASSES[name];if(!c||((p.campaignType==='slasher')!==!!c.slasher)){toast('Essa escolha não pertence a este tipo de ficha.');return}if(!confirm(`Escolher ${name}?\n\nEsta escolha é definitiva para este personagem.`))return;p.class=name;p.initialSpell='';save();toast('Seu destino está selado.');render('sheet')};document.querySelectorAll('[data-class-choice]').forEach(b=>{b.setAttribute('role','button');b.setAttribute('tabindex','0');b.onclick=()=>choose(b);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(b)}}})}syncGlobalMusic();syncSoundboard();applyBackgrounds()}
// =====================================================================================================
// V66 — combate derivado do Corpo, Determinação, condições por rodada, Modo Sessão imersivo, trilha pessoal
// =====================================================================================================
// Regras de combate (ajustáveis; o Mestre também pode sobrescrever em state.characterRules.combat):
//  Ataque = Corpo × 4, Defesa = Corpo × 5. Fora do Slasher: Ataque limitado a 10 (dano puro de soco) e Defesa a 15.
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

// ---------- Determinação ----------
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

// ---------- Condições: efeitos imediatos e por rodada ----------
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
// Chamado quando chega a vez de alguém (início do turno). Cada condição só "vence" uma vez por rodada.
function tickConditions(e,round){
  const ev=[];if(!e)return ev;
  e.conditionTick=e.conditionTick&&typeof e.conditionTick==='object'?e.conditionTick:{};e.conditionTurns=e.conditionTurns||{};
  for(const id of [...(e.conditions||[])]){
    const c=conditionById(id);if(!c||!(c.damage||c.turns))continue;
    if((Number(e.conditionTick[id])||0)>=round)continue;
    e.conditionTick[id]=round;
    if(c.damage){const before=Number(e.hp)||0;e.hp=clamp(before-c.damage,0,e.hpMax||MAX_HP);ev.push(`${c.name}: -${before-e.hp} Vida`)}
    if(Number(e.conditionTurns[id])>0){e.conditionTurns[id]-=1;if(e.conditionTurns[id]<=0){delete e.conditionTurns[id];delete e.conditionTick[id];e.conditions=e.conditions.filter(x=>x!==id);ev.push(`${c.name}: efeito encerrado`)}}
  }
  return ev;
}

// ---------- Magia: gasta Sanidade pelo custo ----------
function castSpell(p,id,view='sheet'){
  const sp=spellByPlayer(p,id);if(!sp||!p)return;
  const cost=spellCost(sp),max=derivedMax(p,'Sanidade'),current=clamp(p.sanity??max,0,max);
  if(cost>current){toast(`Sanidade insuficiente. Necessário: ${cost}. Atual: ${current}.`);return}
  if(!confirm(`Usar ${sp.name}?\n\nCusto: ${cost} Sanidade\nSanidade atual: ${current} / ${max}`))return;
  p.sanity=clamp(current-cost,0,max);save();updateResourceBars(p,'sanity');
  toast(`${sp.name} usada. -${cost} Sanidade (restam ${p.sanity}).`);render(view);
}

// ---------- Trilha pessoal: tocar MP3 sem perder a música ao trocar de tela ----------
function themeIsAudio(t){return t?.kind==='file'||/\.(mp3|m4a|aac|wav|ogg|oga|opus)(\?|#|$)/i.test(String(t?.url||''))}
let personalAudio=null;
let personalAudioUrl='';
let personalAudioThemeIndex=-1;
function personalThemeRoot(){return document.getElementById('personal-player')}
function stopPersonalTheme(renderControls=true){
  if(personalAudio){try{personalAudio.pause();personalAudio.currentTime=0}catch{}}
  if(personalAudioUrl){try{URL.revokeObjectURL(personalAudioUrl)}catch{} }
  personalAudio=null;personalAudioUrl='';personalAudioThemeIndex=-1;
  const root=personalThemeRoot();if(root&&renderControls)root.innerHTML='';
}
function pausePersonalTheme(){if(personalAudio){try{personalAudio.pause()}catch{}}syncPersonalPlayer()}
function syncPersonalPlayer(){
  const root=personalThemeRoot();if(!root)return;
  if(!personalAudio||personalAudio.paused){root.querySelector('[data-personal-state]')?.replaceChildren(document.createTextNode('PAUSADA'));return}
  const stateEl=root.querySelector('[data-personal-state]');if(stateEl)stateEl.textContent='TOCANDO';
}
function renderPersonalPlayer(title,index){
  const root=personalThemeRoot();if(!root)return;
  root.innerHTML=`<div class="personal-player-box"><div class="pp-head"><div><span class="section-kicker">TRILHA PESSOAL</span><strong id="ppTitle"></strong><small data-personal-state>TOCANDO</small></div><button type="button" id="ppClose" aria-label="Fechar">×</button></div><div class="pp-controls"><button type="button" class="btn small gold" id="ppPause">Ⅱ Pausar</button><button type="button" class="btn small" id="ppStop">■ Parar</button><input id="ppVolume" type="range" min="0" max="100" value="85" aria-label="Volume da trilha pessoal"></div></div>`;
  root.querySelector('#ppTitle').textContent=title||'Trilha do personagem';
  root.querySelector('#ppPause').onclick=()=>{if(personalAudio?.paused){personalAudio.play().catch(()=>{});syncPersonalPlayer()}else pausePersonalTheme()};
  root.querySelector('#ppStop').onclick=()=>stopPersonalTheme();
  root.querySelector('#ppClose').onclick=()=>stopPersonalTheme();
  root.querySelector('#ppVolume').oninput=e=>{if(personalAudio)personalAudio.volume=Math.max(0,Math.min(1,Number(e.target.value)/100))};
}
function playPersonalTheme(url,title,index=-1){
  const src=safeHref(url,'');if(!src)return;
  if(personalAudio&&personalAudio.src===src){personalAudio.play().catch(()=>{});syncPersonalPlayer();return}
  stopPersonalTheme(false);
  let actual=src;
  personalAudio=new Audio(actual);personalAudio.preload='metadata';personalAudio.volume=.85;personalAudioThemeIndex=index;personalAudio.onended=()=>stopPersonalTheme();personalAudio.onerror=()=>{toast('Não foi possível reproduzir esta trilha.');stopPersonalTheme()};
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
    p.musicThemes.push(entry);p._syncUpdatedAt=Date.now();save();await syncPlayersDbNow().catch(()=>{});
    toast('Música adicionada à trilha do personagem e salva no servidor.');render('sheet');
  }catch(err){console.error(err);toast('Não foi possível enviar a música. Verifique a conexão e o tamanho do arquivo.')}
}

// ---------- Modo Sessão (imersivo) ----------
function curtainTransition(mid){
  const el=document.createElement('div');el.className='curtain-fx';
  el.innerHTML=`<i class="cf-l"></i><i class="cf-r"></i><span class="cf-icon">${CURTAIN_SVG}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('closing')));
  setTimeout(()=>{try{mid()}finally{el.classList.remove('closing');el.classList.add('opening')}},950);
  setTimeout(()=>el.remove(),2000);
}
function immersivePanel(p){
  if(immersiveTab==='bag'){
    const cap=bagCapacity(p),used=bagWeight(p);
    const rows=(p.backpack||[]).map(b=>{const it=item(b.id);if(!it)return '';const book=String(it.category||'').toLowerCase().includes('livro')||it.bookContent||(Array.isArray(it.bookPages)&&it.bookPages.length);
      return `<div class="imm-item"><span class="imm-item-icon">${itemIcon(it)}</span><div><strong>${esc(it.name)}</strong><small>Qtd. ${b.qty} • ${inferWeight(it)*b.qty} espaço(s)${isWeaponItem(it)?` • ⚔️ ${esc(it.damage||weaponDamageFallback(it))}`:''}</small>${it.description?`<p>${esc(it.description)}</p>`:''}</div>${book?`<button type="button" class="btn small" data-read-book="${it.id}">Ler</button>`:''}</div>`}).join('');
    return `<div class="section-heading"><div><span class="section-kicker">MOCHILA</span><h2>${used}/${cap} espaços</h2></div></div>${rows||'<div class="empty">Mochila vazia.</div>'}`;
  }
  if(immersiveTab==='diary'){const d=getPrivateDiary();return `<div class="section-heading"><div><span class="section-kicker">DIÁRIO</span><h2>Registro privado</h2></div><span class="corner-mark">SÓ NESTE APARELHO</span></div><textarea id="immDiary" rows="14" placeholder="Pistas, nomes, suspeitas...">${esc(immDraft.diary??d.text)}</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn primary" id="immSaveDiary">Salvar diário</button></div>`}
  if(immersiveTab==='notes')return `<div class="section-heading"><div><span class="section-kicker">ANOTAÇÕES</span><h2>Notas do personagem</h2></div></div><textarea id="immNotes" rows="14" placeholder="Anotações da sessão...">${esc(immDraft.notes??(p.playerNotes||''))}</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn primary" id="immSaveNotes">Salvar anotações</button></div>`;
  if(immersiveTab==='skills'){const trained=[...new Set(allSkills().filter(sk=>(effectiveSkill(p,sk)||0)>0))];return `<div class="section-heading"><div><span class="section-kicker">PERÍCIAS</span><h2>Treinadas</h2></div><span class="corner-mark">${trained.length}</span></div>${trained.length?trained.map(sk=>`<div class="op-skill-row"><span>${uiSkillIcon(sk)} ${esc(sk)}</span><b>${effectiveSkill(p,sk)}</b></div>`).join(''):'<div class="empty">Nenhuma perícia treinada.</div>'}<div class="section-heading" style="margin-top:16px"><div><span class="section-kicker">ATRIBUTOS</span><h2>Efetivos</h2></div></div>${allAttrs().map(a=>`<div class="op-skill-row"><span>${uiAttrIcon(a)} ${esc(a)}</span><b>${effectiveAttr(p,a)}</b></div>`).join('')}`}
  if(immersiveTab==='soul')return `<div class="section-heading"><div><span class="section-kicker">ALMA</span><h2>O que permanece</h2></div></div><div class="soul-layout"><div class="photo-wrap"><img class="photo soul-photo" src="${esc(safeImgSrc(p.soulPhoto,'/runa-gold.png'))}" alt="Alma"></div><div><h3>${esc(p.soul||'Sem nome de alma')}</h3><p class="small muted">${esc(p.belovedObjects||'')}</p></div></div>`;
  if(immersiveTab==='abilities'){const c=CLASSES[p.class];return `<div class="section-heading"><div><span class="section-kicker">HABILIDADES</span><h2>${esc(p.class||'Sem classe')}</h2></div></div>${c?.abilities?.length?c.abilities.map(([n,d])=>`<div class="imm-ability"><strong>${esc(n)}</strong><p>${esc(d)}</p></div>`).join(''):'<div class="empty">Escolha uma classe para revelar suas habilidades.</div>'}`}
  if(immersiveTab==='spells')return playerSpellPanel(p);
  return '';
}
function announceSessionJoin(p){return Promise.resolve();}
function immersivePage(){
  const p=player();if(!p)return shell('<div class="empty">Player não encontrado.</div>','home');
  syncDerivedResources(p);
  const tabs=[['bag','Mochila'],['diary','Diário'],['notes','Anotações'],['skills','Perícias'],['soul','Alma'],['abilities','Habilidades']];
  if(hasMagicClass(p.class)||getAvailableSpells(p).length)tabs.push(['spells','Magias']);
  if(!tabs.some(t=>t[0]===immersiveTab))immersiveTab='bag';
  const hpMax=derivedMax(p,'Corpo')||1,sanMax=derivedMax(p,'Sanidade');
  const cond=(p.conditions||[]).map(id=>conditionById(id)).filter(Boolean);
  return `<div class="immersive"><header class="imm-head">${sessionDiamondCard(p,{controls:true,big:true})}<button type="button" class="imm-exit" data-imm-exit>${CURTAIN_SVG}<span>Sair do modo sessão</span></button></header><div class="imm-stats">${resourceBarMarkup('Vida',p.hp,hpMax,'health',false)}${resourceBarMarkup('Sanidade',p.sanity,sanMax,'sanity',false)}<div class="imm-combat"><span>ATQ <b>${p.attack}</b></span><span>DEF <b>${p.defense}</b></span></div></div>${cond.length?`<div class="imm-conds">${cond.map(c=>`<span class="imm-cond" title="${esc(conditionEffectText(c.id,p))}">${esc(c.name)}${conditionTurnsLeft(p,c.id)>0?` (${conditionTurnsLeft(p,c.id)})`:''}</span>`).join('')}</div>`:''}<nav class="imm-tabs">${tabs.map(([k,l])=>`<button type="button" class="${immersiveTab===k?'active':''}" data-imm-tab="${k}">${l}</button>`).join('')}</nav><section class="imm-panel">${immersivePanel(p)}</section></div>`;
}
function bindImmersive(){
  const p=player();if(!p)return;
  announceSessionJoin(p);
  document.querySelectorAll('[data-imm-tab]').forEach(b=>b.onclick=()=>{immersiveTab=b.dataset.immTab;render('immersive')});
  document.querySelector('[data-imm-exit]')?.addEventListener('click',()=>curtainTransition(()=>render('home')));
  document.querySelectorAll('[data-read-book]').forEach(b=>b.onclick=()=>openBookReader(Number(b.dataset.readBook)));
  document.querySelectorAll('[data-use-spell]').forEach(b=>b.onclick=()=>castSpell(p,b.dataset.useSpell,'immersive'));
  const dEl=document.getElementById('immDiary'),nEl=document.getElementById('immNotes');
  dEl?.addEventListener('input',()=>{immDraft.diary=dEl.value});nEl?.addEventListener('input',()=>{immDraft.notes=nEl.value});
  document.getElementById('immSaveDiary')?.addEventListener('click',()=>{savePrivateDiary(dEl?.value||'');immDraft.diary=null;toast('Diário salvo neste dispositivo.')});
  document.getElementById('immSaveNotes')?.addEventListener('click',()=>{p.playerNotes=String(nEl?.value||'').slice(0,20000);immDraft.notes=null;save();toast('Anotações salvas.')});
  try{navigator.wakeLock?.request('screen').catch(()=>{})}catch{}
}

// ---------- Delegação de eventos globais (uma vez só) ----------
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
document.addEventListener('focusout',()=>{setTimeout(()=>{if(!deferredRemoteRender)return;const a=document.activeElement;if(a&&/^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName))return;deferredRemoteRender=false;render(currentView||'home',{remote:true})},300)});
window.addEventListener('pagehide',()=>flushSave());
window.addEventListener('beforeunload',()=>flushSave());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushSave()});
window.addEventListener('a-profecia-auth-expired',()=>{if(state.session?.role)forceRelogin('Sua sessão expirou. Entre novamente.')});

// ---------- Sessão / senha do Mestre ----------
function forceRelogin(msg){
  state.session=null;clearSessionCache();
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

async function boot(){
  if(remoteEnabled&&state.session?.role){
    try{
      const who=await authCheck();
      if(!who||who.role!==state.session.role||(who.role==='player'&&String(who.player_id||'')!==String(state.session.playerId||'')))forceRelogin('Atualizamos a segurança do site. Entre novamente.');
    }catch(e){console.warn('Não foi possível validar a sessão agora (sem rede?):',e)}
  }
  try{
    if(remoteEnabled){
      const remoteRow=await fetchGlobal();
      const remote=remoteRow?.data || remoteRow;
      const bootIsMaster=state.session?.role==='master';
      if(hasRemoteSharedData(remote)){
        await saveLocalRecovery('antes-da-sincronizacao');
        // V65.9: ANTES, todo aparelho (Player inclusive) comparava o próprio estado local com o do servidor ao abrir
        // a página e, se achasse o local "mais rico" ou mais recente, sobrescrevia o estado global do Mestre
        // (fundos, nome do site, mesa...). Agora o servidor é a fonte da verdade: todos aplicam o que veio dele.
        // A única exceção é o Mestre com alteração própria que nunca chegou ao servidor (envio anterior falhou).
        if(bootIsMaster&&globalDirty()&&!loadFailed){
          const stamp=Number(storageGet(GLOBAL_DIRTY_KEY)||0);
          try{await backupGlobal(remote,'antes-de-reenviar-alteracao-pendente')}catch(e){console.warn('Backup remoto indisponível:',e)}
          remoteApplying=true;
          try{await pushGlobal(globalPayload());clearGlobalDirty(stamp)}finally{remoteApplying=false}
        }else{
          remoteApplying=true;
          try{mergeGlobal(remote);storageSet(KEY,serializeState());persistCriticalCache();persistSessionCache()}finally{remoteApplying=false}
        }
      }else if(bootIsMaster){
        await saveLocalRecovery('antes-do-primeiro-envio');
        remoteApplying=true;
        try{await pushGlobal(globalPayload())}finally{remoteApplying=false}
      }
      remoteHydrated=true;
      if(bootIsMaster&&!loadFailed&&Array.isArray(remote?.items)&&remote.items.length>200)queueRemoteSave(); // V66.3: compacta o estado global no servidor
      await hydratePlayersDb();
      if(playerDbHydrated)await syncPlayersDbNow();
      normalizeCombatSession();
      // A versão antiga tinha apenas sessionBoard. A nova versão começa com um controlador limpo.
      // O Mestre publica esse novo estado uma vez para que todos os Players recebam a mesma base.
      if(bootIsMaster&&!remote?.combatSession){
        remoteApplying=true;
        try{await pushGlobal(globalPayload())}finally{remoteApplying=false}
      }
      let lastRemoteStamp=remoteRow?.updated_at||'';
      const applyIncoming=async(row)=>{
        const data=row?.data||row;if(!hasRemoteSharedData(data)||remoteApplying)return;
        remoteApplying=true;
        const result=mergeGlobal(data);
        storageSet(KEY,serializeState());persistCriticalCache();persistSessionCache();remoteApplying=false;
        if(!result.changed)return;
        const d=result.domains;
        if(d.includes('backgrounds')){bgAppliedSignature='';await applyBackgrounds(true);}if(d.includes('siteBrand'))applySiteBrand();
        // V65.10: vibra o celular do Player quando a mesa muda de turno e a vez
        // PASSA A SER dele. Não depende de nenhuma tela aberta — funciona mesmo
        // se o Player estiver em outra aba do app.
        if(d.includes('combatSession')&&state.session?.role==='player'){
          const me=player(),current=combatCurrent(state.combatSession);
          const isMine=!!(me&&current&&current.kind==='player'&&String(current.entityId)===String(me.id));
          if(isMine&&current.key!==lastKnownTurnParticipantId){vibratePhone([120,60,120,60,220]);playTurnAlertSound();toast('É a sua vez!');}
          lastKnownTurnParticipantId=current?current.key:'';
        }
        // Música e fundos não precisam reconstruir a página inteira.
        // V65.11: a Tela da TV agora é isolada de qualquer mudança que não seja dela
        // mesma. Antes, o Mestre editando um item/criatura/o que fosse em outra aba
        // reconstruía a tvPage() inteira -> o vídeo que estava tocando reiniciava do
        // zero na TV, mesmo sem nenhuma cinemática nova ter sido enviada.
        if(currentView==='tv'){
          if(d.includes('tvScreen')||d.includes('tvScenes'))applyTvCommand(tvCurrent(),true);
        }else if(d.some(x=>!['music','backgrounds'].includes(x))){
          if(!(state.session?.role==='player'&&currentView==='sheet')&&!(state.session?.role==='master'&&currentView==='master'))render(currentView||'home',{remote:true});
        }
        else {syncGlobalMusic(true);syncSoundboard();}
      };
      subscribeGlobal(row=>{lastRemoteStamp=row?.updated_at||lastRemoteStamp;applyIncoming(row).catch(e=>console.warn('Falha ao aplicar atualização global:',e));});
      if(playerStoreEnabled){playerDbUnsubscribe=subscribePlayers(async row=>{
        if(!row||playerDbApplying)return;
        const activePlayerId=state.session?.role==='player'?String(state.session.playerId||''):'';
        const rowId=String(row.id||'');
        const affectsActive=!!activePlayerId&&rowId===activePlayerId;
        if(row.deleted_at&&affectsActive){
          const confirmed=await confirmPlayerDeletion(activePlayerId);
          if(!confirmed)return;
          playerDbApplying=true;
          try{
            state.playerTombstones=state.playerTombstones||{};
            state.playerTombstones[activePlayerId]=Math.max(Number(state.playerTombstones[activePlayerId])||0,playerRowDeletedStamp(row)||Date.now());
            const fallback=state.session?.playerSnapshot;
            if(fallback&&String(fallback.id)===activePlayerId){
              // Keep the last known ficha available instead of throwing the user back to login.
              state.players=state.players.filter(p=>String(p.id)!==activePlayerId);
              storageSet(KEY,serializeState());
              toast('A ficha foi marcada como excluída pelo Mestre.');
            }
          }finally{playerDbApplying=false}
          return;
        }
        playerDbApplying=true;
        try{
          const beforeActive=player();
          const beforeRolls=Array.isArray(beforeActive?.rolls)?clone(beforeActive.rolls):[];
          applyPlayerRows([row]);
          const after=player();
          if(after&&beforeActive&&String(after.id)===String(beforeActive.id)){
            after.rolls=mergeRollHistory(after.rolls||[], beforeRolls);
            normalize(after);
          }
          // V65.10: vibra o celular quando o Mestre tira vida do PRÓPRIO Player deste
          // aparelho. Só dispara para quem realmente perdeu vida (não pra quem curou),
          // e só existe em Android/Chrome — iPhone não tem suporte à Vibration API.
          if(affectsActive&&beforeActive&&after&&state.session?.role==='player'){
            const hpBefore=Number(beforeActive.hp),hpAfter=Number(after.hp);
            if(Number.isFinite(hpBefore)&&Number.isFinite(hpAfter)&&hpAfter<hpBefore){
              vibratePhone([180,90,180]);
              playTurnAlertSound();
              toast(`Você perdeu ${hpBefore-hpAfter} de vida.`);
            }
          }
          if(beforeActive&&after&&String(beforeActive.id)===String(after.id)){
            const mediaChanged=['photo','soulPhoto','homeWallpaper'].some(k=>!imageValue(row?.data?.[k])&&imageValue(beforeActive?.[k])&&imageValue(after?.[k]));
            if(mediaChanged)after._syncUpdatedAt=Date.now();
          }
          if(after&&state.session?.role==='player'){
            state.session.playerSnapshot=clone(after);
            storageSet(KEY,serializeState());
            // Never rebuild the Player sheet in response to Realtime. Rebuilding the DOM
            // would destroy values the player is currently typing into attributes/skills.
            if(currentView==='sheet'){
              const last=after.rolls?.[after.rolls.length-1];
              if(last)updateDiceUI(last);
              updateResourceBars(after,'health');
              updateResourceBars(after,'sanity');
            }else if(currentView&&affectsActive)render(currentView,{remote:true});
          }else if(currentView&&state.session?.role==='master'&&!(currentView==='master'&&adminTabCurrent!=='players'))render(currentView,{remote:true});
        }finally{playerDbApplying=false}
        queuePlayerDbSave();
      })}
      subscribeLive(msg=>{if(msg.event==='tv-scene')handleTvLive(msg.payload);if(msg.event==='combat-start')combatStartLive(msg.payload);nexusHandleLive(msg);});
      // V41: polling leve. A versão anterior buscava o estado inteiro a cada 4s,
      // inclusive em celulares e em segundo plano, causando alto uso de memória/CPU.
      const isMobile=matchMedia('(max-width: 800px)').matches;
      const pollDelay=isMobile?90000:45000;
      setInterval(async()=>{
        if(document.hidden||!remoteEnabled||remoteApplying)return;
        try{
          const row=await fetchGlobal();
          if(!row?.updated_at||row.updated_at===lastRemoteStamp)return;
          lastRemoteStamp=row.updated_at;await applyIncoming(row);
        }catch(e){remoteApplying=false;}
      },pollDelay);
      document.addEventListener('visibilitychange',()=>{
        if(document.hidden||!remoteEnabled)return;
        setTimeout(async()=>{try{const row=await fetchGlobal();if(row?.updated_at&&row.updated_at!==lastRemoteStamp){lastRemoteStamp=row.updated_at;await applyIncoming(row)}}catch{}},700);
      });
    }
  }catch(e){console.warn('Modo global indisponível; usando dados locais.',e);remoteApplying=false;remoteHydrated=true;}
  if(playerStoreEnabled&&!playerDbHydrated){await hydratePlayersDb();if(playerDbHydrated)await syncPlayersDbNow();}
  try{await handleSpotifyCallback();if(spotifyLogged())await ensureSpotifyPlayer();}finally{
    // V65.8: retoma a aba em que o usuário estava nesta mesma aba do navegador
    // em vez de sempre forçar "Início/Informações básicas" a cada reload.
    const savedView=viewCacheGet();
    render(savedView||'home');
    syncGlobalMusic();syncSoundboard();applyBackgrounds();
  }
}
boot();
