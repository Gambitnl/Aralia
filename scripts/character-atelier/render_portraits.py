"""Render the race picker's reusable portraits from the actual exported GLBs.

Run in Blender background mode after build_characters.py. The roster palette
matches the browser defaults. Proof renders stay in ignored scratch.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[2]
assets=root/'public/assets/character-atelier'
recipes=json.loads((root/'src/devtools/characterAtelier/races.json').read_text())
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def linear(hex_color):
    values=[int(hex_color[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)

for recipe in recipes:
    if requested and recipe['id'] not in requested: continue
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(assets/(recipe['id']+'.glb')))
    # The glTF importer creates a hidden Icosphere as a bone-display widget.
    # It is not character geometry and must not influence portrait bounds.
    meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH' and obj.find_armature() is not None]
    # glTF base-color factors can multiply a texture. Blender's imported node
    # graph exposes that multiply factor through an existing Mix node.
    for mat in {mat for obj in meshes for mat in obj.data.materials if mat}:
        color=None
        if mat.name.startswith('Hair'): color=linear(recipe['hairColor'])
        if '.body' in mat.name or 'Species skin' in mat.name: color=linear(recipe['skin'])
        if color:
            shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            color_input=shader.inputs['Base Color']
            if color_input.is_linked:
                source=color_input.links[0].from_socket
                mix=mat.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY'
                mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1)
                mat.node_tree.links.new(source,mix.inputs[1]);mat.node_tree.links.new(mix.outputs[0],color_input)
            else: color_input.default_value=(*color,1)
        if recipe['id']=='goliath' and '.body' in mat.name:
            # Match the default runtime ink while keeping the GLB's base skin
            # unpainted, so the creator can still turn tattoos off or recolor them.
            shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            base=shader.inputs['Base Color'];source=base.links[0].from_socket
            mask=mat.node_tree.nodes.new('ShaderNodeTexImage')
            mask.image=bpy.data.images.load(str(assets/'stone-sigil-mask.png'),check_existing=True)
            strength=mat.node_tree.nodes.new('ShaderNodeMath');strength.operation='MULTIPLY';strength.inputs[1].default_value=.78
            blend=mat.node_tree.nodes.new('ShaderNodeMixRGB');blend.blend_type='MULTIPLY';blend.inputs[2].default_value=(*linear('#28333d'),1)
            mat.node_tree.links.new(mask.outputs['Alpha'],strength.inputs[0]);mat.node_tree.links.new(strength.outputs[0],blend.inputs[0])
            mat.node_tree.links.new(source,blend.inputs[1]);mat.node_tree.links.new(blend.outputs[0],base)
    bpy.context.view_layer.update()
    points=[]
    graph=bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated=obj.evaluated_get(graph)
        mesh=evaluated.to_mesh()
        points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()
    bottom=min(p.z for p in points);top=max(p.z for p in points)
    face=bottom+(top-bottom)*recipe['faceHeight']/recipe['height']
    bpy.ops.object.camera_add(location=(0,-3,face+.035))
    camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,face)) - camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=.48
    scene=bpy.context.scene;scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.world.color=(.11,.13,.12)
    for location,energy,color in [((-2,-3,4),220,(1,.87,.73)),((2,-2,2),130,(.76,.85,1)),((0,2,3),300,(1,.92,.75))]:
        bpy.ops.object.light_add(type='AREA',location=location)
        light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=3;light.data.color=color
        light.rotation_euler=(Vector((0,0,face))-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=192;scene.render.resolution_y=224;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(assets/(recipe['id']+'-portrait.png'))
    bpy.ops.render.render(write_still=True)
    print('PORTRAIT',recipe['id'],flush=True)
