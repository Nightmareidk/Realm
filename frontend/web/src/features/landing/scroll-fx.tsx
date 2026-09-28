"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

/** Confident arrivals: fast out of the gate, a long soft landing. */
const EASE = "expo.out";

const all = (sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<HTMLElement>(sel));

/**
 * The landing page's scroll motion, in every browser (GSAP ScrollTrigger). Markup opts in with
 * `data-fx`; everything is fully visible without JavaScript, under reduced motion, and while motion
 * is paused (turning Pause motion on puts every element back where it belongs).
 *
 * - `words`     a headline's words rise out of their masks one after another (words.tsx)
 * - `fade`      rises in softly, unblurring (lead paragraphs)
 * - `rise`      rises in and settles from a little smaller (cards, previews)
 * - `stagger`   its children arrive one after another (`data-from="right"` slides them in)
 * - `pop`       springs in from small (characters, icons)
 * - `tilt`      tips up to face you as it scrolls in, scrubbed (the product shot)
 * - `parallax`  drifts against the scroll by `data-speed`, scrubbed
 * - `light`     a statement whose words light up as you read down it, scrubbed
 * - `zoom`      grows into place as it scrolls in, scrubbed
 * - `spin`      turns as it passes (`data-turn` degrees about `data-origin`), scrubbed
 * - `deck`      the world cards: each settles back and dims as the next slides over it
 * - `cast`      the closing line-up springs up from the middle outwards
 * - `marquee`   rows that run faster the faster you scroll
 * - `data-magnetic`  leans toward the pointer (primary buttons)
 * - `data-spotlight` catches a soft light where the pointer is (cards)
 */
