/*
 * Sources documentées dans SOURCES.md — synchronisation 2026-07-30.
 * ZNIEFF / Natura 2000 : API Carto IGN, données INPN/PatriNat, Licence Ouverte 2.0.
 * Connexions : SDRIF-E 2024 approuvé en 2025, Institut Paris Region / Région IDF.
 * Observations agrégées : GeoNat'îdF / ARB Île-de-France. Une absence n'est jamais une absence d'espèce.
 */
'use strict';

const DATA = {
  communes:'data/communes_95.geojson', znieff1:'data/znieff1.json', znieff2:'data/znieff2.json',
  naturaHabitat:'data/natura-habitat.json', naturaOiseaux:'data/natura-oiseaux.json',
  pnr:'data/parcs-naturels-regionaux.json', reserves:'data/reserves-naturelles.json',
  protections:'data/espaces-naturels-proteges.json', vegetation:'data/zones-vegetation.geojson',
  jardins:'data/jardins-remarquables.json', connexions:'data/connexions-ecologiques.json',
  observations:'data/observations-mailles.json'
};
const CONFIG = {
  bounds:[[48.88,1.60],[49.25,2.62]],
  layers:[
    {id:'vegetation',group:'Espaces de nature',label:'Boisements et végétation',description:'Bois, forêts, bosquets, landes, peupleraies et vergers.',color:'#5b8c3a',source:'IGN · BD TOPO',active:true},
    {id:'jardins',group:'Espaces de nature',label:'Jardins remarquables',description:'Jardins labellisés par le ministère de la Culture.',color:'#95c11f',source:'DRAC · Région Île-de-France',active:false},
    {id:'pnr',group:'Espaces protégés',label:'Parcs naturels régionaux',description:'Vexin français et Oise–Pays de France.',color:'#2f6f3e',source:'INPN · API Carto IGN',active:true},
    {id:'reserves',group:'Espaces protégés',label:'Réserves naturelles',description:'Réserves naturelles nationales.',color:'#006a6f',source:'INPN · API Carto IGN',active:true},
    {id:'protections',group:'Espaces protégés',label:'Autres espaces protégés',description:'Arrêtés de protection, réserves biologiques et sites conservatoires.',color:'#008941',source:'IGN · BD TOPO',active:false},
    {id:'znieff1',group:'Espaces remarquables',label:'ZNIEFF de type I',description:'Secteurs de grand intérêt biologique ou écologique.',color:'#e4792f',source:'INPN · API Carto IGN',active:true},
    {id:'znieff2',group:'Espaces remarquables',label:'ZNIEFF de type II',description:'Grands ensembles naturels riches et peu modifiés.',color:'#f2b37f',source:'INPN · API Carto IGN',active:false},
    {id:'naturaHabitat',group:'Protections européennes',label:'Natura 2000 · Habitats',description:'Zones spéciales de conservation — directive Habitats.',color:'#18753c',source:'INPN · API Carto IGN',active:true},
    {id:'naturaOiseaux',group:'Protections européennes',label:'Natura 2000 · Oiseaux',description:'Zones de protection spéciale — directive Oiseaux.',color:'#00a95f',source:'INPN · API Carto IGN',active:false},
    {id:'connexions',group:'Continuités écologiques',label:'Connexions d’intérêt régional',description:'Liens entre les sous-trames verte et bleue du SDRIF-E.',color:'#6a4c93',source:'SDRIF-E · Institut Paris Region',active:true},
    {id:'observations',group:'Connaissance naturaliste',label:'Observations d’espèces agrégées',description:'Nombre d’observations par maille ; pression variable.',color:'#000091',source:'GeoNat’îdF · ARB IDF',active:false}
  ]
};
const state={data:{},layers:{},communesLayer:null,department:null,selectedCommune:null,selectedPoint:null};
const map=L.map('map',{zoomControl:true,preferCanvas:true,minZoom:8,maxZoom:19,maxBounds:[[48.63,.7],[49.37,3.35]]}).fitBounds(CONFIG.bounds,{padding:[24,24]});
map.createPane('departmentMask');map.getPane('departmentMask').style.zIndex='460';map.getPane('departmentMask').style.pointerEvents='none';
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
map.attributionControl.setPrefix('Leaflet');

