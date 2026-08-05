/*
 * Sources documentées dans SOURCES.md — synchronisation 2026-07-30.
 * ZNIEFF / Natura 2000 : API Carto IGN, données INPN/PatriNat, Licence Ouverte 2.0.
 * Connexions : SDRIF-E 2024 approuvé en 2025, Institut Paris Region / Région IDF.
 * Observations agrégées : GeoNat'îdF / ARB Île-de-France. Une absence n'est jamais une absence d'espèce.
 */
'use strict';

const DATA = {
  communes:'data/communes_95.geojson', department:'data/val-doise.geojson', znieff1:'data/znieff1.json', znieff2:'data/znieff2.json',
  naturaHabitat:'data/natura-habitat.json', naturaOiseaux:'data/natura-oiseaux.json',
  pnr:'data/parcs-naturels-regionaux.json', reserves:'data/reserves-naturelles.json',
  foretsProtection:'data/forets-protection.geojson',
  foretsPubliques:'data/forets-publiques.geojson',
  protections:'data/espaces-naturels-proteges.json', vegetation:'data/zones-vegetation.geojson?v=20260731-2',
  jardins:'data/jardins-remarquables.json', connexions:'data/connexions-ecologiques.json',
  observations:'data/observations-mailles.json'
};
const CONFIG = {
  bounds:[[48.88,1.60],[49.25,2.62]],
  layers:[
    {id:'vegetation',group:'Espaces de nature',label:'Boisements et végétation',description:'Bois, forêts, bosquets, landes, peupleraies et vergers.',color:'#5b8c3a',source:'IGN · BD TOPO',active:true},
    {id:'foretsPubliques',group:'Espaces de nature',label:'Forêts publiques',description:'Forêts domaniales, communales, départementales et régionales.',color:'#174f2d',source:'IGN · BD TOPO · ONF',active:true},
    {id:'jardins',group:'Espaces de nature',label:'Jardins remarquables',description:'Jardins labellisés par le ministère de la Culture.',color:'#95c11f',source:'DRAC · Région Île-de-France',active:false},
    {id:'pnr',group:'Espaces protégés',label:'Parcs naturels régionaux',description:'Vexin français et Oise–Pays de France.',color:'#2f6f3e',source:'INPN · API Carto IGN',active:true},
    {id:'foretsProtection',group:'Espaces protégés',label:'Forêts de protection',description:'Forêt de Montmorency — servitude d’utilité publique A7.',color:'#004d2c',source:'Géoportail de l’urbanisme · SUP A7',active:true},
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
const map=L.map('map',{zoomControl:true,preferCanvas:true,zoomSnap:0.25,zoomDelta:1,minZoom:8,maxZoom:19,maxBounds:[[48.63,.7],[49.37,3.35]]});
map.invalidateSize();
map.fitBounds(CONFIG.bounds,{padding:[24,24]});
map.createPane('departmentMask');map.getPane('departmentMask').style.zIndex='460';map.getPane('departmentMask').style.pointerEvents='none';
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
map.attributionControl.setPrefix('Leaflet');

const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'—').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatNumber=n=>new Intl.NumberFormat('fr-FR').format(Number(n)||0);
const areaLabel=n=>Number(n)?`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(n))} ha`:'Non renseignée';
const fieldLabel=key=>String(key).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).replace(/\bId\b/g,'Identifiant').replace(/\bNom\b/g,'Nom');
function valueLabel(value){
  if(value===null||value===undefined||value==='')return null;
  if(Array.isArray(value))return value.filter(Boolean).join(', ')||null;
  if(typeof value==='object')return null;
  if(typeof value==='number')return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(value);
  return String(value);
}
function propertyRows(properties,excluded=[]){
  const skip=new Set(['url','geom','geometry',...excluded]);
  const rows=Object.entries(properties||{}).filter(([key,value])=>!skip.has(key)&&valueLabel(value)!==null).map(([key,value])=>`<div><dt>${escapeHtml(fieldLabel(key))}</dt><dd>${escapeHtml(valueLabel(value))}</dd></div>`).join('');
  return rows||'<p class="state">Aucun attribut complémentaire publié.</p>';
}
function featuresAtPoint(ids,latlng){
  const point=turf.point([latlng.lng,latlng.lat]);const hits=[];
  for(const id of ids)for(const feature of state.data[id]?.features||[])try{if(feature.geometry?.type.includes('Polygon')&&turf.booleanPointInPolygon(point,feature))hits.push({id,feature})}catch{}
  return hits;
}
function forestBody(feature,latlng){
  const p=feature.properties||{};
  const commune=(state.data.communes.features||[]).find(f=>turf.booleanPointInPolygon(turf.point([latlng.lng,latlng.lat]),f));
  const publicForest=featuresAtPoint(['foretsPubliques'],latlng)[0]?.feature;
  const zonages=featuresAtPoint(['foretsProtection','reserves','protections','znieff1','znieff2','naturaHabitat','naturaOiseaux','pnr'],latlng);
  const forestRows=[
    ['Formation végétale',p.nature||'Non renseignée'],
    ['Surface cartographique',areaLabel(turf.area(feature)/10000)],
    ['Commune',commune?.properties?.nom||'Non renseignée'],
    ['Forêt publique',publicForest?.properties?.toponyme||'Non identifiée dans le référentiel public'],
    ['Statut public',publicForest?.properties?.nature||null],
    ['Source gestionnaire',publicForest?.properties?.sources||null]
  ].filter(([,value])=>value).map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const zoningRows=zonages.length?zonages.map(({id,feature:f})=>{const def=CONFIG.layers.find(x=>x.id===id);return `<div><dt>${escapeHtml(def.label)}</dt><dd>${escapeHtml(nameFor(id,f.properties||{}))}</dd></div>`}).join(''):'<p class="state">Aucun zonage de protection ou d’inventaire recensé à ce point.</p>';
  return `<section class="result-section"><h3>Boisement</h3><dl class="data-grid">${forestRows}</dl></section><section class="result-section"><h3>Protections et inventaires au point cliqué</h3><dl class="data-grid">${zoningRows}</dl></section><section class="result-section"><h3>Référentiel</h3><dl class="data-grid"><div><dt>Occupation du sol</dt><dd>IGN · BD TOPO</dd></div><div><dt>Forêts publiques</dt><dd>IGN · ONF</dd></div><div><dt>Synchronisation</dt><dd>31 juillet 2026</dd></div></dl></section>`;
}

