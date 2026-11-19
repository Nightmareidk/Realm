import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/gateway-main.ts", "src/worker-main.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  // Bundle our workspace packages (they ship TypeScript source). Every outside package stays
  // external, including the ones the workspace packages use (so native ones like argon2 load
  // from node_modules): each must be listed in this package's dependencies to be found.
  noExternal: [/^@realm\//],
  external: [/^(?!@realm\/)[^./]/],
});
