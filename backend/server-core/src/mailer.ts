import { createTransport, type Transporter } from "nodemailer";
import {
  type EmailBrand,
  type EmailLayout,
  emailBodyText,
  layoutFromText,
  renderEmailHtml,
  renderEmailText,
} from "./email-layout";
import type { Logger } from "./logger";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** The designed version (see email-layout.ts). BrandedMailer turns it into HTML. */
  layout?: EmailLayout;
}

/**
 * A designed email. Its plain text is the same words; BrandedMailer adds the footer and the HTML
 * when it goes out.
 */
export function brandedMail(to: string, subject: string, layout: EmailLayout): Mail {
  return { to, subject, layout, text: emailBodyText(layout) };
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Waits between tries when Resend is busy (429) or down (5xx). */
const RESEND_RETRY_WAITS_MS = [1_000, 3_000];

/**
 * Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). Each email that
 * Resend accepts is logged with Resend's id, how long it took and only the domain it went to, so a
 * late code can be traced in Resend's dashboard (Emails › that id) without logging the address.
 */
export class ResendMailer implements Mailer {
  constructor(
    private readonly from: string,
    private readonly apiKey: string,
    private readonly logger?: Logger,
    private readonly retryWaitsMs: readonly number[] = RESEND_RETRY_WAITS_MS,
  ) {}

  async send(mail: Mail) {
    const started = Date.now();
    const body = JSON.stringify({
      from: this.from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
    });
    for (let attempt = 0; ; attempt++) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const sent = (await res.json().catch(() => null)) as { id?: unknown } | null;
        this.logger?.info(
          {
            resendId: typeof sent?.id === "string" ? sent.id : undefined,
            ms: Date.now() - started,
            tries: attempt + 1,
            toDomain: mail.to.split("@").pop()?.toLowerCase(),
            subject: mail.subject,
          },
          "mail sent",
        );
        return;
      }
      const wait = this.retryWaitsMs[attempt];
      const busy = res.status === 429 || res.status >= 500;
      if (!busy || wait === undefined) {
        throw new Error(`Resend refused the email: ${res.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    private readonly from: string,
    options: { host: string; port: number; user?: string; password?: string },
  ) {
    this.transport = createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      auth: options.user ? { user: options.user, pass: options.password } : undefined,
    });
  }

  async send(mail: Mail) {
    const { to, subject, text, html } = mail;
    await this.transport.sendMail({
      from: this.from,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });
  }
}

/**
 * Dev/test mailer: keeps messages in memory and logs a one-line notice (never the body). With
 * `echo` (local development only, where there's no inbox to read) it also prints the message, so
 * the verification code and links can be copied from the API's console.
 */
export class MemoryMailer implements Mailer {
  readonly outbox: Mail[] = [];

  constructor(
    private readonly logger?: Logger,
    private readonly options: { echo?: boolean } = {},
  ) {}

  async send(mail: Mail) {
    this.outbox.push(mail);
    this.logger?.info({ to: mail.to, subject: mail.subject }, "mail captured (no SMTP configured)");
    if (this.options.echo) {
      const rule = "-".repeat(64);
      process.stdout.write(
        `
${rule}
To: ${mail.to}
Subject: ${mail.subject}

${mail.text}
${rule}

`,
      );
    }
  }

  last(to?: string): Mail | undefined {
    const list = to ? this.outbox.filter((m) => m.to === to) : this.outbox;
    return list[list.length - 1];
  }
}

/**
 * Dresses every email in Realm's design before it goes out: the HTML version, and a plain-text
 * version with the same footer. An email with no layout of its own is laid out from its text.
 */
export class BrandedMailer implements Mailer {
  constructor(
    private readonly inner: Mailer,
    private readonly brand: EmailBrand,
  ) {}

  async send(mail: Mail) {
    const layout = mail.layout ?? layoutFromText(mail.subject, mail.text);
    await this.inner.send({
      to: mail.to,
      subject: mail.subject,
      text: renderEmailText(layout, mail.to, this.brand),
      html: mail.html ?? renderEmailHtml(layout, mail.to, this.brand),
    });
  }
}