function renderControls(){
  const root=$('layer-list'); const groups=[...new Set(CONFIG.layers.map(x=>x.group))];
  root.innerHTML=groups.map(group=>`<div class="layer-group"><strong>${group}</strong>${CONFIG.layers.filter(x=>x.group===group).map(x=>`<div class="layer-row" data-layer-row="${x.id}"><button class="switch" type="button" data-layer="${x.id}" aria-label="Afficher ${x.label}" aria-pressed="${x.active}"></button><div class="layer-copy"><strong>${x.label}</strong><span>${x.description}<br>${x.source}</span></div><i class="swatch" style="background:${x.color}"></i></div>`).join('')}</div>`).join('');
  root.querySelectorAll('[data-layer-row]').forEach(row=>row.addEventListener('click',()=>toggleLayer(row.dataset.layerRow)));
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
  if(id==='vegetation')return{color,weight:1.1,opacity:.95,fillColor:color,fillOpacity:.48};
  if(id==='foretsPubliques')return{color,weight:3,opacity:1,fillColor:color,fillOpacity:.12};
  if(id==='pnr')return{color,weight:2.2,dashArray:'8 5',opacity:.9,fillColor:color,fillOpacity:.08};
  if(id==='foretsProtection')return{color,weight:3,opacity:1,fillColor:color,fillOpacity:.32};
  if(id==='protections'||id==='reserves')return{color,weight:2,opacity:.95,fillColor:color,fillOpacity:.2};
  if(id==='jardins')return{color:'#ffffff',weight:1.5,fillColor:color,fillOpacity:.9};
  if(id==='connexions')return{color,weight:5,opacity:.75,fillColor:color,fillOpacity:.2};
  if(id==='observations'){const n=feature.properties.nb_observations||0;return{color:'#fff',weight:1,fillColor:color,fillOpacity:Math.min(.65,.12+Math.log10(n+1)/8)}}
  return{color,weight:id.startsWith('natura')?2.5:1.5,fillColor:color,fillOpacity:id.startsWith('natura')?.24:.18};
}
function nameFor(id,p){return p.nom||p.nom_officiel||p.nom_du_jardin||p.sitename||p.toponyme||p.libelle||p.nom_site||p.nature||p.nature_detaillee||p.commune||(id==='observations'?`Maille d’observations n° ${p.id_maille}`:CONFIG.layers.find(x=>x.id===id)?.label||'Biodiversité')}
function makeLayer(id,data){
  // Les éventuels débordements sont masqués par le contour départemental.
  // Éviter le recalcul géométrique de chaque objet accélère fortement l'ouverture.
  const layer=L.geoJSON(data,{style:f=>styleFor(id,f),pointToLayer:(feature,latlng)=>L.circleMarker(latlng,{...styleFor(id,feature),radius:id==='connexions'?6:id==='jardins'?7:5}),onEachFeature:(feature,l)=>{
    l.on('click',e=>{L.DomEvent.stopPropagation(e);selectFeature(id,feature,l,e.latlng)});
    l.bindTooltip(nameFor(id,feature.properties),{sticky:true});
  }}); state.layers[id]=layer; if(CONFIG.layers.find(x=>x.id===id).active)layer.addTo(map);
}
function selectFeature(id,feature,layer,latlng){
  if(!insideDepartment(latlng))return;
  state.selectedPoint=latlng; const p=feature.properties||{}; const def=CONFIG.layers.find(x=>x.id===id);
  const sourceUrl=p.url||(id==='connexions'?'https://data.iledefrance.fr/explore/dataset/connexion-ecologique-sdrif-e/':id==='observations'?'https://geonature.arb-idf.fr/atlas/':id==='foretsProtection'?'https://www.geoportail-urbanisme.gouv.fr/':id==='vegetation'||id==='foretsPubliques'||id==='protections'?'https://geoservices.ign.fr/bdtopo':id==='jardins'?'https://data.iledefrance.fr/explore/dataset/liste-des-jardins-remarquables/':'https://inpn.mnhn.fr/');
  const publicForest=id==='vegetation'?featuresAtPoint(['foretsPubliques'],latlng)[0]?.feature:null;
  const title=publicForest?.properties?.toponyme||nameFor(id,p);
  const body=id==='vegetation'?forestBody(feature,latlng):`<section class="result-section"><h3>Informations disponibles</h3><dl class="data-grid">${propertyRows(p)}</dl></section><section class="result-section"><h3>Référentiel</h3><dl class="data-grid"><div><dt>Couche</dt><dd>${escapeHtml(def.label)}</dd></div><div><dt>Producteur</dt><dd>${escapeHtml(def.source)}</dd></div><div><dt>Synchronisation</dt><dd>31 juillet 2026</dd></div></dl></section>`;
  openDrawer(title,def.label,body,sourceUrl);
  layer.setStyle({...styleFor(id,feature),weight:4});
}
function openDrawer(title,sub,body,source){
  $('drawer-title').textContent=title;$('drawer-sub').textContent=sub;$('drawer-body').innerHTML=body;$('drawer-source').href=source;
  $('drawer').classList.add('open');$('drawer').setAttribute('aria-hidden','false');$('text-alternative').textContent=`${title}. ${sub}.`;
}
function insideDepartment(latlng){return state.department?turf.booleanPointInPolygon(turf.point([latlng.lng,latlng.lat]),state.department):true}
function selectMapPoint(latlng){
  if(!insideDepartment(latlng)){showMapMessage('Hors du Val-d’Oise','Choisissez un point situé dans le département.');return}
  state.selectedPoint=latlng; const hits=[];
  for(const def of CONFIG.layers.filter(x=>x.active))for(const feature of state.data[def.id]?.features||[])try{if((feature.geometry.type.includes('Polygon')&&turf.booleanPointInPolygon(turf.point([latlng.lng,latlng.lat]),feature))||(feature.geometry.type.includes('Line')&&turf.pointToLineDistance(turf.point([latlng.lng,latlng.lat]),feature,{units:'kilometers'})<1))hits.push({def,feature})}catch{}
  const commune=(state.data.communes.features||[]).find(f=>turf.booleanPointInPolygon(turf.point([latlng.lng,latlng.lat]),f)); const title=commune?.properties?.nom||'Point sélectionné';
  const rows=hits.length?hits.map(h=>`<div class="result-line"><span><i class="swatch" style="display:inline-block;background:${h.def.color}"></i> ${escapeHtml(h.def.label)}</span><b>${escapeHtml(nameFor(h.def.id,h.feature.properties))}</b></div>`).join(''):'<p>Aucun zonage actif ne recouvre exactement ce point. Activez d’autres couches ou explorez les secteurs voisins.</p>';
  openDrawer(title,`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,`<section class="result-section"><h3>Informations au point</h3><dl class="data-grid"><div><dt>Latitude</dt><dd>${latlng.lat.toFixed(5)}</dd></div><div><dt>Longitude</dt><dd>${latlng.lng.toFixed(5)}</dd></div><div><dt>Recoupements</dt><dd>${hits.length}</dd></div></dl>${rows}</section>`,'https://inpn.mnhn.fr/');
}
function showMapMessage(title,text){$('map-intro').innerHTML=`<strong>${title}</strong><span>${text}</span>`;$('map-intro').hidden=false}
function searchCommune(name){
  const clean=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[’']/g,' ');
  const feature=state.data.communes.features.find(f=>clean(f.properties.nom)===clean(name))||state.data.communes.features.find(f=>clean(f.properties.nom).includes(clean(name)));
  if(!feature){showMapMessage('Commune non trouvée','Essayez par exemple « L’Isle-Adam », « Cergy » ou « Magny-en-Vexin ».');return}
  state.selectedCommune=feature; $('territory-name').textContent=`${feature.properties.nom} · ${feature.properties.code}`;$('reset').hidden=false;$('map-intro').hidden=true;
  state.communesLayer.eachLayer(l=>l.setStyle({weight:l.feature===feature?4:1,fillOpacity:l.feature===feature?.12:0,color:l.feature===feature?'#000091':'#68707a'}));
  const target=[...state.communesLayer.getLayers()].find(l=>l.feature===feature);state.selectedPoint=null;map.invalidateSize();map.fitBounds(target.getBounds(),{padding:[24,24]});
  $('drawer').classList.remove('open');$('drawer').setAttribute('aria-hidden','true');
}
function reset(){state.selectedCommune=null;state.selectedPoint=null;$('territory-name').textContent='Val-d’Oise · 95';$('reset').hidden=false;$('search-input').value='';state.communesLayer.eachLayer(l=>l.setStyle({weight:1,fillOpacity:0,color:'#68707a'}));map.invalidateSize();map.fitBounds(state.communesLayer.getBounds(),{padding:[4,4],animate:false});map.zoomIn(0.25,{animate:false});$('drawer').classList.remove('open');$('drawer').setAttribute('aria-hidden','true');$('map-intro').hidden=true}
async function load(){
  renderControls();
  try{
    const keys=Object.keys(DATA);
    $('loader-detail').textContent=`Téléchargement des ${keys.length} référentiels…`;
    const results=await Promise.all(keys.map(k=>fetch(DATA[k],{signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw Error(k);return r.json()})));keys.forEach((k,i)=>state.data[k]=results[i]);
    $('loader-detail').textContent='Préparation du masque du Val-d’Oise…';
    await new Promise(requestAnimationFrame);
    state.department=state.data.department.features?.[0]||state.data.department;
    const holes=[];const departmentGeometry=state.department.geometry;if(departmentGeometry?.type==='Polygon')holes.push(departmentGeometry.coordinates[0]);if(departmentGeometry?.type==='MultiPolygon')departmentGeometry.coordinates.forEach(polygon=>holes.push(polygon[0]));
    L.geoJSON({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],...holes]}},{pane:'departmentMask',interactive:false,style:{stroke:false,fillColor:'#f5f5fe',fillOpacity:.88,fillRule:'evenodd'}}).addTo(map);
    state.communesLayer=L.geoJSON(state.data.communes,{interactive:false,style:{color:'#68707a',weight:1,fillOpacity:0}}).addTo(map);
    L.geoJSON(state.department,{interactive:false,style:{color:'#343b45',weight:2.4,opacity:.8,fillOpacity:0}}).addTo(map);
    state.communesLayer.bringToFront();map.invalidateSize();map.fitBounds(state.communesLayer.getBounds(),{padding:[4,4],animate:false});map.zoomIn(0.25,{animate:false});
    const layerIds=['vegetation','foretsPubliques','jardins','pnr','foretsProtection','reserves','protections','znieff1','znieff2','naturaHabitat','naturaOiseaux','connexions','observations'];
    for(let i=0;i<layerIds.length;i++){const id=layerIds[i];$('loader-detail').textContent=`Installation des couches · ${i+1}/${layerIds.length}`;await new Promise(resolve=>setTimeout(resolve,0));makeLayer(id,state.data[id])}
    $('communes-list').innerHTML=state.data.communes.features.sort((a,b)=>a.properties.nom.localeCompare(b.properties.nom,'fr')).map(f=>`<option value="${escapeHtml(f.properties.nom)}"></option>`).join('');
    $('api-dot').classList.add('ok');$('api-state').textContent='Données disponibles';$('api-detail').textContent='Espaces naturels · zonages · espèces';$('map-loader').classList.add('hidden');setTimeout(()=>$('map-loader').hidden=true,250);
  }catch(error){console.error(error);$('api-state').textContent='Certaines données sont indisponibles';$('api-detail').textContent='Rechargez la page ou consultez les sources';$('loader-detail').textContent='Chargement incomplet — rechargez la page';showMapMessage('Chargement incomplet','La carte de fond reste disponible. Réessayez dans quelques instants.')}
}
map.on('click',e=>selectMapPoint(e.latlng));
$('search-form').addEventListener('submit',e=>{e.preventDefault();searchCommune($('search-input').value)});$('reset').addEventListener('click',reset);$('hide-all').addEventListener('click',()=>CONFIG.layers.forEach(x=>toggleLayer(x.id,false)));
$('drawer-close').addEventListener('click',()=>{$('drawer').classList.remove('open');$('drawer').setAttribute('aria-hidden','true')});$('drawer-center').addEventListener('click',()=>state.selectedPoint&&map.setView(state.selectedPoint,13));
$('mobile-panel').addEventListener('click',()=>{const open=$('panel').classList.toggle('open');$('mobile-panel').setAttribute('aria-expanded',String(open));$('mobile-panel').textContent=open?'× Fermer':'☰ Explorer les données'});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('drawer').classList.remove('open')});
load();
