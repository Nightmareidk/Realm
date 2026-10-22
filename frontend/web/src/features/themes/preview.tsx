import type { ResolvedTheme } from "@realm/contracts";

/**
 * A small drawing of Realm in a theme, from the theme's own values: ground and lights, the stories
 * row in its style, one post (glow, ticket or thread) and the tab bar. With `wide`, a desktop
 * window instead of a phone. Decorative: it sits beside the theme's name.
 */
export function ThemePreview({
  theme,
  width = 150,
  wide = false,
}: {
  theme: ResolvedTheme;
  width?: number;
  wide?: boolean;
}) {
  const c = theme.colors;
  const [l1, l2, l3] = c.lights;
  const glow = theme.style.glow;
  const u = width / 150;
  const px = (v: number) => `${(v * u).toFixed(1)}px`;
  const media = theme.style.corners === "square" ? 3 : theme.style.corners === "soft" ? 8 : 12;
  const photo = (h: number, flat = false) => (
    <div
      style={{
        height: px(h),
        borderRadius: flat ? 0 : px(media),
        background: `linear-gradient(135deg, ${l1}, ${l2} 55%, ${l3})`,
      }}
    />
  );
  const stories = (
    <div style={{ display: "flex", gap: px(5), padding: `0 ${px(8)} ${px(8)}` }}>
      {[c.accent, l1, l2, l3].map((col, i) =>
        theme.style.stories === "bands" ? (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing
            key={i}
            style={{
              width: px(24),
              height: px(34),
              borderRadius: px(5),
              background: c.raised,
              display: "flex",
              alignItems: "flex-end",
              overflow: "hidden",
            }}
          >
            <div style={{ height: px(7), width: "100%", background: i < 2 ? col : c.line }} />
          </div>
        ) : (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing
            key={i}
            style={{
              width: px(22),
              height: px(22),
              borderRadius: "50%",
              padding: px(2),
              border: `${theme.style.stories === "thin" ? 1 : 2}px solid ${i < 2 ? (theme.style.stories === "thin" ? c.text : col) : c.line}`,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: [l1, l2, l3, c.raised][i],
              }}
            />
          </div>
        ),
      )}
    </div>
  );
  const post =
    theme.style.posts === "thread" ? (
      <div style={{ display: "flex", gap: px(6), padding: `0 ${px(8)}` }}>
        <div
          style={{
            width: px(14),
            height: px(14),
            borderRadius: "50%",
            background: l2,
            flex: "none",
          }}
        />
        <div style={{ flex: 1, display: "grid", gap: px(4) }}>
          <div style={{ width: "60%", height: px(4), borderRadius: 2, background: c.text }} />
          <div style={{ width: "80%", height: px(3), borderRadius: 2, background: c.textSoft }} />
          {photo(wide ? 60 : 70)}
        </div>
      </div>
    ) : theme.style.posts === "ticket" ? (
      <div
        style={{
          margin: `0 ${px(8)}`,
          background: c.surface,
          borderRadius: px(8),
          overflow: "hidden",
        }}
      >
        {photo(wide ? 58 : 66, true)}
        <div style={{ margin: `${px(4)} ${px(6)}`, borderTop: `1px dashed ${c.line}` }} />
        <div style={{ display: "flex", gap: px(4), alignItems: "center", padding: px(6) }}>
          <div style={{ width: px(10), height: px(10), borderRadius: 2, background: l1 }} />
          <div style={{ flex: 1, height: px(3), borderRadius: 2, background: c.text }} />
        </div>
      </div>
    ) : (
      <div style={{ position: "relative", padding: `0 ${px(8)}` }}>
        {glow > 0 && (
          <div
            style={{
              position: "absolute",
              inset: `${px(10)} ${px(4)} ${px(-6)}`,
              borderRadius: px(20),
              background: l1,
              opacity: 0.18 + glow * 0.3,
              filter: `blur(${px(10)})`,
            }}
          />
        )}
        <div style={{ position: "relative" }}>{photo(wide ? 70 : 84)}</div>
      </div>
    );
  const floating = theme.style.tabBar === "floating";
  const dots = [0, 1, 2, 3].map((i) => (
    <div
      key={i}
      style={{
        width: px(5),
        height: px(5),
        borderRadius: "50%",
        background: i === 0 ? c.text : c.textSoft,
        opacity: i === 0 ? 1 : 0.6,
      }}
    />
  ));

  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width,
        height: wide ? width * 0.62 : width * 1.78,
        borderRadius: px(wide ? 10 : 18),
        background: c.ground,
        border: `1px solid ${c.line}`,
        overflow: "hidden",
        display: wide ? "flex" : "block",
      }}
    >
      {glow > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(70% 60% at 15% 100%, ${l1}, transparent 70%), radial-gradient(50% 50% at 90% 5%, ${l2}, transparent 70%)`,
            opacity: glow * 0.45,
          }}
        />
      )}
      {wide && (
        <div
          style={{
            position: "relative",
            width: "22%",
            margin: px(5),
            borderRadius: px(theme.look === "plain" ? 0 : 6),
            background: theme.look === "plain" ? "transparent" : c.surface,
            borderRight: theme.look === "plain" ? `1px solid ${c.line}` : undefined,
            display: "grid",
            alignContent: "start",
            gap: px(5),
            padding: px(6),
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: px(4),
                width: `${80 - i * 8}%`,
                borderRadius: 2,
                background: i === 0 ? c.text : c.textSoft,
                opacity: i ? 0.6 : 1,
              }}
            />
          ))}
        </div>
      )}
      <div
        style={{
          position: "relative",
          flex: 1,
          margin: wide ? `${px(5)} ${px(5)} ${px(5)} 0` : 0,
          borderRadius: wide && theme.look !== "plain" ? px(8) : 0,
          background: wide && theme.look !== "plain" ? c.surface : "transparent",
          overflow: "hidden",
          height: wide ? undefined : "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: px(4), padding: px(8) }}>
          <div
            style={{
              width: px(8),
              height: px(8),
              borderRadius: "50%",
              border: `${px(1.5)} solid ${c.text}`,
            }}
          />
          <div style={{ width: px(28), height: px(5), borderRadius: 3, background: c.text }} />
        </div>
        {stories}
        <div style={{ width: wide ? "60%" : "auto" }}>{post}</div>
        {!wide && (
          <div
            style={{
              position: "absolute",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              ...(floating
                ? {
                    left: px(10),
                    right: px(10),
                    bottom: px(8),
                    height: px(18),
                    borderRadius: px(9),
                    background: c.raised,
                  }
                : {
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: px(20),
                    background: c.ground,
                    borderTop: `1px solid ${c.line}`,
                  }),
            }}
          >
            {dots}
            <div
              style={{ width: px(7), height: px(7), borderRadius: "50%", background: c.accent }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
