/**
 * Third-party content checks, kept pluggable (owner, 2026-10-04: "Keep third-party AI moderation
 * pluggable for public content later"). Nothing is connected yet. When one is, it runs on public
 * Spaces only, and a "hold" hides the message for its Space's moderators to decide on; it never
 * queues anything for a person at Realm to read.
 */
export interface ContentScanner {
  readonly enabled: boolean;
  scanText(text: string): Promise<{ hold: boolean; categories: string[] }>;
}

export const noScanner: ContentScanner = {
  enabled: false,
  async scanText() {
    return { hold: false, categories: [] };
  },
};
