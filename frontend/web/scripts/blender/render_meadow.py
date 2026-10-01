"""
Renders the hill the cast stands on at the foot of the day page: a meadow on the crest of a gentle
hill, grass blade by blade, the blades along the crest standing up against the sky.

Units are vw. The hill is the page's own curve (fun.module.css: an ellipse 150vw wide and 70vw
tall whose top is the ground line), seen straight on, so the render lines up with it on any
screen. The image is the middle 100vw of the hill, from 2vw above its crest (for the blade tips)
down to 38vw below, with the sky transparent.

Grass: a blade mesh (tapered, a little bent) instanced over the hill's front by geometry nodes,
standing up (not along the slope), each leaning, turning and sized at random, darker at the root
and lit gold-green at the tip, translucent so the sun behind the crest glows through it; a few
small flowers among them. Lit like the cast: a warm key from the front left, a golden sun behind
the hill for the rim along the crest, and the sky's cool light.

    blender -b --factory-startup --python scripts/blender/render_meadow.py -- \\
        --out .cache/meadow/hill.png [--res 2000] [--samples 96] [--density 110] [--seed 4]

With --tile 25.6 it renders a square of the same grass instead, as it grows further down the slope
(in the shade, no straw patches), seamless on every side for the page to repeat: the grass is
scattered over a wall of that size with eight copies of it all round, so every blade that crosses
an edge comes back in on the other side.
"""

import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

A, B, DEPTH = 75.0, 35.0, 30.0  # the hill's half-width, height and depth (vw)
ABOVE, BELOW, WIDE = 2.0, 38.0, 100.0  # what the image covers around the crest


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--res", type=int, default=2000)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--density", type=float, default=110.0, help="blades per square vw")
    p.add_argument("--seed", type=int, default=4)
    p.add_argument("--tile", type=float, default=0.0, help="render a seamless tile this many vw across")
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
        print("MEADOW gpu unavailable:", e)


def setup(a):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    use_gpu(sc)
    sc.cycles.samples = a.samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = a.res
    sc.render.resolution_y = a.res if a.tile else round(a.res * (ABOVE + BELOW) / WIDE)
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.exposure = 0.45
    try:
        sc.view_settings.look = "AgX - Punchy"
    except TypeError:
        print("MEADOW no punchy look")
    world = bpy.data.worlds.new("Sky")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.5, 0.66, 0.95, 1)
    bg.inputs["Strength"].default_value = 0.55
    return sc


def material(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(build(nt), out.inputs["Surface"])
    return m


def grass_material(patches=True):
    def build(nt):
        coord = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(coord.outputs["Object"], sep.inputs[0])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        els = ramp.color_ramp.elements
        els[0].position, els[0].color = 0.0, (0.012, 0.035, 0.008, 1)
        els[1].position, els[1].color = 1.0, (0.5, 0.78, 0.12, 1)
        mid = els.new(0.45)
        mid.color = (0.07, 0.3, 0.025, 1)
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
        # Every blade a little different: hue from green toward straw, and brightness.
        info = nt.nodes.new("ShaderNodeObjectInfo")
        hue = nt.nodes.new("ShaderNodeHueSaturation")
        span = nt.nodes.new("ShaderNodeMapRange")
        span.inputs["To Min"].default_value = 0.47
        span.inputs["To Max"].default_value = 0.53
        nt.links.new(info.outputs["Random"], span.inputs["Value"])
        nt.links.new(span.outputs["Result"], hue.inputs["Hue"])
        val = nt.nodes.new("ShaderNodeMapRange")
        val.inputs["To Min"].default_value = 0.75
        val.inputs["To Max"].default_value = 1.2
        nt.links.new(info.outputs["Random"], val.inputs["Value"])
        # Brighter up in the sun on the crest, into shade down the slope toward you.
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        at = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geo.outputs["Position"], at.inputs[0])
        depth = nt.nodes.new("ShaderNodeMapRange")
        depth.inputs["From Min"].default_value = -28.0
        depth.inputs["From Max"].default_value = 0.0
        depth.inputs["To Min"].default_value = 0.55
        depth.inputs["To Max"].default_value = 1.3
        nt.links.new(at.outputs["Z"], depth.inputs["Value"])
        bright = nt.nodes.new("ShaderNodeMath")
        bright.operation = "MULTIPLY"
        nt.links.new(val.outputs["Result"], bright.inputs[0])
        nt.links.new(depth.outputs["Result"], bright.inputs[1])
        nt.links.new(bright.outputs["Value"], hue.inputs["Value"])
        nt.links.new(ramp.outputs["Color"], hue.inputs["Color"])
        # Patches across the meadow where the grass runs to straw.
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 0.035
        noise.inputs["Detail"].default_value = 3.0
        nt.links.new(geo.outputs["Position"], noise.inputs["Vector"])
        patch = nt.nodes.new("ShaderNodeMapRange")
        patch.inputs["From Min"].default_value = 0.52
        patch.inputs["From Max"].default_value = 0.72
        patch.inputs["To Max"].default_value = 0.3 if patches else 0.0
        nt.links.new(noise.outputs["Fac"], patch.inputs["Value"])
        straw = nt.nodes.new("ShaderNodeMix")
        straw.data_type = "RGBA"
        colour_in = [x for x in straw.inputs if x.type == "RGBA"]
        nt.links.new(patch.outputs["Result"], straw.inputs["Factor"])
        nt.links.new(hue.outputs["Color"], colour_in[0])
        colour_in[1].default_value = (0.62, 0.78, 0.16, 1)
        colour = [x for x in straw.outputs if x.type == "RGBA"][0]
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Roughness"].default_value = 0.55
        nt.links.new(colour, bsdf.inputs["Base Color"])
        glow = nt.nodes.new("ShaderNodeBsdfTranslucent")
        nt.links.new(colour, glow.inputs["Color"])
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs["Fac"].default_value = 0.3
        nt.links.new(bsdf.outputs["BSDF"], mix.inputs[1])
        nt.links.new(glow.outputs["BSDF"], mix.inputs[2])
        return mix.outputs["Shader"]

    return material("Grass", build)


