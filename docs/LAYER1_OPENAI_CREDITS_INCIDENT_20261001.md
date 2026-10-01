# Layer 1 Agent model outage - the OpenAI account is out of credits, 2026-10-01

**Resolved the same day.** The account was funded, and the recheck refresh run at `2026-10-01T13:01:56.963Z`
(orchestrator 4460) completed the whole chain green with genuinely fresh Layer 1 - see "Resolution" below.

Both refreshes on the morning of 2026-10-01 failed at the Layer 1 model node for all seven assets. This is not a
rate limit and not a workflow defect: the OpenAI account behind the n8n credential has no credits left, so the
already-deployed retries and a second run ten minutes later both returned the same provider error. No dashboard,
workflow, credential or repository change is the repair - the account has to be funded, or the model provider
replaced.

## Resolution: the recheck refresh of 2026-10-01T13:01:56.963Z ran the whole chain green

After the user confirmed the top-up, a refresh was triggered with the documented webhook POST at
`2026-10-01T13:01:56.963Z`. Orchestrator execution 4460 finished `success` at `2026-10-01T13:08:26.633Z`, and this time
every Layer 1 agent reached the end of its workflow:

| Asset | Execution | Started | Stopped | Result |
| --- | --- | --- | --- | --- |
| USD | 4468 | 13:05:16.766Z | 13:05:31.262Z | success, last node `Create a row` |
| EUR | 4469 | 13:05:32.613Z | 13:05:48.401Z | success, last node `Create a row` |
| GOLD | 4470 | 13:05:49.733Z | 13:06:05.427Z | success, last node `Create a row` |
| NQ | 4471 | 13:06:06.677Z | 13:06:23.891Z | success, last node `Create a row` |
| BTC | 4472 | 13:06:25.124Z | 13:06:44.753Z | success, last node `Create a row` |
| WTI | 4473 | 13:06:46.170Z | 13:07:39.290Z | success, last node `Create a row` |
| GBP | 4474 | 13:07:39.395Z | 13:07:58.853Z | success, last node `Create a row` |
| SILVER | 4475 | 13:07:58.961Z | 13:08:13.488Z | success, last node `Create a row` |

Layer 2 4476 then ran `13:08:14.686Z`-`13:08:19.658Z` (success) and the Dashboard Writer 4477 ran
`13:08:20.308Z`-`13:08:24.332Z` (success), publishing the run to production `main`: `21b2ae6` (layer 2, `13:08:18Z`),
`5871944` (layer 1, `13:08:23Z`) and `104716a` (status, `13:08:25Z`). The published status file reads `success`,
`Manual Refresh Complete`, `last_run_finished_at` `2026-10-01T13:08:24.979Z`.

Published `data/layer1.json` carries `dashboard_meta.last_updated_et` `2026-10-01T13:08:22.451Z` and eight distinct agent
`sealed_at` values from `2026-10-01T13:05:31.194527Z` to `2026-10-01T13:08:13.210016Z`, each within a second of its own
execution above, with `expires_at` 24 hours later - this is a genuinely fresh Layer 1, not a restamped one. Published
`data/layer2.json` reads `last_updated_et` `2026-10-01T13:08:18.294Z`, built from those fresh Layer 1 inputs. The stale
stamp the refused 09:29Z run had left behind is superseded.

There was also an earlier healthy run between them: orchestrator 4442 (`10:27:16.901Z`-`10:32:31.332Z`, success) with
agents 4450-4457 succeeding `10:29:50Z`-`10:32:17Z` and its publish `bc60764`/`e07f501`/`9213bc7`/`1f82c55` at `10:32Z`.
So the balance was restored between the failed SILVER at `2026-10-01T09:28:55Z` and the succeeded USD at
`2026-10-01T10:29:50Z`, and the live chain has now produced fresh Layer 1 twice.

Nothing was changed to achieve this: no workflow, credential, dashboard or repository edit, no error suppression, no
republish of stale data. The only open observation is pre-existing and unrelated to the outage - published payloads still
carry `source_run_id: null` with `source_run_id_consistency: UNKNOWN`, so freshness has to be read from `sealed_at` and
`expires_at` rather than from a run id.

The artifact reached the browser-facing surface too: the live Pages copy at
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/data/layer1.json` still returned the 10:32:27Z version while
the deploy propagated and flipped to `last_updated_et` `2026-10-01T13:08:22.451Z` at `2026-10-01T13:13:59Z`, about five and
a half minutes after the writer pushed it.

## Confirmed failure

Authenticated n8n inspection through the CLIXML credential runner (scope `n8n`, read-only API calls) shows all
seven active Layer 1 agents failing at their single LLM node `Message a model`
(`@n8n/n8n-nodes-langchain.openAi`, model `gpt-4.1-mini`, credential reference `OpenAI account 2`):

- USD 4414 (`2026-10-01T08:56:08Z`), and USD 4396 (`2026-10-01T08:45:26Z`) in the earlier run
- EUR 4415, GOLD 4416, NQ 4417, BTC 4418, WTI 4419, GBP 4420, SILVER 4421

Every one is `NodeApiError`, HTTP `429`, message `The service is receiving too many requests from you`, description
`You have no credits remaining. Add credits to continue using the API at
https://platform.openai.com/settings/organization/billing/.` The status code is rate-limit shaped, but the
provider's own description names an exhausted balance, and two runs ten minutes apart - each inside the node's
deployed retry policy - behave like a balance and not like a burst.

