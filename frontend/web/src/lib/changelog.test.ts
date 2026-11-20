import { readFileSync } from "node:fs";
import { CHANGELOG } from "@realm/contracts";
import { describe, expect, it } from "vitest";

// The app shows "What's new" by its own version, so the newest entry must match it.
const app = JSON.parse(readFileSync(new URL("../../../app/app.json", import.meta.url), "utf8")) as {
  expo: { version: string };
};

describe("the changelog", () => {
  it("has an entry for the app's version, at the top", () => {
    expect(CHANGELOG[0]?.version).toBe(app.expo.version);
  });
});
