/**
 * Realm's email design: one clean white page, like the emails big apps send. The Realm tile and
 * name at the top, a big heading, a few short lines, then the one thing the email is for (a code
 * in a box, or a wide button), any details in a small card, and a footer saying who it went to,
 * why, and where to ask questions.
 *
 * Built from tables with the styles written on each tag, because that is the only thing every
 * inbox (Gmail, Outlook, Apple Mail, phones) shows the same way. Every bit of text is escaped,
 * and buttons only ever link to http(s) addresses.
 */

export interface EmailLayout {
  /** The grey line inboxes show next to the subject. */
  preheader: string;
  heading: string;
  /** Short paragraphs before the code or button. */
  intro: string[];
  /** A one-time code, shown big in a box. */
  code?: string;
  /**
   * The main action. A path ("/login") is joined to the website's address. `last` puts it after
   * the closing lines, for alerts where it's only needed if something looks wrong.
   */
  button?: { label: string; href: string; last?: boolean };
  /** Facts as label and value rows ("Device", "Chrome on Windows"). */
  details?: { label: string; value: string }[];
  /** Short paragraphs after the code or button. */
  outro?: string[];
  /** Why this email arrived, for the footer. */
  reason: string;
}

export interface EmailBrand {
  /** The website's address, for the logo and links (https://tomyrealm.com). */
  origin: string;
  /** Where people can write with questions. */
  contact: string;
}

