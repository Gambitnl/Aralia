"""Build editable, reference-inspired fantasy characters in Blender.

Run with Blender --background --python this_file -- --workspace <Aralia root>.
MPFB source and CC0 MakeHuman assets are downloaded into ignored scratch first.
The anatomy, fitted eyes and hair come from MakeHuman; armor is authored here.
This is a visual reconstruction, not an extraction of Baldur's Gate 3 assets.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import addon_utils
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

parser = argparse.ArgumentParser()
parser.add_argument('--workspace', default=str(Path(__file__).resolve().parents[2]))
parser.add_argument('--inspect', action='store_true')
parser.add_argument('--variant', default='high-elf')
parser.add_argument('--skip-preview', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
ROOT = Path(args.workspace)
RECIPES = json.loads((ROOT / 'src/devtools/characterAtelier/races.json').read_text())
RECIPE = next((recipe for recipe in RECIPES if recipe['id']==args.variant), None)
if RECIPE is None:
    raise ValueError('Unknown race: '+args.variant)
SCRATCH = ROOT / '.agent/scratch/bg3-reference'
ASSETS = SCRATCH / 'makehuman-assets'
OUTPUT = ROOT / 'public/assets/character-atelier'
OUTPUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(SCRATCH / 'mpfb-source/mpfb2-master/src'))
# A source checkout is not a Blender extension package. Keep all its preferences
# inside scratch for this process, leaving the user's installed Blender intact.
original_extension_path = bpy.utils.extension_path_user
bpy.utils.extension_path_user = lambda package, **kw: str(SCRATCH / 'mpfb-user') if package == 'mpfb' else original_extension_path(package, **kw)
addon_utils.enable('mpfb', default_set=True)
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService
from mpfb.services.exportservice import ExportService
from mpfb.services.objectservice import ObjectService

def asset(relative, human, kind):
    return HumanService.add_mhclo_asset(str(ASSETS / relative), human, asset_type=kind, material_type='GAMEENGINE', subdiv_levels=1)

def material(name, color, metallic=0, roughness=.6):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    # Pack a small, repeatable surface-normal texture into the GLB. Blender
    # procedural nodes alone are not portable to a web renderer, so derive a
    # normal image for woven cloth, pebbled leather and interlocking mail.
    size=1024 if 'Species skin' in name else 256
    y,x=np.mgrid[0:size,0:size]/size
    rng=np.random.default_rng(42)
    if 'Mail' in name:
        px=(x*4)%1-.5; py=(y*4)%1-.5
        height=np.exp(-((np.sqrt(px*px+(py*.85)**2)-.31)/.055)**2)*.55
    elif 'Species skin' in name:
        warped_y=y*64+.10*np.sin(x*math.tau*11)
        rows=np.floor(warped_y)
        warped_x=x*80+(rows%2)*.5+.10*np.sin(y*math.tau*17)
        sx=warped_x%1-.5
        sy=warped_y%1-.5
        distance=(abs(sx)*1.7+abs(sy)*1.4)
        plate=np.clip((1-distance)/.20,0,1)
        height=plate*(.25+.18*(sy+.5))+rng.random((size,size))*.012
        # Pigment varies inside each scale, while dark seams and a restrained
        # sheen give the same portable material depth in Blender and WebGL.
        cells=np.sin(np.floor(warped_x)*17.13+rows*41.7)*.5+.5
        pigment=.48+.23*plate+.12*cells+.07*np.sin(x*math.tau*4)*np.cos(y*math.tau*3)
        rgba=np.dstack((pigment*.82,pigment*.69,pigment*.49,np.ones_like(x))).astype(np.float32)
        albedo=bpy.data.images.new(name+' scale pigment',width=size,height=size,alpha=True)
        albedo.pixels.foreach_set(rgba.ravel());albedo.pack()
        color_texture=mat.node_tree.nodes.new('ShaderNodeTexImage');color_texture.image=albedo
        mat.node_tree.links.new(color_texture.outputs['Color'],bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value=.64
    elif 'Tabard' in name:
        height=(np.sin(x*math.tau*32)*np.sin(y*math.tau*32))*.07+rng.random((size,size))*.025
    else:
        height=rng.random((size,size))*.10+np.sin(x*math.tau*3)*np.sin(y*math.tau*5)*.08
    dy,dx=np.gradient(height)
    relief=4 if 'Species skin' in name else 3
    normal=np.dstack((-dx*relief,-dy*relief,np.ones_like(dx)))
    normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    pixels=np.dstack((normal*.5+.5,np.ones_like(dx))).astype(np.float32)
    image=bpy.data.images.new(name+' surface',width=size,height=size,alpha=True)
    image.colorspace_settings.name='Non-Color'
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
    normal_node=mat.node_tree.nodes.new('ShaderNodeNormalMap')
    normal_node.inputs['Strength'].default_value=.65
    mat.node_tree.links.new(texture.outputs['Color'],normal_node.inputs['Color'])
    mat.node_tree.links.new(normal_node.outputs['Normal'],bsdf.inputs['Normal'])
    return mat

def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def create_base(female=False, elf=True):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    macros = TargetService.get_default_macro_info_dict()
    macros.update(gender=0 if female else 1, age=.37 if female else .48, muscle=.7, weight=.47, height=.54, proportions=.65)
    macros['race'] = dict(caucasian=1, asian=0, african=0)
    human = HumanService.create_human(macro_detail_dict=macros)
    human.name = 'Anatomy'
    if elf:
        targets = SCRATCH / 'mpfb-source/mpfb2-master/src/mpfb/data/targets'
        for target in targets.glob('ears/*point*.gz'):
            TargetService.load_target(human, str(target), weight=.65)
    # Facial targets are applied before fitting the skeleton, eyes and hair.
    targets = SCRATCH / 'mpfb-source/mpfb2-master/src/mpfb/data/targets'
    for target, weight in RECIPE.get('targets', {}).items():
        path = targets / (target+'.target.gz')
        if not path.exists():
            raise FileNotFoundError(path)
        TargetService.load_target(human, str(path), weight=weight)
    skin = 'young_caucasian_female' if female else 'young_caucasian_male'
    HumanService.set_character_skin(str(ASSETS / f'skins/{skin}/{skin}.mhmat'), human, skin_type='GAMEENGINE')
    rig = HumanService.add_builtin_rig(human, 'game_engine')
    asset('eyes/high-poly/high-poly.mhclo', human, 'Eyes')
    asset('eyebrows/eyebrow001/eyebrow001.mhclo', human, 'Eyebrows')
    asset('eyelashes/eyelashes01/eyelashes01.mhclo', human, 'Eyelashes')
    asset('teeth/teeth_base/teeth_base.mhclo', human, 'Teeth')
    hair_style = RECIPE['hair']
    hair = asset(f'hair/{hair_style}/{hair_style}.mhclo', human, 'Hair') if hair_style else None
    for mat in hair.data.materials if hair else []:
        mat.name = 'Hair'
        if mat.use_nodes:
            # Keep the strand alpha and texture detail, but neutralize the
            # baked brown dye so the browser's hair-color swatches can produce
            # pale blond and silver as well as dark colors.
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image and node.image.colorspace_settings.name=='sRGB':
                    strand_image=node.image.copy()
                    values=np.array(strand_image.pixels[:],dtype=np.float32).reshape(-1,4)
                    luminance=values[:,:3].mean(axis=1)
                    values[:,:3]=(np.clip(luminance*1.8+.28,.12,.95))[:,None]
                    strand_image.pixels.foreach_set(values.ravel())
                    strand_image.pack()
                    node.image=strand_image
    if not female:
        targets = SCRATCH / 'mpfb-source/mpfb2-master/src/mpfb/data/targets'
        for target, value in [('chin/chin-width-incr.target.gz', .25), ('chin/chin-prominent-incr.target.gz', .18)]:
            TargetService.load_target(human, str(targets / target), weight=value)
    # These surfaces are opaque. MakeHuman's generic game material also links
    # their texture alpha, which makes WebGL draw the teeth through the face.
    for obj in [human]+list(rig.children_recursive):
        if obj.type!='MESH':
            continue
        for mat in obj.data.materials:
            if mat and mat.use_nodes and any(token in mat.name for token in ['.body','.teeth_base']):
                bsdf=next((node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED'),None)
                if bsdf:
                    for link in list(bsdf.inputs['Alpha'].links):
                        mat.node_tree.links.remove(link)
                    bsdf.inputs['Alpha'].default_value=1
    return human, rig

def mesh_object(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv=mesh.uv_layers.new(name='Garment weave')
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            coordinate=mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv=(math.atan2(coordinate.y,coordinate.x)/math.tau*8,coordinate.z*8)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj

def attach(obj, rig, bone='spine_03'):
    # Armor follows the same skeleton as the anatomical mesh, so the GLB stays
    # editable and the idle animation does not leave clothing behind.
    obj.parent = rig
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    modifier = obj.modifiers.new('Follow character', 'ARMATURE')
    modifier.object = rig
    return obj

def tube(name, points, radius, mat, rig, bone='spine_03', cyclic=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return attach(bpy.context.object, rig, bone)

def shell(name, human, predicate, mat, rig, offset=.006):
    # Cut a fitted garment from the evaluated body surface. This retains the
    # real shoulder, elbow and ankle contours rather than using primitive limbs.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(human.evaluated_get(depsgraph))
    vertices, faces, remap = [], [], {}
    for polygon in mesh.polygons:
        if not predicate(polygon.center / GARMENT_HEIGHT):
            continue
        face = []
        for index in polygon.vertices:
            if index not in remap:
                vertex = mesh.vertices[index]
                remap[index] = len(vertices)
                vertices.append(tuple(vertex.co + vertex.normal * offset))
            face.append(remap[index])
        faces.append(face)
    obj = mesh_object(name, vertices, faces, mat)
    # Face selection leaves stair-step cuffs. Relax only the open border so the
    # fitted interior retains its body clearance while the hem becomes sewn.
    import bmesh
    boundary=bmesh.new();boundary.from_mesh(obj.data)
    border=[v for v in boundary.verts if any(edge.is_boundary for edge in v.link_edges)]
    for _ in range(5):
        positions={v:sum((edge.other_vert(v).co for edge in v.link_edges if edge.is_boundary),Vector())/sum(edge.is_boundary for edge in v.link_edges) for v in border}
        for vertex,position in positions.items(): vertex.co=vertex.co.lerp(position,.55)
    boundary.to_mesh(obj.data);boundary.free()
    if name=='Chain sleeves':
        for loop in obj.data.uv_layers.active.data:
            loop.uv *= 2
    obj['fitted_surface'] = True
    # Transfer weights from the original mesh to the fitted garment.
    for group in human.vertex_groups:
        obj.vertex_groups.new(name=group.name)
    transfer = obj.modifiers.new('Fit garment weights', 'DATA_TRANSFER')
    transfer.object = human
    transfer.use_vert_data = True
    transfer.data_types_verts = {'VGROUP_WEIGHTS'}
    transfer.vert_mapping = 'POLYINTERP_NEAREST'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    obj.parent = rig
    arm = obj.modifiers.new('Follow character', 'ARMATURE')
    arm.object = rig
    subdiv = obj.modifiers.new('Tailored surface', 'SUBSURF')
    subdiv.levels = 1
    hem=obj.modifiers.new('Finished garment edge','SOLIDIFY');hem.thickness=.002
    bpy.data.meshes.remove(mesh)
    return obj

def outfit(human, rig, druid=False):
    global GARMENT_HEIGHT
    GARMENT_HEIGHT = human.dimensions.z / 1.617683
    existing = set(bpy.data.objects)
    shoes=asset('clothes/shoes02/shoes02.mhclo',human,'Clothes')
    green = material('Tabard green', (.018,.12,.085), 0, .86)
    gold_cloth = material('Tabard gold', (.32,.255,.09), 0, .84)
    leather = material('Oxblood leather', (.12,.035,.023), 0, .52)
    metal = material('Antique brass', (.42,.29,.11), .72, .32)
    mail = material('Mail steel', (.15,.17,.16), .6, .65)
    dark = material('Boot leather', (.047,.027,.021), 0, .74)
    shell('Chain sleeves', human, lambda p: 1.04<p.z<1.34 and abs(p.x)>.175, mail, rig, .012)
    shell('Shoulder underlay', human, lambda p: 1.27<p.z<1.37 and abs(p.x)<.24, mail, rig, .008)
    shell('Leather vambraces', human, lambda p: 1.00<p.z<1.15 and .29<abs(p.x)<.43, leather, rig, .018)
    shell('Riding trousers', human, lambda p: .30<p.z<.88 and abs(p.x)<.23, dark, rig, .006)
    shell('Folded boots', human, lambda p: .09<p.z<.34 and abs(p.x)<.23, leather, rig, .016)
    shoes.data.materials.clear()
    shoes.data.materials.append(leather)
    # The split, alternating tabard panels are the dominant paladin silhouette
    # in the reference. Radial pleats add real geometry and moving highlights.
    n = 96
    levels = [(1.375,.085,.10),(1.335,.19,.14),(1.29,.225,.18),(1.20,.218,.201),(1.12,.19,.19),(1.04,.175,.18),(.96,.18,.174),(.90,.199,.174),(.83,.22,.18),(.72,.24,.183),(.60,.26,.186),(.49,.28,.193)]
    verts=[]
    for row,(z,rx,ry) in enumerate(levels):
        for i in range(n):
            a=2*math.pi*i/n
            pleat = .009*math.cos(a*12)*max(0,(1.04-z)/.55)
            verts.append(((rx+pleat)*math.cos(a), .016+(ry+pleat)*math.sin(a), z+.012*math.cos(a*16) if row==len(levels)-1 else z))
    faces=[]
    for row in range(len(levels)-1):
        for i in range(n):
            if row>9 and i%8==0:
                continue
            faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    tabard=mesh_object('Embroidered split tabard',verts,faces,green)
    tabard.data.materials.append(gold_cloth)
    for face in tabard.data.polygons:
        face.material_index = int(face.center.x>0) if not druid else 0
    texture_path=OUTPUT / 'tabard-albedo.png'
    if texture_path.exists() and not druid:
        painting=tabard.data.uv_layers.new(name='Tabard painting')
        for polygon in tabard.data.polygons:
            for loop_index in polygon.loop_indices:
                vertex_index=tabard.data.loops[loop_index].vertex_index
                row=vertex_index//n
                coordinate=tabard.data.vertices[vertex_index].co
                painting.data[loop_index].uv=(.5+coordinate.x/(2*levels[row][1]),(coordinate.z-.49)/(1.375-.49))
        painted_image=bpy.data.images.load(str(texture_path),check_existing=True)
        for mat in [green,gold_cloth]:
            texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=painted_image
            uv_node=mat.node_tree.nodes.new('ShaderNodeUVMap');uv_node.uv_map='Tabard painting'
            mat.node_tree.links.new(uv_node.outputs['UV'],texture.inputs['Vector'])
            mat.node_tree.links.new(texture.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    attach(tabard,rig)
    # Cloth bends through the waist instead of moving as one rigid chest shell.
    tabard.vertex_groups.clear()
    for group in human.vertex_groups: tabard.vertex_groups.new(name=group.name)
    transfer=tabard.modifiers.new('Cloth follows anatomy','DATA_TRANSFER')
    transfer.object=human;transfer.use_vert_data=True
    transfer.data_types_verts={'VGROUP_WEIGHTS'};transfer.vert_mapping='POLYINTERP_NEAREST'
    bpy.context.view_layer.objects.active=tabard
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    smooth=tabard.modifiers.new('Soft cloth folds','SUBSURF');smooth.levels=2
    lining=tabard.modifiers.new('Sewn cloth thickness','SOLIDIFY');lining.thickness=.003
    for idx in range(0,n,12):
        tube('Tabard piping',[verts[row*n+idx] for row in range(len(levels))],.0021,metal,rig)
    tube('Collar',[(.077*math.cos(i*math.tau/48),.016+.087*math.sin(i*math.tau/48),1.375) for i in range(48)],.009,leather,rig,cyclic=True)
    belt_points=[(.201*math.cos(i*math.tau/64),.016+.187*math.sin(i*math.tau/64),z) for z in [.925,.965] for i in range(64)]
    belt_faces=[(i,(i+1)%64,(i+1)%64+64,i+64) for i in range(64)]
    belt=mesh_object('Wide leather belt',belt_points,belt_faces,leather)
    attach(belt,rig,'pelvis')
    thickness=belt.modifiers.new('Belt thickness','SOLIDIFY');thickness.thickness=.004
    for z in [.928,.962]:
        tube('Belt edge',[(.202*math.cos(i*math.tau/64),.016+.19*math.sin(i*math.tau/64),z) for i in range(64)],.003,leather,rig,'pelvis',True)
    # Buckle and embossed sun crest use mesh relief, visible at portrait zoom.
    ornaments=[('Belt clasp',(0,-.181,.945),.028,.008)]
    if druid:
        ornaments.append(('Sun medallion',(0,-.184,1.23),.035,.012))
    for name,loc,radius,depth in ornaments:
        bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=radius,depth=depth,location=loc,rotation=(math.pi/2,0,0))
        obj=bpy.context.object
        obj.name=name
        obj.data.materials.append(metal)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        attach(obj,rig,'pelvis' if 'Belt' in name else 'spine_03')
        tube(name+' rim',[(loc[0]+radius*math.cos(i*math.tau/48),loc[1]-.008,loc[2]+radius*math.sin(i*math.tau/48)) for i in range(48)],.0028,metal,rig,'pelvis' if 'Belt' in name else 'spine_03',True)
        for ray in range(12):
            angle=ray*math.tau/12
            tube(name+' relief',[(loc[0]+radius*r*math.cos(angle),loc[1]-.01,loc[2]+radius*r*math.sin(angle)) for r in [.3,.75]],.002,metal,rig,'pelvis' if 'Belt' in name else 'spine_03')
    for side in [-1,1]:
        # Overlapping leaf plates follow the shoulder slope.
        for tier in range(3):
            x=side*(.19+tier*.027)
            z=1.345-tier*.025
            points=[(x-side*.03,-.10,z),(x+side*.033,-.095,z-.018),(x+side*.055,-.035,z-.04),(x+side*.028,.06,z-.018),(x-side*.025,.07,z)]
            plate=mesh_object('Leaf shoulder plate',points,[(0,1,2,3,4)],leather if druid else metal)
            solid=plate.modifiers.new('Plate thickness','SOLIDIFY'); solid.thickness=.006
            attach(plate,rig,'upperarm_l' if side>0 else 'upperarm_r')
            tube('Shoulder filigree',points,.0025,metal,rig,'upperarm_l' if side>0 else 'upperarm_r',True)
    # Fine vine embroidery down the chest and skirt adds recognisable detail.
    for side in [-1,1]:
        for section in range(4):
            z=.55+section*.145
            y=-.169 if z<.84 else -.146
            points=[(side*(.09+.014*math.sin(t*.16)),y,z+t*.002) for t in range(44)]
            tube('Vine embroidery',points,.0015,metal,rig)
            for j in range(3):
                stemz=z+j*.025
                tube('Leaf embroidery',[(side*.09,y,stemz),(side*.12,y-.002,stemz+.015),(side*.10,y,stemz+.027)],.0012,metal,rig)
    # The two body bases have different heights. Fit every authored trim and
    # tabard point to the actual model rather than leaving a male-size collar
    # around a shorter character's face. Surface-cut garments already fit.
    for obj in set(bpy.data.objects)-existing:
        if obj.type=='MESH' and not obj.get('fitted_surface') and obj!=shoes:
            for vertex in obj.data.vertices:
                if args.variant in ['wood-elf','half-elf']:
                    # Shorter bodies do not have proportionally narrower hips.
                    # Give the skirt enough ease over the fitted trousers.
                    ease=1+.22*min(1,max(0,(.98-vertex.co.z)/.25))
                    vertex.co.x*=ease
                    vertex.co.y*=ease
                vertex.co.z *= GARMENT_HEIGHT
                vertex.co.x *= GARMENT_HEIGHT
                vertex.co.y *= GARMENT_HEIGHT
    # Lift plates and their matching trim onto the actual shoulder surface.
    # Fixed coordinates previously buried the plate faces under the lining.
    evaluated=bpy.data.meshes.new_from_object(human.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    surface=BVHTree.FromPolygons([v.co for v in evaluated.vertices],[list(p.vertices) for p in evaluated.polygons])
    for obj in set(bpy.data.objects)-existing:
        if obj.type=='MESH' and obj.name.startswith(('Leaf shoulder plate','Shoulder filigree')):
            if obj.name.startswith('Leaf'):
                # A five-corner plate still cuts through a curved shoulder
                # between its corners; add surface points before fitting it.
                import bmesh
                patch=bmesh.new();patch.from_mesh(obj.data)
                bmesh.ops.triangulate(patch,faces=list(patch.faces))
                bmesh.ops.subdivide_edges(patch,edges=list(patch.edges),cuts=4,use_grid_fill=True)
                patch.to_mesh(obj.data);patch.free()
            for vertex in obj.data.vertices:
                point,normal,_,_=surface.find_nearest(vertex.co)
                if point is not None: vertex.co=point+normal*(.020 if obj.name.startswith('Leaf') else .022)
    bpy.data.meshes.remove(evaluated)

def race_details(human, rig):
    """Authored species anatomy follows the head/pelvis bones, including idle motion."""
    detail = RECIPE.get('detail')
    if not detail:
        return
    # dimensions can still cache MPFB's pre-fit bounding box after asset import.
    # Read the evaluated anatomy, otherwise beard roots land inside the collar.
    bpy.context.view_layer.update()
    evaluated=bpy.data.meshes.new_from_object(human.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    h=max(vertex.co.z for vertex in evaluated.vertices)
    bpy.data.meshes.remove(evaluated)
    existing=set(bpy.data.objects)
    horn = material('Horn keratin', (.12,.085,.066), 0, .48)
    ivory = material('Tusk ivory', (.78,.69,.48), 0, .4)
    skin = material('Species skin', (.53,.36,.22), 0, .72)
    hair = material('Hair beard', (.6,.52,.43), 0, .88)
    gold = material('Celestial gold', (.72,.48,.12), .65, .3)
    stone = material('Stone markings', (.075,.10,.14), 0, .8)

    def ellipsoid(name, center, radii, mat, bone='head'):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=Vector(center)*h)
        obj=bpy.context.object;obj.name=name
        obj.scale=Vector(radii)*h
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        obj.data.materials.append(mat)
        for face in obj.data.polygons: face.use_smooth=True
        return attach(obj,rig,bone)

    def taper(name, points, radii, mat, bone='head'):
        # Interpolate the centerline so horns and tails curve continuously,
        # retaining a tapered tip instead of a sequence of straight elbows.
        original=[Vector(p) for p in points];smooth=[];widths=[]
        for j in range(len(points)-1):
            p0=original[max(0,j-1)];p1=original[j];p2=original[j+1];p3=original[min(len(points)-1,j+2)]
            for k in range(5):
                t=k/5
                smooth.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
                widths.append(radii[j]*(1-t)+radii[j+1]*t)
        points=smooth+[original[-1]];radii=widths+[radii[-1]]
        vertices=[]; faces=[]; sides=16
        for j,point in enumerate(points):
            tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
            tangent.normalize()
            across=tangent.cross(Vector((0,1,0)))
            if across.length<.01: across=tangent.cross(Vector((1,0,0)))
            across.normalize(); around=tangent.cross(across).normalized()
            for i in range(sides):
                angle=i*math.tau/sides
                vertices.append(tuple((Vector(point)+radii[j]*(math.cos(angle)*across+math.sin(angle)*around))*h))
        for j in range(len(points)-1):
            for i in range(sides):
                a=j*sides+i;b=j*sides+(i+1)%sides
                faces.append((a,b,b+sides,a+sides))
        faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))])
        return attach(mesh_object(name,vertices,faces,mat),rig,bone)

    if detail in ['beard','gnome-beard']:
        # Layered tapered locks make a beard silhouette with individual strands.
        for i in range(-5,6):
            x=i*.006
            length=.12 if detail=='beard' else .07
            taper('Braided beard lock',[(x,-.066,.896),(x*.95,-.09,.862),(x*.65,-.083,.896-length),(x*.5,-.077,.88-length)], [.009,.012,.008,.0005],hair)
        for side in [-1,1]:
            taper('Moustache',[(0,-.084,.911),(side*.017,-.089,.904),(side*.033,-.079,.894)],[.004,.005,.001],hair)
        if detail=='beard':
            for x in [-.017,.017]:
                ellipsoid('Beard clasp',(x,-.085,.79),(.009,.009,.008),gold)
    if detail in ['infernal','dragon']:
        for side in [-1,1]:
            if detail=='dragon':
                taper('Swept horn',[(side*.039,.005,.981),(side*.058,.024,1.009),(side*.073,.054,1.044),(side*.070,.079,1.066)],[.016,.013,.007,.0003],horn)
            else:
                taper('Swept horn',[(side*.038,.004,.974),(side*.058,.025,1.025),(side*.069,.06,1.065),(side*.06,.085,1.065),(side*.043,.094,1.04)],[.019,.017,.012,.006,.0005],horn)
            for ridge in range(5):
                z=.983+ridge*.012
                ellipsoid('Horn root ridge',(side*(.04+ridge*.004),.012+ridge*.006,z),(.02-ridge*.001,.014,.004),horn)
        if detail=='infernal':
            taper('Infernal tail',[(0,.085,.48),(.06,.13,.35),(.15,.18,.20),(.24,.16,.18),(.29,.12,.27),(.27,.10,.35)],[.022,.02,.015,.012,.008,.001],skin,'pelvis')
            taper('Tail spade',[(.27,.10,.32),(.27,.10,.36),(.27,.10,.395)],[.007,.027,.0005],skin,'pelvis')
    if detail=='tusks':
        for side in [-1,1]:
            taper('Lower canine tusk',[(side*.018,-.078,.892),(side*.021,-.096,.909),(side*.024,-.092,.933)],[.007,.004,.0003],ivory)
    if detail=='dragon':
        # A separate reptilian skull covers the human facial scaffold. Its eyes,
        # muzzle, nostrils, cheek plates and crest remain real skinned geometry.
        ellipsoid('Draconic skull',(0,-.002,.942),(.058,.065,.068),skin)
        for mat_index,mat in enumerate(human.data.materials):
            if mat and '.body' in mat.name: human.data.materials[mat_index]=skin
        # Retain the export verifier's opaque body-material contract.
        skin.name='Species skin.body'
        ellipsoid('Upper scaled muzzle',(0,-.075,.924),(.039,.072,.019),skin)
        ellipsoid('Lower scaled jaw',(0,-.075,.899),(.037,.065,.013),skin)
        dark=material('Reptile pupil',(.008,.006,.003),0,.24)
        amber=material('Amber iris',(.9,.38,.025),.2,.24)
        for side in [-1,1]:
            ellipsoid('Reptile eye',(side*.043,-.057,.952),(.007,.006,.0037),amber)
            ellipsoid('Vertical pupil',(side*.043,-.063,.953),(.0009,.001,.003),dark)
            ellipsoid('Nostril',(side*.021,-.140,.931),(.003,.002,.0016),dark)
            taper('Brow ridge',[(side*.021,-.053,.962),(side*.045,-.06,.972),(side*.061,-.04,.963)],[.008,.01,.003],skin)
            for j in range(4):
                taper('Cheek spike',[(side*.05,.012+j*.004,.92+j*.014),(side*(.074+j*.004),.046,.929+j*.015)],[.011,.0004],horn)
        # Fuse the skull, muzzle and brows into continuous skin. The old rows
        # of separate beads looked attached to the face rather than grown scales.
        parts=[obj for obj in set(bpy.data.objects)-existing if obj.type=='MESH' and
               any(obj.name.startswith(prefix) for prefix in ['Draconic skull','Upper scaled muzzle','Brow ridge'])]
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:
            obj.modifiers.clear();obj.select_set(True)
        bpy.context.view_layer.objects.active=next(obj for obj in parts if obj.name.startswith('Draconic skull'))
        bpy.ops.object.join();skull=bpy.context.object
        remesh=skull.modifiers.new('Continuous reptilian skin','REMESH')
        remesh.mode='VOXEL';remesh.voxel_size=h*.0012;remesh.use_smooth_shade=True
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        soften=skull.modifiers.new('Blend muzzle into cheeks','SMOOTH');soften.factor=.8;soften.iterations=5
        bpy.ops.object.modifier_apply(modifier=soften.name)
        skull.vertex_groups.clear();attach(skull,rig,'head')
        uv=skull.data.uv_layers.new(name='Continuous scale field')
        for poly in skull.data.polygons:
            for loop_index in poly.loop_indices:
                co=skull.data.vertices[skull.data.loops[loop_index].vertex_index].co/h
                uv.data[loop_index].uv=(math.atan2(co.x,-co.y)/math.tau+.5,(co.z-.86)/.16)
        for z in [.968,.989,1.006]:
            taper('Crown spine',[(0,.017,z),(0,.032,z+.036)],[.012,.0003],horn)
    if detail=='celestial':
        for side in [-1,1]:
            for j in range(3):
                tube('Celestial cheek inlay',[(side*(.026+j*.006)*h,-.074*h,(.927-j*.005)*h),(side*(.029+j*.006)*h,-.072*h,(.916-j*.005)*h)],.0012,gold,rig,'head')
        ellipsoid('Forehead sun',(0,-.068,.972),(.006,.002,.008),gold)
    # Goliath markings are now a skin UV mask. Separate meshes, even projected
    # onto the face, create raised edges and specular patches that resemble tape.
    # MakeHuman faces sit forward of the head bone. Match their surface rather
    # than centering face attachments around the skeleton's sagittal origin.
    for obj in set(bpy.data.objects)-existing:
        if obj.type=='MESH' and obj.vertex_groups.get('head'):
            for vertex in obj.data.vertices: vertex.co.y-=.025*h
    if detail in ['stone','celestial']:
        # Markings lie against the skin, rather than reading as floating stones
        # or jewelry. Project their authored outlines onto the actual shaped face.
        evaluated=bpy.data.meshes.new_from_object(human.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        surface=BVHTree.FromPolygons([v.co for v in evaluated.vertices],[list(p.vertices) for p in evaluated.polygons])
        for obj in set(bpy.data.objects)-existing:
            if obj.type=='MESH' and obj.vertex_groups.get('head'):
                for vertex in obj.data.vertices:
                    position,normal,_,_=surface.find_nearest(vertex.co)
                    if position is not None: vertex.co=position+normal*.0008
        bpy.data.meshes.remove(evaluated)

def fit_race_proportions(root):
    """Deform meshes and rest bones together, so short races retain an intact rig.

    A piecewise height map shortens legs and torso without shrinking the head.
    Clothes receive the exact same map as the body to preserve their fitted seams.
    """
    width=RECIPE.get('width',1)
    legs=RECIPE.get('legs',1); torso=RECIPE.get('torso',1)
    if (width,legs,torso)==(1,1,1): return
    def mapped(co):
        x,y,z=co
        return Vector((x*width,y*width,min(z,.95)*legs+max(0,min(z,1.51)-.95)*torso+max(0,z-1.51)))
    for child in root.children_recursive:
        if child.type=='MESH':
            for vertex in child.data.vertices: vertex.co=mapped(vertex.co)
    bpy.context.view_layer.objects.active=root
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in root.data.edit_bones:
        bone.head=mapped(bone.head);bone.tail=mapped(bone.tail)
    bpy.ops.object.mode_set(mode='OBJECT')

def pose_and_export(human, rig, name):
    # Bring the neutral MakeHuman arms down to a relaxed selection-screen pose.
    for side, sign in [('l',1),('r',-1)]:
        bone=rig.pose.bones['upperarm_'+side]
        bone.rotation_mode='XYZ'
        bone.rotation_euler[1]=sign*math.radians(8)
        bone.rotation_euler[2]=sign*math.radians(-22)
        forearm=rig.pose.bones['lowerarm_'+side]
        forearm.rotation_mode='XYZ'
        forearm.rotation_euler[0]=math.radians(-12)
    bpy.context.scene.frame_end=120
    for frame,amount in [(1,0),(60,.009),(120,0)]:
        bone=rig.pose.bones['spine_03']
        bone.rotation_mode='XYZ'
        bone.rotation_euler[0]=amount
        bone.keyframe_insert(data_path='rotation_euler',frame=frame)
    if rig.animation_data and rig.animation_data.action:
        rig.animation_data.action.name='Quiet breathing'
    bpy.context.scene.frame_set(1)
    # Keep the full editable anatomical source in the blend, and remove helper
    # geometry only from the disposable export copy.
    bpy.ops.wm.save_as_mainfile(filepath=str(SCRATCH / f'{name}.blend'))
    export_root=ExportService.create_character_copy(human,name_suffix='_export')
    export_body=ObjectService.find_object_of_type_amongst_nearest_relatives(export_root,'Basemesh')
    for child in export_root.children_recursive:
        for modifier in child.modifiers:
            if modifier.type=='ARMATURE':
                modifier.object=export_root
    ExportService.bake_modifiers_remove_helpers(export_body,bake_masks=True,bake_subdiv=True,remove_helpers=True,also_proxy=True)
    # glTF with morph export disabled otherwise uses the unshaped neutral body.
    # Bake the active anatomical mix into each export mesh, retaining its weights.
    # The editable source above keeps all original MakeHuman shape keys.
    for child in export_root.children_recursive:
        if child.type=='MESH' and child.data.shape_keys:
            mixed=child.shape_key_add(name='Current anatomy',from_mix=True)
            coordinates=[vertex.co.copy() for vertex in mixed.data]
            child.shape_key_clear()
            for vertex,coordinate in zip(child.data.vertices,coordinates):
                vertex.co=coordinate
    if name=='goliath':
        sys.path.insert(0,str(Path(__file__).resolve().parent))
        from tattoo_mask import write_tattoo_mask
        write_tattoo_mask(export_body,OUTPUT / 'stone-sigil-mask.png')
    if name=='dragonborn':
        # Keep the editable human scaffold in the source blend, but remove its
        # face and eyes from the export so they cannot poke through reptile skin.
        import bmesh
        height=max(vertex.co.z for vertex in export_body.data.vertices)
        mesh=bmesh.new();mesh.from_mesh(export_body.data)
        bmesh.ops.delete(mesh,geom=[v for v in mesh.verts if v.co.z>height*.882],context='VERTS')
        mesh.to_mesh(export_body.data);mesh.free()
        for child in list(export_root.children_recursive):
            if child.type=='MESH' and any(token in child.name.lower() for token in ['high-poly','eyebrow','eyelash','teeth_base']):
                bpy.data.objects.remove(child,do_unlink=True)
        # Use one scale density on neck, jaw and skull rather than each part's
        # unrelated primitive/body UVs, which produced oversized neck diamonds.
        for child in export_root.children_recursive:
            if child.type!='MESH' or not any(mat and 'Species skin' in mat.name for mat in child.data.materials): continue
            uv=child.data.uv_layers.active or child.data.uv_layers.new(name='Scale field')
            for poly in child.data.polygons:
                for loop_index in poly.loop_indices:
                    co=child.data.vertices[child.data.loops[loop_index].vertex_index].co/height
                    uv.data[loop_index].uv=(math.atan2(co.x,-co.y)/math.tau+.5,(co.z-.86)/.16)
    fit_race_proportions(export_root)
    bpy.ops.object.select_all(action='DESELECT')
    export_root.select_set(True)
    for child in export_root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active=export_root
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_morph=False)
    sys.path.insert(0,str(Path(__file__).resolve().parent))
    from separate_plate_layers import separate_layers
    separate_layers(OUTPUT / f'{name}.glb')
    # Remove just the temporary copies before rendering the original model.
    bpy.ops.object.delete(use_global=False)

def render_preview(path):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.world.color = (.12, .12, .12)
    bpy.ops.object.camera_add(location=(2.5, -5.7, 2.4))
    camera = bpy.context.object
    look_at(camera, (0, 0, 1))
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.3
    scene.camera = camera
    for name, loc, energy, size, color in [('Key',(-3,-4,5),500,4,(1,.87,.72)),('Fill',(3,-2,3),250,3,(.75,.83,1)),('Rim',(1,2,3),600,3,(1,.93,.75))]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        light.data.color = color
        look_at(light, (0,0,1))
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)

human, rig = create_base(female=args.variant in ['wood-elf','half-elf'],elf=RECIPE.get('elf',args.variant in ['high-elf','wood-elf','half-elf']))
print('BONES', [(bone.name, tuple(round(v,3) for v in bone.head_local)) for bone in rig.data.bones])
print('BOUNDS', tuple(human.dimensions))
if args.inspect:
    bpy.ops.wm.save_as_mainfile(filepath=str(SCRATCH / 'base-study.blend'))
    render_preview(SCRATCH / 'base-study.png')
else:
    outfit(human,rig,druid=args.variant=='wood-elf')
    race_details(human,rig)
    pose_and_export(human,rig,args.variant)
    if not args.skip_preview:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        bpy.ops.import_scene.gltf(filepath=str(OUTPUT / f'{args.variant}.glb'))
        render_preview(SCRATCH / f'{args.variant}-preview.png')
