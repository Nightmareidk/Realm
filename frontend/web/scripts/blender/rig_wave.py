"""Rig a posed character's raised arm and give it a real wave, for the web.

The characters are made in Meshy standing with one hand up, as a single unrigged mesh. This stands
the model up at a fixed height, slims it for the web, and builds a small skeleton on the raised
arm: shoulder, elbow, wrist and hand. Each vertex is weighted by where it sits along that arm
(smoothly blended across each joint), and only inside a capsule around the arm, so nothing else on
the body can bend, and each joint bends over a short span so the forearm and hand stay solid. A
"Wave" action swings the forearm side to side about the elbow, the hand following a touch behind,
twice, then settles back to the pose.

Outputs:
  --glb     the rigged, animated model (Draco, WebP textures) for the live 3D hero
  --frames  a folder of PNG frames of the wave (transparent), for the page's 2D art, and arm.json:
            the screen area the arm moves through over the wave (0..1, from the top left)

Joints are model-space (x, z) points on the stood-up model (2.75 high, feet at z 0, centred), read
off a front view; depth is found from the mesh.

    blender -b --factory-startup --python rig_wave.py -- --in model.glb --glb out.glb \
        --frames dir --shoulder 0.3,1.6 --elbow 0.43,1.33 --wrist 0.6,1.7 --tip 0.72,2.05 \
        [--radius 0.16] [--guard 0.4] [--tris 60000] [--tex 1024] [--res 640] [--samples 64]
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Quaternion, Vector

HEIGHT = 2.75


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--glb", default="")
    p.add_argument("--frames", default="")
    for j in ("shoulder", "elbow", "wrist", "tip"):
        p.add_argument(f"--{j}", required=True, help="x,z")
    p.add_argument("--radius", type=float, default=0.16, help="the forearm's thickness")
    p.add_argument(
        "--hand-radius",
        type=float,
        default=0.0,
        help="how far the hand's fingers may reach from the wrist-to-tip line (0: 2.6 x radius)",
    )
    p.add_argument(
        "--guard",
        type=float,
        default=None,
        help="x beyond which (away from the body's centre) the hand may be weighted",
    )
    p.add_argument("--swing", type=float, default=1.0, help="scale the wave's angles")
    p.add_argument("--tris", type=int, default=60000)
    p.add_argument("--tex", type=int, default=1024)
    p.add_argument("--res", type=int, default=640)
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--turn", type=float, default=0.22)
    p.add_argument("--step", type=int, default=1, help="render every nth frame")
    return p.parse_args(argv)


def xz(s):
    x, z = (float(v) for v in s.split(","))
    return x, z


def smoothstep(a, b, x):
    if b <= a:
        return 1.0 if x >= b else 0.0
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def bounds(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def prepare(a):
    """Import, join into one mesh, stand up at HEIGHT (feet on the ground, centred), slim."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=a.src)
    objs = mesh_objects()
    # Unparent from any import empties, keeping the world transform.
    for o in objs:
        m = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = m
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # The importer splits the mesh along its texture seams; weld it back into one surface (texture
    # coordinates live on the faces, so they survive) so the arm can be found by walking the mesh.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(body.data)
    bm.free()
    lo, hi = bounds([body])
    s = HEIGHT / (hi.z - lo.z)
    body.scale = (s, s, s)
    bpy.ops.object.transform_apply(scale=True)
    lo, hi = bounds([body])
    body.location = ((lo.x + hi.x) / -2, (lo.y + hi.y) / -2, -lo.z)
    bpy.ops.object.transform_apply(location=True)

    body.data.calc_loop_triangles()
    tris = len(body.data.loop_triangles)
    if tris > a.tris:
        mod = body.modifiers.new("decimate", "DECIMATE")
        mod.ratio = a.tris / tris
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for img in bpy.data.images:
        w, h = img.size
        if max(w, h) > a.tex:
            k = a.tex / max(w, h)
            img.scale(max(1, round(w * k)), max(1, round(h * k)))
    return body


def joint_depth(body, x, z, r=0.12):
    """The mean depth of the mesh around a front-view point: where the arm actually is."""
    ys = [v.co.y for v in body.data.vertices if (v.co.x - x) ** 2 + (v.co.z - z) ** 2 < r * r]
    return sum(ys) / len(ys) if ys else 0.0