function setup() {
  // Headlines.
  for (const el of all("[data-fx~=words]")) {
    gsap.from(all("[data-word]", el), {
      yPercent: 118,
      rotate: 6,
      duration: 1.15,
      ease: EASE,
      stagger: 0.075,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  }
  for (const el of all("[data-fx~=fade]")) {
    gsap.from(el, {
      y: 38,
      opacity: 0,
      filter: "blur(8px)",
      duration: 1.2,
      ease: EASE,
      delay: Number(el.dataset.delay ?? 0.1),
      clearProps: "filter",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  }
  for (const el of all("[data-fx~=rise]")) {
    gsap.from(el, {
      y: 110,
      opacity: 0,
      scale: 0.93,
      duration: 1.3,
      ease: EASE,
      delay: Number(el.dataset.delay ?? 0),
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
    });
  }
  // Each child arrives as it reaches the screen; children arriving together go one after another.
  for (const el of all("[data-fx~=stagger]")) {
    const right = el.dataset.from === "right";
    const kids = Array.from(el.children) as HTMLElement[];
    const delay = Number(el.dataset.delay ?? 0);
    gsap.set(kids, { x: right ? 90 : 0, y: right ? 0 : 46, opacity: 0 });
    ScrollTrigger.batch(kids, {
      start: "top 92%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { x: 0, y: 0, opacity: 1, duration: 1, ease: EASE, stagger: 0.1, delay }),
    });
  }
  for (const el of all("[data-fx~=pop]")) {
    gsap.from(el, {
      scale: 0.4,
      y: 60,
      opacity: 0,
      duration: 1.1,
      ease: "back.out(1.7)",
      delay: Number(el.dataset.delay ?? 0),
      scrollTrigger: { trigger: el, start: "top 94%", once: true },
    });
  }

  // Scrubbed: tied to the scroll position, so they move exactly as you scroll.
  for (const el of all("[data-fx~=tilt]")) {
    gsap.fromTo(
      el,
      { rotateX: 30, scale: 0.8, y: 120, transformPerspective: 1600, transformOrigin: "50% 0%" },
      {
        rotateX: 0,
        scale: 1,
        y: 0,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "top 18%", scrub: 0.8 },
      },
    );
  }
  for (const el of all("[data-fx~=parallax]")) {
    const d = Number(el.dataset.speed ?? 0.2) * 180;
    gsap.fromTo(
      el,
      { y: d },
      {
        y: -d,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      },
    );
  }
  for (const el of all("[data-fx~=zoom]")) {
    gsap.fromTo(
      el,
      { scale: 0.78, opacity: 0.2 },
      {
        scale: 1,
        opacity: 1,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "top 35%", scrub: 0.6 },
      },
    );
  }
  for (const el of all("[data-fx~=spin]")) {
    const turn = Number(el.dataset.turn ?? 24);
    gsap.fromTo(
      el,
      { rotate: -turn, transformOrigin: el.dataset.origin ?? "50% 50%" },
      {
        rotate: turn,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      },
    );
  }
  for (const el of all("[data-fx~=light]")) {
    gsap.fromTo(
      all("[data-word]", el),
      { opacity: 0.14 },
      {
        opacity: 1,
        ease: "none",
        stagger: 0.1,
        scrollTrigger: { trigger: el, start: "top 78%", end: "bottom 42%", scrub: true },
      },
    );
  }

  // The world cards: each settles back and dims as the next slides over it. Only where the deck
  // stacks (wide, tall screens); elsewhere the cards simply follow one another.
  const mm = gsap.matchMedia();
  mm.add("(min-width: 64rem) and (min-height: 46rem)", () => {
    for (const deck of all("[data-fx~=deck]")) {
      const cards = all("[data-card]", deck);
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        const surface = card.querySelector<HTMLElement>("[data-surface]");
        const dim = card.querySelector<HTMLElement>("[data-dim]");
        const top = Number.parseFloat(getComputedStyle(next).top) || 0;
        const st = { trigger: next, start: "top bottom", end: `top ${top}px`, scrub: true };
        if (surface) gsap.to(surface, { scale: 0.9, y: -18, ease: "none", scrollTrigger: st });
        if (dim) gsap.to(dim, { opacity: 0.6, ease: "none", scrollTrigger: st });
      });
    }
  });

  // The close: the whole cast springs up onto the horizon, from the middle outwards.
  for (const el of all("[data-fx~=cast]")) {
    gsap.from(Array.from(el.children), {
      yPercent: 120,
      scale: 0.5,
      opacity: 0,
      duration: 1.3,
      ease: "back.out(1.5)",
      stagger: { each: 0.09, from: "center" },
      scrollTrigger: { trigger: el, start: "top 95%", once: true },
    });
  }

  // Chat rows that run faster the faster you scroll, then ease back to their cruising speed.
  const rows = all("[data-marquee]");
  if (rows.length) {
    const tweens = rows.map((row, i) => {
      gsap.set(row, { animationName: "none" });
      const dur = Number(row.dataset.marquee || 70);
      return i % 2
        ? gsap.fromTo(
            row,
            { xPercent: -50 },
            { xPercent: 0, duration: dur, ease: "none", repeat: -1 },
          )
        : gsap.to(row, { xPercent: -50, duration: dur, ease: "none", repeat: -1 });
    });
    ScrollTrigger.create({
      trigger: rows[0],
      start: "top bottom",
      end: "bottom top",
      onUpdate(self) {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 250, 8);
        for (const t of tweens) {
          gsap.to(t, { timeScale: boost, duration: 0.25, overwrite: true });
          gsap.to(t, { timeScale: 1, duration: 1.2, delay: 0.25, ease: "power2.out" });
        }
      },
    });
  }

  // The header's reading line fills as you go down the page.
  gsap.fromTo(
    ".scroll-progress",
    { scaleX: 0 },
    { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } },
  );

  // The page's nebula drifts up a little over the whole page, behind everything.
  const nebula = document.querySelector<HTMLElement>(".realm-nebula");
  if (nebula) {
    gsap.to(nebula, {
      yPercent: -7,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: true },
    });
  }

  // Primary buttons lean toward the pointer; cards catch a soft light where the pointer is.
  const cleanups: (() => void)[] = [];
  if (window.matchMedia("(pointer: fine)").matches) {
    for (const el of all("[data-spotlight]")) {
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--sx", `${e.clientX - r.left}px`);
        el.style.setProperty("--sy", `${e.clientY - r.top}px`);
      };
      el.addEventListener("pointermove", move);
      cleanups.push(() => el.removeEventListener("pointermove", move));
    }
    for (const el of all("[data-magnetic]")) {
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
      };
      const leave = () => {
        xTo(0);
        yTo(0);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      });
    }
  }
  return () => {
    for (const c of cleanups) c();
    mm.revert();
  };
}

/** Mounts the landing page's scroll motion; see `setup` for the vocabulary. */
export function ScrollFX() {
  useEffect(() => {
    const html = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let ctx: gsap.Context | null = null;
    const stop = () => {
      ctx?.revert();
      ctx = null;
    };
    const start = () => {
      stop();
      if (reduce.matches || html.dataset.motion === "paused") return;
      ctx = gsap.context(setup);
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    start();
    const mo = new MutationObserver(start);
    mo.observe(html, { attributes: true, attributeFilter: ["data-motion"] });
    reduce.addEventListener("change", start);
    // Re-measure once fonts and images have settled the layout.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => {
      mo.disconnect();
      reduce.removeEventListener("change", start);
      window.removeEventListener("load", refresh);
      stop();
    };
  }, []);
  return null;
}
