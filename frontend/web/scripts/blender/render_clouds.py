"""
Renders the day page's cumulus clouds as transparent images: real volumes, lit by a warm sun
from above with cool sky light in the shade, rendered in Cycles with a transparent background.

Each cloud is a heap of spheres (a wide, flattened base and puffs piled on it) turned into a
volume, then displaced by billowing noise so its surface breaks into the cauliflower heads of a
cumulus. Different seeds give different clouds.

    blender -b --factory-startup --python scripts/blender/render_clouds.py -- \
        --out <dir> --count 4 --res 900 --samples 96
"""
import argparse
import math
import random
import sys

import bpy
from mathutils import Vector


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--count", type=int, default=4)
    p.add_argument("--res", type=int, default=900)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--seed", type=int, default=7)
    return p.parse_args(argv)


def use_gpu(scene):
    """Cycles on the GPU if there is one (much faster for volumes), else the CPU."""
    scene.cycles.device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type != "CPU"]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type != "CPU"
                scene.cycles.device = "GPU"
                print("CLOUDS device", kind, [d.name for d in gpus])
                return
    except Exception as e:  # noqa: BLE001
        print("CLOUDS gpu unavailable:", e)
    print("CLOUDS device CPU")


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def heap(rng):
    """The spheres a cumulus is built from: a broad flat base, puffs piled up toward the middle."""
    balls = []
    width = rng.uniform(3.4, 4.6)
    # The base: wide, low, overlapping.
    for i in range(7):
        x = (i / 6 - 0.5) * width + rng.uniform(-0.2, 0.2)
        balls.append((Vector((x, rng.uniform(-0.3, 0.3), rng.uniform(0.0, 0.2))), rng.uniform(0.55, 0.8), 0.45))
    # Piled heads: bigger and higher toward the middle, a tower on one side now and then.
    tower = rng.uniform(-0.5, 0.5) * width * 0.4
    for _ in range(11):
        x = rng.gauss(tower, width * 0.2)
        rise = max(0.0, 1.0 - abs(x - tower) / (width * 0.55))
        z = 0.35 + rise * rng.uniform(0.6, 1.5)
        balls.append((Vector((x, rng.uniform(-0.35, 0.35), z)), rng.uniform(0.45, 0.8) * (0.7 + 0.5 * rise), 1.0))
    return balls


def build_cloud(rng, index):
    mesh_objs = []
    for c, r, squash in heap(rng):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=r, location=c)
        o = bpy.context.active_object
        o.scale.z = squash if squash < 1 else 1.0
        mesh_objs.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.join()
    shape = bpy.context.active_object
    shape.name = f"shape{index}"
    shape.hide_render = True

    # The volume: the heap's inside, then billowed by noise.
    vol_data = bpy.data.volumes.new(f"cloud{index}")
    vol = bpy.data.objects.new(f"cloud{index}", vol_data)
    bpy.context.scene.collection.objects.link(vol)
    m2v = vol.modifiers.new("fill", "MESH_TO_VOLUME")
    m2v.object = shape
    m2v.resolution_mode = "VOXEL_SIZE"
    m2v.voxel_size = 0.026
    m2v.interior_band_width = 0.12
    m2v.density = 1.0
    tex = bpy.data.textures.new(f"billow{index}", type="CLOUDS")
    tex.noise_scale = 0.38
    tex.noise_depth = 5
    tex.noise_basis = "BLENDER_ORIGINAL"
    disp = vol.modifiers.new("billow", "VOLUME_DISPLACE")
    disp.texture = tex
    disp.strength = 0.4
    disp.texture_mid_level = (0.5, 0.5, 0.5)
    disp.texture_sample_radius = 1.0
    # Smaller billows on the big ones: the cauliflower of a cumulus head.
    fine_tex = bpy.data.textures.new(f"fine{index}", type="CLOUDS")
    fine_tex.noise_scale = 0.13
    fine_tex.noise_depth = 3
    fine = vol.modifiers.new("fine", "VOLUME_DISPLACE")
    fine.texture = fine_tex
    fine.strength = 0.16
    fine.texture_mid_level = (0.5, 0.5, 0.5)

    mat = bpy.data.materials.new(f"cloudmat{index}")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    outp = nt.nodes.new("ShaderNodeOutputMaterial")
    pv = nt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    pv.inputs["Density"].default_value = 34.0
    pv.inputs["Anisotropy"].default_value = 0.3
    nt.links.new(pv.outputs["Volume"], outp.inputs["Volume"])
    vol_data.materials.append(mat)
    return vol, shape


def light_and_camera(scene):
    sun_data = bpy.data.lights.new("sun", type="SUN")
    sun_data.energy = 8.5
    sun_data.angle = math.radians(2.0)
    sun_data.color = (1.0, 0.93, 0.8)
    sun = bpy.data.objects.new("sun", sun_data)
    scene.collection.objects.link(sun)
    # High and to the left, a little in front: bright tops, light falling across the heads, shaded
    # flat bases.
    sun.rotation_euler = (math.radians(14), math.radians(-38), 0)

    world = bpy.data.worlds.new("sky")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.3, 0.5, 0.95, 1.0)
    bg.inputs["Strength"].default_value = 0.32

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def frame(cam, vol, aspect):
    """Aim the orthographic camera at the cloud's bounds, with a margin."""
    bpy.context.view_layer.update()
    corners = [vol.matrix_world @ Vector(c) for c in vol.bound_box]
    xs = [c.x for c in corners]
    zs = [c.z for c in corners]
    cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    w = (max(xs) - min(xs)) * 1.12
    h = (max(zs) - min(zs)) * 1.18
    cam.location = (cx, -20, cz)
    cam.rotation_euler = (math.radians(90), 0, 0)
    cam.data.ortho_scale = max(w, h * aspect)


def main():
    a = parse()
    rng = random.Random(a.seed)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.samples = a.samples
    scene.cycles.use_denoising = True
    # Clouds are white because light bounces around inside them: many volume bounces.
    scene.cycles.volume_bounces = 16
    scene.cycles.max_bounces = 24
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.volume_step_rate = 0.5
    scene.cycles.volume_max_steps = 1024
    scene.view_settings.exposure = 0.55
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy" if "AgX - Punchy" in [
        i.identifier for i in scene.view_settings.bl_rna.properties["look"].enum_items
    ] else "None"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    clear()
    cam = light_and_camera(scene)
    for i in range(a.count):
        vol, shape = build_cloud(rng, i)
        aspect = 1.8
        scene.render.resolution_x = a.res
        scene.render.resolution_y = int(a.res / aspect)
        frame(cam, vol, aspect)
        scene.render.filepath = f"{a.out}/cloud-{i + 1}.png"
        bpy.ops.render.render(write_still=True)
        print("CLOUDS wrote", scene.render.filepath)
        bpy.data.objects.remove(vol, do_unlink=True)
        bpy.data.objects.remove(shape, do_unlink=True)


main()
