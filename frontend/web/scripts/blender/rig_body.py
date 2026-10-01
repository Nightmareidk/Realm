"""Give a posed character a full-body skeleton and animate it, for the web.

Meshy characters come as a single unrigged mesh, standing (one hand up). This stands the model at
a fixed height, slims it, and builds a skeleton on joints read off a front view: pelvis, spine,
head, and both arms (shoulder, elbow, wrist, fingertips) and legs (hip, knee, ankle, toe).

Weights: every vertex goes to the bone it's nearest (distance measured against each bone's own
thickness, so a slim arm beside a wide chest still wins its own vertices), then the weights are
smoothed a few times across the mesh's own edges, so joints bend softly but pieces that don't
touch (a hand beside a helmet) never pull on each other.

Actions, all keyed here by hand (FK), 24 fps, for the astronaut on Meshy's rig: its raised right
arm swings free from the shoulder, and its hanging left arm, fused to the suit down its inner side
in Meshy's remesh, strokes forward and back more than out:
  Float    4 s loop  zero-g idle: treading space, arms drifting, legs slowly cycling, looking round
  Swim     1 s loop  clawing toward you: alternating strokes up and out, scissor kicks
  Flail    0.75 s    panic: arms windmilling, legs kicking, head thrashing
  Spread   2 s loop  spread-eagle in a tumble: limbs flung out, slowly flailing
  Wave     1.7 s     a hello with the raised hand (the forearm swings from the elbow)

    blender -b --factory-startup --python rig_body.py -- --in model.glb --out rigged.glb \
        --joints joints.json [--tris 70000] [--tex 1024] [--preview dir]

Or, for a character the product owner has rigged in Meshy (its auto-rig: a skeleton fitted to the
posed model, with Meshy's own skin weights), keep that skeleton and its weights and only animate
it. The rig's bones are numbered, not named, so a map names the ones the actions turn:

    blender -b --factory-startup --python rig_body.py -- --in rigged.glb --out out.glb \
        --bones scripts/blender/joints/<who>-rig.json
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

HEIGHT = 2.75
FPS = 24


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--out", default="")
    p.add_argument("--joints", help="joints read off a front view, to build a skeleton on")
    p.add_argument("--bones", help="or: names for the bones of the model's own (Meshy) rig")
    p.add_argument("--tris", type=int, default=70000)
    p.add_argument("--tex", type=int, default=1024)
    p.add_argument("--preview", default="", help="render a contact sheet of each action here")
    p.add_argument("--no-draco", action="store_true")
    p.add_argument("--weights", default="heat", choices=["heat", "nearest"])
    return p.parse_args(argv)


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ── The model ─────────────────────────────────────────────────────────────────────────────────


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
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=a.src)
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
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
    # The importer splits the surface along its texture seams; weld it back into one (the texture
    # coordinates live on the faces, so they survive), so weights can flow across the seams.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(body.data)
    bm.free()
    for img in bpy.data.images:
        w, h = img.size
        if max(w, h) > a.tex:
            k = a.tex / max(w, h)
            img.scale(max(1, round(w * k)), max(1, round(h * k)))
    return body


def prepare_rigged(a, names):
    """The model with its own skeleton: stood HEIGHT high like the others (baked into the mesh and
    the bones' rest pose), the bones renamed to what the actions call them, and slimmed."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=a.src)
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.find_armature() == rig]
    # Anything else (Meshy leaves a stray icosphere in) goes.
    for o in list(bpy.context.scene.objects):
        if o is not rig and o not in meshes:
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    bpy.context.view_layer.update()
    lo, hi = bounds([body])
    k = HEIGHT / (hi.z - lo.z)
    stand = Matrix.Scale(k, 4) @ Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)))
    body_world = body.matrix_world.copy()
    body.parent = None
    body.data.transform(stand @ body_world)
    body.matrix_world = Matrix()
    rig.data.transform(stand @ rig.matrix_world)
    rig.matrix_world = Matrix()
    body.parent = rig
    body.matrix_parent_inverse = Matrix()
    for old, new in names.items():
        bone = rig.data.bones.get(old)
        if not bone:
            raise SystemExit(f"no bone {old} in the rig")
        bone.name = new
        g = body.vertex_groups.get(old)
        if g:
            g.name = new
    body.data.calc_loop_triangles()
    tris = len(body.data.loop_triangles)
    if tris > a.tris:
        mod = body.modifiers.new("decimate", "DECIMATE")
        mod.ratio = a.tris / tris
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for img in bpy.data.images:
        w, h = img.size
        if max(w, h) > a.tex:
            f = a.tex / max(w, h)
            img.scale(max(1, round(w * f)), max(1, round(h * f)))
    mirror(body, rig)
    untangle(body, rig)
    # Four bones a vertex at most (all a glTF skin carries), and every vertex's weights summing to one.
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    print("RIG meshy rig:", len(rig.data.bones), "bones,", len(body.data.vertices), "vertices")
    return body, rig


