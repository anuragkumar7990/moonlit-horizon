# Moonlit Horizon — Handover Document
**Last updated:** 2026-06-06  
**Latest commit:** `0b66e40` (main)  
**Live URL:** https://moonlit-horizon.vercel.app  
**VPS:** 72.61.126.30 (root) · pm2 process: `moonlit-bot`  
**Repo:** github.com/anuragkumar7990/moonlit-horizon

---

## 1. Overall Status vs Master Plan

| Phase | Status | Notes |
|---|---|---|
| **Phase 0 — Foundation** | ✅ Complete | Design tokens, Sheets tabs, Discord channels |
| **Phase 1 — Master Tracker UI** | ✅ Complete | 5-column grid, person selector, weekly/monthly toggle |
| **Phase 1b — Person Views** | ✅ Complete | All 4 views live with live data; Payments Pending still placeholder |
| **Phase 2 — Agent Layer** | ✅ Mostly complete | See below |
| **Phase 2b — Intelligence Layer** | ✅ Mostly complete | Weekly summary, targets bot, Circleback sync, Top-250 re-ranker all live |
| **Phase 3 — Supply Module** | ❌ Not started | Trainer sheets read and understood; dashboard build not started |
| **Phase 4 — People & Accounts** | ❌ Not started | — |

---

## 2. What Is Live Today

### Dashboard (Vercel — Next.js 14)

**Homepage `/`** — Master Tracker, 5 columns:
- **Calls**: Dialled / Connected / Meetings Booked — weekly/monthly toggle — targets from Sheets with gold glow — **data source: Zoho Calls + Sheets Calls merged, deduped by date+account**
- **Meetings**: L1 Booked / L1 Conducted / L2 Conducted — targets-aware — **data source: Meetings sheet** (Conducted auto-updated via Circleback webhook)
- **Leads**: Hot / Warm / Cold / Total — **data source: Zoho Deals by stage**
- **Pipeline**: Funnel by stage (count + amount) + Won/Lost — **data source: Zoho Deals**
- **Trends**: 8-week recharts line graph (dialled, connected, L1 booked, L1 conducted)
- **Weekly Summary card**: shows stored LLM bullets from Summaries sheet; falls back to Discord hint if empty

**Person views:**

| View | Route | What's live | What's placeholder |
|---|---|---|---|
| Mahesh | `/view/mahesh` | Won/Pipeline/Value; Funnel; This Week 6-stat grid; Leads; Weekly Summary (live LLM bullets) | Reports PDF links |
| Tanishq | `/view/tanishq` | Daily/Weekly/Monthly targets with gold glow; Today's Meetings; Follow-ups from Calls sheet | — |
| Ashutosh | `/view/ashutosh` | Leads H/W/C; Funnel; **Live Prospect DB Health** (total stock, weeks remaining, per-source breakdown, ⚠ warnings); **Live Pending Tasks** | Email Status, Objectives |
| Anurag | `/view/anurag` | Today's Meetings (scrollable); Funnel; **Live Pending Tasks**; Quick Links | Payments Pending, Objectives |

### Discord Bot (VPS — Node.js + discord.js)

**Slash commands live:**

| Command | What it does |
|---|---|
| `/book` | Book meeting with existing Zoho contact → Sheets + Google Calendar + Zoho Deal |
| `/book-prospect` | Convert Zoho lead → contact, book meeting |
| `/mh log call` | Log call → Sheets Calls tab + Zoho Calls module (bidirectional) |
| `/mh p0 add` | Add manual P0 task |
| `/mh p0 done` | Mark P0 task done (autocomplete from open tasks) |
| `/mh p0 today` | Re-post open P0 summary to `#p0-tasks` |
| `/mh stats weekly` | Generate + post LLM weekly summary to `#stats` |
| `/mh targets set <metric> <value>` | Set monthly target; updates pinned message in `#targets` |
| `/mh targets view` | Show current month targets + actuals (ephemeral) |
| `/mh briefing` | Post composite morning briefing to `#sales-ops`: calls + meetings + P0 tasks + hot pipeline |
| `/mh sync-meetings` | Explains Circleback webhook status (sync is automatic) |

**Scheduled jobs:**

