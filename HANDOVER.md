# Moonlit Horizon — Handover Document
**Last updated:** 2026-06-06  
**Latest commit:** `973a9ac` (main)  
**Live URL:** https://moonlit-horizon.vercel.app  
**VPS:** 72.61.126.30 (root) · pm2 process: `moonlit-bot`  
**Repo:** github.com/anuragkumar7990/moonlit-horizon

---

## 1. Overall Status vs Master Plan

| Phase | Status | Notes |
|---|---|---|
| **Phase 0 — Foundation** | ✅ Complete | Design tokens, Sheets tabs, Discord channels |
| **Phase 1 — Master Tracker UI** | ✅ Complete | 5-column grid, person selector, weekly/monthly toggle |
| **Phase 1b — Person Views** | ✅ Complete | All 4 views live, all panels populated |
| **Phase 2 — Agent Layer** | ✅ Complete | All slash commands live |
| **Phase 2b — Intelligence Layer** | ✅ Complete | Weekly summary, targets, Circleback sync, Top-250, Objectives |
| **Phase 3 — Supply Module** | ✅ Complete | Trainer pipeline, roster, topic coverage on Ashutosh view |
| **Phase 4 — People & Accounts** | ❌ Not started | Blocked on ~2–3 weeks of Circleback history |

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

| View | Route | What's live |
|---|---|---|
| Mahesh | `/view/mahesh` | Won/Pipeline/Value; Funnel; This Week 6-stat grid; Leads; Weekly Summary; **Weekly + Monthly PDF links** |
| Tanishq | `/view/tanishq` | Daily/Weekly/Monthly targets with gold glow; Today's Meetings; Follow-ups from Calls sheet |
| Ashutosh | `/view/ashutosh` | Leads H/W/C; Funnel; Prospect DB Health; Email Status placeholder; Pending Tasks; **Objective Progress bars**; **Trainer Supply (pipeline + roster + topic coverage)**; Monthly PDF link |
| Anurag | `/view/anurag` | Today's Meetings; Funnel; Pending Tasks; **Payments Pending**; **Objective Progress bars**; Quick Links; Weekly + Monthly PDF links |

### Discord Bot (VPS — Node.js + discord.js)

**Slash commands live:**

| Command | What it does |
|---|---|
| `/book` | Book meeting with existing Zoho contact → Sheets + Google Calendar + Zoho Deal |
| `/book-prospect` | Convert Zoho lead → contact, book meeting |
| `/mh log call` | Log call → Sheets Calls tab + Zoho Calls module |
| `/mh log payment` | Log invoice → Payments sheet; status defaults to Invoiced |
| `/mh p0 add` | Add manual P0 task |
| `/mh p0 done` | Mark P0 task done (autocomplete from open tasks) |
| `/mh p0 today` | Re-post open P0 summary to #p0-tasks |
| `/mh stats weekly` | Generate + post LLM weekly summary to #stats |
| `/mh targets set <metric> <value>` | Set monthly target; updates pinned message in #targets |
| `/mh targets view` | Show current month targets + actuals (ephemeral) |
| `/mh objective set <name> <target>` | Set monthly target for an objective (7 choices) |
| `/mh objective update <name> <current>` | Update current progress for an objective |
| `/mh briefing` | Post composite morning briefing to #general |
| `/mh sync-meetings` | Explains Circleback webhook status |

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
| `/api/objectives` | GET | Current month objectives |
| `/api/objectives` | POST | Upsert objective (field = 'target' or 'current') |
| `/api/weekly-summary` | GET | Latest stored LLM summary |
| `/api/weekly-summary` | POST | Generate new LLM summary + save |
| `/api/stats-digest` | GET | Full stats payload for daily digest |
| `/api/briefing` | GET | Composite briefing payload |
| `/api/log-call` | POST | Write call to Sheets + Zoho |
| `/api/log-payment` | POST | Write payment row to Payments sheet |
| `/api/book` | POST | Book meeting |
| `/api/book-prospect` | POST | Convert lead + book meeting |
| `/api/accounts` | GET | Zoho accounts (autocomplete) |
| `/api/contacts` | GET | Zoho contacts (autocomplete) |
| `/api/leads` | GET | Zoho leads (autocomplete) |
| `/api/upload-prospects` | POST | Bulk upload to Sheets + Zoho Leads |
| `/api/top-250` | POST | Score all Not Contacted leads, tag top 250 in Zoho |
| `/api/circleback-sync` | POST | Receive Circleback webhook → mark Conducted + write Notes tab |
| `/api/reports/weekly` | GET | Generate + stream weekly PDF |
| `/api/reports/monthly` | GET | Generate + stream monthly PDF |

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
│   ├── TanishqDashboard.tsx            Daily/Weekly/Monthly toggle (client)
│   └── pdf/
│       ├── WeeklyReport.tsx            react-pdf Document — calls/meetings/pipeline/summary
│       └── MonthlyReport.tsx           react-pdf Document — targets vs actuals/won deals
├── lib/
│   ├── zoho.ts                         Zoho OAuth + getDeals/Contacts/Accounts/Calls/createCall
│   │                                   + getAllLeadsForScoring/addTagToLeads/removeTagFromLeads
│   ├── sheets.ts                       Google Sheets read/write (all tabs)
│   │                                   Exports: getMeetings, getNotes, getCalls, getTargets,
│   │                                   getTasks, getProspects, getPayments, getObjectives,
│   │                                   getTrainerPipeline, getTrainerRoster, getTopicCoverage,
│   │                                   appendCallRow, appendTaskRows, appendPaymentRow,
│   │                                   appendNoteRow, upsertTarget, upsertObjective,
│   │                                   updateMeetingConducted, saveSummary, getLatestSummary
│   ├── dashboard.ts                    Pure aggregation functions
│   └── types.ts                        TypeScript interfaces
└── discord-bot/
    ├── index.js                        Bot + all handlers + cron jobs
    └── register.js                     Discord command registration
