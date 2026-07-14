# Moonlit Horizon — Handover Document
**Last updated:** 2026-06-09  
**Latest commit:** `8c3d1ad` (main)  
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
| **Phase 4 — Account Intelligence** | ✅ Complete | Email/Circleback/Call/Notes intel, Cumulative Summary, Last Contact Date, event-driven triggers |
| **Phase 5 — Contact Intelligence** | ✅ Complete | 2,372 contacts from DCT v1, Zoho-matched, historical meetings backfilled |
| **Phase 5b — Gmail Push** | ✅ Complete | Gmail Watch API + Pub/Sub → auto Email Intel on new emails |
| **Phase 6 — Dashboard Modules** | 🔄 In Progress | Tab layout live; Calling module done; Prospect DB / Account Intel / Contact Intel / Payments pending |

---

## 2. Session Summary (2026-06-09)

### Homepage Tab Layout + Calling Module

Refactored the homepage from a single Master Tracker view into a **tab-based layout**. Each module gets its own tab; new modules plug in by adding one entry to the `TABS` array in `HomeTabs`.

**Architecture changes:**
- `components/HomeTabs.tsx` — new client wrapper; renders tab bar + routes to active module
- `components/CallingModule.tsx` — new Calling tab (see below)
- `app/page.tsx` — now renders `HomeTabs` instead of `MasterTrackerGrid` directly; passes `rawCalls` prop
- `components/PersonSelector.tsx` — changed from initials-in-circles to **named rectangles** (Mahesh / Ashutosh / Anurag / Tanishq); now centred above the tab bar in `HomeTabs` rather than inside each module

**Calling module (`/` → Calling tab):**
- Period toggle: Daily | Weekly | Monthly
- 4 stat cards: Dialled, Connected, Meetings Booked, Connection Rate %
- Outcome breakdown: colour-coded horizontal bars per outcome (Meeting Scheduled = green, Call Back Later = blue, Send More Info = purple, Not Interested = amber, RNR/No Answer = grey, Wrong Number = red)
- SDR Performance table: per-SDR dialled / connected / rate (green ≥ 50%, amber ≥ 30%)
- Calls log table: search by account/contact/SDR, filter by outcome, newest-first, capped at 150 rows

Data source: same merged Calls array already fetched on homepage (Sheets + Zoho, deduped by date+account) — no extra API call on tab switch.

**Commits:** `4fae730` (module), `8c3d1ad` (person selector + layout)

---

## 2. Session Summary (2026-06-08, session 2)

### Gmail Push Notifications — Live E2E Automation
Email Intelligence (col F of Account Intelligence sheet) now updates automatically when a new email arrives in Gmail matching the `The Test Tribe <> AccountName` subject pattern.

**Architecture:**
- Gmail Watch API registered on `anurag@thetesttribe.com` inbox → publishes to GCP Pub/Sub topic `moonlit-gmail-notifications`
- Pub/Sub push subscription → `POST /api/intel-triggers/gmail` (excluded from Basic Auth middleware)
- Handler decodes notification → fetches Gmail history delta since last cursor → extracts account from subject → calls `syncEmailIntel(account)` → updates col F + Cumulative Summary
- `historyId` cursor persisted in `Config` Sheets tab (row 1: `gmail_history_id`)
- Watch expires every 7 days — Vercel cron renews it every Monday 2am UTC (`/api/intel-triggers/gmail/renew`)

**Subject format supported:**
- `The Test Tribe <> AccountName`
- `The Test Tribe <> AccountName - descriptor`
- `The Test Tribe <> AccountName | descriptor`

**New files:**
- `app/api/intel-triggers/gmail/route.ts` — Pub/Sub push receiver
- `app/api/intel-triggers/gmail/renew/route.ts` — weekly watch renewal
- `scripts/register-gmail-watch.js` — one-time watch registration
- `vercel.json` — Vercel cron config (Monday 2am UTC renewal)

**Middleware update:** `api/intel-triggers/gmail` excluded from Basic Auth (same as `api/webhook/`) so Pub/Sub can POST without credentials.

**GCP setup (already done):**
- Project: `moonlit-horizon`
- Topic: `projects/moonlit-horizon/topics/moonlit-gmail-notifications`
- Subscription: `moonlit-gmail-push` (push → Vercel endpoint)
- Publisher grant: `gmail-api-push@system.gserviceaccount.com` has Pub/Sub Publisher role

---

## 2. Session Summary (2026-06-08)

### Zoho Call Webhook — Live E2E Automation
Full pipeline now fires automatically whenever any call is logged in Zoho CRM (by Tanishq or anyone).

