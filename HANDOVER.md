# Moonlit Horizon — Handover Document
**Last updated**: 2026-06-06  
**Status**: Phase 1 + Phase 1b complete. Phase 2 — Call Logger, Daily Digest, P0 Task Generator all live.

---

## What's Been Built

### Phase 0 — Foundation ✅
- Tailwind design tokens: `mh.bg`, `mh.surface`, `mh.surface2`, `mh.border`, `mh.text`, `mh.muted`, `mh.vermillion`, `mh.gold`, `mh.positive`, `mh.negative`
- Poppins font via `next/font/google`, CSS variable `--font-poppins`
- Dark layout in `app/layout.tsx` with vermillion CTA nav
- Google Sheets tabs created via `/api/setup-sheets`: Calling, Calls, Targets, Tasks, Payments
- Discord channels created: `#targets`, `#objectives`

### Phase 1 — Master Tracker Homepage ✅
**Route**: `/`  
**File**: `app/page.tsx` → `components/MasterTrackerGrid.tsx`

5-column grid:
- **Calls**: Dialled / Connected / Mtgs Booked — Weekly/Monthly toggle, targets from Sheets, gold glow if achieved ≥ target
- **Meetings**: L1 Booked / L1 Conducted / L2 Conducted — same toggle + targets
- **Leads**: Hot (Negotiation + Payment Pending) / Warm (DC Conducted + Outline) / Cold (DC Booked) — from Zoho Deals
- **Pipeline**: Funnel bars for active stages, Won (gold trophy button) / Lost (red thumbs-down button)
- **Trends**: Recharts line chart with filter tabs (Calls / Meetings / Lead Conversion / Emails), custom legend (Recharts v3 bug workaround)

Below grid: Weekly Summary placeholder + Monthly Summary placeholder

**Data flow**: `Promise.allSettled([getCalls, getMeetings, getDeals, getTargets])` → pure aggregation in `lib/dashboard.ts` → passed as props to client component

### Phase 1b — Four Person Views ✅

| View | Route | Key content |
|---|---|---|
| Mahesh | `/view/mahesh` | Won/Pipeline/Value hero cards, Funnel, This Week stats (6 metrics), Leads H/W/C, Summary + Reports placeholders |
| Ashutosh | `/view/ashutosh` | Leads H/W/C, Funnel, Prospect DB Health skeleton (7 sources), Email Status + Tasks + Objectives placeholders |
| Anurag | `/view/anurag` | Meetings Today (scrollable, max-h-80), Pending Tasks placeholder, Funnel, Payments placeholder, Quick Links grid |
| Tanishq | `/view/tanishq` | Daily/Weekly/Monthly targets toggle, 3 metric cards with gold glow, Meetings Today (scrollable), Follow-ups Today, Prospects placeholder |

PersonSelector (M/A/A/T circles) at top of every page — active = vermillion ring.

---

## File Map

```
app/
  page.tsx                        — Homepage (server, fetches all data)
  layout.tsx                      — Poppins, dark bg, nav
  globals.css                     — CSS vars, .card, .glow-gold, scrollbar
  api/
    setup-sheets/route.ts         — One-time POST: creates 5 Sheets tabs
  view/
    mahesh/page.tsx               — Mahesh view (server)
    ashutosh/page.tsx             — Ashutosh view (server)
    anurag/page.tsx               — Anurag view (server)
    tanishq/page.tsx              — Tanishq view (server → TanishqDashboard client)

components/
  MasterTrackerGrid.tsx           — 5-column homepage grid (client, holds toggle state)
  MetricCard.tsx                  — label / achieved / target card with gold glow
  MetricsGraph.tsx                — Recharts LineChart with custom legend (client)
  FunnelColumn.tsx                — Pipeline bars + Won/Lost SVG buttons
  PersonSelector.tsx              — M/A/A/T nav circles (client, uses usePathname)
  TanishqDashboard.tsx            — Tanishq's Daily/Weekly/Monthly toggle (client)

lib/
  dashboard.ts                    — ALL aggregation logic (no API calls):
                                    buildCallsData, buildMeetingsData,
                                    buildLeadCounts, buildFunnel,
                                    buildWeeklyTrend,
                                    buildTanishqMetrics, buildTodaysMeetings,
                                    buildFollowUps
  sheets.ts                       — Google Sheets reads: getMeetings, getNotes,
                                    getCalls, getTargets, getCommunications,
                                    getAccounts, appendProspectRows
  zoho.ts                         — Zoho CRM: getDeals, getLeads (getLeads unused)
  types.ts                        — All TypeScript interfaces
  
tailwind.config.ts                — mh.* design tokens + Poppins font family
BUILD_LOG.md                      — Running log of failures and fixes
MOONLIT_HORIZON_MASTER.md         — Full system spec and build roadmap
```