const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'—').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatNumber=n=>new Intl.NumberFormat('fr-FR').format(Number(n)||0);
const areaLabel=n=>Number(n)?`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(n))} ha`:'Non renseignée';

function renderControls(){
  const root=$('layer-list'); const groups=[...new Set(CONFIG.layers.map(x=>x.group))];
  root.innerHTML=groups.map(group=>`<div class="layer-group"><strong>${group}</strong>${CONFIG.layers.filter(x=>x.group===group).map(x=>`<div class="layer-row"><button class="switch" type="button" data-layer="${x.id}" aria-label="Afficher ${x.label}" aria-pressed="${x.active}"></button><div class="layer-copy"><strong>${x.label}</strong><span>${x.description}<br>${x.source}</span></div><i class="swatch" style="background:${x.color}"></i></div>`).join('')}</div>`).join('');
  root.querySelectorAll('.switch').forEach(button=>button.addEventListener('click',()=>toggleLayer(button.dataset.layer)));
  updateLegend();
}
function updateLegend(){
  $('legend-items').innerHTML=CONFIG.layers.filter(x=>x.active).map(x=>`<div class="legend-row"><i style="background:${x.color};${x.id==='connexions'?'border-radius:10px;height:4px':''}"></i><span>${x.label}</span></div>`).join('')||'<div class="legend-row">Aucune information affichée</div>';
}
function toggleLayer(id,forced){
  const def=CONFIG.layers.find(x=>x.id===id); def.active=forced??!def.active;
  const button=document.querySelector(`[data-layer="${id}"]`); if(button)button.setAttribute('aria-pressed',String(def.active));
  const layer=state.layers[id]; if(layer){if(def.active)layer.addTo(map);else map.removeLayer(layer)} updateLegend();
}
function styleFor(id,feature){
  const color=CONFIG.layers.find(x=>x.id===id).color;
  if(id==='vegetation')return{color,weight:.5,opacity:.65,fillColor:color,fillOpacity:.28};
  if(id==='pnr')return{color,weight:2.2,dashArray:'8 5',opacity:.9,fillColor:color,fillOpacity:.08};
  if(id==='protections'||id==='reserves')return{color,weight:2,opacity:.95,fillColor:color,fillOpacity:.2};
  if(id==='jardins')return{color:'#ffffff',weight:1.5,fillColor:color,fillOpacity:.9};
  if(id==='connexions')return{color,weight:5,opacity:.75,fillColor:color,fillOpacity:.2};
  if(id==='observations'){const n=feature.properties.nb_observations||0;return{color:'#fff',weight:1,fillColor:color,fillOpacity:Math.min(.65,.12+Math.log10(n+1)/8)}}
  return{color,weight:id.startsWith('natura')?2.5:1.5,fillColor:color,fillOpacity:id.startsWith('natura')?.24:.18};
}
function nameFor(id,p){return p.nom||p.nom_officiel||p.nom_du_jardin||p.sitename||p.commune||(id==='observations'?`Maille d’observations n° ${p.id_maille}`:'Objet cartographique')}
function makeLayer(id,data){
  // Les fichiers conservent certains objets transfrontaliers. L'affichage est
  // strictement limité aux objets qui intersectent le Val-d'Oise.
  const visible={...data,features:(data.features||[]).filter(feature=>{try{return turf.booleanIntersects(feature,state.department)}catch{return false}})};
  const layer=L.geoJSON(visible,{style:f=>styleFor(id,f),pointToLayer:(feature,latlng)=>L.circleMarker(latlng,{...styleFor(id,feature),radius:id==='connexions'?6:id==='jardins'?7:5}),onEachFeature:(feature,l)=>{
    l.on('click',e=>{L.DomEvent.stopPropagation(e);selectFeature(id,feature,l,e.latlng)});
    l.bindTooltip(nameFor(id,feature.properties),{sticky:true});
  }}); state.layers[id]=layer; if(CONFIG.layers.find(x=>x.id===id).active)layer.addTo(map);
}
function selectFeature(id,feature,layer,latlng){
  if(!insideDepartment(latlng))return;
  state.selectedPoint=latlng; const p=feature.properties||{}; const def=CONFIG.layers.find(x=>x.id===id);
  const sourceUrl=p.url||(id==='connexions'?'https://data.iledefrance.fr/explore/dataset/connexion-ecologique-sdrif-e/':id==='observations'?'https://geonature.arb-idf.fr/atlas/':id==='vegetation'||id==='protections'?'https://geoservices.ign.fr/bdtopo':id==='jardins'?'https://data.iledefrance.fr/explore/dataset/liste-des-jardins-remarquables/':'https://inpn.mnhn.fr/');
  let detail='';
  if(id.startsWith('znieff'))detail=`<div class="result-line"><span>Identifiant INPN</span><b>${escapeHtml(p.id_mnhn)}</b></div><div class="result-line"><span>Surface cartographiée</span><b>${areaLabel(p.area_sig)}</b></div><p class="fact">Une ZNIEFF est un inventaire de connaissance. Elle ne constitue pas, à elle seule, une protection réglementaire.</p>`;
  if(id.startsWith('natura'))detail=`<div class="result-line"><span>Code européen</span><b>${escapeHtml(p.sitecode)}</b></div><div class="result-line"><span>Surface cartographiée</span><b>${areaLabel(p.area_sig)}</b></div><p class="fact">Natura 2000 vise le maintien ou le rétablissement d’habitats et d’espèces d’intérêt communautaire.</p>`;
  if(id==='connexions')detail=`<div class="result-line"><span>Communes repères</span><b>${escapeHtml(p.commune)}</b></div><div class="result-line"><span>Sous-trames</span><b>${escapeHtml(p.lib_sstra)}</b></div><p class="indicator">Connexion écologique d’intérêt régional issue du SDRIF-E, à lire à l’échelle du 1:150 000.</p>`;
  if(id==='observations')detail=`<div class="result-line"><span>Observations agrégées</span><b>${formatNumber(p.nb_observations)}</b></div><div class="result-line"><span>Dernière observation</span><b>${escapeHtml(p.last_observation)}</b></div><p class="warning">Le nombre reflète aussi l’effort de prospection. Une maille vide ne signifie pas une absence d’espèces.</p>`;
  if(id==='pnr'||id==='reserves'||id==='protections')detail=`<div class="result-line"><span>Type d’espace</span><b>${escapeHtml(p.nature||def.label)}</b></div><div class="result-line"><span>Identifiant</span><b>${escapeHtml(p.id_mnhn||p.cleabs)}</b></div><p class="fact">Périmètre officiel de connaissance ou de protection. Consultez la fiche source pour connaître sa portée exacte.</p>`;
  if(id==='vegetation')detail=`<div class="result-line"><span>Nature</span><b>${escapeHtml(p.nature)}</b></div><div class="result-line"><span>Précision planimétrique</span><b>${escapeHtml(p.precision_planimetrique)} m</b></div><p class="indicator">Couverture végétale issue de la BD TOPO. Elle ne renseigne pas l’ouverture au public ni la qualité écologique.</p>`;
  if(id==='jardins')detail=`<div class="result-line"><span>Commune</span><b>${escapeHtml(p.commune)}</b></div><div class="result-line"><span>Label obtenu</span><b>${escapeHtml(p.annee_obtention)}</b></div><div class="result-line"><span>Accès</span><b>${escapeHtml((p.ouvert_au_public||[]).join(', '))}</b></div><p class="fact">Jardin remarquable labellisé par le ministère de la Culture.</p>`;
  openDrawer(nameFor(id,p),def.label,`<strong>${escapeHtml(nameFor(id,p))}</strong> relève de la couche « ${escapeHtml(def.label)} » à cet endroit.`,`<section class="result-section"><h3>01 · Ce que montre la carte</h3>${detail}<p class="source-note">Fait source : ${escapeHtml(def.source)} · synchronisation 30/07/2026.</p></section><section class="result-section"><h3>02 · Comment l’utiliser</h3><p>Cette donnée aide au repérage et au diagnostic territorial. Croisez-la avec les autres couches et consultez la fiche officielle avant toute décision.</p><p class="warning">Cette carte ne remplace ni une expertise écologique, ni un document opposable, ni la consultation du service compétent.</p></section>`,sourceUrl);
  layer.setStyle({...styleFor(id,feature),weight:4});
}
function openDrawer(title,sub,summary,body,source){
  $('drawer-title').textContent=title;$('drawer-sub').textContent=sub;$('drawer-summary').innerHTML=`<strong>À retenir</strong><p>${summary}</p>`;$('drawer-body').innerHTML=body;$('drawer-source').href=source;
  $('drawer').classList.add('open');$('drawer').setAttribute('aria-hidden','false');$('text-alternative').textContent=`${title}. ${sub}. ${summary.replace(/<[^>]+>/g,'')}`;
}
function insideDepartment(latlng){return state.department?turf.booleanPointInPolygon(turf.point([latlng.lng,latlng.lat]),state.department):true}
function selectMapPoint(latlng){
  if(!insideDepartment(latlng)){showMapMessage('Hors du Val-d’Oise','Choisissez un point situé dans le département.');return}
  state.selectedPoint=latlng; const hits=[];
  for(const def of CONFIG.layers.filter(x=>x.active))for(const feature of state.data[def.id]?.features||[])try{if((feature.geometry.type.includes('Polygon')&&turf.booleanPointInPolygon(turf.point([latlng.lng,latlng.lat]),feature))||(feature.geometry.type.includes('Line')&&turf.pointToLineDistance(turf.point([latlng.lng,latlng.lat]),feature,{units:'kilometers'})<1))hits.push({def,feature})}catch{}
  const commune=(state.data.communes.features||[]).find(f=>turf.booleanPointInPolygon(turf.point([latlng.lng,latlng.lat]),f)); const title=commune?.properties?.nom||'Point sélectionné';
  const rows=hits.length?hits.map(h=>`<div class="result-line"><span><i class="swatch" style="display:inline-block;background:${h.def.color}"></i> ${escapeHtml(h.def.label)}</span><b>${escapeHtml(nameFor(h.def.id,h.feature.properties))}</b></div>`).join(''):'<p>Aucun zonage actif ne recouvre exactement ce point. Activez d’autres couches ou explorez les secteurs voisins.</p>';
  openDrawer(title,`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,hits.length?`${hits.length} information${hits.length>1?'s':''} visible${hits.length>1?'s':''} recoupe${hits.length>1?'nt':''} ce point.`:'Aucun recoupement avec les couches actuellement visibles.',`<section class="result-section"><h3>01 · Lecture croisée</h3>${rows}</section><section class="result-section"><h3>02 · Précautions</h3><p class="warning">Les inventaires et observations ne sont pas exhaustifs. Vérifiez les sources officielles et les documents applicables.</p></section>`,'https://inpn.mnhn.fr/');
}
function showMapMessage(title,text){$('map-intro').innerHTML=`<strong>${title}</strong><span>${text}</span>`;$('map-intro').hidden=false}
function searchCommune(name){
  const clean=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[’']/g,' ');
  const feature=state.data.communes.features.find(f=>clean(f.properties.nom)===clean(name))||state.data.communes.features.find(f=>clean(f.properties.nom).includes(clean(name)));
  if(!feature){showMapMessage('Commune non trouvée','Essayez par exemple « L’Isle-Adam », « Cergy » ou « Magny-en-Vexin ».');return}
  state.selectedCommune=feature; $('territory-name').textContent=`${feature.properties.nom} · ${feature.properties.code}`;$('reset').hidden=false;$('map-intro').hidden=true;
  state.communesLayer.eachLayer(l=>l.setStyle({weight:l.feature===feature?4:1,fillOpacity:l.feature===feature?.12:0,color:l.feature===feature?'#000091':'#68707a'}));
  const target=[...state.communesLayer.getLayers()].find(l=>l.feature===feature);map.fitBounds(target.getBounds(),{padding:[30,30]});
  openDrawer(feature.properties.nom,'Commune du Val-d’Oise',`Explorez les couches visibles dans ${escapeHtml(feature.properties.nom)} puis cliquez sur un objet pour obtenir sa fiche.`,`<section class="result-section"><h3>01 · Territoire</h3><div class="result-line"><span>Code INSEE</span><b>${feature.properties.code}</b></div><div class="result-line"><span>Population de référence</span><b>${formatNumber(feature.properties.population)}</b></div><div class="result-line"><span>Surface</span><b>${areaLabel(feature.properties.surface)}</b></div></section><section class="result-section"><h3>02 · Prochaine étape</h3><p>Activez ZNIEFF, Natura 2000, continuités ou observations, puis cliquez sur la carte.</p></section>`,'https://www.geoportail.gouv.fr/');
}
function reset(){state.selectedCommune=null;state.selectedPoint=null;$('territory-name').textContent='Val-d’Oise · 95';$('reset').hidden=false;$('search-input').value='';state.communesLayer.eachLayer(l=>l.setStyle({weight:1,fillOpacity:0,color:'#68707a'}));map.fitBounds(state.communesLayer.getBounds(),{padding:[24,24]});$('drawer').classList.remove('open');$('drawer').setAttribute('aria-hidden','true');$('map-intro').hidden=true}
async function load(){
  renderControls();
  try{
    const keys=Object.keys(DATA);
    if(window.BIODIVERSITE_DATA){keys.forEach(k=>state.data[k]=window.BIODIVERSITE_DATA[k])}
    else{const results=await Promise.all(keys.map(k=>fetch(DATA[k],{signal:AbortSignal.timeout(20000)}).then(r=>{if(!r.ok)throw Error(k);return r.json()})));keys.forEach((k,i)=>state.data[k]=results[i])}
    state.department=turf.union(turf.featureCollection(state.data.communes.features.map(f=>turf.feature(f.geometry))));
    const holes=[];state.data.communes.features.forEach(feature=>{const geometry=feature.geometry;if(geometry?.type==='Polygon')holes.push(geometry.coordinates[0]);if(geometry?.type==='MultiPolygon')geometry.coordinates.forEach(polygon=>holes.push(polygon[0]))});
    L.geoJSON({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],...holes]}},{pane:'departmentMask',interactive:false,style:{stroke:false,fillColor:'#f5f5fe',fillOpacity:.88,fillRule:'evenodd'}}).addTo(map);
    state.communesLayer=L.geoJSON(state.data.communes,{style:{color:'#68707a',weight:1,fillOpacity:0},onEachFeature:(f,l)=>{l.bindTooltip(f.properties.nom,{sticky:true});l.on('click',e=>{L.DomEvent.stopPropagation(e);searchCommune(f.properties.nom)})}}).addTo(map);
    L.geoJSON(state.department,{interactive:false,style:{color:'#343b45',weight:2.4,opacity:.8,fillOpacity:0}}).addTo(map);
    state.communesLayer.bringToFront();map.fitBounds(state.communesLayer.getBounds());
    ['vegetation','jardins','pnr','reserves','protections','znieff1','znieff2','naturaHabitat','naturaOiseaux','connexions','observations'].forEach(id=>makeLayer(id,state.data[id]));state.communesLayer.bringToFront();
    $('communes-list').innerHTML=state.data.communes.features.sort((a,b)=>a.properties.nom.localeCompare(b.properties.nom,'fr')).map(f=>`<option value="${escapeHtml(f.properties.nom)}"></option>`).join('');
    $('api-dot').classList.add('ok');$('api-state').textContent='Données disponibles';$('api-detail').textContent='Espaces naturels · zonages · espèces';
  }catch(error){console.error(error);$('api-state').textContent='Certaines données sont indisponibles';$('api-detail').textContent='Rechargez la page ou consultez les sources';showMapMessage('Chargement incomplet','La carte de fond reste disponible. Réessayez dans quelques instants.')}
}
map.on('click',e=>selectMapPoint(e.latlng));
$('search-form').addEventListener('submit',e=>{e.preventDefault();searchCommune($('search-input').value)});$('reset').addEventListener('click',reset);$('hide-all').addEventListener('click',()=>CONFIG.layers.forEach(x=>toggleLayer(x.id,false)));
$('drawer-close').addEventListener('click',()=>{$('drawer').classList.remove('open');$('drawer').setAttribute('aria-hidden','true')});$('drawer-center').addEventListener('click',()=>state.selectedPoint&&map.setView(state.selectedPoint,13));$('drawer-print').addEventListener('click',()=>window.print());$('drawer-copy').addEventListener('click',async()=>{const url=new URL(location.href);if(state.selectedPoint){url.searchParams.set('lat',state.selectedPoint.lat.toFixed(5));url.searchParams.set('lng',state.selectedPoint.lng.toFixed(5))}await navigator.clipboard.writeText(url);$('drawer-copy').textContent='Lien copié ✓';setTimeout(()=>$('drawer-copy').textContent='Copier le lien',1800)});
$('mobile-panel').addEventListener('click',()=>{const open=$('panel').classList.toggle('open');$('mobile-panel').setAttribute('aria-expanded',String(open));$('mobile-panel').textContent=open?'× Fermer':'☰ Explorer les données'});
const aboutHtml='<p>Page Biodiversité de l’Atlas territorial de la DDT du Val-d’Oise.</p><p>Elle rassemble les espaces végétalisés, jardins remarquables, parcs naturels régionaux, espaces protégés, ZNIEFF, sites Natura 2000, continuités écologiques et observations naturalistes disponibles.</p><p><strong>Attention :</strong> cette carte facilite le repérage. Elle ne vaut ni expertise écologique ni décision réglementaire.</p><p>Conception cartographique et développement : Wilfried Koba · DDT du Val-d’Oise.</p>';
const sourcesHtml='<p>Chaque couche est documentée et conservée dans une copie versionnée.</p><table class="source-table"><thead><tr><th>Information</th><th>Producteur</th><th>Référence</th></tr></thead><tbody><tr><td>Végétation et espaces protégés</td><td>IGN</td><td>BD TOPO · juillet 2026</td></tr><tr><td>Jardins remarquables</td><td>DRAC · Région IDF</td><td>Open data régional</td></tr><tr><td>PNR, réserves, ZNIEFF, Natura 2000</td><td>INPN/PatriNat · IGN</td><td>API Carto · 30/07/2026</td></tr><tr><td>Connexions écologiques</td><td>Région IDF · Institut Paris Region</td><td>SDRIF-E 2024/2025</td></tr><tr><td>Observations agrégées</td><td>ARB Île-de-France</td><td>GeoNat’îdF · 30/07/2026</td></tr><tr><td>Communes</td><td>IGN / État</td><td>COG 2026</td></tr></tbody></table><p>Licences et URL détaillées : fichier SOURCES.md du dépôt.</p>';
function openModal(title,html){$('modal-title').textContent=title;$('modal-content').innerHTML=html;$('info-modal').hidden=false;$('modal-close').focus()}$('about-open').addEventListener('click',()=>openModal('À propos',aboutHtml));$('sources-open').addEventListener('click',()=>openModal('Sources et millésimes',sourcesHtml));$('modal-close').addEventListener('click',()=>{$('info-modal').hidden=true});$('info-modal').addEventListener('click',e=>{if(e.target===$('info-modal'))$('info-modal').hidden=true});document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('info-modal').hidden=true;$('drawer').classList.remove('open')}});
load();
