import { describe, expect, it } from "vitest";
import { buildMapGeometry } from "./geometry";

const LETTER_WIDTH = 21.5; // map lettering: 21px expanded caps with open tracking
const NAMES = { spaces: "SPACES", feed: "FEED", profiles: "PROFILES", boards: "BOARDS" } as const;

function distanceToSegment(px: number, py: number, [x1 = 0, y1 = 0, x2 = 0, y2 = 0]: number[]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

describe("atlas map geometry", () => {
  const g = buildMapGeometry();
  const legs = g.legs.map((l) => (l.d.match(/-?[\d.]+/g) ?? []).map(Number));

  it.each(g.regions.map((r) => [r.id, r] as const))(
    "keeps the course clear of the %s lettering",
    (id, region) => {
      const half = (NAMES[id].length * LETTER_WIDTH) / 2 + 6;
      let min = Number.POSITIVE_INFINITY;
      for (const leg of legs) {
        for (let i = 0; i <= 20; i++) {
          for (let j = 0; j <= 6; j++) {
            const x = region.label.x - half + (2 * half * i) / 20;
            const y = region.label.y - 20 + (48 * j) / 6;
            min = Math.min(min, distanceToSegment(x, y, leg));
          }
        }
      }
      expect(min).toBeGreaterThanOrEqual(24);
    },
  );

  it("is deterministic", () => {
    expect(buildMapGeometry()).toEqual(g);
  });
});
