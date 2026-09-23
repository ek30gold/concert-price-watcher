# concert-price-watcher

Personal tool: search concerts by artist, venue, city and date across **Ticketmaster** and **SeatGeek**, put a price watch on a show, and get an **email** when the price hits a new low or drops to your target.

Official APIs only. No scraping, no bot workarounds, no accounts beyond your own API keys.

## How it works

```
watches.json ──► GitHub Actions cron (every 15 min)
                   │
                   ├─ SeatGeek Platform API   /2/events/{id}        → lowest marketplace listing (resale)
                   ├─ Ticketmaster Discovery  /discovery/v2/events  → face-value price range (primary)
                   │
                   ├─ cheapest non-null price per watch
                   ├─ diff vs state/snapshots.json (last committed prices)
                   ├─ email via Resend on target cross / new all-time low
                   └─ commit state/snapshots.json only when a price moved
```

| Path | What it is |
| --- | --- |
| `src/providers/ticketmaster.ts` | Discovery API v2 client + normalizer |
| `src/providers/seatgeek.ts` | SeatGeek Platform API client + normalizer |
| `src/search.ts` | Unified search: queries both, merges the same show (date + venue), picks the cheapest price |
| `src/watches.ts` | Strict `watches.json` validation (a typo fails CI instead of silently skipping) |
| `src/diff.ts` | Alert rules |
| `src/watcher.ts` | One watch run: price each watch, update snapshots, send alerts |
| `src/notify/` | Email behind a `Notifier` interface: Resend, plus a dry-run console notifier |
| `.github/workflows/watch.yml` | The 15-minute watcher |
| `.github/workflows/ci.yml` | Typecheck + tests on every push/PR |

### Prices are honest

- A missing price is `null`, never `0` and never a guess. A run where every source fails keeps the last known price instead of recording a drop.
- Every price says what it is: **marketplace listing** (SeatGeek) or **primary face value** (Ticketmaster). Face value is before fees unless Ticketmaster's range says otherwise.
- SeatGeek pricing lives in the event's `stats` object. Some API accounts have reported `stats` coming back empty, so check your key returns prices (step 3 below) before relying on alerts. If it doesn't, the watcher still works on Ticketmaster face value.

### Alert rules

- **Target crossed**: price is at or under `targetPrice` now and was above it (or unknown) at the last check. Staying under the target doesn't re-send.
- **New low**: price is below every price this watcher has seen for that watch. The very first reading only sets the baseline.

## Setup

### 1. Get API keys

| Key | Where | Secret name |
| --- | --- | --- |
| Ticketmaster Discovery API key ("Consumer Key") | Sign up at https://developer-acct.ticketmaster.com/user/register, then My Apps | `TICKETMASTER_API_KEY` |
| SeatGeek client ID (secret optional) | Sign in and register an app at https://seatgeek.com/account/develop | `SEATGEEK_CLIENT_ID`, optional `SEATGEEK_CLIENT_SECRET` |

Ticketmaster's default quota is 5,000 calls/day at 5 requests/second. A watch run makes one call per event reference, so 96 runs/day stays well under that for a personal list.

### 2. Email (optional until you want real alerts)

Without these the watcher runs in dry-run mode and prints the email to the Actions log.

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | API key from https://resend.com (free tier) |
| `ALERT_EMAIL_TO` | Where alerts go |
| `ALERT_EMAIL_FROM` | Optional. Defaults to `onboarding@resend.dev`, which Resend only delivers to your own Resend account email. Use a verified domain to send elsewhere. |

The transport sits behind `Notifier` (`src/notify/types.ts`); a Gmail/SMTP one can be added without touching the watcher.

### 3. Add the secrets to the repo

GitHub → this repo → **Settings → Secrets and variables → Actions → New repository secret**, one per name above. Or with the GitHub CLI:

```sh
gh secret set TICKETMASTER_API_KEY
gh secret set SEATGEEK_CLIENT_ID
gh secret set RESEND_API_KEY
gh secret set ALERT_EMAIL_TO
```

(`gh secret set` prompts for the value so it never lands in your shell history.)

Check it locally:

```sh
npm ci
TICKETMASTER_API_KEY=... SEATGEEK_CLIENT_ID=... npm run search -- --keyword "phoebe bridgers" --city "New York"
```

Each result prints its provider IDs (e.g. `seatgeek:6612345 ticketmaster:vvG1zZ9...`) and a price, or `no price`.

## Adding a watch

1. Find the show with `npm run search` (flags: `--keyword`, `--city`, `--state NY`, `--from 2026-11-01`, `--to 2026-11-30`, `--json`).
2. Copy its IDs into `watches.json`:

```json
[
  {
    "id": "phoebe-msg-2026-11-14",
    "label": "Phoebe Bridgers @ MSG, Nov 14",
    "events": [
      { "source": "seatgeek", "id": "6612345" },
      { "source": "ticketmaster", "id": "vvG1zZ9example" }
    ],
    "targetPrice": 60
  }
]
```

- `id`: your handle, lowercase letters, digits, dashes.
- `events`: one or more `{source, id}`; the cheapest across them wins. SeatGeek gives resale, Ticketmaster gives face value.
- `targetPrice`: optional, USD. Without it you only get new-low alerts.
- `active: false` pauses a watch and keeps its history.

3. Commit. CI validates the file; the next cron run picks it up. Run **Actions → Price watch → Run workflow** to check immediately.

## Notes

- `watches.json` and `state/snapshots.json` are public if the repo is public.
- GitHub pauses scheduled workflows in public repos after 60 days without commits. Snapshot commits only happen when prices move, so re-enable from the Actions tab if it goes quiet.
- Coverage is what the two official APIs expose. StubHub, Vivid Seats and TickPick are not included; their data is only available through approval-gated partner programs.

## Develop

```sh
npm ci
npm test          # vitest, fixtures only, no network
npm run typecheck
```
