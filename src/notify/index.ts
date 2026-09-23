import { ConsoleNotifier } from "./console.js";
import { ResendNotifier } from "./resend.js";
import type { Notifier } from "./types.js";

export type { EmailMessage, Notifier } from "./types.js";

export interface NotifierConfig {
  notifier: Notifier;
  to: string | null;
  /** Why we fell back to dry run, if we did. */
  dryRunReason: string | null;
}

/** Pick a transport from env. Missing keys mean dry run, never a crash, so CI stays green without secrets. */
export function notifierFromEnv(env: NodeJS.ProcessEnv): NotifierConfig {
  const to = env.ALERT_EMAIL_TO?.trim() || null;
  const provider = (env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  if (provider !== "resend") {
    return { notifier: new ConsoleNotifier(), to, dryRunReason: `EMAIL_PROVIDER "${provider}" is not implemented yet` };
  }
  const key = env.RESEND_API_KEY?.trim();
  const from = env.ALERT_EMAIL_FROM?.trim() || "Concert Watcher <onboarding@resend.dev>";
  if (!key || !to) {
    const missing = [!key && "RESEND_API_KEY", !to && "ALERT_EMAIL_TO"].filter(Boolean).join(", ");
    return { notifier: new ConsoleNotifier(), to, dryRunReason: `missing ${missing}` };
  }
  return { notifier: new ResendNotifier(key, from), to, dryRunReason: null };
}
