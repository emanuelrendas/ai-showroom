# M3 — Phase 11 evidence index and Phase 12 reconciliation (06 Oct 2026)

**Tested implementation SHA:** `9a1c430b2d78e3511585b37616d97b14ce796fac`  
**Branch:** `feature/milestone-3-router-product-experience`  
**Canonical M3 docs commit:** `dcee3f6afc760d552e8638e562424fa8db4cf7de`  
**Prepared by:** docs-only acceptance reconciliation mission, 06 Oct 2026. Emanuel's P12-F1 Option A ratification and sole-Writer authorization were issued 06 Oct 2026, 16:17 GST (Writer-recorded receipt time); see `docs/acceptance/milestone-3.md`, Ratification section.

## Custody statement

Raw Phase 11 output is not in custody. No raw evidence files were fabricated or reconstructed.

This index records what was reported, what was independently reproduced, and what is not in custody. It upgrades nothing. Acceptance dispositions live in `docs/acceptance/milestone-3.md`.

## Phase 11 command/result index

Label for every row: `REPORTED / RECONCILED — RAW OUTPUT NOT IN CUSTODY`

| Item | Reported Phase 11 result |
|---|---|
| `npm run test:rls` | 39/39 PASS |
| `npm run test:e2e` | 6 passed / 1 expected live-Gemini skip |
| Manual product matrix | completed |
| Provider-error fixtures | 8/8 PASS |
| Router-refusal fixture | 1/1 PASS |
| Deterministic HITL: generate → pending review → explicit human Approve → DB verification | PASS |

## Phase 12 independently reproduced results

Phase 12 independent audit, 06 Oct 2026, clean context, Claude Opus 5.5, High effort, at `9a1c430b2d78e3511585b37616d97b14ce796fac`. Audit verdict: `CONDITIONAL` (governance/evidence custody gaps, not executable-code defects).

| Command | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 errors / 6 warnings |
| `npm test` | PASS, 406/406 (first audit attempt) |
| `npm run test:component` | PASS, 37/37 |
| `npm run build` | PASS using Next's official Google Fonts mocked-response mechanism |

Not independently reproduced by the auditor: `npm run test:rls`, `npm run test:e2e`, full manual product matrix.

## Environment notes

- Audit sandbox blocked container registries and Playwright downloads, so RLS (local Supabase) and E2E could not be re-run.
- Audit sandbox blocked `fonts.googleapis.com`. The build passed on unmodified source using Next's official Google Fonts mocked-response mechanism.
- One live provider profile remains: `gemini-3.6-flash`. Synthetic profiles are test-only.

## P11-F9 history

- Earlier ENOMEM/load-sensitive failures occurred.
- One documented Phase 11 retry passed 406/406.
- The Phase 12 independent audit separately passed 406/406 on its first attempt.
- The independent audit does not erase the earlier history. P11-F9 is retained as execution history, not an active product defect.

## CI reference

GitHub Actions workflow `CI`, run #12 (attempt 1, event `push`), conclusion `success`, head SHA `9a1c430b2d78e3511585b37616d97b14ce796fac`, branch `feature/milestone-3-router-product-experience`:

https://github.com/emanuelrendas/ai-showroom/actions/runs/37297690216

## UX custody table

Both artifacts are committed byte-for-byte. Wrappers, citation tokens and line endings are untouched.

| Artifact name | Auditor intake SHA256 | Writer receipt SHA256 | Committed SHA256 | Byte size | Repository path | Note |
|---|---|---|---|---|---|---|
| AI-Showroom-M3-UX-01-Design-Constitution-Project-Artifact.txt | `3858071d1c101c04e3ee689c08fd158a2d11ff1ccfcf27e101fb4134eb17a8c4` | `3858071d1c101c04e3ee689c08fd158a2d11ff1ccfcf27e101fb4134eb17a8c4` | `3858071d1c101c04e3ee689c08fd158a2d11ff1ccfcf27e101fb4134eb17a8c4` | 22,967 | `docs/m3/ux/AI-Showroom-M3-UX-01-Design-Constitution-Project-Artifact.txt` | ChatGPT Project artifact export, includes conversational wrapper. |
| AI-Showroom-M3-UX-02-Motion-Constitution-Project-Artifact.txt | `1aeee6ae60ab3944062673afe8bddaf89110699f0ab49f62f0ab629a5baf8b7a` | `1aeee6ae60ab3944062673afe8bddaf89110699f0ab49f62f0ab629a5baf8b7a` | `1aeee6ae60ab3944062673afe8bddaf89110699f0ab49f62f0ab629a5baf8b7a` | 21,123 | `docs/m3/ux/AI-Showroom-M3-UX-02-Motion-Constitution-Project-Artifact.txt` | ChatGPT Project artifact export, includes conversational wrapper. |

Custody notes:

- Repository `.gitattributes` is `* text=auto eol=lf`. Both files contain zero CR bytes, so no normalization applies; a git blob round-trip reproduced the intake SHA256 for both (FIND-T2-005 check).
- UX-01 header: `CANDIDATE V1 — FOR TIAGO REVIEW`. UX-02 header: `CANDIDATE V1 — FOR TIAGO REVIEW`. Neither file is a historical acceptance record.
- The canonical `M3-UX-00-UI-AUDIT.md` is not in custody and was not reconstructed.
