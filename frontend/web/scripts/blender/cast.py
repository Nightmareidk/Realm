"""Realm's cast, modelled in code and rendered in Blender (Cycles).

Explorers (astronauts), aliens, monsters and humans, built from metaballs (for organic, sculpted
forms), subdivided primitives and physically based materials: clearcoat plastic, fabric with
sheen, subsurface skin, jelly, thin-film visors. Each character is rigged with a shoulder and an
elbow on its right arm, so it can wave.

For each character this renders, on a transparent background:
  <name>.png           standing
  <name>-body.png      waving pose without the right forearm
  <name>-forearm.png   the right forearm alone (the body is a holdout, so occlusion is correct)
  <name>-face.png      a head-and-shoulders portrait (avatars)
and writes <name>.json with the elbow's pixel position in the waving renders.

    blender -b --factory-startup --python cast.py -- --out <dir> --who astro-teal [--res 900]
        [--samples 160] [--glb <file>]
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Quaternion, Vector

# ── Scene ─────────────────────────────────────────────────────────────────────────────────


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


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
    sc.cycles.max_bounces = 10
    sc.cycles.transmission_bounces = 10
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
    grad = nt.nodes.new("ShaderNodeTexGradient")
    mapping = nt.nodes.new("ShaderNodeMapping")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    mapping.inputs["Rotation"].default_value = (0, math.radians(90), 0)
    nt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].color = (0.16, 0.12, 0.3, 1)
    ramp.color_ramp.elements[1].color = (0.72, 0.78, 0.95, 1)
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.55
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def area_light(name, loc, energy, size, color, target=(0, 0, 1.1)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    direction = Vector(target) - Vector(loc)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def setup_lights():
    area_light("Key", (-3.2, -4.2, 4.6), 950, 4.0, (1.0, 0.95, 0.9))
    area_light("Fill", (4.2, -3.4, 1.8), 260, 5.0, (0.86, 0.9, 1.0))
    area_light("RimCool", (3.4, 3.2, 3.6), 900, 2.2, (0.62, 0.66, 1.0))
    area_light("RimWarm", (-3.6, 3.0, 2.6), 650, 2.2, (1.0, 0.72, 0.45))
    area_light("Top", (0.0, -0.6, 6.0), 260, 3.0, (1.0, 1.0, 1.0))


# ── Materials ─────────────────────────────────────────────────────────────────────────────


def hexc(h, a=1.0):
    h = h.lstrip("#")
    srgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)


_mats = {}


def mat(name, color, rough=0.4, coat=0.0, coat_rough=0.08, metal=0.0, sss=0.0, sss_radius=(1, 0.4, 0.2),
        sheen=0.0, sheen_tint=None, trans=0.0, emit=None, emit_strength=0.0, film=0.0, bump=0.0,
        bump_scale=40.0, ior=1.45, alpha=1.0):
    key = name
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hexc(color)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["IOR"].default_value = ior
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    p.inputs["Subsurface Weight"].default_value = sss
    p.inputs["Subsurface Radius"].default_value = sss_radius
    p.inputs["Sheen Weight"].default_value = sheen
    if sheen_tint:
        p.inputs["Sheen Tint"].default_value = hexc(sheen_tint)
    p.inputs["Transmission Weight"].default_value = trans
    p.inputs["Alpha"].default_value = alpha
    if film > 0:
        p.inputs["Thin Film Thickness"].default_value = film
        p.inputs["Thin Film IOR"].default_value = 1.4
    if emit:
        p.inputs["Emission Color"].default_value = hexc(emit)
        p.inputs["Emission Strength"].default_value = emit_strength
    if bump > 0:
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = bump_scale
        noise.inputs["Detail"].default_value = 6
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = bump
        b.inputs["Distance"].default_value = 0.02
        nt.links.new(noise.outputs["Fac"], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    _mats[key] = m
    return m


# ── Geometry helpers ──────────────────────────────────────────────────────────────────────

_parts = []


def _link(obj, material, parent=None, smooth=True):
    bpy.context.collection.objects.link(obj)
    if material is not None:
        obj.data.materials.append(material)
    if smooth and obj.type == "MESH":
        obj.data.shade_smooth()
    if parent is not None:
        obj.parent = parent
    _parts.append(obj)
    return obj


def _mesh_from(name, build):
    """Create a primitive with bpy.ops and return it unlinked-agnostic (ops link it for us)."""
    build()
    obj = bpy.context.active_object
    obj.name = name
    bpy.context.collection.objects.unlink(obj)
    return obj


def ellipsoid(name, loc, radii, material, parent=None, rot=(0, 0, 0), seg=64, subd=1):
    obj = _mesh_from(name, lambda: bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1))
    obj.location = loc
    obj.scale = radii
    obj.rotation_euler = rot
    if subd:
        m = obj.modifiers.new("Subd", "SUBSURF")
        m.levels = subd
        m.render_levels = subd
    return _link(obj, material, parent)


def torus(name, loc, major, minor, material, parent=None, rot=(0, 0, 0), scale=(1, 1, 1), arc=None):
    obj = _mesh_from(
        name,
        lambda: bpy.ops.mesh.primitive_torus_add(
            major_radius=major, minor_radius=minor, major_segments=96, minor_segments=24
        ),
    )
    obj.location = loc
    obj.rotation_euler = rot
    obj.scale = scale
    return _link(obj, material, parent)


def cylinder(name, loc, radius, depth, material, parent=None, rot=(0, 0, 0), verts=64, bevel=0.0, scale=(1, 1, 1)):
    obj = _mesh_from(
        name, lambda: bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth)
    )
    obj.location = loc
    obj.rotation_euler = rot
    obj.scale = scale
    if bevel:
        b = obj.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 5
        b.limit_method = "ANGLE"
    return _link(obj, material, parent)


def box(name, loc, size, material, parent=None, rot=(0, 0, 0), bevel=0.05):
    obj = _mesh_from(name, lambda: bpy.ops.mesh.primitive_cube_add(size=1))
    obj.location = loc
    obj.scale = size
    obj.rotation_euler = rot
    b = obj.modifiers.new("Bevel", "BEVEL")
    b.width = bevel
    b.segments = 6
    b.affect = "EDGES"
    return _link(obj, material, parent)


def cone(name, loc, r1, r2, depth, material, parent=None, rot=(0, 0, 0)):
    obj = _mesh_from(
        name,
        lambda: bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=r1, radius2=r2, depth=depth),
    )
    obj.location = loc
    obj.rotation_euler = rot
    return _link(obj, material, parent)


_family = [0]


def blob(name, elements, material, parent=None, res=0.02, threshold=0.6):
    """Metaballs merged into one smooth mesh. elements: (type, co, radius, size_xyz, rot_euler)."""
    _family[0] += 1
    mb = bpy.data.metaballs.new(f"mb{_family[0]}")
    mb.resolution = res
    mb.render_resolution = res
    mb.threshold = threshold
    tmp = bpy.data.objects.new(f"mb{_family[0]}", mb)
    bpy.context.collection.objects.link(tmp)
    for el in elements:
        kind, co, radius = el[0], el[1], el[2]
        size = el[3] if len(el) > 3 else (1, 1, 1)
        rot = el[4] if len(el) > 4 else (0, 0, 0)
        e = mb.elements.new(type=kind)
        e.co = co
        e.radius = radius
        e.size_x, e.size_y, e.size_z = size
        e.rotation = Euler(rot).to_quaternion()
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    obj = bpy.data.objects.new(name, mesh)
    return _link(obj, material, parent)


def empty(name, loc, parent=None, rot=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    e.rotation_euler = rot
    bpy.context.collection.objects.link(e)
    if parent is not None:
        e.parent = parent
    return e


def eye(prefix, loc, r, iris, parent, look=(0, -1, 0.05), pupil="#0b0a16", flat=0.72):
    """A glossy cartoon eye: white, coloured iris, pupil, two highlights."""
    sclera = mat("Sclera", "#f7f6fb", rough=0.18, coat=1.0, sss=0.08)
    iris_m = mat(f"Iris{iris}", iris, rough=0.25, coat=1.0, emit=iris, emit_strength=0.15)
    pupil_m = mat("Pupil", pupil, rough=0.1, coat=1.0)
    hi = mat("EyeHighlight", "#ffffff", emit="#ffffff", emit_strength=4.0)
    ellipsoid(f"{prefix}Eye", loc, (r, r * flat, r), sclera, parent)
    d = Vector(look).normalized()
    front = Vector(loc) + d * (r * flat * 0.82)
    ellipsoid(f"{prefix}Iris", front, (r * 0.62, r * 0.2, r * 0.62), iris_m, parent)
    ellipsoid(f"{prefix}Pupil", front + d * (r * 0.1), (r * 0.34, r * 0.12, r * 0.34), pupil_m, parent)
    ellipsoid(
        f"{prefix}Hi", front + d * (r * 0.2) + Vector((-r * 0.22, 0, r * 0.26)), (r * 0.16, r * 0.06, r * 0.16), hi, parent
    )
    ellipsoid(
        f"{prefix}Hi2", front + d * (r * 0.2) + Vector((r * 0.2, 0, -r * 0.22)), (r * 0.07, r * 0.03, r * 0.07), hi, parent
    )


# ── Rig ───────────────────────────────────────────────────────────────────────────────────


class Rig:
    """Right arm joints. Poses rotate the shoulder and elbow empties about the camera axis (Y)."""

    def __init__(self, shoulder, elbow, rest, wave):
        self.shoulder = shoulder
        self.elbow = elbow
        self.rest = rest
        self.wave = wave
        self.forearm = []

    def pose(self, which):
        s, e = self.rest if which == "rest" else self.wave
        self.shoulder.rotation_euler = (0, math.radians(s), 0)
        self.elbow.rotation_euler = (0, math.radians(e), 0)
        bpy.context.view_layer.update()


# ── Characters ────────────────────────────────────────────────────────────────────────────

TONES = {
    "teal": ("#29d7d9", "#ffb23d"),
    "blue": ("#4998fe", "#29d7d9"),
    "violet": ("#a76ef8", "#fb55b1"),
    "pink": ("#fb55b1", "#a76ef8"),
}


def astronaut(tone="teal"):
    accent, second = TONES[tone]
    suit = mat("SuitFabric", "#eeeff6", rough=0.55, sheen=0.5, sheen_tint="#dfe6ff", bump=0.15, bump_scale=90)
    shell = mat("SuitShell", "#f4f5fa", rough=0.2, coat=1.0, coat_rough=0.05)
    shade = mat("SuitShade", "#c9cbe0", rough=0.35, coat=0.6)
    acc = mat(f"Accent{accent}", accent, rough=0.3, coat=1.0, coat_rough=0.06)
    sec = mat(f"Second{second}", second, rough=0.32, coat=1.0)
    dark = mat("Panel", "#161633", rough=0.3, coat=0.8)
    sole = mat("Sole", "#2a2a44", rough=0.7)
    visor = mat("Visor", "#0a0a1e", rough=0.04, metal=0.6, coat=1.0, coat_rough=0.02, film=520)
    glow = mat(f"Glow{accent}", accent, emit=accent, emit_strength=8.0)
    glow2 = mat(f"Glow{second}", second, emit=second, emit_strength=8.0)
    eyeglow = mat("EyeGlow", "#e8fbff", emit="#dffaff", emit_strength=12.0)

    root = empty("Root", (0, 0, 0))

    # Legs, knee pads, boots.
    for side in (-1, 1):
        x = 0.24 * side
        blob(f"Leg{side}", [("CAPSULE", (x, 0, 0.5), 0.3, (0.16, 1, 1), (0, math.pi / 2, 0))], suit, root)
        ellipsoid(f"Knee{side}", (x, -0.14, 0.5), (0.12, 0.07, 0.12), shade, root)
        torus(f"Cuff{side}", (x, 0, 0.3), 0.18, 0.04, sec, root)
        ellipsoid(f"Boot{side}", (x, -0.06, 0.17), (0.21, 0.27, 0.16), acc, root)
        box(f"Sole{side}", (x, -0.07, 0.035), (0.36, 0.5, 0.07), sole, root, bevel=0.03)

    # Torso, belt, chest panel, collar.
    blob("Torso", [("ELLIPSOID", (0, 0, 1.0), 1.0, (0.76, 0.64, 0.86))], suit, root)
    torus("Belt", (0, 0, 0.72), 0.44, 0.06, sec, root, scale=(1, 0.93, 1))
    box("Buckle", (0, -0.43, 0.72), (0.22, 0.06, 0.14), dark, root, bevel=0.03)
    ellipsoid("BuckleLight", (0, -0.47, 0.72), (0.03, 0.02, 0.03), glow2, root)
    box("Chest", (0, -0.42, 1.06), (0.48, 0.1, 0.32), dark, root, rot=(math.radians(-10), 0, 0), bevel=0.05)
    box("Screen", (-0.09, -0.48, 1.09), (0.2, 0.02, 0.13), glow, root, rot=(math.radians(-10), 0, 0), bevel=0.02)
    for i, (x, z, c) in enumerate([(0.1, 1.13, "#ffb23d"), (0.18, 1.13, "#fb55b1"), (0.14, 1.03, "#4998fe")]):
        ellipsoid(f"Btn{i}", (x, -0.49, z), (0.03, 0.015, 0.03), mat(f"Btn{c}", c, rough=0.2, coat=1, emit=c, emit_strength=1.2), root)
    torus("Collar", (0, 0, 1.42), 0.38, 0.08, acc, root, scale=(1, 1, 0.9))

    # Backpack and tanks.
    box("Pack", (0, 0.44, 1.02), (0.84, 0.36, 0.82), shade, root, bevel=0.12)
    for side in (-1, 1):
        blob(f"Tank{side}", [("CAPSULE", (0.22 * side, 0.66, 1.02), 0.16, (0.26, 1, 1), (0, math.pi / 2, 0))], acc, root)
    ellipsoid("PackLight", (0, 0.64, 1.36), (0.05, 0.05, 0.05), glow2, root)

    # Left arm (rest pose), with a Realm patch.
    ls = empty("ShoulderL", (-0.52, 0, 1.24), root)
    ls.rotation_euler = (0, math.radians(18), 0)
    ellipsoid("PadL", (-0.02, 0, 0.02), (0.23, 0.23, 0.17), acc, ls)
    blob("UpperL", [("CAPSULE", (0, 0, -0.2), 0.26, (0.14, 1, 1), (0, math.pi / 2, 0))], suit, ls)
    for i in range(3):
        torus(f"BellowL{i}", (0, 0, -0.33 - i * 0.05), 0.165, 0.026, suit, ls)
    le = empty("ElbowL", (0, 0, -0.46), ls, rot=(0, math.radians(-14), 0))
    blob("ForeL", [("CAPSULE", (0, 0, -0.2), 0.25, (0.15, 1, 1), (0, math.pi / 2, 0))], suit, le)
    torus("WristL", (0, 0, -0.38), 0.155, 0.045, sec, le)
    ellipsoid("GloveL", (0, 0, -0.53), (0.18, 0.15, 0.2), acc, le)
    ellipsoid("ThumbL", (0.12, -0.07, -0.48), (0.07, 0.07, 0.09), acc, le)
    patch = mat("Patch", "#1b1640", rough=0.3, coat=0.8)
    cylinder("Patch", (-0.12, -0.08, -0.16), 0.08, 0.02, patch, ls, rot=(math.radians(90), 0, math.radians(-50)))
    torus("PatchRing", (-0.13, -0.095, -0.16), 0.055, 0.012, glow, ls, rot=(math.radians(90), 0, math.radians(-50)))

    # Right arm: the waving one.
    rs = empty("ShoulderR", (0.52, 0, 1.24), root)
    ellipsoid("PadR", (0.02, 0, 0.02), (0.23, 0.23, 0.17), acc, rs)
    blob("UpperR", [("CAPSULE", (0, 0, -0.2), 0.26, (0.14, 1, 1), (0, math.pi / 2, 0))], suit, rs)
    for i in range(3):
        torus(f"BellowR{i}", (0, 0, -0.33 - i * 0.05), 0.165, 0.026, suit, rs)
    re = empty("ElbowR", (0, 0, -0.46), rs)
    rig = Rig(rs, re, rest=(-18, 14), wave=(-128, -48))
    rig.forearm = [
        blob("ForeR", [("CAPSULE", (0, 0, -0.2), 0.25, (0.15, 1, 1), (0, math.pi / 2, 0))], suit, re),
        torus("WristR", (0, 0, -0.38), 0.155, 0.045, sec, re),
        ellipsoid("GloveR", (0, 0, -0.53), (0.18, 0.15, 0.2), acc, re),
        ellipsoid("ThumbR", (-0.12, -0.07, -0.48), (0.07, 0.07, 0.09), acc, re),
    ]

    # Head: helmet shell, rim, visor, eyes, lamps, antenna.
    head = empty("Head", (0, 0, 1.46), root)
    ellipsoid("Helmet", (0, 0, 0.5), (0.66, 0.64, 0.64), shell, head)
    torus("VisorRim", (0, -0.4, 0.5), 0.5, 0.05, acc, head, rot=(math.radians(90), 0, 0), scale=(1.06, 0.9, 1))
    ellipsoid("Visor", (0, -0.2, 0.5), (0.54, 0.47, 0.44), visor, head)
    for side in (-1, 1):
        ellipsoid(f"EyeG{side}", (0.15 * side, -0.64, 0.55), (0.06, 0.02, 0.1), eyeglow, head)
        cylinder(f"Lamp{side}", (0.64 * side, 0, 0.5), 0.13, 0.12, shade, head, rot=(0, math.radians(90), 0), bevel=0.02)
        ellipsoid(f"LampGlow{side}", (0.71 * side, 0, 0.5), (0.02, 0.09, 0.09), glow2, head)
    cylinder("Antenna", (-0.34, 0.02, 1.12), 0.018, 0.34, shade, head, rot=(0, math.radians(-20), 0))
    ellipsoid("Beacon", (-0.4, 0.02, 1.3), (0.065, 0.065, 0.065), glow, head)

    return {"root": root, "rig": rig, "head": head, "face_z": 1.96}


def capsule(name, a, b, radius, material, parent=None):
    """A smooth capsule between two points (a single metaball capsule)."""
    a = Vector(a)
    b = Vector(b)
    mid = (a + b) / 2
    d = b - a
    rot = d.to_track_quat("X", "Z").to_euler()
    # The metaball capsule's size_x is the half-length of its core segment, in object units; the
    # visible surface sits at about 0.67 of the influence radius around that segment.
    big = radius / 0.67
    return blob(name, [("CAPSULE", mid, big, (max(d.length / 2, 0.001), 1, 1), rot)], material, parent)


def arm(side, loc, root, sleeve, hand, cuff=None, upper=0.15, fore=0.14, length=(0.4, 0.36),
        hand_r=(0.15, 0.13, 0.16), fingers=0, claws=None, rest=15, elbow_rest=12):
    """An arm on a shoulder empty and an elbow empty. Returns (shoulder, elbow, forearm parts)."""
    tag = "R" if side > 0 else "L"
    sh = empty(f"Shoulder{tag}", loc, root)
    capsule(f"Upper{tag}", (0, 0, 0), (0, 0, -length[0]), upper, sleeve, sh)
    el = empty(f"Elbow{tag}", (0, 0, -length[0]), sh)
    parts = [capsule(f"Fore{tag}", (0, 0, 0), (0, 0, -length[1]), fore, sleeve, el)]
    if cuff is not None:
        parts.append(torus(f"Cuff{tag}", (0, 0, -length[1] + 0.02), fore + 0.01, 0.035, cuff, el))
    hz = -length[1] - hand_r[2] * 0.8
    parts.append(ellipsoid(f"Hand{tag}", (0, 0, hz), hand_r, hand, el))
    parts.append(
        ellipsoid(f"Thumb{tag}", (-0.1 * side, -0.07, hz + 0.04), (0.055, 0.055, 0.075), hand, el)
    )
    for i in range(fingers):
        x = (i - (fingers - 1) / 2) * 0.07
        parts.append(
            ellipsoid(f"Finger{tag}{i}", (x, -0.03, hz - hand_r[2] * 0.85), (0.04, 0.04, 0.07), hand, el)
        )
    if claws is not None:
        for i in range(3):
            x = (i - 1) * 0.07
            parts.append(
                cone(f"Claw{tag}{i}", (x, -0.05, hz - hand_r[2] - 0.03), 0.035, 0.0, 0.1, claws, el,
                     rot=(math.pi, 0, 0))
            )
    sign = -1 if side > 0 else 1
    sh.rotation_euler = (0, math.radians(rest * sign), 0)
    el.rotation_euler = (0, math.radians(elbow_rest * -sign), 0)
    return sh, el, parts


def legs(root, pants, shoe, sole_m, hip=0.2, top=0.72, radius=0.14, shoe_r=(0.17, 0.24, 0.13), stripe=None):
    for side in (-1, 1):
        x = hip * side
        capsule(f"Leg{side}", (x, 0, top), (x, 0, 0.24), radius, pants, root)
        ellipsoid(f"Shoe{side}", (x, -0.07, 0.14), shoe_r, shoe, root)
        box(f"Sole{side}", (x, -0.08, 0.03), (shoe_r[0] * 1.9, shoe_r[1] * 1.95, 0.06), sole_m, root, bevel=0.025)
        if stripe is not None:
            torus(f"Stripe{side}", (x, -0.07, 0.15), shoe_r[0] * 0.98, 0.02, stripe, root,
                  scale=(1, shoe_r[1] / shoe_r[0], 1))


def wave_rig(root, loc, sleeve, hand, **kw):
    rs, re, parts = arm(1, loc, root, sleeve, hand, **kw)
    rig = Rig(rs, re, rest=(-kw.get("rest", 15), kw.get("elbow_rest", 12)), wave=(-128, -48))
    rig.forearm = parts
    return rig


def smile(prefix, loc, width, parent, color="#2a0f24", open_=0.035, cover=None, depth=0.03):
    """A smiling mouth: a dark opening with a tongue; `cover` (the face material) trims its top
    half into a crescent."""
    mouth = mat(f"Mouth{color}", color, rough=0.4)
    x, y, z = loc
    ellipsoid(f"{prefix}Mouth", (x, y, z), (width, depth, open_ * 1.6), mouth, parent)
    tongue = mat("Tongue", "#ff6f9a", rough=0.35, sss=0.3)
    ellipsoid(f"{prefix}Tongue", (x, y - 0.006, z - open_ * 0.8), (width * 0.55, depth * 0.8, open_ * 0.6), tongue, parent)
    if cover is not None:
        ellipsoid(f"{prefix}Lip", (x, y - 0.012, z + open_ * 1.05), (width * 1.12, depth, open_ * 1.3), cover, parent)


def alien_zib():
    skin = mat("ZibSkin", "#5fe0a0", rough=0.36, coat=0.35, sss=0.35, sss_radius=(0.3, 0.8, 0.3))
    hoodie = mat("HoodieViolet", "#7157ff", rough=0.7, sheen=0.7, sheen_tint="#c8bbff", bump=0.2, bump_scale=120)
    amber = mat("Amber", "#ffb23d", rough=0.3, coat=1.0)
    glow = mat("GlowAmber", "#ffb23d", emit="#ffb23d", emit_strength=10.0)
    white = mat("Sneaker", "#f4f3fb", rough=0.45, coat=0.4)
    sole = mat("SoleDark", "#2b2a4a", rough=0.7)
    root = empty("Root", (0, 0, 0))
    legs(root, skin, white, sole, hip=0.17, top=0.62, radius=0.12, shoe_r=(0.15, 0.22, 0.12), stripe=amber)
    blob("Body", [("ELLIPSOID", (0, 0, 0.92), 1.0, (0.56, 0.46, 0.6))], hoodie, root)
    torus("Hood", (0, 0.05, 1.3), 0.3, 0.11, hoodie, root, rot=(math.radians(12), 0, 0))
    box("Pocket", (0, -0.34, 0.8), (0.4, 0.06, 0.18), hoodie, root, bevel=0.06)
    for side in (-1, 1):
        cylinder(f"String{side}", (0.09 * side, -0.33, 1.08), 0.012, 0.22, amber, root)
        ellipsoid(f"Aglet{side}", (0.09 * side, -0.33, 0.96), (0.022, 0.022, 0.035), amber, root)
    capsule("Neck", (0, 0, 1.25), (0, 0, 1.42), 0.1, skin, root)
    head = empty("Head", (0, 0, 1.45), root)
    ellipsoid("Skull", (0, 0, 0.36), (0.66, 0.54, 0.56), skin, head)
    eye("Mid", (0, -0.4, 0.48), 0.22, "#7c4dff", head, flat=0.75)
    for side in (-1, 1):
        eye(f"Side{side}", (0.31 * side, -0.35, 0.34), 0.16, "#7c4dff", head, flat=0.75)
        base = Vector((0.24 * side, 0.02, 0.84))
        d = Vector((0.45 * side, 0.1, 1.0)).normalized()
        cylinder(f"Stalk{side}", base + d * 0.22, 0.022, 0.44, skin, head, rot=d.to_track_quat("Z", "Y").to_euler())
        ellipsoid(f"Orb{side}", base + d * 0.47, (0.075, 0.075, 0.075), glow, head)
    smile("Zib", (0, -0.505, 0.1), 0.13, head, cover=skin)
    blush = mat("BlushZib", "#ff8fb8", rough=0.8, alpha=0.6)
    for side in (-1, 1):
        ellipsoid(f"Blush{side}", (0.36 * side, -0.4, 0.14), (0.08, 0.02, 0.045), blush, head)
    kw = dict(cuff=amber, upper=0.11, fore=0.1, length=(0.3, 0.28), hand_r=(0.11, 0.1, 0.12), fingers=3)
    arm(-1, (-0.38, 0, 1.14), root, hoodie, skin, **kw)
    rig = wave_rig(root, (0.38, 0, 1.14), hoodie, skin, **kw)
    return {"root": root, "rig": rig, "head": head, "face_z": 1.85}


def alien_nova():
    skin = mat("NovaSkin", "#b8a2ff", rough=0.3, coat=0.5, sss=0.3, sss_radius=(0.6, 0.4, 1.0), film=320)
    suit = mat("NovaSuit", "#17163a", rough=0.4, coat=0.6, sheen=0.3, sheen_tint="#6c5cff")
    trim = mat("GlowCyan", "#29d7d9", emit="#29d7d9", emit_strength=9.0)
    crystal = mat("Crystal", "#8fe9ff", rough=0.04, trans=0.9, ior=1.6, emit="#58d8ff", emit_strength=1.2, coat=1.0)
    boots = mat("NovaBoots", "#2c2a5c", rough=0.3, coat=0.8)
    root = empty("Root", (0, 0, 0))
    legs(root, suit, boots, boots, hip=0.15, top=0.74, radius=0.11, shoe_r=(0.13, 0.2, 0.12))
    blob("Body", [("ELLIPSOID", (0, 0, 1.0), 1.0, (0.46, 0.38, 0.62))], suit, root)
    for i, z in enumerate((0.78, 1.18)):
        torus(f"Trim{i}", (0, 0, z), 0.3 - i * 0.02, 0.018, trim, root, scale=(1, 0.84, 1))
    ellipsoid("Core", (0, -0.29, 1.08), (0.07, 0.03, 0.07), trim, root)
    capsule("Neck", (0, 0, 1.36), (0, 0, 1.5), 0.08, skin, root)
    head = empty("Head", (0, 0, 1.5), root)
    ellipsoid("Skull", (0, 0.04, 0.44), (0.5, 0.46, 0.66), skin, head)
    for side in (-1, 1):
        eye(f"Eye{side}", (0.2 * side, -0.33, 0.44), 0.16, "#29d7d9", head, flat=0.6, look=(0.08 * side, -1, 0.02))
        ellipsoid(f"Speck{side}", (0.1 * side, -0.4, 0.72), (0.022, 0.01, 0.022), trim, head)
    ellipsoid("SpeckMid", (0, -0.42, 0.8), (0.03, 0.01, 0.03), trim, head)
    smile("Nova", (0, -0.43, 0.14), 0.08, head, open_=0.022, cover=skin)
    shards = [(0, 1.02, 0.46, 0), (-0.18, 0.96, 0.34, -0.35), (0.18, 0.96, 0.36, 0.35),
              (-0.32, 0.84, 0.22, -0.7), (0.32, 0.84, 0.24, 0.7)]
    for i, (x, z, h, tilt) in enumerate(shards):
        rot = (0.15, tilt, 0)
        d = Euler(rot).to_matrix() @ Vector((0, 0, 1))
        base = Vector((x, 0.06, z))
        cylinder(f"Shard{i}", base + d * h / 2, 0.075, h, crystal, head, rot=rot, verts=6)
        cone(f"Tip{i}", base + d * (h + 0.07), 0.075, 0.0, 0.14, crystal, head, rot=rot)
    kw = dict(cuff=trim, upper=0.09, fore=0.085, length=(0.32, 0.3), hand_r=(0.1, 0.09, 0.11), fingers=3)
    arm(-1, (-0.32, 0, 1.2), root, suit, skin, **kw)
    rig = wave_rig(root, (0.32, 0, 1.2), suit, skin, **kw)
    return {"root": root, "rig": rig, "head": head, "face_z": 1.98}


def monster_gloop():
    jelly = mat("Jelly", "#ff4fa8", rough=0.07, coat=1.0, trans=0.5, sss=0.35, sss_radius=(1.0, 0.3, 0.6), ior=1.33)
    horn = mat("Horn", "#fff0d6", rough=0.35, coat=0.6)
    bubble = mat("Bubble", "#ffffff", rough=0.0, trans=1.0, ior=1.1)
    root = empty("Root", (0, 0, 0))
    drips = [
        ("BALL", (math.cos(a) * 0.52, math.sin(a) * 0.46 - 0.02, 0.16), 0.3)
        for a in [i * math.tau / 7 for i in range(7)]
    ]
    blob("Body", [("ELLIPSOID", (0, 0, 0.72), 1.25, (0.86, 0.76, 0.62)),
                  ("ELLIPSOID", (0, 0, 1.25), 1.0, (0.7, 0.62, 0.72)), *drips], jelly, root, res=0.018)
    bubbles = [(-0.2, 0.05, 0.6, 0.06), (0.25, -0.1, 0.9, 0.045), (0.05, 0.15, 1.1, 0.05),
               (-0.3, -0.05, 1.05, 0.035), (0.3, 0.1, 0.5, 0.04)]
    for i, (x, y, z, r) in enumerate(bubbles):
        ellipsoid(f"Bubble{i}", (x, y, z), (r, r, r), bubble, root)
    head = empty("Head", (0, 0, 1.2), root)
    eye("Big", (0, -0.38, 0.2), 0.3, "#ffb23d", head, flat=0.8)
    for side in (-1, 1):
        cone(f"Horn{side}", (0.3 * side, 0.02, 0.62), 0.09, 0.0, 0.3, horn, head, rot=(0, math.radians(22 * side), 0))
    smile("Gloop", (0, -0.6, -0.3), 0.21, head, open_=0.06, cover=jelly, depth=0.04)
    cone("Fang", (0.08, -0.62, -0.24), 0.03, 0.0, 0.07, horn, head, rot=(math.pi, 0, 0))
    kw = dict(upper=0.13, fore=0.12, length=(0.2, 0.2), hand_r=(0.13, 0.12, 0.13), rest=35)
    arm(-1, (-0.6, -0.05, 0.9), root, jelly, jelly, **kw)
    rig = wave_rig(root, (0.6, -0.05, 0.9), jelly, jelly, **kw)
    return {"root": root, "rig": rig, "head": head, "face_z": 1.3}


def monster_bruno():
    plush = mat("Plush", "#5a55e8", rough=0.85, sheen=1.0, sheen_tint="#c3bfff", bump=0.4, bump_scale=180)
    belly = mat("Belly", "#cdc8ff", rough=0.85, sheen=1.0, sheen_tint="#ffffff", bump=0.35, bump_scale=180)
    horn = mat("HornCream", "#ffe6c4", rough=0.35, coat=0.6)
    mouth = mat("MouthDeep", "#1a0b2b", rough=0.5)
    tooth = mat("Tooth", "#fffaf0", rough=0.25, coat=0.8)
    brow = mat("Brow", "#2a2470", rough=0.7, sheen=0.6)
    root = empty("Root", (0, 0, 0))
    blob("Body", [("ELLIPSOID", (0, 0, 1.02), 1.35, (0.8, 0.7, 0.78))], plush, root, res=0.02)
    ellipsoid("BellyPatch", (0, -0.5, 0.86), (0.46, 0.2, 0.44), belly, root)
    for side in (-1, 1):
        ellipsoid(f"Foot{side}", (0.3 * side, -0.25, 0.1), (0.2, 0.26, 0.12), plush, root)
        for j in range(3):
            ellipsoid(f"Toe{side}{j}", (0.3 * side + (j - 1) * 0.08, -0.48, 0.08), (0.045, 0.04, 0.04), horn, root)
    head = empty("Head", (0, 0, 1.2), root)
    for side in (-1, 1):
        eye(f"Eye{side}", (0.24 * side, -0.52, 0.3), 0.16, "#29d7d9", head, flat=0.75)
        capsule(f"Brow{side}", (0.13 * side, -0.62, 0.52), (0.34 * side, -0.58, 0.48), 0.035, brow, head)
        chain = []
        for k in range(9):
            t = k / 8
            x = (0.38 + 0.2 * t + 0.1 * t * t) * side
            z = 0.58 + 0.36 * t - 0.04 * t * t
            chain.append(("BALL", (x, 0.04, z), (0.15 - 0.11 * t) / 0.67))
        blob(f"Horn{side}", chain, horn, head, res=0.012)
    ellipsoid("Mouth", (0, -0.6, -0.08), (0.32, 0.1, 0.14), mouth, head)
    for side in (-1, 1):
        box(f"Tooth{side}", (0.11 * side, -0.67, 0.02), (0.1, 0.05, 0.1), tooth, head, bevel=0.02)
    ellipsoid("TongueB", (0, -0.64, -0.15), (0.16, 0.06, 0.05), mat("Tongue", "#ff6f9a", rough=0.35, sss=0.3), head)
    kw = dict(upper=0.15, fore=0.14, length=(0.26, 0.24), hand_r=(0.15, 0.13, 0.15), claws=horn, rest=30)
    arm(-1, (-0.66, 0, 1.0), root, plush, plush, **kw)
    rig = wave_rig(root, (0.66, 0, 1.0), plush, plush, **kw)
    return {"root": root, "rig": rig, "head": head, "face_z": 1.45}


def human(name, skin_hex, hair_hex, top_hex, pants_hex, curly=False, glasses=False, headset=True, ponytail=False):
    import random

    skin = mat(f"Skin{name}", skin_hex, rough=0.42, sss=0.28, sss_radius=(1.0, 0.35, 0.2), coat=0.1)
    hair = mat(f"Hair{name}", hair_hex, rough=0.4, coat=0.35, sheen=0.4, sheen_tint="#8f7bff", bump=0.25, bump_scale=60)
    top = mat(f"Top{name}", top_hex, rough=0.72, sheen=0.6, sheen_tint="#ffffff", bump=0.2, bump_scale=120)
    pants = mat(f"Pants{name}", pants_hex, rough=0.75, sheen=0.3, bump=0.2, bump_scale=140)
    white = mat("Sneaker", "#f4f3fb", rough=0.45, coat=0.4)
    sole = mat("SoleDark", "#2b2a4a", rough=0.7)
    amber = mat("Amber", "#ffb23d", rough=0.3, coat=1.0)
    dark = mat("Gear", "#1c1b38", rough=0.3, coat=0.8)
    glow = mat("GlowAmber", "#ffb23d", emit="#ffb23d", emit_strength=10.0)
    brow = mat(f"Brow{name}", hair_hex, rough=0.6)
    blush = mat(f"Blush{name}", "#ff8f9f", rough=0.85, alpha=0.45)
    root = empty("Root", (0, 0, 0))
    legs(root, pants, white, sole, hip=0.15, top=0.74, radius=0.12, shoe_r=(0.15, 0.23, 0.12), stripe=amber)
    blob("Body", [("ELLIPSOID", (0, 0, 1.02), 1.0, (0.54, 0.42, 0.56))], top, root)
    torus("Hood", (0, 0.06, 1.36), 0.24, 0.09, top, root, rot=(math.radians(14), 0, 0))
    if not headset:
        torus("NeckBand", (0, -0.02, 1.38), 0.24, 0.03, dark, root, rot=(math.radians(-10), 0, 0))
        for side in (-1, 1):
            cylinder(f"NeckCup{side}", (0.24 * side, -0.08, 1.36), 0.09, 0.07, dark, root,
                     rot=(0, math.radians(90), 0), bevel=0.02)
    capsule("Neck", (0, 0, 1.3), (0, 0, 1.46), 0.085, skin, root)
    head = empty("Head", (0, 0, 1.46), root)
    ellipsoid("Skull", (0, 0, 0.4), (0.44, 0.4, 0.47), skin, head)
    for side in (-1, 1):
        ellipsoid(f"Ear{side}", (0.43 * side, 0.02, 0.38), (0.06, 0.05, 0.09), skin, head)
        eye(f"Eye{side}", (0.16 * side, -0.29, 0.43), 0.11, "#6b3a1e", head, flat=0.62)
        capsule(f"Brow{side}", (0.08 * side, -0.38, 0.58), (0.23 * side, -0.35, 0.57), 0.022, brow, head)
        ellipsoid(f"Blush{side}", (0.25 * side, -0.35, 0.3), (0.07, 0.015, 0.04), blush, head)
    ellipsoid("Nose", (0, -0.41, 0.34), (0.045, 0.04, 0.05), skin, head)
    smile(name, (0, -0.37, 0.19), 0.1, head, open_=0.028, cover=skin)
    if curly:
        rnd = random.Random(7)
        balls = []
        for _ in range(46):
            th = rnd.uniform(0, math.tau)
            ph = rnd.uniform(0.0, 1.25)
            r = 0.44
            co = (math.sin(ph) * math.cos(th) * r, math.sin(ph) * math.sin(th) * r * 0.95 + 0.03, 0.42 + math.cos(ph) * r * 1.05)
            if co[1] < -0.25 and co[2] < 0.7:
                continue
            balls.append(("BALL", co, rnd.uniform(0.15, 0.2)))
        blob("Hair", balls, hair, head, res=0.016)
    else:
        blob("Hair", [
            # Crown and back, sitting high so the forehead stays clear.
            ("ELLIPSOID", (0, 0.08, 0.58), 1.0, (0.7, 0.66, 0.6)),
            # A side-parted fringe sweeping across the top of the forehead.
            ("ELLIPSOID", (-0.12, -0.26, 0.8), 0.5, (0.5, 0.26, 0.2), (0, 0.35, 0)),
            ("ELLIPSOID", (0.18, -0.24, 0.78), 0.42, (0.46, 0.24, 0.18), (0, -0.5, 0)),
            # Long side locks falling past the ears to the shoulders.
            ("CAPSULE", (-0.4, 0.06, 0.18), 0.26, (0.28, 1, 1), (0, math.pi / 2, 0)),
            ("CAPSULE", (0.4, 0.06, 0.18), 0.26, (0.28, 1, 1), (0, math.pi / 2, 0)),
            ("ELLIPSOID", (0, 0.22, 0.12), 0.9, (0.62, 0.34, 0.5)),
        ], hair, head, res=0.016)
        if ponytail:
            blob("Ponytail", [("BALL", (0, 0.44, 0.66), 0.26), ("BALL", (0, 0.56, 0.44), 0.24),
                              ("BALL", (0, 0.58, 0.22), 0.2), ("BALL", (0, 0.54, 0.04), 0.15)], hair, head, res=0.016)
            torus("Tie", (0, 0.46, 0.62), 0.07, 0.025, amber, head, rot=(math.radians(70), 0, 0))
    if glasses:
        frame = mat("Frames", "#1b1a33", rough=0.2, coat=1.0, metal=0.3)
        lens = mat("Lens", "#ffffff", rough=0.0, trans=1.0, ior=1.3)
        for side in (-1, 1):
            torus(f"Rim{side}", (0.155 * side, -0.4, 0.42), 0.1, 0.014, frame, head, rot=(math.radians(90), 0, 0))
            cylinder(f"Glass{side}", (0.155 * side, -0.405, 0.42), 0.095, 0.01, lens, head, rot=(math.radians(90), 0, 0))
        cylinder("Bridge", (0, -0.41, 0.45), 0.012, 0.1, frame, head, rot=(0, math.radians(90), 0))
    if headset:
        torus("Band", (0, 0.02, 0.44), 0.47, 0.035, dark, head, rot=(math.radians(90), 0, 0), scale=(1, 1, 1.12))
        for side in (-1, 1):
            cylinder(f"Cup{side}", (0.46 * side, 0.02, 0.38), 0.13, 0.1, dark, head, rot=(0, math.radians(90), 0), bevel=0.03)
            torus(f"CupRing{side}", (0.52 * side, 0.02, 0.38), 0.1, 0.018, glow, head, rot=(0, math.radians(90), 0))
        capsule("Boom", (0.47, -0.06, 0.32), (0.22, -0.36, 0.16), 0.018, dark, head)
        ellipsoid("Mic", (0.2, -0.38, 0.15), (0.04, 0.04, 0.04), glow, head)
    kw = dict(cuff=top, upper=0.1, fore=0.095, length=(0.34, 0.3), hand_r=(0.1, 0.085, 0.12))
    arm(-1, (-0.36, 0, 1.22), root, top, skin, **kw)
    rig = wave_rig(root, (0.36, 0, 1.22), top, skin, **kw)
    return {"root": root, "rig": rig, "head": head, "face_z": 1.9}


BUILDERS = {
    "astro-teal": lambda: astronaut("teal"),
    "astro-violet": lambda: astronaut("violet"),
    "astro-blue": lambda: astronaut("blue"),
    "astro-pink": lambda: astronaut("pink"),
    "alien-zib": alien_zib,
    "alien-nova": alien_nova,
    "monster-gloop": monster_gloop,
    "monster-bruno": monster_bruno,
    "human-maya": lambda: human("Maya", "#b97a52", "#2a1c36", "#7157ff", "#23224a", ponytail=True),
    "human-leo": lambda: human("Leo", "#f1c7a6", "#3b2417", "#16b3c4", "#1d1c3d", curly=True, glasses=True,
                               headset=False),
}


# ── Camera and rendering ──────────────────────────────────────────────────────────────────


def world_bbox(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != "MESH":
            continue
        ev = o.evaluated_get(dg)
        for c in ev.bound_box:
            w = ev.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def make_camera(lo, hi, turn, lens=85, margin=1.12):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = lens
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    center = (lo + hi) / 2
    size = max(hi.x - lo.x, hi.z - lo.z) * margin
    fov = 2 * math.atan(cam_data.sensor_width / (2 * lens))
    dist = size / (2 * math.tan(fov / 2)) + (hi.y - lo.y)
    elev = math.radians(6)
    direction = Vector((math.sin(turn) * math.cos(elev), -math.cos(turn) * math.cos(elev), math.sin(elev)))
    cam.location = center + direction * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    return cam


def render(path):
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--who", required=True)
    ap.add_argument("--res", type=int, default=900)
    ap.add_argument("--samples", type=int, default=160)
    ap.add_argument("--turn", type=float, default=0.22)
    ap.add_argument("--only", default="rest,body,forearm,face")
    ap.add_argument("--glb", default="")
    a = ap.parse_args(argv)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    reset()
    setup_render(a.res, a.samples)
    setup_world()
    setup_lights()
    ch = BUILDERS[a.who]()
    rig = ch["rig"]
    meshes = [o for o in _parts if o.type == "MESH"]

    # One camera for every full-body render, framed on both poses, so the layers line up.
    rig.pose("rest")
    lo1, hi1 = world_bbox(meshes)
    rig.pose("wave")
    lo2, hi2 = world_bbox(meshes)
    lo = Vector(map(min, lo1, lo2))
    hi = Vector(map(max, hi1, hi2))
    cam = make_camera(lo, hi, a.turn)
    only = set(a.only.split(","))
    info = {"who": a.who, "res": a.res}

    if "rest" in only:
        rig.pose("rest")
        render(out / f"{a.who}.png")

    rig.pose("wave")
    forearm = set(rig.forearm)
    if "body" in only:
        for o in forearm:
            o.hide_render = True
        render(out / f"{a.who}-body.png")
        for o in forearm:
            o.hide_render = False
    if "forearm" in only:
        for o in meshes:
            if o not in forearm:
                o.is_holdout = True
        render(out / f"{a.who}-forearm.png")
        for o in meshes:
            o.is_holdout = False
    elbow = world_to_camera_view(bpy.context.scene, cam, rig.elbow.matrix_world.translation)
    info["elbow"] = {"x": elbow.x, "y": 1 - elbow.y}

    if "face" in only:
        rig.pose("rest")
        bpy.data.objects.remove(cam)
        fz = ch["face_z"]
        lo_f = Vector((lo.x * 0.62, lo.y, fz - 0.62))
        hi_f = Vector((hi.x * 0.62, hi.y, fz + 0.62))
        make_camera(lo_f, hi_f, a.turn * 0.5, lens=85, margin=1.0)
        bpy.context.scene.render.resolution_x = 512
        bpy.context.scene.render.resolution_y = 512
        render(out / f"{a.who}-face.png")

    if a.glb:
        # A lighter copy for the live web scene: no subdivision, dense metaball meshes decimated,
        # the arm joints kept as named nodes (ShoulderR, ElbowR) so the page can make it wave.
        rig.pose("rest")
        dg = bpy.context.evaluated_depsgraph_get()
        for o in meshes:
            for m in o.modifiers:
                if m.type == "SUBSURF":
                    m.levels = 0
            # A triangle budget by size on screen: an eye highlight needs far less than a body.
            lo_o, hi_o = world_bbox([o])
            span = (hi_o - lo_o).length
            budget = int(min(3200, max(120, span * span * 2600)))
            tris = sum(len(p.vertices) - 2 for p in o.evaluated_get(dg).data.polygons)
            if tris > budget:
                d = o.modifiers.new("Decimate", "DECIMATE")
                d.ratio = max(0.02, budget / tris)
            o.is_holdout = False
            o.hide_render = False
        bpy.ops.export_scene.gltf(
            filepath=a.glb,
            export_format="GLB",
            export_apply=True,
            export_yup=True,
            export_cameras=False,
            export_lights=False,
            export_extras=False,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=7,
            export_draco_position_quantization=14,
            export_draco_normal_quantization=10,
        )

    (out / f"{a.who}.json").write_text(json.dumps(info, indent=2))
    print("CAST", json.dumps(info))


main()
