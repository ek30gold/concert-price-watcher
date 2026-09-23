import type { Fetcher } from "../types.js";
import type { EmailMessage, Notifier } from "./types.js";

/** Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendNotifier implements Notifier {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async send(msg: EmailMessage): Promise<void> {
    const res = await this.fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    }
  }
}
