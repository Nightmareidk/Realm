/** "Wait 12 minutes" from a Retry-After in seconds (rounded up; never "0 minutes"). */
export function waitFor(seconds?: number) {
  if (!seconds || seconds <= 0) return "Wait a few minutes";
  if (seconds < 60) return `Wait ${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `Wait ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
