"""
Renders the ground the cast stands on at the foot of the night page: the Moon, its horizon curving
away under them. Cratered grey regolith in a low sun from the left, so every crater rim catches the
light and throws a long shadow; rocks breaking the skyline; a faint cool earthshine in the shadows.

Units are vw. Like the day's meadow (render_meadow.py), the ground is the page's own curve (an
ellipse 150vw wide and 70vw tall whose top is the ground line, fun.module.css), seen straight on,
so the render lines up with it on any screen. The image is the middle 100vw, from 2vw above the
crest down to 58vw below it (the footer carries it on down), the sky transparent.

Craters: geometry nodes push the surface along its normals by a crater profile (a bowl inside a
raised rim) of Voronoi cells at three sizes, each cell's crater a random size, over a fine noise of
regolith; the smallest craters and the dust are in the shading.

    blender -b --factory-startup --python scripts/blender/render_moon.py -- \\
        --out .cache/moon/moon.png [--res 2000] [--samples 64] [--seed 3]
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

A, B, DEPTH = 75.0, 35.0, 30.0  # the hill's half-width, height and depth (vw)
ABOVE, BELOW, WIDE = 2.0, 58.0, 100.0  # what the image covers around the crest


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--res", type=int, default=2000)
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--seed", type=int, default=3)
    p.add_argument("--detail", type=int, default=2048, help="segments round the ellipsoid")
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
        print("MOON gpu unavailable:", e)


def setup(a):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    use_gpu(sc)
    sc.cycles.samples = a.samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = a.res
    sc.render.resolution_y = round(a.res * (ABOVE + BELOW) / WIDE)
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.exposure = 0.35
    world = bpy.data.worlds.new("Space")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.012, 0.014, 0.035, 1)
    bg.inputs["Strength"].default_value = 1.0
    return sc


def ellipsoid(detail):
    """The front of the hill, built only where the camera sees it: for each column across the
    screen, rows from the curve's top edge down past the foot of the image (denser near the top,
    where the crest's outline needs them), each point lifted onto the ellipsoid's front."""
    cols = detail // 2
    rows = detail // 5
    x0, x1 = -(WIDE / 2 + 6), WIDE / 2 + 6
    bottom = -(BELOW + 4)
    verts = []
    for i in range(cols + 1):
        x = x0 + (x1 - x0) * i / cols
        top = -B + B * math.sqrt(max(0.0, 1 - (x / A) ** 2))
        for j in range(rows + 1):
            t = j / rows
            z = top - (top - bottom) * t**1.5
            inner = 1 - (x / A) ** 2 - ((z + B) / B) ** 2
            y = -DEPTH * math.sqrt(max(0.0, inner))
            verts.append((x, y, z))
    faces = []
    for i in range(cols):
        for j in range(rows):
            a = i * (rows + 1) + j
            b = (i + 1) * (rows + 1) + j
            # Wound to face the camera (-y).
            faces.append((a, a + 1, b + 1, b))
    mesh = bpy.data.meshes.new("Moon")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new("Moon", mesh)
    bpy.context.scene.collection.objects.link(o)
    for p in mesh.polygons:
        p.use_smooth = True
    return o


def curve(node, points):
    """Shapes a Float Curve node's curve through `points` (x, y)."""
    c = node.mapping.curves[0]
    while len(c.points) > 2:
        c.points.remove(c.points[-1])
    c.points[0].location = points[0]
    c.points[1].location = points[-1]
    for x, y in points[1:-1]:
        c.points.new(x, y)
    node.mapping.update()


# A crater across a Voronoi cell, by distance from its centre (0 to about 0.8 of a cell): a flat
# floor, a bowl rising to a sharp raised rim, and ejecta falling away to the plain.
CRATER = [(0.0, 0.2), (0.16, 0.22), (0.34, 0.5), (0.44, 0.95), (0.52, 0.62), (0.7, 0.52), (1.0, 0.5)]


