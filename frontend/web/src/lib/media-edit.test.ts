import { describe, expect, it } from "vitest";
import {
  clampOffset,
  clock,
  coverScale,
  cropRect,
  frameSize,
  keepAtMost,
  ratioOf,
  renamed,
} from "./media-edit";

const photo = { w: 2000, h: 1000 };

describe("photo editor maths", () => {
  it("fits a frame of the chosen shape on the stage", () => {
    expect(frameSize({ w: 548, h: 848 }, 1)).toEqual({ w: 500, h: 500 });
    // A short, wide stage: the height decides.
    expect(frameSize({ w: 1048, h: 448 }, 16 / 9).h).toBeCloseTo(400);
    expect(frameSize({ w: 1048, h: 448 }, 16 / 9).w).toBeCloseTo(711.1, 1);
    expect(ratioOf("original", photo)).toBe(2);
    expect(ratioOf("4:5", photo)).toBe(0.8);
  });

  it("crops the middle at zoom 1, the whole height of a wide photo in a square", () => {
    const frame = { w: 500, h: 500 };
    const scale = coverScale(frame, photo);
    expect(scale).toBe(0.5);
    expect(cropRect(photo, frame, scale, { x: 0, y: 0 })).toEqual({
      left: 500,
      top: 0,
      width: 1000,
      height: 1000,
    });
  });

  it("follows a drag and never goes past the photo's edge", () => {
    const frame = { w: 500, h: 500 };
    const scale = 0.5;
    // Dragging the photo right shows more of its left side.
    expect(cropRect(photo, frame, scale, { x: 100, y: 0 }).left).toBe(300);
    const far = clampOffset({ x: 9999, y: 50 }, photo, scale, frame);
    expect(far).toEqual({ x: 250, y: 0 });
    expect(cropRect(photo, frame, scale, far).left).toBe(0);
  });

  it("crops a smaller part when zoomed in", () => {
    const frame = { w: 500, h: 500 };
    const rect = cropRect(photo, frame, 0.5 * 2, { x: 0, y: 0 });
    expect(rect).toEqual({ left: 750, top: 250, width: 500, height: 500 });
  });
});

describe("video trimmer maths", () => {
  it("keeps at most a minute", () => {
    expect(keepAtMost(90_000, 30_000_000, 60_000, 100 * 1024 * 1024)).toBe(60_000);
  });

  it("keeps less when the video is too big for 100 MB", () => {
    // 200 MB over 40 s: about 18.4 s fits.
    const ms = keepAtMost(40_000, 200 * 1024 * 1024, 60_000, 100 * 1024 * 1024);
    expect(ms).toBeGreaterThan(18_000);
    expect(ms).toBeLessThan(18_500);
  });

  it("never keeps more than the video has", () => {
    expect(keepAtMost(12_000, 5_000_000, 60_000, 100 * 1024 * 1024)).toBe(12_000);
  });

  it("writes times and names plainly", () => {
    expect(clock(7_420)).toBe("0:07.4");
    expect(clock(62_000)).toBe("1:02.0");
    expect(renamed("beach.heic", "jpg")).toBe("beach.jpg");
    expect(renamed("clip", "mp4")).toBe("clip.mp4");
  });
});
