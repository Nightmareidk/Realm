"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SafeBoundary } from "@/components/safe-boundary";
import { cx } from "@/lib/cx";
import { actionClass, ghostClass } from "../chrome";
import { INTRO_EVENT } from "../loader";
import styles from "./tour.module.css";
import type { HeroLayout } from "./tour-scene";

gsap.registerPlugin(ScrollTrigger);

const TourScene = dynamic(() => import("./tour-scene"), { ssr: false });

type Moment = {
  text: string;
  /** Which side of the phone it floats on, and how far down the stage (%). */
  side: "l" | "r";
  top: number;
  /** A presence dot: someone is here right now. */
  live?: boolean;
};

type Step = {
  id: string;
  title: string;
  body: string;
  status: "First in early access" | "Coming soon";
  screen: string;
  moments: Moment[];
};

/** Steps 1–5 of the tour (step 0 is the hero). Moments float beside the phone, never over it. */
const STEPS: Step[] = [
  {
    id: "spaces",
    title: "Group chat that feels like your group.",
    body: "Rooms as tabs, replies and reactions, clips right in the conversation. Quick, and easy on the eyes at 2 a.m.",
    status: "First in early access",
    screen: "chat",
    moments: [
      { text: "Noor reacted 😂", side: "l", top: 30 },
      { text: "Maya is typing…", side: "r", top: 52 },
      { text: "#clips · 3 new", side: "l", top: 70 },
    ],
  },
  {
    id: "clips",
    title: "Clips from your people.",
    body: "Post the moment, not a highlight reel. Following shows your friends, newest first. For you says why it picked each one.",
    status: "Coming soon",
    screen: "clips",
    moments: [
      { text: "Kenji posted a clip", side: "l", top: 28 },
      { text: "1.2k likes", side: "r", top: 40 },
      { text: "Because you follow Kenji", side: "l", top: 70 },
    ],
  },
  {
    id: "lobby",
    title: "See who's here before you say hi.",
    body: "Every Space shows who's around and what they're up to: in a match, cutting a clip, around for a chat. Jump in when your crew does.",
    status: "First in early access",
    screen: "lobby",
    moments: [
      { text: "Noor · in a match", side: "l", top: 30, live: true },
      { text: "Kenji · cutting a clip", side: "r", top: 46, live: true },
      { text: "4 of 7 here now", side: "l", top: 70 },
    ],
  },
  {
    id: "boards",
    title: "Boards for the stuff worth keeping.",
    body: "Questions, builds, guides and arguments, with votes so the good stuff rises and stays findable.",
    status: "Coming soon",
    screen: "boards",
    moments: [
      { text: "212 upvotes", side: "l", top: 32 },
      { text: "58 replies", side: "r", top: 44 },
      { text: "Saved to your board", side: "l", top: 70 },
    ],
  },
  {
    id: "profiles-intro",
    title: "And a page that's all you.",
    body: "Your clips, your Spaces, what you're into and what you're playing, laid out your way.",
    status: "First in early access",
    screen: "profile",
    moments: [
      { text: "Theme: Mint", side: "l", top: 30 },
      { text: "Pinned clip", side: "r", top: 48 },
      { text: "Showcase", side: "l", top: 70 },
    ],
  },
];

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The front page's opening and tour. The section is several screens tall and its stage stays
 * stuck to the screen while you scroll through it: three phones fanned under the headline, then
 * the centre phone steps forward and turns once per step to show the next part of the app, with
 * the story on the left and small moments popping up around it. At the end the phone flies into
 * the camera and hands off to the profile canvas.
 *
 * With reduced motion or Pause motion (or no WebGL) it's a plain sequence: each step's copy beside
 * a picture of its screen, no pinning and nothing moving.
 */