---

## Key Technical Decisions

1. **Single `getDeals()` call** reused for both `buildFunnel()` and `buildLeadCounts()` — avoids duplicate Zoho API call
2. **`Promise.allSettled`** on all data fetches — page renders even if one source fails
3. **Recharts Legend bug**: Recharts v3 ignores JSX order for `<Legend>`. Fix: removed `<Legend>` entirely, replaced with a hand-rolled div using `LEGEND_ITEMS` constant
4. **Lead temperature** is deal-stage-based (not Zoho Lead scoring):
   - Hot = Negotiation, Payment Pending
   - Warm = Discovery Call Conducted, Outline Meeting Conducted
   - Cold = Discovery Call Booked
5. **SVG icons** for Won/Lost buttons — emoji rendered incorrectly on Vercel server
6. **Zoho DC**: India datacenter `zohoapis.in`, API v3

---

## Targets Sheet Format

**Tab**: `Targets`  
**Columns**: Month (A) | Metric Name (B) | Target Value (C) | Actual Value (D)

Month must be **plain text** `2026-06` format (NOT a date cell). Code uses `format(new Date(), 'yyyy-MM')` for lookup.

Current June 2026 targets set:
| Metric Name | Target |
|---|---|
| Calls Dialled | 1250 |
| Calls Connected | 600 |
| L1 Meetings Booked | 60 |
| L1 Meetings Conducted | 50 |
| L2 Meetings Conducted | 30 |

Weekly targets auto-derived as `monthly ÷ 4`. Daily targets as `monthly ÷ 22`.

---

## Phase 2 — What's Been Built

### 2a — Call Logger (`/mh log call`) ✅
**Slash command**: `/mh log call`  
**API**: `POST /api/log-call`  
**Sheet**: Calls tab (14 columns: Date, Time, Account, Contact Name, Contact Phone, SDR, Duration, Outcome, Notes, Zoho Call ID, Follow-up Date, Recording Drive Link, Transcript Summary, Auto Tags)

Flow: user selects Type (Prospect/Contact) → Name (autocomplete, context-aware) → Outcome → optional Account/Phone/Notes/Follow-up. Bot reads from Zoho Leads or Contacts cache, resolves account + phone automatically. Posts confirmation ephemeral reply.

### 2b — Daily Stats Digest ✅
**Cron**: every day 3:30am UTC (9:00am IST)  
**API**: `GET /api/stats-digest`  
**Channel**: `#stats`

Posts: Calls Today (Dialled/Connected/Booked), This Week (Calls + Meetings), Pipeline (Hot/Warm/Cold), Funnel, Won/Lost. Manual trigger: `node discord-bot/test-digest.js` on VPS.

### 2c — P0 Task Generator ✅
**Cron**: every day 3:00am UTC (8:30am IST)  
**API**: `GET /api/p0-tasks` (scanner), `POST /api/p0-tasks` (manual add), `DELETE /api/p0-tasks` (clear, test utility)  
**Supporting**: `GET /api/p0-tasks/open` (for autocomplete), `POST /api/p0-tasks/done` (mark done)  
**Channel**: `#p0-tasks`  
**Sheet**: Tasks tab (7 columns: Date, Task, Type, Assigned To, Linked Deal, Status, Completed At)

Scans 4 issue types every morning:
1. **Meetings without notes** — meetings 24–72h old with no Notes sheet entry → assigned Tanishq
2. **Overdue closing dates** — active deals past their Zoho closing date → assigned Anurag
3. **Overdue callbacks** — calls logged as "callback later" with past follow-up date → assigned Tanishq
4. **Stale deals by stage** — no call logged for account within threshold:
   - Payment Pending: 2 days → Tanishq
   - Negotiation: 3 days → Tanishq
   - Outline Meeting Conducted: 5 days → Anurag
   - Discovery Call Conducted: 5 days → Anurag

**Dedup**: tasks use `linkedDeal` key + per-task recurrence window (not just "once today"). Stale-deal tasks recur every N days matching their threshold.

