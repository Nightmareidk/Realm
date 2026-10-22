import { z } from "zod";

/**
 * A Realm theme file (docs/THEMING.md). Themes are data, never code: colours, choices from fixed
 * lists, numbers inside fixed ranges, and pictures that come inside the theme package. There's
 * no CSS, no web address and no script anywhere in it, so a theme can change how Realm looks but
 * can't change what a button does, read what you type, or hide a safety label.
 *
 * On disk a theme is a `.realmtheme` package (a zip with `theme.json` and an `images/` folder) or
 * a plain `theme.json` when it has no pictures. Inside Realm, pictures become `media:<id>`.
 */

export const THEME_FORMAT = "realm-theme" as const;
export const THEME_FILE_VERSION = 1 as const;
export const THEME_PACKAGE_EXTENSION = ".realmtheme";

export const THEME_LIMITS = {
  /** theme.json on its own. */
  jsonBytes: 16 * 1024,
  /** One picture inside a package. */
  imageBytes: 4 * 1024 * 1024,
  /** The whole package, unzipped. */
  packageBytes: 12 * 1024 * 1024,
  images: 8,
  /** The widest or tallest a picture may be; bigger ones are shrunk. */
  imageSide: 2400,
} as const;

/** The three looks: how screens are laid out, not only their colours. Now Playing is Realm's own. */
export const ThemeLook = z.enum(["now-playing", "wristband", "plain"]);
export type ThemeLook = z.infer<typeof ThemeLook>;
export const DEFAULT_LOOK: ThemeLook = "now-playing";

const Hex = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Write colours as # and six letters or numbers, like #3ee6b0");

/**
 * A picture: `images/<name>` inside a package, or `media:<id>` once it's stored on Realm. Never a
 * web address, so a theme can't load anything from outside or tell anyone you opened it.
 */
export const ThemeImage = z
  .string()
  .trim()
  .regex(
    /^(images\/[a-z0-9][a-z0-9_-]{0,60}\.(png|jpe?g|webp)|media:[1-9]\d{0,19})$/i,
    "Pictures go in the images folder, like images/wallpaper.jpg",
  );
export type ThemeImage = z.infer<typeof ThemeImage>;

export const ThemeColors = z.strictObject({
  /** Behind everything. */
  ground: Hex,
  /** Panels, cards and the tab bar. */
  surface: Hex,
  /** Menus, selected rows, other people's chat bubbles. */
  raised: Hex,
  /** Thin dividing lines. */
  line: Hex,
  text: Hex,
  /** Second lines, times, hints. */
  textSoft: Hex,
  /** Your colour: the main button on each screen, your chat bubbles, what's new. */
  accent: Hex,
  /** Text and icons on top of the accent. */
  onAccent: Hex,
  /** The three soft lights glowing behind the page. */
  lights: z.tuple([Hex, Hex, Hex]),
  /** Where a gradient button ends (it starts at your colour). */
  accent2: Hex.optional(),
  /** Section titles in lists and menus ("YOUR SPACES", "MODERATORS"). */
  heading: Hex.optional(),
  /** Links in messages and posts. */
  link: Hex.optional(),
});
export type ThemeColors = z.infer<typeof ThemeColors>;
/** Every colour filled in (the optional ones come from the others). */
export type ResolvedColors = Required<ThemeColors>;

/** Built-in pattern shapes, drawn by Realm in the theme's colour. */
export const PATTERN_SHAPES = [
  "dots",
  "grid",
  "stripes",
  "checks",
  "waves",
  "stars",
  "hearts",
  "sparkles",
  "bats",
  "paws",
  "flowers",
  "bolts",
  "notes",
] as const;

/** Built-in falling or floating effects. They stop when motion is turned off. */
export const EFFECT_SHAPES = [
  "snow",
  "hearts",
  "stars",
  "sparkles",
  "petals",
  "bubbles",
  "bats",
  "confetti",
  "leaves",
  "rain",
  "notes",
] as const;

/**
 * Fonts Realm carries (free Google Fonts, served by Realm itself, so a theme never loads anything
 * from outside). Display fonts set titles and names; reading text keeps a font made for reading.
 */
export const DISPLAY_FONTS = [
  "funnel",
  "atkinson",
  "system",
  "bangers",
  "fredoka",
  "pacifico",
  "press-start",
  "bebas",
  "righteous",
  "orbitron",
  "permanent-marker",
  "comfortaa",
] as const;
export const BODY_FONTS = ["atkinson", "system", "lexend", "nunito", "fredoka", "comfortaa"] as const;

/** Realm's own app icons that ship inside the app (phones only switch between built-in icons). */
export const APP_ICONS = [
  "default",
  "night",
  "mint",
  "orchid",
  "aqua",
  "ember",
  "wristband",
  "plain",
] as const;