| UTC cron | IST | Channel | Action |
|---|---|---|---|
| `0 3 * * *` | 8:30am daily | `#p0-tasks` | P0 task scan + post |
| `30 3 * * *` | 9:00am daily | `#stats` | Daily stats digest |
| `30 3 * * 0` | 9:00am Sunday | `#stats` | LLM weekly summary |
| `30 17 * * 0` | 11:00pm Sunday | `#stats` | Top-250 lead re-ranker |
| `30 1 1 * *` | 7:00am 1st of month | `#targets` | Monthly targets form (pinned) |
| `30 12 * * *` | 6:00pm daily | `#stats` | End-of-month review (fires only on last day) |

### APIs (Vercel routes, all behind Basic Auth)

| Route | Method | Purpose |
|---|---|---|
| `/api/p0-tasks` | GET | Scan + generate P0 tasks; write to Tasks sheet |
| `/api/p0-tasks` | POST | Add manual "Other" P0 task |
| `/api/p0-tasks/open` | GET | Open tasks (autocomplete cache) |
| `/api/p0-tasks/done` | POST | Mark task done |
| `/api/targets` | GET | Current month targets + live actuals |
| `/api/targets` | POST | Set a monthly target |
| `/api/weekly-summary` | GET | Latest stored LLM summary |
| `/api/weekly-summary` | POST | Generate new LLM summary + save |
| `/api/stats-digest` | GET | Full stats payload for daily digest |
| `/api/briefing` | GET | Composite briefing payload: today's meetings + calls + P0 tasks + hot pipeline + leads |
| `/api/log-call` | POST | Write call to Sheets + Zoho |
| `/api/book` | POST | Book meeting |
| `/api/book-prospect` | POST | Convert lead + book meeting |
| `/api/accounts` | GET | Zoho accounts (autocomplete) |
| `/api/contacts` | GET | Zoho contacts (autocomplete) |
| `/api/leads` | GET | Zoho leads (autocomplete) |
| `/api/upload-prospects` | POST | Bulk upload to Sheets + Zoho Leads |
| `/api/top-250` | POST | Score all Not Contacted leads, tag top 250 in Zoho, remove stale tags |
| `/api/circleback-sync` | POST | Receive Circleback webhook → match to Meetings sheet → mark Conducted |

---

## 3. Architecture

```
moonlit-horizon/
├── app/
│   ├── page.tsx                        Homepage server component (revalidate 60s)
│   ├── view/mahesh|tanishq|ashutosh|anurag/page.tsx
│   └── api/                            All API routes (see table above)
├── components/
│   ├── MasterTrackerGrid.tsx           5-column grid (client, holds toggle state)
│   ├── MetricCard.tsx                  label/achieved/target + gold glow
│   ├── FunnelColumn.tsx                Pipeline bars
│   ├── MetricsGraph.tsx                8-week recharts line chart (client)
│   ├── PersonSelector.tsx              M/A/A/T circles (client, usePathname)
│   └── TanishqDashboard.tsx            Daily/Weekly/Monthly toggle (client)
├── lib/
│   ├── zoho.ts                         Zoho OAuth + getDeals/Contacts/Accounts/Calls/createCall
│   │                                   + getAllLeadsForScoring/addTagToLeads/removeTagFromLeads
│   ├── sheets.ts                       Google Sheets read/write (all tabs)
│   │                                   + getProspects/updateMeetingConducted
│   ├── dashboard.ts                    Pure aggregation: mergeCallSources, buildCallsData,
│   │                                   buildMeetingsData, buildFunnel, buildLeadCounts,
│   │                                   buildWeeklyTrend, buildTanishqMetrics,
│   │                                   buildTodaysMeetings, buildFollowUps
│   └── types.ts                        TypeScript interfaces
└── discord-bot/
    ├── index.js                        Bot + all handlers + cron jobs
    └── register.js                     Discord command registration
```

### Google Sheets tabs in use

