/** Lists every crypto.subtle call the self-check makes. Run: node --experimental-strip-types */
import { webcrypto } from "node:crypto";

const seen = new Set<string>();
const name = (a: unknown) => (typeof a === "string" ? a : ((a as { name?: string })?.name ?? "?"));
const subtle = new Proxy(webcrypto.subtle, {
  get(target, prop) {
    const fn = Reflect.get(target, prop);
    if (typeof fn !== "function") return fn;
    return (...args: unknown[]) => {
      const fmt =
        prop === "importKey" || prop === "exportKey"
          ? `${String(args[0])} ${name(args[2] ?? args[1])}`
          : name(args[0]);
      seen.add(`${String(prop)}: ${fmt}`);
      return fn.apply(target, args);
    };
  },
});
Object.defineProperty(globalThis, "crypto", {
  value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle },
  configurable: true,
});
const { runSelfCheck } = await import("../self-check");
const steps = await runSelfCheck(() => performance.now(), 5);
console.log(steps.map((s) => `${s.ok ? "ok  " : "FAIL"} ${s.name} ${s.detail ?? ""}`).join("\n"));
console.log([...seen].sort().join("\n"));
