import { inArray, schema } from "@realm/db";
import type { Deps } from "../deps";

const { ownerAlerts } = schema;

/**
 * Emails Realm's owner a warning, once per `key` (the database remembers which went out, across
 * restarts and servers). Without an inbox set (REALM_ALERT_EMAIL, else REALM_SAFETY_EMAIL) the
 * warning still lands in the log. Returns whether this call was the one that sent it.
 */
export async function alertOwnerOnce(
  deps: Pick<Deps, "db" | "config" | "mailer" | "logger">,
  key: string,
  mail: { subject: string; text: string },
): Promise<boolean> {
  const [fresh] = await deps.db
    .insert(ownerAlerts)
    .values({ key })
    .onConflictDoNothing()
    .returning({ key: ownerAlerts.key });
  if (!fresh) return false;
  deps.logger.warn({ alert: key, subject: mail.subject }, "owner alert");
  const to = deps.config.REALM_ALERT_EMAIL ?? deps.config.REALM_SAFETY_EMAIL;
  if (to) {
    await deps.mailer
      .send({ to, ...mail })
      .catch((err) => deps.logger.error({ err, alert: key }, "owner alert email failed"));
  }
  return true;
}

/** Records a warning as sent without emailing it (a bigger warning already covers it). */
export async function markOwnerAlertSent(deps: Pick<Deps, "db">, key: string) {
  await deps.db.insert(ownerAlerts).values({ key }).onConflictDoNothing();
}

/** Lets these warnings go out again (the problem cleared up). */
export async function rearmOwnerAlerts(deps: Pick<Deps, "db">, keys: string[]) {
  if (keys.length) await deps.db.delete(ownerAlerts).where(inArray(ownerAlerts.key, keys));
}
