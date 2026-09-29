# Reply style rule (user instruction, 2026-09-29)

The user asked twice for brevity, second time bluntly: "simple answers god damn can you please update your
rules I dont have time to read these massive responses". This file is the in-scope record of the rule; the
same block is now in this worktree's `AGENTS.md` and `.clinerules/strategy.md`, which are the files loaded at
startup.

## The rule

1. **Max 3 bullets, about 50 words each, plain words.** No tables, no hashes, no file paths, no provenance, no
   jargon in a reply to the user. Enough context to be read on its own, not a page.
2. **Questions: one to two lines each, at most 7, each with a short reason or example.** If the user does not
   reply, the default is assumed and the work continues.
3. **Everything long goes in a file.** Evidence, numbers, decisions, open points and provenance belong in
   `docs/strategy/` and in the mailbox submission, never in the chat reply.
4. **If it will not fit, cut it.** Headline plus the file it lives in. The user reads the file only if they
   choose to.

## Why it exists

The batch-1 reply was seven numbered paragraphs with a table of twelve measured values; the user refused to
read it and asked for the rule change. The information was correct and is preserved in
`INTENT_QUESTIONS_ANSWER_SHEET_20260929.md` - the failure was purely the shape of the reply, so the fix is a
shape rule and not a content cut.

**Revision the same day.** The first version of this rule (25 words a bullet, questions with no explanation)
overshot: the user replied "this is too simple, give a little bit more context, as questions 1-2 lines max per
question". The rule above is that middle setting - short bullets that still carry a number and a cause, and
every question with a one-line reason so no question needs a follow-up explanation round.