def mirror(body, rig, sleeve=0.14, glove=0.24, match=0.04):
    """Meshy's model stands with one arm up and one hanging, and the hanging one is fused to the
    body down its inner side, so the rig gave the hip and the end of the belt to that arm: lifting
    it would peel them away with it. The body is symmetrical, though, and on the other side (the
    arm up, out of the way) the rig weighted it cleanly. So the hanging arm's side of the body
    takes its weights from the other side, mirrored: every vertex whose reflection lands on the
    other side's surface (within `match`), apart from the arm itself (within `sleeve` of its
    upper arm and forearm, `glove` of its hand), which keeps its own."""
    from mathutils import kdtree

    bones = rig.data.bones
    verts = body.data.vertices
    mid = bones["Hips"].head_local.x
    # Which arm hangs: the one whose hand is lower.
    side = "L" if bones["Hand.L"].head_local.z < bones["Hand.R"].head_local.z else "R"
    other = "R" if side == "L" else "L"
    sign = -1 if bones[f"UpperArm.{side}"].head_local.x < mid else 1
    arm = [
        (b.head_local.copy(), b.tail_local.copy(), sleeve if "Arm" in b.name else glove)
        for b in bones
        if b.name.endswith(f".{side}") and not b.name.startswith(("Collar", "Hip", "Thigh", "Shin", "Foot"))
    ]
    names = {g.index: g.name for g in body.vertex_groups}
    index = {g.name: g.index for g in body.vertex_groups}

    def swap(name):
        for a, b in ((f".{side}", f".{other}"), (f".{other}", f".{side}")):
            if name.endswith(a):
                return name[: -len(a)] + b
        return name

    far = [v for v in verts if (v.co.x - mid) * -sign > 0.02]
    tree = kdtree.KDTree(len(far))
    for i, v in enumerate(far):
        tree.insert(v.co, i)
    tree.balance()
    taken = {}
    for v in verts:
        if (v.co.x - mid) * sign <= 0.02:
            continue
        near_arm = False
        for a0, a1, reach in arm:
            d = a1 - a0
            t = max(0.0, min(1.0, (v.co - a0).dot(d) / max(d.length_squared, 1e-9)))
            if (v.co - (a0 + d * t)).length < reach:
                near_arm = True
                break
        if near_arm:
            continue
        co, i, dist = tree.find(Vector((2 * mid - v.co.x, v.co.y, v.co.z)))
        if dist > match:
            continue
        taken[v.index] = [(swap(names[g.group]), g.weight) for g in far[i].groups if g.group in names]
    for i, w in taken.items():
        for g in list(verts[i].groups):
            body.vertex_groups[g.group].remove([i])
        for name, weight in w:
            if name in index:
                body.vertex_groups[index[name]].add([i], weight, "REPLACE")
    print(f"RIG mirrored {len(taken)} vertices onto the {side} side from the {other}")


