# Realm next to Instagram, Discord, Reddit, X and Spotify

Written 2026-11-15, from what is in the code today. "Has" means it is built in the phone app
(the website trails it in places). "Missing" means nothing for it exists yet. Realm never copies
another app's name, art or wording: this is a list of what people expect, not a list to clone.

## Built since this was written (2026-11-15 to 11-18)

- **X side:** reposts, quote posts, hashtags with Trending, and polls (numbers hidden until you
  vote; one vote each; nobody sees who chose what).
- **Spotify side:** people share their own songs; **Listen along** (friends see the song you
  play in Music and can join at the same moment); **Your week** (a recap of the last seven days).
- **Time capsules** (2026-11-18): seal a post until a day you pick, from an hour to five years
  ahead. Others see a countdown and can tap "Remind me"; it lands in Home and tells everyone
  waiting the moment it opens. The website shows capsules but can't make one yet.
- **Feel:** photos fade in, pull to refresh on more screens, loading outlines.

Listen along, Your week and time capsules are things the big apps don't give: Spotify's shared
listening needs Premium, its recap comes once a year, and none of them can seal a post until a
date.

## The short version

- **Instagram side: nearly all there.** Posts, Stories, Clips, Notes, Close Friends, saved
  folders, tags, private accounts, and full DMs.
- **Discord side: the core is there** (Spaces, rooms, roles, invites, voice). The extras that make
  it feel rich are missing: threads, custom emoji, GIFs, screen sharing.
- **Spotify side: a real player and library**, but only free-licence music. No lyrics, artist
  pages or shared listening.
- **X side: half there.** Posting, following, mentions and pinned posts exist. Reposts, quotes,
  hashtags, trends and polls don't.
- **Reddit side: not started.** No boards, votes or sorting.
- **Feel:** every screen loaded with a bare spinner until today, and motion and touch feedback
  are used in only a few places.

## Instagram

| Has | Missing |
|---|---|
| Photo and text posts, likes, comments with likes and replies | Live video |
| Stories with music, Close Friends, Highlights | Story stickers (polls, questions, links, countdowns) |
| Clips with music, creators' own sounds | Remix or duet of someone's Clip |
| Notes with a song | Camera filters and effects |
| Saved folders, tags, @mentions, pinned posts, archive | Drafts and scheduled posts |
| Hide likes, comments off, private accounts, follow requests | Insights (who saw what, growth) |
| Explore and search, Activity | Broadcast channels |
| DMs: reactions, replies, edit, unsend, Seen, view-once photos, requests, sharing posts | Voice messages (needs the next app build), GIFs and stickers in chats, video calls |

## Discord

| Has | Missing |
|---|---|
| Spaces with text rooms, announcement rooms and voice rooms | Threads inside a room |
| Roles and permissions, invites, slow mode, reports, moderation | Forum-style rooms (see Reddit) |
| Friends, who's online, group chats | Custom emoji and stickers per Space |
| Pinned messages | GIF picker |
| | Screen sharing and video in voice rooms |
| | Stage rooms (a few speak, many listen) |
| | Search inside a room |
| | Bots and outside integrations |

## Reddit

| Has | Missing |
|---|---|
| Comments with replies | Boards: posts with a title inside a Space |
| | Upvotes and downvotes, and sorting by hot, new and top |
| | Flair (labels on posts and people) |
| | Points for good posts (karma) |
| | Cross-posting, saved drafts, post awards |

## X (Twitter)

| Has | Missing |
|---|---|
| Text posts, likes, comments, @mentions | Threads (several posts as one) |
| Following and followers, verified badges | |
| Pinned post, saved posts | |
| Reposts and quote posts, hashtags and Trending, polls | |
| | Lists, and a "For you" next to "Following" |
| | Who-can-reply choices, post view counts |

## Spotify

| Has | Missing |
|---|---|
| A free-licence music library with credits | The big labels' catalogue (not possible: licensing) |
| Playlists, liked songs, moods | Lyrics |
| Player with shuffle, repeat and a queue; the Now Playing bar | Artist pages, following artists, albums |
| Songs on Stories, Clips and Notes | Shared playlists |
| People's own songs; Listen along with friends | Sleep timer, crossfade, offline listening |
| Your week (a recap of the last seven days) | Weekly mixes made for you |
| | Podcasts |

## What "premium" feel needs (measured in the app's code)

| Thing | Before today | Now |
|---|---|---|
| Loading | A spinner on every screen | The outline of the content on Home, Inbox, Activity, Search, Profile, Chat, people lists and song lists (`src/skeleton.tsx`) |
| Motion | Animations in 15 files | Unchanged |
| Touch feedback (haptics) | In 11 files | Unchanged |
| Pull to refresh | On 7 screens | Unchanged |

## Suggested order

1. **Feel first** (no new features, everything gets nicer): finish the loading outlines, like
   and send animations, press feedback and haptics everywhere, pull to refresh everywhere,
   pictures that fade in.
2. **The missing social basics:** reposts and quotes, polls, hashtags and trends.
3. **Boards** inside Spaces, with votes and sorting.
4. **Richer Spaces:** threads, custom emoji, GIFs, screen sharing.
5. **Richer music:** lyrics for creators' own songs, artist pages, shared playlists, sleep timer,
   listening together.

## Not planned, and why

- **Licensed music, podcasts:** need deals with rights holders. Realm stays with free-licence
  music and creators' own sounds.
- **Live video for many viewers:** costs real money per minute watched. Small voice rooms are
  fine on the free tier.
- **GIFs** need a free key from a GIF service, which the owner would sign up for.
- **Paid extras (boosts, subscriptions):** wait for the owner's Stripe account.
