# Does the single-publisher queue model make sense? An advisory answer

Written 2026-10-03 by worker `strategy` (`strategy-advisory-001`) at the user's question, verbatim: *"also do it make
sense that the coordinator is the only thing that can push changes and it has a queue that it reviews and looks at how to
most efficiently do certain tasks"*. Advice only: no authority changes, no model changes, nothing adopted by writing this.

**Short answer: yes to one publisher, yes to a queue, and the useful part is what the queue should *not* do.** One hand on
production is the right shape for a site whose whole value is that every published number is defensible. A queue that
reviews *how* to do work - order, route, batching - earns its cost. A queue that also waits for a hand on work that cannot
reach production, or that turns a routine cadence into a fresh decision each time, buys waiting for nothing.

## 1. Why one publisher is right here

- **A published page is a promise, and promises need one author.** A change to this site is usually several files moving
  together - a page, its template, its builder, its guard, sometimes a pin - and a half-applied change is worse than no
  change. One hand makes the set atomic.
- **Provenance stays answerable.** When someone asks "who put this number on the page, from what, and how do I undo it",
  there is one place the answer lives. With two writers, that question becomes an audit.
- **Guards are only worth what the pushed bytes are.** The project already holds the rule that *acceptance is not
  integration and not production*; a single publishing step is what makes that distinction enforceable rather than
  aspirational.
- **It matches how the work is actually funded.** A background lane can verify, research and draft without touching
  production; the coordinator's review is the toll gate. That is cheap insurance compared with a wrong figure in front of
  the user.

## 2. What it costs, measured in this project

- **Waiting.** Today's clearest example: the data panel is still showing the 2026-10-02T07:29Z reading. The user's
  go-ahead for a refresh is on record and acknowledged, the item is ready, and it has sat in the queue because it needs
  the interactive coordinator's hand. Nothing about the change is risky; the latency is the model's, not the work's.
- **Drift between what is served and what the tree believes.** Production `main` carries a four-entry top bar; the
  canonical tree's `index.html` still carries six entries and is one release behind, so three guards pass against a bar
  nobody is served and the release's most visible bar change is guarded by nothing. When the only writer is intermittently
  present, the mirror silently becomes fiction - and the green suite hides it.
- **The queue bundles unrelated decisions.** Several lanes finishing in one day land in one review (today a second,
  concurrent run reviewed the same filing), so a routed question and a trivial docs append can wait on each other.

## 3. Where "it reviews how to do tasks most efficiently" earns its keep

- **Route choice.** N1 (inject one partial) versus N2 (a shared script) versus N3 (hand-paste) is a decision with real
  consequences - guard breakage, drift, offline rendering - and it is cheaper to make once, centrally, than nine times.
- **Ordering by coupling.** Release before nav, mirror before nav, guard before push: order can remove rework entirely,
  and that judgement is exactly what a reviewer with the whole board in view is good at.
- **Refusing re-introductions.** A change that would quietly restore a bar entry a release removed, or a file a fix
  retired, is only visible to someone comparing against what was already published.
- **Batching by file.** Two queued items touching `index.html` should be one change, not two pushes and two guard runs.

## 4. Where the queue does not earn its keep

- **Zero-risk work waiting on a hand.** Notes, evidence, plans and measurements cannot reach production at all. Queuing
  those behind the publisher's hand buys latency and no safety.
- **A cadence turned into a decision.** "Should I publish now?" does not need deciding each time; "drain everything ready
  when I wake" is a rule, and rules do not queue.
- **A single reviewer as a single point of failure.** When one reviewer is the only route, one absence stops the site -
  which is roughly what today's stale panel is.

## 5. What I would change, and what I would not

1. **Keep one publisher, make publishing a cadence**: every time the coordinator wakes, it drains whatever is ready -
   no per-item deliberation about whether to act.
2. **Pre-authorise the lanes that cannot reach production** (docs, evidence, measurement, planning) so their output stops
   waiting for a production hand. Their branches never touch a served file, so nothing is risked.
3. **Batch by file**: one change for everything queued against the same page, stylesheet or script.
4. **Make a served-state check part of acceptance**: "does the tree match what is published today?" would have caught the
   bar drift before it aged.
5. **Keep the reviewer separate from the hand only for production changes** - verification by one, publication by another,
   is worth the friction exactly there and pointless elsewhere.
6. **Not change**: the user's word remains the source of priority, and the coordinator's queue is a scheduling device, not
   an authority. No worker gains a push right from this note, and none is proposed without the user's decision.

## 6. Provenance

- Stale panel: `origin/main` `data/layer1.json` `last_updated_et` `2026-10-02T07:29:28.874Z`, read 2026-10-03; the
  authority for a refresh is the user's go-ahead recorded in the `-036` review and acknowledged in the `-038` reply.
- Bar drift: production `index.html` at `origin/main` `f8bc80f` carries four bar entries; the canonical checkout on
  `orchestration/control-plane-20260920` at `30d853b` does not contain `2f25c8c` and its `index.html` still carries six.
  Detail and the three affected guards are in `COORDINATOR_NAV_TIDY_HANDOVER_20261003.md`, sections 4 and 13.
- Concurrent review of one filing: the `-038` reply (accepted, 15:38) and the second run recorded in
  `CONVERSATION_NOTES.md`.
