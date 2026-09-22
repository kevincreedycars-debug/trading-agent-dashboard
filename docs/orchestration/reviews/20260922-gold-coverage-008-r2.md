# Coverage-008 revision 2 accepted - 2026-09-22

Submission 20260921-gold-coverage-008-r2, SHA-256
c31c22b9123d38a59ff167e442e19c88a48f1997560f7f80430a7f2b39369d4f.
Clean worker HEAD de775b5 on the registered branch. Diff from 35e8384 changes
one Markdown file, eight additions and three deletions. No executable changes.

Independently ran the inspected worker-local r5 renderer against the unchanged
008 and 006 reports into new coordinator-r2 output files. Digest SHA-256
4a7cfef43b7510bb73341f36ed26bd3ae4c9d218f1af005f3b2e2f5449bcd7a2
matches committed digest byte-for-byte. Companion SHA-256
fa6ff8eb2631208a48e8043a3d7f7a854f1d6b3ac36ba060da57ebff786a983b
matches revision 1. Unchanged report raw SHA-256
eefe27aa4942a77a14542e7e0f371019a81162ff9092d3df9d88fd52bb66ac60.
Diff whitespace check passed. No suite rerun for this prose-only revision;
70 focused and 410 full tests are prior revision-1 evidence, not new results.

The digest now correctly identifies the L2L 2025-10-01 through 2026-04-30
period as consumed and ineligible as a fresh test; no future holdout reserved.
Accepted exploratory checkpoint, 21/28 variables, no integration or deployment.
Ignored generator durability is addressed by new gold-reporting-009, alongside
a bounded next-stage protocol proposal. No new measurements or combinations yet.
