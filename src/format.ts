import type { Alert } from "./diff.js";
import type { EmailMessage } from "./notify/index.js";

const usd = (n: number) => `$${n.toFixed(2)}`;

export function formatAlert(alert: Alert, to: string): EmailMessage {
  const { watch, current, previous, reasons } = alert;
  const price = usd(current.lowestPrice!);
  const kind =
    current.priceKind === "marketplace-listing"
      ? "lowest SeatGeek listing"
      : current.priceKind === "primary-face-value"
        ? "lowest Ticketmaster face value"
        : "lowest price";
  const headline = reasons.includes("target-crossed")
    ? `${watch.label}: ${price} - at or under your ${usd(watch.targetPrice!)} target`
    : `${watch.label}: new low ${price}`;
  const lines = [
    headline,
    "",
    `Price: ${price} (${kind}, before fees unless the source includes them)`,
    previous?.lowestPrice != null ? `Last check: ${usd(previous.lowestPrice)}` : "Last check: no price",
    previous?.allTimeLow != null ? `Previous low: ${usd(previous.allTimeLow)}` : null,
    watch.targetPrice !== undefined ? `Target: ${usd(watch.targetPrice)}` : null,
    current.url ? `Buy: ${current.url}` : null,
    "",
    `Watch id: ${watch.id}`,
  ].filter((l): l is string => l !== null);
  return { to, subject: headline, text: lines.join("\n") };
}
