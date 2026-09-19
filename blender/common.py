"""Small deterministic bpy construction and rigid-animation toolkit."""

import math
from array import array
from pathlib import Path

import bpy
from mathutils import Vector

from palette import COLORS, linear

ROOT = Path(__file__).resolve().parents[1]


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    bpy.context.scene.frame_set(1)


def material(name):
    found = bpy.data.materials.get(name)
    if found:
        return found
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    rgba = (*linear(COLORS[name]), 0.3 if name == "glass" else 1)
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Roughness"].default_value = 0.78
    shader.inputs["Metallic"].default_value = 0.35 if name == "brass" else 0
    shader.inputs["Alpha"].default_value = rgba[3]
    mat.diffuse_color = rgba
    if name == "glass":
        mat.surface_render_method = "BLENDED"
    return mat


def empty(name, position=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.parent = parent
    return obj


def finish(obj, name, color, parent):
    obj.name = name
    obj.data.materials.append(material(color))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.parent = parent
    return obj


def box(name, pos, size, color, parent=None, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = size
    if bevel:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = obj.modifiers.new("soft_edges", "BEVEL")
        mod.width, mod.segments = bevel, 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, color, parent)


def ellipsoid(name, pos, size, color, parent=None, segments=12, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1,
                                       location=pos)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj, name, color, parent)


def cylinder(name, pos, radius, depth, color, parent=None, vertices=12, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                       location=pos)
    obj = bpy.context.object
    if rotation:
        obj.rotation_euler = rotation
    return finish(obj, name, color, parent)


def cone(name, pos, radius, top, depth, color, parent=None, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=top,
                                   depth=depth, location=pos)
    return finish(bpy.context.object, name, color, parent)


def ring(name, pos, radius, thickness, color, parent=None, half=False):
    count = 10 if half else 16
    points = []
    faces = []
    for i in range(count + 1):
        a = math.pi * i / count if half else math.tau * i / count
        for r in (radius - thickness, radius + thickness):
            points.append((pos[0] + math.cos(a) * r, pos[1],
                           pos[2] + math.sin(a) * r))
    for i in range(count):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material(color))
    obj.parent = parent
    return obj


def merge_children(parent):
    """One mesh per rigid part, retaining exact palette material slots."""
    children = [o for o in parent.children if o.type == "MESH"]
    if children:
        bpy.ops.object.select_all(action="DESELECT")
        for child in children:
            child.select_set(True)
        bpy.context.view_layer.objects.active = children[0]
        bpy.ops.object.join()
        children[0].name = parent.name + "_mesh"
    for child in parent.children:
        if child.type == "EMPTY":
            merge_children(child)


def clips(root, specifications):
    """Export same-named NLA tracks across rigid objects as one glTF clip."""
    scene = bpy.context.scene
    rest = {obj: (obj.location.copy(), obj.rotation_euler.copy())
            for obj in scene.objects}
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 49
    for name, channels in specifications.items():
        grouped = {}
        for obj, path, keys in channels:
            grouped.setdefault(obj, []).append((path, keys))
        for obj, object_channels in grouped.items():
            obj.animation_data_create()
            obj.animation_data.action = None
            for path, keys in object_channels:
                original = tuple(rest[obj][0 if path == "location" else 1])
                for frame, delta in keys:
                    value = tuple(original[i] + delta[i] for i in range(3))
                    if path == "location":
                        obj.location = value
                    else:
                        obj.rotation_euler = value
                    obj.keyframe_insert(data_path=path, frame=frame)
                if path == "location":
                    obj.location = original
                else:
                    obj.rotation_euler = original
            action = obj.animation_data.action
            action.name = root.name + "_" + name + "_" + obj.name
            track = obj.animation_data.nla_tracks.new()
            track.name = name
            strip = track.strips.new(name, 1, action)
            strip.action_frame_start, strip.action_frame_end = 1, 49
            obj.animation_data.action = None
    for obj in bpy.context.scene.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = True
    scene.frame_set(1)
    for obj, (location, rotation) in rest.items():
        obj.location, obj.rotation_euler = location, rotation
    bpy.context.view_layer.update()


def wave(amount, axis=0):
    def delta(value):
        return tuple(value if i == axis else 0 for i in range(3))
    return [(1, delta(0)), (13, delta(amount)), (25, delta(0)),
            (37, delta(-amount)), (49, delta(0))]