def plain_material(name, color, roughness=0.8):
    def build(nt):
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = roughness
        return bsdf.outputs["BSDF"]

    return material(name, build)


def blade(patches=True):
    """One blade of grass, 1 tall: a tapered strip bending forward toward its tip."""
    mesh = bpy.data.meshes.new("Blade")
    bm = bmesh.new()
    steps = 5
    rows = []
    for i in range(steps + 1):
        t = i / steps
        w = 0.055 * (1 - t) ** 0.8
        y = -0.22 * t * t
        rows.append((bm.verts.new((-w, y, t)), bm.verts.new((w, y, t))))
    for (a0, a1), (b0, b1) in zip(rows, rows[1:], strict=False):
        bm.faces.new((a0, a1, b1, b0))
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new("Blade", mesh)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(grass_material(patches))
    o.hide_render = True
    o.hide_viewport = True
    return o


def flower():
    """A tiny meadow flower: a pale disc of a head."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.085)
    o = bpy.context.active_object
    o.name = "Flower"
    o.scale = (1, 1, 0.45)
    o.data.materials.append(plain_material("Petals", (1.0, 0.88, 0.5), 0.6))
    o.hide_render = True
    o.hide_viewport = True
    return o


def hill():
    """The front of the hill: an ellipsoid with the page's curve for its outline, trimmed to the
    part the camera sees."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=384, ring_count=192, radius=1)
    o = bpy.context.active_object
    o.name = "Hill"
    o.scale = (A, DEPTH, B)
    o.location = (0, 0, -B)
    bpy.ops.object.transform_apply(location=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    gone = [v for v in bm.verts if v.co.y > 4 or v.co.z < -(BELOW + 4) or abs(v.co.x) > WIDE / 2 + 6]
    bmesh.ops.delete(bm, geom=gone, context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.append(plain_material("Soil", (0.02, 0.045, 0.012)))
    return o


def scatter(target, source, density, seed, lean, size, lift=(0.0, 0.0)):
    """Instances `source` over `target`'s faces, standing up, each turned and leant at random."""
    mod = target.modifiers.new(source.name, "NODES")
    tree = bpy.data.node_groups.new(source.name + "Scatter", "GeometryNodeTree")
    tree.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tree.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    mod.node_group = tree
    n, link = tree.nodes, tree.links.new
    gin = n.new("NodeGroupInput")
    gout = n.new("NodeGroupOutput")
    dist = n.new("GeometryNodeDistributePointsOnFaces")
    dist.inputs["Density"].default_value = density
    dist.inputs["Seed"].default_value = seed
    link(gin.outputs[0], dist.inputs["Mesh"])

    def rnd(lo, hi, s):
        r = n.new("FunctionNodeRandomValue")
        r.data_type = "FLOAT"
        r.inputs["Min"].default_value = lo
        r.inputs["Max"].default_value = hi
        r.inputs["Seed"].default_value = seed * 31 + s
        return r.outputs["Value"]

    rot = n.new("ShaderNodeCombineXYZ")
    link(rnd(-lean, lean, 1), rot.inputs["X"])
    link(rnd(-lean, lean, 2), rot.inputs["Y"])
    link(rnd(0, 2 * math.pi, 3), rot.inputs["Z"])
    scale = n.new("ShaderNodeCombineXYZ")
    width = rnd(0.8, 1.3, 4)
    link(width, scale.inputs["X"])
    link(width, scale.inputs["Y"])
    link(rnd(size[0], size[1], 5), scale.inputs["Z"])
    info = n.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = source
    info.inputs["As Instance"].default_value = True
    inst = n.new("GeometryNodeInstanceOnPoints")
    link(dist.outputs["Points"], inst.inputs["Points"])
    link(info.outputs["Geometry"], inst.inputs["Instance"])
    link(rot.outputs["Vector"], inst.inputs["Rotation"])
    link(scale.outputs["Vector"], inst.inputs["Scale"])
    last = inst.outputs["Instances"]
    if lift[1] > 0:
        # Flowers ride up among the blades.
        move = n.new("GeometryNodeTranslateInstances")
        up = n.new("ShaderNodeCombineXYZ")
        link(rnd(lift[0], lift[1], 6), up.inputs["Z"])
        link(last, move.inputs["Instances"])
        link(up.outputs["Vector"], move.inputs["Translation"])
        last = move.outputs["Instances"]
    join = n.new("GeometryNodeJoinGeometry")
    link(gin.outputs[0], join.inputs[0])
    link(last, join.inputs[0])
    link(join.outputs[0], gout.inputs[0])


def sun(name, at, energy, color, angle):
    data = bpy.data.lights.new(name, "SUN")
    data.energy = energy
    data.color = color
    data.angle = math.radians(angle)
    o = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(at)).to_track_quat("-Z", "Y").to_euler()


def wall(size, top):
    """A square of ground standing up to face the camera, `size` across, its top at `top`."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=48, y_subdivisions=48, size=size)
    o = bpy.context.active_object
    o.name = "Wall"
    o.rotation_euler = (math.pi / 2, 0, 0)
    o.location = (0, 0, top - size / 2)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    o.data.materials.append(plain_material("Soil", (0.02, 0.045, 0.012)))
    return o


def tiled(o, size):
    """Eight more of `o` all round it (the same mesh and the same scatter), so the middle square
    repeats seamlessly."""
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            if dx or dz:
                c = o.copy()
                c.location = (dx * size, 0, dz * size)
                bpy.context.scene.collection.objects.link(c)


def camera(width=WIDE, centre=ABOVE - (ABOVE + BELOW) / 2):
    data = bpy.data.cameras.new("Cam")
    data.type = "ORTHO"
    data.ortho_scale = width
    cam = bpy.data.objects.new("Cam", data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (0, -200, centre)
    cam.rotation_euler = (math.pi / 2, 0, 0)


def main():
    a = parse()
    a.out = os.path.abspath(a.out)
    setup(a)
    if a.tile:
        # Down the slope, in the shade (the material darkens with depth and holds below 28vw).
        top = -30.0
        ground = wall(a.tile, top)
        scatter(ground, blade(patches=False), a.density, a.seed, lean=0.32, size=(0.8, 1.7))
        tiled(ground, a.tile)
        ground2 = wall(a.tile, top)
        scatter(ground2, flower(), 0.1, a.seed + 7, lean=0.2, size=(0.7, 1.2), lift=(0.55, 1.1))
        tiled(ground2, a.tile)
        camera(a.tile, top - a.tile / 2)
    else:
        ground = hill()
        scatter(ground, blade(), a.density, a.seed, lean=0.32, size=(0.8, 1.7))
        # The flowers: a second pass of the same, sparse.
        ground2 = hill()
        ground2.hide_render = False
        ground2.data.materials.clear()
        ground2.data.materials.append(plain_material("Soil2", (0.02, 0.045, 0.012)))
        scatter(ground2, flower(), 0.1, a.seed + 7, lean=0.2, size=(0.7, 1.2), lift=(0.55, 1.1))
        camera()
    sun("Key", (-60, -90, 80), 3.0, (1.0, 0.95, 0.86), 2.0)
    sun("Rim", (15, 140, 16), 9.0, (1.0, 0.72, 0.38), 1.5)
    bpy.context.scene.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
    print("MEADOW wrote", a.out)


main()