def untangle(body, rig, glove=0.24, shoulder=9.0):
    """An auto-rig's weights spill between parts that touch in the model's pose: the hanging
    hand's glove and cuff take some of the hip (and the hip some of the glove), the raised hand
    some of the helmet. Lifting the arm then drags ribbons of glove down to the hip, or waving
    tugs at the helmet.

    So each forearm and hand is found as a surface: from the vertices the rig gives wholly to it,
    out across the mesh (seams and all) to everything joined to them within `glove` of its bones.
    That surface follows only its own arm (the bone it's nearest, where the rig gave it none of
    that arm). Anything else that close (the hip beside the glove) lets go of the forearm and
    hand. Beyond `shoulder` of each shoulder joint, the rest of the arm and the body let go of
    each other too (the upper arm hangs against the waist), and the helmet follows no arm at all.
    At the shoulders, and between the legs and the body, the rig's blending stays as it was."""
    bones = rig.data.bones
    verts = body.data.vertices

    def limb(bone):
        # The limb a bone is in, named by its root (the collar or the hip); else the body.
        while bone:
            if bone.name.startswith(("Collar.", "Hip.")):
                return bone.name
            bone = bone.parent
        return "body"

    part = {b.name: limb(b) for b in bones}
    depth = {}
    for b in bones:
        d, x = 0, b
        while x and x.name != part[b.name]:
            d, x = d + 1, x.parent
        depth[b.name] = d if part[b.name] != "body" else 0
    names = {g.index: g.name for g in body.vertex_groups}
    index = {g.name: g.index for g in body.vertex_groups}
    head = {b.name for b in bones if b.name.startswith(("Head", "Skull", "Crown"))}

    # The mesh's neighbours, across its texture seams too (the importer splits the surface there).
    near = [[] for _ in verts]
    for e in body.data.edges:
        i, j = e.vertices
        near[i].append(j)
        near[j].append(i)
    spot = {}
    for v in verts:
        spot.setdefault(tuple(round(c, 5) for c in v.co), []).append(v.index)
    for same in spot.values():
        for i in same:
            near[i].extend(k for k in same if k != i)

    # Each arm's forearm and hand: the bones two or more down from its collar.
    hands = {}
    for b in bones:
        if part[b.name].startswith("Collar.") and depth[b.name] >= 2:
            hands.setdefault(part[b.name], []).append((b.name, b.head_local.copy(), b.tail_local.copy()))

    def weights(v):
        return [(names[g.group], g) for g in v.groups if names.get(g.group) in part and g.weight > 0]

    touched = 0
    done = set()
    for arm, segs in hands.items():
        close = {}
        for v in verts:
            best = (glove, None)
            for name, a0, a1 in segs:
                d = a1 - a0
                t = max(0.0, min(1.0, (v.co - a0).dot(d) / max(d.length_squared, 1e-9)))
                dist = (v.co - (a0 + d * t)).length
                if dist < best[0]:
                    best = (dist, name)
            if best[1]:
                close[v.index] = best[1]
        # Grown out from what the rig gives wholly to the forearm and hand.
        seeds = [
            i
            for i in close
            if sum(g.weight for n, g in weights(verts[i]) if part[n] == arm and depth[n] >= 2) > 0.97
        ]
        surface = set(seeds)
        todo = list(seeds)
        while todo:
            i = todo.pop()
            for j in near[i]:
                if j in close and j not in surface:
                    surface.add(j)
                    todo.append(j)
        for i in close:
            v = verts[i]
            w = weights(v)
            if i in surface:
                drop = [g.group for n, g in w if part[n] != arm]
                if len(drop) == len(w):
                    body.vertex_groups[index[close[i]]].add([i], 1.0, "REPLACE")
            else:
                continue
            for gi in drop:
                body.vertex_groups[gi].remove([i])
            touched += bool(drop)
        done.update(close)
        print(f"RIG {arm}: forearm and hand {len(surface)} vertices, {len(close) - len(surface)} beside them")
    # Strays: a vertex the rig tied to a hand though it's nowhere near that arm (a speck on the
    # helmet, say) takes the weights of the nearest vertex that isn't one.
    from mathutils import kdtree

    arm_bones = {arm: [b for b in bones if part[b.name] == arm and depth[b.name] >= 1] for arm in hands}

    def off(v, arm):
        for b in arm_bones[arm]:
            d = b.tail_local - b.head_local
            t = max(0.0, min(1.0, (v.co - b.head_local).dot(d) / max(d.length_squared, 1e-9)))
            if (v.co - (b.head_local + d * t)).length < 2 * glove:
                return False
        return True

    strays = {
        v.index
        for v in verts
        for arm in hands
        if sum(g.weight for n, g in weights(v) if part[n] == arm and depth[n] >= 2) > 0.05 and off(v, arm)
    }
    if strays:
        keep = [v for v in verts if v.index not in strays]
        tree = kdtree.KDTree(len(keep))
        for k, v in enumerate(keep):
            tree.insert(v.co, k)
        tree.balance()
        for i in strays:
            _, k, _ = tree.find(verts[i].co)
            for g in list(verts[i].groups):
                body.vertex_groups[g.group].remove([i])
            for g in keep[k].groups:
                body.vertex_groups[g.group].add([i], g.weight, "REPLACE")
        print("RIG strays", len(strays))
    # Away from the shoulders, an arm and the body don't pull on each other: the upper arm lets go
    # of the waist, the waist and the helmet of the arm. At the shoulder they blend, as rigged.
    shoulders = {part[b.name]: b.head_local.copy() for b in bones if part[b.name].startswith("Collar.") and depth[b.name] == 1}
    for v in verts:
        if v.index in done:
            continue
        w = weights(v)
        share = {}
        for n, g in w:
            share[part[n]] = share.get(part[n], 0.0) + g.weight
        if not share:
            continue
        home = max(share, key=share.get)
        top = max(w, key=lambda x: x[1].weight)[0]
        drop = []
        for arm, at in shoulders.items():
            if top not in head and (v.co - at).length < shoulder:
                continue
            if home == arm:
                drop += [g.group for n, g in w if part[n] != arm]
            else:
                drop += [g.group for n, g in w if part[n] == arm and depth[n] >= 1]
        if drop and len(drop) < len(w):
            for gi in drop:
                body.vertex_groups[gi].remove([v.index])
            touched += 1
    print("RIG untangled", touched, "vertices")


