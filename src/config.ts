import { SeatGeekClient } from "./providers/seatgeek.js";
import { TicketmasterClient } from "./providers/ticketmaster.js";

/** Build whichever clients have keys. Callers decide whether an empty set is an error. */
export function providersFromEnv(env: NodeJS.ProcessEnv) {
  const tmKey = env.TICKETMASTER_API_KEY?.trim();
  const sgId = env.SEATGEEK_CLIENT_ID?.trim();
  const sgSecret = env.SEATGEEK_CLIENT_SECRET?.trim() || undefined;
  return {
    ...(tmKey ? { ticketmaster: new TicketmasterClient(tmKey) } : {}),
    ...(sgId ? { seatgeek: new SeatGeekClient(sgId, sgSecret) } : {}),
  };
}