def craters(obj, seed):
    mod = obj.modifiers.new("Craters", "NODES")
    tree = bpy.data.node_groups.new("Craters", "GeometryNodeTree")
    tree.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tree.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    mod.node_group = tree
    n, link = tree.nodes, tree.links.new
    gin = n.new("NodeGroupInput")
    gout = n.new("NodeGroupOutput")
    pos = n.new("GeometryNodeInputPosition")
    nrm = n.new("GeometryNodeInputNormal")

    def math_node(op, a, b=None, c=None):
        m = n.new("ShaderNodeMath")
        m.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                link(v, m.inputs[i])
        return m.outputs[0]

    total = None
    for i, (scale, depth) in enumerate(((0.07, 1.4), (0.28, 0.45), (0.9, 0.12))):
        vor = n.new("ShaderNodeTexVoronoi")
        vor.voronoi_dimensions = "4D"
        vor.inputs["W"].default_value = seed * 7.13 + i * 3.7
        vor.inputs["Scale"].default_value = scale
        link(pos.outputs["Position"], vor.inputs["Vector"])
        # Scale the distance so a crater fills about half its cell, and vary each cell's crater.
        d = math_node("MULTIPLY", vor.outputs["Distance"], 1.15)
        fc = n.new("ShaderNodeFloatCurve")
        curve(fc, CRATER)
        link(d, fc.inputs["Value"])
        h = math_node("SUBTRACT", fc.outputs["Value"], 0.5)
        sep = n.new("FunctionNodeSeparateColor")
        link(vor.outputs["Color"], sep.inputs["Color"])
        size = math_node("MULTIPLY_ADD", sep.outputs["Red"], 0.85, 0.15)
        h = math_node("MULTIPLY", math_node("MULTIPLY", h, size), depth * 2)
        total = h if total is None else math_node("ADD", total, h)
    # Regolith: a soft unevenness over everything.
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.35
    noise.inputs["Detail"].default_value = 6.0
    link(pos.outputs["Position"], noise.inputs["Vector"])
    total = math_node("ADD", total, math_node("MULTIPLY", math_node("SUBTRACT", noise.outputs["Fac"], 0.5), 0.5))
    off = n.new("ShaderNodeVectorMath")
    off.operation = "SCALE"
    link(nrm.outputs["Normal"], off.inputs[0])
    link(total, off.inputs["Scale"])
    setp = n.new("GeometryNodeSetPosition")
    link(gin.outputs[0], setp.inputs["Geometry"])
    link(off.outputs[0], setp.inputs["Offset"])
    link(setp.outputs[0], gout.inputs[0])


