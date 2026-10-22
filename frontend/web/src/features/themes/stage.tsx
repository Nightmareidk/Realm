import {
  ChatCircle,
  Hash,
  Heart,
  House,
  MusicNotes,
  MusicNotesSimple,
  PaperPlaneTilt,
  SquaresFour,
} from "@phosphor-icons/react";
import type { ResolvedTheme } from "@realm/contracts";
import type { CSSProperties } from "react";
import { pill } from "@/components/pill";
import { scopedTheme } from "./engine";

/**
 * The theme maker's preview: a small but real Realm, drawn with the same values the app uses
 * (the theme's variables set on this box only). The menu with a section title, a chat with both
 * kinds of bubbles and a link, a post, and the two kinds of button, over the theme's wallpaper.
 * Every colour here reads from `var(--r-*)` on purpose: the site's own Tailwind colours are set
 * for the page, not this box.
 */
export function ThemeStage({ theme, height = 380 }: { theme: ResolvedTheme; height?: number }) {
  const { vars, attrs } = scopedTheme(theme);
  const v = (name: string) => `var(--r-${name})`;
  const panel: CSSProperties = {
    background: v("surface"),
    backdropFilter: `blur(${v("panel-blur")})`,
    boxShadow: `${v("panel-ring")}, ${v("panel-shadow")}`,
    borderRadius: v("radius-box"),
  };
  const display: CSSProperties = { fontFamily: `${v("font-display")}, system-ui` };
  const hasWall = Boolean(theme.art.wallpaper);
  const glow = theme.style.glow;
  const [l1, l2, l3] = theme.colors.lights;

  return (
    <div
      {...attrs}
      aria-label={`Preview of ${theme.name}`}
      role="img"
      style={{
        ...(vars as CSSProperties),
        position: "relative",
        height,
        overflow: "hidden",
        borderRadius: "1.25rem",
        background: v("bg"),
        color: v("text"),
        fontFamily: `${v("font-body")}, system-ui`,
        fontSize: 13,
        isolation: "isolate",
      }}
    >
      {/* Behind: the wallpaper and its layer, or the soft lights. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: -1 }}>
        {hasWall ? (
          <>
            <div
              style={{
                position: "absolute",
                inset: -20,
                backgroundImage: v("wallpaper"),
                backgroundSize: "cover",
                backgroundPosition: v("wallpaper-pos"),
                filter: v("wallpaper-filter"),
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: v("wallpaper-overlay"),
                opacity: v("wallpaper-dim"),
              }}
            />
          </>
        ) : glow > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: glow,
              background: `radial-gradient(60% 70% at 15% 100%, ${l1}99, transparent 70%), radial-gradient(50% 60% at 90% 0%, ${l2}88, transparent 70%), radial-gradient(40% 50% at 60% 60%, ${l3}66, transparent 70%)`,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: v("pattern"),
            opacity: v("pattern-opacity"),
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "34% 1fr",
          gap: 8,
          padding: 8,
          height: "100%",
        }}
      >
        {/* The menu */}
        <div
          style={{
            ...panel,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          <div
            style={{
              ...display,
              fontSize: 17,
              fontWeight: 800,
              padding: "2px 6px 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                border: `2.5px solid ${v("text")}`,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: v("accent"),
                  right: 0,
                  top: 0,
                }}
              />
            </span>
            realm
          </div>
          {[
            [House, "Home", true],
            [SquaresFour, "Spaces", false],
            [ChatCircle, "Messages", false],
          ].map(([Icon, label, on]) => {
            const I = Icon as typeof House;
            return (
              <div
                key={label as string}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: v("radius-card"),
                  background: on ? v("surface-raised") : "transparent",
                  color: on ? v("text") : v("text-soft"),
                  fontWeight: 700,
                }}
              >
                <I
                  size={15}
                  weight={
                    on
                      ? "fill"
                      : theme.style.icons === "duotone"
                        ? "duotone"
                        : theme.style.icons === "fill"
                          ? "fill"
                          : theme.style.icons === "bold"
                            ? "bold"
                            : "regular"
                  }
                  aria-hidden="true"
                />
                {label as string}
              </div>
            );
          })}
          <p className="r-heading" style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700 }}>
            Your Spaces
          </p>
          {["Friday squad", "Late Night Lobby"].map((n, i) => (
            <div
              key={n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 8px",
                color: v("text-soft"),
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: i ? l2 : v("accent"),
                  flex: "none",
                }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n}
              </span>
            </div>
          ))}
        </div>

        {/* A room: messages, a post, the buttons */}
        <div
          style={{
            ...panel,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 7,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              paddingBottom: 6,
              borderBottom: `1px solid ${v("border")}`,
            }}
          >
            <Hash size={14} aria-hidden="true" /> general
          </div>
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "78%",
              padding: "6px 10px",
              background: v("surface-raised"),
              borderRadius: bubble(theme),
            }}
          >
            ranked at 9? check{" "}
            <span className="r-link" style={{ color: v("link"), textDecoration: "underline" }}>
              tomyrealm.com
            </span>
          </div>
          <div
            style={{
              alignSelf: "flex-end",
              maxWidth: "78%",
              padding: "6px 10px",
              background: v("accent"),
              color: v("on-accent"),
              borderRadius: bubble(theme),
            }}
          >
            yes!! bringing the good headset
          </div>
          <div
            style={{
              marginTop: 2,
              padding: 8,
              background: v("surface-raised"),
              borderRadius: v("radius-card"),
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                flex: "none",
                borderRadius: v("radius-media"),
                background: `linear-gradient(135deg, ${l1}, ${l2}, ${l3})`,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ ...display, fontWeight: 800, fontSize: 14 }}>Noor's post</div>
              <div style={{ color: v("text-soft"), fontSize: 12 }}>coffee before ranked</div>
              <MusicTag theme={theme} />
              <div style={{ display: "flex", gap: 10, marginTop: 4, color: v("text-soft") }}>
                <Heart size={14} weight="fill" color="#ff5f7a" aria-hidden="true" />
                <ChatCircle size={14} aria-hidden="true" />
                <PaperPlaneTilt size={14} aria-hidden="true" />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
            <span className={pill("action", "sm")} style={{ height: 30, fontSize: 12 }}>
              Join
            </span>
            <span
              className={pill("ghost", "sm")}
              style={{
                height: 30,
                fontSize: 12,
                color: v("text"),
                boxShadow: `inset 0 0 0 1.5px ${v("border-strong")}`,
              }}
            >
              Maybe later
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The music on a post, as the phone draws it in this theme's post style: a lit pill (glow), a
 * dashed ticket strip in the display face (ticket), or one quiet line (thread).
 */
