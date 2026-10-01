"use client";

import { useEffect } from "react";

/**
 * The last line: when the root layout itself fails, this replaces the whole document. It can't
 * rely on the site's styles, fonts or theme (none of them loaded), so it carries its own, in the
 * night edition's colours.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          background: "#0b0c1f",
          color: "#f4f3fb",
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.55,
        }}
      >
        <title>Something went wrong | Realm</title>
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#cfcde3", marginTop: "1rem" }}>
            Realm ran into a problem and couldn't load. It's not something you did. Trying again
            usually fixes it.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "2rem" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                font: "inherit",
                fontWeight: 600,
                padding: "0.7rem 1.3rem",
                borderRadius: "999px",
                border: 0,
                background: "#f3b23c",
                color: "#2a1a05",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A full reload, not client navigation: the app around this page is what failed. */}
            <a
              href="/"
              style={{
                font: "inherit",
                fontWeight: 600,
                padding: "0.7rem 1.3rem",
                borderRadius: "999px",
                border: "1px solid #5b5a78",
                color: "#f4f3fb",
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
          {error.digest && (
            <p style={{ color: "#a9a7c4", fontSize: "0.8rem", marginTop: "2rem" }}>
              If it keeps happening, tell us this code: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
