// Shared content for the Phase 1 app previews: icons, the inbox, a DM with Noor, Here now.
// Demo people and messages are illustrative.
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
  pin: '<path d="M9 4h6l-1 5 3 3H7l3-3z"/><path d="M12 12v8"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  smile:
    '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9.5 10h.01M14.5 10h.01"/>',
  send: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  pen: '<path d="M5 19l1-4L16 5l3 3L9 18z"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>',
  chev: '<path d="m8 10 4 4 4-4"/>',
  hash: '<path d="M9 4 7 20M17 4l-2 16M4.5 9h15M4 15h15"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
};
const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24">${I[n]}</svg>`;
const MARK = `<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="11.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="17.5" cy="11" r="5" fill="var(--acc)"/></svg>`;

const P = {
  noor: { n: "Noor", c: "#ff8a5c" },
  kenji: { n: "Kenji", c: "#c4a5ff" },
  ama: { n: "Ama", c: "#5fd8ef" },
  sol: { n: "Sol", c: "#ffd36b" },
  jun: { n: "Jun", c: "#8ee6a8" },
  theo: { n: "Theo", c: "#ff9ac2" },
  you: { n: "Sam", c: "#3ee6b0" },
};
const av = (p, s = 44, dot = false) =>
  `<span class="avwrap"><span class="av" style="width:${s}px;height:${s}px;font-size:${s * 0.42}px;background:${P[p].c}">${P[p].n[0]}</span>${dot ? '<i class="pdot"></i>' : ""}</span>`;
const group = (a, b, s = 44) =>
  `<span class="avwrap" style="width:${s}px;height:${s}px"><span class="av" style="position:absolute;left:0;top:0;width:${s * 0.68}px;height:${s * 0.68}px;font-size:${s * 0.3}px;background:${P[a].c}">${P[a].n[0]}</span><span class="av" style="position:absolute;right:0;bottom:0;width:${s * 0.68}px;height:${s * 0.68}px;font-size:${s * 0.3}px;background:${P[b].c};box-shadow:0 0 0 2.5px #131318">${P[b].n[0]}</span></span>`;

function inbox({ title = true, hereRow = true } = {}) {
  const rows = [
    [
      av("noor", 44, true),
      "Noor",
      '<p class="unread" style="color:var(--acc)">typing…</p>',
      "9:06",
      "",
    ],
    [
      group("kenji", "sol"),
      "Ranked night",
      '<p class="unread">Kenji: in, bringing snacks</p>',
      "8:51",
      '<span class="count">@</span>',
    ],
    [av("ama", 44, true), "Ama", "<p>You: lol no, that was Sol</p>", "8:12", ""],
    [
      group("sol", "jun"),
      "Clip club",
      '<p class="unread">Sol sent a photo</p>',
      "7:40",
      '<span class="count n">4</span>',
    ],
    [av("jun", 44), "Jun", "<p>see you sunday</p>", "Sat", ""],
    [av("theo", 44), "Theo", "<p>the jump that shouldn't have worked</p>", "Fri", ""],
  ];
  return `
  ${title ? `<div class="row" style="justify-content:space-between;padding:4px 4px 14px"><h2 class="display" style="font-size:1.55rem;letter-spacing:-0.03em">Messages</h2><span class="iconbtn" style="box-shadow:inset 0 0 0 1px rgb(255 255 255/.12)">${ic("pen", "sm")}</span></div>` : ""}
  ${
    hereRow
      ? `<div class="sec" style="margin:0 0 8px;padding:0 4px">Here now</div>
  <div class="row" style="gap:14px;padding:0 4px 16px">${["noor", "kenji", "ama", "sol"].map((p) => `<div class="col" style="align-items:center;gap:6px">${av(p, 46, true)}<span class="small ink2">${P[p].n}</span></div>`).join("")}</div>`
      : ""
  }
  <div class="row" style="gap:7px;padding:0 4px 12px"><span class="filter on">All</span><span class="filter">Unread</span><span class="filter">Groups</span><span class="filter">Requests <span class="count" style="height:20px;min-width:20px">1</span></span></div>
  <div class="col" style="gap:2px">${rows
    .map(
      ([a, n, p, t, b], i) =>
        `<div class="convo ${i === 0 ? "on" : ""}">${a}<div class="who"><b>${n}</b>${p}</div><div class="meta">${t}${b}</div></div>`,
    )
    .join("")}</div>`;
}

function convoHeader({ hereNowPill = false } = {}) {
  return `<div class="row" style="gap:12px;height:68px;padding:0 18px;border-bottom:1px solid var(--hair)">
    ${av("noor", 38, true)}
    <div><div class="display" style="font-size:1.25rem;letter-spacing:-0.025em;line-height:1.1">Noor</div><div style="font-size:0.82rem;color:var(--ink-2)">Here now · in a match, 12m</div></div>
    <span class="chip" style="margin-left:14px">Not end-to-end encrypted yet</span>
    <span style="margin-left:auto" class="row">${hereNowPill ? `<span class="chip" style="margin-right:6px"><i class="dot"></i>4 here now</span>` : ""}<span class="iconbtn">${ic("pin", "sm")}</span><span class="iconbtn">${ic("info", "sm")}</span><span class="iconbtn">${ic("more", "sm")}</span></span>
  </div>
  <div class="pinbar">${ic("pin", "sm")}<span><b>Noor:</b> ranked at 9, bring headsets</span><span style="margin-left:auto;font-size:0.8rem">1 of 2</span></div>`;
}

