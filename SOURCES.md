# Sources, licences et limites

Synchronisation de cette version : **30 juillet 2026**.

| Couche | Producteur / service | URL | Millésime ou consultation | Licence | Mise à jour visée | Limite d’usage |
|---|---|---|---|---|---|---|
| Boisements et végétation | IGN, BD TOPO `zone_de_vegetation` | `https://data.geopf.fr/wfs/ows` | consultation 30/07/2026 | Licence Ouverte 2.0 | annuelle | Bois, forêts, bosquets, landes, peupleraies et vergers ; ne renseigne ni l’accès public ni la qualité écologique. Les haies sont écartées de cette première version pour préserver la lisibilité. |
| Jardins remarquables | Ministère de la Culture / DRAC, Région Île-de-France | `https://data.iledefrance.fr/explore/dataset/liste-des-jardins-remarquables/` | consultation 30/07/2026 | Licence Ouverte 2.0 | annuelle | Inventaire des jardins labellisés, pas de tous les parcs et jardins publics. |
| Parcs naturels régionaux | INPN/PatriNat, diffusé par API Carto IGN | `https://apicarto.ign.fr/api/nature/pnr` | consultation 30/07/2026 | Licence Ouverte 2.0 | annuelle | Un PNR est un territoire de projet ; son classement n’équivaut pas à une réglementation uniforme. |
| Réserves naturelles et autres espaces protégés | INPN/PatriNat et IGN BD TOPO | `https://apicarto.ign.fr/api/nature/rnn` et `BDTOPO_V3:parc_ou_reserve` | consultation 30/07/2026 | Licence Ouverte 2.0 | trimestrielle | Les catégories ont des portées juridiques différentes ; consulter les actes et fiches officielles. |
| ZNIEFF types I et II | INPN/PatriNat, diffusé par API Carto IGN | `https://apicarto.ign.fr/api/nature/znieff1` et `znieff2` | consultation 30/07/2026 ; dates par objet | Licence Ouverte 2.0 | trimestrielle | Inventaire de connaissance, pas une protection réglementaire à lui seul. |
| Natura 2000 Habitats et Oiseaux | INPN/PatriNat, diffusé par API Carto IGN | `https://apicarto.ign.fr/api/nature/natura-habitat` et `natura-oiseaux` | consultation 30/07/2026 ; dates par objet | Licence Ouverte 2.0 | trimestrielle | Consulter la fiche et les documents d’objectifs officiels. |
| Connexions écologiques d’intérêt régional | Région Île-de-France / Institut Paris Region | `https://data.iledefrance.fr/explore/dataset/connexion-ecologique-sdrif-e/` | SDRIF-E adopté en 2024, approuvé en 2025 | Licence Ouverte 2.0 | annuelle | Donnée prévue pour une lecture au 1:150 000 ; elle ne constitue pas un tracé parcellaire. |
| Observations par maille | GeoNat’îdF / Agence régionale de la biodiversité Île-de-France | `https://geonature.arb-idf.fr/atlas/api/observationsMaille` | consultation 30/07/2026 | selon charte SINP/GeoNat’îdF | trimestrielle | Agrégation de connaissance ; biais de prospection ; absence de donnée ≠ absence d’espèce. |
| Communes du Val-d’Oise | Référentiel administratif État/IGN | API Découpage administratif / COG | COG 2026 | Licence Ouverte 2.0 | annuelle | 183 communes au 1er janvier 2026 ; correspondances historiques à maintenir. |
| Fond cartographique | OpenStreetMap | `https://www.openstreetmap.org/copyright` | continu | ODbL | continu | Fond de contexte, sans valeur réglementaire. |

## Traitement territorial

Les téléchargements ZNIEFF et Natura 2000 ont été interrogés par intersection avec l’emprise élargie du Val-d’Oise. Les données voisines peuvent être présentes dans les fichiers pour préserver les objets transfrontaliers, mais l’interface atténue le contexte extérieur et refuse une sélection territoriale hors du département.

Le SRCE francilien adopté en 2013 reste une référence de connaissance et fait l’objet d’une révision engagée en 2026. La page emploie, pour la couche affichée, les connexions écologiques du SDRIF-E plus récentes et en précise l’échelle d’utilisation.
