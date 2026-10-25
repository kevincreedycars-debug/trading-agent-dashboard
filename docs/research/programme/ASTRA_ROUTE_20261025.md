# Astra route assessment, 2026-10-25 - written answer before any adapter code

Lane `automation-coordinator`, deliverable 1. The question was what Astra is, which interface the owner's
account can use, whether that interface is supported and official, what it costs and which credential it needs.

**Answer: no supported route is established, so no adapter code has been written.** That is a complete return
under this lane's assignment, not a deferral: the assignment says a written no with the evidence is the correct
outcome, and the human upload path stays the only route this repository has verified.

## What this repository can actually establish

- No file in the checkout names Astra: no endpoint, no SDK, no credential name, no fixture, no test, no log, no
  comment in the page, the adapters, the store or the build scripts. The dashboard never calls a model from the
  page, and that is a deliberate rule in `SHARED_CONTRACT.md` section 9, not an omission.
- The only description of Astra is the owner's own: they use it today through their existing ChatGPT access.
  That is a statement about the owner's account, and this lane has not verified it because verifying it needs
  that account.
- `INTERFACES.md` section "What does not exist" already says it plainly: no scheduler, queue, allowance handler
  or Astra adapter is in the repository, and no run has been executed by a machine. Nothing in this assessment
  changes that sentence.

So the honest position is narrower than "Astra cannot be automated": it is that **the repository holds no
evidence either way**, and the five answers below are the ones that decide it. Guessing any of them would put a
claim in a document that a later reader would treat as verified.

## The five questions, and how the owner settles each

Each check is done in the owner's own account, takes minutes, and produces an answer that either confirms or
falsifies a route. None of them requires sharing a credential in a chat, a repository file or a prompt.

| # | Question | How the owner settles it | What the answer decides |
| --- | --- | --- | --- |
| 1 | Is there a documented programmatic interface for Astra, with API documentation and an API-key section in the account? | Look for a developer/API section in the product the owner uses, and for published reference docs | If yes, a supported route may exist. If the only access is the product's own chat interface, there is no supported unattended route and this lane stops |
| 2 | Is that interface separately billed, or included in the existing access? | The account's plan and usage page, and whether an API key can be created without adding a payment method | The owner has already excluded a separately billed API and a substitute model. A yes to separate billing closes the route under the owner's own constraint, not under a lane preference |
| 3 | Does the product offer a scheduled or unattended run (a task, agent or batch feature), and does it run without a browser open? | The product's own task/scheduling feature, if it has one, described in its docs | A UI-only feature that needs a browser tab open is not unattended. This is the difference between a route and a habit |
| 4 | What does one run consume from the allowance, and can that be measured? | Usage page before and after one run of a known prompt | An unmeasurable allowance cannot be budgeted, and the queue's pause rule has nothing to read |
| 5 | Do the terms permit this use, and what happens to the prompt and output content? | The provider's terms and data-use statement for the product in question | A prohibition on automated use, or training on content, is a stop: prompts carry repository paths and unpublished research |

## What each outcome routes to

- **1 yes, 2 included, 3 unattended, 4 measurable, 5 permitted** - a supported route exists. Then, and only
  then, the queue in Interface E is built, with the per-run record and the pause rule, and the first machine run
  is a pilot whose report quotes its own run record.
- **1 yes, 2 separately billed** - closed by the owner's constraint. Recorded as closed, not as unaffordable, and
  the human upload path remains.
- **1 no, UI only** - no supported route. Automating a UI by driving a browser is not a route this lane may take:
  it is unsupported by the provider, fragile in a way that would corrupt a research record, and it would put a
  credential in a script for no gain over a person pasting one prompt.
- **3 fails (needs a browser open)** - a person is still in the loop for the run itself, and the only automatable
  part is preparation: which stage is next, what the prompt is, whether the return is well formed. That is
  already what the page does.

## The queue, allowance and recovery work done now, without a route

The route decides whether a queue may ever be built; the invariants it must satisfy do not depend on the route,
so they are written now as acceptance criteria rather than as code. Writing the code first would mean writing an
adapter-shaped module with no verified caller, and the assignment forbids exactly that.

| Invariant (Interface E) | Failure it prevents | Test that would prove it, once a route exists |
| --- | --- | --- |
| Eligibility is derived from `/manifest` and the catalogue, never from a local queue file | A stale local queue picking a stage that is already delivered, or two runs picking the same stage | Two derivations from the same manifest return the same single stage; a manifest whose lowest stage is delivered returns the next one |
| Idempotency key `(chain_id, stage, prompt_sha256, parent_document_id, parent_version)` | A run that died after registering being uploaded twice under a new version | A re-dispatch of a key already present in the manifest is recorded as registered and uploads nothing |
| On quota or rate limit: pause, record `paused_allowance` with the provider's own words and a timestamp, resume only after a later probe succeeds | A retry loop burning an allowance, or a silent switch to another provider | A simulated refusal pauses the queue; a second dispatch attempt while paused does nothing; a successful probe resumes exactly one run |
| Restart recovery: re-derive from `/manifest`, reconcile the run log, never read an unreadable store as an empty library | Losing a delivered document, or overwriting it because the store looked empty | Restarting mid-run leaves the run log and manifest reconciled; an unreadable store blocks dispatch and reports unknown |
| A per-run record with chain, stage, prompt hash, parent document and version, session or model identifier, start and end, outcome, registration response and the read-back that matched it | A "verified" machine run that cannot be re-derived from its own evidence | Every field of the record is present for the pilot run, and the read-back re-computes the same hash and bytes |
| No substitute model and no alternate provider chosen silently | A result attributed to one product that another actually produced | The run record names the model or session, and a refusal to route to it fails the run instead of falling back |

## What this lane will not do

- It will not assert what Astra is beyond the owner's sentence, and it will not describe it as supported.
- It will not write an adapter, a scheduler, a credential path or a queue module before a route is confirmed.
- It will not drive a browser to extract a model's output, and it will not put a credential in a script, a
  prompt, a log or a chat.
- It will not report a machine run, a validated factor or a measured allowance. None of those has happened.

## What the owner needs to do, and nothing else

Answer the five checks above, in order, and send back one line per check. If 1 or 2 or 3 fails, the answer is
that the human upload path is the only route, and this lane's next deliverable becomes the run-log and
reconciliation prepared for a person, not a machine.

