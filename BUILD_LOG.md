# Moonlit Horizon — Build Log

Running log of issues, failures, decisions, and manual steps. Updated as the build progresses.

---

## Phase 0 — Foundation
**Date:** 2026-06-06  
**Status:** Complete

### Changes made
| File | Change |
|---|---|
| `tailwind.config.ts` | Added `mh.*` colour tokens, `poppins` font family, `shadow-gold`, `rounded-card` |
| `app/layout.tsx` | Poppins via `next/font/google`, dark nav, `max-w-[1440px]` container |
| `app/globals.css` | Dark CSS vars, `.card` utility, `.glow-gold` utility, dark scrollbar |
| `app/api/setup-sheets/route.ts` | One-time POST endpoint — creates Calling, Calls, Targets, Tasks, Payments tabs |

### Manual steps still required (Phase 0)

- [x] **Run Sheets setup**: created Calling, Calls, Targets, Tasks, Payments — commit 7ac53ad
- [x] **Notes tab — "Assigned To" column added** as column E; Created At shifted to F
- [x] **Discord — `#targets` created** under Text Channels (Augustus Bot Server)
- [x] **Discord — `#objectives` created** under Text Channels (Augustus Bot Server)
- [ ] **Install recharts** before Phase 1 Column V build: `npm install recharts`

### Known risks at end of Phase 0
- Existing pages (upload, book, client) were built against light theme and will look broken until they are rebuilt in Phase 1/1b. This is expected and acceptable.
- `lib/sheets.ts` still reads `Notes!A:E` (5 columns). Will need updating to `Notes!A:F` after the Assigned To column is added manually.

---

## Phase 1 — Master Tracker UI
**Date:** 2026-06-06  
**Status:** Complete (commit 99f013b)

### Pre-flight checks
- [x] TypeScript passes with zero errors (local)
- [x] `/api/setup-sheets` called — all 5 tabs exist
- [x] recharts installed and committed to package.json

### Issues
| # | Description | Fix | Commit |
|---|---|---|---|
| 1 | `recharts` not committed to package.json — Vercel build failed with "Can't resolve 'recharts'" | `git add package.json package-lock.json` + push | 99f013b |

**Rule added**: After `npm install <package>`, always commit `package.json` + `package-lock.json` in the same push.

---

## Phase 1b — Person Views UI
**Date:** TBD  
**Status:** Pending

### Issues
_(none yet)_

---

## Phase 2 — Agent Layer
**Date:** TBD  
**Status:** Pending

### Issues
_(none yet)_

---

## Phase 2b — Intelligence Layer
**Date:** TBD  
**Status:** Pending

### Issues
_(none yet)_

---

## Phase 3 — Supply Module
**Date:** TBD  
**Status:** Pending

**Blocked on:** User to share Google Form link and Trainers Sheets structure before build begins.

### Issues
_(none yet)_

---

## Phase 4 — People & Accounts Module
**Date:** TBD  
**Status:** Pending

### Issues
_(none yet)_

---

## Open Failures / Unresolved Issues

| # | Phase | Description | Status |
|---|---|---|---|
| 1 | 0 | Notes tab missing "Assigned To" column — manual step required before Phase 2 | Pending manual action |
| 2 | 0 | `lib/sheets.ts` `getNotes()` reads `Notes!A:E` — must update to `A:F` after column is added | Pending |
| 3 | 0 | Discord channels `#targets` and `#objectives` not yet created | ✅ Done |
| 4 | 1 | recharts not yet installed — required before Column V metrics graph | Pending `npm install` |

---

## Integration Failure Reference (from MOONLIT_HORIZON_MASTER.md §15)

| Integration | Common Failure | Recovery |
|---|---|---|
| Zoho CRM | 401 Unauthorized | Auto-refresh via `_tokenCache`; token refreshed on next request |
| Zoho CRM | 429 Rate Limit | Exponential backoff, max 3 retries — **not yet implemented** |
| Google Sheets | 403 Forbidden | OAuth refresh; if refresh fails → Discord alert to `#sales-ops` — **not yet implemented** |
| Sheets write failure | Silent failure | Currently only `console.error` — **no Discord alert yet** |
| Discord bot crash | Process exits | `pm2` setup on VPS — **not yet done** |
| Vercel build | TypeScript error | Fix then redeploy from GitHub SHA |
| Vercel deploy | Stuck/Queued >10min | Cancel all queued, redeploy latest SHA |
