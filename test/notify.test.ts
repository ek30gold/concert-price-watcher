import { describe, expect, it } from "vitest";
import { notifierFromEnv } from "../src/notify/index.js";
import { ResendNotifier } from "../src/notify/resend.js";
import { fakeFetch } from "./helpers.js";

describe("notifierFromEnv", () => {
  it("falls back to dry run and names what is missing", () => {
    const c = notifierFromEnv({});
    expect(c.notifier.name).toBe("console (dry run)");
    expect(c.dryRunReason).toBe("missing RESEND_API_KEY, ALERT_EMAIL_TO");
  });
  it("uses Resend when key and recipient are set", () => {
    const c = notifierFromEnv({ RESEND_API_KEY: "re_x", ALERT_EMAIL_TO: "me@example.com" });
    expect(c.notifier.name).toBe("resend");
    expect(c.dryRunReason).toBeNull();
  });
  it("does not pretend to support unimplemented providers", () => {
    expect(notifierFromEnv({ EMAIL_PROVIDER: "gmail" }).dryRunReason).toMatch(/not implemented/);
  });
});

describe("ResendNotifier", () => {
  it("posts to the Resend emails endpoint with bearer auth", async () => {
    const f = fakeFetch({ "api.resend.com/emails": { body: { id: "abc" } } });
    await new ResendNotifier("re_key", "Watcher <a@b.dev>", f).send({ to: "me@example.com", subject: "S", text: "T" });
    const call = f.calls[0]!;
    expect((call.init!.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(call.init!.body as string)).toMatchObject({ to: ["me@example.com"], subject: "S", from: "Watcher <a@b.dev>" });
  });
  it("throws on a failed send", async () => {
    const f = fakeFetch({ "api.resend.com": { status: 422, body: { message: "bad from" } } });
    await expect(new ResendNotifier("k", "f", f).send({ to: "x", subject: "s", text: "t" })).rejects.toThrow(/Resend 422/);
  });
});
