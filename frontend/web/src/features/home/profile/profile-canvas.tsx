"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { applyTheme, THEME_ORDER, THEMES, type ThemeId } from "../themes";
import styles from "./profile.module.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * The profile canvas: a real profile page, built up piece by piece as you scroll (banner, picture,
 * name, then each box), and then its theme changes as you keep going (Mint, Orchid, Aqua, Ember).
 * The whole front page follows the theme: the light behind it and the action colour.
 *
 * Without motion it's simply the finished profile, and the swatches change the theme by click.
 */
export function ProfileCanvas() {
  const section = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<ThemeId>("mint");
  const [, setDriven] = useState(false);

  const choose = useCallback((id: ThemeId) => {
    const root = document.querySelector<HTMLElement>('[data-world="canvas"]');
    if (root) applyTheme(root, id);
    setTheme(id);
  }, []);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        wide: "(width >= 48rem) and (aspect-ratio > 1)",
      },
      (ctx) => {
        if (!ctx.conditions?.motion || document.documentElement.dataset.motion === "paused") return;
        setDriven(true);
        // Wide screens pin the profile and scrub through it; phones play it as it passes.
        const wide = Boolean(ctx.conditions?.wide);
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: el,
            start: wide ? "top top" : "top 70%",
            end: wide ? "bottom bottom" : "bottom 30%",
            scrub: 0.5,
            onUpdate: (self) => {
              const p = self.progress;
              const id: ThemeId =
                p < 0.46 ? "mint" : p < 0.63 ? "orchid" : p < 0.8 ? "aqua" : "ember";
              choose(id);
            },
          },
        });
        // Build the page: the banner wipes down, the picture lands, then the rest rises in.
        tl.fromTo(
          "[data-p-banner]",
          { clipPath: "inset(0 0 100% 0 round 1.6rem)" },
          { clipPath: "inset(0 0 0% 0 round 1.6rem)", duration: 0.12 },
          0.02,
        )
          .fromTo(
            "[data-p-pic]",
            { scale: 0.4, opacity: 0, rotate: -12 },
            { scale: 1, opacity: 1, rotate: 0, duration: 0.08, ease: "back.out(1.7)" },
            0.12,
          )
          .fromTo(
            "[data-p-name] > *",
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.06, stagger: 0.02 },
            0.17,
          )
          .fromTo(
            "[data-p-box]",
            { y: 60, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.08, stagger: 0.035 },
            0.22,
          )
          .fromTo(
            "[data-p-card]",
            { rotateY: -40, rotateX: 12, y: 30, opacity: 0 },
            { rotateY: -8, rotateX: 4, y: 0, opacity: 1, duration: 0.1 },
            0.33,
          )
          // Then the whole page turns slowly toward you while the themes change.
          .fromTo(
            "[data-p-page]",
            { rotateY: -9, rotateX: 5 },
            { rotateY: 6, rotateX: -2, duration: 0.6 },
            0.4,
          )
          .to({}, { duration: 0.02 }, 1);
        return () => {
          setDriven(false);
          choose("mint");
        };
      },
    );
    return () => mm.revert();
  }, [choose]);

  // The holo card leans toward the pointer; the foil follows the light.
  const onCard = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    e.currentTarget.style.setProperty("--mx", `${x * 100}%`);
    e.currentTarget.style.setProperty("--my", `${y * 100}%`);
    e.currentTarget.style.setProperty("--tx", `${(x - 0.5) * 16}deg`);
    e.currentTarget.style.setProperty("--ty", `${(0.5 - y) * 12}deg`);
  };
  const offCard = (e: PointerEvent<HTMLDivElement>) => {
    for (const k of ["--mx", "--my", "--tx", "--ty"]) e.currentTarget.style.removeProperty(k);
  };

  return (
    <section
      ref={section}
      id="profiles"
      aria-labelledby="profiles-title"
      className={styles.section}
    >
      <div className={styles.stage}>
        <div className={styles.copy}>
          <h2 id="profiles-title" className={styles.title}>
            A profile that looks like you.
          </h2>
          <p className={styles.lead}>
            Your banner, your picture, your clips, your Spaces and the card you show off. Then pick
            a theme, and Realm wears it.
          </p>
          <fieldset className={styles.swatches}>
            <legend className="sr-only">Theme</legend>
            {THEME_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={theme === id}
                onClick={() => choose(id)}
                className={styles.swatch}
                style={{
                  background: `linear-gradient(135deg, ${THEMES[id].light[0]}, ${THEMES[id].light[1]})`,
                }}
              >
                <span className="sr-only">{THEMES[id].name}</span>
              </button>
            ))}
            <span className={styles.themeName} aria-live="polite">
              {THEMES[theme].name}
            </span>
          </fieldset>
          <p className={styles.soon}>Themes and card frames arrive during early access.</p>
        </div>

        <div className={styles.persp}>
          <article data-p-page className={styles.page} aria-label="An example profile: Maya">
            <div data-p-banner className={styles.banner} />
            <div className={styles.id}>
              <span data-p-pic className={styles.pic}>
                M
              </span>
              <div data-p-name className={styles.name}>
                <h3>Maya</h3>
                <p>@maya · speedruns, sourdough, very long voice calls</p>
              </div>
              <span className={styles.add}>Add friend</span>
            </div>
            <div className={styles.grid}>
              <div data-p-box className={cx(styles.box, styles.clip)}>
                <h4>Pinned clip</h4>
                <div className={styles.clipArt}>
                  <i />
                  <span>the jump that shouldn't have worked · 0:14</span>
                </div>
              </div>
              <div data-p-box className={styles.box}>
                <h4>Right now</h4>
                <div className={styles.now}>
                  <i />
                  <div>
                    <b>Celeste, Chapter 7</b>
                    <small>speedrun practice · 1h</small>
                  </div>
                </div>
              </div>
              <div data-p-box className={styles.box}>
                <h4>Spaces</h4>
                <div className={styles.spaces}>
                  <i style={{ background: "#ff8a5c" }} />
                  <i style={{ background: "#f4ecd8" }} />
                  <i style={{ background: "#2b47ff" }} />
                  <i style={{ background: "#14532d" }} />
                </div>
                <div className={styles.badges}>
                  <span>Founder</span>
                  <span>212 clips</span>
                  <span>Board MVP</span>
                </div>
              </div>
              <div data-p-box className={cx(styles.box, styles.show)}>
                <h4>Showcase</h4>
                <div className={styles.cardWrap}>
                  <div
                    data-p-card
                    className={styles.card}
                    onPointerMove={onCard}
                    onPointerLeave={offCard}
                  >
                    <div className={styles.cardFace}>
                      <header>
                        <b>Maya</b>
                        <span>Since 2026</span>
                      </header>
                      <div className={styles.cardArt}>M</div>
                      <footer>
                        <span>212 clips</span>
                        <span>9 Spaces</span>
                      </footer>
                    </div>
                    <i className={styles.foil} />
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
