"""Give overlapping shoulder plates clearance in the portable GLB itself.

Fitting each tier to the same shoulder can leave coincident triangles. Move
successive tiers along their exported surface normals without changing weights.
The export marker makes this safe to run again on an already finished model.
"""
import json
import re
import struct
from pathlib import Path


def separate_layers(path):
    data=Path(path).read_bytes()
    json_size=struct.unpack_from('<I',data,12)[0]
    gltf=json.loads(data[20:20+json_size])
    if gltf['asset'].get('extras',{}).get('shoulderClearance')==1:
        return
    binary=bytearray(data[28+json_size:])
    moved=set()
    for node in gltf['nodes']:
        name=node.get('name','')
        if 'mesh' not in node or not name.startswith(('Leaf shoulder plate','Shoulder filigree')):
            continue
        suffix=re.search(r'\.(\d+)',name)
        tier=(int(suffix.group(1)) if suffix else 0)%3
        distance=(2-tier)*.006
        if not distance: continue
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            position_id=primitive['attributes']['POSITION']
            if position_id in moved: continue
            moved.add(position_id)
            position=gltf['accessors'][position_id]
            normal=gltf['accessors'][primitive['attributes']['NORMAL']]
            assert position['componentType']==normal['componentType']==5126
            pv=gltf['bufferViews'][position['bufferView']]
            nv=gltf['bufferViews'][normal['bufferView']]
            values=[]
            for index in range(position['count']):
                po=pv.get('byteOffset',0)+position.get('byteOffset',0)+index*pv.get('byteStride',12)
                no=nv.get('byteOffset',0)+normal.get('byteOffset',0)+index*nv.get('byteStride',12)
                co=struct.unpack_from('<3f',binary,po)
                direction=struct.unpack_from('<3f',binary,no)
                shifted=tuple(a+distance*b for a,b in zip(co,direction))
                struct.pack_into('<3f',binary,po,*shifted);values.append(shifted)
            position['min']=[min(v[axis] for v in values) for axis in range(3)]
            position['max']=[max(v[axis] for v in values) for axis in range(3)]
    gltf['asset'].setdefault('extras',{})['shoulderClearance']=1
    metadata=json.dumps(gltf,separators=(',',':')).encode()
    metadata+=b' '*((-len(metadata))%4)
    output=struct.pack('<4sII',b'glTF',2,28+len(metadata)+len(binary))
    output+=struct.pack('<II',len(metadata),0x4e4f534a)+metadata
    output+=struct.pack('<II',len(binary),0x004e4942)+binary
    Path(path).write_bytes(output)


if __name__=='__main__':
    for path in (Path(__file__).resolve().parents[2]/'public/assets/character-atelier').glob('*.glb'):
        separate_layers(path)
        print('Shoulder clearance:',path.name)