def depth_at(body, x, z, r=0.14):
    """The middle of the mesh (front to back) around a front-view point: where the limb is."""
    ys = [v.co.y for v in body.data.vertices if (v.co.x - x) ** 2 + (v.co.z - z) ** 2 < r * r]
    return (min(ys) + max(ys)) / 2 if ys else 0.0


# ── The skeleton ──────────────────────────────────────────────────────────────────────────────

# name, head joint, tail joint, parent, thickness (how far its vertices reach from the bone)
BONES = [
    ("Pelvis", "pelvis", "spine", None, 0.42),
    ("Spine", "spine", "neck", "Pelvis", 0.46),
    ("Head", "neck", "crown", "Spine", 0.62),
    ("UpperArm.L", "shoulder.L", "elbow.L", "Spine", 0.14),
    ("ForeArm.L", "elbow.L", "wrist.L", "UpperArm.L", 0.13),
    ("Hand.L", "wrist.L", "tip.L", "ForeArm.L", 0.16),
    ("UpperArm.R", "shoulder.R", "elbow.R", "Spine", 0.14),
    ("ForeArm.R", "elbow.R", "wrist.R", "UpperArm.R", 0.13),
    ("Hand.R", "wrist.R", "tip.R", "ForeArm.R", 0.16),
    ("Thigh.L", "hip.L", "knee.L", "Pelvis", 0.17),
    ("Shin.L", "knee.L", "ankle.L", "Thigh.L", 0.16),
    ("Foot.L", "ankle.L", "toe.L", "Shin.L", 0.2),
    ("Thigh.R", "hip.R", "knee.R", "Pelvis", 0.17),
    ("Shin.R", "knee.R", "ankle.R", "Thigh.R", 0.16),
    ("Foot.R", "ankle.R", "toe.R", "Shin.R", 0.2),
]


