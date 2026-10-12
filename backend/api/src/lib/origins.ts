import type { Deps } from "../deps";

/** Private home-network addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x). */
const PRIVATE_HOST =
  /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

/**
 * Whether a browser page from `origin` may talk to the API: Realm's own web address, and in
 * development with REALM_DEV_LAN on, the same web app opened from this home network (a phone).
 */
export function trustedOrigin(deps: Pick<Deps, "config">, origin: string): boolean {
  const web = new URL(deps.config.REALM_WEB_ORIGIN);
  if (origin === web.origin) return true;
  if (deps.config.isProduction || !deps.config.REALM_DEV_LAN) return false;
  try {
    const u = new URL(origin);
    return u.protocol === web.protocol && u.port === web.port && PRIVATE_HOST.test(u.hostname);
  } catch {
    return false;
  }
}
