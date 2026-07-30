/*
 * Observatoire de la biodiversité — DDT du Val-d'Oise
 * Sources de données (URL, licence, mise à jour) : voir la modale "À propos"
 * et le tableau du README. Toutes les requêtes sont faites côté navigateur
 * vers des API publiques ; aucune clé n'est nécessaire ni stockée.
 */
(function () {
  "use strict";

  var DEPT_CODE = "95";
  var DEPT_BBOX = { south: 48.94, west: 1.56, north: 49.30, east: 2.42 };
  var DEPT_CENTER = [49.05, 2.10];
  var OBS_MIN_ZOOM = 13;

  var GEO_API = "https://geo.api.gouv.fr";
  var WMS_URL = "https://data.geopf.fr/wms-r/wms";
  var GBIF_URL = "https://api.gbif.org/v1/occurrence/search";

  var WMS_LAYERS = {
    "znieff1": { name: "PROTECTEDAREAS.ZNIEFF1", couleur: "#2c7a4b", titre: "ZNIEFF de type 1" },
    "znieff2": { name: "PROTECTEDAREAS.ZNIEFF2", couleur: "#6aab7c", titre: "ZNIEFF de type 2" },
    "n2000-habitats": { name: "PROTECTEDAREAS.SIC", couleur: "#b06a2c", titre: "Natura 2000 — Habitats" },
    "n2000-oiseaux": { name: "PROTECTEDAREAS.ZPS", couleur: "#c98f2c", titre: "Natura 2000 — Oiseaux" },
    "tvb-corridors": { name: "TRAMEVERTEETBLEUE.CORRIDORS", couleur: "#1f8a8a", titre: "Corridors écologiques" }
  };

  var state = {
    communes: null,       // FeatureCollection, contours communaux
    communesIndex: {},    // code -> feature
    activeLayers: {},      // id -> L.TileLayer.WMS
    selectedCommuneCode: null,
    selectedCommuneLayer: null,
    map: null,
    obsLayerGroup: null,
    obsRequestToken: 0
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    initMap();
    wireHeaderAndModal();
    wireSearch();
    wireLayerToggles();
    wireDrawer();
    wireAltText();
    loadDepartementEtCommunes();
    document.getElementById("footer-sync").textContent =
      "Dernière synchronisation des données : " + formatDateHeure(new Date());
    applyUrlParams();
  }

  // ===================== CARTE =====================

  function initMap() {
    var map = L.map("carte", { minZoom: 8, maxZoom: 18, zoomControl: true });
    map.setView(DEPT_CENTER, 10);
    state.map = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: "abcd"
    }).addTo(map);

    state.obsLayerGroup = L.layerGroup();

    map.on("click", onMapClick);
    map.on("moveend", function () {
      var toggle = document.querySelector('[data-layer-toggle="observations"]');
      if (toggle && toggle.checked) refreshObservations();
      toggleObsZoomNote();
    });

    setStatus("communes", "chargement");
  }

  function loadDepartementEtCommunes() {
    setStatus("communes", "chargement");
    showLoading(true);

    var urlDept = GEO_API + "/departements/" + DEPT_CODE + "?geometry=contour&format=geojson";
    var urlCommunes = GEO_API + "/communes?codeDepartement=" + DEPT_CODE +
      "&geometry=contour&format=geojson&fields=nom,code,codesPostaux,population,surface,centre";

    Promise.all([fetchJson(urlDept), fetchJson(urlCommunes)])
      .then(function (results) {
        var dept = results[0];
        var communes = results[1];
        drawDepartementMask(dept);
        drawCommuneOutlines(communes);
        state.communes = communes;
        (communes.features || []).forEach(function (f) {
          state.communesIndex[f.properties.code] = f;
        });
        setStatus("communes", "ok");
        showLoading(false);
      })
      .catch(function (err) {
        console.error(err);
        setStatus("communes", "indisponible");
        showLoading(false);
        showError("Impossible de charger le contour du Val-d’Oise et des communes (geo.api.gouv.fr indisponible). Les couches thématiques restent utilisables sur le fond de carte général.");
      });
  }

  function drawDepartementMask(deptGeoJson) {
    var rings = extractOuterRings(deptGeoJson.geometry);
    var world = [
      [85, -170], [85, 170], [-85, 170], [-85, -170]
    ];
    var latlngRings = rings.map(function (ring) {
      return ring.map(function (c) { return [c[1], c[0]]; });
    });
    L.polygon([world].concat(latlngRings), {
      stroke: false,
      fillColor: "#eef1f6",
      fillOpacity: 0.72,
      interactive: false
    }).addTo(state.map);

    L.geoJSON(deptGeoJson, {
      style: { color: "#000091", weight: 3, fill: false }
    }).addTo(state.map);
  }

  function drawCommuneOutlines(communesGeoJson) {
    L.geoJSON(communesGeoJson, {
      style: { color: "#8b93a7", weight: 1, fill: false, opacity: 0.7 },
      onEachFeature: function (feature, layer) {
        layer.on("click", function (e) {
          L.DomEvent.stopPropagation(e);
          selectCommune(feature.properties.code, e.latlng);
        });
      }
    }).addTo(state.map);
  }

  function extractOuterRings(geometry) {
    if (!geometry) return [];
    if (geometry.type === "Polygon") return [geometry.coordinates[0]];
    if (geometry.type === "MultiPolygon") return geometry.coordinates.map(function (p) { return p[0]; });
    return [];
  }

  // ===================== COUCHES WMS =====================

  function wireLayerToggles() {
    document.querySelectorAll("[data-layer-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        var id = input.getAttribute("data-layer-toggle");
        if (id === "observations") {
          toggleObservations(input.checked);
        } else {
          toggleWmsLayer(id, input.checked);
        }
      });
    });

    document.getElementById("btn-tout-masquer").addEventListener("click", function () {
      document.querySelectorAll("[data-layer-toggle]").forEach(function (input) {
        if (input.checked) { input.checked = false; input.dispatchEvent(new Event("change")); }
      });
    });

    document.querySelectorAll(".info-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var desc = btn.closest(".couche").querySelector(".couche-desc");
        desc.hidden = !desc.hidden;
      });
    });

    document.getElementById("btn-zoomer-obs").addEventListener("click", function () {
      state.map.setView(state.map.getCenter(), OBS_MIN_ZOOM);
    });
  }

  function toggleWmsLayer(id, on) {
    var def = WMS_LAYERS[id];
    if (!def) return;
    var statusKey = (id === "tvb-corridors") ? "continuites" : "protections";

    if (on) {
      setStatus(statusKey, "chargement");
      var layer = L.tileLayer.wms(WMS_URL, {
        layers: def.name,
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        opacity: 0.65,
        attribution: "IGN Géoportail / INPN / DREAL"
      });
      var resolved = false;
      layer.on("load", function () {
        if (!resolved) { resolved = true; setStatus(statusKey, "ok"); }
      });
      layer.on("tileerror", function () {
        if (!resolved) {
          resolved = true;
          setStatus(statusKey, "indisponible");
          markCoucheIndisponible(id);
        }
      });
      layer.addTo(state.map);
      state.activeLayers[id] = layer;
    } else {
      if (state.activeLayers[id]) {
        state.map.removeLayer(state.activeLayers[id]);
        delete state.activeLayers[id];
      }
      var anyOtherProtection = Object.keys(state.activeLayers).some(function (k) { return k !== "tvb-corridors"; });
      var anyCorridor = !!state.activeLayers["tvb-corridors"];
      if (statusKey === "protections" && !anyOtherProtection) setStatus("protections", "");
      if (statusKey === "continuites" && !anyCorridor) setStatus("continuites", "");
    }
  }

  function markCoucheIndisponible(id) {
    var row = document.querySelector('.couche[data-layer="' + id + '"]');
    if (!row) return;
    var note = row.querySelector(".couche-indispo");
    if (!note) {
      note = document.createElement("p");
      note.className = "couche-note couche-indispo";
      row.appendChild(note);
    }
    note.textContent = "Couche momentanément indisponible auprès du fournisseur. Réessayez plus tard.";
  }

  // ===================== OBSERVATIONS (GBIF) =====================

  function toggleObservations(on) {
    if (on) {
      state.obsLayerGroup.addTo(state.map);
      toggleObsZoomNote();
      refreshObservations();
    } else {
      state.map.removeLayer(state.obsLayerGroup);
      setStatus("observations", "");
      document.getElementById("obs-zoom-note").hidden = true;
    }
  }

  function toggleObsZoomNote() {
    var toggle = document.querySelector('[data-layer-toggle="observations"]');
    var note = document.getElementById("obs-zoom-note");
    if (!toggle || !toggle.checked) { note.hidden = true; return; }
    note.hidden = state.map.getZoom() >= OBS_MIN_ZOOM;
  }

  function refreshObservations() {
    var toggle = document.querySelector('[data-layer-toggle="observations"]');
    if (!toggle || !toggle.checked) return;
    if (state.map.getZoom() < OBS_MIN_ZOOM) {
      state.obsLayerGroup.clearLayers();
      return;
    }
    var b = state.map.getBounds();
    var token = ++state.obsRequestToken;
    setStatus("observations", "chargement");

    var url = GBIF_URL + "?country=FR&hasCoordinate=true&hasGeospatialIssue=false" +
      "&decimalLatitude=" + b.getSouth().toFixed(4) + "," + b.getNorth().toFixed(4) +
      "&decimalLongitude=" + b.getWest().toFixed(4) + "," + b.getEast().toFixed(4) +
      "&limit=200";

    fetchJson(url).then(function (data) {
      if (token !== state.obsRequestToken) return;
      state.obsLayerGroup.clearLayers();
      (data.results || []).forEach(function (occ) {
        if (!occ.decimalLatitude || !occ.decimalLongitude) return;
        var marker = L.circleMarker([occ.decimalLatitude, occ.decimalLongitude], {
          radius: 5, color: "#000091", weight: 1, fillColor: "#6a6af4", fillOpacity: 0.75
        });
        marker.bindPopup(formatOccurrencePopup(occ));
        marker.addTo(state.obsLayerGroup);
      });
      setStatus("observations", "ok");
    }).catch(function (err) {
      console.error(err);
      if (token !== state.obsRequestToken) return;
      setStatus("observations", "indisponible");
    });
  }

  function formatOccurrencePopup(occ) {
    var nom = occ.vernacularName || occ.species || occ.scientificName || "Espèce non déterminée";
    var date = occ.eventDate ? occ.eventDate.substring(0, 10) : "date inconnue";
    return "<strong>" + escapeHtml(nom) + "</strong><br>Observée le " + escapeHtml(date) +
      "<br><span style='color:#8b93a7'>Source : GBIF.org</span>" +
      (occ.key ? "<br><a href='https://www.gbif.org/occurrence/" + occ.key + "' target='_blank' rel='noopener'>Voir la fiche GBIF</a>" : "");
  }

  // ===================== RECHERCHE =====================

  function wireSearch() {
    var input = document.getElementById("recherche-commune");
    var list = document.getElementById("recherche-suggestions");
    var btn = document.getElementById("btn-rechercher");
    var timer = null;

    input.addEventListener("input", function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { hideSuggestions(); return; }
      timer = setTimeout(function () { runSearch(q); }, 250);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideSuggestions();
      if (e.key === "Enter") {
        e.preventDefault();
        var first = list.querySelector("li");
        if (first) first.click(); else runSearch(input.value.trim(), true);
      }
    });

    btn.addEventListener("click", function () { runSearch(input.value.trim(), true); });

    document.getElementById("btn-nouvelle-recherche").addEventListener("click", resetRecherche);

    document.addEventListener("click", function (e) {
      if (!list.contains(e.target) && e.target !== input) hideSuggestions();
    });

    function hideSuggestions() {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
    }

    function runSearch(q, direct) {
      if (!q) return;
      var url = GEO_API + "/communes?nom=" + encodeURIComponent(q) +
        "&codeDepartement=" + DEPT_CODE + "&boost=population&fields=nom,code,centre&limit=8";
      fetchJson(url).then(function (results) {
        if (!results.length) {
          showError("Aucune commune du Val-d’Oise ne correspond à « " + q + " ». Vérifiez l’orthographe ou choisissez une commune sur la carte.");
          return;
        }
        if (direct && results.length === 1) {
          hideSuggestions();
          selectCommune(results[0].code);
          return;
        }
        list.innerHTML = "";
        results.forEach(function (c) {
          var li = document.createElement("li");
          li.setAttribute("role", "option");
          li.textContent = c.nom;
          li.addEventListener("click", function () {
            input.value = c.nom;
            hideSuggestions();
            selectCommune(c.code);
          });
          list.appendChild(li);
        });
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }).catch(function () {
        showError("La recherche de communes est momentanément indisponible (geo.api.gouv.fr).");
      });
    }
  }

  function selectCommune(code, latlng) {
    var feature = state.communesIndex[code];
    if (state.selectedCommuneLayer) {
      state.map.removeLayer(state.selectedCommuneLayer);
      state.selectedCommuneLayer = null;
    }
    state.selectedCommuneCode = code;

    var nom = feature ? feature.properties.nom : code;
    document.getElementById("chip-territoire").textContent = "Territoire : " + nom;
    document.getElementById("btn-nouvelle-recherche").hidden = false;
    document.getElementById("etat-vide").hidden = true;

    if (feature) {
      state.selectedCommuneLayer = L.geoJSON(feature, {
        style: { color: "#000091", weight: 2, fillColor: "#6a6af4", fillOpacity: 0.12 }
      }).addTo(state.map);
      state.map.fitBounds(state.selectedCommuneLayer.getBounds(), { maxZoom: 14, padding: [30, 30] });
    }

    var centre = latlng || (feature && feature.properties.centre
      ? { lat: feature.properties.centre.coordinates[1], lng: feature.properties.centre.coordinates[0] }
      : null);

    ouvrirFiche({ type: "commune", code: code, nom: nom, latlng: centre });
    collapsePanelOnMobile();
  }

  function collapsePanelOnMobile() {
    if (window.innerWidth > 820) return;
    var panel = document.querySelector(".panel");
    var toggle = document.getElementById("btn-panneau-toggle");
    panel.classList.add("reduit");
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector(".panneau-toggle-texte").textContent = "Déplier le panneau";
  }

  function resetRecherche() {
    document.getElementById("recherche-commune").value = "";
    document.getElementById("chip-territoire").textContent = "Territoire : Val-d’Oise";
    document.getElementById("btn-nouvelle-recherche").hidden = true;
    if (state.selectedCommuneLayer) { state.map.removeLayer(state.selectedCommuneLayer); state.selectedCommuneLayer = null; }
    state.selectedCommuneCode = null;
    fermerTiroir();
    document.getElementById("etat-vide").hidden = false;
    state.map.setView(DEPT_CENTER, 10);
  }

  // ===================== CLIC CARTE =====================

  function onMapClick(e) {
    document.getElementById("etat-vide").hidden = true;
    var url = GEO_API + "/communes?lat=" + e.latlng.lat.toFixed(5) + "&lon=" + e.latlng.lng.toFixed(5) +
      "&fields=nom,code,centre";
    showLoading(true);
    fetchJson(url).then(function (results) {
      showLoading(false);
      if (!results.length) {
        showError("Ce point est situé hors du Val-d’Oise. Cliquez à l’intérieur du contour départemental.");
        return;
      }
      var c = results[0];
      document.getElementById("chip-territoire").textContent = "Territoire : " + c.nom;
      document.getElementById("btn-nouvelle-recherche").hidden = false;
      ouvrirFiche({ type: "point", code: c.code, nom: c.nom, latlng: e.latlng });
      collapsePanelOnMobile();
    }).catch(function () {
      showLoading(false);
      ouvrirFiche({ type: "point", code: null, nom: "Point sélectionné", latlng: e.latlng });
    });
  }

  // ===================== FICHE / TIROIR =====================

  function wireDrawer() {
    document.getElementById("btn-fermer-tiroir").addEventListener("click", fermerTiroir);
  }

  function fermerTiroir() {
    document.getElementById("tiroir").hidden = true;
  }

  function ouvrirFiche(sel) {
    var tiroir = document.getElementById("tiroir");
    var contenu = document.getElementById("tiroir-contenu");
    tiroir.hidden = false;
    contenu.innerHTML = "<p>Analyse du point sélectionné…</p>";

    var protectionsActives = Object.keys(WMS_LAYERS).filter(function (k) {
      return k !== "tvb-corridors" && state.activeLayers[k];
    });
    var corridorActif = !!state.activeLayers["tvb-corridors"];

    var promesses = [];
    if (sel.latlng) {
      protectionsActives.forEach(function (id) {
        promesses.push(getFeatureInfo(id, sel.latlng).then(function (r) { return { id: id, r: r }; }));
      });
      if (corridorActif) {
        promesses.push(getFeatureInfo("tvb-corridors", sel.latlng).then(function (r) { return { id: "tvb-corridors", r: r }; }));
      }
    }

    Promise.all(promesses).then(function (resultats) {
      renderFiche(sel, resultats, protectionsActives, corridorActif);
      if (sel.latlng) chargerObservationsProches(sel.latlng);
    });
  }

  function getFeatureInfo(id, latlng) {
    var def = WMS_LAYERS[id];
    var map = state.map;
    var size = map.getSize();
    var bounds = map.getBounds();
    var sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
    var ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
    var point = map.latLngToContainerPoint(latlng);

    var params = {
      SERVICE: "WMS", VERSION: "1.3.0", REQUEST: "GetFeatureInfo",
      LAYERS: def.name, QUERY_LAYERS: def.name, STYLES: "",
      CRS: "EPSG:3857", INFO_FORMAT: "application/json", FEATURE_COUNT: 5,
      WIDTH: size.x, HEIGHT: size.y,
      I: Math.round(point.x), J: Math.round(point.y),
      BBOX: [sw.x, sw.y, ne.x, ne.y].join(",")
    };
    var qs = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");

    return fetchJson(WMS_URL + "?" + qs).then(function (data) {
      return (data && data.features) ? data.features : [];
    }).catch(function () {
      return null; // null = indisponible, distinct de [] = aucun résultat
    });
  }

  function renderFiche(sel, resultats, protectionsActives, corridorActif) {
    var contenu = document.getElementById("tiroir-contenu");
    var html = "";

    html += "<p class='fiche-synthese'>" + escapeHtml(sel.nom) + "</p>";
    html += "<p class='fiche-sous'>Synthèse indicative au " + formatDateHeure(new Date()) + " · Val-d’Oise</p>";

    // Section 1 — espaces protégés
    html += "<div class='fiche-section'><h3>1. Espaces naturels protégés</h3>";
    if (!protectionsActives.length) {
      html += "<p class='fait'>Activez une couche « espaces protégés » dans le panneau pour interroger ce point.</p>";
    } else if (!sel.latlng) {
      html += "<p class='fait'>Position précise non disponible pour ce résultat.</p>";
    } else {
      var parProt = resultats.filter(function (x) { return protectionsActives.indexOf(x.id) !== -1; });
      var auMoinsUn = false;
      parProt.forEach(function (item) {
        var def = WMS_LAYERS[item.id];
        if (item.r === null) {
          html += "<p class='fait'><span class='label'>" + def.titre + "</span>Interrogation indisponible pour cette couche.<span class='badge-alerte'>indisponible</span></p>";
        } else if (item.r.length === 0) {
          html += "<p class='fait'><span class='label'>" + def.titre + "</span>Aucun périmètre à cet endroit précis.<span class='meta'>Fait constaté · IGN Géoportail</span></p>";
        } else {
          auMoinsUn = true;
          item.r.forEach(function (feat) {
            var p = feat.properties || {};
            var nomZone = p.nom || p.NOM || p.name || p.sitename || "Zone " + def.titre;
            html += "<p class='fait'><span class='label'>" + def.titre + " — " + escapeHtml(nomZone) + "</span>Périmètre couvrant ce point.<span class='badge-alerte'>alerte</span><span class='meta'>Fait constaté · Source : IGN Géoportail / INPN / DREAL</span></p>";
          });
        }
      });
    }
    html += "</div>";

    // Section 2 — continuités
    html += "<div class='fiche-section'><h3>2. Continuités écologiques</h3>";
    if (!corridorActif) {
      html += "<p class='fait'>Activez la couche « Corridors écologiques » pour cette lecture.</p>";
    } else if (!sel.latlng) {
      html += "<p class='fait'>Position précise non disponible pour ce résultat.</p>";
    } else {
      var corr = resultats.filter(function (x) { return x.id === "tvb-corridors"; })[0];
      if (!corr || corr.r === null) {
        html += "<p class='fait'>Interrogation indisponible pour cette couche.<span class='badge-alerte'>indisponible</span></p>";
      } else if (corr.r.length === 0) {
        html += "<p class='fait'>Aucun corridor ou réservoir identifié à cet endroit précis.<span class='meta'>Fait constaté · SRCE Île-de-France</span></p>";
      } else {
        html += "<p class='fait'>Ce point est situé sur un élément de la trame verte et bleue régionale.<span class='badge-alerte'>alerte</span><span class='meta'>Fait constaté · SRCE Île-de-France, via IGN Géoportail</span></p>";
      }
    }
    html += "</div>";

    // Section 3 — observations (chargé en asynchrone après)
    var texteAttenteObs = sel.latlng
      ? "Chargement des observations GBIF…"
      : "Position précise non disponible pour ce résultat : impossible d’interroger les observations à proximité.";
    html += "<div class='fiche-section' id='fiche-observations'><h3>3. Espèces observées à proximité</h3><p class='fait'>" + texteAttenteObs + "</p></div>";

    html += "<div class='avertissement'>Ces informations sont indicatives et calculées automatiquement à partir de jeux de données publics. Elles n’ont pas de valeur réglementaire opposable. Pour un projet ou une démarche d’urbanisme, consultez les documents officiels ou le service instructeur de la DDT du Val-d’Oise.</div>";

    html += "<div class='fiche-actions'>";
    html += "<button type='button' id='act-recentrer'>Recentrer</button>";
    html += "<button type='button' id='act-nouvelle-recherche'>Nouvelle recherche</button>";
    html += "<button type='button' id='act-copier-lien'>Copier un lien</button>";
    html += "<button type='button' id='act-imprimer'>Imprimer / Exporter</button>";
    if (sel.code) {
      html += "<a href='https://inpn.mnhn.fr/territoire/commune/" + encodeURIComponent(sel.code) + "' target='_blank' rel='noopener'>Ouvrir la source officielle (INPN)</a>";
    }
    html += "</div>";

    contenu.innerHTML = html;

    var target = sel.latlng || (state.map.getCenter());
    document.getElementById("act-recentrer").addEventListener("click", function () {
      state.map.setView(target, Math.max(state.map.getZoom(), 13));
    });
    document.getElementById("act-nouvelle-recherche").addEventListener("click", resetRecherche);
    document.getElementById("act-copier-lien").addEventListener("click", function (ev) {
      copierLien(sel);
      ev.target.textContent = "Lien copié !";
      setTimeout(function () { ev.target.textContent = "Copier un lien"; }, 2000);
    });
    document.getElementById("act-imprimer").addEventListener("click", function () { window.print(); });
  }

  function chargerObservationsProches(latlng) {
    var d = 0.02; // ~2km
    var url = GBIF_URL + "?country=FR&hasCoordinate=true&hasGeospatialIssue=false" +
      "&decimalLatitude=" + (latlng.lat - d).toFixed(4) + "," + (latlng.lat + d).toFixed(4) +
      "&decimalLongitude=" + (latlng.lng - d).toFixed(4) + "," + (latlng.lng + d).toFixed(4) +
      "&limit=20";

    fetchJson(url).then(function (data) {
      var el = document.getElementById("fiche-observations");
      if (!el) return;
      var results = data.results || [];
      var html = "<h3>3. Espèces observées à proximité</h3>";
      if (!results.length) {
        html += "<p class='fait'>Aucune observation GBIF référencée à moins de 2 km.<span class='meta'>Indicateur calculé · GBIF.org</span></p>";
      } else {
        var especes = {};
        results.forEach(function (o) {
          var nom = o.vernacularName || o.species || o.scientificName;
          if (nom) especes[nom] = (especes[nom] || 0) + 1;
        });
        html += "<p class='fait'>" + Object.keys(especes).length + " espèce(s) recensée(s) parmi " + results.length + " observation(s) à moins de 2 km.<span class='meta'>Indicateur calculé · GBIF.org</span></p>";
        Object.keys(especes).slice(0, 8).forEach(function (nom) {
          html += "<p class='fait'><span class='label'>" + escapeHtml(nom) + "</span>" + especes[nom] + " observation(s)<span class='meta'>Fait constaté · GBIF.org</span></p>";
        });
      }
      el.innerHTML = html;
    }).catch(function () {
      var el = document.getElementById("fiche-observations");
      if (el) el.innerHTML = "<h3>3. Espèces observées à proximité</h3><p class='fait'>Service GBIF momentanément indisponible.<span class='badge-alerte'>indisponible</span></p>";
    });
  }

  function copierLien(sel) {
    var url = new URL(window.location.href);
    url.search = "";
    if (sel.code) url.searchParams.set("commune", sel.code);
    if (sel.latlng) {
      url.searchParams.set("lat", sel.latlng.lat.toFixed(5));
      url.searchParams.set("lon", sel.latlng.lng.toFixed(5));
    }
    var layers = Object.keys(state.activeLayers);
    if (layers.length) url.searchParams.set("couches", layers.join(","));
    if (navigator.clipboard) navigator.clipboard.writeText(url.toString());
  }

  function applyUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var couches = params.get("couches");
    if (couches) {
      couches.split(",").forEach(function (id) {
        var input = document.querySelector('[data-layer-toggle="' + id + '"]');
        if (input) { input.checked = true; input.dispatchEvent(new Event("change")); }
      });
    }
    var commune = params.get("commune");
    var lat = params.get("lat");
    var lon = params.get("lon");
    if (commune) {
      setTimeout(function () {
        selectCommune(commune, (lat && lon) ? L.latLng(parseFloat(lat), parseFloat(lon)) : null);
      }, 800);
    }
  }

  // ===================== EN-TÊTE / MODALE =====================

  function wireHeaderAndModal() {
    var modal = document.getElementById("modal-apropos-fond");
    document.getElementById("btn-apropos").addEventListener("click", function () { modal.hidden = false; });
    document.getElementById("btn-fermer-apropos").addEventListener("click", function () { modal.hidden = true; });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.hidden = true; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") modal.hidden = true; });

    document.getElementById("btn-reessayer").addEventListener("click", function () {
      document.getElementById("etat-erreur").hidden = true;
      loadDepartementEtCommunes();
    });

    var panneauToggle = document.getElementById("btn-panneau-toggle");
    var panel = document.querySelector(".panel");
    panneauToggle.addEventListener("click", function () {
      var reduit = panel.classList.toggle("reduit");
      panneauToggle.setAttribute("aria-expanded", String(!reduit));
      panneauToggle.querySelector(".panneau-toggle-texte").textContent = reduit ? "Déplier le panneau" : "Réduire le panneau";
    });
  }

  function wireAltText() {
    var btn = document.getElementById("btn-alt-texte");
    var zone = document.getElementById("alt-texte");
    btn.addEventListener("click", function () {
      var open = zone.hidden;
      zone.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) zone.textContent = buildAltTexte();
    });
  }

  function buildAltTexte() {
    var couches = Object.keys(state.activeLayers).map(function (id) {
      return WMS_LAYERS[id] ? WMS_LAYERS[id].titre : id;
    });
    var obsOn = document.querySelector('[data-layer-toggle="observations"]').checked;
    if (obsOn) couches.push("Observations d’espèces (GBIF)");
    var territoire = document.getElementById("chip-territoire").textContent;
    var couchesTxt = couches.length ? couches.join(", ") : "aucune couche thématique active";
    return "Carte du Val-d’Oise. " + territoire + ". Couches actives : " + couchesTxt + ". Utilisez la recherche par commune ou cliquez sur la carte pour obtenir une fiche détaillée.";
  }

  // ===================== ÉTATS / UTILITAIRES =====================

  function showLoading(on) {
    document.getElementById("etat-chargement").hidden = !on;
  }

  function showError(msg) {
    document.getElementById("etat-erreur-message").textContent = msg;
    document.getElementById("etat-erreur").hidden = false;
  }

  function setStatus(source, status) {
    var el = document.querySelector('.status-item[data-source="' + source + '"]');
    if (!el) return;
    el.classList.remove("ok", "chargement", "indisponible");
    if (status) el.classList.add(status);
  }

  function fetchJson(url) {
    var controller = ("AbortController" in window) ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;
    return fetch(url, { signal: controller ? controller.signal : undefined })
      .then(function (res) {
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatDateHeure(d) {
    return d.toLocaleDateString("fr-FR") + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
})();
