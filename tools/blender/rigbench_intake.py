"""
rigbench_intake.py — Rig Bench stage 1: normalize any humanoid model at the
door, so every later stage handles exactly one kind of input.

Run headless (tools/rigbench/rigbench.mjs does this):
  blender -b --python tools/blender/rigbench_intake.py -- <in.(glb|gltf|fbx|obj)> <outDir>

What it does:
  1. imports the file (GLB/GLTF/FBX/OBJ by extension)
  2. joins all mesh objects into one body mesh, welds split normals
  3. normalizes: unit height, feet on y=0, centered on x/z (glTF Y-up space)
  4. turns the body to face +Z when the toes point -Z
  5. measures: T-pose or arms-down, headless, shell count, proportions
  6. writes <outDir>/intake.glb and <outDir>/intake.json (the report)

No fallbacks: an empty file, a flat mesh, or an unknown extension raises.
The report states facts; it never guesses fixes.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
if len(argv) != 2:
    raise SystemExit('usage: blender -b --python rigbench_intake.py -- <in.glb|fbx|obj> <outDir>')
IN_FILE, OUT_DIR = argv
os.makedirs(OUT_DIR, exist_ok=True)

# glTF Y-up <-> Blender Z-up (same convention as rig_basemesh.py)
def to_gltf(v):
    return Vector((v.x, v.z, -v.y))

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(IN_FILE)[1].lower()
if ext in ('.glb', '.gltf'):
    bpy.ops.import_scene.gltf(filepath=IN_FILE)
elif ext == '.fbx':
    bpy.ops.import_scene.fbx(filepath=IN_FILE)
elif ext == '.obj':
    bpy.ops.wm.obj_import(filepath=IN_FILE)
else:
    raise RuntimeError(f'rigbench_intake: unknown extension {ext}')

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise RuntimeError(f'rigbench_intake: no mesh objects in {IN_FILE}')
shells_in = len(meshes)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'body'
# drop any armature modifiers a rigged source carries: intake outputs a MESH
for m in list(body.modifiers):
    body.modifiers.remove(m)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

verts_before = len(body.data.vertices)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')

# everything that is not the body mesh goes (empties, armatures, lights, cams)
for o in list(bpy.context.scene.objects):
    if o is not body:
        bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- normalize
pts = [to_gltf(v.co) for v in body.data.vertices]
ys = [p.y for p in pts]
y_min, y_max = min(ys), max(ys)
raw_h = y_max - y_min
if raw_h <= 1e-6:
    raise RuntimeError('rigbench_intake: flat mesh')
xs = [p.x for p in pts]
zs = [p.z for p in pts]
cx = (min(xs) + max(xs)) * 0.5
cz = (min(zs) + max(zs)) * 0.5
s = 1.0 / raw_h
# glTF (x,y,z) offsets in Blender space: x->x, y->z, z->-y
for v in body.data.vertices:
    g = to_gltf(v.co)
    g = Vector(((g.x - cx) * s, (g.y - y_min) * s, (g.z - cz) * s))
    v.co = Vector((g.x, -g.z, g.y))
body.data.update()

# ---------------------------------------------------------------- facing
pts = [to_gltf(v.co) for v in body.data.vertices]
def band(y0, y1):
    return [p for p in pts if y0 <= p.y <= y1]
foot_band = band(0.0, 0.05)
foot_z = (sum(p.z for p in foot_band) / len(foot_band)) if foot_band else 0.0
flipped = foot_z < 0
if flipped:
    body.rotation_euler = (0.0, 0.0, math.pi)
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(rotation=True)
    pts = [to_gltf(v.co) for v in body.data.vertices]

# ---------------------------------------------------------------- measure
arm_pts = [p for p in band(0.55, 0.95) if abs(p.x) > 0.28]
tpose = len(arm_pts) >= 20
if tpose:
    shoulder_y = sorted(p.y for p in arm_pts)[len(arm_pts) // 2]
    arm_span = max(abs(p.x) for p in arm_pts) * 2.0
else:
    shoulder_y = None
    arm_span = max(abs(p.x) for p in pts) * 2.0
headless = tpose and shoulder_y is not None and shoulder_y > 0.85
tris = len(body.data.polygons)

report = {
    'source': os.path.basename(IN_FILE),
    'rawHeight': round(raw_h, 4),
    'center': [round(cx, 4), round(cz, 4)],
    'shellsIn': shells_in,
    'vertsIn': verts_before,
    'vertsWelded': len(body.data.vertices),
    'tris': tris,
    'turnedToFacePlusZ': flipped,
    'tpose': tpose,
    'shoulderY': round(shoulder_y, 3) if shoulder_y is not None else None,
    'armSpan': round(arm_span, 3),
    'headless': bool(headless),
}
with open(os.path.join(OUT_DIR, 'intake.json'), 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=1)

out_glb = os.path.join(OUT_DIR, 'intake.glb')
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_apply=True)
print('rigbench_intake: ' + json.dumps(report))
print(f'rigbench_intake: wrote {out_glb}')
