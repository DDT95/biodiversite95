# Observatoire de la biodiversité — DDT du Val-d'Oise

Carte interactive présentant les espaces naturels protégés (ZNIEFF, Natura 2000),
les continuités écologiques et des observations d'espèces du Val-d'Oise (95).

Page publiée : `https://<organisation>.github.io/biodiversite95/` (GitHub Pages,
sous-chemin pris en charge par des liens et un routage relatifs — voir `app.js`).

## Objectif

Permettre à un agent de service instructeur, un élu ou un citoyen de savoir
rapidement, pour une commune ou un point de la carte :

1. si un espace naturel protégé (ZNIEFF, Natura 2000) est présent ;
2. si le point est situé sur une continuité écologique (corridor, réservoir) ;
3. quelles espèces ont déjà été observées à proximité.

Les informations affichées sont **indicatives**. Elles n'ont aucune valeur
réglementaire opposable — voir le bandeau d'avertissement présent sur chaque
fiche et la modale « À propos ».

## Fonctionnement / architecture

Site 100 % statique (HTML/CSS/JS vanilla), sans étape de build, déployable
tel quel sur GitHub Pages :

- `index.html` — structure de la page (en-tête, barre d'état, panneau,
  carte, tiroir de résultats, pied de page, modale).
- `style.css` — identité visuelle (typographie Marianne avec repli Arial,
  bleu France `#000091`), mise en page responsive (360 px → grand écran).
- `app.js` — logique applicative : carte Leaflet, recherche de commune,
  gestion des couches, lecture au clic, états vide/chargement/erreur.
- `vendor/leaflet/` — bibliothèque cartographique Leaflet 1.9.4, embarquée
  dans le dépôt pour ne pas dépendre d'un CDN tiers au chargement de la page.

Toutes les données proviennent d'API publiques interrogées directement par
le navigateur de l'utilisateur : aucune clé ni secret n'est nécessaire, et
aucun n'est stocké dans le dépôt.

## Sources de données et licences

| Donnée | Fournisseur | URL de service | Licence | Millésime / fréquence |
|---|---|---|---|---|
| Communes et département du Val-d'Oise (contours, recherche, géocodage inverse) | IGN / DINUM | `https://geo.api.gouv.fr` | Licence Ouverte / Etalab | Continue |
| ZNIEFF de type 1 et 2 | INPN / MNHN, diffusion IGN Géoportail | `https://data.geopf.fr/wms-r/wms` (couches `PROTECTEDAREAS.ZNIEFF1`, `PROTECTEDAREAS.ZNIEFF2`) | Licence Ouverte / Etalab | Mise à jour continue par l'INPN |
| Natura 2000 — Habitats (SIC/ZSC) et Oiseaux (ZPS) | DREAL / MNHN, diffusion IGN Géoportail | `https://data.geopf.fr/wms-r/wms` (couches `PROTECTEDAREAS.SIC`, `PROTECTEDAREAS.ZPS`) | Licence Ouverte / Etalab | Mise à jour continue |
| Corridors écologiques (trame verte et bleue, SRCE Île-de-France) | DRIEAT Île-de-France, diffusion IGN Géoportail | `https://data.geopf.fr/wms-r/wms` (couche `TRAMEVERTEETBLEUE.CORRIDORS`) | Licence Ouverte / Etalab | Variable selon les révisions du SRCE |
| Observations d'espèces | GBIF.org (Global Biodiversity Information Facility) | `https://api.gbif.org/v1/occurrence/search` | Licences variables par jeu de données (CC0, CC-BY, CC-BY-NC) — indiquées sur chaque fiche GBIF | Continue |
| Fond de carte (sans libellés) | CARTO / OpenStreetMap | `basemaps.cartocdn.com` (style `light_nolabels`) | ODbL (OpenStreetMap), usage CARTO conforme aux CGU | Continue |

Chaque source, sa licence et son millésime sont également documentés dans le
code (`app.js`) et affichés dans la modale « À propos » de la page.

**Limite connue** : le nom exact de la couche WMS « corridors écologiques »
peut évoluer côté IGN Géoportail. L'interface détecte l'échec de chargement
d'une couche (`tileerror`) et l'indique explicitement dans la barre d'état et
dans le panneau, sans jamais casser le reste de la page.

## Installation / développement local

Aucune dépendance à installer. Servir le dossier avec n'importe quel serveur
statique, par exemple :

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080/
```

## Mise à jour

- Les données sont interrogées en direct à chaque chargement de page ; il
  n'y a pas de mise à jour du dépôt à effectuer pour bénéficier des données
  les plus récentes des fournisseurs.
- Pour changer de département ou ajuster l'emprise, modifier les constantes
  `DEPT_CODE`, `DEPT_BBOX` et `DEPT_CENTER` en tête de `app.js`.
- Pour mettre à jour Leaflet, remplacer le contenu de `vendor/leaflet/`.

## Limites

- Les résultats de la fiche (espaces protégés, continuités, observations)
  sont calculés au point cliqué ou au centre de la commune sélectionnée ;
  ils ne remplacent pas une analyse cartographique précise à l'échelle de
  la parcelle.
- La disponibilité des couches dépend des services tiers (IGN Géoportail,
  GBIF, geo.api.gouv.fr) ; en cas d'indisponibilité, l'interface l'indique
  sans afficher de carte blanche muette.
- Les observations GBIF sont des occurrences agrégées, sans contrôle de
  qualité scientifique ajouté par cette page.

## Recette (liste de contrôle)

- [x] Chargement initial (fond de carte, panneau, barre d'état)
- [x] Recherche de commune (suggestions, sélection, zoom)
- [x] Clic sur la carte (géocodage inverse, ouverture de la fiche)
- [x] Activation / désactivation d'une couche thématique
- [x] Zoom (apparition conditionnée des observations d'espèces + bouton de zoom)
- [x] Remise à zéro (« Nouvelle recherche »)
- [x] Comportement en cas d'API indisponible (message actionnable, pas de blocage)
- [x] Version mobile (tiroir/panneau refermable, carte prioritaire)
- [ ] Vérification du lien GitHub Pages avec sous-chemin après publication

Date de validation de cette liste : voir date du dernier commit du dépôt.
