import { ThemeFile } from "@realm/contracts";
import { z } from "zod";
import { SITE } from "@/lib/site";

/**
 * The theme format as a JSON Schema, for code editors: put
 * `"$schema": "https://tomyrealm.com/theme-schema.json"` at the top of a theme.json and the
 * editor suggests every option and flags mistakes as you type. Realm itself ignores `$schema`.
 */
export const dynamic = "force-static";

export function GET() {
  const base = z.toJSONSchema(ThemeFile, { io: "input" }) as {
    $defs?: Record<string, { properties?: Record<string, unknown> }>;
  };
  // A theme.json may name this schema in "$schema"; Realm ignores that line when it opens one.
  const file = base.$defs?.ThemeFile;
  if (file?.properties) file.properties.$schema = { type: "string" };
  const schema = { ...base, $id: `${SITE.origin}/theme-schema.json`, title: "Realm theme" };
  return Response.json(schema, {
    headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" },
  });
}
