"""
tpose_basemesh.py — pose an arms-down rigged base mesh into a T-pose and
bake it. The clip pack's skeleton (Mesh2Motion) rests in a T, so the pack
fit (rig_basemesh.py --pack) accepts T-pose bodies only; the stylized
figures hang their arms.

Input = <id>.rigged.glb — OUR biped skeleton with bone-heat weights and an
arms-down bind. Each arm chain (upper arm -> forearm -> hand) aims at the
horizontal, one link at a time, so a bent elbow straightens; the digits
ride their parents. The armature modifier bakes the pose into the mesh and
the export carries the MESH only. The output goes to rig_basemesh.py
--pack as a normal T-pose body.

Run headless (the runner does this):
  blender -b --python tools/blender/tpose_basemesh.py -- <in.rigged.glb> <out.glb>

No fallbacks: a missing armature, a missing arm bone, or a bake that
leaves the arms short of a T raises and the runner reports it.
"""
import bpy
import sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
if len(argv) != 2:
    raise SystemExit('usage: blender -b --python tpose_basemesh.py -- <in.rigged.glb> <out.glb>')
IN_GLB, OUT_GLB = argv

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN_GLB)
arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
if len(arms) != 1:
    raise RuntimeError(f'tpose_basemesh: expected one armature in {IN_GLB}, found {len(arms)}')
rig = arms[0]
rig.animation_data_clear()
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
if not meshes:
    raise RuntimeError(f'tpose_basemesh: no skinned mesh in {IN_GLB}')

bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')


def aim(pb, limb_dir, target):
    """Rotate this pose bone about its head so `limb_dir` (world space) maps
    onto `target`. Children follow the parent pose — one call per link
    straightens a chain outward. The limb direction comes from JOINT
    positions (head -> child head), never from the bone tail: the glTF
    importer synthesizes tails, and on a re-imported rig they do not run
    along the limb (figure A probe, 2026-08-23)."""
    m = rig.matrix_world @ pb.matrix
    head = rig.matrix_world @ pb.head
    q = limb_dir.normalized().rotation_difference(target.normalized())
    t = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head)
    pb.matrix = rig.matrix_world.inverted() @ t @ m


def world_head(pb):
    return rig.matrix_world @ pb.head


# glTF -X is the figure's left in our rigs; the importer keeps x as Blender x
for side, sgn in (('L', -1.0), ('R', 1.0)):
    chain = ['upperArm' + side, 'foreArm' + side, 'hand' + side]
    for name in chain:
        if rig.pose.bones.get(name) is None:
            raise RuntimeError(f'tpose_basemesh: bone "{name}" missing in {IN_GLB}')
    target = Vector((sgn, 0.0, 0.0))
    for i, name in enumerate(chain):
        bpy.context.view_layer.update()
        pb = rig.pose.bones[name]
        if i + 1 < len(chain):
            limb = world_head(rig.pose.bones[chain[i + 1]]) - world_head(pb)
        else:
            # the wrist link: aim wrist -> mean digit root; digits follow
            digits = [rig.pose.bones[f'finger{side}{k}a'] for k in range(4) if rig.pose.bones.get(f'finger{side}{k}a')]
            if not digits:
                raise RuntimeError(f'tpose_basemesh: no finger roots on side {side} in {IN_GLB}')
            c = Vector()
            for dg in digits:
                c += world_head(dg)
            limb = c / len(digits) - world_head(pb)
        aim(pb, limb, target)
        bpy.context.view_layer.update()
        head = world_head(pb)
        nxt = world_head(rig.pose.bones[chain[i + 1]]) if i + 1 < len(chain) else None
        print(f'tpose_basemesh: {name} head=({head.x:.3f},{head.y:.3f},{head.z:.3f})' + (f' -> child head=({nxt.x:.3f},{nxt.y:.3f},{nxt.z:.3f})' if nxt else ''))
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')

# Unskinned meshes carry no pose and are strays (figure A ships a leftover
# "Icosphere" spanning z -1..1 that doubled the measured height and would
# weld into the pack body downstream). The bake keeps skinned bodies only.
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in meshes]:
    print(f'tpose_basemesh: dropped unskinned mesh "{o.name}" ({len(o.data.vertices)} verts)')
    bpy.data.objects.remove(o, do_unlink=True)
for mesh in meshes:
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    before = max(abs((mesh.matrix_world @ v.co).x) for v in mesh.data.vertices)
    for mod in [m for m in mesh.modifiers if m.type == 'ARMATURE']:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    after = max(abs((mesh.matrix_world @ v.co).x) for v in mesh.data.vertices)
    print(f'tpose_basemesh: applied {mesh.name} verts={len(mesh.data.vertices)} reach|x| {before:.3f} -> {after:.3f}')
bpy.data.objects.remove(rig, do_unlink=True)

# T reach check in glTF terms (Blender Z is up; x stays x): the pack fit
# detects a T-pose as points with |x| > 0.28 * height between 0.55h and
# 0.95h. A bake that fails that test would fail silently downstream.
pts = [o.matrix_world @ v.co for o in bpy.context.scene.objects if o.type == 'MESH' for v in o.data.vertices]
zs = [p.z for p in pts]
h = max(zs) - min(zs)
z0 = min(zs)
reach = [p for p in pts if 0.55 * h + z0 <= p.z <= 0.95 * h + z0 and abs(p.x) > 0.28 * h]
if len(reach) < 20:
    raise RuntimeError(f'tpose_basemesh: bake left the arms short of a T ({len(reach)} reach points, need 20)')
print(f'tpose_basemesh: baked T-pose, reach |x| max {max(abs(p.x) for p in reach) / h:.3f}h, {len(reach)} reach points')

bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB')
print(f'tpose_basemesh: wrote {OUT_GLB}')