| Tab | Written by | Read by |
|---|---|---|
| Meetings | `/api/book`, `/api/book-prospect` | Dashboard, P0 tasks, weekly summary, briefing |
| Notes | Manual / Circleback (future) | P0 tasks (no-notes check) |
| Calls | `/api/log-call` | Dashboard, P0 tasks, weekly summary, briefing |
| Targets | `/api/targets` (via `/mh targets set`) | Dashboard, weekly summary, briefing |
| Tasks | `/api/p0-tasks` | Bot autocomplete, Anurag/Ashutosh views |
| Summaries | `/api/weekly-summary` | Homepage + Mahesh weekly summary card |
| Prospects | `/api/upload-prospects` | Ashutosh view (Prospect DB Health) |

### Key data rule
`mergeCallSources(sheetCalls, zohoCalls)` in `lib/dashboard.ts` — Zoho Calls is primary source; Sheet Calls supplement. Deduplication by `date:account.toLowerCase()`. This function is called in every page and API route that needs call data.

### Circleback Webhook
Circleback Automations → fires to `/api/circleback-sync` after every meeting where `trainings@thetesttribe.com` is an invitee. Endpoint extracts account name from meeting title ("The Test Tribe <> Account | Type"), fuzzy-matches to Meetings sheet row by account + date (25h window), sets status = "Conducted". Verified with `CIRCLEBACK_WEBHOOK_SECRET` (HMAC-SHA256, `x-signature` header).

### Top-250 Re-ranker
Sunday 11pm IST cron calls `/api/top-250` which scores all Zoho `Not Contacted` leads by:
- Authority from Designation (0–13 pts)
- Priority tag P1/P2/P3 from upload (0–10 pts)
- Lvl 1 Source quality (0–5 pts)

Tags top 250 with `#top250` in Zoho; removes tag from leads that fell out. Zero LLM tokens.

---

## 4. Known Data Gaps

| Gap | Root cause | Resolution |
|---|---|---|
| **L1/L2 Conducted** | Circleback webhook now live — will populate going forward | ✅ Fixed for new meetings; old meetings need manual backfill if needed |
| **Meetings Booked target = 0** | Fixed — re-set via `/mh targets set Meetings Booked <n>` | ✅ Done |
| **Notes tab "Assigned To" column** | Column added manually to Sheets | ✅ Done |
| **Test rows in Meetings sheet** | "Test / Test Test" entries | ✅ Deleted |

---

## 5. Known Issues / Watch List

| Issue | Severity | Action |
|---|---|---|
| No retry logic on Zoho 429 rate limit | Medium | Add exponential backoff in `lib/zoho.ts` `zohoGet()` |
| Sheets write failures are silent (only `console.error`) | Low | Add Discord alert to `#sales-ops` on failure |
| Dead code in `lib/zoho.ts`: `scoreLeadForDashboard()`, `getLeadsByStatus()` | Low | Safe to delete |
| pm2 restart count = 39 | Low | Non-critical; stale interaction timeouts |
| Zoho deals — some contacts unlinked (show `—` in P0) | Low | Link contacts to deals in Zoho CRM |

---

## 6. Immediate Action Items (before next build session)

1. **Circleback backfill**: Run the existing meetings through the sync manually if you want historical Conducted data — select all past meetings in Circleback → Actions → trigger the webhook automation
2. **Confirm Top-250 test**: Next Sunday 11pm IST the re-ranker fires automatically; verify `#top250` tags appear in Zoho
3. **Test `/mh briefing`**: Run it in Discord and confirm the `#sales-ops` post looks right

---

## 7. Next Steps (Priority Order)

### Priority 1 — Supply Module dashboard (Phase 3)
**Effort**: 3–4 hours  
Both trainer sheets have been read and understood. Structure:
- **Sheet A** (Outreach): pipeline stages Form Filled → Email Sent → WhatsApp → Meeting Booked → Meeting Conducted → Sample Taken → Onboarded. ~60 LinkedIn prospects tracked with connection/form status.
- **Sheet B** (Pricing & Scores): 30 scored trainers (Tier 1/2/3), topic → trainer mapping, customer pricing + trainer cost per tier, 100-pt scoring rubric.

Build: read both sheets → show pipeline stage counts, trainer roster by topic/tier, weeks-of-supply estimate. Surface on Ashutosh's view.

### Priority 2 — Payments Pending panel (Anurag view)
**Effort**: 1–2 hours  
Payments tab needs to exist in Sheets (currently not written). Either: add manual entry flow via Discord command, or build the tab structure and add a form. Panel placeholder exists in Anurag's view.

