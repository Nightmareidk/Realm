import { createDb } from "./client";
import { releases } from "./schema";

const { db, close } = createDb(
  process.env.DATABASE_URL ?? "postgres://realm:realm@localhost:5432/realm",
);

try {
  // Download portal: every native platform starts as "coming soon".
  await db
    .insert(releases)
    .values(
      (["windows", "macos", "linux", "android", "ios"] as const).map((platform) => ({
        platform,
        channel: "stable" as const,
        status: "coming_soon" as const,
      })),
    )
    .onConflictDoNothing();
  console.warn("✓ seed complete");
} finally {
  await close();
}
