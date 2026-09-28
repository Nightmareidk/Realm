"""Make a generated character model (Meshy and the like) light enough for the web.

Imports a GLB, reduces its triangle count, scales it to a target height with its feet on the
ground and centred, shrinks its textures, and exports a Draco-compressed GLB with WebP textures.
Rigs and animations are kept (decimation is skipped on skinned meshes, which it would break).

    blender -b --factory-startup --python optimize_glb.py -- \
        --in model.glb --out public/models/alien-meshy.glb \
        [--tris 60000] [--tex 1024] [--height 2.6] [--info-only]
"""

import argparse
import sys

import bpy
from mathutils import Vector


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--out")
    p.add_argument("--tris", type=int, default=60000, help="target triangle count")
    p.add_argument("--tex", type=int, default=1024, help="largest texture side")
    p.add_argument("--height", type=float, default=0.0, help="target height (0: keep)")
    p.add_argument("--info-only", action="store_true")
    return p.parse_args(argv)


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


def tri_count():
    total = 0
    for o in meshes():
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total


def main():
    a = parse()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=a.src)
    lo, hi = bounds()
    print(f"info: tris={tri_count()} size={tuple(round(v, 3) for v in (hi - lo))} min={tuple(round(v, 3) for v in lo)}")
    for img in bpy.data.images:
        print(f"info: image {img.name} {img.size[0]}x{img.size[1]}")
    print(f"info: skinned={any(o.find_armature() for o in meshes())} actions={len(bpy.data.actions)}")
    if a.info_only:
        return

    # Fewer triangles; the normal map keeps the fine surface detail.
    count = tri_count()
    if count > a.tris:
        for o in meshes():
            if o.find_armature():
                continue
            mod = o.modifiers.new("decimate", "DECIMATE")
            mod.ratio = a.tris / count
            mod.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)

    # Scale to the target height, feet on the ground, centred (Blender is Z-up; glTF export makes
    # it Y-up).
    if a.height > 0:
        lo, hi = bounds()
        s = a.height / (hi.z - lo.z)
        roots = [o for o in bpy.context.scene.objects if o.parent is None]
        for o in roots:
            o.scale *= s
        bpy.context.view_layer.update()
        lo, hi = bounds()
        shift = Vector(((lo.x + hi.x) / -2, (lo.y + hi.y) / -2, -lo.z))
        for o in roots:
            o.location += shift
        bpy.context.view_layer.update()

    for img in bpy.data.images:
        w, h = img.size
        if max(w, h) > a.tex:
            k = a.tex / max(w, h)
            img.scale(max(1, round(w * k)), max(1, round(h * k)))

    lo, hi = bounds()
    print(f"info: after tris={tri_count()} size={tuple(round(v, 3) for v in (hi - lo))}")
    bpy.ops.export_scene.gltf(
        filepath=a.out,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_image_format="WEBP",
        export_image_quality=86,
        export_animations=True,
        export_yup=True,
    )
    print(f"info: wrote {a.out}")


main()
