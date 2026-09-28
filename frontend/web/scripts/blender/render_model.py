"""Render a cast member from its model (a Meshy GLB or similar) for the 2D page art.

Imports the model, stands it up at a fixed height with its feet on the ground, lights it in the
cast's studio (a warm key, a cool fill and two coloured rims, so it sits well on the night and the
day page alike) and renders, on a transparent background:
  <name>.png        full figure, turned a little toward the viewer
  <name>-face.png   a head-and-shoulders portrait (avatars)

    blender -b --factory-startup --python render_model.py -- --in model.glb --out <dir> \
        --name astro-teal [--res 1000] [--samples 128] [--turn 0.22] [--face 0.5]
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--res", type=int, default=1000)
    p.add_argument("--samples", type=int, default=128)
    p.add_argument("--turn", type=float, default=0.22, help="radians toward camera-left")
    p.add_argument("--face", type=float, default=0.5, help="share of the height the portrait shows")
    return p.parse_args(argv)


def setup_render(res, samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "OPTIX"
        sc.cycles.device = "GPU"
    except Exception:
        sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Punchy", "Punchy", "AgX - Medium High Contrast"):
        try:
            sc.view_settings.look = look
            break
        except TypeError:
            continue


def setup_world():
    world = bpy.data.worlds.new("Studio")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.62, 0.6, 0.72, 1)
    bg.inputs["Strength"].default_value = 0.45
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def area_light(name, loc, energy, size, color, target):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def setup_lights(h):
    t = (0, 0, h * 0.45)
    k = h / 2.2
    area_light("Key", (-3.2 * k, -4.2 * k, 4.6 * k), 950 * k * k, 4.0 * k, (1.0, 0.95, 0.9), t)
    area_light("Fill", (4.2 * k, -3.4 * k, 1.8 * k), 300 * k * k, 5.0 * k, (0.88, 0.9, 1.0), t)
    area_light("RimCool", (3.4 * k, 3.2 * k, 3.6 * k), 900 * k * k, 2.2 * k, (0.62, 0.66, 1.0), t)
    area_light("RimWarm", (-3.6 * k, 3.0 * k, 2.6 * k), 650 * k * k, 2.2 * k, (1.0, 0.72, 0.45), t)
    area_light("Top", (0.0, -0.6 * k, 6.0 * k), 260 * k * k, 3.0 * k, (1.0, 1.0, 1.0), t)


def meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def bounds():
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in meshes():
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def stand_up(height):
    lo, hi = bounds()
    s = height / (hi.z - lo.z)
    roots = [o for o in bpy.context.scene.objects if o.parent is None]
    for o in roots:
        o.scale *= s
    bpy.context.view_layer.update()
    lo, hi = bounds()
    shift = Vector(((lo.x + hi.x) / -2, (lo.y + hi.y) / -2, -lo.z))
    for o in roots:
        o.location += shift
    bpy.context.view_layer.update()


def camera(center, size, depth, turn, lens=85):
    data = bpy.data.cameras.new("Cam")
    data.lens = lens
    cam = bpy.data.objects.new("Cam", data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    fov = 2 * math.atan(data.sensor_width / (2 * lens))
    dist = size / (2 * math.tan(fov / 2)) + depth
    elev = math.radians(6)
    d = Vector((math.sin(turn) * math.cos(elev), -math.cos(turn) * math.cos(elev), math.sin(elev)))
    cam.location = center + d * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    return cam


def render(path):
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    a = parse()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=a.src)
    height = 2.75
    stand_up(height)
    setup_render(a.res, a.samples)
    setup_world()
    setup_lights(height)
    lo, hi = bounds()

    # Full figure: square frame on the larger of width and height.
    size = max(hi.x - lo.x, hi.z - lo.z) * 1.1
    cam = camera((lo + hi) / 2, size, hi.y - lo.y, a.turn)
    render(out / f"{a.name}.png")

    # Portrait: the top of the figure (head and shoulders on these big-headed characters),
    # centred on the head itself rather than the figure, so a raised hand doesn't pull it aside.
    bpy.data.objects.remove(cam)
    top = height * a.face
    xs = sorted(
        (o.matrix_world @ v.co).x
        for o in meshes()
        for v in o.data.vertices
        if (o.matrix_world @ v.co).z > hi.z - top * 0.45
    )
    head_x = xs[len(xs) // 2] if xs else 0.0
    camera(Vector((head_x, 0, hi.z - top / 2)), top * 1.04, (hi.y - lo.y), a.turn * 0.6)
    render(out / f"{a.name}-face.png")
    print("RENDERED", a.name)


main()