USD Layer 1 history from the same inspection: last success 4378 at `2026-09-30T10:19:42Z`, and the published Layer 1
payloads the panel still renders are that run's, which is why every card reads `STALE`. The balance ran out between
`2026-09-30T10:19Z` and `2026-10-01T08:45Z`.

Not affected: the market collectors (4409-4413, success), Layer 2 4422 (its workflow carries no LLM node, so it
rebuilt from Layer 1's stale outputs) and Dashboard Writer 4423 (success). The Master therefore finished with a
failed workflow status while still publishing a fresh ingest stamp and a Layer 2 file derived from yesterday's Layer
1 inputs.

## The deployed retry policy was already exercised

Five of the seven nodes already carry `retryOnFail: true` with `waitBetweenTries: 5000` (USD, EUR, GOLD, NQ, BTC);
WTI and GBP carry none. Each agent's failure took 29-31 seconds, consistent with the configured retries running and
returning the same balance error. Extending tries or waits cannot create credits, so no workflow change was made and
none is proposed. Error suppression, a republish of stale Layer 1 as fresh, and a status-schema change were all
rejected for the same reason.

## What the repair requires

1. Fund the OpenAI organization behind `OpenAI account 2` (prepaid credits or a raised budget), or replace that
   credential with a funded account. Nothing else is needed: the next refresh re-runs the collectors, the seven
   agents, Layer 2 and the writer.
2. If that account is not coming back, the alternative is a provider switch. The only funded model key available
   locally is `DEEPSEEK_API_KEY` in the CLIXML store, which an n8n DeepSeek credential would have to be created
   from. The change lands on seven active workflows plus the four isolated `TEST - ... - ISOLATED - 20260723`
   copies, it replaces the model that produces Layer 1 signals, and it needs an explicit authorisation and a
   strict-JSON output validation pass before any publish.

## Recheck after the top-up: the 2026-10-01T09:22Z refresh was still refused

The user reported the account funded and asked for a recheck. A controlled refresh was triggered outside the browser with
the documented POST (`master-orchestrator-dashboard-refresh`) at `2026-10-01T09:22:24.966Z`. Orchestrator execution 4424
finished `success` at `2026-10-01T09:29:10Z`, and inside it all eight Layer 1 agents failed the same way: USD 4432
(`09:25:23Z`), EUR 4433, GOLD 4434, NQ 4435, BTC 4436, WTI 4437, GBP 4438 and SILVER 4439 (`09:28:24Z`, stopped
`09:28:55Z`), every one at `Message a model` with HTTP `429` and `You have no credits remaining.`. The balance is
therefore still exhausted as seen by the key behind credential `OpenAI account 2` at `09:25Z`-`09:29Z` on 1 October: a
top-up that had reached that organisation would have cleared at least the later agents, which failed seven minutes into
the run.

Two facts for whoever is checking billing:

- All eight active Layer 1 agents use one credential: node `Message a model` (`@n8n/n8n-nodes-langchain.openAi`, model
  `gpt-4.1-mini`) with `openAiApi` credential id `VY1FMMlFQNwU3Ctt`, name `OpenAI account 2`. The workspace's workflow
  definitions reference exactly two OpenAI credentials: that one (13 workflows) and `OpenAI account`
  (`BIioMOGj8DJHGGhb`), referenced only by the inactive `Gold Agent` (`7vVmN27XFZrW9vgc`), which has no recorded
  executions at all - not a working fallback.
- The same refusal is returned for an exhausted balance, a spend cap, and a key belonging to a different organisation or
  project than the one that was funded. The check that matters is that the funded organisation owns the key behind
  `VY1FMMlFQNwU3Ctt`.

The refused run still published: Layer 2 4440 (`09:28:56Z`, success, the workflow carries no model node) and Dashboard
Writer 4441 (`09:29:02Z`, success) pushed production `main` commits `c77b268` (layer 2) and `b065224` (layer 1). Published
`data/layer1.json` now carries `dashboard_meta.last_updated_et` `2026-10-01T09:29:05.981Z` while all eight agent payloads
inside it are sealed `2026-09-30T10:19:54Z`-`2026-09-30T10:21:51Z` and expire `2026-10-01T10:19Z`-`2026-10-01T10:21Z`. A
Master run that reports `success` is therefore still not proof of fresh Layer 1, and the cards go stale and then expire
again inside the hour. No rollback of that publication was taken: it carries yesterday's own calls, and rewriting
production files is a publish decision, not a repair.

## Evidence

Instance kind and credential inventory were read from the API without printing any value: the instance is n8n Cloud,
45 workflows, and the credential names the live workflows reference are GitHub, Gmail, OpenAI, RapidAPI and Supabase
only - no DeepSeek credential exists in n8n today. Raw evidence stays ignored: `tmp/layer1-429-summary.txt`,
`tmp/usd-timeline.txt`, `tmp/llm-nodes.txt`, `tmp/instance.txt`, `tmp/n8n-evidence/*-latest-execution.json`, and the
read-only helpers `tmp/inspect-layer1-429.js`, `tmp/inspect-usd-timeline.js`, `tmp/inspect-llm-nodes.js`,
`tmp/inspect-instance.js`. Added for the recheck: `tmp/recheck-layer1-status.js`,
`tmp/inspect-orchestrator-executions.js`, `tmp/inspect-run-children.js`, `tmp/inspect-openai-credential.js`,
`tmp/scan-openai-credentials.js`, `tmp/list-workflows.js`, `tmp/inspect-executions.js`,
`tmp/inspect-executions-gold-agent.js`, `tmp/summarize-published.js`.
