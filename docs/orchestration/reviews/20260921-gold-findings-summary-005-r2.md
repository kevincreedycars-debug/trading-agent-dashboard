# Gold findings digest revision 2 review

Reviewed 2026-09-21. Submission: 20260920-gold-findings-summary-005-r2.
Decision: changes requested (documentation classification only).

Verified registered worker branch, clean HEAD abad397, and documentation-only diff from accepted dd657c5. Digest SHA-256 reproduces 2f9d24847f794053b1d489da1d271ac6c13e186446d283a7f83c247b55641ae2; source artifact declares accepted content hash c588367de9aef770015a57a474c4a737647d0f6852503662129716174100cab4. Independent direct artifact traversal reproduces pooled-sign totals 47/29/314, 48/21/298 and 6/50/231.

Remaining defect: between-year classification only excludes zero supported years, so a single supported year contributes to same_sign despite the prose saying it cannot demonstrate across-year consistency. Require at least two supported years. Correct between-year same/differ/not-assessable totals including unavailable states are pooled 43/27/320, exact 41/21/305 and delayed 6/50/231. Six pooled and seven exact single-year states must move to not-assessable; pooled-sign comparisons remain unchanged. Apply to digest, companion and generators, including conditioning cells.

Also narrow the reproduction scope wording: primary-horizon traversal describes consistency/conditioning counts, whereas the baseline table explicitly covers four horizons. Remove the unverified two-to-three-page assertion.

No measurement code changed or tests rerun: verification was a read-only independent artifact traversal and Git/hash inspection. Underlying report remains accepted for exploratory use; no integration or deployment. Phase 1 coverage remains proposed, not assigned. All six inboxes checked: no validation errors; Strategy already acknowledged; GBP, Silver, WTI and EUR-pairs have no submissions.