**Discord commands**:
- `/mh p0 add` — add manual Other task, optional account + contact autocomplete
- `/mh p0 done` — mark task done via autocomplete (shows today's open tasks), updates Tasks sheet Status + CompletedAt

**Message format** (grouped):
```
📞 Follow-up calls to be made (N) — Tanishq
N. ContactName, Account (Stage) — DealName · DD/MM/YY

📋 Outlines to be sent (N) — Anurag
📄 Proposals to be sent (N) — Anurag
🗂️ Others (N) — Anurag
🔁 Overdue callbacks (N) — Tanishq
📝 Meeting notes pending (N) — Tanishq
📅 Overdue closing dates (N) — Anurag
```

Splits into multiple Discord messages if over 1900 chars. Manual trigger: `node discord-bot/test-p0.js` on VPS.

---

## File Map (Updated)

```
app/api/
  log-call/route.ts               — POST: write call to Calls sheet
  stats-digest/route.ts           — GET: aggregate metrics for digest
  p0-tasks/route.ts               — GET: scan + write P0 tasks; POST: manual add; DELETE: clear
  p0-tasks/open/route.ts          — GET: today's open P0 tasks (for autocomplete)
  p0-tasks/done/route.ts          — POST: mark task done by linkedDeal key

lib/
  sheets.ts                       — Added: appendCallRow, getTasks, appendTaskRows,
                                    updateTaskStatus, clearTasksSheet
  types.ts                        — Added: Task interface

discord-bot/
  index.js                        — Added: /mh log call, /mh p0 add, /mh p0 done handlers;
                                    buildDigestMessage, postDailyDigest, buildP0Message,
                                    postP0Tasks, splitIntoChunks; node-cron schedules
  register.js                     — Added: /mh command with p0 + log subcommand groups
  test-digest.js                  — Manual trigger for daily digest
  test-p0.js                      — Manual trigger for P0 task post
```

---

## Known Issues / Pending Cleanup

1. **Test meeting rows** — Meetings sheet has "Test / Test Test" entries. Delete when ready.
2. **Dead code** in `lib/zoho.ts` — `scoreLeadForDashboard()` and `getLeadsByStatus()` are no longer called. Safe to delete.
3. **Pagination** — `getDeals()` fetches `per_page=200`. Note if deals exceed 200.
4. **Zoho Contact Name gap** — Most active deals have no `Contact_Name` linked. P0 tasks show `—` for contact. Fix by linking contacts to deals in Zoho CRM. See Section 18 of MOONLIT_HORIZON_MASTER.md for full list.
5. **Zoho deals to close**: Qualizeal and Vivriti Capital deals should be moved to Lost. Betterworks - AI in PM should be moved from Negotiation to Outline Meeting Conducted.
6. **Closing dates** — Many active deals have past closing dates (triggering daily overdue tasks). Update in Zoho.
7. **`DeprecationWarning: ready event`** — appears in bot error log from older pm2 instances. Harmless; the bot uses `clientReady` correctly in latest code.

---

## What's Next — Phase 2 Agent Layer

Priority order (highest ROI first):

### 1. Call Logger (Discord → Sheets + Zoho)
`/mh log call` slash command — prompts for account, outcome, notes → writes row to Calls sheet → updates Zoho deal stage if applicable  
**Impact**: Dialled/Connected numbers become real immediately

### 2. #targets bot
On 1st of each month: posts structured form to `#targets` channel asking for monthly targets → writes responses to Targets sheet → pins message  
**Impact**: Targets auto-set without manual Sheets editing

### 3. Daily Stats Digest
Every day at 9am IST: pulls aggregated data → posts to `#stats`  
**Impact**: Team sees daily snapshot in Discord without opening the dashboard

### 4. P0 Task Generator
Every morning 8:30am IST: scans for meetings with no follow-up (>24h), stale deals, overdue proposals → creates tasks in Tasks sheet → posts to `#p0-tasks`  
**Impact**: Nothing falls through the cracks

### 5. Weekly Summary Generator (LLM)
Every Sunday: pulls all data → sends to Claude → 5-bullet summary → posts to `#stats` + appears on homepage  
**Impact**: Replaces "coming in Phase 2" placeholder on homepage

---

## Deployment

- **Platform**: Vercel
- **Repo**: `github.com/anuragkumar7990/moonlit-horizon`
- **Branch**: `main` → auto-deploys on push
- **Revalidation**: `export const revalidate = 60` on all pages (60s ISR)
- **Env vars on Vercel**: `SHEETS_SPREADSHEET_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`

---

## Recent Commits (Phase 1b session)
| Hash | Message |
|---|---|
| `448e010` | fix: standardise meetings booked target key to L1 Meetings Booked |
| `021a946` | fix: cap meetings list height to 320px with scroll |
| `c02390c` | feat: Phase 1b — build all four person views |
| `52a3e3b` | fix: replace emoji with SVG icons for Won/Lost buttons |
| `e58c2f9` | fix: stage-based lead scoring, correct funnel order, remove Lost from funnel |
