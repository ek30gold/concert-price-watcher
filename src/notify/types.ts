export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Any email transport. Swap Resend for Gmail/SMTP by adding another implementation. */
export interface Notifier {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}
