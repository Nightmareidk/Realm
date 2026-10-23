/**
 * The emergency kit, for when something has gone wrong (docs/SECURITY.md, "If Realm is
 * attacked"). Run it from backend/api:
 *
 *   pnpm emergency signout-everyone      everyone must sign in again (after a leak or break-in)
 *   pnpm emergency signout <username>    one account, on every device
 *   pnpm emergency lock <username>       suspend an account and sign it out everywhere
 *   pnpm emergency unlock <username>     let a suspended account back in
 *   pnpm emergency staff <username> <admin|moderator|none>
 *                                        who can open the admin pages (the first admin is
 *                                        made here; after that, admins choose staff there)
 *
 * Sessions end at once in the database. A running server may still trust a session from its
 * short cache for up to a minute (immediately, when Realm runs with Redis).
 */
import { eq, isNull, schema, sql } from "@realm/db";
import { loadConfig } from "@realm/server-core";
import { createDeps } from "./deps";
import { revokeAllSessions } from "./lib/sessions";

const { users, sessions } = schema;
const [command, name, role] = process.argv.slice(2);
/** The kit's answers, on the terminal. */
const say = (line: string) =>
  process.stdout.write(`${line}
`);
const USAGE =
  "Use: signout-everyone | signout <username> | lock <username> | unlock <username> | staff <username> <admin|moderator|none>";

const config = loadConfig();
if (config.DATABASE_URL.startsWith("pglite:")) {
  console.warn(
    "Note: the embedded database opens in one program at a time. Stop Realm's server first.",
  );
}
const deps = await createDeps(config);

async function person(username: string | undefined) {
  if (!username) throw new Error(`Which account? ${USAGE}`);
  const [user] = await deps.db
    .select({ id: users.id, username: users.username, status: users.status })
    .from(users)
    .where(sql`lower(${users.username}) = ${username.replace(/^@/, "").toLowerCase()}`)
    .limit(1);
  if (!user) throw new Error(`No account is called @${username}.`);
  return user;
}

try {
  switch (command) {
    case "signout-everyone": {
      const ended = await deps.db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(isNull(sessions.revokedAt))
        .returning({ id: sessions.id });
      say(`Signed out ${ended.length} sessions. Everyone signs in again with their password.`);
      break;
    }
    case "signout": {
      const user = await person(name);
      const n = await revokeAllSessions(deps, deps.db, user.id);
      say(`Signed @${user.username} out of ${n} sessions.`);
      break;
    }
    case "lock": {
      const user = await person(name);
      await deps.db.update(users).set({ status: "suspended" }).where(eq(users.id, user.id));
      const n = await revokeAllSessions(deps, deps.db, user.id);
      say(`Locked @${user.username} and signed them out of ${n} sessions.`);
      break;
    }
    case "unlock": {
      const user = await person(name);
      if (user.status !== "suspended") {
        say(`@${user.username} isn't locked (they're ${user.status}).`);
        break;
      }
      await deps.db.update(users).set({ status: "active" }).where(eq(users.id, user.id));
      say(`Unlocked @${user.username}. They can sign in again.`);
      break;
    }
    case "staff": {
      const user = await person(name);
      if (role !== "admin" && role !== "moderator" && role !== "none") throw new Error(USAGE);
      await deps.db
        .update(users)
        .set({ staffRole: role === "none" ? null : role })
        .where(eq(users.id, user.id));
      await deps.db.insert(schema.staffActions).values({
        id: deps.ids.next(),
        actorId: user.id,
        action: "user.update",
        targetType: "user",
        targetId: user.id.toString(),
        detail: { staff: { after: role === "none" ? null : role } },
        reason: "Set from the server's emergency kit",
      });
      say(
        role === "none"
          ? `@${user.username} is no longer staff.`
          : `@${user.username} is now ${role}.`,
      );
      break;
    }
    default:
      say(USAGE);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await deps.close();
}
