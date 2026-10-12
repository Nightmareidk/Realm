import type { Invite } from "@realm/contracts";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { textLink } from "@/components/pill";
import { AuthCard, AuthHeader, AuthSwitch } from "@/features/auth/auth-shell";
import { InviteCard } from "@/features/spaces/invite-card";
import { InviteSignup, JoinButton } from "@/features/spaces/invite-join";
import { peekViewer, SESSION_COOKIE } from "@/lib/viewer";

const API_URL = process.env.REALM_API_URL ?? "http://localhost:4000";
const CODE = /^[A-Za-z0-9]{4,32}$/;

type Looked = { invite: Invite } | { dead: string } | null;

/** The invite as anyone holding the link sees it, or why it no longer works. */
const lookUp = cache(async (code: string): Promise<Looked> => {
  if (!CODE.test(code)) return null;
  const res = await fetch(`${API_URL}/v1/invites/${code}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (res.ok) return { invite: (await res.json()) as Invite };
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { dead: body?.error?.message ?? "This invite doesn't work any more. Ask for a new one." };
});

/** Already in it? Then the page offers to open the Space instead of joining again. */
async function alreadyIn(slug: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const res = await fetch(`${API_URL}/v1/communities/${slug}`, {
    headers: {
      accept: "application/json",
      cookie: `${SESSION_COOKIE}=${token}`,
      "x-realm-peek": "1",
    },
    cache: "no-store",
  }).catch(() => null);
  return res?.ok ?? false;
}

export async function generateMetadata({ params }: PageProps<"/i/[code]">): Promise<Metadata> {
  const found = await lookUp((await params).code).catch(() => null);
  const robots = { index: false, follow: false };
  if (!found || !("invite" in found)) return { title: "Invite", robots };
  const { community, inviter } = found.invite;
  const description = inviter
    ? `${inviter.displayName} invited you to ${community.name} on Realm.`
    : `You're invited to ${community.name} on Realm.`;
  return {
    title: `Join ${community.name}`,
    description,
    robots,
    openGraph: { title: `Join ${community.name} on Realm`, description },
  };
}

/**
 * /i/{code}: a friend's invite (the s3 "Invite-led" preview). Signed out, it's sign-up in two
 * steps beside the Space you're joining; signed in, one press joins. Dead links say what
 * happened and who to ask.
 */
export default async function InvitePage({ params }: PageProps<"/i/[code]">) {
  const { code } = await params;
  const found = await lookUp(code);
  if (!found) notFound();
  const viewer = await peekViewer();

  if ("dead" in found) {
    return (
      <>
        <AuthHeader />
        <main id="main" className="flex flex-1 items-center justify-center px-4 pt-2 pb-10">
          <AuthCard title="This invite doesn't work." lead={<p>{found.dead}</p>}>
            <Link href={viewer ? "/home" : "/"} className={textLink}>
              {viewer ? "Go to Realm" : "What's Realm?"}
            </Link>
          </AuthCard>
        </main>
      </>
    );
  }

  const { invite } = found;
  const space = invite.community;
  const heading = invite.inviter
    ? `Join ${invite.inviter.displayName.split(/\s+/)[0]} and the crew.`
    : `Join ${space.name}.`;
  const card = <InviteCard invite={invite} />;

  if (!viewer) {
    const login = `/login?next=${encodeURIComponent(`/i/${code}`)}`;
    return (
      <>
        <AuthHeader
          aside={<AuthSwitch lead="Already on Realm?" href={login} label="Sign in to join" />}
        />
        <main id="main" className="flex flex-1 items-center">
          <InviteSignup code={code} heading={heading} card={card} />
        </main>
      </>
    );
  }

  const member = await alreadyIn(space.slug);
  return (
    <>
      <AuthHeader />
      <main
        id="main"
        className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pt-6 pb-16 md:px-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16 xl:px-28"
      >
        {card}
        <div className="max-w-[36rem]">
          <h1 className="font-display text-[2.6rem] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-fg sm:text-[3.2rem]">
            {member ? `You're already in ${space.name}.` : heading}
          </h1>
          <p className="mt-5 max-w-[40ch] text-[1.1rem] leading-relaxed text-fg-soft">
            {member
              ? "Pick up where you left off."
              : `You're signed in as ${viewer.displayName}. Join and you'll land in its first room.`}
          </p>
          <div className="mt-8">
            {member ? (
              <Link
                href={`/spaces/${space.slug}`}
                className="inline-flex h-14 items-center rounded-full bg-accent px-9 font-bold text-on-accent hover:brightness-110"
              >
                Open {space.name}
              </Link>
            ) : (
              <JoinButton code={code} spaceName={space.name} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
