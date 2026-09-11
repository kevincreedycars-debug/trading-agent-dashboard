# Collector request multiplication, 2026-09-11

User authorized diagnosing and fixing the recurring live refresh failure. Master execution 3547 at 07:21 UTC passed 16 economic-event items into USD execution 3549. Each static HTTP request ran 16 times. Seven completed FRED nodes made 112 requests; DXY then failed at item index 2 with HTTP 429. EUR 3550, Gold 3551, NQ 3552 and BTC 3553 immediately received FRED 429. This differs from the September 9 HTML 403 and the earlier CoinGecko incident.

FRED documents a maximum of 120 requests per minute: https://fred.stlouisfed.org/docs/api/fred/errors.html. The failure is explained by item multiplication within one refresh; it does not establish excessive user clicks. Successful downstream agents and publication do not establish refreshed collector inputs.

Repair intent: set `executeOnce: true` on the initial static DGS2 HTTP request in each of the five active collectors. This collapses incoming orchestration items at the first provider request. Each collector still independently fetches its own inputs. Preserve credentials, source queries, downstream calculations, economic-event reads, history queries, connections and failure behavior. No retries or error suppression are added.

The guarded command `scripts/repair_collector_single_run.js ASSET [--apply]` defaults to read-only, checks allowlisted identity, static GET/provider, single entry edge, active/draft agreement and concurrent drift, backs up locally and verifies saved and active nodes/connections. Raw execution captures and backups are ignored under `tmp/`. Sanitized exports receive the same single setting, without importing their other differences into production.

Validation sequence: local regression suite; record intent on the task branch; apply and retry USD with current workflow; inspect actual item counts and snapshot creation; apply remaining collectors; one full refresh and inspect every collector and published status. Live validation pending.