### Priority 3 — Objective tracking
**Effort**: 1 hour each  
`/objective update` and `/reminder` commands write to Tasks sheet with `type = 'Objective'`. Progress bars on Ashutosh + Anurag views.

### Priority 4 — Circleback → Notes tab sync
**Effort**: 2–3 hours  
Webhook already receives full meeting data including `notes` and `actionItems`. Extend `/api/circleback-sync` to also write to Notes tab: extract 2-3 action points per person, write to `Notes!A:F`.

### Priority 5 — Reports PDF (Phase 1b)
**Effort**: 3–4 hours  
Use `@react-pdf/renderer`. Weekly PDF auto-generated Sunday night, monthly on 1st. Download links on Mahesh/Ashutosh views. Decision: use `@react-pdf/renderer`.

### Priority 6 — People & Accounts module (Phase 4)
**Effort**: Full session  
Blocked on having enough Circleback data flowing first (needs ~2–3 weeks of webhook history).

---

## 8. VPS Operations

```bash
# SSH
ssh root@72.61.126.30   # password: Clawdbotanupass@123

# Check bot
pm2 status
pm2 logs moonlit-bot --lines 50 --nostream

# After a code push (no schema change)
cd /root/moonlit-horizon && git pull origin main && pm2 restart moonlit-bot

# After a slash command schema change (register.js edited)
cd /root/moonlit-horizon && git pull origin main
cd discord-bot && node register.js
pm2 restart moonlit-bot
```

---

## 9. Environment Variables

| Variable | Purpose |
|---|---|
| `ZOHO_CLIENT_ID / SECRET / REFRESH_TOKEN` | Zoho CRM API (India DC: zohoapis.in) |
| `GOOGLE_CLIENT_ID / SECRET / REFRESH_TOKEN` | Google Sheets + Google Calendar |
| `SHEETS_SPREADSHEET_ID` | The main Google Sheet |
| `DISCORD_BOT_TOKEN` | Discord bot login |
| `DISCORD_CLIENT_ID / GUILD_ID` | Command registration |
| `ANTHROPIC_API_KEY` | Claude Haiku (`claude-haiku-4-5-20251001`) for weekly summary |
| `DASHBOARD_PASSWORD` | Basic Auth for all `/api/*` routes |
| `VERCEL_URL` | Bot → Vercel API base URL |
| `CIRCLEBACK_WEBHOOK_SECRET` | HMAC-SHA256 signature verification for Circleback webhooks ✅ Added |

All set in Vercel Project Settings → Environment Variables **and** in `/root/moonlit-horizon/discord-bot/.env` on VPS.

---

## 10. Trainer Sheets (Phase 3 Reference)

**Sheet A — Trainer Outreach & Onboarding**  
ID: `1Xol3kb_5GDxS-Su-fAs1tIvTSLfGahNXWHv0MKUOY9I`  
Pipeline stages: Form Filled → Email Sent → WhatsApp Sent → Meeting Booked → Meeting Conducted → Sample Taken → Onboarded  
Form fields: Name, Email, Phone, Location, LinkedIn, Training Areas, Experience, Delivery Format, Languages, Video, Availability, Hourly Rate  
Outreach tracker: ~60 LinkedIn prospects with Connection Status + Form Status per row

**Sheet B — Trainer Pricing & Supply**  
ID: `1R8FqcifveekYZsaS3taHARaQAo3CjZ0FqdHnNOcZg2U`  
Contents: 30 scored trainers (Tier 1 = 70+, Tier 2 = 50–69, Tier 3 = <50), topic → trainer ranking, customer pricing by tier (e.g. Agentic AI Tier-1 = ₹15,000/hr), trainer cost by tier, 100-pt scoring rubric (Profile-Based 50 + Quality/Subjective 50)

---

## 11. Open Decisions

| Decision | Status |
|---|---|
| Reports PDF generation | Decided: `@react-pdf/renderer` |
| Ashutosh email status panel | Deferred — needs active email campaigns first |
| Anurag view finalization | Revisit after 2 weeks of real usage data |
| Supply Module (Phase 3) | Unblocked — trainer sheets read, build ready |
| People & Accounts (Phase 4) | Blocked on Circleback history accumulation (~2–3 weeks) |
