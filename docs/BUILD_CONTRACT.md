# Build contract

Copied from PRD §16. Binding for anyone (human or agent) changing this repo.

1. Implement feature IDs FR-01…FR-15 in dependency order. **Never replace a failed PayBox call with a mocked successful call in a submission route.**
2. User-facing statuses, job IDs, payments, durations and findings must derive from persisted events or records; never hard-code favorable outputs.
3. The known synthetic defect is a controlled fixture. Mark fixture condition in reports, video and README.
4. Store and inspect raw failure cases. Broken/blocked/unsupported paths must remain visible.
5. Use exact observed PayBox and x402 SDK request/response data; update §§6–7 when actual tool schemas contradict this PRD.
6. Build only enough UI to make the real browser result obvious. Report screen before decorative landing sections.
7. The same signed/verified paid request must not duplicate a job on retry. Never ask the agent for raw credential material.
8. Keep deploy/worker cost bounded, browser network restricted and targets approved.
9. All external dependencies are pinned with versions and documented; CI runs lint, typecheck, unit, smoke and baseline security tests.
10. Commit in increments with clear descriptions; create `docs/INTEGRATION_FINDINGS.md` and `docs/EVIDENCE_INDEX.md` while working.
11. At the feature freeze, stop scope growth; re-run only the judge-facing paths and prepare the video/required submission.
12. Report uncertainty plainly. If a necessary sponsor capability remains unavailable, preserve partial evidence but do not assert the Chapter 1 plugin requirement was satisfied.

