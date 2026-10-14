# The reply-style instruction to give the other windows (user request, 2026-10-14)

The user asked this window to produce an instruction he can hand to the other VS Code worker windows so they answer
him in the same short, plain shape this window uses: *"Also can you give me the instructions to the other VSCs so that
they reply to me in the condensed and simplifed format we speak here"*.

## The block to paste into each window

Copy everything between the lines, paste it as the next message in that window's task:

---

Rule change from me, 2026-10-14. Answer me like this from now on, in every window:

1. At most three short bullets, about fifty words each, in plain words.
2. No tables, no hashes, no file paths, no raw logs and no process jargon.
3. Anything long goes into a file in your own notes folder; name that file in one line if you need me to look.
4. Questions for me: a numbered list, one or two lines each, at most seven, each with a short reason; if I do not
   answer, use the default you stated and carry on.
5. Put this rule in your own startup notes so it survives a reload, and keep it for every later reply.

---

## Why it has to be pasted rather than sent

1. This project has no channel that pushes an instruction into another window. The mailbox carries submissions,
   replies and activity, and file notifications do not wake an idle agent session; only the user opening a window and
   sending a message does. So the user's own paste is the working route, and it takes one message per window.
2. Pasting is enough to make it stick: each worker's window keeps startup notes in its own worktree
   (`AGENTS.md`, `.clinerules/<lane>.md`), and step 5 of the block tells the worker to write the rule there itself.
   This window's copy sits in `AGENTS.md` and `.clinerules/strategy.md` beside the same block, which is how it has
   survived every reload since 2026-09-29.
3. It is a user instruction, so a worker may adopt it as written without a coordinator decision. The canonical copy of
   the rule is the coordinator's - its `strategy.md` assignment carries the adopted wording under "Reply style (user
   instruction, adopted canonically 2026-09-30)". This file reproduces the block verbatim so the coordinator can adopt
   it for every lane in one move, and so the wording cannot drift while the user pastes it around.

## Windows it should go to

Every worker window the user actually talks to. From the register on 2026-10-14, that is `strategy-2`, `gold-research`,
`live-trading`, `analysis-engine`, the seven `backtester-*` lanes, and the new `dashboard-design` window - which is
created with the block already in its startup notes, so it needs no paste. The three `agents/*` rows (`gbp`, `silver`,
`wti`, `eur-pairs`) are older status-only lanes; the paste costs one message each if the user wants them consistent.

## What this file is not

It is not a change to any other worker, assignment or canonical file, and it names nobody's authority but the user's.
The strategy lane wrote it in its own folder because the reply style is a user instruction about how workers answer
the user; acting on it elsewhere, or in another window, is the user's or the coordinator's move.