export const ThemeStyle = z.strictObject({
  corners: z.enum(["square", "soft", "round"]),
  /** How strongly photos and the lights glow behind things. */
  glow: z.number().min(0).max(1),
  /** A fine film grain over the ground. */
  grain: z.boolean(),
  stories: z.enum(["rings", "bands", "thin"]),
  posts: z.enum(["glow", "ticket", "thread"]),
  tabBar: z.enum(["floating", "bar"]),
  bubbles: z.enum(["round", "soft", "square"]),
  /** Each chat gets its own colour (the other person's). */
  chatColours: z.boolean(),
  icons: z.enum(["regular", "bold", "fill", "duotone"]),
  avatars: z.enum(["circle", "rounded"]),
});
export type ThemeStyle = z.infer<typeof ThemeStyle>;

/** The panels the app sits on: how solid they are (see-through lets the wallpaper show), and their edges. */
export const ThemePanels = z.strictObject({
  /** 1 is solid; lower lets the wallpaper show through (Realm raises it if text would be hard to read). */
  opacity: z.number().min(0.35).max(1),
  /** Frosted glass behind see-through panels (on the website; phones use the see-through alone). */
  blur: z.enum(["none", "soft", "strong"]),
  border: z.enum(["none", "line", "accent"]),
  shadow: z.enum(["none", "soft", "glow"]),
  /** Section titles as plain words, or on a strip in your colour. */
  headers: z.enum(["plain", "bar"]),
});
export type ThemePanels = z.infer<typeof ThemePanels>;

/** The main buttons: their shape and how they're filled. */
export const ThemeButtons = z.strictObject({
  shape: z.enum(["pill", "rounded", "square"]),
  fill: z.enum(["solid", "outline", "gradient"]),
  glow: z.boolean(),
});
export type ThemeButtons = z.infer<typeof ThemeButtons>;

export const ThemeType = z.strictObject({
  display: z.enum(DISPLAY_FONTS),
  body: z.enum(BODY_FONTS),
  /** Themes may make text bigger, never smaller. */
  size: z.enum(["normal", "large", "larger"]),
});
export type ThemeType = z.infer<typeof ThemeType>;

export const ThemeArt = z.strictObject({
  /** A picture behind the app, under a dimming layer so text stays readable. */
  wallpaper: z
    .strictObject({
      image: ThemeImage,
      /** How much of the ground colour lies over it (Realm raises this if text would be hard to read). */
      dim: z.number().min(0.2).max(0.95),
      blur: z.enum(["none", "soft", "strong"]),
      /** Which part stays in view when the screen crops it (keep a character's face showing). */
      focus: z.enum(["center", "top", "bottom", "left", "right"]).optional(),
      /** The picture's own brightness (1 as it is) and colour strength (0 grey, 1 as it is). */
      brightness: z.number().min(0.3).max(1.2).optional(),
      saturation: z.number().min(0).max(1.6).optional(),
      /** The layer over the picture: a colour, or a gradient to a second colour (dim sets how strong). */
      overlay: Hex.optional(),
      overlay2: Hex.optional(),
    })
    .optional(),
  /** A repeating pattern over the ground: a built-in shape, or your own small picture. */
  pattern: z
    .strictObject({
      shape: z.enum([...PATTERN_SHAPES, "image"]),
      image: ThemeImage.optional(),
      color: Hex,
      opacity: z.number().min(0.02).max(0.25),
      size: z.number().min(0.5).max(2),
    })
    .refine((p) => (p.shape === "image") === Boolean(p.image), {
      message: "A pattern uses a built-in shape or your own image, not both",
    })
    .optional(),
  /** Stickers in places kept free for them, never over buttons or messages. */
  stickers: z
    .strictObject({
      /** Beside the title at the top of Home. */
      header: ThemeImage,
      /** On empty screens ("No messages yet"). */
      empty: ThemeImage,
      /** On your profile's banner. */
      profile: ThemeImage,
    })
    .partial()
    .optional(),
  /** Things that fall or float gently behind the content. */
  effect: z
    .strictObject({
      shape: z.enum(EFFECT_SHAPES),
      color: Hex,
      amount: z.enum(["few", "some", "lots"]),
    })
    .optional(),
});
export type ThemeArt = z.infer<typeof ThemeArt>;

export const ThemeFile = z
  .strictObject({
    format: z.literal(THEME_FORMAT),
    version: z.literal(THEME_FILE_VERSION),
    name: z
      .string()
      .trim()
      .min(2, "Give the theme a name of at least 2 letters")
      .max(40, "Keep the name under 40 letters")
      // biome-ignore lint/suspicious/noControlCharactersInRegex: refusing control characters is the point
      .regex(/^[^\u0000-\u001f\u007f<>]+$/, "Names can't use < > or hidden characters"),
    description: z
      .string()
      .trim()
      .max(200, "Keep the description under 200 letters")
      // biome-ignore lint/suspicious/noControlCharactersInRegex: refusing control characters is the point
      .regex(/^[^\u0000-\u0008\u000b-\u001f\u007f]*$/, "The description has hidden characters")
      .optional(),
    look: ThemeLook,
    colors: ThemeColors,
    /** Anything left out comes from the look. */
    style: ThemeStyle.partial().optional(),
    panels: ThemePanels.partial().optional(),
    buttons: ThemeButtons.partial().optional(),
    type: ThemeType.partial().optional(),
    art: ThemeArt.optional(),
    /** Which of Realm's app icons to use, on phones that allow it. */
    appIcon: z.enum(APP_ICONS).optional(),
  })
  .meta({ id: "ThemeFile" });
