import { describe, expect, it } from "vitest";
import { buildStarChart } from "./star-chart";

const LETTER_WIDTH = 19; // chart lettering: 21px display caps with open tracking
const NAMES = { spaces: "SPACES", feed: "FEED", profiles: "PROFILES", boards: "BOARDS" } as const;

/** Sample a quadratic Bézier leg ("M x,y Q cx,cy x,y") into points. */
function sample(d: string) {
  const [ax = 0, ay = 0, cx = 0, cy = 0, bx = 0, by = 0] = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  return Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    return {
      x: (1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t ** 2 * bx,
      y: (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t ** 2 * by,
    };
  });
}

describe("star chart geometry", () => {
  const g = buildStarChart();
  const legs = g.legs.map((l) => sample(l.d));

  it.each(g.planets.map((p) => [p.id, p] as const))(
    "keeps the flight clear of the %s lettering",
    (id, planet) => {
      const width = NAMES[id].length * LETTER_WIDTH + 8;
      const left =
        planet.label.anchor === "start" ? planet.label.x - 4 : planet.label.x - width / 2;
      let min = Number.POSITIVE_INFINITY;
      for (const leg of legs) {
        for (const pt of leg) {
          const dx = Math.max(left - pt.x, 0, pt.x - (left + width));
          const dy = Math.max(planet.label.y - 17 - pt.y, 0, pt.y - (planet.label.y + 5));
          min = Math.min(min, Math.hypot(dx, dy));
        }
      }
      expect(min).toBeGreaterThanOrEqual(20);
    },
  );

  it("only touches the eclipse on the final leg", () => {
    for (const leg of legs.slice(0, -1)) {
      for (const pt of leg) {
        expect(Math.hypot(pt.x - g.center.x, pt.y - g.center.y)).toBeGreaterThan(g.eclipse * 1.5);
      }
    }
  });

  it("keeps every planet and label inside the chart", () => {
    for (const p of g.planets) {
      expect(p.x - p.r * 2).toBeGreaterThan(0);
      expect(p.x + p.r * 2).toBeLessThan(g.width);
      expect(p.label.y - 20).toBeGreaterThan(0);
      expect(p.label.y).toBeLessThan(g.height);
    }
  });

  it("is deterministic", () => {
    expect(buildStarChart()).toEqual(g);
  });
});