def build(body, joints, method="heat"):
    pts = {}
    for name, (x, z) in joints.items():
        y = depth_at(body, x, z)
        pts[name] = Vector((x, y, z))
    # Toes point forward, out of the front of the feet.
    for side in ("L", "R"):
        pts[f"toe.{side}"].y = pts[f"ankle.{side}"].y - 0.28
    arm_data = bpy.data.armatures.new("Rig")
    rig = bpy.data.objects.new("Rig", arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    for name, h, t, parent, _ in BONES:
        b = eb.new(name)
        b.head = pts[h]
        b.tail = pts[t]
        if parent:
            b.parent = eb[parent]
    bpy.ops.object.mode_set(mode="OBJECT")

    if method == "heat":
        # Blender's bone heat: weights diffuse from each bone over the surface it can "see", so a
        # hanging arm beside the chest belongs to the arm and the joints blend smoothly.
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        rig.select_set(True)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
        # Soften the seams between bones a little (no jagged shoulders as an arm swings high), and
        # keep to four bones per vertex, the most a glTF skin carries.
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        # The body stays whole: arm influence fades out with distance from the arm itself (full on
        # the arm and its shoulder, none on the far side of the chest, the backpack or the
        # helmet), so a big swing bends the arm without fraying the suit around it. Distance is
        # measured against each arm bone's thickness.
        arm_segs = [(name, pts[h], pts[t], thick) for name, h, t, _, thick in BONES if name.startswith(("UpperArm", "ForeArm", "Hand"))]
        side_of = {body.vertex_groups[n].index: n[-1] for n, *_ in arm_segs}
        for v in body.data.vertices:
            p = v.co
            near = {"L": 1e9, "R": 1e9}
            for name, a0, a1, thick in arm_segs:
                d = a1 - a0
                t = max(0.0, min(1.0, (p - a0).dot(d) / d.length_squared))
                near[name[-1]] = min(near[name[-1]], (p - (a0 + d * t)).length / thick)
            total = 0.0
            for g in v.groups:
                sd = side_of.get(g.group)
                if sd:
                    g.weight *= 1.0 - smoothstep(1.3, 2.2, near[sd])
                total += g.weight
            if total > 0:
                for g in v.groups:
                    g.weight /= total
            else:
                body.vertex_groups["Spine"].add([v.index], 1.0, "REPLACE")
        bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
        bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=0.6, repeat=4, expand=0.1)
        bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
        bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        used = {x.group for v in body.data.vertices for x in v.groups if x.weight > 0.05}
        empty = [g.name for g in body.vertex_groups if g.index not in used]
        print("RIG heat done; bones with no vertices:", empty)
        return rig

    # Weights: nearest bone by distance over thickness, then smoothed along the mesh's edges.
    verts = body.data.vertices
    n = len(verts)
    segs = []
    for name, h, t, _, thick in BONES:
        segs.append((name, pts[h], pts[t], thick))
    names = [s[0] for s in segs]
    weights = [[0.0] * len(segs) for _ in range(n)]
    for v in verts:
        p = v.co
        best, bi = 1e9, 0
        for i, (_, a0, a1, thick) in enumerate(segs):
            d = a1 - a0
            t = max(0.0, min(1.0, (p - a0).dot(d) / d.length_squared))
            dist = (p - (a0 + d * t)).length / thick
            if dist < best:
                best, bi = dist, i
        weights[v.index][bi] = 1.0
    adj = [[] for _ in range(n)]
    for e in body.data.edges:
        i, j = e.vertices
        adj[i].append(j)
        adj[j].append(i)
    for _ in range(4):
        nxt = []
        for k in range(n):
            if not adj[k]:
                nxt.append(weights[k])
                continue
            acc = [w * 2.0 for w in weights[k]]
            for j in adj[k]:
                wj = weights[j]
                for b in range(len(segs)):
                    acc[b] += wj[b]
            tot = sum(acc)
            nxt.append([w / tot for w in acc])
        weights = nxt
    groups = {name: body.vertex_groups.new(name=name) for name in names}
    for k in range(n):
        for b, w in enumerate(weights[k]):
            if w > 0.01:
                groups[names[b]].add([k], w, "REPLACE")
    body.parent = rig
    mod = body.modifiers.new("Rig", "ARMATURE")
    mod.object = rig
    return rig