function MusicTag({ theme }: { theme: ResolvedTheme }) {
  const v = (name: string) => `var(--r-${name})`;
  const kind = theme.style.posts;
  const song = "Lofi House";
  const artist = "AstroShroom";
  if (kind === "thread") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 3,
          color: v("text-soft"),
          fontSize: 11,
        }}
      >
        <MusicNotes size={11} aria-hidden="true" />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {song} · {artist}
        </span>
      </div>
    );
  }
  if (kind === "ticket") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginTop: 4,
          padding: "2px 7px",
          border: `1.5px dashed ${v("text")}`,
          fontFamily: `${v("font-display")}, system-ui`,
          fontSize: 9.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        <MusicNotesSimple size={10} weight="fill" aria-hidden="true" />
        {song}
        <span
          style={{ textTransform: "none", letterSpacing: 0, fontFamily: "inherit", opacity: 0.8 }}
        >
          / {artist}
        </span>
      </div>
    );
  }
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        marginTop: 4,
        padding: "2px 8px",
        borderRadius: 999,
        background: v("accent"),
        color: v("on-accent"),
        boxShadow: `0 0 12px color-mix(in srgb, ${v("accent")} 55%, transparent)`,
        fontSize: 10.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <MusicNotesSimple size={10} weight="fill" aria-hidden="true" />
      {song} · {artist}
    </div>
  );
}

function bubble(t: ResolvedTheme) {
  return t.style.bubbles === "square" ? 6 : t.style.bubbles === "soft" ? 11 : 18;
}
