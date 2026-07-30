/*
 * Observatoire de la biodiversité — DDT du Val-d'Oise
 * Sources (URL, licence, millésime) : voir la modale « À propos » et le README.
 * Toutes les requêtes sont faites côté navigateur vers des API publiques ;
 * aucune clé n'est nécessaire ni stockée.
 */
(() => {
  "use strict";

  const $ = s => document.querySelector(s);

  const CFG = {
    geoApi: "https://geo.api.gouv.fr",
    wms: "https://data.geopf.fr/wms-r/wms",
    gbif: "https://api.gbif.org/v1/occurrence/search",
    deptCode: "95",
    center: [49.05, 2.10],
    obsMinZoom: 13
  };

  const WMS_LAYERS = {
    "znieff1": { name: "PROTECTEDAREAS.ZNIEFF1", couleur: "#2c7a4b", titre: "ZNIEFF de type 1", group: "protections" },
    "znieff2": { name: "PROTECTEDAREAS.ZNIEFF2", couleur: "#6aab7c", titre: "ZNIEFF de type 2", group: "protections" },
    "n2000-habitats": { name: "PROTECTEDAREAS.SIC", couleur: "#b06a2c", titre: "Natura 2000 — Habitats", group: "protections" },
    "n2000-oiseaux": { name: "PROTECTEDAREAS.ZPS", couleur: "#c98f2c", titre: "Natura 2000 — Oiseaux", group: "protections" },
    "tvb-corridors": { name: "TRAMEVERTEETBLEUE.CORRIDORS", couleur: "#1f8a8a", titre: "Corridors écologiques", group: "continuites" }
  };

  const state = {
    map: null,
    communesIndex: {},
    communeLayer: null,
    activeWms: {},
    obsGroup: null,
    obsToken: 0,
    apiStatus: { communes: "pending", protections: "pending", continuites: "pending", observations: "pending" },
    selection: null
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    initMap();
    wireSearch();
    wireLayers();
    wireDrawer();
    wireAbout();
    wirePanelToggle();
    wireAltText();
    loadReferentiel();
    setFooterSync();
    applyUrlParams();
  }

  // ===================== HELPERS =====================

  function progress(v) {
    $("#progress-bar").style.width = `${Math.max(0, Math.min(100, v))}%`;
  }

  function live(kind, text, sub) {
    $("#live-dot").className = "live-dot" + (kind ? ` ${kind}` : "");
    $("#live-text").textContent = text;
    $("#live-sub").textContent = sub || "";
    $("#status-line").innerHTML = `<b>Observatoire de la biodiversité</b> · ${escapeHtml(text)}${sub ? ` · ${escapeHtml(sub)}` : ""}`;
  }

  function setApiStatus(source, status, label) {
    state.apiStatus[source] = status;
    const row = document.querySelector(`.source-monitor-row[data-source="${source}"]`);
    if (row) {
      row.classList.remove("ok", "warn", "ko", "pending");
      row.classList.add(status);
      const light = row.querySelector(".api-light");
      if (light) light.className = `api-light ${status}`;
      const text = row.querySelector(".api-state");
      if (text) text.textContent = label;
    }
    refreshGlobalApiState();
  }

  function refreshGlobalApiState() {
    const statuses = Object.values(state.apiStatus);
    const el = $("#global-api-state");
    el.className = "global-api-state";
    if (statuses.some(s => s === "ko")) { el.classList.add("warn"); el.textContent = "Connexion partielle"; }
    else if (statuses.every(s => s === "ok" || s === "warn")) { el.classList.add("ok"); el.textContent = "Services actifs"; }
    else { el.textContent = "Initialisation"; }
  }

  async function getJSON(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  }

  function formatDateHeure(d) {
    return d.toLocaleDateString("fr-FR") + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function metric(label, value, unit = "") {
    const display = value === null || value === undefined ? "—" : value;
    return `<div class="metric"><div class="v">${escapeHtml(display)}${unit ? ` <small>${escapeHtml(unit)}</small>` : ""}</div><div class="l">${escapeHtml(label)}</div></div>`;
  }

  function dataRow(label, value, emphasis = "") {
    const display = value === null || value === undefined || value === "" ? "—" : value;
    return `<div class="data-row ${emphasis}"><div class="l">${escapeHtml(label)}</div><div class="v">${escapeHtml(display)}</div></div>`;
  }

  function setFooterSync() {
    $("#footer-sync").textContent = "Dernière synchronisation : " + formatDateHeure(new Date());
  }

  // ===================== CARTE =====================

  function initMap() {
    const map = L.map("map", { minZoom: 8, maxZoom: 18, zoomControl: true }).setView(CFG.center, 10);
    state.map = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    state.obsGroup = L.layerGroup();

    map.on("tileerror", () => live("ko", "Fond de carte inaccessible", "réseau bloqué"));
    map.on("click", onMapClick);
    map.on("moveend", () => {
      if (isLayerOn("observations")) refreshObservations();
      toggleObsZoomNote();
    });

    $("#btn-recenter").addEventListener("click", () => resetSelection());
  }

  async function loadReferentiel() {
    setApiStatus("communes", "pending", "Chargement");
    live("", "Chargement du référentiel", "communes du Val-d’Oise");
    progress(20);
    showMapNotice("Chargement des données…", false);

    try {
      const [dept, communes] = await Promise.all([
        getJSON(`${CFG.geoApi}/departements/${CFG.deptCode}?geometry=contour&format=geojson`),
        getJSON(`${CFG.geoApi}/communes?codeDepartement=${CFG.deptCode}&geometry=contour&format=geojson&fields=nom,code,codesPostaux,population,surface,centre`)
      ]);
      drawDepartementMask(dept);
      drawCommuneOutlines(communes);
      (communes.features || []).forEach(f => { state.communesIndex[f.properties.code] = f; });
      setApiStatus("communes", "ok", "Connecté");
      live("ok", "Référentiel chargé", `${(communes.features || []).length} communes`);
      progress(100);
      hideMapNotice();
      setTimeout(() => progress(0), 600);
    } catch (err) {
      console.error(err);
      setApiStatus("communes", "ko", "Indisponible");
      live("ko", "Référentiel indisponible", "geo.api.gouv.fr");
      progress(0);
      showMapNotice("Impossible de charger le contour du Val-d’Oise et des communes (geo.api.gouv.fr indisponible). Les couches thématiques restent utilisables sur le fond de carte général.", true, true);
    }
  }

  function drawDepartementMask(deptGeoJson) {
    const rings = extractOuterRings(deptGeoJson.geometry).map(r => r.map(c => [c[1], c[0]]));
    const world = [[85, -170], [85, 170], [-85, 170], [-85, -170]];
    L.polygon([world, ...rings], { stroke: false, fillColor: "#dfe6ef", fillOpacity: 0.6, interactive: false }).addTo(state.map);
    L.geoJSON(deptGeoJson, { style: { color: "#000091", weight: 3, fill: false } }).addTo(state.map);
  }

  function drawCommuneOutlines(communesGeoJson) {
    L.geoJSON(communesGeoJson, {
      style: { color: "#8b93a7", weight: 1, fill: false, opacity: 0.7 },
      onEachFeature: (feature, layer) => {
        layer.on("click", e => { L.DomEvent.stopPropagation(e); selectCommune(feature.properties.code, e.latlng); });
      }
    }).addTo(state.map);
  }

  function extractOuterRings(geometry) {
    if (!geometry) return [];
    if (geometry.type === "Polygon") return [geometry.coordinates[0]];
    if (geometry.type === "MultiPolygon") return geometry.coordinates.map(p => p[0]);
    return [];
  }

  function showMapNotice(message, isError, retry) {
    let el = $("#map-notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "map-notice";
      el.className = "map-notice";
      document.querySelector(".map-card").appendChild(el);
    }
    el.className = "map-notice" + (isError ? " error" : "");
    el.innerHTML = `<p>${escapeHtml(message)}</p>` + (retry ? `<button type="button" id="map-notice-retry">Réessayer</button>` : "");
    el.hidden = false;
    if (retry) $("#map-notice-retry").addEventListener("click", () => { hideMapNotice(); loadReferentiel(); });
  }

  function hideMapNotice() {
    const el = $("#map-notice");
    if (el) el.hidden = true;
  }

  // ===================== COUCHES =====================

  function isLayerOn(id) {
    const btn = document.querySelector(`[data-layer-toggle="${id}"]`);
    return btn && btn.classList.contains("on");
  }

  function wireLayers() {
    document.querySelectorAll("[data-layer-toggle]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-layer-toggle");
        const on = !btn.classList.contains("on");
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", String(on));
        if (id === "observations") toggleObservations(on);
        else toggleWmsLayer(id, on);
      });
    });

    $("#btn-layers-clear").addEventListener("click", () => {
      document.querySelectorAll("[data-layer-toggle].on").forEach(btn => btn.click());
    });

    $("#btn-zoom-obs").addEventListener("click", () => state.map.setView(state.map.getCenter(), CFG.obsMinZoom));
  }

  function toggleWmsLayer(id, on) {
    const def = WMS_LAYERS[id];
    const statusKey = def.group;

    if (on) {
      setApiStatus(statusKey, "pending", "Chargement");
      const layer = L.tileLayer.wms(CFG.wms, {
        layers: def.name, format: "image/png", transparent: true, version: "1.3.0", opacity: 0.65,
        attribution: "IGN Géoportail / INPN / DREAL"
      });
      let resolved = false;
      layer.on("load", () => { if (!resolved) { resolved = true; setApiStatus(statusKey, "ok", "Connecté"); } });
      layer.on("tileerror", () => {
        if (!resolved) {
          resolved = true;
          setApiStatus(statusKey, "ko", "Indisponible");
          markLayerRowIndisponible(id);
        }
      });
      layer.addTo(state.map);
      state.activeWms[id] = layer;
    } else {
      if (state.activeWms[id]) { state.map.removeLayer(state.activeWms[id]); delete state.activeWms[id]; }
      const otherActive = Object.keys(state.activeWms).some(k => WMS_LAYERS[k].group === statusKey);
      if (!otherActive) setApiStatus(statusKey, "pending", "En attente");
    }
  }

  function markLayerRowIndisponible(id) {
    const row = document.querySelector(`.layer-row[data-layer-row="${id}"]`);
    if (!row) return;
    let note = row.querySelector(".layer-row-indispo");
    if (!note) {
      note = document.createElement("p");
      note.className = "layer-note layer-row-indispo";
      row.appendChild(note);
    }
    note.textContent = "Couche momentanément indisponible auprès du fournisseur.";
  }

  function toggleObservations(on) {
    if (on) {
      state.obsGroup.addTo(state.map);
      toggleObsZoomNote();
      refreshObservations();
    } else {
      state.map.removeLayer(state.obsGroup);
      setApiStatus("observations", "pending", "En attente");
      $("#obs-zoom-note").hidden = true;
    }
  }

  function toggleObsZoomNote() {
    const note = $("#obs-zoom-note");
    if (!isLayerOn("observations")) { note.hidden = true; return; }
    note.hidden = state.map.getZoom() >= CFG.obsMinZoom;
  }

  function refreshObservations() {
    if (!isLayerOn("observations")) return;
    if (state.map.getZoom() < CFG.obsMinZoom) { state.obsGroup.clearLayers(); return; }
    const b = state.map.getBounds();
    const token = ++state.obsToken;
    setApiStatus("observations", "pending", "Chargement");

    const url = `${CFG.gbif}?country=FR&hasCoordinate=true&hasGeospatialIssue=false` +
      `&decimalLatitude=${b.getSouth().toFixed(4)},${b.getNorth().toFixed(4)}` +
      `&decimalLongitude=${b.getWest().toFixed(4)},${b.getEast().toFixed(4)}&limit=200`;

    getJSON(url).then(data => {
      if (token !== state.obsToken) return;
      state.obsGroup.clearLayers();
      (data.results || []).forEach(occ => {
        if (!occ.decimalLatitude || !occ.decimalLongitude) return;
        const marker = L.circleMarker([occ.decimalLatitude, occ.decimalLongitude], {
          radius: 5, color: "#000091", weight: 1, fillColor: "#6a6af4", fillOpacity: 0.75
        });
        const nom = occ.vernacularName || occ.species || occ.scientificName || "Espèce non déterminée";
        const date = occ.eventDate ? occ.eventDate.substring(0, 10) : "date inconnue";
        marker.bindPopup(`<strong>${escapeHtml(nom)}</strong><br>Observée le ${escapeHtml(date)}<br><span style="color:#8b93a7">Source : GBIF.org</span>` +
          (occ.key ? `<br><a href="https://www.gbif.org/occurrence/${occ.key}" target="_blank" rel="noopener">Voir la fiche GBIF</a>` : ""));
        marker.addTo(state.obsGroup);
      });
      setApiStatus("observations", "ok", "Connecté");
    }).catch(() => {
      if (token !== state.obsToken) return;
      setApiStatus("observations", "ko", "Indisponible");
    });
  }

  // ===================== RECHERCHE =====================

  function wireSearch() {
    const input = $("#search-input");
    const list = $("#search-suggestions");
    let timer = null;

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { hideSuggestions(); return; }
      timer = setTimeout(() => runSearch(q), 250);
    });

    input.addEventListener("keydown", e => {
      if (e.key === "Escape") hideSuggestions();
    });

    document.addEventListener("click", e => {
      if (!list.contains(e.target) && e.target !== input) hideSuggestions();
    });

    $("#search-form").addEventListener("submit", e => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const first = list.querySelector("li");
      if (first) first.click(); else runSearch(q, true);
    });

    $("#btn-new-search").addEventListener("click", resetSelection);

    function hideSuggestions() {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
    }

    function runSearch(q, direct) {
      const url = `${CFG.geoApi}/communes?nom=${encodeURIComponent(q)}&codeDepartement=${CFG.deptCode}&boost=population&fields=nom,code,centre&limit=8`;
      getJSON(url).then(results => {
        if (!results.length) {
          live("ko", "Aucun résultat", q);
          if (direct) showMapNotice(`Aucune commune du Val-d’Oise ne correspond à « ${q} ».`, true);
          return;
        }
        if (direct && results.length === 1) { hideSuggestions(); selectCommune(results[0].code); return; }
        list.innerHTML = "";
        results.forEach(c => {
          const li = document.createElement("li");
          li.setAttribute("role", "option");
          li.textContent = c.nom;
          li.addEventListener("click", () => { input.value = c.nom; hideSuggestions(); selectCommune(c.code); });
          list.appendChild(li);
        });
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }).catch(() => live("ko", "Recherche indisponible", "geo.api.gouv.fr"));
    }
  }

  function selectCommune(code, latlng) {
    const feature = state.communesIndex[code];
    if (state.communeLayer) { state.map.removeLayer(state.communeLayer); state.communeLayer = null; }

    const nom = feature ? feature.properties.nom : code;
    $("#territoire-label").textContent = nom;
    $("#btn-new-search").hidden = false;
    hideMapNotice();
    collapsePanelOnMobile();

    if (feature) {
      state.communeLayer = L.geoJSON(feature, { style: { color: "#000091", weight: 2, fillColor: "#6a6af4", fillOpacity: 0.12 } }).addTo(state.map);
      state.map.fitBounds(state.communeLayer.getBounds(), { maxZoom: 14, padding: [30, 30] });
    }

    const centre = latlng || (feature && feature.properties.centre
      ? L.latLng(feature.properties.centre.coordinates[1], feature.properties.centre.coordinates[0]) : null);

    openFiche({ nom, code, latlng: centre });
  }

  function onMapClick(e) {
    hideMapNotice();
    live("", "Analyse du point", "en cours");
    getJSON(`${CFG.geoApi}/communes?lat=${e.latlng.lat.toFixed(5)}&lon=${e.latlng.lng.toFixed(5)}&fields=nom,code,centre`)
      .then(results => {
        if (!results.length) {
          showMapNotice("Ce point est situé hors du Val-d’Oise. Cliquez à l’intérieur du contour départemental.", true);
          live("warn", "Hors territoire", "");
          return;
        }
        const c = results[0];
        $("#territoire-label").textContent = c.nom;
        $("#btn-new-search").hidden = false;
        collapsePanelOnMobile();
        openFiche({ nom: c.nom, code: c.code, latlng: e.latlng });
      })
      .catch(() => openFiche({ nom: "Point sélectionné", code: null, latlng: e.latlng }));
  }

  function resetSelection() {
    $("#search-input").value = "";
    $("#territoire-label").textContent = "Val-d’Oise";
    $("#btn-new-search").hidden = true;
    if (state.communeLayer) { state.map.removeLayer(state.communeLayer); state.communeLayer = null; }
    closeDrawer();
    hideMapNotice();
    state.map.setView(CFG.center, 10);
    live("ok", "Prêt", "recherchez une commune ou cliquez sur la carte");
  }

  function collapsePanelOnMobile() {
    if (window.innerWidth > 900) return;
    document.querySelector(".panel").classList.add("reduit");
    $("#panel-toggle").setAttribute("aria-expanded", "false");
    $("#panel-toggle-text").textContent = "Déplier le panneau";
  }

  // ===================== FICHE / TIROIR =====================

  function wireDrawer() {
    $("#drawer-close").addEventListener("click", closeDrawer);
    $("#act-recentrer").addEventListener("click", () => {
      const sel = state.selection;
      if (!sel) return;
      const target = sel.latlng || state.map.getCenter();
      state.map.setView(target, Math.max(state.map.getZoom(), 13));
    });
    $("#act-nouvelle-recherche").addEventListener("click", resetSelection);
    $("#act-copier-lien").addEventListener("click", ev => {
      copierLien(state.selection);
      const label = ev.currentTarget;
      label.textContent = "Lien copié !";
      setTimeout(() => { label.textContent = "Copier un lien"; }, 2000);
    });
    $("#act-imprimer").addEventListener("click", () => window.print());
  }

  function closeDrawer() { $("#drawer").classList.remove("open"); }

  function openFiche(sel) {
    state.selection = sel;
    $("#drawer-title").textContent = sel.nom;
    $("#drawer-sub").textContent = "Val-d’Oise";
    $("#summary-status").textContent = "Analyse en cours";
    $("#summary-date").textContent = formatDateHeure(new Date());
    $("#summary-text").textContent = "Interrogation des couches actives et des observations à proximité…";
    $("#drawer-body").innerHTML = "";
    $("#drawer").classList.add("open");
    $("#act-source-officielle").onclick = () => {
      if (sel.code) window.open(`https://inpn.mnhn.fr/territoire/commune/${encodeURIComponent(sel.code)}`, "_blank", "noopener");
    };

    const protectionsActives = Object.keys(WMS_LAYERS).filter(k => k !== "tvb-corridors" && state.activeWms[k]);
    const corridorActif = !!state.activeWms["tvb-corridors"];

    const promesses = [];
    if (sel.latlng) {
      protectionsActives.forEach(id => promesses.push(getFeatureInfo(id, sel.latlng).then(r => ({ id, r }))));
      if (corridorActif) promesses.push(getFeatureInfo("tvb-corridors", sel.latlng).then(r => ({ id: "tvb-corridors", r })));
    }

    Promise.all(promesses).then(resultats => {
      renderFiche(sel, resultats, protectionsActives, corridorActif);
      if (sel.latlng) chargerObservationsProches(sel.latlng);
    });
  }

  function getFeatureInfo(id, latlng) {
    const def = WMS_LAYERS[id];
    const map = state.map;
    const size = map.getSize();
    const bounds = map.getBounds();
    const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
    const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
    const point = map.latLngToContainerPoint(latlng);

    const params = {
      SERVICE: "WMS", VERSION: "1.3.0", REQUEST: "GetFeatureInfo",
      LAYERS: def.name, QUERY_LAYERS: def.name, STYLES: "",
      CRS: "EPSG:3857", INFO_FORMAT: "application/json", FEATURE_COUNT: 5,
      WIDTH: size.x, HEIGHT: size.y, I: Math.round(point.x), J: Math.round(point.y),
      BBOX: [sw.x, sw.y, ne.x, ne.y].join(",")
    };
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

    return getJSON(`${CFG.wms}?${qs}`).then(data => (data && data.features) ? data.features : [])
      .catch(() => null);
  }

  function renderFiche(sel, resultats, protectionsActives, corridorActif) {
    const parProt = resultats.filter(x => protectionsActives.includes(x.id));
    const zonesTrouvees = [];
    parProt.forEach(item => {
      if (Array.isArray(item.r)) item.r.forEach(f => zonesTrouvees.push({ def: WMS_LAYERS[item.id], props: f.properties || {} }));
    });
    const indispoProt = parProt.some(x => x.r === null);

    const corr = resultats.find(x => x.id === "tvb-corridors");
    const surCorridor = corr && Array.isArray(corr.r) && corr.r.length > 0;
    const indispoCorr = corr && corr.r === null;

    $("#summary-status").textContent = zonesTrouvees.length ? "Espace protégé détecté" : "Synthèse indicative";
    $("#summary-date").textContent = formatDateHeure(new Date());
    $("#summary-text").textContent = zonesTrouvees.length
      ? `${zonesTrouvees.length} périmètre(s) de protection identifié(s) à cet endroit.`
      : (protectionsActives.length ? "Aucun périmètre de protection actif à cet endroit précis." : "Activez des couches pour analyser ce point.");

    let html = "";

    // 1. Espaces protégés
    html += `<div class="section-title">1 · Espaces naturels protégés</div>`;
    if (!protectionsActives.length) {
      html += `<div class="notice">Activez une couche « espaces protégés » dans le panneau pour interroger ce point.</div>`;
    } else if (!sel.latlng) {
      html += `<div class="notice">Position précise non disponible pour ce résultat.</div>`;
    } else {
      const znieffZones = zonesTrouvees.filter(z => z.def.titre.startsWith("ZNIEFF"));
      const natura = zonesTrouvees.filter(z => z.def.titre.startsWith("Natura"));

      html += `<div class="block protection-block">
        <div class="block-title-row"><div class="block-title">ZNIEFF</div><div class="block-icon">ZN</div></div>
        <div class="social-status ${znieffZones.length ? "yes" : "no"}">
          <div><div class="label">Zone naturelle d’intérêt écologique</div><div class="detail">IGN Géoportail / INPN</div></div>
          <div class="value">${znieffZones.length ? "Oui" : "Non"}</div>
        </div>
        ${znieffZones.length
          ? `<div class="data-grid">${znieffZones.map(z => dataRow(z.def.titre, z.props.nom || z.props.NOM || z.props.name || "Zone identifiée")).join("")}</div>`
          : `<div class="notice">Aucun périmètre ZNIEFF à cet endroit précis.</div>`}
        <div class="source-line"><span class="source-tag">INPN/MNHN</span><span class="source-tag">IGN Géoportail</span></div>
      </div>`;

      html += `<div class="block natura-block">
        <div class="block-title-row"><div class="block-title">Natura 2000</div><div class="block-icon">N2K</div></div>
        <div class="social-status ${natura.length ? "yes" : "no"}">
          <div><div class="label">Site Natura 2000</div><div class="detail">DREAL/MNHN</div></div>
          <div class="value">${natura.length ? "Oui" : "Non"}</div>
        </div>
        ${natura.length
          ? `<div class="data-grid">${natura.map(z => dataRow(z.def.titre, z.props.nom || z.props.NOM || z.props.name || "Zone identifiée")).join("")}</div>`
          : `<div class="notice">Aucun site Natura 2000 à cet endroit précis.</div>`}
        <div class="source-line"><span class="source-tag">DREAL/MNHN</span><span class="source-tag">IGN Géoportail</span></div>
      </div>`;

      if (indispoProt) html += `<div class="notice"><strong>Interrogation partiellement indisponible</strong> pour une ou plusieurs couches de protection.</div>`;
    }

    // 2. Continuités écologiques
    html += `<div class="section-title">2 · Continuités écologiques</div>`;
    if (!corridorActif) {
      html += `<div class="notice">Activez la couche « Corridors écologiques » pour cette lecture.</div>`;
    } else if (!sel.latlng) {
      html += `<div class="notice">Position précise non disponible pour ce résultat.</div>`;
    } else if (indispoCorr) {
      html += `<div class="block corridor-block"><div class="notice"><strong>Interrogation indisponible</strong> pour cette couche.</div></div>`;
    } else {
      html += `<div class="block corridor-block">
        <div class="block-title-row"><div class="block-title">Trame verte et bleue</div><div class="block-icon">TVB</div></div>
        <div class="social-status ${surCorridor ? "yes" : "no"}">
          <div><div class="label">Élément de continuité écologique</div><div class="detail">SRCE Île-de-France</div></div>
          <div class="value">${surCorridor ? "Oui" : "Non"}</div>
        </div>
        <div class="source-line"><span class="source-tag">SRCE Île-de-France</span><span class="source-tag">IGN Géoportail</span></div>
      </div>`;
    }

    // 3. Observations (placeholder rempli en asynchrone)
    html += `<div class="section-title">3 · Espèces observées à proximité</div>`;
    html += `<div id="fiche-observations">${sel.latlng
      ? `<div class="notice">Chargement des observations GBIF…</div>`
      : `<div class="notice">Position précise non disponible : impossible d’interroger les observations à proximité.</div>`}</div>`;

    html += `<div class="avertissement">Ces informations sont indicatives et calculées automatiquement à partir de jeux de données publics. Elles n’ont pas de valeur réglementaire opposable. Pour un projet ou une démarche d’urbanisme, consultez les documents officiels ou le service instructeur de la DDT du Val-d’Oise.</div>`;

    $("#drawer-body").innerHTML = html;
  }

  function chargerObservationsProches(latlng) {
    const d = 0.02; // ~2 km
    const url = `${CFG.gbif}?country=FR&hasCoordinate=true&hasGeospatialIssue=false` +
      `&decimalLatitude=${(latlng.lat - d).toFixed(4)},${(latlng.lat + d).toFixed(4)}` +
      `&decimalLongitude=${(latlng.lng - d).toFixed(4)},${(latlng.lng + d).toFixed(4)}&limit=20`;

    getJSON(url).then(data => {
      const el = $("#fiche-observations");
      if (!el) return;
      const results = data.results || [];
      if (!results.length) {
        el.innerHTML = `<div class="notice">Aucune observation GBIF référencée à moins de 2 km.</div>`;
        return;
      }
      const especes = {};
      results.forEach(o => {
        const nom = o.vernacularName || o.species || o.scientificName;
        if (nom) especes[nom] = (especes[nom] || 0) + 1;
      });
      const noms = Object.keys(especes);
      el.innerHTML = `<div class="block species-block">
        <div class="block-title-row"><div class="block-title">Occurrences GBIF</div><div class="block-icon">GBIF</div></div>
        <div class="metrics">
          ${metric("Espèces", noms.length)}
          ${metric("Observations", results.length)}
          ${metric("Rayon", "2", "km")}
        </div>
        <div class="data-grid" style="margin-top:8px">
          ${noms.slice(0, 8).map(n => dataRow(n, `${especes[n]} obs.`)).join("")}
        </div>
        <div class="source-line"><span class="source-tag">GBIF.org</span></div>
      </div>`;
    }).catch(() => {
      const el = $("#fiche-observations");
      if (el) el.innerHTML = `<div class="notice"><strong>Service GBIF momentanément indisponible.</strong></div>`;
    });
  }

  function copierLien(sel) {
    if (!sel) return;
    const url = new URL(window.location.href);
    url.search = "";
    if (sel.code) url.searchParams.set("commune", sel.code);
    if (sel.latlng) {
      url.searchParams.set("lat", sel.latlng.lat.toFixed(5));
      url.searchParams.set("lon", sel.latlng.lng.toFixed(5));
    }
    const layers = Object.keys(state.activeWms);
    if (layers.length) url.searchParams.set("couches", layers.join(","));
    if (navigator.clipboard) navigator.clipboard.writeText(url.toString());
  }

  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const couches = params.get("couches");
    if (couches) couches.split(",").forEach(id => {
      const btn = document.querySelector(`[data-layer-toggle="${id}"]`);
      if (btn && !btn.classList.contains("on")) btn.click();
    });
    const commune = params.get("commune");
    const lat = params.get("lat");
    const lon = params.get("lon");
    if (commune) setTimeout(() => selectCommune(commune, (lat && lon) ? L.latLng(parseFloat(lat), parseFloat(lon)) : null), 900);
  }

  // ===================== À PROPOS / PANNEAU MOBILE / ALT TEXTE =====================

  function wireAbout() {
    $("#btn-about-open").addEventListener("click", () => { $("#about-modal").hidden = false; });
    $("#about-close").addEventListener("click", () => { $("#about-modal").hidden = true; });
    $("#about-modal").addEventListener("click", e => { if (e.target === $("#about-modal")) $("#about-modal").hidden = true; });
    document.addEventListener("keydown", e => { if (e.key === "Escape") $("#about-modal").hidden = true; });
  }

  function wirePanelToggle() {
    const panel = $("#panneau");
    const btn = $("#panel-toggle");
    btn.addEventListener("click", () => {
      const reduit = panel.classList.toggle("reduit");
      btn.setAttribute("aria-expanded", String(!reduit));
      $("#panel-toggle-text").textContent = reduit ? "Déplier le panneau" : "Réduire le panneau";
    });
  }

  function wireAltText() {
    const btn = $("#btn-alt-texte");
    const zone = $("#alt-texte");
    btn.addEventListener("click", () => {
      const open = zone.hidden;
      zone.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) zone.textContent = buildAltTexte();
    });
  }

  function buildAltTexte() {
    const couches = Object.keys(state.activeWms).map(id => WMS_LAYERS[id].titre);
    if (isLayerOn("observations")) couches.push("Observations d’espèces (GBIF)");
    const territoire = $("#territoire-label").textContent;
    const couchesTxt = couches.length ? couches.join(", ") : "aucune couche thématique active";
    return `Carte du Val-d’Oise. Territoire : ${territoire}. Couches actives : ${couchesTxt}. Utilisez la recherche par commune ou cliquez sur la carte pour obtenir une fiche détaillée.`;
  }

})();
