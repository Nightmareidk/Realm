---
version: 1
slug: "frontend-web-src-app-auth-layout-tsx"
primary_target: "frontend/web/src/app/(auth)/layout.tsx"
related_targets: ["frontend/web/src/app/(auth)/login/page.tsx","frontend/web/src/app/(auth)/signup/page.tsx","frontend/web/src/features/auth"]
---

# Surface: account flows (sign up, sign in, verify email, forgot and reset password, invite join)

Mode: Operate. The visitor completes a task: get in, or get back in, in under a minute.

Routes: `/login`, `/signup` (Pick your colour → birthday → account), `/verify` (and the emailed
`/verify?token=`), `/forgot`, `/reset?token=`, and later the invite page `/i/{code}`. Signed-in
visitors are sent on to `/home`.

User decisions: "Let them in, verify later" (2026-10-02); on 2026-10-04 the user chose "all 3" of
the previewed structures (`.impeccable/mocks/phase1/s1-colour`, `s2-inside`, `s3-invite`), so each
flow takes the one that fits it. Research: `docs/research/2026-10-phase1-auth-accounts.md` (§6 is
the screen-by-screen spec, copy and states).

## Direction contract

THESIS: Getting in should feel like arriving somewhere that's already yours: sign-in happens over
the app itself, and sign-up starts by choosing your colour, so the first thing Realm asks is how
you want it to look. Refuses the category default: a logo, a centred column and five identical
"Continue with" buttons.

OWN-WORLD: DESIGN.md's world, still: the ink ground lit by the theme's three lights with grain, no
canvas animation and no 3D on form pages. Funnel Display for the one title per screen; Atkinson for
every label, hint, error and link. Inputs are 56px rounded rectangles (Surface-dark fill, 12% ring,
action-colour focus ring); one action-colour pill per screen; links in Ink, underlined.

STORY: I know where I am (Realm, the app I'm about to use, or my friend's Space), what's asked of me
(only what's needed, each field saying why, birthday before anything personal), and what happens
next (I'm in; verifying can wait). Errors name the problem and the fix beside the field; nothing I
typed is lost; rate limits say how long to wait.

FIRST VIEWPORT: Sign in: a dimmed, still view of the app frame behind one 460px panel, centred
(mark, "Welcome back.", two fields, Forgot link, Sign in, "New here? Create an account"). Sign-up
step 1: left, "Pick your colour." at display size over four large theme swatches and Next; right,
a live profile card in the chosen theme; the whole page's light and action colour follow the pick.
Invite join: left, the friend's Space card (who invited you, who's in, who's here, its rooms);
right, "Join Noor and the crew." and the birthday step. Phones: the form alone in the page's flow,
the art dropped (the colour step keeps its swatches).

FORM: Surface round (seed d5180ef3) dealt Pick your colour, Inside the app and Invite-led; the user
locked all three, one per flow. Signature interaction: the theme pick re-lights the page and the
preview profile with DESIGN.md's 0.8s cross-fade, and that choice carries into the account.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