```

### Google Sheets tabs in use

| Tab | Written by | Read by |
|---|---|---|
| Meetings | `/api/book`, `/api/book-prospect` | Dashboard, P0 tasks, weekly summary, briefing |
| Notes | `/api/circleback-sync` (auto on Conducted) | P0 tasks (no-notes check) |
| Calls | `/api/log-call` | Dashboard, P0 tasks, weekly summary, briefing |
| Targets | `/api/targets` | Dashboard, weekly summary, briefing |
| Tasks | `/api/p0-tasks` | Bot autocomplete, Anurag/Ashutosh views |
| Summaries | `/api/weekly-summary` | Homepage + Mahesh weekly summary card |
| Prospects | `/api/upload-prospects` | Ashutosh view (Prospect DB Health) |
| Payments | `/api/log-payment` | Anurag view (Payments Pending panel) |
| Objectives | `/api/objectives` | Ashutosh + Anurag views (progress bars) |

### Objectives — 7 fixed buckets

| Objective | Assigned to | Unit |
|---|---|---|
| Prospects Uploaded | Ashutosh | count |
| Calls Dialled | Tanishq | count |
| L1 Meetings Conducted | Tanishq | count |
| Deals Won | Anurag | count |
| Trainers Onboarded | Ashutosh | count |
| Revenue Invoiced (₹K) | Anurag | ₹K |
| Topic Coverage (%) | Ashutosh | % |

Set targets with `/mh objective set`, update progress with `/mh objective update`. Current value is **manually updated** — it does not auto-calculate from Sheets data.

### Circleback Webhook
Fires to `/api/circleback-sync` after every meeting where `trainings@thetesttribe.com` is an invitee. Now does two things:
1. Marks matching Meetings sheet row as `Conducted` (fuzzy match on account name + 25h date window)
2. Writes meeting notes + action items to Notes tab (non-blocking — won't break status update if it fails)

### Reports PDF (`@react-pdf/renderer`)
- `GET /api/reports/weekly` — streams a styled A4 PDF: calling stats, meetings, pipeline, hot deals, AI summary
- `GET /api/reports/monthly` — streams a styled A4 PDF: all the above + targets vs actuals table, won deals list
- Declared as `serverExternalPackages` in `next.config.js` so Next.js doesn't try to bundle the library
- No scheduled storage — generated fresh on each request

---

## 4. Known Data Gaps

| Gap | Status |
|---|---|
| L1/L2 Conducted | Circleback webhook live; historical meetings need manual backfill if needed |
| Objective current values | Manual — `/mh objective update` must be run weekly by the relevant person |
| Payment status (Received) | Manual — update Status column in Payments sheet directly; no `/mh` command yet |

---

## 5. Known Issues / Watch List

| Issue | Severity | Action |
|---|---|---|
| No retry logic on Zoho 429 rate limit | Medium | Add exponential backoff in `lib/zoho.ts` `zohoGet()` |
| Sheets write failures are silent (only `console.error`) | Low | Add Discord alert to `#sales-ops` on failure |
| Dead code in `lib/zoho.ts`: `scoreLeadForDashboard()`, `getLeadsByStatus()` | Low | Safe to delete |
| Objective current values don't auto-populate from Sheets | Medium | Could auto-fill Calls Dialled / L1 Conducted from existing data sources |

