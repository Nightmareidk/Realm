import { createTransport, type Transporter } from "nodemailer";
import type { Logger } from "./logger";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
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
    await this.transport.sendMail({ from: this.from, ...mail });
  }
}

/** Dev/test mailer: keeps messages in memory and logs a one-line notice (never the body). */
export class MemoryMailer implements Mailer {
  readonly outbox: Mail[] = [];

  constructor(private readonly logger?: Logger) {}

  async send(mail: Mail) {
    this.outbox.push(mail);
    this.logger?.info({ to: mail.to, subject: mail.subject }, "mail captured (no SMTP configured)");
  }

  last(to?: string): Mail | undefined {
    const list = to ? this.outbox.filter((m) => m.to === to) : this.outbox;
    return list[list.length - 1];
  }
}
