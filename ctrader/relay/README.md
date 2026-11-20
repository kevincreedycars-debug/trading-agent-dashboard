# cTrader relay

These are the relay's own sources: the node files that run in `C:\ctrader-relay\` on the VPS under the trading
account's own login, driving the cTrader Open API and the MT5 probe. The copier that mirrors FTMO-1 onto cTrader is
built from three of them. Nothing here is imported by the dashboard build, the research lanes or the backtester: the
relay runs on the host and the dashboard only reads what it publishes.

`src/` holds a module and its `node --test` file side by side, as they sit on the host:

- `CTRADER_TRANSPORT_20261114.js` - one WebSocket session, protobuf framing, request/response correlation, the
  message ids and the error codes; it sends nothing on its own and holds no credential.
- `CTRADER_ADAPTER_20261114.js` - the trading verbs over that session: account selection by login, symbol specs,
  position and order reads, market and pending sends, amendment (entry, stop, target), cancellation, close with a
  named or implied volume.
- `CTRADER_COPIER_20261119.js` - the copier: reads the probe's document, converts size for the destination contract,
  copies filled positions and resting orders, amends protection, cancels and re-places, takes partial closes, keeps
  the mapping store and writes the health file.
- `CTRADER_RUN_20261114.js`, `CTRADER_SECRETS_20261114.js` - the credential path: the sealed vault, the DPAPI
  unwrap and the token refresh the copier calls before it connects. No secret is in either file; the vault lives
  outside the repository.
- `CTRADER_RELAY_CORE_20261113.js`, `CTRADER_BTCUSD_TEST_20261113.js` - the first settled relay and the small
  end-to-end BTCUSD check that proved transport, adapter and vault together.
- `CTRADER_OAUTH_20261114.js`, `CTRADER_CALLBACK_20261114.js`, `CTRADER_CONSENT_20261115.js` - the interactive
  consent flow that fills the vault, and its callback.
- `CTRADER_JOURNAL_20261115.js` - the append-only journal of what the relay sent, kept beside the vault.
- `run-consent.cmd` - starts the consent listener with no secret on a command line; the credentials come from the
  vault. Output goes to `C:\ProgramData\ctrader-relay\consent-out.log`.

Three parts of the deployed surface live elsewhere in this repository because the dashboard build also uses them:
the probe is `tools/mt5-bridge/live-trading-positions-probe.py`, the copier's read-and-publish tools are `lib/` and
`scripts/`, and the scheduled tasks and their wrappers are `ctrader/copier/`.

## Deploying

The relay is copied to the host, not pulled there: the host has no checkout of this repository. Back up first, then
copy, then read every file's hash back.

1. `schtasks /change /tn ctrader-copier-poll /disable` - the copier is the only part that trades, so it is stopped
   for the swap. Nothing else on the host sends an order.
2. Copy `src\CTRADER_*.js` to `C:\ctrader-relay\`, `run-consent.cmd` to `C:\ctrader-relay\`, and the parts named
   above to `C:\ctrader-relay\`, `C:\ctrader-relay\copier\` and `C:\ctrader-relay\copier-tools\{lib,scripts}\`.
3. Read each file's SHA-256 back on the host (`certutil -hashfile <file> SHA256`) and compare it with this
   repository's copy (`Get-FileHash <file> -Algorithm SHA256`). A mismatch is a partial copy, not a difference of
   opinion.
4. `schtasks /run /tn ctrader-copier-poll`, then read `C:\ProgramData\ctrader-relay\copier\poll.out.txt`; the first
   line names the build and the last names the poll's own counts. `schtasks /change /tn ctrader-copier-poll /enable`
   afterwards, and read `health.json` for the version and status it wrote.
5. Run `ctrader-copier-dashboard` once and read `dashboard.out.txt`: snapshot, build and publish each exit with their
   own JSON. The publish only happens inside its own interval gate, so a refusal there is not a failure.

Rollback is the backup folder the copy was taken from: copy it back, run one poll, and the previous build is
reporting again. The mapping store is not touched by a code swap, so nothing is re-sent.

## What is never in this folder

The vault (`C:\ProgramData\ctrader-relay\secrets\ctrader.vault.json`, DPAPI-sealed to the host's own account), the
copier's mapping store, its health, snapshot, dashboard and publish-state files, the consent log and every backup are
host state. They are written under `C:\ProgramData\ctrader-relay\` and stay out of the repository; this folder holds
code that reads them and nothing that contains them. The journal and logs a run leaves behind are evidence of a host,
not source.

## Tests

From this folder:

```sh
cd ctrader/relay/src
node --test CTRADER_TRANSPORT_20261114.test.js
```

Each module has its own file and they are run one at a time because several patch a shared protobuf surface. The ten
files total 249 tests: transport 42, adapter 37, copier 46, BTCUSD 24, relay core 22, secrets 17, journal 17, run 16,
OAuth 15, consent 13. A passing suite is a statement about fixtures; the lifecycle paths a live source has not yet
exercised are still only `tested` on the dashboard, and the note for that is
`docs/live-trading/CTRADER_COPIER_LIFECYCLE_20261120.md`.
