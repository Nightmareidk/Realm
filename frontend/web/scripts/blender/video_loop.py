"""Turn a clip into a seamless, web-sized loop with Blender's sequencer and built-in FFmpeg.

The last `--fade` seconds of the clip are cross-faded over its first seconds, so the output
(clip length minus the fade) loops with no visible seam. Output is H.264 MP4 (plays everywhere),
plus a poster image of the first frame.

    blender -b --factory-startup --python video_loop.py -- \
        --in day1.mp4 --out public/video/day-portal.mp4 --poster public/video/day-portal.jpg \
        --width 1600 --fade 1.2 --crf high [--mirror]
"""

import argparse
import sys

import bpy


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--poster", required=True)
    p.add_argument("--width", type=int, default=1600)
    p.add_argument("--fade", type=float, default=1.2)
    p.add_argument("--crf", default="HIGH", help="LOSSLESS, PERC_LOSSLESS, HIGH, MEDIUM, LOW")
    p.add_argument("--mirror", action="store_true", help="flip horizontally")
    return p.parse_args(argv)


def main():
    a = parse()
    scene = bpy.context.scene
    scene.sequence_editor_create()
    strips = scene.sequence_editor.strips

    base = strips.new_movie("base", a.src, 1, 1)
    fps = base.fps
    length = base.frame_final_end - base.frame_final_start
    fade = max(1, round(a.fade * fps))
    out_len = length - fade

    # The tail of the clip, placed so its last `fade` frames sit over the output's first frames.
    tail = strips.new_movie("tail", a.src, 2, 1 - out_len)

    src_w = base.elements[0].orig_width
    src_h = base.elements[0].orig_height
    width = min(a.width, src_w)
    height = round(src_h * width / src_w / 2) * 2
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    # Pass the footage through untouched (Blender's default AgX view would re-grade it).
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.fps = round(fps)
    scene.render.fps_base = round(fps) / fps
    scene.frame_start = 1
    scene.frame_end = out_len

    for strip in (base, tail):
        strip.transform.scale_x = width / src_w
        strip.transform.scale_y = height / src_h
        strip.use_flip_x = a.mirror

    tail.blend_type = "ALPHA_OVER"
    tail.blend_alpha = 1.0
    tail.keyframe_insert("blend_alpha", frame=1)
    tail.blend_alpha = 0.0
    tail.keyframe_insert("blend_alpha", frame=fade)

    # Poster: the first output frame, as a JPEG.
    scene.frame_set(1)
    scene.render.image_settings.media_type = "IMAGE"
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 84
    scene.render.filepath = a.poster
    bpy.ops.render.render(write_still=True)

    scene.render.image_settings.media_type = "VIDEO"
    scene.render.image_settings.file_format = "FFMPEG"
    ff = scene.render.ffmpeg
    ff.format = "MPEG4"
    ff.codec = "H264"
    ff.constant_rate_factor = a.crf.upper()
    ff.ffmpeg_preset = "GOOD"
    ff.gopsize = round(fps)
    ff.audio_codec = "NONE"
    scene.render.filepath = a.out
    scene.render.use_file_extension = False
    bpy.ops.render.render(animation=True)
    print(f"loop: {out_len} frames at {fps} fps, {width}x{height}, fade {fade} frames -> {a.out}")


main()