export type ThemeFile = z.infer<typeof ThemeFile>;
export type ThemeFileInput = z.input<typeof ThemeFile>;

/** What each look is when a theme doesn't say otherwise. */
export const LOOK_DEFAULTS: Record<
  ThemeLook,
  { style: ThemeStyle; type: ThemeType; panels: ThemePanels; buttons: ThemeButtons }
> = {
  "now-playing": {
    style: {
      corners: "round",
      glow: 0.55,
      grain: false,
      stories: "rings",
      posts: "glow",
      tabBar: "floating",
      bubbles: "round",
      chatColours: true,
      icons: "regular",
      avatars: "circle",
    },
    type: { display: "funnel", body: "atkinson", size: "normal" },
    panels: { opacity: 1, blur: "none", border: "none", shadow: "soft", headers: "plain" },
    buttons: { shape: "pill", fill: "solid", glow: false },
  },
  wristband: {
    style: {
      corners: "soft",
      glow: 0.25,
      grain: true,
      stories: "bands",
      posts: "ticket",
      tabBar: "bar",
      bubbles: "soft",
      chatColours: false,
      icons: "regular",
      avatars: "circle",
    },
    type: { display: "funnel", body: "atkinson", size: "normal" },
    panels: { opacity: 1, blur: "none", border: "line", shadow: "none", headers: "plain" },
    buttons: { shape: "rounded", fill: "solid", glow: false },
  },
  plain: {
    style: {
      corners: "soft",
      glow: 0,
      grain: false,
      stories: "thin",
      posts: "thread",
      tabBar: "bar",
      bubbles: "round",
      chatColours: false,
      icons: "regular",
      avatars: "circle",
    },
    type: { display: "funnel", body: "atkinson", size: "normal" },
    panels: { opacity: 1, blur: "none", border: "line", shadow: "none", headers: "plain" },
    buttons: { shape: "rounded", fill: "solid", glow: false },
  },
};

/** A theme with every choice filled in, ready to draw. */
export interface ResolvedTheme {
  name: string;
  description: string | null;
  look: ThemeLook;
  colors: ResolvedColors;
  style: ThemeStyle;
  panels: ThemePanels;
  buttons: ThemeButtons;
  type: ThemeType;
  art: ThemeArt;
  appIcon: (typeof APP_ICONS)[number];
}

export function resolveTheme(file: ThemeFile): ResolvedTheme {
  const base = LOOK_DEFAULTS[file.look];
  return {
    name: file.name,
    description: file.description ?? null,
    look: file.look,
    colors: {
      ...file.colors,
      accent2: file.colors.accent2 ?? file.colors.accent,
      heading: file.colors.heading ?? file.colors.textSoft,
      link: file.colors.link ?? file.colors.text,
    },
    style: { ...base.style, ...file.style },
    panels: { ...base.panels, ...file.panels },
    buttons: { ...base.buttons, ...file.buttons },
    type: { ...base.type, ...file.type },
    art: file.art ?? {},
    appIcon: file.appIcon ?? "default",
  };
}

/** Every picture a theme uses, in a stable order. */
export function themeImages(file: ThemeFile): string[] {
  const a = file.art;
  const all = [
    a?.wallpaper?.image,
    a?.pattern?.image,
    a?.stickers?.header,
    a?.stickers?.empty,
    a?.stickers?.profile,
  ].filter((v): v is string => Boolean(v));
  return [...new Set(all)];
}

/** Swap every picture reference (for example `images/x.png` → `media:123`). */
export function mapThemeImages(file: ThemeFile, map: (ref: string) => string | null): ThemeFile {
  const a = file.art;
  if (!a) return file;
  const m = (v: string | undefined) => (v ? (map(v) ?? undefined) : undefined);
  const art: ThemeArt = {};
  if (a.wallpaper) {
    const image = m(a.wallpaper.image);
    if (image) art.wallpaper = { ...a.wallpaper, image };
  }
  if (a.pattern) {
    if (a.pattern.shape !== "image") art.pattern = a.pattern;
    else {
      const image = m(a.pattern.image);
      if (image) art.pattern = { ...a.pattern, image };
    }
  }
  if (a.stickers) {
    const stickers = {
      header: m(a.stickers.header),
      empty: m(a.stickers.empty),
      profile: m(a.stickers.profile),
    };
    const kept = Object.fromEntries(Object.entries(stickers).filter(([, v]) => v));
    if (Object.keys(kept).length) art.stickers = kept;
  }
  if (a.effect) art.effect = a.effect;
  return { ...file, art };
}