function messages({ accent = false, peek = false } = {}) {
  const me = accent ? "me acc" : "me";
  return `<div class="msgs">
    <span class="tag daytag">Today</span>
    <div class="b them first">anyone on tonight?</div>
    <div class="b them mid">ranked at 9, bring headsets</div>
    <div class="b them last">Kenji says his mic finally works 🎙️<span class="t">9:02</span></div>
    <div class="reacts"><span class="react mine">🔥 3</span><span class="react">😂 1</span></div>
    <div class="b ${me}">same, give me ten<span class="t">9:04</span></div>
    <div class="b ${me}">wait is Sol playing or watching<span class="t">9:05</span></div>
    <div class="seen">Seen 9:05 PM</div>
    <div class="b them first">watching. she's cutting the clip from last night</div>
    <div class="b them last" style="padding:5px;max-width:300px"><div style="height:150px;border-radius:15px;background:radial-gradient(90% 80% at 25% 20%,#2a6b5a,transparent 60%),radial-gradient(90% 90% at 85% 90%,#2b47ff,transparent 65%),#15151b;display:grid;place-items:center"><span style="width:42px;height:42px;border-radius:50%;background:rgb(255 255 255/.9)"></span></div><div style="padding:7px 9px 3px;font-size:0.9rem">the jump that shouldn't have worked · 0:14<span class="t">9:06</span></div></div>
    <div class="typing"><span class="dots"><i></i><i></i><i></i></span>Noor is typing…</div>
  </div>`;
}

function composer(peek = false) {
  return `${peek ? `<div class="row" style="gap:8px;max-width:52rem;margin:0 auto 8px;width:100%;padding-left:10px">${av("noor", 24, true)}<span class="small ink2">Noor is here</span></div>` : ""}
  <div class="composer"><span class="iconbtn">${ic("plus")}</span><span class="ph">Message Noor</span><span class="iconbtn">${ic("smile")}</span><span class="send">${ic("send", "sm")}</span></div>`;
}

function hereNow({ title = "Here now" } = {}) {
  const now = [
    ["noor", "In a match · 12m"],
    ["kenji", "Cutting a clip"],
    ["ama", "Around"],
    ["sol", "Watching Noor"],
  ];
  return `<div class="row" style="justify-content:space-between;padding:4px 10px 6px"><h2 class="display" style="font-size:1.25rem;letter-spacing:-0.025em">${title}</h2><span class="small ink2">4 friends</span></div>
  ${now.map(([p, s]) => `<div class="person">${av(p, 40, true)}<div><b>${P[p].n}</b><span>${s}</span></div></div>`).join("")}
  <div class="sec">Recently around</div>
  ${[
    ["jun", "2h ago"],
    ["theo", "Yesterday"],
  ]
    .map(
      ([p, s]) =>
        `<div class="person" style="opacity:.8">${av(p, 40)}<div><b>${P[p].n}</b><span>${s}</span></div></div>`,
    )
    .join("")}
  <div style="margin:18px 10px 0;padding:14px;border-radius:16px;background:var(--raised)"><b style="font-size:0.95rem">Only friends see you here</b><p class="small ink2" style="margin-top:4px">Change who sees your status in Privacy.</p></div>`;
}

function peek() {
  return `<div style="height:96px;margin:-16px -8px 0;background:radial-gradient(120% 140% at 0% 0%,#ff6a3d,transparent 58%),radial-gradient(100% 120% at 100% 10%,#ffb547,transparent 55%),radial-gradient(120% 120% at 50% 100%,#c2185b,#131318 78%)"></div>
  <div style="padding:0 10px"><div style="margin-top:-30px;width:68px;height:68px;border-radius:22px;border:4px solid #131318;background:#ff8a5c;display:grid;place-items:center;font-family:var(--display);font-weight:800;font-size:28px;color:#1d0904">N</div>
  <div class="display" style="font-size:1.45rem;letter-spacing:-0.03em;margin-top:8px">Noor</div>
  <div class="small ink2">@noor · she/her</div>
  <div class="row" style="gap:8px;margin-top:10px"><i class="dot"></i><span style="font-size:0.92rem">In a match · 12m</span></div>
  <div class="row" style="gap:8px;margin-top:14px"><span class="ghost" style="height:38px;padding:0 14px;font-size:0.88rem">View profile</span><span class="ghost" style="height:38px;width:38px;padding:0">${ic("more", "sm")}</span></div>
  <div class="sec" style="padding:0;margin-top:20px">In 2 Spaces with you</div>
  <div class="row" style="gap:10px;font-size:0.92rem"><span style="width:28px;height:28px;border-radius:9px;background:#ff8a5c"></span>Late Night Lobby</div>
  <div class="row" style="gap:10px;font-size:0.92rem;margin-top:8px"><span style="width:28px;height:28px;border-radius:9px;background:#2b47ff"></span>Clip club</div>
  <div class="sec" style="padding:0;margin-top:18px">Photos and clips</div>
  <div class="row" style="gap:6px">${["#2a6b5a", "#3a2a8a", "#7a3b2e"].map((c) => `<span style="flex:1;height:64px;border-radius:12px;background:radial-gradient(90% 80% at 30% 25%,${c},#15151b)"></span>`).join("")}</div>
  <div style="margin-top:18px;padding:13px 14px;border-radius:16px;background:var(--raised)"><b style="font-size:0.9rem">About this chat</b><p class="small ink2" style="margin-top:4px;line-height:1.45">Protected on the way to Realm, but not end-to-end encrypted yet. That arrives before public launch.</p></div></div>`;
}
