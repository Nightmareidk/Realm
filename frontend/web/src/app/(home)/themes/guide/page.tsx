import {
  APP_ICONS,
  DISPLAY_FONTS,
  EFFECT_SHAPES,
  PATTERN_SHAPES,
  THEME_LIMITS,
  THEME_STORE,
} from "@realm/contracts";
import type { Metadata } from "next";
import { DocPage } from "@/components/doc-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "How to make a Realm theme",
  description:
    "Make Realm look like anything: colours, wallpapers, patterns, stickers, falling effects and layouts. Use the theme maker, or write a theme.json by hand. Share themes for free or sell them.",
  alternates: { canonical: "/themes/guide" },
};

const GOTHAM = {
  $schema: `${SITE.origin}/theme-schema.json`,
  format: "realm-theme",
  version: 1,
  name: "Gotham Night",
  description: "Dark streets, a yellow signal, bats in the sky.",
  look: "now-playing",
  colors: {
    ground: "#0a0a0c",
    surface: "#141418",
    raised: "#1e1e24",
    line: "#2a2a31",
    text: "#f5f5f0",
    textSoft: "#b4b4bc",
    accent: "#ffd400",
    onAccent: "#141400",
    lights: ["#6b5a00", "#2b2b40", "#3a3a48"],
  },
  style: { corners: "soft", icons: "bold", glow: 0.4 },
  art: {
    wallpaper: { image: "images/city.jpg", dim: 0.6, blur: "soft" },
    effect: { shape: "bats", color: "#ffd400", amount: "few" },
  },
};

const PINK = {
  format: "realm-theme",
  version: 1,
  name: "Pink Bow",
  look: "wristband",
  colors: {
    ground: "#fff0f5",
    surface: "#ffffff",
    raised: "#ffe3ee",
    line: "#f5c6d6",
    text: "#3a1020",
    textSoft: "#7a4a5c",
    accent: "#d6336c",
    onAccent: "#ffffff",
    lights: ["#ff9ec4", "#ffd1e3", "#ffc2d6"],
  },
  style: { corners: "round", stories: "rings", glow: 0.3, avatars: "rounded" },
  art: {
    pattern: { shape: "hearts", color: "#d6336c", opacity: 0.08, size: 1 },
    stickers: { header: "images/bow.png" },
    effect: { shape: "hearts", color: "#ff5f9a", amount: "some" },
  },
};

const code = (v: unknown) => JSON.stringify(v, null, 2);
const list = (items: readonly string[]) => items.map((i) => `"${i}"`).join(", ");

