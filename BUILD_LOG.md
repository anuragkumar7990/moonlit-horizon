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

- [ ] **Run Sheets setup**: `POST /api/setup-sheets` once after deploy. Response will list `created` and `skipped` tabs. Expected first-run output:
  ```json
  { "created": ["Calling","Calls","Targets","Tasks","Payments"], "skipped": [] }
  ```
- [ ] **Notes tab — add "Assigned To" column**: Insert column E (`Assigned To`) in the existing Notes tab, shifting old column E (`Created At`) to column F. Do this BEFORE Phase 2 agents go live. The `/api/setup-sheets` endpoint will warn if this is still missing.
- [ ] **Discord — create `#targets` channel** in the TTT Discord guild
- [ ] **Discord — create `#objectives` channel** in the TTT Discord guild
- [ ] **Install recharts** before Phase 1 Column V build: `npm install recharts`

### Known risks at end of Phase 0
- Existing pages (upload, book, client) were built against light theme and will look broken until they are rebuilt in Phase 1/1b. This is expected and acceptable.
- `lib/sheets.ts` still reads `Notes!A:E` (5 columns). Will need updating to `Notes!A:F` after the Assigned To column is added manually.

---

## Phase 1 — Master Tracker UI
**Date:** TBD  
**Status:** Pending

### Pre-flight checks
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `/api/setup-sheets` has been called and all 5 tabs exist
- [ ] recharts installed (`npm install recharts @types/recharts` — note: recharts ships its own types)

### Issues
_(none yet)_

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
| 3 | 0 | Discord channels `#targets` and `#objectives` not yet created | Pending manual action |
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
