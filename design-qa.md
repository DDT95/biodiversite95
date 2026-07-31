# Design QA — Biodiversité — 31 juillet 2026

## Artifacts

- Source visual truth: `/Volumes/Backup/Atlas du Val d'Oise/06_Exports/biodiversite95-2026-07-30/reference-agriculture-desktop.png`
- Browser-rendered implementation: `/Volumes/Backup/Atlas du Val d'Oise/06_Exports/biodiversite95-2026-07-31/implementation-biodiversite-desktop.png`
- Combined comparison: `/Volumes/Backup/Atlas du Val d'Oise/06_Exports/biodiversite95-2026-07-31/design-qa-comparison.png`
- Viewport: 1280 × 720 CSS px; captures: 1280 × 720 px; density: 1×; no normalization required
- State: initial Val-d’Oise view, default layers active, loader completed, drawer closed

## Full-view comparison evidence

The institutional header, 390 px control panel, 16 px workspace gap, rounded map card, Marianne hierarchy, status pill, Leaflet controls, departmental `fitBounds` padding and footer match the common Agriculture/Habitat family. The Atlas return pill is absent. User-requested differences are deliberate: no pedagogical reading/purpose cards and the remaining panel height is assigned to the scrollable layer menu.

## Focused region comparison evidence

The combined 1× capture keeps the header, search, primary action, layer heading, checkbox rows, map mask and legend readable. A second focused crop was not needed. The loading state was separately captured in-browser and showed the central spinner with live layer progress.

## Required fidelity surfaces

- Fonts and typography: bundled Marianne regular/bold; hierarchy and line height follow the references — passed.
- Spacing and layout rhythm: common 108 px header, 390 px panel, 16 px gaps, 22/25 px radii and 34 px footer — passed.
- Colors and tokens: DDT blue, pale workspace, white cards, grey borders and green success state — passed.
- Image and asset quality: original Préfet SVG and real Leaflet/data geometries; no replacement asset — passed.
- Copy and content: only operational labels remain; instructional “À quoi sert” and “Ce que montre” copy removed — passed.

## Primary interactions and runtime checks

- 11 layer rows render before data installation completes.
- Central loader displays installation progress and disappears after completion.
- The layer menu has its own vertical overflow (`scrollHeight > clientHeight`); “Tout masquer” remains fixed.
- Clicking the full “Jardins remarquables” row checked its 20 × 20 px checkbox and activated the layer.
- Search for Cergy opened the fiche with four available commune attributes.
- Feature fiches render every non-empty scalar source property (6 to 33 properties depending on the layer), plus producer and synchronization.
- No Atlas return, copy-link or print action remains.
- Browser console errors checked: none.

## Comparison history

- Pass 1 findings: return-to-Atlas control not in the specification; editorial cards; full-panel scrolling; small switch controls; no central loader; explanatory rather than data-rich fiche actions.
- Fixes: removed non-spec controls and copy, isolated layer scrolling, replaced switches with full-row checkbox labels, added the central progress loader, precomputed the department mask, aligned `fitBounds` to 24 px, and generated fiches from all published properties.
- Pass 2 evidence: combined comparison and browser interaction tests show no remaining actionable P0/P1/P2 issue.

## Findings

No actionable P0, P1 or P2 finding remains.

## Final result

final result: passed