# ── The actions ───────────────────────────────────────────────────────────────────────────────

X = Vector((1, 0, 0))  # pitch: swing forward/back (positive raises the front of the limb up)
Y = Vector((0, 1, 0))  # roll: sideways, in the plane of the front view
Z = Vector((0, 0, 1))  # yaw: twist round the vertical


def pose(rig, name, *turns):
    """Rotate a bone by (axis, degrees) turns given in the rest world axes, relative to its parent."""
    pb = rig.pose.bones[name]
    pb.rotation_mode = "QUATERNION"
    inv = rig.data.bones[name].matrix_local.to_3x3().inverted()
    q = Quaternion()
    for axis, deg in turns:
        q = Quaternion(inv @ axis, math.radians(deg)) @ q
    pb.rotation_quaternion = q


def keyed(rig, action_name, frames, fn, bones=None):
    """Make an action by sampling `fn(phase 0..1, frame)` into keys. `bones` limits the keys to
    those bones (a gesture that plays over another action, like the wave over the float)."""
    rig.animation_data_create()
    act = bpy.data.actions.new(action_name)
    rig.animation_data.action = act
    targets = [pb for pb in rig.pose.bones if bones is None or pb.name in bones]
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    for f in range(frames + 1):
        for pb in rig.pose.bones:
            pb.rotation_quaternion = Quaternion()
        fn(f / frames, f)
        for pb in targets:
            pb.keyframe_insert("rotation_quaternion", frame=f)
    act.use_fake_user = True
    return act


def S(phase, cycles=1.0, shift=0.0):
    return math.sin(2 * math.pi * (phase * cycles + shift))


# Limb helpers, in the character's own terms. "L" is the side on the left of the front view.
#   abd       out to the side, away from the body (degrees)
#   swing     forward toward the viewer is negative, back is positive
#   elbow     bends the forearm forward and up
#   straighten  the right forearm rests bent up (he's waving); this lowers it toward straight
def arm(rig, side, abd=0.0, swing=0.0, elbow=0.0, straighten=0.0, wrist=0.0):
    out = 1 if side == "L" else -1
    pose(rig, f"UpperArm.{side}", (Y, out * abd), (X, swing))
    if side == "R":
        pose(rig, "ForeArm.R", (Y, straighten), (X, -elbow))
    else:
        pose(rig, "ForeArm.L", (X, -elbow))
    pose(rig, f"Hand.{side}", (X, wrist))


#   swing     forward (a kick toward the viewer) is negative
#   spread    apart, away from the other leg
#   knee      bends the shin back
def leg(rig, side, swing=0.0, spread=0.0, knee=0.0, foot=0.0):
    out = 1 if side == "L" else -1
    pose(rig, f"Thigh.{side}", (X, swing), (Y, out * spread))
    pose(rig, f"Shin.{side}", (X, knee))
    pose(rig, f"Foot.{side}", (X, foot))


