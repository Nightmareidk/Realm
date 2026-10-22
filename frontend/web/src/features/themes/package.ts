import { mapThemeImages, THEME_LIMITS, ThemeFile, themeImages } from "@realm/contracts";
import { strToU8, unzipSync, zipSync } from "fflate";
import { api } from "@/lib/api";

/**
 * Theme packages: a `.realmtheme` file is a zip holding `theme.json` and an `images/` folder. A
 * plain `theme.json` works too, for themes without pictures. Opening one never runs anything: the
 * JSON is checked against the theme format, each picture is checked by its first bytes, then
 * uploaded through Realm's normal upload (which checks it again), and the file's `images/…` names
 * become Realm's own picture references.
 */

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const looksLike = (b: Uint8Array, type: string) =>
  type === "image/png"
    ? b[0] === 0x89 && b[1] === 0x50
    : type === "image/jpeg"
      ? b[0] === 0xff && b[1] === 0xd8
      : b[0] === 0x52 && b[8] === 0x57;

export class PackageError extends Error {}

/** The first thing wrong with a theme file, said plainly with where it is. */
export function readThemeJson(text: string): ThemeFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PackageError("That isn't a theme file. theme.json starts with { and ends with }.");
  }
  // Editors may add "$schema" for help while typing; it isn't part of the theme.
  if (json && typeof json === "object" && "$schema" in json) {
    const { $schema: _, ...rest } = json as Record<string, unknown>;
    json = rest;
  }
  const parsed = ThemeFile.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (at ${issue.path.join(" › ")})` : "";
    throw new PackageError(`${issue?.message ?? "Something in the theme isn't right"}${where}.`);
  }
  return parsed.data;
}

export async function uploadImage(bytes: Uint8Array, type: string): Promise<string> {
  const ticket = await api<{ mediaId: string; uploadUrl: string; headers: Record<string, string> }>(
    "/media/uploads",
    { method: "POST", body: { kind: "image", mimeType: type, sizeBytes: bytes.length } },
  );
  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.headers,
    body: new Blob([bytes as BlobPart], { type }),
  });
  if (!put.ok) throw new PackageError("A picture didn't upload. Try again.");
  await api(`/media/${ticket.mediaId}/complete`, { method: "POST", body: {} });
  return `media:${ticket.mediaId}`;
}

/**
 * Open a `.realmtheme` package or a `theme.json`, upload its pictures, and give back the theme
 * with Realm picture references, plus notes about anything left out.
 */
export async function openThemeFile(file: File): Promise<{ theme: ThemeFile; notes: string[] }> {
  if (file.size > THEME_LIMITS.packageBytes) {
    throw new PackageError("That file is too big for a theme (12 MB at most).");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    if (file.size > THEME_LIMITS.jsonBytes)
      throw new PackageError("theme.json is too big (16 KB at most).");
    const theme = readThemeJson(new TextDecoder().decode(bytes));
    const notes = themeImages(theme).some((r) => r.startsWith("images/"))
      ? [
          "This theme names pictures, but they weren't included. Open the whole .realmtheme package to get them.",
        ]
      : [];
    return { theme: mapThemeImages(theme, (r) => (r.startsWith("media:") ? r : null)), notes };
  }

  // Unzip only what a theme can hold, checking sizes before anything is unpacked.
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        const ok =
          f.name === "theme.json" ||
          /^images\/[a-z0-9][a-z0-9_-]{0,60}\.(png|jpe?g|webp)$/i.test(f.name);
        if (!ok) return false;
        total += f.originalSize;
        const cap = f.name === "theme.json" ? THEME_LIMITS.jsonBytes : THEME_LIMITS.imageBytes;
        if (f.originalSize > cap || total > THEME_LIMITS.packageBytes) {
          throw new PackageError(`${f.name} is too big for a theme.`);
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof PackageError) throw err;
    throw new PackageError("That package couldn't be opened. Is it a .realmtheme file?");
  }
  const json = files["theme.json"];
  if (!json) throw new PackageError("The package has no theme.json inside.");
  const theme = readThemeJson(new TextDecoder().decode(json));

  const notes: string[] = [];
  const refs = themeImages(theme).filter((r) => r.startsWith("images/"));
  if (refs.length > THEME_LIMITS.images)
    throw new PackageError(`A theme can have ${THEME_LIMITS.images} pictures at most.`);
  const uploaded = new Map<string, string>();
  for (const ref of refs) {
    const data = files[ref] ?? files[ref.toLowerCase()];
    const type = IMAGE_TYPES[ref.split(".").pop()?.toLowerCase() ?? ""];
    if (!data || !type || !looksLike(data, type)) {
      notes.push(`${ref} is missing or isn't a picture, so it was left out.`);
      continue;
    }
    uploaded.set(ref, await uploadImage(data, type));
  }
  return {
    theme: mapThemeImages(theme, (r) => uploaded.get(r) ?? (r.startsWith("media:") ? r : null)),
    notes,
  };
}

/** Download a theme as a `.realmtheme` package, with its pictures inside. */
export async function saveThemePackage(theme: ThemeFile, images: { ref: string; url: string }[]) {
  const files: Record<string, Uint8Array> = {};
  const names = new Map<string, string>();
  for (const [i, img] of images.entries()) {
    const res = await fetch(img.url);
    if (!res.ok) continue;
    const blob = await res.blob();
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const name = `images/picture-${i + 1}.${ext}`;
    files[name] = new Uint8Array(await blob.arrayBuffer());
    names.set(img.ref, name);
  }
  const portable = mapThemeImages(theme, (r) => names.get(r) ?? null);
  files["theme.json"] = strToU8(JSON.stringify(portable, null, 2));
  const zip = zipSync(files, { level: 6 });
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${theme.name.replace(/[^a-z0-9 _-]/gi, "").trim() || "theme"}.realmtheme`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