const INK = "#0b0b0f";
const BODY = "#3a3a44";
const SOFT = "#6b6b76";
const FAINT = "#8a8a95";
const LINE = "#ececf0";
const LINK = "#b9400f";
const ACCENT_A = "#ff8a3d";
const ACCENT_B = "#ff3d8a";
const ACCENT_MID = "#ff6450";
const ON_ACCENT = "#1d0802";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Text made safe to put inside HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A link for a button: a path joins the website's address; anything but http(s) is refused. */
export function emailHref(href: string, origin: string): string | null {
  try {
    const url = new URL(href, origin);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "19 November 2026 at 14:05 UTC". */
export function formatWhen(d: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(d);
  return `${day} at ${time} UTC`;
}

/** The email's words as plain text, without the footer (the part tests and screen readers use). */
export function emailBodyText(layout: EmailLayout, origin?: string): string {
  const parts: string[] = [layout.heading, ...layout.intro];
  if (layout.code) parts.push(layout.code);
  if (layout.details?.length) {
    parts.push(layout.details.map((d) => `${d.label}: ${d.value}`).join("\n"));
  }
  const b = layout.button;
  const button = b && (origin ? emailHref(b.href, origin) : b.href);
  if (b && button && !b.last) parts.push(`${b.label}: ${button}`);
  if (layout.outro) parts.push(...layout.outro);
  if (b && button && b.last) parts.push(`${b.label}: ${button}`);
  return parts.join("\n\n");
}

/** The plain-text email, with the footer. */
export function renderEmailText(layout: EmailLayout, to: string, brand: EmailBrand): string {
  return [
    emailBodyText(layout, brand.origin),
    "--",
    `Sent to ${to}. ${layout.reason}`,
    `Questions? Write to ${brand.contact}.`,
  ].join("\n\n");
}

const p = (text: string, size = 16, color = BODY, gap = 16) =>
  `<p style="margin:0 0 ${gap}px;font-family:${FONT};font-size:${size}px;line-height:${Math.round(size * 1.5)}px;color:${color};">${escapeHtml(text)}</p>`;

function codeBlock(code: string) {
  // Letter spacing also pads the right side; the same on the left keeps the code centred.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
<tr><td align="center" bgcolor="#fff4ec" style="background-color:#fff4ec;border:1px solid #ffd9c2;border-radius:16px;padding:22px 12px;">
<span style="display:inline-block;padding-left:10px;font-family:${FONT};font-size:36px;line-height:40px;font-weight:700;letter-spacing:10px;color:${INK};font-variant-numeric:tabular-nums;">${escapeHtml(code)}</span>
</td></tr></table>`;
}

function buttonBlock(label: string, href: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px;">
<tr><td align="center" bgcolor="${ACCENT_MID}" style="border-radius:12px;background-color:${ACCENT_MID};background-image:linear-gradient(90deg,${ACCENT_A},${ACCENT_B});">
<a href="${escapeHtml(href)}" target="_blank" rel="noopener" style="display:block;padding:15px 24px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${ON_ACCENT};text-decoration:none;border-radius:12px;">${escapeHtml(label)}</a>
</td></tr></table>
${p("Button not working? Copy this link into your browser:", 13, FAINT, 2)}
<p style="margin:0 0 24px;font-family:${FONT};font-size:13px;line-height:19px;word-break:break-all;"><a href="${escapeHtml(href)}" target="_blank" rel="noopener" style="color:${LINK};text-decoration:underline;">${escapeHtml(href)}</a></p>`;
}

function detailsBlock(rows: { label: string; value: string }[]) {
  const cells = rows
    .map(
      (r, i) =>
        `<tr><td style="padding:14px 16px;${i > 0 ? `border-top:1px solid ${LINE};` : ""}font-family:${FONT};">
<div style="font-size:13px;line-height:18px;color:${SOFT};">${escapeHtml(r.label)}</div>
<div style="font-size:15px;line-height:22px;font-weight:600;color:${INK};word-break:break-word;">${escapeHtml(r.value)}</div>
</td></tr>`,
    )
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;border:1px solid ${LINE};border-radius:14px;border-collapse:separate;">
${cells}
</table>`;
}

/** The whole HTML email. */
export function renderEmailHtml(layout: EmailLayout, to: string, brand: EmailBrand): string {
  const origin = brand.origin.replace(/\/+$/, "");
  const logo = `${origin}/email/realm-icon.png`;
  const href = layout.button ? emailHref(layout.button.href, origin) : null;
  const link = (path: string, label: string) =>
    `<a href="${escapeHtml(`${origin}${path}`)}" target="_blank" rel="noopener" style="color:${FAINT};text-decoration:underline;">${label}</a>`;
  // Spacer after the preheader so inboxes don't pull the email's first lines into the preview.
  const spacer = "&#847;&zwnj;&nbsp;".repeat(40);

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(layout.heading)}</title>
<style>
:root { color-scheme: light only; }
body { margin:0; padding:0; background:#ffffff; }
a { color:${LINK}; }
@media (max-width: 600px) {
  .shell { padding: 28px 20px 32px !important; }
  .heading { font-size: 26px !important; line-height: 32px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(layout.preheader)}${spacer}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td class="shell" style="padding:40px 32px 40px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;padding-right:10px;"><img src="${escapeHtml(logo)}" width="36" height="36" alt="" style="display:block;border:0;width:36px;height:36px;"></td>
<td style="vertical-align:middle;font-family:${FONT};font-size:24px;line-height:28px;font-weight:800;letter-spacing:-0.8px;color:${INK};">realm</td>
</tr></table>

<h1 class="heading" style="margin:36px 0 14px;font-family:${FONT};font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.6px;color:${INK};">${escapeHtml(layout.heading)}</h1>

${layout.intro.map((t) => p(t)).join("\n")}
${layout.code ? codeBlock(layout.code) : ""}
${layout.details?.length ? detailsBlock(layout.details) : ""}
${layout.button && href && !layout.button.last ? buttonBlock(layout.button.label, href) : ""}
${(layout.outro ?? []).map((t) => p(t, 15, BODY, 14)).join("\n")}
${layout.button && href && layout.button.last ? `<div style="height:12px;line-height:12px;">&nbsp;</div>${buttonBlock(layout.button.label, href)}` : ""}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
<tr><td style="border-top:1px solid ${LINE};padding-top:22px;font-family:${FONT};font-size:12px;line-height:18px;color:${FAINT};">
<p style="margin:0 0 10px;">Sent to <span style="color:${SOFT};">${escapeHtml(to)}</span>. ${escapeHtml(layout.reason)}</p>
<p style="margin:0 0 10px;">Questions? Write to <a href="mailto:${escapeHtml(brand.contact)}" style="color:${SOFT};text-decoration:underline;">${escapeHtml(brand.contact)}</a>.</p>
<p style="margin:0 0 16px;">${link("/privacy", "Privacy")} &nbsp;&middot;&nbsp; ${link("/terms", "Terms")} &nbsp;&middot;&nbsp; ${link("/delete-account", "Delete your account")}</p>
<p style="margin:0;font-weight:700;color:${SOFT};letter-spacing:-0.2px;">realm</p>
</td></tr></table>

</td></tr></table>
</td></tr></table>
</body>
</html>`;
}

/** A plain-text email (no layout of its own) dressed in the same design: one paragraph per gap. */
export function layoutFromText(
  subject: string,
  text: string,
  reason = "This email was sent by Realm.",
): EmailLayout {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    preheader: paragraphs[0] ?? subject,
    heading: subject.replace(/^Realm:\s*/i, ""),
    intro: paragraphs,
    reason,
  };
}
