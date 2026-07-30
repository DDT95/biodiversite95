# Design QA — Biodiversité

## Artifacts

- Source visual truth: `06_Exports/biodiversite95-2026-07-30/reference-agriculture-desktop.png` and `reference-habitat-desktop.png`
- Implementation: `06_Exports/biodiversite95-2026-07-30/implementation-biodiversite-desktop.png`
- Combined comparison: `06_Exports/biodiversite95-2026-07-30/design-qa-comparison.png`
- Viewport: 1280 × 720 CSS px, device scale factor 1
- Source pixels: 1280 × 720 for each reference
- Implementation pixels: 1280 × 720
- Density normalization: none required; all captures are 1× and share the same viewport
- State: initial departmental view, data loaded, default layers active, drawer closed

## Full-view comparison evidence

The implementation uses the same visible structure as the two reference pages: 108 px institutional header, Préfet logo and Marianne typography, rounded left control panel, rounded map card, pale blue-grey workspace, compact status pill, and 34 px source footer. The major-region proportions, hierarchy, borders, radii and map framing match the source family.

The Biodiversité page intentionally adds a second header pill for the requested return to the Atlas. This uses the same radius, border, shadow, type scale and vertical alignment as the reference status pill.

## Focused region comparison evidence

The header, search block, “Lecture de la carte”, two-button action row, purpose block, map controls and legend were readable in the full-size combined comparison. No separate crop was necessary. The real Préfet asset and bundled Marianne fonts are used; no visible asset is approximated.

## Required fidelity surfaces

- Fonts and typography: Marianne regular/bold, matching hierarchy and compact UI scale; passed.
- Spacing and layout rhythm: header, 390 px panel, 16 px workspace spacing, cards, footer and map proportions align with the references; passed.
- Colors and visual tokens: DDT blue `#000091`, pale workspace, white cards, grey borders, green success state; passed.
- Image and asset quality: original Préfet SVG, native Leaflet map and real data geometries; passed.
- Copy and content: page is named only “Biodiversité”; copy covers spaces naturels, parcs et jardins, ZNIEFF, Natura 2000, continuités and espèces; passed.

## Interaction evidence

- 11 layer controls rendered.
- Search for “L’Isle-Adam” updated the territory to code 95313 and opened its fiche.
- ZNIEFF type II toggle changed state and rendered without losing the loaded-data status.
- “Recentrer le Val-d’Oise” restored the departmental view.
- Return link resolves to `https://ddt95.github.io/atlas-territorial-95/`.
- Browser-rendered status: “Données disponibles”.
- Console-visible runtime failure: none encountered during the tested flows.

## Findings

No actionable P0, P1 or P2 visual mismatch remains.

## Comparison history

- Pass 1: the combined source/implementation comparison found no actionable P0/P1/P2 difference. No visual correction was required after this pass.

## Final result

final result: passed
