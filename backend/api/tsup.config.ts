import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/gateway-main.ts", "src/worker-main.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  // Bundle our workspace packages (they ship TypeScript source); keep npm deps external.
  noExternal: [/^@realm\//],
  // The embedded development database never ships.
  external: ["@electric-sql/pglite"],
});
