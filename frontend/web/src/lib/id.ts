/**
 * A random ID for drafts and sends. crypto.randomUUID only exists on secure pages (HTTPS or
 * localhost); a phone opening the dev server over the Wi-Fi isn't one, so fall back to
 * getRandomValues, which works everywhere.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
