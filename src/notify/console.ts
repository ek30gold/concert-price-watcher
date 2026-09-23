import type { EmailMessage, Notifier } from "./types.js";

/** Dry-run transport: prints the email instead of sending. Used when no email secrets are set. */
export class ConsoleNotifier implements Notifier {
  readonly name = "console (dry run)";
  readonly sent: EmailMessage[] = [];
  constructor(private readonly log: (s: string) => void = console.log) {}
  async send(msg: EmailMessage): Promise<void> {
    this.sent.push(msg);
    this.log(`[dry-run email] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
  }
}
