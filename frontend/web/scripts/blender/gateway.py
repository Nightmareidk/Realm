"""The day sky's brick gateway, modelled and rendered in Blender (Cycles), on a clear background.

An old red-brick gate standing on the hills: a thick wall with a round arch through it, brick piers
either side, stone coping and a keystone, a stone plinth, weathering and a little moss at the foot,
lit by a warm late-morning sun from the upper right under a blue sky.

    blender -b --factory-startup --python gateway.py -- --out gateway.png [--res 1400] [--samples 256]
"""

import argparse
import math
import sys

import bpy
from mathutils import Vector


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--res", type=int, default=1400)
    p.add_argument("--samples", type=int, default=256)
    return p.parse_args(argv)


def node(nodes, kind, **props):
    n = nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def brick_material():
    """Red brick in running bond, projected per face in world space so courses line up across the
    wall and the piers: front and back faces use (x, z), the sides (y, z)."""
    m = bpy.data.materials.new("Brick")
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = node(nodes, "ShaderNodeOutputMaterial")
    bsdf = node(nodes, "ShaderNodeBsdfPrincipled")
    geo = node(nodes, "ShaderNodeNewGeometry")
    pos = node(nodes, "ShaderNodeSeparateXYZ")
    nrm = node(nodes, "ShaderNodeSeparateXYZ")
    front = node(nodes, "ShaderNodeCombineXYZ")
    side = node(nodes, "ShaderNodeCombineXYZ")
    links.new(geo.outputs["Position"], pos.inputs["Vector"])
    links.new(geo.outputs["Normal"], nrm.inputs["Vector"])
    links.new(pos.outputs["X"], front.inputs["X"])
    links.new(pos.outputs["Z"], front.inputs["Y"])
    links.new(pos.outputs["Y"], side.inputs["X"])
    links.new(pos.outputs["Z"], side.inputs["Y"])
    facing = node(nodes, "ShaderNodeMath", operation="ABSOLUTE")
    links.new(nrm.outputs["X"], facing.inputs[0])
    pick = node(nodes, "ShaderNodeMath", operation="GREATER_THAN")
    pick.inputs[1].default_value = 0.5
    links.new(facing.outputs["Value"], pick.inputs[0])

    def bricks(vector):
        b = node(nodes, "ShaderNodeTexBrick")
        b.inputs["Color1"].default_value = (0.3, 0.075, 0.04, 1)
        b.inputs["Color2"].default_value = (0.5, 0.15, 0.07, 1)
        b.inputs["Mortar"].default_value = (0.5, 0.45, 0.38, 1)
        b.inputs["Scale"].default_value = 1.1
        b.inputs["Mortar Size"].default_value = 0.02
        b.inputs["Mortar Smooth"].default_value = 0.25
        b.inputs["Bias"].default_value = 0.2
        b.inputs["Brick Width"].default_value = 0.5
        b.inputs["Row Height"].default_value = 0.165
        b.offset = 0.5
        links.new(vector, b.inputs["Vector"])
        return b

    a = bricks(front.outputs["Vector"])
    b = bricks(side.outputs["Vector"])
    col = node(nodes, "ShaderNodeMix", data_type="RGBA", blend_type="MIX")
    links.new(pick.outputs["Value"], col.inputs["Factor"])
    links.new(a.outputs["Color"], col.inputs["A"])
    links.new(b.outputs["Color"], col.inputs["B"])
    fac = node(nodes, "ShaderNodeMix", data_type="FLOAT")
    links.new(pick.outputs["Value"], fac.inputs["Factor"])
    links.new(a.outputs["Fac"], fac.inputs["A"])
    links.new(b.outputs["Fac"], fac.inputs["B"])

    # Weathering: soot streaks and faded patches over the brick.
    grime = node(nodes, "ShaderNodeTexNoise")
    grime.inputs["Scale"].default_value = 0.9
    grime.inputs["Detail"].default_value = 8.0
    links.new(geo.outputs["Position"], grime.inputs["Vector"])
    grime_ramp = node(nodes, "ShaderNodeValToRGB")
    grime_ramp.color_ramp.elements[0].position = 0.3
    grime_ramp.color_ramp.elements[0].color = (0.55, 0.5, 0.48, 1)
    grime_ramp.color_ramp.elements[1].position = 0.7
    grime_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(grime.outputs["Fac"], grime_ramp.inputs["Fac"])
    weathered = node(nodes, "ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    weathered.inputs["Factor"].default_value = 1.0
    links.new(col.outputs["Result"], weathered.inputs["A"])
    links.new(grime_ramp.outputs["Color"], weathered.inputs["B"])

    # Moss creeping up from the ground.
    moss_noise = node(nodes, "ShaderNodeTexNoise")
    moss_noise.inputs["Scale"].default_value = 3.0
    moss_noise.inputs["Detail"].default_value = 6.0
    links.new(geo.outputs["Position"], moss_noise.inputs["Vector"])
    moss_h = node(nodes, "ShaderNodeMath", operation="SUBTRACT")
    links.new(pos.outputs["Z"], moss_h.inputs[0])
    links.new(moss_noise.outputs["Fac"], moss_h.inputs[1])
    moss = node(nodes, "ShaderNodeMapRange")
    moss.inputs["From Min"].default_value = -0.4
    moss.inputs["From Max"].default_value = 0.05
    moss.inputs["To Min"].default_value = 1.0
    moss.inputs["To Max"].default_value = 0.0
    links.new(moss_h.outputs["Value"], moss.inputs["Value"])
    mossy = node(nodes, "ShaderNodeMix", data_type="RGBA", blend_type="MIX")
    mossy.inputs["B"].default_value = (0.1, 0.2, 0.04, 1)
    links.new(moss.outputs["Result"], mossy.inputs["Factor"])
    links.new(weathered.outputs["Result"], mossy.inputs["A"])
    links.new(mossy.outputs["Result"], bsdf.inputs["Base Color"])

    # Mortar recessed, a little grain on the brick faces.
    grain = node(nodes, "ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 40.0
    links.new(geo.outputs["Position"], grain.inputs["Vector"])
    height = node(nodes, "ShaderNodeMath", operation="MULTIPLY_ADD")
    height.inputs[1].default_value = 0.06
    links.new(grain.outputs["Fac"], height.inputs[0])
    links.new(fac.outputs["Result"], height.inputs[2])
    bump = node(nodes, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.7
    bump.inputs["Distance"].default_value = 0.03
    links.new(height.outputs["Value"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.9
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def stone_material():
    m = bpy.data.materials.new("Stone")
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes.get("Principled BSDF")
    noise = node(nodes, "ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 12.0
    noise.inputs["Detail"].default_value = 10.0
    ramp = node(nodes, "ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.32, 0.29, 0.24, 1)
    ramp.color_ramp.elements[1].color = (0.62, 0.57, 0.48, 1)
    bump = node(nodes, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.8
    return m


def box(name, size, loc, mat, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    mod = o.modifiers.new("bevel", "BEVEL")
    mod.width = bevel
    mod.segments = 3
    o.data.materials.append(mat)
    return o


def gateway(brick, stone):
    W, D, H = 5.2, 1.0, 5.6  # wall width, depth, height
    OPEN_W, SPRING = 2.5, 2.9  # opening width, height where the arch springs
    R = OPEN_W / 2
    wall = box("Wall", (W, D, H), (0, 0, H / 2), brick, bevel=0.04)
    # The arched opening: a box and a cylinder cut through the wall.
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, SPRING / 2 - 0.05))
    cut_box = bpy.context.active_object
    cut_box.scale = (R, D, SPRING / 2 + 0.05)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=R, depth=D * 2.2, vertices=96, location=(0, 0, SPRING), rotation=(math.pi / 2, 0, 0)
    )
    cut_cyl = bpy.context.active_object
    for cutter in (cut_box, cut_cyl):
        mod = wall.modifiers.new("cut", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = cutter
        cutter.hide_render = True
        cutter.hide_viewport = True
    # Brick piers, standing proud of the wall.
    for side in (-1, 1):
        x = side * (W / 2 + 0.3)
        box(f"Pier{side}", (0.9, D + 0.35, H + 0.25), (x, 0, (H + 0.25) / 2), brick)
        box(f"PierCap{side}", (1.15, D + 0.6, 0.28), (x, 0, H + 0.39), stone)
        box(f"PierBall{side}", (0.5, 0.5, 0.5), (x, 0, H + 0.78), stone, bevel=0.22)
        box(f"Plinth{side}", (1.1, D + 0.55, 0.45), (x, 0, 0.22), stone)
    # Stone coping along the top, and a keystone over the arch.
    box("Coping", (W + 0.1, D + 0.25, 0.22), (0, 0, H + 0.11), stone)
    box("Keystone", (0.55, D + 0.12, 0.75), (0, 0, SPRING + R + 0.08), stone, bevel=0.05)
    # Voussoirs: a ring of stone around the arch, through the wall.
    bpy.ops.mesh.primitive_torus_add(
        major_radius=R + 0.14,
        minor_radius=0.14,
        major_segments=96,
        minor_segments=12,
        location=(0, 0, SPRING),
        rotation=(math.pi / 2, 0, 0),
    )
    ring = bpy.context.active_object
    ring.scale = (1, 1, D * 3.2)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, SPRING - 1.5))
    lower = bpy.context.active_object
    lower.scale = (3, 3, 1.5)
    mod = ring.modifiers.new("half", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = lower
    lower.hide_render = True
    lower.hide_viewport = True
    ring.data.materials.append(stone)
    # Ground for the contact shadow (a shadow catcher: only its shadow shows).
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.is_shadow_catcher = True


def scene_setup(a):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue
    scene.cycles.samples = a.samples
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x = a.res
    scene.render.resolution_y = a.res
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0

    world = bpy.data.worlds.new("Sky")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.55, 0.72, 1.0, 1)
    bg.inputs["Strength"].default_value = 0.7

    bpy.ops.object.light_add(
        type="SUN", rotation=(math.radians(50), math.radians(22), math.radians(35))
    )
    sun = bpy.context.active_object
    sun.data.energy = 4.2
    sun.data.color = (1.0, 0.93, 0.82)
    sun.data.angle = math.radians(3)

    bpy.ops.object.camera_add(location=(4.6, -15.5, 3.4))
    cam = bpy.context.active_object
    cam.data.lens = 70
    direction = Vector((0, 0, 3.1)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam


def main():
    a = parse()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    brick, stone = brick_material(), stone_material()
    gateway(brick, stone)
    scene_setup(a)
    scene = bpy.context.scene
    scene.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
    print(f"gateway: wrote {a.out}")


main()
