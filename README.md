# Biodiversité du Val-d’Oise

Page Biodiversité de l’Atlas territorial de la DDT 95. Elle rassemble les espaces végétalisés, jardins remarquables, parcs naturels régionaux, espaces protégés, ZNIEFF, Natura 2000, connexions écologiques et observations d’espèces agrégées.

## Utilisation

Ouvrir `index.html` depuis un serveur HTTP local (les fichiers GeoJSON ne sont pas chargés en `file://`). Par exemple :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080/`. Le dépôt est autonome et compatible avec un sous-chemin GitHub Pages.

## Données

Les données publiques sont copiées dans `data/` afin que l’interface reste disponible lors d’une indisponibilité des API. Les URL, producteurs, licences, millésimes, limites et dates de synchronisation figurent dans [SOURCES.md](SOURCES.md).

La carte est un outil de repérage et de connaissance. Une ZNIEFF n’est pas, à elle seule, une protection réglementaire. Les continuités régionales sont indicatives et les observations dépendent fortement de l’effort de prospection.

## Mise à jour

1. interroger les API officielles documentées dans `SOURCES.md` ;
2. limiter ou découper les données au Val-d’Oise ;
3. conserver les noms de fichiers attendus dans `data/` ;
4. mettre à jour la date de synchronisation dans `app.js`, `index.html` et `SOURCES.md` ;
5. dérouler la recette de `RECETTE.md`.

## Architecture

- `index.html` : structure accessible de l’application ;
- `style.css` : identité DDT 95, responsive et impression ;
- `app.js` : carte Leaflet, recherche, couches, fiches et états ;
- `data/` : référentiels versionnés ;
- `fonts/` et `prefet-val-doise.svg` : identité visuelle officielle.

## Publication

Activer GitHub Pages sur la branche `main`, dossier racine. Aucun secret ni clé privée n’est requis.