**New endpoint: `POST /api/webhook/zoho-call-logged`**

Triggered by a Zoho CRM Workflow Rule (Setup → Workflow Rules → "Automation for Calls"):
- **Trigger**: Outgoing call logged or modified
- **Condition**: All calls
- **Action**: Instant webhook → `https://moonlit-horizon.vercel.app/api/webhook/zoho-call-logged?secret=thetesttribe`
- **Module Parameter**: `id` = `Calls - ID` (sends Call record ID as form field)

**What the webhook does (in order):**
1. Fetches full call details from Zoho (`getCallById`) — date, time, duration, outcome, notes, owner name
2. Resolves lead or contact:
   - Lead calls: `$se_module=Leads`, lead is in `What_Id` (NOT `Who_Id` — Zoho quirk)
   - Contact calls: `$se_module=Contacts`, contact is in `Who_Id`
3. Resolves account/company name:
   - From `lead.company` or `contact.accountName` if set
   - Fallback: infers from email domain (`ptc.com` → `PTC`, `indusface.com` → `Indusface`, ≤4 chars → uppercase)
   - Free providers (gmail, yahoo, etc.) → `#Unknown`
4. If company was inferred (not `#Unknown`): writes it back to Zoho Lead `Company` + `Company_Name` field (so future calls resolve directly)
5. Deduplication: checks if Zoho Call ID already in Sheets col J — if yes, skips Sheets write (prevents double-write when Discord `/mh log call` already wrote the row)
6. Writes row to Sheets **Calls** tab: date, time, account, contact name, SDR (Zoho owner), duration, outcome, notes, Zoho Call ID
7. Fires `syncCallIntel(account, date)` → regenerates **Account Intelligence** col H (Call Intel) + Last Contact Date + Cumulative Summary
8. Fires `upsertContactIntelRow(email, ...)` → updates **Contact Intelligence**: Total Calls, Calls Connected, Connection Rate %, Last Call Date, Last Call Outcome, Call History JSON (col U)

**Key Zoho discovery**: For Lead-linked calls, Zoho puts the Lead in `What_Id` and leaves `Who_Id` null. `$se_module` field determines the type. This is opposite to Contact calls where the contact is in `Who_Id`.

**Deduplication — Discord `/mh log call` path:**
- `createZohoCall` now returns the Zoho Call ID (`Promise<string | null>`, was `Promise<void>`)
- `appendCallRow` now returns the sheet row number written (`Promise<number>`, was `Promise<void>`)
- After Discord logs a call, the Zoho Call ID is written back to col J of that Sheets row
- When the Zoho webhook fires for the same call, it finds the ID in col J and skips the duplicate Sheets write — but still refreshes Account Intel and Contact Intel

**Changes to existing files:**
- `lib/zoho.ts`: `getCallById` extended to return `callStartTime`, `callDuration`, `description`, `ownerName`; `createZohoCall` returns call ID; new `updateLeadCompany(leadId, company)`
- `lib/sheets.ts`: `appendCallRow` returns row number, accepts optional `duration` + `zohoCallId`; new `updateCallRowZohoId`, `callExistsInSheetByZohoId`, `upsertContactIntelRow`
- `app/api/log-call/route.ts`: writes Zoho Call ID back to Sheets col J after `createZohoCall` resolves

**Calls tab column reference (A–N):**
`Date | Time | Account | Contact Name | Contact Phone | SDR | Duration | Outcome | Notes | Zoho Call ID | Follow-up Date | Recording Drive Link | Transcript Summary | Auto Tags`

---

## 3. Session Summary (2026-06-07)

### Account Intelligence — Gmail Sync
- `scripts/sync-gmail-intel.js` syncs Gmail threads for all 177 accounts in the Account Intelligence sheet
- Searches by contact email (via Zoho word search) + subject line `"The Test Tribe <> <Account Name>"`
- Excludes newsletters: `-category:promotions -category:social -from:finercircle -from:thriveedschool`
- Compact format: 2-line summary + numbered dated list per thread
- Run: `node scripts/sync-gmail-intel.js` (single: `node scripts/sync-gmail-intel.js "AccountName"`)

### Account Intelligence — Last Contact Date
- New col L in Account Intelligence sheet: auto-detected from latest date across all 4 intel layers
- Displayed as time-range badge on dashboard (< 1 day → 3+ months)
- Editable via ✎ inline date picker on dashboard
- Discord: `/mh intel touch <account> [date]` — defaults to today IST
- API: `POST /api/account-intel/last-contact { account, date }`

