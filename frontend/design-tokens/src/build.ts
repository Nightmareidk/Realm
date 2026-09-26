import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildCss } from "./css";

const out = fileURLToPath(new URL("../tokens.css", import.meta.url));
writeFileSync(out, buildCss());
console.warn(`✓ wrote ${out}`);
