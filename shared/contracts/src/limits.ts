/** Field limits shared by validation on every client and the server. */
export const Limits = {
  username: { min: 3, max: 32 },
  displayName: { min: 1, max: 48 },
  password: { min: 10, max: 256 },
  bio: { max: 300 },
  pronouns: { max: 40 },
  minimumAgeYears: 13,
  /** Under this age, the teen defaults apply (docs/research/2026-10-phase1-spaces-feed-safety.md §3.4). */
  adultAgeYears: 18,
  communityName: { min: 2, max: 64 },
  communitySlug: { min: 3, max: 32 },
  communityDescription: { max: 500 },
  channelName: { min: 1, max: 64 },
  roomName: { min: 1, max: 32 },
  spacesPerUser: 100,
  roomsPerSpace: 50,
  /** A teen's presence shows only in Spaces up to this size. */
  teenPresenceSpaceSize: 200,
  channelTopic: { max: 1024 },
  roleName: { min: 1, max: 64 },
  message: { max: 4000 },
  messageAttachments: { max: 10 },
  postTitle: { min: 1, max: 300 },
  postBody: { max: 40_000 },
  comment: { max: 10_000 },
  /** Posts and Clips (the Instagram side): a caption, up to 10 photos, a short comment. */
  caption: { max: 2200 },
  postMedia: { max: 10 },
  postComment: { max: 1000 },
  groupDmRecipients: { max: 25 },
  pageSize: { default: 50, max: 100 },
} as const;