def bake_palette():
    mat = bpy.data.materials.new("palette")
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 0.78
    colors = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    colors.layer_name = "Color"
    mat.node_tree.links.new(colors.outputs["Color"], shader.inputs["Base Color"])
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        layer = mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
        glass = None
        indices = []
        for polygon in mesh.polygons:
            source = mesh.materials[polygon.material_index]
            transparent = source.name == "glass"
            if transparent:
                glass = source
            indices.append(1 if transparent else 0)
            rgba = (1, 1, 1, 1) if transparent else source.diffuse_color
            for loop in polygon.loop_indices:
                layer.data[loop].color = rgba
        mesh.materials.clear()
        mesh.materials.append(mat)
        if glass:
            mesh.materials.append(glass)
        for polygon, index in zip(mesh.polygons, indices):
            polygon.material_index = index


def export_asset(name, root):
    rest = {obj: (obj.location.copy(), obj.rotation_euler.copy(), obj.scale.copy())
            for obj in bpy.context.scene.objects}
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if name != "book":
        bake_palette()
    bpy.context.scene.frame_set(1)
    path = ROOT / "public" / "models" / f"{name}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB",
                              export_yup=True, export_apply=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_force_sampling=True, export_optimize_animation_size=False,
                              export_materials="EXPORT", export_cameras=False,
                              export_lights=False, export_extras=True)
    for obj in bpy.context.scene.objects:
        if obj.animation_data:
            obj.animation_data.action = None
            for track in obj.animation_data.nla_tracks:
                track.mute = True
    bpy.context.scene.frame_set(1)
    for obj, (location, rotation, scale) in rest.items():
        obj.location, obj.rotation_euler, obj.scale = location, rotation, scale
    bpy.context.view_layer.update()
    return path


def preview(name):
    scene = bpy.context.scene
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    low = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    center = (low + high) / 2
    diameter = max(high - low) * 1.42
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.cycles.seed = 17
    scene.render.resolution_x, scene.render.resolution_y = 480, 480
    scene.render.resolution_percentage = 100
    scene.world.color = (0.55, 0.55, 0.55)
    scene.view_settings.view_transform = "AgX"
    for pos, power, size in [((-3, -4, 7), 450, 5), ((4, 3, 5), 260, 4)]:
        bpy.ops.object.light_add(type="AREA", location=center + Vector(pos) * diameter / 3)
        lamp = bpy.context.object
        lamp.data.energy = power * diameter * diameter / 4
        lamp.data.shape, lamp.data.size = "DISK", size * diameter / 3
        lamp.rotation_euler = (center - lamp.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    camera.data.type, camera.data.ortho_scale = "ORTHO", diameter
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    for angle, direction in [("front", (0, -1, 0.18)), ("side", (1, 0, 0.2)),
                             ("top", (0, -0.001, 1)), ("three-quarter", (1, -1.5, 1.15))]:
        camera.location = center + Vector(direction).normalized() * diameter * 3
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(ROOT / "assets" / "previews" / f"{name}-{angle}.png")
        bpy.ops.render.render(write_still=True)


def contact_sheet(names, angles=("front", "side", "top", "three-quarter")):
    paths = [ROOT / "assets" / "previews" / f"{name}-{angle}.png"
             for name in names for angle in angles]
    columns = 4
    size = 320
    width, height = columns * size, math.ceil(len(paths) / columns) * size
    pixels = array("f", [0.12, 0.10, 0.08, 1]) * (width * height)
    for index, path in enumerate(paths):
        image = bpy.data.images.load(str(path), check_existing=False)
        image.scale(size, size)
        source = array("f", [0]) * (size * size * 4)
        image.pixels.foreach_get(source)
        x = index % columns * size
        y = height - (index // columns + 1) * size
        for row in range(size):
            start = ((y + row) * width + x) * 4
            pixels[start:start + size * 4] = source[row * size * 4:(row + 1) * size * 4]
        bpy.data.images.remove(image)
    sheet = bpy.data.images.new("ContactSheet", width=width, height=height)
    sheet.pixels.foreach_set(pixels)
    sheet.filepath_raw = str(ROOT / "assets" / "previews" /
                             (f"{names[0]}-contact.png" if len(names) == 1 else "all-assets-contact.png"))
    sheet.file_format = "PNG"
    sheet.save()
    bpy.data.images.remove(sheet)
