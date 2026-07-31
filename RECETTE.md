# Recette — Biodiversité 95

Validation : **31 juillet 2026**.

## Fonctionnel

- [x] Menu des 11 couches rendu avant la fin du chargement des données.
- [x] Chargeur central et progression d’installation des couches.
- [x] Masque extérieur et contour du Val-d’Oise.
- [x] Cadrage départemental avec le même `fitBounds` et padding de 24 px que la page Agriculture.
- [x] Le menu des couches possède son propre ascenseur ; l’en-tête et « Tout masquer » restent fixes.
- [x] Chaque ligne de couche est cliquable et pilote un sélecteur à glissière.
- [x] Recherche communale : sélection et zoom, sans ouverture ni persistance d’une fiche communale.
- [x] Les contours communaux sont non interactifs et n’interceptent plus les clics thématiques.
- [x] Fiches métier : tous les attributs scalaires non vides de la source sont publiés ; le titre reprend le nom, le toponyme ou la nature de l’objet.
- [x] Recentrage sur l’objet sélectionné et accès à la source.
- [x] Absence des actions copie et impression.

## Forme

- [x] Aucun retour vers l’Atlas.
- [x] Aucun bloc « À quoi sert cet outil ? », « Lecture de la carte » ou « Ce que montre la carte ».
- [x] Logo Préfet et fontes Marianne locales.
- [x] Structure commune avec Agriculture et Logement & Habitat.
- [x] Comparaison visuelle 1280 × 720 consignée dans `design-qa.md`.
- [x] Console du navigateur sans erreur ni avertissement.

## Publication

- [ ] Vérification GitHub Pages après le prochain déploiement.