def float_idle(rig):
    """Treading space: arms drifting out, legs slowly cycling, looking round."""

    def fn(p, _):
        pose(rig, "Spine", (X, 4 * S(p, 1, 0.1)), (Z, 6 * S(p, 1, 0.35)))
        pose(rig, "Head", (Z, 14 * S(p, 1, 0.2)), (X, 6 * S(p, 2, 0.05)))
        arm(rig, "L", abd=32 + 10 * S(p, 1, 0.3), swing=16 * S(p, 1), elbow=22 + 14 * S(p, 1, 0.55), wrist=12 * S(p, 2, 0.2))
        arm(rig, "R", abd=12 + 8 * S(p, 1, 0.6), swing=12 * S(p, 1, 0.25), straighten=25 + 12 * S(p, 1, 0.45), wrist=10 * S(p, 2, 0.4))
        leg(rig, "L", swing=18 * S(p, 1), spread=8, knee=20 + 16 * S(p, 1, 0.2), foot=12 * S(p, 1, 0.35))
        leg(rig, "R", swing=18 * S(p, 1, 0.5), spread=8, knee=20 + 16 * S(p, 1, 0.7), foot=12 * S(p, 1, 0.85))

    return keyed(rig, "Float", 96, fn)


def swim(rig):
    """Clawing through space toward the viewer, and reading as that from the front: each arm in
    turn reaches up and out, grabs and hauls down and back, the body rolling with it; the legs
    kick in a scissor wide enough to see."""

    def fn(p, _):
        pose(rig, "Spine", (X, 12), (Z, 14 * S(p)), (Y, 9 * S(p)))
        pose(rig, "Head", (X, -14 + 4 * S(p, 2)), (Z, -9 * S(p)), (Y, -6 * S(p)))
        for side, sh in (("L", 0.0), ("R", 0.5)):
            reach = 0.5 + 0.5 * S(p, 1, sh)  # 1 at the top of the stroke
            if side == "R":
                # The raised arm swings free from the shoulder: from hanging at the end of the pull
                # up to high overhead, the forearm straightening as it hauls down.
                arm(rig, "R", abd=-38 + 84 * reach, swing=-12 - 26 * S(p, 1, sh + 0.25), elbow=8 + 34 * (1 - reach), straighten=92 - 84 * reach, wrist=-22 * S(p, 1, sh + 0.1))
            else:
                # The hanging arm is fused to the suit down its inner side (in Meshy's remesh), so
                # it strokes forward and back more than out.
                arm(rig, "L", abd=10 + 26 * reach, swing=-16 - 30 * S(p, 1, sh + 0.25), elbow=16 + 44 * (1 - reach), wrist=-22 * S(p, 1, sh + 0.1))
        for side, sh in (("L", 0.25), ("R", 0.75)):
            kick = S(p, 1, sh)
            leg(rig, side, swing=24 * kick, spread=12 + 12 * max(0.0, kick), knee=16 + 34 * max(0.0, S(p, 1, sh + 0.25)), foot=20 * kick)

    return keyed(rig, "Swim", 24, fn)


def flail(rig):
    """Panic: arms windmilling out of step, big and wide, legs kicking wildly, head thrashing."""

    def fn(p, _):
        pose(rig, "Spine", (X, 10 * S(p, 1, 0.1)), (Z, 14 * S(p, 2, 0.3)), (Y, 10 * S(p, 1, 0.6)))
        pose(rig, "Head", (Z, 22 * S(p, 2)), (X, -10 + 12 * S(p, 1, 0.4)), (Y, 8 * S(p, 1, 0.2)))
        # The right windmills right round from the shoulder; the left (see swim) beats back and forth.
        arm(rig, "L", abd=22 + 14 * S(p, 1, 0.25), swing=38 * S(p, 1), elbow=35 + 30 * S(p, 2, 0.1), wrist=28 * S(p, 2, 0.3))
        arm(rig, "R", abd=8 + 52 * S(p, 1, 0.62), swing=30 * S(p, 1, 0.37), elbow=18 + 14 * S(p, 2, 0.47), straighten=60 + 40 * S(p, 1, 0.37), wrist=28 * S(p, 2, 0.67))
        for side, sh in (("L", 0.0), ("R", 0.43)):
            leg(rig, side, swing=40 * S(p, 1, sh), spread=18 + 14 * S(p, 2, sh), knee=34 + 30 * S(p, 1, sh + 0.3), foot=25 * S(p, 2, sh))

    return keyed(rig, "Flail", 18, fn)


