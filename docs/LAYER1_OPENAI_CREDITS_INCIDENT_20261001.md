# Layer 1 Agent model outage - the OpenAI account is out of credits, 2026-10-01

Both refreshes on the morning of 2026-10-01 failed at the Layer 1 model node for all seven assets. This is not a
rate limit and not a workflow defect: the OpenAI account behind the n8n credential has no credits left, so the
already-deployed retries and a second run ten minutes later both returned the same provider error. No dashboard,
workflow, credential or repository change is the repair - the account has to be funded, or the model provider
replaced.

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

## Evidence

Instance kind and credential inventory were read from the API without printing any value: the instance is n8n Cloud,
45 workflows, and the credential names the live workflows reference are GitHub, Gmail, OpenAI, RapidAPI and Supabase
only - no DeepSeek credential exists in n8n today. Raw evidence stays ignored: `tmp/layer1-429-summary.txt`,
`tmp/usd-timeline.txt`, `tmp/llm-nodes.txt`, `tmp/instance.txt`, `tmp/n8n-evidence/*-latest-execution.json`, and the
read-only helpers `tmp/inspect-layer1-429.js`, `tmp/inspect-usd-timeline.js`, `tmp/inspect-llm-nodes.js`,
`tmp/inspect-instance.js`.
