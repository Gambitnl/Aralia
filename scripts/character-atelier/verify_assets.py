"""Check the actual GLB payloads for the export regressions found in this task."""
import hashlib
import json
import math
import struct
from pathlib import Path

root=Path(__file__).resolve().parents[2] / 'public/assets/character-atelier'
digests=set()
recipes=json.loads((Path(__file__).resolve().parents[2] / 'src/devtools/characterAtelier/races.json').read_text())
assert len(recipes)==14 and len({recipe['id'] for recipe in recipes})==14
for recipe in recipes:
    name=recipe['id']
    portrait=root / f'{name}-portrait.png'
    assert portrait.is_file() and portrait.stat().st_size>1000, f'{name}: missing model portrait'
    data=(root / f'{name}.glb').read_bytes()
    magic,version,length=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and length==len(data), name
    json_length,chunk_type=struct.unpack_from('<II',data,12)
    assert chunk_type==0x4E4F534A
    gltf=json.loads(data[20:20+json_length])
    assert gltf['asset'].get('extras',{}).get('shoulderClearance')==1, f'{name}: overlapping plate clearance not applied'
    assert gltf.get('skins'), f'{name}: missing skeleton'
    assert gltf.get('animations'), f'{name}: missing breathing animation'
    assert all('bufferView' in image for image in gltf['images']), f'{name}: external textures would break offline loading'
    body=next(mat for mat in gltf['materials'] if '.body' in mat['name'])
    assert body.get('alphaMode','OPAQUE')=='OPAQUE', f'{name}: transparent skin exposes the inner mouth in WebGL'
    assert not any('targets' in primitive for mesh in gltf['meshes'] for primitive in mesh['primitives']), f'{name}: expected baked anatomical shape'
    assert any('Wide leather belt' in node.get('name','') for node in gltf['nodes']), f'{name}: missing fitted belt'
    if name=='dragonborn':
        assert 'baseColorTexture' in body['pbrMetallicRoughness'] and 'normalTexture' in body, 'Dragonborn needs both scale pigment and surface relief'
        assert not any('Overlapping facial scale' in node.get('name','') for node in gltf['nodes']), 'Dragonborn scales must not be rows of floating beads'
        assert not any('high-poly' in node.get('name','').lower() for node in gltf['nodes']), 'Human eyes must not show through the reptilian face'
    expected_details={'dwarf':'Braided beard', 'gnome':'Braided beard', 'tiefling':'Infernal tail', 'half-orc':'Lower canine tusk', 'dragonborn':'Draconic skull', 'aasimar':'Celestial cheek'}
    if name=='goliath':
        assert not any('Natural stone' in node.get('name','') or 'Natural forehead' in node.get('name','') for node in gltf['nodes']), 'Goliath markings must be skin ink, not raised meshes'
        assert (root/'stone-sigil-mask.png').read_bytes()[:8]==b'\x89PNG\r\n\x1a\n', 'Missing tattoo UV mask'
    if name in expected_details:
        assert any(expected_details[name] in node.get('name','') and 'mesh' in node for node in gltf['nodes']), f'{name}: missing characteristic geometry'
    for accessor in gltf['accessors']:
        assert all(math.isfinite(value) for value in accessor.get('min',[])+accessor.get('max',[])), f'{name}: invalid mesh bounds'
    digest=hashlib.sha256(data).hexdigest()
    assert digest not in digests, f'{name}: duplicate model payload'
    digests.add(digest)
    print(f'{name}: {len(gltf["meshes"])} meshes, {len(gltf["skins"])} skins, {len(gltf["animations"])} animations, {len(data):,} bytes; passed')
