"""Turn a clip into a seamless, web-sized loop with Blender's sequencer and built-in FFmpeg.

The last `--fade` seconds of the clip are cross-faded over its first seconds, so the output
(clip length minus the fade) loops with no visible seam. Output is H.264 MP4 (plays everywhere),
plus a poster image of the first frame. `--start` / `--end` (source frames, from 1) trim the clip
first: pick two frames that look alike (a character in the same pose) and the fade can be short.
`--pingpong` plays the clip forward then backward instead, for footage where no two frames match
(a camera that keeps drifting): the camera eases out and back, and there's no seam at all.

    blender -b --factory-startup --python video_loop.py -- \
        --in day1.mp4 --out public/video/day-portal.mp4 --poster public/video/day-portal.jpg \
        --width 1600 --fade 1.2 --crf high [--mirror] [--start 15 --end 135]
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
    p.add_argument("--start", type=int, default=1, help="first source frame")
    p.add_argument("--end", type=int, default=0, help="last source frame (0: the clip's end)")
    p.add_argument("--pingpong", action="store_true", help="forward then backward, no crossfade")
    return p.parse_args(argv)


def main():
    a = parse()
    scene = bpy.context.scene
    scene.sequence_editor_create()
    strips = scene.sequence_editor.strips

    # Source frame `start` lands on output frame 1.
    base = strips.new_movie("base", a.src, 1, 2 - a.start)
    fps = base.fps
    end = a.end or (base.frame_final_end - base.frame_final_start)
    length = end - a.start + 1
    clip_len = base.frame_final_end - base.frame_final_start
    if a.pingpong:
        # The same frames reversed, starting on the forward pass's last frame (same image), and
        # stopping one short of the first frame, which the loop wraps back to.
        fade = 0
        out_len = 2 * length - 2
        # Reversal applies to the whole clip before trimming, so the trims swap ends.
        tail = strips.new_movie("tail", a.src, 2, 1)
        tail.use_reverse_frames = True
        tail.frame_offset_start = clip_len - end
        tail.frame_offset_end = a.start - 1
        tail.frame_start = length - (clip_len - end)
    else:
        fade = max(1, round(a.fade * fps))
        out_len = length - fade
        # The tail of the clip, placed so its last `fade` frames sit over the output's first frames.
        tail = strips.new_movie("tail", a.src, 2, 1 - (end - fade))

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
    if not a.pingpong:
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