def spread(rig):
    """Spread-eagle in a tumble: limbs flung wide, slowly flailing, back arched."""

    def fn(p, _):
        pose(rig, "Spine", (X, -8 + 6 * S(p)), (Z, 6 * S(p, 1, 0.3)))
        pose(rig, "Head", (X, -14 + 6 * S(p, 1, 0.2)), (Z, 10 * S(p, 1, 0.6)))
        arm(rig, "L", abd=34 + 6 * S(p, 2), swing=-10 + 16 * S(p, 1, 0.1), elbow=15 + 15 * S(p, 2, 0.3))
        arm(rig, "R", abd=4 + 10 * S(p, 2, 0.5), swing=18 * S(p, 1, 0.6), straighten=100, elbow=12 + 15 * S(p, 2, 0.8))
        for side, sh in (("L", 0.0), ("R", 0.5)):
            leg(rig, side, swing=14 * S(p, 1, sh), spread=28 + 8 * S(p, 2, sh), knee=24 + 12 * S(p, 2, sh + 0.3), foot=12 * S(p, 2, sh))

    return keyed(rig, "Spread", 48, fn)


def wave(rig):
    """A hello with the raised hand: the forearm swings from the elbow, the hand a touch behind."""

    def fn(p, f):
        env = smoothstep(0, 0.17, p) * (1 - smoothstep(0.72, 1.0, p))
        ph = 2 * math.pi * (f - 2) / 17.0
        pose(rig, "ForeArm.R", (Y, env * (4 + 16 * math.sin(ph))))
        pose(rig, "Hand.R", (Y, 5 * env * math.sin(ph - 0.7)))
        pose(rig, "Head", (Z, 6 * env))

    return keyed(rig, "Wave", 40, fn, bones={"ForeArm.R", "Hand.R", "Head"})


# ── Output ────────────────────────────────────────────────────────────────────────────────────


def export(path, draco):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_cameras=False,
        export_lights=False,
        export_image_format="WEBP",
        export_image_quality=86,
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=7,
    )


def preview(rig, body, actions, out):
    """A quick Workbench contact sheet of each action, front and three-quarter."""
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.render.resolution_x = 360
    sc.render.resolution_y = 360
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 3.6
    cam = bpy.data.objects.new("Cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    for act in actions:
        rig.animation_data.action = act
        f0, f1 = (int(v) for v in act.frame_range)
        for i in range(6):
            f = f0 + round((f1 - f0) * i / 6)
            sc.frame_set(f)
            for view, (loc, rot) in enumerate(
                (((0, -10, 1.4), (math.pi / 2, 0, 0)), ((7.5, -7.5, 1.6), (math.pi / 2, 0, math.pi / 4)))
            ):
                cam.location = loc
                cam.rotation_euler = rot
                sc.render.filepath = str(out / f"{act.name}-{view}-{i}.png")
                bpy.ops.render.render(write_still=True)
    print("RIG preview", out)


def main():
    a = parse()
    if a.bones:
        body, rig = prepare_rigged(a, json.loads(Path(a.bones).read_text()))
    else:
        joints = json.loads(Path(a.joints).read_text())
        body = prepare(a)
        rig = build(body, joints, a.weights)
    actions = [float_idle(rig), swim(rig), flail(rig), spread(rig), wave(rig)]
    rig.animation_data.action = actions[0]
    if a.preview:
        preview(rig, body, actions, a.preview)
    if a.out:
        export(a.out, not a.no_draco)
        print("RIG glb", a.out)


main()
