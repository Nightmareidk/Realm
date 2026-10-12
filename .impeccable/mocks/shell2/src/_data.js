// Shared demo content for the shell round 2 previews. People, Spaces, messages and pictures are
// illustrative (the pictures are the owner's own generated art from frontend/web/public/media).
const MEDIA = "../../../../frontend/web/public/media/";
const img = (f) => `url('${MEDIA}${f}')`;

const I = {
  home: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z"/>',
  spaces:
    '<rect x="4" y="4" width="7" height="7" rx="2.2"/><rect x="13" y="4" width="7" height="7" rx="2.2"/><rect x="4" y="13" width="7" height="7" rx="2.2"/><rect x="13" y="13" width="7" height="7" rx="3.5"/>',
  messages:
    '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 5 13.5z"/>',
  feed: '<rect x="4.5" y="4" width="15" height="7" rx="2"/><rect x="4.5" y="13" width="15" height="7" rx="2"/>',
  explore: '<circle cx="12" cy="12" r="8"/><path d="m14.8 9.2-1.7 4-3.9 1.6 1.7-4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  people:
    '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M15.5 14.2A4.6 4.6 0 0 1 21 18.6"/>',
  more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  speaker:
    '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
  hash: '<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  clip: '<path d="m15.5 8.5-6.4 6.4a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7 7a6 6 0 0 0 8.5 8.5l5.6-5.6"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  invite:
    '<circle cx="10" cy="9" r="3.4"/><path d="M3.5 19.5a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  photo:
    '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5L7 19"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>',
  headset:
    '<path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.6"/><rect x="16.5" y="14" width="4" height="6" rx="1.6"/>',
};
const ic = (n, cls = "", s) =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24"${s ? ` style="width:${s}px;height:${s}px"` : ""}>${I[n]}</svg>`;
const MARK = (s = 26) =>
  `<svg viewBox="0 0 28 28" width="${s}" height="${s}"><circle cx="14" cy="14" r="11.3" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="17.6" cy="10.9" r="5" fill="var(--acc)"/></svg>`;
const WORD = (s = 26) =>
  `<span class="row" style="gap:9px;color:var(--ink)">${MARK(s)}<span class="display" style="font-weight:800;font-size:${s * 0.86}px;letter-spacing:-0.045em">realm</span></span>`;

// People. pic = their picture (a crop of the owner's art); otherwise initials on their colour.
const P = {
  noor: { n: "Noor", c: "linear-gradient(135deg,#ff6a3d,#c2185b 70%)", st: "on" },
  kenji: { n: "Kenji", c: "#c4a5ff", st: "on" },
  ama: { n: "Ama", c: "#5fd8ef", pic: "media-meadow.webp", st: "on" },
  sol: { n: "Sol", c: "#ffd36b", st: "on" },
  jun: { n: "Jun", c: "#8ee6a8", pic: "media-monoliths.webp", st: "on" },
  theo: { n: "Theo", c: "#ff9ac2", st: "idle" },
  mira: { n: "Mira", c: "#9fb6ff", pic: "media-hills.webp", st: "on" },
  dev: { n: "Dev", c: "#ffb38a", st: "off" },
};
function av(p, s = 36, { dot = false, cut } = {}) {
  const x = P[p];
  const bg = x.pic ? `background-image:${img(x.pic)}` : `background:${x.c}`;
  const ink = x.c.startsWith("linear") ? "color:#fff;" : "";
  const d = dot && x.st !== "off" ? `<i class="dot ${x.st === "idle" ? "idle" : ""}"></i>` : "";
  return `<span class="av" style="width:${s}px;height:${s}px;font-size:${s * 0.4}px;${bg};${ink}${cut ? `--dot-cut:${cut}` : ""}">${x.pic ? "" : x.n[0]}${d}</span>`;
}
const stack = (ps, s = 26, cut) =>
  `<span class="stack" style="${cut ? `--stack-cut:${cut}` : ""}">${ps.map((p) => av(p, s)).join("")}</span>`;

// Spaces. Each has its own colour (badge), a picture (its latest photo or banner), rooms and what's live.
const S = [
  {
    id: "lnl",
    n: "Late Night Lobby",
    ab: "LN",
    c: "#ff8a5c",
    pic: "clip-monoliths-wide.webp",
    voice: { room: "hangout", who: ["kenji", "ama", "sol"] },
    last: ["kenji", "general", "in, bringing snacks. starting at 9?"],
    when: "2m",
    unread: 12,
    here: ["kenji", "ama", "sol", "jun"],
    members: 9,
  },
  {
    id: "bks",
    n: "Brooklyn Speedrunners",
    ab: "BS",
    c: "#5fd8ef",
    pic: "media-gate.webp",
    last: ["mira", "routes", "new any% route is up, 0.8s faster"],
    when: "14m",
    unread: 3,
    here: ["mira"],
    members: 24,
  },
  {
    id: "clip",
    n: "Clip Club",
    ab: "CC",
    c: "#cdb4ff",
    pic: "media-arch.webp",
    last: ["jun", "clips", "sent 2 photos"],
    when: "1h",
    unread: 0,
    dot: true,
    here: ["jun"],
    members: 6,
  },
  {
    id: "sun",
    n: "Sunday Raid",
    ab: "SR",
    c: "#8ee6a8",
    pic: "media-meadow.webp",
    last: ["theo", "general", "same time next week?"],
    when: "Sat",
    unread: 0,
    here: [],
    members: 5,
  },
];
function badge(s, size = 40, radius, { voice = false, cut = "var(--ground)" } = {}) {
  const r = radius ?? Math.round(size * 0.3);
  const b = `<span class="badge" style="width:${size}px;height:${size}px;border-radius:${r}px;background:${s.c};font-size:${size * 0.36}px">${s.ab}</span>`;
  if (!voice || !s.voice) return b;
  // Someone's in a voice room here: a small green speaker dot on the badge's corner.
  return `<span style="position:relative;display:inline-flex;flex:none">${b}<i style="position:absolute;right:-4px;bottom:-4px;width:16px;height:16px;border-radius:50%;background:var(--presence) url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2304150f%22 stroke-width=%222.6%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M4.5 9.5h3l4.5-4v13l-4.5-4h-3z%22/%3E%3Cpath d=%22M15.5 9a4.2 4.2 0 0 1 0 6%22/%3E%3C/svg%3E') center/10px no-repeat;box-shadow:0 0 0 2.5px ${cut}"></i></span>`;
}

// The room the Space views open on.
const CHAT = [
  { day: "Today" },
  { who: "kenji", t: ["who's on tonight", "ranked at 9, need two more"] },
  { who: "ama", t: ["me, after dinner"], pic: null },
  { who: "jun", t: ["clip from last night, the jump that shouldn't have worked"], pic: "clip-monoliths-wide.webp" },
  { who: "noor", t: ["that's illegal", "I'm in. bringing the bad snacks"] },
  { who: "sol", t: ["hangout's open, come through"] },
  { who: "kenji", t: ["in, bringing snacks. starting at 9?"] },
];