def regolith():
    """Grey dust: darker maria and lighter highlands in broad patches, the smallest craters and
    the grain in the shading, and a little darker down the slope toward you (the foreground)."""
    m = bpy.data.materials.new("Regolith")
    m.use_nodes = True
    nt = m.node_tree
    for x in list(nt.nodes):
        nt.nodes.remove(x)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.97
    link = nt.links.new
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    patches = nt.nodes.new("ShaderNodeTexNoise")
    patches.inputs["Scale"].default_value = 0.025
    patches.inputs["Detail"].default_value = 3.0
    link(geo.outputs["Position"], patches.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.38, (0.105, 0.105, 0.115, 1)
    els[1].position, els[1].color = 0.66, (0.24, 0.235, 0.235, 1)
    link(patches.outputs["Fac"], ramp.inputs["Fac"])
    # Darker down the slope (z falls from 0 at the crest).
    at = nt.nodes.new("ShaderNodeSeparateXYZ")
    link(geo.outputs["Position"], at.inputs[0])
    depth = nt.nodes.new("ShaderNodeMapRange")
    depth.inputs["From Min"].default_value = -42.0
    depth.inputs["From Max"].default_value = -4.0
    depth.inputs["To Min"].default_value = 0.28
    depth.inputs["To Max"].default_value = 1.0
    link(at.outputs["Z"], depth.inputs["Value"])
    shade = nt.nodes.new("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.blend_type = "MULTIPLY"
    shade.inputs["Factor"].default_value = 1.0
    cin = [s for s in shade.inputs if s.type == "RGBA"]
    link(ramp.outputs["Color"], cin[0])
    link(depth.outputs["Result"], cin[1])
    link([s for s in shade.outputs if s.type == "RGBA"][0], bsdf.inputs["Base Color"])
    # Small craters and grain, as bumps.
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 3.2
    link(geo.outputs["Position"], vor.inputs["Vector"])
    fc = nt.nodes.new("ShaderNodeFloatCurve")
    curve(fc, CRATER)
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 1.15
    link(vor.outputs["Distance"], mul.inputs[0])
    link(mul.outputs[0], fc.inputs["Value"])
    grain = nt.nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 9.0
    grain.inputs["Detail"].default_value = 8.0
    link(geo.outputs["Position"], grain.inputs["Vector"])
    bump1 = nt.nodes.new("ShaderNodeBump")
    bump1.inputs["Strength"].default_value = 0.55
    bump1.inputs["Distance"].default_value = 0.08
    link(fc.outputs["Value"], bump1.inputs["Height"])
    bump2 = nt.nodes.new("ShaderNodeBump")
    bump2.inputs["Strength"].default_value = 0.35
    bump2.inputs["Distance"].default_value = 0.02
    link(grain.outputs["Fac"], bump2.inputs["Height"])
    link(bump1.outputs["Normal"], bump2.inputs["Normal"])
    link(bump2.outputs["Normal"], bsdf.inputs["Normal"])
    link(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def rock():
    """A small irregular boulder."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1)
    o = bpy.context.active_object
    o.name = "Rock"
    tex = bpy.data.textures.new("RockNoise", "CLOUDS")
    tex.noise_scale = 0.6
    d = o.modifiers.new("Lumpy", "DISPLACE")
    d.texture = tex
    d.strength = 0.45
    bpy.ops.object.modifier_apply(modifier=d.name)
    o.scale = (1, 0.8, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    o.hide_render = True
    o.hide_viewport = True
    return o


def scatter_rocks(target, source, density, seed):
    """Boulders strewn over the surface (after the craters), half sunk in the dust."""
    mod = target.modifiers.new("Rocks", "NODES")
    tree = bpy.data.node_groups.new("Rocks", "GeometryNodeTree")
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

    def rnd(lo, hi, s, kind="FLOAT"):
        r = n.new("FunctionNodeRandomValue")
        r.data_type = kind
        if kind == "FLOAT":
            r.inputs["Min"].default_value = lo
            r.inputs["Max"].default_value = hi
        else:
            r.inputs[0].default_value = (lo, lo, lo)
            r.inputs[1].default_value = (hi, hi, hi)
        r.inputs["Seed"].default_value = seed * 17 + s
        return r.outputs["Value"] if kind == "FLOAT" else r.outputs[0]

    # Mostly pebbles, now and then a boulder: size cubed, so small ones dominate.
    size = rnd(0.0, 1.0, 1)
    cube = n.new("ShaderNodeMath")
    cube.operation = "POWER"
    cube.inputs[1].default_value = 3.0
    link(size, cube.inputs[0])
    scale = n.new("ShaderNodeMath")
    scale.operation = "MULTIPLY_ADD"
    scale.inputs[1].default_value = 0.55
    scale.inputs[2].default_value = 0.05
    link(cube.outputs[0], scale.inputs[0])
    info = n.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = source
    info.inputs["As Instance"].default_value = True
    inst = n.new("GeometryNodeInstanceOnPoints")
    link(dist.outputs["Points"], inst.inputs["Points"])
    link(info.outputs["Geometry"], inst.inputs["Instance"])
    link(rnd(0.0, 6.3, 2, "FLOAT_VECTOR"), inst.inputs["Rotation"])
    link(scale.outputs[0], inst.inputs["Scale"])
    join = n.new("GeometryNodeJoinGeometry")
    link(gin.outputs[0], join.inputs[0])
    link(inst.outputs["Instances"], join.inputs[0])
    link(join.outputs[0], gout.inputs[0])


def sun(name, at, energy, color, angle):
    data = bpy.data.lights.new(name, "SUN")
    data.energy = energy
    data.color = color
    data.angle = math.radians(angle)
    o = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(at)).to_track_quat("-Z", "Y").to_euler()


def camera():
    data = bpy.data.cameras.new("Cam")
    data.type = "ORTHO"
    data.ortho_scale = WIDE
    cam = bpy.data.objects.new("Cam", data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (0, -200, ABOVE - (ABOVE + BELOW) / 2)
    cam.rotation_euler = (math.pi / 2, 0, 0)


def main():
    a = parse()
    a.out = os.path.abspath(a.out)
    setup(a)
    moon = ellipsoid(a.detail)
    moon.data.materials.append(regolith())
    craters(moon, a.seed)
    stone = rock()
    stone.data.materials.append(moon.data.materials[0])
    scatter_rocks(moon, stone, 0.09, a.seed)
    # A low sun from the left and a little in front: it rakes across the surface, so every crater
    # rim on the sun's side is lit and the far wall throws a long shadow, and the crest is bright.
    sun("Sun", (-130, -45, 42), 6.0, (1.0, 0.96, 0.9), 0.6)
    # Earthshine: a faint cool light from the front, so the shadows aren't black.
    sun("Earthshine", (60, -150, 40), 0.5, (0.55, 0.66, 1.0), 4.0)
    camera()
    bpy.context.scene.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
    print("MOON wrote", a.out)


main()
