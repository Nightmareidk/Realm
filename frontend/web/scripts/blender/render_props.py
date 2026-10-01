"""
Renders the sky's props (the product owner's Meshy models: a jet, a satellite, UFOs, a
rocket) as transparent frames for the page: in the cast's studio light, from a chosen angle, either
one still or a turntable (the model turning about an axis over N frames, for a strip CSS steps
through).

    blender -b --factory-startup --python scripts/blender/render_props.py -- \
        --in brand/models-incoming/sky-ufo-source.glb --out <dir> --name ufo \
        [--rot 0,0,0] [--frames 24] [--axis z] [--elev 18] [--azim 0] [--res 320] [--samples 48]
    --views: a contact sheet of six plain views instead (for finding which way a model faces)
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Euler, Vector


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--rot", default="0,0,0", help="degrees, applied to the model first")
    p.add_argument("--frames", type=int, default=1)
    p.add_argument("--axis", default="z", help="the turntable's axis")
    p.add_argument("--elev", type=float, default=15.0, help="camera elevation, degrees")
    p.add_argument("--azim", type=float, default=0.0, help="camera azimuth, degrees")
    p.add_argument("--res", type=int, default=320)
    p.add_argument("--samples", type=int, default=48)
    p.add_argument("--views", action="store_true")
    return p.parse_args(argv)


def use_gpu(scene):
    scene.cycles.device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA", "HIP"):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            if [d for d in prefs.devices if d.type != "CPU"]:
                for d in prefs.devices:
                    d.use = d.type != "CPU"
                scene.cycles.device = "GPU"
                return
    except Exception as e:  # noqa: BLE001
        print("PROPS gpu unavailable:", e)


def setup(res, samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    use_gpu(sc)
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("Studio")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.55, 0.62, 0.8, 1.0)
    bg.inputs["Strength"].default_value = 0.55


def area_light(name, loc, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.size = size
    data.color = color
    o = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    d = Vector((0, 0, 0)) - Vector(loc)
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def lights():
    # The cast's studio: a warm key from the front left, a soft fill, a cool and a warm rim.
    area_light("Key", (-3.2, -4.2, 4.6), 950, 4.0, (1.0, 0.95, 0.9))
    area_light("Fill", (4.2, -3.4, 1.8), 300, 5.0, (0.88, 0.9, 1.0))
    area_light("RimCool", (3.4, 3.2, 3.6), 900, 2.2, (0.62, 0.66, 1.0))
    area_light("RimWarm", (-3.6, 3.0, 2.6), 650, 2.2, (1.0, 0.72, 0.45))
    area_light("Top", (0.0, -0.6, 6.0), 260, 3.0, (1.0, 1.0, 1.0))


def load(src, rot):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    # One pivot for the whole model, at its centre, scaled to fit a unit sphere.
    pivot = bpy.data.objects.new("pivot", None)
    bpy.context.scene.collection.objects.link(pivot)
    roots = [o for o in bpy.context.scene.objects if o.parent is None and o is not pivot]
    for o in roots:
        o.parent = pivot
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre = (lo + hi) / 2
    size = max((hi - lo).length / 2, 1e-6)
    for o in roots:
        o.location -= centre
    pivot.scale = (1 / size,) * 3
    pivot.rotation_euler = Euler([math.radians(float(v)) for v in rot.split(",")], "XYZ")
    return pivot


def camera(elev, azim):
    data = bpy.data.cameras.new("Cam")
    data.type = "ORTHO"
    data.ortho_scale = 2.1
    cam = bpy.data.objects.new("Cam", data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    e, a = math.radians(elev), math.radians(azim)
    cam.location = (10 * math.cos(e) * math.sin(a), -10 * math.cos(e) * math.cos(a), 10 * math.sin(e))
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    return cam


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    a = parse()
    # Blender resolves a bare relative output path against the drive root, not the working folder.
    a.out = os.path.abspath(a.out)
    setup(a.res, a.samples)
    pivot = load(a.src, a.rot)
    lights()
    if a.views:
        for name, (el, az) in {
            "front": (0, 0),
            "right": (0, 90),
            "back": (0, 180),
            "left": (0, 270),
            "top": (89, 0),
            "three-quarter": (25, 35),
        }.items():
            for o in list(bpy.data.objects):
                if o.type == "CAMERA":
                    bpy.data.objects.remove(o, do_unlink=True)
            camera(el, az)
            render(f"{a.out}/{a.name}-view-{name}.png")
        print("PROPS views", a.name)
        return
    camera(a.elev, a.azim)
    base = pivot.rotation_euler.copy()
    axis = "xyz".index(a.axis)
    for f in range(a.frames):
        r = base.copy()
        r[axis] += 2 * math.pi * f / a.frames
        pivot.rotation_euler = r
        render(f"{a.out}/{a.name}-{f:02d}.png")
    print("PROPS wrote", a.name, a.frames)


main()
