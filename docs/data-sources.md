# Public-data register

## Pilot candidate: City of Elmina

- Developer: https://www.simedarbyproperty.com/city-of-elmina/
- Tourism Selangor park listing: https://selangor.travel/listing/elmina-central-park/
- OpenStreetMap data: https://www.openstreetmap.org/copyright
- Verified park feature identifiers: OSM way 866543394 (Elmina Valley Central Park), way 1309457596 (Elmina Urban Park).
- Raw map: `elmina-osm.xml`, retrieved once from https://api.openstreetmap.org/api/0.6/map?bbox=101.508,3.176,101.518,3.183.
- Audit: 88 eligible walkable ways, 582 building footprints, zero height tags, zero tree-canopy features. The walking graph has 990 nodes in two connected components (935 and 55 nodes).
- `scripts/prepare-map.py` retains source and retrieval metadata in `public/data/map-provenance.json` and creates `lib/elmina-map.json`.
- The optional scenario projects convex shadow envelopes from real building footprints, using an explicit user-selected height assumption. Tree shade is excluded; projections below 5° solar elevation are unavailable; shadow lengths are capped at 120 m.

## Coverage requirements

Route geometry needs connected walkable mapped ways. Covered ways can be identified when tagged. Building-shadow projection requires building footprints and defensible height inputs. Tree/wood polygons indicate mapped vegetation and cannot automatically be equated with measured shade or temperature.

If public height/canopy information is missing, retain route planning but label shade coverage as unavailable or partial. No resident activity, usage heatmaps or vending-machine locations are prepopulated as real observations.

All downloaded datasets should retain their source URL, retrieval timestamp, licence and transformation method. OSM-derived data remains attributed to OpenStreetMap contributors under ODbL.
