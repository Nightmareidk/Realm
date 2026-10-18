import { SITE } from "@/lib/site";

/**
 * security.txt (RFC 9116): where someone who finds a security hole in Realm should report it,
 * privately. Read by security researchers and scanners; it changes with each release.
 */
export const dynamic = "force-static";

const REPORT = "https://github.com/Nightmareidk/Realm/security/advisories/new";

export function GET() {
  const expires = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  const body = [
    `Contact: ${REPORT}`,
    `Expires: ${expires}`,
    `Policy: ${SITE.origin}/help#security`,
    "Preferred-Languages: en",
    `Canonical: ${SITE.origin}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
