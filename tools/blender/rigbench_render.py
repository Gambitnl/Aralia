"""
rigbench_render.py — Rig Bench stage 2a: turn a normalized intake mesh into
pictures an AI can annotate, with an exact pixel -> world mapping.

Run headless (tools/rigbench/rigbench.mjs does this):
  blender -b --python tools/blender/rigbench_render.py -- <intake.glb> <outDir> [--rig <rig.glb>]

Outputs into <outDir>:
  front.png, side.png, quarter.png       — clay renders (matcap, 1024^2)
  front-rig.png, side-rig.png, quarter-rig.png  — only with --rig: body at
    half alpha with every bone as a red rod (the fit overlay)
  cameras.json — for the two ORTHO views (front, side): center, rightAxis,
    upAxis, orthoScale, resolution. World point of a pixel (px, py):
      u = px / W - 0.5;  v = 0.5 - py / H
      world = center + rightAxis * u * orthoScale + upAxis * v * orthoScale
    All in glTF space (Y up, model faces +Z, unit height). The quarter view
    is perspective and carries no mapping — looks only.

The mesh must be intake-normalized (feet on y=0, height 1, centered).
"""
import json
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
if len(argv) not in (2, 4) or (len(argv) == 4 and argv[2] != '--rig'):
    raise SystemExit('usage: blender -b --python rigbench_render.py -- <intake.glb> <outDir> [--rig <rig.glb>]')
IN_GLB, OUT_DIR = argv[:2]
RIG_GLB = argv[3] if len(argv) == 4 else None
os.makedirs(OUT_DIR, exist_ok=True)

def to_blender(v):
    return Vector((v[0], -v[2], v[1]))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN_GLB)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise RuntimeError(f'rigbench_render: no mesh in {IN_GLB}')
for o in meshes:
    o.color = (0.75, 0.75, 0.78, 1.0)

rods = []
if RIG_GLB:
    before = set(o.name for o in bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=RIG_GLB)
    arms = [o for o in bpy.context.scene.objects if o.name not in before and o.type == 'ARMATURE']
    if not arms:
        raise RuntimeError(f'rigbench_render: no armature in {RIG_GLB}')
    rig = arms[0]
    # the rig GLB brings its own copy of the mesh; keep only the armature
    for o in [o for o in bpy.context.scene.objects if o.name not in before and o.type != 'ARMATURE']:
        bpy.data.objects.remove(o, do_unlink=True)
    # glTF carries JOINT positions, no bone tails — the importer invents
    # tails, and rods drawn from them lie (a floor-length root, a skull
    # spear). Draw the truth instead: one rod per parent->child joint pair,
    # plus a small nub on every leaf so it stays visible.
    heads = {b.name: rig.matrix_world @ b.head_local for b in rig.data.bones}
    def add_rod(a, bpt, name):
        length = (bpt - a).length
        if length < 1e-4:
            return
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.005, depth=length)
        rod = bpy.context.active_object
        rod.name = f'rod:{name}'
        rod.rotation_mode = 'QUATERNION'
        rod.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((bpt - a).normalized())
        rod.location = (a + bpt) * 0.5
        rod.color = (0.95, 0.12, 0.1, 1.0)
        rods.append(rod)
    for b in rig.data.bones:
        if b.parent and b.parent.name != 'root':
            add_rod(heads[b.parent.name], heads[b.name], f'{b.parent.name}>{b.name}')
        if not b.children:
            nub = heads[b.name] + (heads[b.name] - heads[b.parent.name]).normalized() * 0.02 if b.parent else heads[b.name]
            add_rod(heads[b.name], nub, f'{b.name}(leaf)')
    rig.hide_render = True
    for o in meshes:
        o.color = (0.75, 0.75, 0.78, 0.45)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'MATCAP' if not RIG_GLB else 'STUDIO'
scene.display.shading.color_type = 'OBJECT'
if RIG_GLB:
    scene.display.shading.show_xray = True
    scene.display.shading.xray_alpha = 0.45
RES = 1024
scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.render.film_transparent = False

# glTF-space view definitions. Ortho scale covers the unit body with margin.
ORTHO = 1.3
CENTER = Vector((0.0, 0.5, 0.0))
DIST = 4.0
views = [
    # name, camera position (glTF), rightAxis, upAxis, ortho?
    ('front', Vector((0.0, 0.5, DIST)), (1, 0, 0), (0, 1, 0), True),
    ('side', Vector((DIST, 0.5, 0.0)), (0, 0, -1), (0, 1, 0), True),
    ('quarter', Vector((DIST * 0.62, 0.62, DIST * 0.62)), None, None, False),
]

cam_data = bpy.data.cameras.new('benchCam')
cam = bpy.data.objects.new('benchCam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

cameras = {}
suffix = '-rig' if RIG_GLB else ''
for name, pos, right, up, ortho in views:
    cam.location = to_blender(pos)
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (to_blender(CENTER) - cam.location).to_track_quat('-Z', 'Y')
    if ortho:
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = ORTHO
        cameras[name] = {
            'center': [CENTER.x, CENTER.y, CENTER.z],
            'rightAxis': list(right),
            'upAxis': list(up),
            'orthoScale': ORTHO,
            'resolution': [RES, RES],
        }
    else:
        cam_data.type = 'PERSP'
        cam_data.lens = 60
    scene.render.filepath = os.path.join(OUT_DIR, f'{name}{suffix}.png')
    bpy.ops.render.render(write_still=True)
    print(f'rigbench_render: wrote {scene.render.filepath}')

if not RIG_GLB:
    with open(os.path.join(OUT_DIR, 'cameras.json'), 'w', encoding='utf-8') as f:
        json.dump(cameras, f, indent=1)
    print('rigbench_render: wrote cameras.json')
