import { generateTownLayout } from './mapGenerator.js';
const DEFAULT_REGIONS = [
  { id:'centro', name:'Centro Velho', points:'218,164 300,136 374,170 359,236 290,256 224,221', color:'#8e7350', description:'Praças antigas, comércio e prédios históricos.' },
  { id:'norte', name:'Bosque do Norte', points:'218,164 206,98 270,55 351,78 374,170 300,136', color:'#536c4b', description:'Mata fechada e trilhas pouco conhecidas.' },
  { id:'leste', name:'Distrito das Fábricas', points:'374,170 351,78 431,103 473,168 432,235 359,236', color:'#6b6870', description:'Galpões, oficinas e ruas industriais.' },
  { id:'sul', name:'Bairro das Colinas', points:'224,221 290,256 359,236 432,235 405,307 329,339 247,302', color:'#78644e', description:'Casas espalhadas, terrenos vazios e estradas sinuosas.' },
  { id:'oeste', name:'Represa Cinzenta', points:'206,98 218,164 224,221 247,302 178,281 139,215 151,145', color:'#456c78', description:'Água escura, mata úmida e um velho caminho de serviço.' },
  { id:'extremo', name:'Limite Rural', points:'247,302 329,339 405,307 432,235 473,168 505,217 479,293 411,353 319,371 235,345', color:'#59654a', description:'Sítios abandonados e estradas que desaparecem na neblina.' }
];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const markerId = () => `mark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

// Mapas são guardados no estado sincronizado da campanha. Aceitar um arquivo de
// 10 MiB sem otimização transformava-o em ~13,3 MiB de Base64 e podia travar o
// salvamento global. Mantemos o limite de entrada, mas normalizamos a imagem antes
// de colocá-la no estado, preservando transparência quando WebP estiver disponível.
const MAX_IMPORTED_MAP_DATA_URL_LENGTH = 2 * 1024 * 1024;
function blobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível preparar a imagem otimizada.'));
    reader.readAsDataURL(blob);
  });
}
async function optimizeImportedMap(file) {
  let bitmap;
  try {
    if (typeof createImageBitmap === 'function') bitmap = await createImageBitmap(file);
    else {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      try {
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
          image.src = objectUrl;
        });
        bitmap = image;
      } finally { URL.revokeObjectURL(objectUrl); }
    }
    const sourceWidth = Number(bitmap.width || bitmap.naturalWidth);
    const sourceHeight = Number(bitmap.height || bitmap.naturalHeight);
    if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > 100_000_000) {
      throw new Error('A imagem tem dimensões inválidas ou grandes demais para processar com segurança.');
    }
    let scale = Math.min(1, 2200 / sourceWidth, 1700 / sourceHeight);
    for (let pass = 0; pass < 5; pass++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('O navegador não conseguiu preparar a imagem.');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.70, 0.58]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob) continue;
        const dataUrl = await blobAsDataUrl(blob);
        if (dataUrl.length <= MAX_IMPORTED_MAP_DATA_URL_LENGTH) return dataUrl;
      }
      scale *= 0.78;
    }
    throw new Error('O mapa continua muito pesado após a otimização. Exporte uma versão menor e tente novamente.');
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}
export function campaignMapPage(state, isMaster, currentPlayer) {
  const map = state.campaignMap && Array.isArray(state.campaignMap.regions)
    ? state.campaignMap
    : { regions: DEFAULT_REGIONS.map(x => ({ ...x })) };
  const regions = map.regions;
  const cartography = map.cartography || {};
  const allMarkers = (state.players || []).flatMap(p => (p.mapMarkers || []).map(m => ({
    ...m, ownerName: p.name || p.login || 'Player', ownerId: p.id,
    mine: Boolean(currentPlayer && String(p.id) === String(currentPlayer.id))
  })));
  const regionShapes = regions.map(r => `<polygon class="campaign-region" data-region-id="${esc(r.id)}" points="${esc(r.points)}" fill="${esc(r.color || '#55404a')}" tabindex="0" role="button" aria-label="${esc(r.name)}"><title>${esc(r.name)}</title></polygon>`).join('');
  const regionLabels = regions.map(r => {
    const pts = String(r.points || '').trim().split(/\s+/).map(v => v.split(',').map(Number)).filter(v => v.length === 2 && v.every(Number.isFinite));
    const x = pts.reduce((a, p) => a + p[0], 0) / Math.max(1, pts.length);
    const y = pts.reduce((a, p) => a + p[1], 0) / Math.max(1, pts.length);
    return `<g class="campaign-region-label-group" pointer-events="none"><text class="campaign-region-label" x="${Math.round(x)}" y="${Math.round(y)}">${esc(r.name)}</text><circle class="campaign-region-dot" cx="${Math.round(x)}" cy="${Math.round(y + 9)}" r="1.8"/></g>`;
  }).join('');
  const markerShapes = allMarkers.map(m => `<g class="campaign-marker ${m.mine ? 'mine' : ''}" data-marker-id="${esc(m.id)}" transform="translate(${Number(m.x) || 0} ${Number(m.y) || 0})" tabindex="0" role="button" aria-label="${esc(m.title)} — ${esc(m.ownerName)}"><circle class="campaign-marker-pulse" r="12"/><circle class="campaign-marker-pin" r="6.5" fill="${esc(m.color || '#e0b75a')}"/><circle class="campaign-marker-core" r="2"/><text x="11" y="4">${esc(m.title)}</text><title>${esc(m.title)} — ${esc(m.ownerName)}</title></g>`).join('');
  const roads = Array.isArray(cartography.roads) ? cartography.roads : [];
  const backgroundMap = typeof cartography.importedMap === 'string' ? cartography.importedMap : '';
  const assets = Array.isArray(cartography.assets) ? cartography.assets : [];
  const assetShapes = assets.map(a => `<image class="campaign-map-asset" data-asset-id="${esc(a.id)}" href="${esc(a.src)}" x="${Number(a.x)||0}" y="${Number(a.y)||0}" width="${Math.max(8,Math.min(180,Number(a.width)||36))}" height="${Math.max(8,Math.min(180,Number(a.height)||36))}" preserveAspectRatio="xMidYMid meet" tabindex="0" role="button" aria-label="${esc(a.name||'Asset')}"/>`).join('');
  const blocks = (cartography.blocks || []).slice(0, 240).map(points => `<polygon points="${esc(points)}"/>`).join('');
  return `<main class="campaign-atlas">
    <header class="campaign-atlas-header">
      <div class="campaign-atlas-title"><span class="campaign-atlas-eyebrow"><i></i> ARQUIVO CARTOGRÁFICO • ASHEN TESTIMONY</span><h1>Vales de Cinza</h1><p>Um território coberto por névoa, rumores e lugares que ninguém admite conhecer.</p></div>
      <div class="campaign-atlas-stamp" aria-hidden="true"><span>ATLAS</span><b>IV</b><small>MMXXVI</small></div>
    </header>
    <div class="campaign-atlas-toolbar"><span class="campaign-atlas-status"><i></i> CARTA ${esc(String(map.reference || 'Nº 013').slice(0, 32).toUpperCase())}</span><span class="campaign-atlas-hint">${isMaster ? 'Gere a base aqui ou abra o RPG Map Editor e importe o mapa exportado.' : 'Toque no mapa para marcar um local.'}</span></div>
    <section class="campaign-map-layout campaign-atlas-layout">
      <div class="campaign-map-panel campaign-atlas-map-panel">
        <div class="campaign-atlas-map-frame">
          <svg id="campaignMapSvg" viewBox="55 15 520 400" role="img" aria-label="Mapa interativo de Vales de Cinza">
            <defs>
              <pattern id="atlasGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" class="atlas-grid-line" fill="none"/></pattern>
              <pattern id="atlasHatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-2 7 L7 -2 M3 9 L9 3" class="atlas-hatch-line" fill="none"/></pattern>
              <filter id="atlasInk"><feGaussianBlur stdDeviation="1.2"/></filter>
              <linearGradient id="atlasLand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#262126"/><stop offset="1" stop-color="#111014"/></linearGradient>
            </defs>
            <rect x="55" y="15" width="520" height="400" class="atlas-ground"/>
            <rect x="55" y="15" width="520" height="400" fill="url(#atlasGrid)"/>
            <g class="atlas-topography" fill="none">
              <path d="M80 115 C110 55 190 54 220 103 S260 190 210 225 S112 240 90 195 S60 145 80 115Z"/>
              <path d="M91 121 C119 77 175 72 203 111 S236 182 201 208 S128 222 105 188 S75 151 91 121Z"/>
              <path d="M370 60 C418 32 492 67 499 116 S465 174 423 160 S355 104 370 60Z"/>
              <path d="M383 72 C419 49 473 76 480 113 S455 151 426 143 S370 105 383 72Z"/>
              <path d="M250 292 C291 255 354 281 370 320 S337 377 290 365 S222 326 250 292Z"/>
            </g>
            ${cartography.waterPath ? `<path class="campaign-map-water atlas-river" d="${esc(cartography.waterPath)}"/>` : ''}
            <g class="atlas-forest" aria-hidden="true"><path d="M93 75 l5 -10 5 10z M110 95 l5 -11 5 11z M130 82 l5 -10 5 10z M151 111 l5 -11 5 11z M168 91 l5 -10 5 10z M420 220 l5 -10 5 10z M443 238 l5 -11 5 11z M464 218 l5 -10 5 10z M482 249 l5 -11 5 11z M450 270 l5 -10 5 10z M267 329 l5 -10 5 10z M286 344 l5 -11 5 11z"/></g>
            <g class="campaign-map-blocks">${blocks}</g>
            <g class="campaign-map-regions">${regionShapes}</g>
            <g class="campaign-map-roads">${roads.map((d, i) => `<path class="campaign-road ${i < 2 ? 'atlas-road-main' : ''}" d="${esc(d)}"/>`).join('')}</g>
            <g class="atlas-trails">${(cartography.trails || []).map(d => `<path d="${esc(d)}"/>`).join('')}</g>
            ${backgroundMap ? `<image class="campaign-imported-map" href="${esc(backgroundMap)}" x="55" y="15" width="520" height="400" preserveAspectRatio="xMidYMid meet" opacity="0.96"/>` : ''}
            <g class="campaign-map-labels">${regionLabels}</g>
            <g class="atlas-compass" transform="translate(525 57)" aria-label="Rosa dos ventos"><circle r="19"/><path d="M0 -15 L5 0 0 15 -5 0Z"/><path d="M-15 0H15 M0 -15V15"/><text x="0" y="-24">N</text></g>
            <g id="campaignMapAssets">${assetShapes}</g>
            <g>${markerShapes}</g>
            <text class="atlas-map-note" x="72" y="397">CARTA DE CAMPO • ESCALA NÃO OFICIAL</text>
          </svg>
          <div class="campaign-atlas-edge-label atlas-edge-top">REGIÃO INTERDITADA</div><div class="campaign-atlas-edge-label atlas-edge-bottom">NÃO CIRCULAR APÓS O ANOITECER</div>
        </div>
        <div class="campaign-map-legend"><span><i class="map-legend-region"></i> Distritos</span><span><i class="map-legend-marker"></i> Marcadores</span><span><i class="map-legend-road"></i> Vias conhecidas</span></div>
      </div>
      <aside class="campaign-map-side campaign-atlas-side">
        <div class="atlas-side-heading"><span class="section-kicker">REGISTRO DE CAMPO</span><span class="atlas-record-number">01 / MAPA</span></div>
        <h2 id="campaignMapSelectedTitle">Nenhum local selecionado</h2><p id="campaignMapSelectedDescription">Escolha um distrito no mapa para consultar o registro. Os espaços em branco também contam uma história.</p>
        ${isMaster ? `<div class="campaign-map-editor atlas-editor"><h3>Gerador externo</h3><p class="tiny muted">Crie o mapa no RPG Map Editor e exporte em PNG. Depois importe a imagem abaixo como base visual.</p><button class="btn primary" id="openRpgMapEditor" type="button">Abrir RPG Map Editor ↗</button><label>Importar mapa exportado (PNG/JPG/WebP)<input id="importedMapFile" type="file" accept="image/png,image/jpeg,image/webp"></label><button class="btn" id="removeImportedMap" type="button" ${backgroundMap ? '' : 'hidden'}>Remover mapa importado</button><div class="atlas-editor-divider"></div><h3>Gerar terreno-base</h3><label>Referência de atmosfera<input id="mapShapeReference" maxlength="80" placeholder="Ex.: vale industrial tomado pela névoa"></label><label class="map-option"><input id="mapGenerateRoads" type="checkbox"> Gerar caminhos (opcional)</label><label class="map-option"><input id="mapGenerateWater" type="checkbox"> Gerar rio/lago (opcional)</label><label class="map-option"><input id="mapGenerateSquares" type="checkbox"> Gerar quadradinhos de casas secundárias</label><button class="btn" id="generateMapShape">Gerar terreno</button><p class="tiny muted">O padrão gera apenas o formato. Água, caminhos e quadradinhos só entram quando você marcar as opções. Assets importados são preservados.</p><div class="atlas-editor-divider"></div><h3>Montar com assets</h3><label>Importar imagem PNG/JPG/WebP<input id="mapAssetFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="tiny muted">Importe um asset com fundo transparente para posicioná-lo no mapa. Toque no mapa para colocar; arraste para mover.</p><button class="btn" id="mapAssetCancel" hidden>Cancelar posicionamento</button><div class="atlas-editor-divider"></div><h3>Editar distrito</h3><label>Nome<input id="mapRegionName" maxlength="48" placeholder="Nome do distrito"></label><label>Registro<textarea id="mapRegionDescription" rows="3" maxlength="400" placeholder="O que se conta sobre este lugar..."></textarea></label><label>Cor cartográfica<input id="mapRegionColor" type="color" value="#8e7350"></label><button class="btn primary" id="saveMapRegion" disabled>Gravar alterações</button></div>` : `<div class="campaign-map-editor atlas-editor"><h3>Adicionar marcador</h3><p class="tiny muted">Toque em qualquer ponto vazio da carta e registre um lugar que encontrou.</p><label>Nome do local<input id="mapMarkerTitle" maxlength="36" placeholder="Ex.: Capela sem sinos"></label><label>Cor do marcador<input id="mapMarkerColor" type="color" value="#d7a65a"></label><button class="btn primary" id="saveMapMarker" disabled>Escolha um ponto no mapa</button><button class="btn" id="cancelMapMarker" hidden>Cancelar edição</button></div>`}
        <div class="campaign-map-marker-list atlas-marker-list"><div class="atlas-list-heading"><h3>Locais anotados</h3><span>${allMarkers.length.toString().padStart(2, '0')}</span></div>${allMarkers.length ? allMarkers.map(m => `<button class="campaign-map-marker-row" data-focus-marker="${esc(m.id)}"><span style="background:${esc(m.color || '#e0b75a')}"></span><strong>${esc(m.title)}</strong><small>${esc(m.ownerName)}</small>${m.mine ? '<b>SEU</b>' : ''}</button>`).join('') : '<p class="small muted">Ainda não há registros. O primeiro pode ser seu.</p>'}</div>
        <footer class="atlas-side-footer"><span>ASHEN ARCHIVE</span><span>DOC. 013-A</span></footer>
      </aside>
    </section>
  </main>`;
}
export function bindCampaignMap({state,isMaster,currentPlayer,save,saveGlobal,toast,rerender}) {
  const svg=document.getElementById('campaignMapSvg'); if(!svg)return;
  if(!state.campaignMap||!Array.isArray(state.campaignMap.regions))state.campaignMap={regions:DEFAULT_REGIONS.map(x=>({...x}))};
  let selectedRegion=null, pendingPoint=null, editingMarker=null;
  const regions=state.campaignMap.regions;
  const showRegion=r=>{selectedRegion=r;document.getElementById('campaignMapSelectedTitle').textContent=r.name;document.getElementById('campaignMapSelectedDescription').textContent=r.description||'Nenhuma descrição.';if(isMaster){document.getElementById('mapRegionName').value=r.name;document.getElementById('mapRegionDescription').value=r.description||'';document.getElementById('mapRegionColor').value=r.color||'#8e7350';document.getElementById('saveMapRegion').disabled=false}};
  svg.querySelectorAll('[data-region-id]').forEach(el=>{const activate=()=>{const r=regions.find(x=>x.id===el.dataset.regionId);if(r)showRegion(r)};el.addEventListener('click',activate);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}})});
  if(isMaster){
    document.getElementById('openRpgMapEditor')?.addEventListener('click',()=>window.open('https://www.rpgmapeditor.com/generators','_blank','noopener,noreferrer'));
    const importedMapInput=document.getElementById('importedMapFile');
    const removeImportedMap=document.getElementById('removeImportedMap');
    importedMapInput?.addEventListener('change',()=>{
      const file=importedMapInput.files?.[0]; if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)){toast('Use um arquivo PNG, JPG ou WebP.');importedMapInput.value='';return;}
      if(file.size>10*1024*1024){toast('O mapa exportado deve ter até 10 MB. Reduza o tamanho da imagem e tente novamente.');importedMapInput.value='';return;}
      const importButton=importedMapInput.closest('label');
      if(importedMapInput.dataset.processing==='1')return;
      importedMapInput.dataset.processing='1';
      if(importButton)importButton.setAttribute('aria-busy','true');
      optimizeImportedMap(file).then(async src=>{
        state.campaignMap.cartography={...(state.campaignMap.cartography||{}),importedMap:src};
        save();
        try{
          await saveGlobal?.();
          toast('Mapa otimizado e importado. Seus assets e marcadores foram preservados.');
        }catch(err){
          console.error(err);
          toast('Mapa otimizado e salvo neste dispositivo, mas a sincronização falhou. Tente sincronizar novamente.');
        }
        rerender();
      }).catch(err=>{
        console.error('Falha ao otimizar o mapa:',err);
        toast(err?.message||'Não foi possível preparar esse mapa.');
      }).finally(()=>{
        delete importedMapInput.dataset.processing;
        if(importButton)importButton.removeAttribute('aria-busy');
        importedMapInput.value='';
      });
    });
    removeImportedMap?.addEventListener('click',async()=>{
      if(!confirm('Remover a imagem de base importada? Os assets posicionados serão preservados.'))return;
      if(state.campaignMap.cartography)delete state.campaignMap.cartography.importedMap;
      save();try{await saveGlobal?.();}catch(err){console.error(err);toast('Removido localmente, mas a sincronização falhou.');}
      toast('Imagem de base removida.');rerender();
    });
    document.getElementById('saveMapRegion')?.addEventListener('click',async()=>{if(!selectedRegion)return;selectedRegion.name=document.getElementById('mapRegionName').value.trim()||selectedRegion.name;selectedRegion.description=document.getElementById('mapRegionDescription').value.trim();selectedRegion.color=document.getElementById('mapRegionColor').value||selectedRegion.color;save();try{await saveGlobal?.();toast('Região atualizada e sincronizada.')}catch(err){console.error('Falha ao sincronizar região do mapa:',err);toast('Região salva neste dispositivo, mas a sincronização falhou. Verifique a conexão antes de sair.')}rerender()});
    document.getElementById('generateMapShape')?.addEventListener('click',async()=>{
      const reference=document.getElementById('mapShapeReference')?.value.trim();
      if(!reference){toast('Digite um lugar de referência primeiro.');return}
      if(!confirm(`Gerar um novo terreno-base inspirado em “${reference}”? O formato das regiões será substituído. Assets já colocados e marcadores dos jogadores serão preservados.`))return;
      // Gera uma planta urbana procedural: bairros contíguos, avenidas, anéis e quadras.
      // A referência orienta a semente e características gerais (ex.: porto/costa), não copia ruas reais.
      const generated=generateTownLayout(reference,regions,{includeRoads:document.getElementById('mapGenerateRoads')?.checked===true,includeWater:document.getElementById('mapGenerateWater')?.checked===true,includeSquares:document.getElementById('mapGenerateSquares')?.checked===true});
      generated.cartography.assets=Array.isArray(state.campaignMap?.cartography?.assets)?state.campaignMap.cartography.assets:[];
      const candidate=generated.regions;
      if(!candidate.every(r=>String(r.points||'').trim().split(/\s+/).length>=4)){toast('Não foi possível gerar uma malha urbana válida.');return}
      state.campaignMap={...(state.campaignMap||{}),reference,generatedAt:Date.now(),regions:candidate,cartography:generated.cartography};
      save();try{await saveGlobal?.()}catch(err){toast('Formato gerado localmente, mas a sincronização falhou. Verifique a conexão antes de sair.');console.error(err);rerender();return}
      toast(`Terreno-base gerado. Você controla os caminhos, a água e a decoração.`);rerender();
    });
    const assetInput=document.getElementById('mapAssetFile');
    const assetCancel=document.getElementById('mapAssetCancel');
    let pendingAsset=null;
    const toMapPoint=e=>{const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const local=pt.matrixTransform(svg.getScreenCTM().inverse());return {x:Math.round(local.x),y:Math.round(local.y)}};
    assetInput?.addEventListener('change',()=>{const file=assetInput.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)){toast('Use PNG, JPG ou WebP.');assetInput.value='';return}if(file.size>500000){toast('Esse asset passa de 500 KB. Reduza o arquivo antes de importar.');assetInput.value='';return}const reader=new FileReader();reader.onload=()=>{const probe=new Image();probe.onload=()=>{const ratio=probe.naturalWidth/Math.max(1,probe.naturalHeight);pendingAsset={id:markerId(),name:file.name.slice(0,80),src:String(reader.result),width:Math.max(18,Math.min(100,Math.round(56*Math.min(2,ratio)))),height:Math.max(18,Math.min(100,Math.round(56/Math.max(.5,ratio))))};assetCancel.hidden=false;toast('Asset carregado. Toque no mapa para posicioná-lo.');};probe.onerror=()=>toast('Não foi possível ler essa imagem.');probe.src=String(reader.result)};reader.readAsDataURL(file)});
    assetCancel?.addEventListener('click',()=>{pendingAsset=null;assetInput.value='';assetCancel.hidden=true});
    svg.addEventListener('click',async e=>{if(!pendingAsset||e.target.closest('[data-region-id]')||e.target.closest('[data-marker-id]'))return;const point=toMapPoint(e);const assetsNow=Array.isArray(state.campaignMap.cartography?.assets)?state.campaignMap.cartography.assets:[];assetsNow.push({...pendingAsset,x:point.x-pendingAsset.width/2,y:point.y-pendingAsset.height/2});state.campaignMap.cartography={...(state.campaignMap.cartography||{}),assets:assetsNow};pendingAsset=null;assetInput.value='';assetCancel.hidden=true;save();try{await saveGlobal?.()}catch(err){console.error(err);toast('Asset colocado localmente, mas a sincronização falhou.');rerender();return}toast('Asset colocado no mapa. Arraste-o para ajustar a posição.');rerender()});
    svg.querySelectorAll('[data-asset-id]').forEach(el=>{let dragging=false;el.addEventListener('pointerdown',e=>{dragging=true;el.setPointerCapture?.(e.pointerId);e.stopPropagation()});el.addEventListener('pointermove',e=>{if(!dragging)return;const point=toMapPoint(e);const asset=state.campaignMap.cartography?.assets?.find(a=>a.id===el.dataset.assetId);if(asset){asset.x=point.x-Number(asset.width)/2;asset.y=point.y-Number(asset.height)/2;el.setAttribute('x',asset.x);el.setAttribute('y',asset.y)}});el.addEventListener('pointerup',async()=>{if(!dragging)return;dragging=false;save();try{await saveGlobal?.()}catch(err){console.error(err);toast('Movimento salvo localmente; sincronização falhou.')}});el.addEventListener('dblclick',async e=>{e.stopPropagation();if(!confirm('Remover este asset do mapa?'))return;state.campaignMap.cartography.assets=state.campaignMap.cartography.assets.filter(a=>a.id!==el.dataset.assetId);save();try{await saveGlobal?.();toast('Asset removido e sincronizado.')}catch(err){console.error('Falha ao sincronizar remoção do asset:',err);toast('Asset removido neste dispositivo, mas a sincronização falhou.')}rerender()})});
    return
  }
  const p=currentPlayer;if(!p)return;p.mapMarkers=Array.isArray(p.mapMarkers)?p.mapMarkers:[];
  const title=document.getElementById('mapMarkerTitle'),color=document.getElementById('mapMarkerColor'),button=document.getElementById('saveMapMarker'),cancel=document.getElementById('cancelMapMarker');
  const updateButton=()=>{button.disabled=!(pendingPoint&&title.value.trim());button.textContent=editingMarker?'Salvar alterações':pendingPoint?'Adicionar marcador':'Escolha um ponto no mapa'};
  title.addEventListener('input',updateButton);
  svg.addEventListener('click',e=>{if(e.target.closest('[data-marker-id]')||e.target.closest('[data-region-id]'))return;const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const local=point.matrixTransform(svg.getScreenCTM().inverse());const vb=svg.viewBox.baseVal;pendingPoint={x:Math.round(Math.max(vb.x,Math.min(vb.x+vb.width,local.x))),y:Math.round(Math.max(vb.y,Math.min(vb.y+vb.height,local.y)))};editingMarker=null;title.value='';button.textContent='Adicionar marcador';cancel.hidden=true;updateButton();title.focus()});
  svg.querySelectorAll('[data-marker-id]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const m=p.mapMarkers.find(x=>String(x.id)===String(el.dataset.markerId));if(!m){toast('Você só pode editar seus próprios marcadores.');return}editingMarker=m;pendingPoint={x:m.x,y:m.y};title.value=m.title;color.value=m.color||'#e0b75a';button.textContent='Salvar alterações';button.disabled=false;cancel.hidden=false;document.getElementById('campaignMapSelectedTitle').textContent=m.title;document.getElementById('campaignMapSelectedDescription').textContent='Seu marcador. Você pode alterar o nome, a cor ou removê-lo.';const old=document.getElementById('deleteMapMarker');if(old)old.remove();cancel.insertAdjacentHTML('afterend','<button class="btn danger" id="deleteMapMarker">Remover marcador</button>');document.getElementById('deleteMapMarker').onclick=()=>{p.mapMarkers=p.mapMarkers.filter(x=>x.id!==m.id);save();toast('Marcador removido.');rerender()}}));
  document.querySelectorAll('[data-focus-marker]').forEach(el=>el.addEventListener('click',()=>{const marker=p.mapMarkers.find(x=>x.id===el.dataset.focusMarker);if(marker){title.value=marker.title;color.value=marker.color||'#e0b75a';pendingPoint={x:marker.x,y:marker.y};editingMarker=marker;button.disabled=false;button.textContent='Salvar alterações';cancel.hidden=false}}));
  button.addEventListener('click',()=>{if(!pendingPoint||!title.value.trim())return;const values={title:title.value.trim(),color:color.value||'#e0b75a',x:pendingPoint.x,y:pendingPoint.y,updatedAt:Date.now()};if(editingMarker)Object.assign(editingMarker,values);else p.mapMarkers.push({id:markerId(),...values,createdAt:Date.now()});save();toast(editingMarker?'Marcador atualizado.':'Marcador adicionado.');rerender()});
  cancel.addEventListener('click',()=>{pendingPoint=null;editingMarker=null;title.value='';cancel.hidden=true;document.getElementById('deleteMapMarker')?.remove();updateButton()});
}
