"""
rig_basemesh.py — give a licensed base mesh OUR full biped skeleton with
Blender automatic (bone-heat) weights. Part Lab, Remy's call 2026-08-21:
"give them all a full skeleton" — Blender automatic weights, T-pose bind,
then the biped driver moves the body into its standing idle.

Run headless (the runner does this):
  blender -b --python tools/blender/rig_basemesh.py -- <in.glb> <out.glb> <bipedBoneSpec.json>

What it does:
  1. imports the split, normalized base mesh (feet on y=0, height 1, glTF Y-up)
  2. joins its objects into one body mesh
  3. fits the biped bone layout (tools/entities3d/bipedBoneSpec.json: our
     names, parents, rest proportions) to THIS mesh's T-pose landmarks —
     arm reach, shoulder height, leg spread, facing — measured from vertices
  4. builds the armature so each bone's rest frame equals the frame the
     engine's pose sink computes (+Y along the bone, minimal rotation from
     world +Y), so the driver's absolute bone transforms deform the skin
     without a twist
  5. parents the body with ARMATURE_AUTO (bone heat) and exports a GLB with
     the skin

No fallbacks: a failed bone-heat solve, a missing landmark band, or a bone
without a parent raises and the runner reports it.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
def _flag(name):
    if name in argv:
        i = argv.index(name)
        v = argv[i + 1]
        del argv[i:i + 2]
        return v
    return None
# --landmarks: Rig Bench stage 2b (2026-08-23). A JSON of AI-annotated 3D
# joints (rigbench.mjs solve) overrides the silhouette heuristics below —
# vision places joints, slices only fill what the file leaves out.
LANDMARKS_PATH = _flag('--landmarks')
PACK = _flag('--pack')
if len(argv) != 3:
    raise SystemExit('usage: blender -b --python rig_basemesh.py -- <in.glb> <out.glb> <bipedBoneSpec.json> [--pack <clipPack.glb>] [--landmarks <landmarks.3d.json>]')
IN_GLB, OUT_GLB, SPEC_PATH = argv[:3]
# --pack: NATIVE pack-skeleton rig (Remy 2026-08-23). The clip pack's own
# 66-joint armature (Mesh2Motion, T-pose rest) is imported and fitted to the
# mesh's landmarks — heads moved, rolls kept — so the CC0 clips play on this
# body with no retarget, fingers and toes included. T-pose bodies only: the
# pack rests in a T, and a hanging-arm body would need a pose swap.

with open(SPEC_PATH, 'r', encoding='utf-8') as f:
    SPEC = json.load(f)
BONES = SPEC['bones']
PARENT = SPEC['parent']
REST = SPEC['restJoints']

# ---------------------------------------------------------------- coordinates
# Blender is Z-up; the glTF importer maps glTF (x, y, z) -> Blender (x, -z, y).
# All landmark math runs in glTF space; bones convert back at creation.
def to_gltf(v):
    return Vector((v.x, v.z, -v.y))

def to_blender(v):
    return Vector((v[0], -v[2], v[1]))

# ---------------------------------------------------------------- import + join
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN_GLB)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise RuntimeError(f'rig_basemesh: no mesh objects in {IN_GLB}')
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
# the split GLB keeps its normalization (feet on 0, height 1) on a PARENT
# node; bake that into the meshes before the parents go away
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'body'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# The split GLB carries one vertex per face corner (FBX split normals):
# 10,892 verts for 5,392 tris on the lowpoly male. Bone heat solves a
# Laplacian over CONNECTED geometry, and on a soup of loose triangles it
# "failed to find solution for one or more bones" and bound nothing. Weld.
verts_before = len(body.data.vertices)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
print(f'rig_basemesh: welded {verts_before} -> {len(body.data.vertices)} vertices')
# remove the empties the importer left behind
for o in list(bpy.context.scene.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- proxy
# A sculpt kit arrives as dozens of shells (eyes, lids, teeth, hands as
# separate objects). Bone heat needs ONE closed surface, so a voxel remesh
# of the joined body becomes the heat PROXY: the skeleton is fitted and
# solved on it, and its weights transfer back to the sculpt by nearest face.
# A single welded body (the lowpoly pack) solves directly.
proxy = None
if len(meshes) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    proxy = bpy.context.view_layer.objects.active
    proxy.name = 'heatProxy'
    dims = max(proxy.dimensions)
    rm = proxy.modifiers.new('voxel', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = dims * 0.006
    rm.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=rm.name)
    print(f'rig_basemesh: heat proxy {len(proxy.data.vertices)} verts (voxel {rm.voxel_size:.4f})')
measure = proxy if proxy else body

verts = [to_gltf(v.co) for v in measure.data.vertices]
ys = [v.y for v in verts]
y_min, y_max = min(ys), max(ys)
H = y_max - y_min
if H <= 0:
    raise RuntimeError('rig_basemesh: flat mesh')
# landmarks measure x and z from the mesh center, whatever its origin
xs = [v.x for v in verts]
zs = [v.z for v in verts]
cx = (min(xs) + max(xs)) * 0.5
cz = (min(zs) + max(zs)) * 0.5
verts = [Vector((v.x - cx, v.y, v.z - cz)) for v in verts]
print(f'rig_basemesh: height={H:.3f} center=({cx:.3f}, {cz:.3f}) y_min={y_min:.3f}')

def band(y0, y1):
    return [v for v in verts if y0 * H + y_min <= v.y <= y1 * H + y_min]

# ---------------------------------------------------------------- landmarks (T-pose)
# arm vertices: anything far out in x above the hips
arm_pts = [v for v in band(0.55, 0.95) if abs(v.x) > 0.28 * H]
# T-pose: arms reach far out in x. Otherwise the figure stands with its arms
# down, and the arm chain follows our own rest pose (arms hang at the sides).
tpose = len(arm_pts) >= 20
if tpose:
    shoulder_y = sorted(p.y for p in arm_pts)[len(arm_pts) // 2]
    reach_x = max(abs(p.x) for p in arm_pts)
else:
    shoulder_y = REST['upperArmL']['a'][1] * H + y_min
    reach_x = max(abs(v.x) for v in band(0.35, 0.85))
torso_band = [v for v in band(0.60, 0.72)]

def torso_edge(pts):
    """Half-width of the torso at this band. With the arms down the band
    holds torso AND arms: walk an |x| histogram outward from the center and
    stop at the first empty bin — the gap between torso and arm. No gap
    (T-pose, or arms pressed to the body) = the band's full extent."""
    if not pts:
        return 0.17 * H
    w = 0.01 * H
    xs = sorted(abs(v.x) for v in pts)
    nb = int(xs[-1] / w) + 2
    hist = [0] * nb
    for x in xs:
        hist[int(x / w)] += 1
    start = int(xs[len(xs) // 3] / w)
    for i in range(start, nb):
        if hist[i] == 0:
            return i * w
    return xs[-1]

torso_half_w = torso_edge(torso_band)
# shoulder joint sits inside the torso edge
shoulder_x = min(0.17 * H, torso_half_w * 0.9)
def side_x(y0, y1, fallback):
    """Mean |x| of the band — one leg's center line at that height."""
    pts = band(y0, y1)
    return (sum(abs(v.x) for v in pts) / len(pts)) if pts else fallback * H

# A-pose legs spread toward the ankles: measure hip, knee, and ankle apart
hip_x = side_x(0.42, 0.50, 0.08)
knee_x = side_x(0.22, 0.30, 0.09)
ankle_x = side_x(0.04, 0.10, 0.10)
# facing: toes reach forward; our rest pose's foot tail is +z
foot_band = band(0.0, 0.05)
foot_z = (sum(v.z for v in foot_band) / len(foot_band)) if foot_band else 0.0
if foot_z < 0:
    # the engine's bodies face +Z: turn this one around (180° about up)
    # and re-measure, so every rigged base mesh shares one facing
    # the body AND its heat proxy turn together: the skeleton is fitted on
    # the proxy's vertices and solved on it
    bpy.ops.object.select_all(action='DESELECT')
    for o in ([body, proxy] if proxy else [body]):
        o.select_set(True)
        o.rotation_euler = (0.0, 0.0, math.pi)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    verts = [to_gltf(v.co) for v in measure.data.vertices]
    xs = [v.x for v in verts]
    zs = [v.z for v in verts]
    cx = (min(xs) + max(xs)) * 0.5
    cz = (min(zs) + max(zs)) * 0.5
    verts = [Vector((v.x - cx, v.y, v.z - cz)) for v in verts]
    foot_band = band(0.0, 0.05)
    torso_band = [v for v in band(0.60, 0.72)]
    print('rig_basemesh: turned the body to face +Z')
forward = 1.0
foot_len = max(0.06 * H, (max(v.z for v in foot_band) - min(v.z for v in foot_band)) * 0.8 if foot_band else 0.1 * H)

# A HEADLESS body (the lowpoly no-gender base) ends at the neck stump, so
# its mesh height is ~0.85 of a full figure. The rest proportions are
# fractions of a FULL height; scale them by the implied full height, or the
# spine lands too high and the torso swells (side-by-side 22, 2026-08-22).
# T-pose shoulders sit near 0.78 of a full figure; on a headless body the
# same shoulders sit near 0.9 of what is left (measured 2026-08-22: 0.88-0.92
# on the lowpoly no-gender base, 0.76 on the male).
headless = tpose and (shoulder_y - y_min) / H > 0.85
HR = H / 0.85 if headless else H
if headless:
    print(f'rig_basemesh: headless body (shoulders at {(shoulder_y - y_min) / H:.3f}h) — rest proportions on full height {HR:.3f}')

def rest_len(bone):
    a, b = REST[bone]['a'], REST[bone]['b']
    return math.dist(a, b) * HR

def rest_pt(bone, key):
    a = REST[bone][key]
    return Vector((a[0] * HR, a[1] * HR + y_min, a[2] * HR * forward))

# ---------------------------------------------------------------- bone layout
# head/tail per bone in glTF space. Spine, head, legs keep the rest
# proportions (scaled to H, facing-corrected); arms lie along the T-pose.
J = {}
# root binds at the ORIGIN (feet level): the engine's pose sink never writes
# the root and composes every other bone's world transform beneath it
J['root'] = (Vector((0, y_min, 0)), Vector((0, y_min + 0.05 * H, 0)))
for b in ('pelvis', 'chest', 'neck', 'head'):
    J[b] = (rest_pt(b, 'a'), rest_pt(b, 'b'))
chest_top = J['chest'][1]
print(f'rig_basemesh: spine pelvis={(J["pelvis"][0].y - y_min) / H:.3f}h chest_top={(chest_top.y - y_min) / H:.3f}h neck_top={(J["neck"][1].y - y_min) / H:.3f}h head={(J["head"][0].y - y_min) / H:.3f}-{(J["head"][1].y - y_min) / H:.3f}h')
for side, sgn in (('L', -1.0), ('R', 1.0)):
    up_len = rest_len('upperArm' + side)
    fore_len = rest_len('foreArm' + side)
    hand_len = rest_len('hand' + side)
    f_len = rest_len('finger%s0a' % side)
    # the whole chain INCLUDING the two finger links meets this mesh's reach
    total = up_len + fore_len + hand_len + f_len * 1.85
    if tpose:
        k = max(0.6, min(1.6, (reach_x - shoulder_x) / total))
        f_len *= k
        sh = Vector((sgn * shoulder_x, shoulder_y, chest_top.z))
        el = sh + Vector((sgn * up_len * k, 0, 0))
        wr = el + Vector((sgn * fore_len * k, 0, 0))
        hd = wr + Vector((sgn * hand_len * k, 0, 0))
    else:
        # arms down: fit the arm from THIS side's outer SILHOUETTE. A hanging
        # arm is the body's outer edge below the deltoid whether or not air
        # separates it from the torso (the stylized figures hug their arms
        # to the body, so a gap search found only the hands). The shoulder
        # is the widest band of the deltoid; wrist and elbow sit inside the
        # outer edge by the arm's radius at their rest heights.
        def edge(y0, y1):
            pts = [v for v in band(y0, y1)]
            vals = sorted(sgn * v.x for v in pts)
            if not vals:
                raise RuntimeError(f'rig_basemesh: empty band {y0:.2f}-{y1:.2f} on side {side}')
            return vals[int(len(vals) * 0.995)]  # outer edge, minus noise

        def edge_z(y0, y1, x_edge, tol):
            pts = [v for v in band(y0, y1) if sgn * v.x > x_edge - tol]
            return (sum(v.z for v in pts) / len(pts)) if pts else 0.0

        delt = max(((edge(y, y + 0.03), y) for y in (0.72, 0.74, 0.76, 0.78, 0.80, 0.82, 0.84)), key=lambda e: e[0])
        sh_y = delt[1] + 0.005 * H + y_min
        arm_r = max(0.025 * H, min(0.05 * H, (delt[0] - torso_half_w) * 0.5 if delt[0] > torso_half_w else 0.035 * H))
        sh = Vector((sgn * (delt[0] - arm_r * 1.4), sh_y, edge_z(delt[1], delt[1] + 0.03, delt[0], arm_r)))
        wr_y = REST['foreArm' + side]['b'][1] * H + y_min
        wr_f = (wr_y - y_min) / H
        wr_e = edge(wr_f - 0.015, wr_f + 0.015)
        wr = Vector((sgn * (wr_e - arm_r * 0.9), wr_y, edge_z(wr_f - 0.015, wr_f + 0.015, wr_e, arm_r)))
        el_y = REST['upperArm' + side]['b'][1] * H + y_min
        el_f = (el_y - y_min) / H
        el_e = edge(el_f - 0.015, el_f + 0.015)
        el = Vector((sgn * (el_e - arm_r), el_y, edge_z(el_f - 0.015, el_f + 0.015, el_e, arm_r)))
        # the hand: the lowest point of the hanging forearm column (between
        # the knees and the waist, out at the wrist's x) is the fingertip
        col = [v for v in band(0.25, 0.60) if sgn * v.x > wr_e - 2.2 * arm_r]
        if not col:
            raise RuntimeError(f'rig_basemesh: no hanging hand column on side {side}')
        hand_bottom = min(v.y for v in col)
        hd = Vector((wr.x, hand_bottom + f_len * 1.85, wr.z))
        wr = hd + Vector((0, hand_len, 0))
        k = (wr - el).length / max(fore_len, 1e-6)
        print(f'rig_basemesh: arm {side} deltoid={delt[0] / H:.3f}h@{delt[1]:.2f} arm_r={arm_r / H:.3f}h '
              f'sh=({sh.x / H:.3f},{(sh.y - y_min) / H:.3f}) el=({el.x / H:.3f},{(el.y - y_min) / H:.3f}) wr=({wr.x / H:.3f},{(wr.y - y_min) / H:.3f})')
    J['clavicle' + side] = (Vector(chest_top), sh)
    J['upperArm' + side] = (sh, el)
    J['foreArm' + side] = (el, wr)
    J['hand' + side] = (wr, hd)
    # digits fan forward of the palm line, along the arm direction
    spread = 0.012 * H
    # digits continue the arm: outward in a T-pose, downward when the arms hang
    arm_dir = Vector((sgn, 0, 0)) if tpose else Vector((0, -1, 0))
    for i in range(4):
        z_off = (1.5 - i) * spread * forward
        root = hd + Vector((0, 0, z_off))
        j1 = root + arm_dir * f_len
        tip = j1 + arm_dir * (rest_len('finger%s%da' % (side, i)) * 0.85 * (k if tpose else 1.0))
        J['finger%s%da' % (side, i)] = (root, j1)
        J['finger%s%db' % (side, i)] = (j1, tip)
    t_len = rest_len('thumb' + side + 'a')
    # The thumb SPLAYS off the hand. Laid along the arm it reads as a fifth
    # finger and its bones lie on the index — the real thumb flesh then
    # follows the wrong bone (Remy's red-vs-blue read, 2026-08-23). Default:
    # a forward diagonal off the arm axis; thumbRoot/thumbTip landmarks pin
    # it exactly when annotated.
    t_dir = (arm_dir * 0.55 + Vector((0, -0.18, 0.85 * forward))).normalized()
    t_root = wr + arm_dir * (hand_len * (k if tpose else 1.0) * 0.4) + Vector((0, 0, 2.2 * spread * forward))
    t_j1 = t_root + t_dir * (t_len * 0.99)
    t_tip = t_j1 + t_dir * (t_len * 0.86)
    J['thumb' + side + 'a'] = (t_root, t_j1)
    J['thumb' + side + 'b'] = (t_j1, t_tip)
    # legs: rest proportions, this mesh's leg spread
    # straight T-pose legs: no rest-pose knee bend
    hip = Vector((sgn * hip_x, rest_pt('thigh' + side, 'a').y, 0))
    knee = Vector((sgn * knee_x, rest_pt('thigh' + side, 'b').y, 0))
    ankle = Vector((sgn * ankle_x, rest_pt('shin' + side, 'b').y, 0))
    heel = Vector((sgn * ankle_x, 0.03 * H + y_min, -0.3 * foot_len * forward))
    toe = Vector((sgn * ankle_x * 1.15, 0.015 * H + y_min, 0.7 * foot_len * forward))
    J['thigh' + side] = (hip, knee)
    J['shin' + side] = (knee, ankle)
    J['foot' + side] = (heel, toe)

# ---------------------------------------------------------------- AI landmarks
# Rig Bench override (2026-08-23): annotated joints replace the slice
# guesses BEFORE the centering pass below, so a rough click still snaps
# into the middle of the flesh (Remy: "really hard to get it to sit
# properly centered inside the model skin" — the click gives the station,
# the mesh gives the center). The file is in intake space (unit height,
# centered on x/z); joints here live in the centered landmark frame, so
# each point converts by -(cx, 0, cz). Chain joints are SHARED Vector
# objects: mutation in place moves every bone that meets there. Any subset
# of names applies; the rest keep the heuristic. Digits re-anchor on the
# moved hand in the pass below; a landmark-pinned thumb is exempt.
LM_THUMB = set()
if LANDMARKS_PATH:
    with open(LANDMARKS_PATH, 'r', encoding='utf-8') as f:
        LM = {k: Vector(v['pos']) - Vector((cx, 0, cz)) for k, v in json.load(f).items()}

    def lm_move(p, lm_name):
        if lm_name not in LM:
            return None
        d = LM[lm_name] - p
        p.x, p.y, p.z = LM[lm_name]
        return d

    applied = []
    for name, a_lm, b_lm in (('pelvis', 'pelvis', None), ('chest', None, 'chestTop'),
                             ('neck', 'neckBase', None), ('head', 'headBase', 'headTop')):
        a, b = J[name]
        if a_lm:
            d = lm_move(a, a_lm)
            if d is not None:
                applied.append(a_lm)
                if b_lm is None:
                    b.x, b.y, b.z = b.x + d.x, b.y + d.y, b.z + d.z  # keep the bone's direction
        if b_lm and lm_move(b, b_lm) is not None:
            applied.append(b_lm)
    for side in ('L', 'R'):
        # clavicle heads are COPIES of the chest top; keep them together
        if 'chestTop' in LM:
            J['clavicle' + side][0].x, J['clavicle' + side][0].y, J['clavicle' + side][0].z = LM['chestTop']
        for joint, lm_name in ((J['upperArm' + side][0], 'shoulder' + side),
                               (J['upperArm' + side][1], 'elbow' + side),
                               (J['thigh' + side][0], 'hip' + side),
                               (J['thigh' + side][1], 'knee' + side),
                               (J['shin' + side][1], 'ankle' + side),
                               (J['foot' + side][1], 'toe' + side)):
            if lm_move(joint, lm_name) is not None:
                applied.append(lm_name)
        d = lm_move(J['foreArm' + side][1], 'wrist' + side)
        if d is not None:
            applied.append('wrist' + side)
            hd = J['hand' + side][1]
            hd.x, hd.y, hd.z = hd.x + d.x, hd.y + d.y, hd.z + d.z  # hand tip rides along
        # the thumb pins as a PAIR: root + tip give the splay axis; the
        # middle joint sits at the natural two-link split
        has_tr = ('thumbRoot' + side) in LM
        has_tt = ('thumbTip' + side) in LM
        if has_tr != has_tt:
            raise RuntimeError(f'rig_basemesh: thumbRoot{side} and thumbTip{side} come as a pair')
        if has_tr:
            root_v, tip_v = LM['thumbRoot' + side], LM['thumbTip' + side]
            j1_v = root_v + (tip_v - root_v) * 0.53
            a_pair = J['thumb' + side + 'a']
            b_pair = J['thumb' + side + 'b']
            a_pair[0].x, a_pair[0].y, a_pair[0].z = root_v
            a_pair[1].x, a_pair[1].y, a_pair[1].z = j1_v  # shared with b_pair[0]
            b_pair[1].x, b_pair[1].y, b_pair[1].z = tip_v
            applied += ['thumbRoot' + side, 'thumbTip' + side]
            LM_THUMB.add(side)
    print('rig_basemesh: landmarks applied: ' + (' '.join(applied) if applied else 'NONE'))

# ---------------------------------------------------------------- center in the mesh
# Remy 2026-08-23: "wire the skeleton to match the base frame — bones
# centered inside each component". Every joint moves to the centroid of the
# mesh slice across its limb at that station, so each bone runs down the
# middle of its arm, leg, or torso instead of along a landmark guess. The
# arm and leg chains share Vector objects across J, so moving a joint in
# place moves every bone that meets there.
def center(p, axis, sel, r, slab=0.015):
    """Move p (in place) to the centroid of the mesh slice across `axis`
    at p, among vertices that pass `sel` and lie within r of p in the
    slice plane. Returns the number of vertices used."""
    s = slab * H
    if axis == 'x':
        pts = [v for v in verts if abs(v.x - p.x) < s and sel(v) and math.hypot(v.y - p.y, v.z - p.z) < r]
        if len(pts) < 6:
            return 0
        p.y = sum(v.y for v in pts) / len(pts)
        p.z = sum(v.z for v in pts) / len(pts)
    else:
        pts = [v for v in verts if abs(v.y - p.y) < s and sel(v) and math.hypot(v.x - p.x, v.z - p.z) < r]
        if len(pts) < 6:
            return 0
        p.x = sum(v.x for v in pts) / len(pts)
        p.z = sum(v.z for v in pts) / len(pts)
    return len(pts)

centered = {}
for _pass in range(2):
    # spine: the torso slice at each station (x centers by symmetry, z on the
    # body's true middle); the clavicle heads are copies of the chest top
    # the spine stays ONE vertical line: x from symmetry, z from the pelvis
    # slice only. Per-station z centering tilted the female's chest axis
    # (breasts and back shift the slice centers) and the driver then stood
    # that axis up, leaning her whole torso (2026-08-23).
    spine_z = None
    for b in ('pelvis', 'chest', 'neck'):
        for p in J[b]:
            centered[b] = center(p, 'y', lambda v: True, 0.3 * H)
            if spine_z is None:
                spine_z = p.z
            p.z = spine_z
    for side in ('L', 'R'):
        J['clavicle' + side][0].x = J['chest'][1].x
        J['clavicle' + side][0].z = J['chest'][1].z
    for p in J['head']:
        centered['head'] = center(p, 'y', lambda v: True, 0.16 * H)
    for side, sgn in (('L', -1.0), ('R', 1.0)):
        same_side = lambda v, sgn=sgn: sgn * v.x > 0
        sh, el = J['upperArm' + side]
        wr, hd = J['hand' + side]
        if tpose:
            # across the arm (slice perpendicular to x); the shoulder slice
            # stays inside the deltoid, clear of the chest
            centered['sh' + side] = center(sh, 'x', same_side, 0.09 * H)
            centered['el' + side] = center(el, 'x', same_side, 0.07 * H)
            centered['wr' + side] = center(wr, 'x', same_side, 0.06 * H)
            centered['hd' + side] = center(hd, 'x', same_side, 0.06 * H)
        else:
            # hanging arm: slices are horizontal; the radius keeps the slice
            # on the arm even where it hugs the torso
            outer = lambda v, sgn=sgn: sgn * v.x > torso_half_w - 0.03 * H
            centered['sh' + side] = center(sh, 'y', same_side, 0.07 * H)
            centered['el' + side] = center(el, 'y', outer, 0.06 * H)
            centered['wr' + side] = center(wr, 'y', outer, 0.055 * H)
            centered['hd' + side] = center(hd, 'y', outer, 0.055 * H)
        hip, knee = J['thigh' + side]
        ankle = J['shin' + side][1]
        below_hip = lambda v, sgn=sgn: sgn * v.x > 0 and v.y < J['pelvis'][0].y + 0.02 * H
        centered['hip' + side] = center(hip, 'y', below_hip, 0.11 * H)
        centered['knee' + side] = center(knee, 'y', below_hip, 0.09 * H)
        centered['ankle' + side] = center(ankle, 'y', below_hip, 0.07 * H)
        # the foot follows its ankle sideways
        for p in J['foot' + side]:
            p.x = ankle.x
        # the fingers follow the hand
print('rig_basemesh: centered ' + ' '.join(f'{k}={n}' for k, n in centered.items()))
# re-anchor the digits on the moved hand (they were built from the old hd)
for side, sgn in (('L', -1.0), ('R', 1.0)):
    wr, hd = J['hand' + side]
    arm_dir = Vector((sgn, 0, 0)) if tpose else Vector((0, -1, 0))
    spread = 0.012 * H
    for i in range(4):
        root, j1 = J['finger%s%da' % (side, i)]
        _j1, tip = J['finger%s%db' % (side, i)]
        la, lb = (j1 - root).length, (tip - j1).length
        z_off = (1.5 - i) * spread * forward
        root.x, root.y, root.z = hd.x, hd.y, hd.z + z_off
        j1.x, j1.y, j1.z = (root + arm_dir * la).x, (root + arm_dir * la).y, (root + arm_dir * la).z
        tip.x, tip.y, tip.z = (j1 + arm_dir * lb).x, (j1 + arm_dir * lb).y, (j1 + arm_dir * lb).z
    if side in LM_THUMB:
        continue  # a landmark-pinned thumb keeps its annotated axis
    t_root, t_j1 = J['thumb' + side + 'a']
    _t, t_tip = J['thumb' + side + 'b']
    la, lb = t_j1 - t_root, t_tip - t_j1
    base = wr + (hd - wr) * 0.4 + Vector((0, 0, 2.2 * spread * forward))
    t_root.x, t_root.y, t_root.z = base.x, base.y, base.z
    n1 = t_root + la
    t_j1.x, t_j1.y, t_j1.z = n1.x, n1.y, n1.z
    n2 = t_j1 + lb
    t_tip.x, t_tip.y, t_tip.z = n2.x, n2.y, n2.z

missing = [b for b in BONES if b not in J]
if missing:
    raise RuntimeError('rig_basemesh: no layout for bones: ' + ', '.join(missing))
# back from centered landmark space into the mesh's own frame
J = {k: (a + Vector((cx, 0, cz)), b + Vector((cx, 0, cz))) for k, (a, b) in J.items()}


# ---------------------------------------------------------------- armature
UP = Vector((0.0, 1.0, 0.0))

def sink_quat(direction):
    """three.js Quaternion.setFromUnitVectors(UP, dir) — the pose sink's frame."""
    d = direction.normalized()
    r = UP.dot(d) + 1.0
    if r < 1e-6:
        # opposite vectors: any perpendicular axis, as three.js does (x-major)
        if abs(UP.x) > abs(UP.z):
            q = Quaternion((0.0, -UP.y, UP.x, 0.0))
        else:
            q = Quaternion((0.0, 0.0, -UP.z, UP.y))
    else:
        c = UP.cross(d)
        q = Quaternion((r, c.x, c.y, c.z))
    q.normalize()
    return q

if PACK:
    if not tpose:
        raise RuntimeError('rig_basemesh --pack: the pack rests in a T-pose; this body hangs its arms (pose swap not built)')
    before = set(o.name for o in bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=PACK)
    new_objs = [o for o in bpy.context.scene.objects if o.name not in before]
    pack_arms = [o for o in new_objs if o.type == 'ARMATURE']
    if len(pack_arms) != 1:
        raise RuntimeError(f'rig_basemesh --pack: expected one armature in {PACK}, found {len(pack_arms)}')
    rig = pack_arms[0]
    rig.animation_data_clear()
    for o in new_objs:
        if o is not rig:
            bpy.data.objects.remove(o, do_unlink=True)
    rig.name = 'PackRig'
    # pack joint → landmark (glTF space). Pack "_l" is +X; our "L" side is
    # −X, so pack _l takes our R joints and _r our L.
    def lerp(a, b, t):
        return a + (b - a) * t
    heads = {b.name: (rig.matrix_world @ b.head_local) for b in rig.data.bones}
    pz = lambda n: to_gltf(heads[n]).y
    spine_f = lambda n: (pz(n) - pz('pelvis')) / max(pz('neck_01') - pz('pelvis'), 1e-6)
    pelvis_a = J['pelvis'][0]
    # The pack's neck_01 sits at the BASE OF THE NECK — not at our low
    # chest-top landmark. Pinned to the chest top it grew a long neck bone
    # rooted mid-chest, and the upper chest followed head motion (Remy's
    # wire read, 2026-08-23). Root it at our neck segment's TAIL (the head
    # bone starts above it); the spine spreads over the taller span. An
    # annotated neckBase landmark beats both guesses.
    if LANDMARKS_PATH and 'neckBase' in LM:
        # the annotated neck root, after the centering pass, in the mesh frame
        neck_a = Vector(J['neck'][0])
    else:
        neck_a = Vector((0.0, max(J['neck'][1].y, shoulder_y), J['neck'][1].z))
    target = {
        'root': Vector((0.0, y_min, 0.0)),
        'pelvis': pelvis_a,
        'spine_01': lerp(pelvis_a, neck_a, spine_f('spine_01')),
        'spine_02': lerp(pelvis_a, neck_a, spine_f('spine_02')),
        'spine_03': lerp(pelvis_a, neck_a, spine_f('spine_03')),
        'neck_01': neck_a,
        'head': J['head'][0],
        'head_leaf': J['head'][1],
    }
    for pside, ours in (('l', 'R'), ('r', 'L')):
        sh, el = J['upperArm' + ours]
        wr, hd = J['hand' + ours]
        # each clavicle roots a sternum-edge width OFF the midline toward its
        # own shoulder — stacked midline roots read as "no collar bones" and
        # their editor balls overlap (Remy 2026-08-23). Pack _l is +X.
        cl = Vector(J['clavicle' + ours][0])
        cl.x = (0.018 * H) * (1.0 if pside == 'l' else -1.0)
        target['clavicle_' + pside] = cl
        target['upperarm_' + pside] = sh
        target['lowerarm_' + pside] = el
        target['hand_' + pside] = wr
        for pfinger, idx in (('index', 0), ('middle', 1), ('ring', 2), ('pinky', 3)):
            root, j1 = J['finger%s%da' % (ours, idx)]
            _j1, tip = J['finger%s%db' % (ours, idx)]
            target[f'{pfinger}_01_{pside}'] = root
            target[f'{pfinger}_02_{pside}'] = j1
            target[f'{pfinger}_03_{pside}'] = lerp(j1, tip, 0.55)
            target[f'{pfinger}_04_leaf_{pside}'] = tip
        t_root, t_j1 = J['thumb' + ours + 'a']
        _t, t_tip = J['thumb' + ours + 'b']
        target[f'thumb_01_{pside}'] = t_root
        target[f'thumb_02_{pside}'] = t_j1
        target[f'thumb_03_{pside}'] = lerp(t_j1, t_tip, 0.55)
        target[f'thumb_04_leaf_{pside}'] = t_tip
        hip, knee = J['thigh' + ours]
        ankle = J['shin' + ours][1]
        heel, toe = J['foot' + ours]
        target['thigh_' + pside] = hip
        target['calf_' + pside] = knee
        target['foot_' + pside] = ankle
        target['ball_' + pside] = lerp(heel, toe, 0.75)
        target['ball_leaf_' + pside] = toe
    missing = [b.name for b in rig.data.bones if b.name not in target]
    if missing:
        raise RuntimeError('rig_basemesh --pack: no landmark for pack bones: ' + ', '.join(missing))
    # Skeleton Lab overrides (Remy 2026-08-23): <mesh>.landmarks.json beside
    # the input GLB pins joints where the reviewer dragged them (glTF space,
    # unit height). A joint without its own override INHERITS the delta of
    # its nearest overridden ancestor, so a dragged wrist carries its hand
    # and fingers. Unknown joint names raise — no silent drops.
    lm_file = (IN_GLB[:-4] if IN_GLB.lower().endswith('.glb') else IN_GLB) + '.landmarks.json'
    if os.path.exists(lm_file):
        with open(lm_file, 'r', encoding='utf-8') as f:
            lm_joints = (json.load(f).get('joints') or {})
        unknown = [k for k in lm_joints if k not in target]
        if unknown:
            raise RuntimeError('rig_basemesh --pack: landmarks name unknown pack joints: ' + ', '.join(unknown))
        overrides = {k: Vector((v[0], v[1], v[2])) for k, v in lm_joints.items()}
        deltas = {k: overrides[k] - target[k] for k in overrides}
        parent_of = {b.name: (b.parent.name if b.parent else None) for b in rig.data.bones}
        def inherited_delta(name):
            p = parent_of.get(name)
            while p:
                if p in deltas:
                    return deltas[p]
                p = parent_of.get(p)
            return None
        inherited = 0
        for name in list(target.keys()):
            if name in overrides:
                target[name] = Vector(overrides[name])
            else:
                d = inherited_delta(name)
                if d is not None:
                    target[name] = target[name] + d
                    inherited += 1
        print(f'rig_basemesh --pack: landmark overrides {sorted(overrides.keys())} + {inherited} inherited from {os.path.basename(lm_file)}')
    # METACARPALS (Remy 2026-08-24, after the pro reference rig "Hand
    # animation test"): the pack skeleton has no palm bones — hand_X parents
    # every digit root directly, so bone heat splits palm flesh between the
    # wrist and the knuckles and the skeleton reads as a palm-less fan.
    # Synthesize one metacarpal per finger: head 35% along wrist->knuckle,
    # tail AT the knuckle, parented to the hand; the digit root reparents
    # onto it. Clips stay safe by construction: tracks bind by NAME, the new
    # bones carry no tracks and hold their rest locals, and the knuckle
    # landmarks do not move. The thumb already has its metacarpal
    # (thumb_01). Derived AFTER overrides, so lab drags on wrist or
    # knuckles carry the metacarpals with them.
    META = []
    for pside in ('l', 'r'):
        for fng in ('index', 'middle', 'ring', 'pinky'):
            mname = f'metacarp_{fng}_{pside}'
            target[mname] = lerp(target[f'hand_{pside}'], target[f'{fng}_01_{pside}'], 0.35)
            META.append((mname, f'hand_{pside}', f'{fng}_01_{pside}'))
    # The tail of a bone is the head of its chain child; leaves keep their
    # own direction at the mesh's scale. A bone with exactly ONE child chains
    # to it, whatever its name — the old name-prefix rule missed every
    # cross-name link (clavicle->upperarm, thigh->calf, calf->foot,
    # foot->ball, upperarm->lowerarm, lowerarm->hand), so those tails kept
    # the pack's scaled direction: stepped joints in the fit overlay and
    # bone-heat weights along wrong segments (Rig Bench find, 2026-08-23).
    # Multi-child bones pick the explicit chain: pelvis->spine, spine_03->
    # neck (never a clavicle), hand->middle finger.
    CHAIN_PICK = {
        'pelvis': 'spine_01',
        'spine_03': 'neck_01',
        'hand_l': 'middle_01_l',
        'hand_r': 'middle_01_r',
    }
    chain_child = {}
    for b in rig.data.bones:
        if b.name == 'root':
            continue  # the root keeps the pack's own direction: the clips' root track is authored against it
        if b.name in CHAIN_PICK:
            chain_child[b.name] = CHAIN_PICK[b.name]
        elif len(b.children) == 1:
            chain_child[b.name] = b.children[0].name
        elif len(b.children) > 1:
            raise RuntimeError(f'rig_basemesh --pack: bone {b.name} has {len(b.children)} children and no CHAIN_PICK entry')
    pack_h = max(to_gltf(rig.matrix_world @ b.tail_local).y for b in rig.data.bones)
    s_pack = H / max(pack_h, 1e-6)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = rig.data.edit_bones
    for mname, hand_name, digit_name in META:
        chain_child[mname] = digit_name
        nb = ebs.new(mname)
        nb.head = to_blender(target[mname])
        nb.tail = to_blender(target[digit_name])
        nb.parent = ebs[hand_name]
        ebs[digit_name].parent = nb
    for eb in ebs:
        old_dir = (eb.tail - eb.head).normalized()
        old_len = (eb.tail - eb.head).length
        old_z = eb.matrix.to_3x3().col[2].copy()
        roll = eb.roll
        head = to_blender(target[eb.name])
        child = chain_child.get(eb.name)
        if child and child in target:
            tail = to_blender(target[child])
            if (tail - head).length < 0.004 * H:
                tail = head + old_dir * max(old_len * s_pack, 0.004 * H)
        else:
            # a leaf: keep its direction, cap its reach — the pack's long
            # head_leaf drew a spike above the crown and fed bone heat a
            # segment outside the mesh
            tail = head + old_dir * min(max(old_len * s_pack, 0.004 * H), 0.06 * H)
        eb.head = head
        eb.tail = tail
        eb.roll = roll
        # NOTE 2026-08-24: a swing-aligned roll (rotate the original frame
        # onto the new direction) was tried here to fix scissored curls on
        # traced splayed digits — it broke the WHOLE hand orientation.
        # Rolls stay KEPT; the digit-axis problem is parked with the finger
        # trace (centerlineFit --fingers).
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f'rig_basemesh --pack: fitted {len(rig.data.bones)} pack bones (scale {s_pack:.3f}) armature matrix={[round(v, 3) for v in rig.matrix_world.to_translation()]} rot={[round(v, 2) for v in rig.matrix_world.to_euler()]}')
else:
    arm_data = bpy.data.armatures.new('BipedRig')
    rig = bpy.data.objects.new('BipedRig', arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    edit = {}
    for name in BONES:
        head, tail = J[name]
        length = max((tail - head).length, 0.004 * H)
        eb = arm_data.edit_bones.new(name)
        eb.head = (0.0, 0.0, 0.0)
        eb.tail = (0.0, length, 0.0)
        # rest frame = the sink's minimal rotation from +Y, converted to Blender space
        q = sink_quat(tail - head)
        m_gltf = q.to_matrix().to_4x4()
        m_gltf.translation = head
        C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # glTF -> Blender
        eb.matrix = C @ m_gltf @ C.inverted()
        p = PARENT.get(name)
        if p:
            if p not in edit:
                raise RuntimeError(f'rig_basemesh: parent {p} of {name} not built yet')
            eb.parent = edit[p]
            eb.use_connect = False
        edit[name] = eb
    bpy.ops.object.mode_set(mode='OBJECT')

# rods for the orphan step and the proof: every bone's head → tail, Blender space
def bone_rods():
    if PACK:
        return [(b.name, rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones]
    return [(name, to_blender(J[name][0]), to_blender(J[name][1])) for name in BONES]

# ---------------------------------------------------------------- bone heat
heat_target = proxy if proxy else body
bpy.ops.object.select_all(action='DESELECT')
heat_target.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
# background mode has no window context; hand the operator one explicitly
with bpy.context.temp_override(object=rig, active_object=rig, selected_objects=[heat_target, rig], selected_editable_objects=[heat_target, rig]):
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
if not [m for m in heat_target.modifiers if m.type == 'ARMATURE']:
    raise RuntimeError('rig_basemesh: ARMATURE_AUTO did not bind the heat target')
if proxy:
    proxy_orphans = sum(1 for v in proxy.data.vertices if not v.groups)
    if proxy_orphans > 0.05 * len(proxy.data.vertices):
        raise RuntimeError(f'rig_basemesh: bone heat left {proxy_orphans} of {len(proxy.data.vertices)} proxy vertices unweighted')
    # weights proxy -> sculpt by nearest face, then the sculpt binds to the
    # same armature through its own modifier
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    for name in BONES:
        if name not in body.vertex_groups:
            body.vertex_groups.new(name=name)
    dt = body.modifiers.new('heatTransfer', 'DATA_TRANSFER')
    dt.object = proxy
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.modifier_apply(modifier=dt.name)
    arm_mod = body.modifiers.new('Armature', 'ARMATURE')
    arm_mod.object = rig
    body.parent = rig
    print(f'rig_basemesh: transferred proxy weights to the sculpt ({proxy_orphans} proxy orphans)')
unweighted = [v for v in body.data.vertices if not v.groups]
if unweighted:
    # Detached shells (the stylized kit's eyes, lids, teeth) sit off the
    # heat field and come back unweighted. Bind each orphan rigidly to the
    # nearest bone segment — a named, counted step, not a silent default.
    if len(unweighted) > 0.4 * len(body.data.vertices):
        raise RuntimeError(f'rig_basemesh: bone heat left {len(unweighted)} of {len(body.data.vertices)} vertices unweighted — the solve failed, not a few shells')
    segs = bone_rods()

    def seg_dist(p, a, b):
        ab = b - a
        t = 0.0 if ab.length_squared < 1e-12 else max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        return (p - (a + ab * t)).length

    groups = {g.name: g for g in body.vertex_groups}
    for v in unweighted:
        p = body.matrix_world @ v.co
        name = min(segs, key=lambda s: seg_dist(p, s[1], s[2]))[0]
        if name not in groups:
            groups[name] = body.vertex_groups.new(name=name)
        groups[name].add([v.index], 1.0, 'REPLACE')
    print(f'rig_basemesh: {len(unweighted)} orphan vertices bound to their nearest bone')

if PACK:
    # Midline chest flesh must never follow a clavicle. Bone heat lets the
    # chest-top -> shoulder clavicle grab near-midline vertices (the Rig
    # Bench gate's torso-ownership failures on stylized A and B), and a
    # shoulder shrug then drags the sternum. Move clavicle weight into
    # spine_03 near the midline; the outer chest keeps its clavicle share.
    spine3 = body.vertex_groups.get('spine_03')
    if spine3 is None:
        raise RuntimeError('rig_basemesh --pack: no spine_03 vertex group')
    clav_groups = [body.vertex_groups[n] for n in ('clavicle_l', 'clavicle_r') if n in body.vertex_groups]
    clav_idx = {g.index for g in clav_groups}
    moved = 0
    for v in body.data.vertices:
        g = to_gltf(v.co)
        yf = (g.y - y_min) / H
        if yf < 0.56 or yf > 0.88 or abs(g.x - cx) > 0.15 * H:
            continue
        w = sum(e.weight for e in v.groups if e.group in clav_idx)
        if w <= 0.0:
            continue
        spine3.add([v.index], w, 'ADD')
        for cg in clav_groups:
            cg.remove([v.index])
        moved += 1
    print(f'rig_basemesh --pack: moved clavicle weight to spine_03 on {moved} midline chest vertices')

# ---------------------------------------------------------------- proof for Remy
# 1. the .blend, so the rig can be opened in Blender and inspected by hand
# 2. a Workbench render: body at half alpha, every bone as a red rod
import os
DIAG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(SPEC_PATH))), '..', '.agent', 'scratch', 'part-quality', 'blender')
os.makedirs(DIAG, exist_ok=True)
model_id = os.path.splitext(os.path.basename(OUT_GLB))[0].replace('.rigged', '')
if proxy:
    bpy.data.objects.remove(proxy, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DIAG, f'{model_id}.blend'))