---

## 6. Immediate Action Items (before next build session)

1. **Verify Top-250 tags**: Sunday 11pm IST the re-ranker fires — check `#top250` tags appear in Zoho
2. **Seed objectives**: Run `/mh objective set` for each of the 7 objectives, then update progress weekly with `/mh objective update`
3. **Test PDF reports**: Open Mahesh view → click Weekly Report / Monthly Report links
4. **Watch Circleback Notes**: Next meeting with a thetesttribe.com attendee should auto-populate the Notes tab

---

## 7. Next Steps (Priority Order)

### Priority 1 — Objective auto-population
**Effort**: 1–2 hours  
Currently objective current values are manual. Three of the seven can be auto-filled from existing data:
- **Calls Dialled** → read from `callsData.monthly.dialled` (already computed)
- **L1 Meetings Conducted** → read from `meetingsData.monthly.l1Conducted` (already computed)
- **Deals Won** → count of Won-stage deals in Zoho

Build: extend `/api/objectives GET` to also return auto-computed actuals for these three; dashboard displays the auto value with a small "auto" badge; manual update still works for the other four.

### Priority 2 — Payment mark-as-received command
**Effort**: 1 hour  
`/mh log payment` creates Invoiced rows. Currently you update Status manually in Sheets. Build:
- `/mh payment received <account>` — autocomplete from open Payments rows, updates Status to 'Received' and sets a ReceivedAt timestamp
- Add `updatePaymentStatus()` to `lib/sheets.ts`
- Add `GET /api/payments/open` for autocomplete cache

### Priority 3 — People & Accounts module (Phase 4)
**Effort**: Full session  
**Blocked** — needs ~2–3 weeks of Circleback webhook history to have enough meeting notes to build meaningful account intelligence. Start after late June 2026.  
Will use: Notes tab (now being populated by circleback-sync), Meetings sheet, Zoho Accounts.

### Priority 4 — Zoho 429 retry / backoff
**Effort**: 30 min  
Add exponential backoff to `zohoGet()` in `lib/zoho.ts`. Currently any rate-limit hits silently fail.

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
| `CIRCLEBACK_WEBHOOK_SECRET` | HMAC-SHA256 signature verification for Circleback webhooks |

All set in Vercel Project Settings → Environment Variables **and** in `/root/moonlit-horizon/discord-bot/.env` on VPS.

---

## 10. Trainer Sheets (Phase 3 Reference)

**Sheet A — Trainer Outreach & Onboarding**  
ID: `1Xol3kb_5GDxS-Su-fAs1tIvTSLfGahNXWHv0MKUOY9I`  
Pipeline stages: Form Filled → Email Sent → WhatsApp Sent → Meeting Booked → Meeting Conducted → Sample Taken → Onboarded  

**Sheet B — Trainer Pricing & Supply**  
ID: `1R8FqcifveekYZsaS3taHARaQAo3CjZ0FqdHnNOcZg2U`  
Contents: 30 scored trainers (Tier 1 = 70+, Tier 2 = 50–69, Tier 3 = <50), topic → trainer ranking, customer pricing by tier, trainer cost by tier

---

## 11. Open Decisions

| Decision | Status |
|---|---|
| Objective auto-population | Not built — Priority 1 for next session |
| Payment mark-as-received | Not built — Priority 2 for next session |
| Ashutosh email status panel | Deferred — needs active email campaigns first |
| People & Accounts (Phase 4) | Blocked on Circleback history — start late June 2026 |
