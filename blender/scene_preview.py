"""Offline art review of the committed GLB composition; not browser-test evidence."""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, clear, empty


def place(name, position=(0, 0, 0), rotation=0, scale=1):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "public" / "models" / f"{name}.glb"))
    objects = set(bpy.context.scene.objects) - before
    anchor = empty(name + "_placement", (position[0], -position[2], position[1]))
    anchor.rotation_euler.z = rotation
    anchor.scale = (scale, scale, scale)
    for obj in objects:
        if obj.animation_data:
            obj.animation_data_clear()
        if obj.parent not in objects:
            obj.parent = anchor
            obj.location = (0, 0, 0)
    return anchor


clear()
place("atlas")
place("library", (0, 1.8, 0))
place("shelf", (-1.65, 1.98, -1.68))
place("shelf", (-0.2, 1.98, -1.68))
place("desk", (-2.08, 1.98, 0.72), 0.1)
place("lamp", (-2.62, 2.80, 0.83))
place("lamp", (0.98, 1.98, -1.8), scale=1.5)
place("sieve", (0.03, 1.98, -0.62))
place("stamp", (-1.72, 2.80, 0.67))
place("cart", (-0.82, 1.98, 0.5))
place("cart", (0.93, 1.98, 0.5))
place("shelby", (0.02, 1.98, 1.24), -0.25)
place("quill", (-2.28, 2.80, 0.3), -0.35)
place("patron", (1.4, 1.98, 1.65), -0.9)
place("cloud", (-5.3, -0.8, -2), scale=1.8)
place("cloud", (4.9, 0.1, -4.5), scale=1.5)
place("cloud", (1, -1.8, 4.7), scale=1.25)
prototype = place("book")
parts = [obj for obj in prototype.children_recursive if obj.type == "MESH"]
for index in range(46):
    anchor = empty(f"Book_{index}")
    if index < 30:
        x = -2.12 + index % 10 * 0.097 + (1.45 if index >= 20 else 0)
        z = 2.14 + (0.5 if 10 <= index < 20 else 0)
        y = 1.52
    else:
        cart = -0.82 if index < 38 else 0.93
        x, y, z = cart - 0.35 + index % 8 * 0.095, -0.61, 2.54
    anchor.location = (x, y, z)
    for part in parts:
        clone = part.copy()
        clone.data = part.data.copy()
        bpy.context.collection.objects.link(clone)
        clone.parent = anchor
        clone.matrix_basis = part.matrix_world
        if part.name.startswith("Cover"):
            material = clone.data.materials[0].copy()
            hexes = ["3E5C8A", "B5475A", "4F8A6B", "C28A2E", "7A5C9A"]
            from_color = tuple(int(hexes[index % 5][i:i + 2], 16) / 255 for i in (0, 2, 4))
            linear = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in from_color)
            material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (*linear, 1)
            clone.data.materials[0] = material
for obj in list(prototype.children_recursive) + [prototype]:
    bpy.data.objects.remove(obj, do_unlink=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.cycles.seed = 17
scene.render.resolution_x, scene.render.resolution_y = 1440, 1000
scene.render.resolution_percentage = 100
scene.world.use_nodes = True
scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.74, 0.82, 0.87, 1)
scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.6
for location, energy, size in [((-3, -7, 12), 2200, 8), ((5, 5, 7), 1000, 7)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy, light.data.size = energy, size
    light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add(location=(8.5, -13.4, 10.7))
camera = bpy.context.object
camera.data.type = "PERSP"
camera.data.angle = math.radians(42)
camera.rotation_euler = (Vector((0, 0, 1.4)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(ROOT / "assets" / "previews" / "m1-composition.png")
bpy.ops.render.render(write_still=True)
