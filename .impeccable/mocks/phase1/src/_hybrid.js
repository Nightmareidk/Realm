// Hybrid frame pieces (load after _parts.js).
function hbTop(active = "Spaces") {
  const dest = [
    ["home", "Home"],
    ["spaces", "Spaces"],
    ["messages", "Messages", '<span class="count">2</span>'],
    ["feed", "Feed"],
    ["explore", "Explore"],
  ];
  return `<span class="mark">${MARK}realm</span>
  <nav class="row" style="gap:4px;margin-left:26px">${dest
    .map(
      ([i, l, b]) =>
        `<span class="pillnav ${l === active ? "on" : ""}">${ic(i, "sm")}${l}${b || ""}</span>`,
    )
    .join("")}</nav>
  <div class="travel" style="width:320px;margin-left:auto">${ic("search", "sm")}Search or jump to…<span class="kbd">Ctrl K</span></div>
  <span class="iconbtn" style="box-shadow:inset 0 0 0 1px rgb(255 255 255/.14)">${ic("plus")}</span>
  <span class="iconbtn" style="position:relative">${ic("bell")}<i style="position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:50%;background:var(--acc)"></i></span>
  ${av("you", 36, true)}`;
}

function hbSide(activeSpace = "", activeDm = "") {
  const spaces = [
    ["Late Night Lobby", "#ff8a5c", '<span class="ndot"></span>'],
    ["Clip club", "#2b47ff", '<span class="count" style="height:20px;min-width:20px">1</span>'],
    ["Sunday builds", "#14b8d6", ""],
    ["Speedrun Garage", "#8b6bff", ""],
  ];
  const dms = [
    ["noor", "Noor", '<span class="small" style="color:var(--acc)">typing…</span>'],
    ["group", "Ranked night", '<span class="count" style="height:20px;min-width:20px">@</span>'],
    ["ama", "Ama", ""],
    ["kenji", "Kenji", ""],
    ["jun", "Jun", ""],
  ];
  const live = ["noor", "ama", "kenji"];
  return `<div class="sideh"><span>Spaces</span><span>${ic("plus", "sm")}</span></div>
  ${spaces.map(([n, c, b]) => `<div class="sitem ${n === activeSpace ? "on" : ""}"><span class="sp" style="background:${c}"></span>${n}<span class="r">${b}</span></div>`).join("")}
  <div class="rule" style="margin:12px 8px"></div>
  <div class="sideh"><span>Messages</span><span>${ic("pen", "sm")}</span></div>
  ${dms.map(([p, n, b]) => `<div class="sitem ${n === activeDm ? "on" : ""}">${p === "group" ? group("kenji", "sol", 26) : av(p, 26, live.includes(p))}${n}<span class="r">${b}</span></div>`).join("")}
  <div style="margin-top:auto;padding:12px 8px 0;border-top:1px solid var(--hair)" class="row"><span class="row" style="gap:10px">${av("you", 32, true)}<span><b style="font-size:0.92rem">Sam</b><span class="small ink2" style="display:block;line-height:1.2">Around</span></span></span><span class="iconbtn" style="margin-left:auto">${ic("settings", "sm")}</span></div>`;
}

function spaceMessages(accent = true) {
  const me = accent ? "me acc" : "me";
  return `<div class="msgs">
    <span class="tag daytag">Today</span>
    <div class="who">Noor</div>
    <div class="b them first">ranked at 9, who's in</div>
    <div class="b them last">bring headsets, Kenji's mic works now 🎙️<span class="t">8:58</span></div>
    <div class="reacts"><span class="react mine">🔥 4</span><span class="react">🎧 2</span></div>
    <div class="who">Kenji</div>
    <div class="b them">in. bringing snacks<span class="t">9:01</span></div>
    <div class="b ${me}">in, give me ten<span class="t">9:03</span></div>
    <div class="who">Sol</div>
    <div class="b them first">watching tonight, cutting last night's clip</div>
    <div class="b them last" style="padding:5px;max-width:300px"><div style="height:140px;border-radius:15px;background:radial-gradient(90% 80% at 25% 20%,#2a6b5a,transparent 60%),radial-gradient(90% 90% at 85% 90%,#2b47ff,transparent 65%),#15151b;display:grid;place-items:center"><span style="width:40px;height:40px;border-radius:50%;background:rgb(255 255 255/.9)"></span></div><div style="padding:7px 9px 3px;font-size:0.9rem">the jump that shouldn't have worked · 0:14<span class="t">9:06</span></div></div>
    <div class="typing"><span class="dots"><i></i><i></i><i></i></span>Ama is typing…</div>
  </div>`;
}

function members() {
  const now = [
    ["noor", "In a match · 12m"],
    ["kenji", "Cutting a clip"],
    ["ama", "Around"],
    ["sol", "Watching Noor"],
  ];
  return `<div class="row" style="justify-content:space-between;padding:4px 10px 6px"><h2 class="display" style="font-size:1.25rem;letter-spacing:-0.025em">Here now</h2><span class="small ink2">4 of 7</span></div>
  ${now.map(([p, s]) => `<div class="person">${av(p, 40, true)}<div><b>${P[p].n}</b><span>${s}</span></div></div>`).join("")}
  <div class="sec">Away</div>
  ${[
    ["jun", "2h ago"],
    ["theo", "Yesterday"],
  ]
    .map(
      ([p, s]) =>
        `<div class="person" style="opacity:.8">${av(p, 40)}<div><b>${P[p].n}</b><span>${s}</span></div></div>`,
    )
    .join("")}
  <div class="sec">Pinned</div>
  <div style="margin:0 10px;padding:12px 14px;border-radius:14px;background:var(--raised);font-size:0.9rem"><b>Noor</b> <span class="ink2">ranked at 9, bring headsets</span></div>`;
}