/** The guide to making themes: public, so people can read it before they sign up. */
export default function ThemeGuidePage() {
  return (
    <DocPage
      title="How to make a Realm theme"
      lead="Make Realm look like anything you like: a superhero city at night, a pink cartoon world, your favourite game. A theme changes how Realm looks, never what it does."
    >
      <h2>Three ways to make one</h2>
      <ol>
        <li>
          <strong>The theme maker</strong> (Settings › Themes › Make your own). Pick colours, a
          look, a wallpaper, stickers and effects, and watch it change as you go. This is the
          easiest way, on the website or the phone app.
        </li>
        <li>
          <strong>Start from a look.</strong> Pick Now Playing, Wristband or Plain and clear in
          Settings › Themes, then open the maker: it starts from what you're wearing.
        </li>
        <li>
          <strong>Write it by hand.</strong> A theme is a small text file called{" "}
          <code>theme.json</code>. Any text editor works. In VS Code, add the <code>$schema</code>{" "}
          line from the example below and it will suggest every option and point out mistakes as you
          type.
        </li>
      </ol>

      <h2>What a theme can change</h2>
      <ul>
        <li>
          <strong>The look:</strong> how screens are laid out. <code>"now-playing"</code> (photos
          glow, a floating tab bar), <code>"wristband"</code> (ticket stubs and coloured bands) or{" "}
          <code>"plain"</code> (calm columns and thin lines).
        </li>
        <li>
          <strong>Every colour:</strong> the background, panels, menus and bubbles, lines, the two
          text colours, your colour (the main button) and the text on it, and three soft lights that
          glow behind the page.
        </li>
        <li>
          <strong>Shapes and style:</strong> square, soft or round corners; how much things glow;
          stories as rings, bands or thin circles; posts as glowing cards, ticket stubs or threads;
          a floating or flat tab bar; chat bubble shape; thin, bold, filled or two-tone icons; round
          or rounded-square pictures of people; film grain; each chat in its own colour.
        </li>
        <li>
          <strong>Text size:</strong> normal, large or larger. Themes can make text bigger, never
          smaller.
        </li>
        <li>
          <strong>A wallpaper</strong> behind everything, dimmed and blurred as much as you like.
        </li>
        <li>
          <strong>A pattern:</strong> one of {list(PATTERN_SHAPES)}, or your own small picture,
          repeated over the background.
        </li>
        <li>
          <strong>Stickers</strong> in three spots kept for them: beside the title on Home, on empty
          screens, and on your profile banner.
        </li>
        <li>
          <strong>A falling effect:</strong> {list(EFFECT_SHAPES)}. Bubbles float up; everything
          else drifts down. Effects stop for anyone who turns motion off.
        </li>
        <li>
          <strong>Fonts for titles:</strong> {list(DISPLAY_FONTS)}. Reading text keeps a font made
          for reading.
        </li>
        <li>
          <strong>An app icon</strong> on phones that allow it: {list(APP_ICONS)}. Phones only
          switch between icons that come inside the app. On Android you can also add a home-screen
          shortcut with your own picture.
        </li>
      </ul>

      <h2>What a theme can't change, and why</h2>
      <p>
        A theme is only colours, choices from fixed lists, numbers and pictures. There's no code and
        no web address in it, so a theme can't read what you type, can't load anything from another
        website, and can't change what a button does. The labels that keep you safe, like "Not
        end-to-end encrypted yet", Report, Block, and sign-in and payment screens, look the same in
        every theme.
      </p>
      <p>
        Every theme is checked so text stays readable (at least 4.5 to 1 against what's behind it).
        If yours isn't, the maker shows what's hard to read and can fix it for you, usually by
        making text a little lighter, turning the glow down or dimming the wallpaper.
      </p>

      <h2>Example: a dark superhero city</h2>
      <pre>
        <code>{code(GOTHAM)}</code>
      </pre>
      <h2>Example: a pink cartoon world</h2>
      <pre>
        <code>{code(PINK)}</code>
      </pre>

      <h2>Theme packages: a theme with pictures</h2>
      <p>
        A theme with pictures travels as a <code>.realmtheme</code> package. It's a zip file holding{" "}
        <code>theme.json</code> and an <code>images</code> folder:
      </p>
      <pre>
        <code>
          {"my-theme.realmtheme\n├── theme.json\n└── images/\n    ├── city.jpg\n    └── bow.png"}
        </code>
      </pre>
      <ul>
        <li>
          In <code>theme.json</code>, name pictures like <code>"images/city.jpg"</code>. PNG, JPG
          and WebP work; use PNG or WebP for stickers with see-through parts.
        </li>
        <li>
          Up to {THEME_LIMITS.images} pictures, {THEME_LIMITS.imageBytes / 1024 / 1024} MB each,{" "}
          {THEME_LIMITS.packageBytes / 1024 / 1024} MB in all. <code>theme.json</code> on its own is
          up to {THEME_LIMITS.jsonBytes / 1024} KB.
        </li>
        <li>
          To open one: Settings › Themes › Add your own theme. To make one, save a theme from its
          page or the maker: Realm builds the package for you.
        </li>
      </ul>

      <h2>Sharing and selling</h2>
      <ul>
        <li>
          From your theme's page, choose <strong>Share in the store</strong>. It needs a confirmed
          email. People can find it in More themes, try it on, get it, and review it.
        </li>
        <li>
          Themes in the store use only pictures you uploaded yourself. Using a character or logo you
          don't own (a superhero, a cartoon cat) is fine for your own theme, but it can't be sold,
          and the owner of that character can ask for a shared one to be taken down.
        </li>
        <li>
          <strong>Selling:</strong> for people 18 and over, with art that's yours to sell. Prices go
          from $1.99 to $19.99. Realm keeps {THEME_STORE.cutPercent}% of each sale after the payment
          company's fee, and you get the rest. Selling switches on once payments are set up on
          Realm.
        </li>
        <li>
          When you update a theme, people who have it get the new version. Reports from several
          people take a theme out of the store until it's looked at; people who have it keep it.
        </li>
      </ul>

      <h2>Every option, exactly</h2>
      <p>
        The full list of fields and allowed values, for code editors and the curious:{" "}
        <a href="/theme-schema.json">theme-schema.json</a>.
      </p>
    </DocPage>
  );
}
