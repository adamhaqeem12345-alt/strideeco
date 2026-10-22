"""Convert the single attributed OSM snapshot into a compact local basemap."""
from pathlib import Path
import collections
import datetime
import json
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
xml = ET.parse(root / 'elmina-osm.xml').getroot()
nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])] for n in xml.findall('node')}
features = []
for way in xml.findall('way'):
    tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
    refs = [n.attrib['ref'] for n in way.findall('nd')]
    if not any(k in tags for k in ['highway', 'building', 'natural', 'leisure', 'landuse', 'waterway']):
        continue
    coords = [nodes[n] for n in refs if n in nodes]
    if len(coords) < 2:
        continue
    features.append({'id': way.attrib['id'], 'tags': tags, 'nodes': refs, 'coordinates': coords})
walk = [f for f in features if f['tags'].get('highway') in ['footway', 'path', 'steps', 'cycleway', 'pedestrian'] and f['tags'].get('access') not in ['private', 'no'] and f['tags'].get('foot') != 'no']
meta = {
    'area': 'Elmina Valley Central Park and Elmina Urban Park',
    'source': 'https://api.openstreetmap.org/api/0.6/map?bbox=101.508,3.176,101.518,3.183',
    'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'licence': 'ODbL 1.0', 'attribution': '© OpenStreetMap contributors',
    'bbox': [101.508, 3.176, 101.518, 3.183],
    'osmTimestamp': (xml.find('meta').attrib.get('osm_base') if xml.find('meta') is not None else None),
    'walkableWays': len(walk), 'buildingFootprints': sum('building' in f['tags'] for f in features),
    'buildingHeightTags': sum('height' in f['tags'] or 'building:levels' in f['tags'] for f in features),
    'treeCanopyFeatures': sum(f['tags'].get('natural') in ['wood', 'tree_row'] or f['tags'].get('landuse') == 'forest' for f in features),
    'limitations': ['Building heights are absent.', 'Tree canopy is absent.', 'Public mapping does not confirm present-day access, path condition or safety.'],
}
(root / 'lib').mkdir(exist_ok=True)
(root / 'public' / 'data').mkdir(parents=True, exist_ok=True)
(root / 'lib' / 'elmina-map.json').write_text(json.dumps({'meta': meta, 'features': features}, separators=(',', ':')), encoding='utf-8')
(root / 'public' / 'data' / 'map-provenance.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
print(json.dumps(meta, indent=2))