def build_rig(body, a):
    if not a.hand_radius:
        a.hand_radius = a.radius * 2.6
    pts = {}
    for j in ("shoulder", "elbow", "wrist", "tip"):
        x, z = xz(getattr(a, j))
        pts[j] = Vector((x, joint_depth(body, x, z), z))

    arm_data = bpy.data.armatures.new("Rig")
    rig = bpy.data.objects.new("Rig", arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    root = eb.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.4)
    chain = [("Upper", "shoulder", "elbow"), ("Fore", "elbow", "wrist"), ("Hand", "wrist", "tip")]
    parent = root
    for name, h, t in chain:
        b = eb.new(name)
        b.head = pts[h]
        b.tail = pts[t]
        b.parent = parent
        b.use_connect = parent is not root
        parent = b
    bpy.ops.object.mode_set(mode="OBJECT")

    # Which vertices move: the whole forearm and hand as one connected piece of the mesh, found by
    # walking the mesh from the fingertips back toward the elbow. Every finger is part of it however
    # far it spreads (a capsule around the arm's centre line left the outer fingers half behind, so
    # they stretched), and nothing that merely sits near the hand (a helmet, an ear, hair) is, unless
    # the mesh actually joins it to the hand.
    segs = [(pts["shoulder"], pts["elbow"]), (pts["elbow"], pts["wrist"]), (pts["wrist"], pts["tip"])]
    lens = [(b_ - a_).length for a_, b_ in segs]
    s_elbow = lens[0]
    s_wrist = lens[0] + lens[1]
    side = 1.0 if pts["tip"].x > 0 else -1.0
    verts = body.data.vertices
    n = len(verts)
    arc = [0.0] * n
    allowed = [False] * n
    for v in verts:
        p = v.co
        best = None
        for i, (p0, p1) in enumerate(segs):
            d = p1 - p0
            t = max(0.0, min(1.0, (p - p0).dot(d) / d.length_squared))
            dist = (p - (p0 + d * t)).length
            if best is None or dist < best[0]:
                best = (dist, i, t)
        dist, i, t = best
        arc[v.index] = sum(lens[:i]) + t * lens[i]
        reach = a.radius * 1.4 if i == 1 else a.hand_radius
        # The guard keeps the body beside the elbow out of the forearm; the hand needs none (a
        # head or ear near it isn't joined to it), and a guard there would cut through a thumb.
        allowed[v.index] = (
            i >= 1
            and arc[v.index] >= s_elbow - 0.08
            and dist < reach
            and (i == 2 or a.guard is None or side * p.x >= side * a.guard)
        )
    adj = [[] for _ in range(n)]
    for e in body.data.edges:
        i, j = e.vertices
        adj[i].append(j)
        adj[j].append(i)
    seed = min((v.index for v in verts if allowed[v.index]), key=lambda k: (verts[k].co - pts["tip"]).length)
    member = [0.0] * n
    member[seed] = 1.0
    todo = [seed]
    while todo:
        k = todo.pop()
        for j in adj[k]:
            if allowed[j] and member[j] == 0.0:
                member[j] = 1.0
                todo.append(j)
    # A soft rim a few vertices wide where the piece meets the rest of the mesh, so nothing tears.
    for _ in range(3):
        nxt = member[:]
        for k in range(n):
            if member[k] < 1.0 and adj[k]:
                nxt[k] = max(member[k], sum(member[j] for j in adj[k]) / (len(adj[k]) + 1))
        member = nxt
    print("RIG moving vertices", sum(1 for m in member if m >= 1.0), "of", n)

    # Crisp joints: the bend happens over a short span, like a real elbow and wrist, so the forearm
    # and hand stay solid instead of stretching like rubber.
    blend = 0.025
    groups = {g: body.vertex_groups.new(name=g) for g in ("Root", "Upper", "Fore", "Hand")}
    for v in verts:
        m = member[v.index]
        if m <= 0.0:
            groups["Root"].add([v.index], 1.0, "REPLACE")
            continue
        s_ = arc[v.index]
        w_hand = smoothstep(s_wrist - blend, s_wrist + blend, s_)
        w_fore = smoothstep(s_elbow - blend, s_elbow + blend, s_) * (1.0 - w_hand)
        w_upper = max(0.0, 1.0 - w_fore - w_hand)
        weights = {
            "Root": 1.0 - m,
            "Upper": w_upper * m,
            "Fore": w_fore * m,
            "Hand": w_hand * m,
        }
        for g, w in weights.items():
            if w > 1e-4:
                groups[g].add([v.index], w, "REPLACE")

    body.parent = rig
    mod = body.modifiers.new("Rig", "ARMATURE")
    mod.object = rig
    return rig, side