### Account Intelligence — Event-Driven Triggers (new in this session)
All intelligence layers now update automatically when new data arrives:

| Trigger | What fires | What updates |
|---------|-----------|--------------|
| New email in Gmail | `sync-gmail-intel.js` (still manual/cron pending) | Email Intel → Cumulative (`email` priority) |
| Circleback meeting notes | `/api/circleback-sync` webhook | Circleback Intel + Last Contact Date → Cumulative (`meeting` priority) |
| `/mh log call` Discord | `/api/intel-triggers/call` (fire-and-forget) | Call Intel + Last Contact Date → Cumulative (`call` priority) |
| Manual note added | `addManualNote()` server action | Cumulative (`notes` priority — highest weight if recent) |

- `syncCallIntel(account)` — regenerates Call Intelligence from Calls sheet → updates col H
- `syncCirclebakIntel(account, meetings, date)` — updates col G + Last Contact Date
- `regenerateCumulative(account, changedLayer?)` — recency-weighted prompt, labels most recent layer as "⬆ LATEST UPDATE"
- New Sheets functions: `updateCallIntelligence()`, `updateCirclebakIntelligence()`
- New API: `POST /api/intel-triggers/call`

### Contact Intelligence (new sheet tab)
- 2,372 unique contacts from DCT v1 (cleaned, deduped) written to "Contact Intelligence" Google Sheet
- 64% matched to Zoho Lead/Contact IDs; 96% matched to Zoho Deal IDs
- 23 columns: Zoho IDs, Name, Email, Phone, Title, Company, L1/L2 Source, SDR, call stats, meeting booked, last call date/outcome, Zoho stage, full call history JSON
- L1/L2 sources mapped to Zoho `Lvl_1_Source` / `Lvl_2_Source` picklists
- Scripts: `scripts/build-contact-intelligence.js`, `scripts/export-unmatched-prospects.js`

### Historical Meetings Backfill
- 204 meetings from Jan–Jun 2026 written to Meetings sheet (HIST-001 through HIST-204)
- 146/204 linked to Circleback meeting URLs (col G)
- 196/204 linked to Zoho Deal IDs (col H)
- Source: `Others/Dashboard/Jan-June Meetings-CT - Final Cumulative Meeting Sheet.csv`
- Script: `scripts/push-historical-meetings.js`

### DCT v1 Data Cleaning (local CRM files)
All files in `../CRM/`:

| File | Rows | Description |
|------|------|-------------|
| `DCT-v1-cleaned.csv` | 2,759 | Source of truth — clean calling history |
| `never-called-prospects.csv` | 278 | Uploaded but never called — future outreach pool |
| `rnr-prospects.csv` | 577 | RNR + Not Interested — parked |
| `excluded-prospects.csv` | 156 | Not Relevant + Wrong Number — archived |
| `unmatched-prospects.csv` | 125 | Pushed to Zoho Leads (96% match rate) |

### Zoho L2 Source Picklist — 6 new values added
- `Webinar - Fireside Chat with Revathi Chanda Syren (30.03.26)`
- `Webinar - Ask Me Anything with Kiran Chandaka (15.04.26)`
- `Fireside Chat with Aparana Gupta (07.04.26)`
- `AI Adoption for IT Leaders - Sahil Garg (08.04.26)`
- `Cutting through the BS of AI: Playwright Agents in Action - Md. Tanweer (22.01.26)`
- `Boosting QA Productivity Through Copilot - Siva Prasad Reddy (24.02.26)`

### Discord — `/mh intel touch` bug fix
- Autocomplete was returning Zoho ID instead of account name for the touch command
- Fixed: account value now resolved via `cache.accounts.find()` same as other intel subcommands

---

