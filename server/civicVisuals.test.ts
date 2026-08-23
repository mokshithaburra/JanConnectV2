import { describe, expect, it } from "vitest";
import {
  calculateImpactRadius,
  getCivicBadges,
  getCivicVisual,
} from "../client/src/lib/civicVisuals";

describe("civic visual helpers", () => {
  it("returns a stable civic visual for a known category", () => {
    const visual = getCivicVisual("Environment");
    expect(visual.src).toContain("tree-planting");
    expect(visual.alt).toMatch(/volunteers/i);
  });

  it("calculates the widest activity span from valid coordinates", () => {
    const radius = calculateImpactRadius([
      { latitude: 19.076, longitude: 72.8777 },
      { latitude: 28.6139, longitude: 77.209 },
    ]);
    expect(radius).toBeGreaterThan(1_000);
    expect(radius).toBeLessThan(1_300);
    expect(calculateImpactRadius([{ latitude: 19.076, longitude: 72.8777 }])).toBe(0);
  });

  it("unlocks badges from real activity counts and preserves progress", () => {
    const badges = getCivicBadges({ score: 125, bookmarks: 5, initiatives: 2, posts: 1 });
    expect(badges.find((badge) => badge.id === "first-signal")?.unlocked).toBe(true);
    expect(badges.find((badge) => badge.id === "map-reader")?.progress).toBe(1);
    expect(badges.find((badge) => badge.id === "field-builder")?.unlocked).toBe(false);
    expect(badges.find((badge) => badge.id === "momentum")?.unlocked).toBe(true);
  });
});