rig.hide_render = False
proof = []
for name, hb, tb in bone_rods():
    length = max((tb - hb).length, 0.004 * H)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.006 * H, depth=length)
    rod = bpy.context.active_object
    rod.name = f'proof:{name}'
    direction = (tb - hb).normalized()
    rod.rotation_mode = 'QUATERNION'
    rod.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
    rod.location = (hb + tb) * 0.5
    rod.color = (0.95, 0.12, 0.1, 1.0)
    proof.append(rod)
body.color = (0.75, 0.75, 0.78, 0.45)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'OBJECT'
scene.display.shading.show_xray = True
scene.display.shading.xray_alpha = 0.45
scene.render.resolution_x = 1100
scene.render.resolution_y = 900
scene.render.film_transparent = False
cam_data = bpy.data.cameras.new('proofCam')
cam = bpy.data.objects.new('proofCam', cam_data)
scene.collection.objects.link(cam)
center = to_blender(Vector((0, y_min + 0.5 * H, 0)))
cam.location = center + Vector((1.1 * H, -2.2 * H, 0.25 * H))
cam.rotation_mode = 'QUATERNION'
cam.rotation_quaternion = (center - cam.location).to_track_quat('-Z', 'Y')
cam_data.lens = 50
scene.camera = cam
scene.render.filepath = os.path.join(DIAG, f'{model_id}.png')
bpy.ops.render.render(write_still=True)
for rod in proof:
    bpy.data.objects.remove(rod, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)
print(f'rig_basemesh: proof {scene.render.filepath} and {model_id}.blend')

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format='GLB',
    use_selection=True,
    export_skins=True,
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_materials='NONE',
)
print(f'rig_basemesh: wrote {OUT_GLB} bones={len(rig.data.bones)} verts={len(body.data.vertices)} reach={reach_x / H:.3f}h shoulderY={(shoulder_y - y_min) / H:.3f}h forward={forward:+.0f}')