## 3. What Is Live Today (updated)

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
| `/mh log call` | Log call → Sheets Calls tab + Zoho + triggers Call Intel refresh |
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
| `/mh intel show <account>` | Show Account Intelligence summary |
| `/mh intel refresh <account>` | Regenerate all intel layers from scratch |
| `/mh intel note <account> <text>` | Append manual note → triggers cumulative refresh |
| `/mh intel status <account> <status>` | Update deal status (Won/Active/Warm/Cold/Dead) |
| `/mh intel touch <account> [date]` | Set Last Contact Date (defaults to today IST) |

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
| `/api/circleback-sync` | POST | Receive Circleback webhook → mark Conducted + write Notes tab + update Circleback Intel + Last Contact Date |
| `/api/reports/weekly` | GET | Generate + stream weekly PDF |
| `/api/reports/monthly` | GET | Generate + stream monthly PDF |
| `/api/account-intel` | GET | All Account Intelligence rows |
| `/api/account-intel/refresh` | POST | Regenerate full intel for one account |
| `/api/account-intel/note` | POST | Append manual note + refresh cumulative |
| `/api/account-intel/status` | POST | Update deal status field |
| `/api/account-intel/last-contact` | POST | Set Last Contact Date |
| `/api/intel-triggers/call` | POST | Triggered after call logged → refresh Call Intel + cumulative |
| `/api/webhook/zoho-call-logged` | POST | Zoho Workflow Rule webhook → write Calls tab + refresh Call Intel + update Contact Intelligence |

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
│   │                                   + getCallById (extended: callStartTime/Duration/description/owner)
│   │                                   + createZohoCall (now returns Zoho Call ID)
│   │                                   + updateLeadCompany (writes Company/Company_Name to Lead)
│   ├── sheets.ts                       Google Sheets read/write (all tabs)
│   │                                   Exports: getMeetings, getNotes, getCalls, getTargets,
│   │                                   getTasks, getProspects, getPayments, getObjectives,
│   │                                   getTrainerPipeline, getTrainerRoster, getTopicCoverage,
│   │                                   appendCallRow (returns row number, accepts duration+zohoCallId),
│   │                                   updateCallRowZohoId, callExistsInSheetByZohoId,
│   │                                   upsertContactIntelRow,
│   │                                   appendTaskRows, appendPaymentRow,
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

### Account Intelligence Sheet (col A–L)
| Col | Field | Updated by |
|-----|-------|-----------|
| A | Account name | On upsert |
| B | Updated At | Every intel write |
| C | Meeting Count | `generateAndSaveIntel()` |
| D | Last Meeting | `generateAndSaveIntel()` |
| E | Status | `/mh intel status`, dashboard |
| F | Email Intelligence | `syncEmailIntel()` |
| G | Circleback Intelligence | `syncCirclebakIntel()` |
| H | Call Intelligence | `syncCallIntel()` |
| I | Manual Notes | `appendManualNote()` |
| J | Cumulative Summary | `regenerateCumulative()` |
| K | Next Action | `regenerateCumulative()` |
| L | Last Contact Date | All triggers + `/mh intel touch` |

### Contact Intelligence Sheet (col A–W)
New sheet tab written by `scripts/build-contact-intelligence.js`:
- 2,372 unique contacts, 64% matched to Zoho Lead/Contact IDs
- Full call history stored as JSON in col U
- L1/L2 sources mapped to Zoho picklist values
- 125 contacts pushed to Zoho Leads (Callback Later + Send More Info + Meeting Booked)

### Circleback Webhook (updated)
Fires to `/api/circleback-sync` after every meeting where `trainings@thetesttribe.com` is an invitee. Now does **four** things:
1. Marks matching Meetings sheet row as `Conducted` (fuzzy match on account name + 25h date window)
2. Writes meeting notes + action items to Notes tab
3. **NEW:** Updates Circleback Intelligence layer (col G) via `syncCirclebakIntel()`
4. **NEW:** Sets Last Contact Date to the meeting date (col L)

### Reports PDF (`@react-pdf/renderer`)
- `GET /api/reports/weekly` — streams a styled A4 PDF: calling stats, meetings, pipeline, hot deals, AI summary
- `GET /api/reports/monthly` — streams a styled A4 PDF: all the above + targets vs actuals table, won deals list
- Declared as `serverExternalPackages` in `next.config.js` so Next.js doesn't try to bundle the library
- No scheduled storage — generated fresh on each request

---

## 4. Known Data Gaps

| Gap | Status |
|---|---|
| Historical meetings (pre-Jan 2026) | 204 meetings backfilled Jan–Jun 2026; pre-Jan requires manual entry |
| Objective current values | Manual — `/mh objective update` must be run weekly |
| Payment status (Received) | Manual — update Status column in Payments sheet directly |
| Gmail push notifications | Still manual/cron — Gmail Watch API + Pub/Sub not yet set up |
| Contact Intelligence Notes Summary | Column W blank — needs AI enrichment pass |
| 36% Contact Intelligence unmatched to Zoho | Contacts in DCT not in Zoho (never uploaded) |

---

## 5. Known Issues / Watch List