export function Tour() {
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const layout = useRef<HeroLayout>({ top: 0.45, copy: 0.4 });
  const stage = useRef<HTMLDivElement>(null);
  const heroTop = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const rm = matchMedia("(prefers-reduced-motion: reduce)");
    const gl = hasWebGL();
    setNoGL(!gl);
    // No 3D stage to wait for: tell the loading page straight away.
    if (!gl) window.dispatchEvent(new Event("realm:stage-ready"));
    const sync = () => setLive(!rm.matches && root.dataset.motion !== "paused" && gl);
    sync();
    rm.addEventListener("change", sync);
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      rm.removeEventListener("change", sync);
      mo.disconnect();
    };
  }, []);

  // Tell the loading page the stage has drawn its first frame.
  useEffect(() => {
    if (!live || ready) return;
    const t = setTimeout(() => window.dispatchEvent(new Event("realm:stage-ready")), 4000);
    return () => clearTimeout(t);
  }, [live, ready]);
  useEffect(() => {
    if (ready) window.dispatchEvent(new Event("realm:stage-ready"));
  }, [ready]);

  // As the loading page lifts, the headline and actions rise into place. They start faint rather
  // than invisible, so the headline still counts as the page's first real paint.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const play = () =>
      gsap.from(el.querySelectorAll("[data-hero-in]"), {
        y: 34,
        opacity: 0.1,
        duration: 1,
        ease: "power3.out",
        stagger: 0.07,
        delay: 0.25,
        clearProps: "transform,opacity",
      });
    addEventListener(INTRO_EVENT, play);
    return () => removeEventListener(INTRO_EVENT, play);
  }, []);

  // Where the headline ends, so the phones can stand just under it at any window size. Offsets,
  // not bounding boxes, so the headline lifting away on scroll doesn't move the phones.
  useEffect(() => {
    const st = stage.current;
    const top = heroTop.current;
    if (!st || !top || !live) return;
    const copies = [...st.querySelectorAll<HTMLElement>("[data-step-copy]")];
    const measure = () => {
      const h = st.clientHeight;
      if (h <= 0) return;
      const hero = top.offsetParent as HTMLElement | null;
      layout.current.top = ((hero?.offsetTop ?? 0) + top.offsetTop + top.offsetHeight) / h;
      // The lowest any step's story reaches (on narrow screens the phone stands under it).
      layout.current.copy = Math.max(0, ...copies.map((c) => c.offsetTop + c.offsetHeight)) / h;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(st);
    ro.observe(top);
    for (const c of copies) ro.observe(c);
    return () => ro.disconnect();
  }, [live]);

  useEffect(() => {
    const el = section.current;
    if (!el || !live) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), {
      rootMargin: "200px",
    });
    io.observe(el);
    const ctx = gsap.context(() => {
      const n = STEPS.length + 1;
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
          onUpdate: (self) => {
            progress.current = self.progress;
          },
        },
      });
      // Step 0 → 1: the headline lifts away as the phone steps forward.
      // autoAlpha hides it fully once faded, so its links can't be tabbed to or clicked unseen.
      tl.to(
        "[data-hero-copy]",
        { yPercent: -14, autoAlpha: 0, duration: 0.3, ease: "power1.in" },
        0.22,
      );
      STEPS.forEach((_, i) => {
        const at = i + 1;
        const panel = `[data-step="${i}"]`;
        // The last step clears its story before the phone flies at the camera.
        const last = i === STEPS.length - 1;
        tl.fromTo(
          panel,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
          at + 0.05,
        );
        tl.fromTo(
          `${panel} [data-moment]`,
          { opacity: 0, scale: 0.86, y: 14 },
          { opacity: 1, scale: 1, y: 0, duration: 0.22, stagger: 0.08, ease: "back.out(1.6)" },
          at + (last ? 0.48 : 0.62),
        );
        tl.to(
          panel,
          { opacity: 0, y: -40, duration: last ? 0.1 : 0.25, ease: "power2.in" },
          at + (last ? 0.66 : 0.82),
        );
      });
      tl.to("[data-stage-fade]", { opacity: 0, duration: 0.2 }, n - 0.2);
      // The step rail along the edge fills as you go.
      tl.fromTo("[data-rail-fill]", { scaleY: 0 }, { scaleY: 1, duration: n - 1 }, 1);
    }, el);
    return () => {
      ctx.revert();
      io.disconnect();
    };
  }, [live]);

  return (
    <section
      ref={section}
      id="tour"
      aria-labelledby="home-title"
      data-live={live ? "" : undefined}
      data-static={noGL ? "" : undefined}
      className={styles.tour}
    >
      <div ref={stage} className={styles.stage}>
        <div data-stage-fade className={styles.canvas}>
          {live && (
            <SafeBoundary onError={() => setLive(false)}>
              <TourScene
                progress={progress}
                layout={layout}
                visible={visible}
                onReady={() => setReady(true)}
              />
            </SafeBoundary>
          )}
        </div>

        <div data-hero-copy className={styles.hero}>
          <div ref={heroTop}>
            <h1 id="home-title" className={styles.title}>
              <span data-hero-in className="block">
                All your group's stuff.
              </span>
              <span data-hero-in className="block">
                One app.
              </span>
            </h1>
            <p data-hero-in className={styles.lead}>
              Chat, clips, profiles and boards for the people you actually hang out with.
            </p>
          </div>
          <div data-hero-in className={styles.heroFoot}>
            <div className={styles.actions}>
              <Link href="/signup" className={cx(actionClass, "h-14 px-7 text-[1.05rem]")}>
                Open Realm in your browser
              </Link>
              <Link
                href="/login"
                className={cx(ghostClass, "h-14 bg-[rgb(11_11_14_/_0.55)] px-7 text-[1.05rem]")}
              >
                Sign in
              </Link>
            </div>
            <p className={styles.note}>
              Early access is open. Spaces, chat and profiles roll out first.
            </p>
          </div>
        </div>

        {STEPS.map((s, i) => (
          <div key={s.id} data-step={i} className={styles.step}>
            <div data-step-copy className={styles.copy}>
              <h2 className={styles.stepTitle}>{s.title}</h2>
              <p className={styles.stepBody}>{s.body}</p>
              <p className={cx(styles.status, s.status === "Coming soon" && styles.soon)}>
                {s.status}.
              </p>
            </div>
            {/* Without motion, each step shows its screen as a picture instead. */}
            <figure className={styles.still}>
              <Image src={`/home/screens/${s.screen}.webp`} alt="" width={390} height={844} />
            </figure>
            {s.moments.map((m) => (
              <span
                key={m.text}
                data-moment
                aria-hidden="true"
                className={cx(styles.moment, m.side === "l" ? styles.left : styles.right)}
                style={{ top: `${m.top}%` }}
              >
                {m.live && <i className={styles.live} />}
                {m.text}
              </span>
            ))}
          </div>
        ))}

        <div aria-hidden="true" className={styles.rail}>
          <span data-rail-fill className={styles.railFill} />
        </div>
      </div>
    </section>
  );
}