def animate(rig, side, swing):
    """The hello: the forearm swings out and back from the elbow, the hand firm, a touch behind."""
    bpy.context.scene.render.fps = 24
    action = bpy.data.actions.new("Wave")
    rig.animation_data_create()
    rig.animation_data.action = action
    world_y = Vector((0, 1, 0))
    axes = {}
    for name in ("Upper", "Fore", "Hand"):
        pb = rig.pose.bones[name]
        pb.rotation_mode = "QUATERNION"
        axes[name] = rig.data.bones[name].matrix_local.to_3x3().inverted() @ world_y
    # A natural hello: the forearm swings side to side from the elbow as one solid piece, leaning
    # outward so the hand clears the head, and the hand stays firm, following a touch behind. Two
    # swings, easing in from the pose and back to it. Degrees; positive swings away from the body.
    period = 17.0
    keys = []
    for f in range(0, 41, 2):
        env = smoothstep(0, 7, f) * (1.0 - smoothstep(29, 40, f))
        ph = 2 * math.pi * (f - 2) / period
        keys.append((f, 0.0, env * (4 + 16 * math.sin(ph)), 5 * env * math.sin(ph - 0.7)))
    for f, up, fore, hand in keys:
        for name, deg in (("Upper", up), ("Fore", fore), ("Hand", hand)):
            pb = rig.pose.bones[name]
            pb.rotation_quaternion = Quaternion(axes[name], math.radians(deg * swing) * side)
            pb.keyframe_insert("rotation_quaternion", frame=f)
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = 40
    return action


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_cameras=False,
        export_lights=False,
        export_image_format="WEBP",
        export_image_quality=86,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
    )


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
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Punchy", "Punchy", "AgX - Medium High Contrast"):
        try:
            sc.view_settings.look = look
            break
        except TypeError:
            continue
    world = bpy.data.worlds.new("Studio")
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.62, 0.6, 0.72, 1)
    bg.inputs["Strength"].default_value = 0.45
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    t = Vector((0, 0, HEIGHT * 0.45))
    k = HEIGHT / 2.2
    for name, loc, energy, size, color in (
        ("Key", (-3.2, -4.2, 4.6), 950, 4.0, (1.0, 0.95, 0.9)),
        ("Fill", (4.2, -3.4, 1.8), 300, 5.0, (0.88, 0.9, 1.0)),
        ("RimCool", (3.4, 3.2, 3.6), 900, 2.2, (0.62, 0.66, 1.0)),
        ("RimWarm", (-3.6, 3.0, 2.6), 650, 2.2, (1.0, 0.72, 0.45)),
        ("Top", (0.0, -0.6, 6.0), 260, 3.0, (1.0, 1.0, 1.0)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy * k * k
        data.size = size * k
        data.color = color
        obj = bpy.data.objects.new(name, data)
        sc.collection.objects.link(obj)
        obj.location = Vector(loc) * k
        obj.rotation_euler = (t - obj.location).to_track_quat("-Z", "Y").to_euler()


def camera(body, turn, lens=85):
    """The page art's camera (render_model.py's): framed on the figure with room for the wave."""
    lo, hi = bounds([body])
    data = bpy.data.cameras.new("Cam")
    data.lens = lens
    cam = bpy.data.objects.new("Cam", data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    size = max(hi.x - lo.x, hi.z - lo.z) * 1.16
    fov = 2 * math.atan(data.sensor_width / (2 * lens))
    dist = size / (2 * math.tan(fov / 2)) + (hi.y - lo.y)
    elev = math.radians(6)
    d = Vector((math.sin(turn) * math.cos(elev), -math.cos(turn) * math.cos(elev), math.sin(elev)))
    center = (lo + hi) / 2
    cam.location = center + d * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()


def moving_area(body):
    """Where the arm goes on screen over the whole wave: the union, across every frame, of the
    projected vertices that the arm bones move. Returns (x0, y0, x1, y1), 0..1 from the top left."""
    sc = bpy.context.scene
    cam = sc.camera
    root = body.vertex_groups["Root"].index
    moving = []
    for v in body.data.vertices:
        w = next((g.weight for g in v.groups if g.group == root), 0.0)
        if w < 0.995:
            moving.append(v.index)
    x0 = y0 = 1.0
    x1 = y1 = 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    for f in range(sc.frame_start, sc.frame_end + 1):
        sc.frame_set(f)
        ev = body.evaluated_get(dg)
        mesh = ev.to_mesh()
        mw = ev.matrix_world
        for i in moving:
            p = world_to_camera_view(sc, cam, mw @ mesh.vertices[i].co)
            x0, x1 = min(x0, p.x), max(x1, p.x)
            y0, y1 = min(y0, 1 - p.y), max(y1, 1 - p.y)
        ev.to_mesh_clear()
    return x0, y0, x1, y1


def main():
    a = parse()
    body = prepare(a)
    rig, side = build_rig(body, a)
    animate(rig, side, a.swing)
    if a.glb:
        export(a.glb)
        print("RIG glb", a.glb)
    if a.frames:
        out = Path(a.frames)
        out.mkdir(parents=True, exist_ok=True)
        setup_render(a.res, a.samples)
        camera(body, a.turn)
        box = moving_area(body)
        (out / "arm.json").write_text(json.dumps({"box": box}))
        sc = bpy.context.scene
        for f in range(0, 41, a.step):
            sc.frame_set(f)
            sc.render.filepath = str(out / f"{f:03d}.png")
            bpy.ops.render.render(write_still=True)
        print("RIG frames", out)


main()