| Issue | Severity | Action |
|---|---|---|
| Gmail intel trigger is still pull-based | ✅ Fixed | Gmail Watch API + Pub/Sub live — auto-triggers on new inbox emails |
| No retry logic on Zoho 429 rate limit | ✅ Fixed | `zohoGet()` now retries via `zohoFetchWithRetry()` — 3 retries, 1s/2s/4s backoff on 429/5xx |
| Sheets write failures are silent (only `console.error`) | Low | Add Discord alert to `#sales-ops` on failure |
| Contact Intelligence Notes Summary (col W) is blank | Medium | Run AI enrichment pass using call history JSON |
| Objective current values don't auto-populate | Medium | Could auto-fill Calls Dialled / L1 Conducted from existing data |

---

## 6. Immediate Action Items

1. **Gmail push setup**: Configure Gmail Watch API + Cloud Pub/Sub for auto email intel updates
2. **Contact Intelligence enrichment**: Run Notes Summary AI pass for the 2,372 contacts
3. **Review never-called-prospects.csv** (278 rows) — push to Zoho Leads when ready for next calling campaign

---

## 7. Next Steps (Priority Order)

### ~~Priority 1 — Gmail Push Notifications~~ ✅ Done (2026-06-08)
Completed. See Session Summary 2026-06-08 session 2 for full details.

### ~~Priority — Dashboard Tab Layout + Calling Module~~ ✅ Done (2026-06-09)
Completed. See Session Summary 2026-06-09 for full details.

### Priority 2 — Remaining Dashboard Modules (tab-by-tab)
**Effort**: ~1 session per module  
All plug into `HomeTabs.tsx` via a new entry in the `TABS` array + a new module component.

| Module | Tab label | Key data | Key views |
|---|---|---|---|
| Prospect Database | Prospects | `Prospects` Sheets tab | Stock count, weeks-of-stock by source, never-called pool |
| Account Intelligence | Accounts | `Account Intelligence` sheet (cols A–L) | Searchable table, status badges, last contact date, cumulative summary |
| Contact Intelligence | Contacts | `Contact Intelligence` sheet (cols A–W) | Search/filter 2,372 contacts, call history timeline, Zoho links |
| Payments | Payments | `Payments` Sheets tab | Invoiced/received/outstanding, per-deal status, overdue badges |

### Priority 3 — Objective auto-population
**Effort**: 1–2 hours  
Auto-fill Calls Dialled, L1 Conducted, Deals Won from existing data sources.

### Priority 4 — Payment mark-as-received command
**Effort**: 1 hour  
`/mh payment received <account>` → updates Payments sheet status to Received.

### ~~Priority 5 — Zoho Call Webhook~~ ✅ Done (2026-06-08)
Completed. See Session Summary 2026-06-08 for full details.

---

## 8. Google Sheet Tabs (complete list)

| Tab | Written by | Read by |
|---|---|---|
| Meetings | `/api/book`, `/api/book-prospect`, `scripts/push-historical-meetings.js` | Dashboard, P0 tasks, briefing |
| Notes | `/api/circleback-sync` | P0 tasks, `generateAndSaveIntel()` |
| Calls | `/api/log-call` (Discord), `/api/webhook/zoho-call-logged` (Zoho) | Dashboard, Call Intelligence, P0 tasks, Contact Intelligence |
| Targets | `/api/targets` | Dashboard, weekly summary |
| Tasks | `/api/p0-tasks` | Bot autocomplete, Anurag/Ashutosh views |
| Summaries | `/api/weekly-summary` | Homepage, Mahesh view |
| Prospects | `/api/upload-prospects` | Ashutosh view |
| Payments | `/api/log-payment` | Anurag view |
| Objectives | `/api/objectives` | Ashutosh + Anurag views |
| Account Intelligence | All intel triggers + scripts | Dashboard AccountIntelPanel |
| Contact Intelligence | `scripts/build-contact-intelligence.js` | Future: Contact Intel panel |

---

## 9. VPS Operations

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
| Gmail push notifications (auto Email Intel) | ✅ Done — Gmail Watch API + Pub/Sub live |
| Contact Intelligence dashboard panel | After Gmail push — shows call history per contact |
| Objective auto-population | Not built — Priority 3 |
| Payment mark-as-received | Not built — Priority 4 |
| Zoho Call webhook (non-Discord calls) | Not built — Priority 5 |
| Contact Intelligence Notes Summary enrichment | 2,372 contacts have blank Notes Summary (col W) |
| Feb 5 2026 webinar L2 source | Mapped to Siva Prasad Reddy (24.02.26) — confirm if same event |
| Cold - Whatsapp Community L1 | Mapped to Events/TribeQonf'25 — 2 contacts (Deb Ghosh, Sunit Kole) |
