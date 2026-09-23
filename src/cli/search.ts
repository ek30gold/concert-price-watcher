import { parseArgs } from "node:util";
import { providersFromEnv } from "../config.js";
import { searchAll } from "../search.js";

const { values } = parseArgs({
  options: {
    keyword: { type: "string", short: "k" },
    city: { type: "string", short: "c" },
    state: { type: "string", short: "s" },
    from: { type: "string" },
    to: { type: "string" },
    size: { type: "string" },
    json: { type: "boolean" },
  },
});

const providers = providersFromEnv(process.env);
if (Object.keys(providers).length === 0) {
  console.error("Set TICKETMASTER_API_KEY and/or SEATGEEK_CLIENT_ID first (see README).");
  process.exit(1);
}

const result = await searchAll(providers, {
  keyword: values.keyword,
  city: values.city,
  stateCode: values.state,
  startDate: values.from,
  endDate: values.to,
  size: values.size ? Number(values.size) : undefined,
});

if (values.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const e of result.events) {
    const price = e.lowest ? `$${e.lowest.price} (${e.lowest.source})` : "no price";
    const ids = e.sources.map((s) => `${s.source}:${s.id}`).join(" ");
    console.log(`${e.localDate ?? "TBD"}  ${e.name} @ ${e.venue ?? "?"}, ${e.city ?? "?"}  ${price}\n    ${ids}`);
  }
  if (!result.events.length) console.log("No events found.");
}
for (const err of result.errors) console.warn(`warn: ${err.provider} - ${err.message}`);
