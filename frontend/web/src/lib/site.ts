/** What the site says about itself: titles, descriptions and the address it lives at. */
export const SITE = {
  origin: process.env.REALM_WEB_ORIGIN ?? "http://localhost:3000",
  title: "Realm: Spaces, clips, profiles and boards for your crew",
  description:
    "One app for your friend group: Spaces with rooms and chat, a feed of posts and clips, profiles and discussion boards. Early access is open in your browser.",
} as const;
