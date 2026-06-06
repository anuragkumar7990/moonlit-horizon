# Moonlit Horizon — Master Reference Document

> The Test Tribe · Corporate Training Business  
> Owner: Anurag Kumar (anurag@thetesttribe.com)  
> Last updated: 2026-06-07 (synced with HANDOVER.md)

---

## Table of Contents

1. [What Is This?](#1-what-is-this)
2. [Infrastructure & Hosting](#2-infrastructure--hosting)
3. [Repository Structure](#3-repository-structure)
4. [Environment Variables](#4-environment-variables)
5. [Integrations](#5-integrations)
6. [The Dashboard — Moonlit Horizon (Vercel)](#6-the-dashboard--moonlit-horizon-vercel)
7. [The Agent Layer — OpenClaw (Hostinger VPS)](#7-the-agent-layer--openclaw-hostinger-vps)
8. [The Discord Bot](#8-the-discord-bot)
9. [Upload Prospects — Full Feature History](#9-upload-prospects--full-feature-history)
10. [Google Sheet Structure](#10-google-sheet-structure)
11. [Mission Control Dashboard — Full Build Plan](#11-mission-control-dashboard--full-build-plan)
12. [Design System](#12-design-system)
13. [Data Architecture & Lead Journey](#13-data-architecture--lead-journey)
14. [Discord Channels & Slash Commands](#14-discord-channels--slash-commands)
15. [Testing Strategy & Failure Recovery](#15-testing-strategy--failure-recovery)
16. [Token Optimisation Guardrails](#16-token-optimisation-guardrails)
17. [Build Sequence & Timeline](#17-build-sequence--timeline)
18. [Zoho CRM Data Cleanup](#18-zoho-crm-data-cleanup)
19. [Account Intelligence — Full Spec](#19-account-intelligence--full-spec)
20. [Contact Intelligence — Full Spec](#20-contact-intelligence--full-spec)
21. [Historical Data — DCT v1 & Meetings](#21-historical-data--dct-v1--meetings)

---

## 18. Zoho CRM Data Cleanup

> **Status**: Must action before Phase 1 UI build. These data gaps directly affect P0 task accuracy and dashboard metrics.

### Deals to move to Lost

The following deals are dropped and must be moved to **Lost** stage in Zoho CRM:

| Account | Current Stage | Action |
|---|---|---|
| Qualizeal | Discovery Call Conducted | Move to Lost |
| Vivriti Capital | Discovery Call Conducted | Move to Lost |

### Deals with wrong stage

| Account | Current Stage | Correct Stage | Notes |
|---|---|---|---|
| Betterworks - AI in PM | Negotiation | Outline Meeting Conducted | Outline + proposal still to be shared; not in negotiation yet |

### Deals missing Contact Name

Most active deals have no `Contact_Name` linked in Zoho. This causes P0 tasks to show `—` for the contact column. For every active deal, link the primary contact in Zoho CRM (Deals → Contact Name field).

Priority accounts to fix first (active pipeline):
- Aspire Systems, Excelsoft, RxLogix (ISO 42001), Betterworks - AI in PM *(Negotiation)*
- Autodesk, Gyan, Prolifics, Dataction Analytics, Hewlett Packard, Motorola, Credit Saison, Get Well, Caught Before Ship Pvt Ltd, Bloomreach, CRISIL *(Discovery Call Conducted)*
- PyxTech, Celestial Systems, Applied Data Finance, Apex IT, Infiniti Software Solutions, Conga, RxLogix - Assignment Creation *(Outline Meeting Conducted)*

### Deals with outdated closing dates

Many active deals have closing dates in the past (they trigger the "overdue closing date" P0 task every day). Update closing dates in Zoho CRM to reflect realistic expected close dates.

### Account Intelligence gaps (to be backfilled)

The following accounts have had outlines/proposals already shared but the intelligence is not captured anywhere. Once the Account Intelligence module is built (Phase 4), these should be the first batch to backfill:

Autodesk, Gyan, Prolifics, Dataction Analytics, Credit Saison, Get Well, Caught Before Ship Pvt Ltd, Bloomreach, CRISIL, PyxTech, Celestial Systems, Applied Data Finance, Apex IT, Infiniti Software Solutions, Conga, RxLogix - Assignment Creation.

---

## 1. What Is This?

Moonlit Horizon is the internal operations platform for The Test Tribe's Corporate Training Business. It connects Zoho CRM, Google Sheets, Google Calendar, Gmail, and Discord into a single system that lets the sales and delivery team:

- Book client meetings via a Discord slash command
- Upload and manage prospect lists from webinars, events, and cold outreach
- Track all client communications from one dashboard
- Automatically log meeting notes from Circleback

The system has three distinct runtime environments:
- **Vercel** — the dashboard web app (Next.js)
- **Hostinger VPS** — the OpenClaw AI agent layer (Docker)
- **Hostinger VPS** — the Discord bot (Node.js process)

---

## 2. Infrastructure & Hosting

### Vercel (Dashboard)
- **URL**: https://moonlit-horizon.vercel.app
- **Framework**: Next.js 14.2.30 (App Router, TypeScript)
- **Deployment**: Auto-deploys on push to `main` branch of GitHub repo `anuragkumar7990/moonlit-horizon`
- **Password**: `thetesttribe` (set via `DASHBOARD_PASSWORD` env var)
- **Region**: sin1 (Singapore)

### Hostinger VPS
- Runs two persistent processes:
  1. **OpenClaw** — Docker container (`docker compose up -d`) at `/opt/moonlit-openclaw/`
  2. **Discord Bot** — Node.js process (`discord-bot/`)
- SSH access: `ssh root@<vps-ip>`
- Web UI for OpenClaw: `http://<vps-ip>:3001`

### GitHub
- Repo: `https://github.com/anuragkumar7990/moonlit-horizon`
- Main branch = production (Vercel watches this)
- Discord bot code lives in `discord-bot/` subfolder (not deployed to Vercel)

### Google Sheets
- **Spreadsheet ID**: `1aIbzFh0vH-9XYeuNeNRRqcyG_dWnwIPBs4cqJGyyoD4`
- **URL**: https://docs.google.com/spreadsheets/d/1aIbzFh0vH-9XYeuNeNRRqcyG_dWnwIPBs4cqJGyyoD4/edit
- Owner: anurag@thetesttribe.com
- Tabs: Meetings, Notes, Communications, Accounts, Prospects (created on first upload)

---

## 3. Repository Structure

```
moonlit-horizon/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout with sidebar nav
│   ├── page.tsx                  # Home — Sales Pipeline (client cards)
│   ├── book/
│   │   └── page.tsx              # Manual meeting booking form
│   ├── upload/
│   │   └── page.tsx              # Upload Prospects page (CSV → Zoho)
│   ├── client/
│   │   └── [account]/
│   │       └── page.tsx          # Individual client detail page
│   └── api/
│       ├── book/route.ts         # POST — create meeting (Calendar + CRM + Sheets)
│       ├── upload-prospects/
│       │   └── route.ts          # POST — CSV upload pipeline
│       └── zoho-sources/
│           └── route.ts          # GET/POST — Lvl 2 Source picklist from Zoho
│
├── components/
│   ├── ClientCard.tsx            # Account summary card (pipeline view)
│   ├── MeetingTimeline.tsx       # Chronological meeting list for a client
│   ├── NotesPanel.tsx            # Meeting notes from Circleback
│   └── CommsTimeline.tsx         # Discord + Gmail comms history
│
├── lib/
│   ├── zoho.ts                   # All Zoho CRM API calls
│   ├── sheets.ts                 # All Google Sheets API calls
│   ├── booking.ts                # Meeting booking orchestration logic
│   └── types.ts                  # Shared TypeScript types
│
├── discord-bot/                  # Runs on Hostinger VPS (NOT on Vercel)
│   ├── index.js                  # Bot entrypoint — slash command handler
│   ├── register.js               # One-time command registration script
│   ├── package.json
│   └── .env                      # Bot-specific env vars (separate from Vercel)
│
├── openclaw/                     # AI agent config (runs on Hostinger VPS)
│   ├── docker-compose.yml        # OpenClaw container config
│   ├── sheets-setup.gs           # Google Apps Script to create sheet tabs
│   └── agents/
│       ├── meeting-booking-agent.md     # Agent: Discord /book flow
│       ├── notes-summarisation-agent.md # Agent: Circleback → Sheets
│       └── comms-tracker-agent.md       # Agent: Discord + Gmail → Sheets
│
├── .env.local                    # Local env vars (never committed)
├── SETUP.md                      # Step-by-step setup guide
├── MOONLIT_HORIZON_MASTER.md     # This document
├── package.json                  # Dependencies
├── tailwind.config.ts
└── tsconfig.json
```

---

## 4. Environment Variables

### `.env.local` (Vercel + local dev)

```env
# Google OAuth (one-time setup via OAuth Playground as anurag@thetesttribe.com)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REFRESH_TOKEN=<from OAuth Playground>

# Google Sheets
SHEETS_SPREADSHEET_ID=1aIbzFh0vH-9XYeuNeNRRqcyG_dWnwIPBs4cqJGyyoD4

# Google Calendar
GOOGLE_CALENDAR_ID=primary

# Zoho CRM (India DC — zohoapis.in)
ZOHO_CLIENT_ID=<from Zoho API Console>
ZOHO_CLIENT_SECRET=<from Zoho API Console>
ZOHO_REFRESH_TOKEN=<from Zoho OAuth Playground>

# Dashboard
DASHBOARD_PASSWORD=thetesttribe

# OpenClaw webhook (Discord-triggered bookings)
OPENCLAW_WEBHOOK_SECRET=
```

> ⚠️ Actual credential values are in `.env.local` (local) and Vercel environment variables (production). Never commit real values.

### `discord-bot/.env` (VPS only)

```env
DISCORD_BOT_TOKEN=<from Discord Developer Portal>
DISCORD_CLIENT_ID=1512066387110006936
DISCORD_GUILD_ID=1504972620083499199
VERCEL_URL=https://moonlit-horizon.vercel.app
DASHBOARD_PASSWORD=thetesttribe
```

---

## 5. Integrations

### Zoho CRM
- **API**: v3, India DC (`https://www.zohoapis.in/crm/v3`)
- **Auth**: OAuth 2.0 with refresh token (auto-refreshed, cached for 55 minutes)
- **Module**: Leads (primary), Contacts, Accounts, Deals, Calls
- **Key fields used**:
  - `Last_Name`, `First_Name`, `Email`, `Mobile`, `Company`, `Company_Name`
  - `City`, `Designation`, `Lead_Source`, `Lead_Status`
  - `Lvl_1_Source` (custom picklist, field ID: `1321968000000748250` for Lvl 2)
  - `Lvl_2_Source` (custom picklist, field ID: `1321968000000748250`)
  - `Tag` (array of `{ name: string }`)
- **Known limits**: 100 records max per POST to `/Leads`; bulk delete ~50 IDs max per call (1024 char URL limit)
- **Key discovery**: The visible Company field in Zoho Leads is `Company_Name`, not `Company` — both must be sent

### Google Sheets
- **Library**: `googleapis` v144 (npm)
- **Auth**: OAuth2 with refresh token (same credentials as dashboard)
- **Tabs**:
  - `Meetings!A:J` — meeting bookings
  - `Notes!A:E` — Circleback meeting summaries
  - `Communications!A:E` — Discord + Gmail thread log
  - `Accounts!A:E` — client account list
  - `Prospects!A:L` — upload log (created automatically on first upload)

### Google Calendar
- **Auth**: Same OAuth credentials
- **Calendar**: `primary` (anurag@thetesttribe.com's default calendar)
- **Used for**: Creating G-Meet events when meetings are booked

### Discord
- **Bot name**: Moonlit Horizon
- **Guild**: TTT Discord server (ID: `1504972620083499199`)
- **Bot Client ID**: `1512066387110006936`
- **Commands registered as guild commands** (not global — guild = instant, global = up to 1hr delay)
- **Commands**:
  - `/book` — book a meeting with an existing CRM account/contact
  - `/book-prospect` — convert a Lead to Contact/Account and book a meeting

### OpenClaw (AI Agent Framework)
- **What it is**: An open-source AI agent orchestration platform running in Docker on the VPS
- **Web UI**: `http://<vps-ip>:3001`
- **Three agents loaded**:
  1. **Meeting Booking Agent** — triggered by `/book meeting` in Discord #sales-ops; guides SDR through booking form, creates Calendar event + Zoho Deal + Sheets row + Discord confirmation
  2. **Notes Summarisation Agent** — pulls meeting notes from Circleback API, formats and writes to `Notes` tab in Sheets
  3. **Communications Tracker Agent** — watches #sales-ops Discord + Gmail every 10–15 min, logs relevant threads to `Communications` tab in Sheets

---

## 6. The Dashboard — Moonlit Horizon (Vercel)

### Authentication
- Simple password gate (`DASHBOARD_PASSWORD=thetesttribe`)
- Set in middleware — all routes protected

### Pages

#### `/` — Sales Pipeline
- Pulls from `Accounts`, `Meetings`, `Notes` tabs in Sheets
- Shows 3 stat cards: Meetings This Week, Open Deals, Notes with Actionables
- Grid of `ClientCard` components — one per account
- Revalidates every 60 seconds

#### `/client/[account]` — Client Detail
- Shows `MeetingTimeline`, `NotesPanel`, `CommsTimeline` for one account
- All data from Google Sheets

#### `/book` — Manual Meeting Booking
- Form UI for booking meetings without using Discord
- Calls `/api/book`

#### `/upload` — Upload Prospects
- Full CSV → Zoho CRM lead upload pipeline (see Section 9)

### API Routes

#### `POST /api/book`
- Creates Google Calendar event (G-Meet)
- Creates or finds Zoho Account + Contact
- Creates Zoho Deal (stage: "Meeting Booked")
- Writes row to `Meetings` tab in Sheets
- Returns booking confirmation

#### `POST /api/upload-prospects`
- Accepts multipart FormData: `file` (CSV), `lvl1Source`, `lvl2Source`
- Full CSV cleaning and field mapping pipeline
- Batch-creates leads in Zoho (100 per POST)
- On Zoho duplicate: tags existing lead with event name instead of skipping
- Logs all created/updated leads to `Prospects` tab in Google Sheets
- Returns: `{ created, updated, skipped, excluded, errors, results[] }`

#### `GET /api/zoho-sources`
- Fetches live `Lvl_2_Source` picklist values from Zoho field metadata
- Used by upload page dropdown

#### `POST /api/zoho-sources`
- Adds a new value to Zoho's `Lvl_2_Source` picklist
- Fetches existing values first, appends new one, PUTs back via Zoho Fields API

---

## 7. The Agent Layer — OpenClaw (Hostinger VPS)

OpenClaw is an open-source AI agent framework running in a Docker container on the Hostinger VPS. It provides a web UI for defining agents as markdown files and connects to external APIs.

### Setup
```bash
# On VPS
cd /opt/moonlit-openclaw
docker compose up -d
```

### Agents

**1. Meeting Booking Agent** (`openclaw/agents/meeting-booking-agent.md`)
- Trigger: `/book meeting` in Discord #sales-ops
- Flow: prompt SDR for details → validate against Zoho CRM → create Calendar G-Meet event → create Zoho Deal → write to Sheets → confirm in Discord
- Calendar title format:
  - L1: `{Account} <> The Test Tribe | Upskilling for Teams`
  - L2+: `{Account} <> The Test Tribe | Training - Next Steps`
- Invites: contact, tanishq@, anurag@, trainings@, ashutosh@

**2. Notes Summarisation Agent** (`openclaw/agents/notes-summarisation-agent.md`)
- Trigger: after each meeting (Circleback webhook or polling)
- Pulls transcript/notes from Circleback API
- Writes summary + actionables to `Notes` tab in Sheets

**3. Communications Tracker Agent** (`openclaw/agents/comms-tracker-agent.md`)
- Runs continuously
- Watches Discord #sales-ops every 10 min for account name mentions
- Polls Gmail every 15 min for threads from known contact domains
- Logs to `Communications` tab in Sheets
- Deduplicates by thread ID

---

## 8. The Discord Bot

The Discord bot runs as a persistent Node.js process on the Hostinger VPS (separate from OpenClaw).

### Files
- `discord-bot/index.js` — main bot process, handles slash command interactions
- `discord-bot/register.js` — one-time script to register commands with Discord API
- `discord-bot/.env` — bot credentials

### Commands
Both commands are guild-registered (not global) for instant availability.

**`/book`**
- Options: `account` (autocomplete from Zoho), `contact` (autocomplete), `time` (YYYY-MM-DD HH:MM), `type` (L1 or L2+)
- Flow: looks up Zoho account/contact → calls `/api/book` on Vercel → confirms in Discord

**`/book-prospect`**
- Options: `prospect` (autocomplete from Zoho Leads), `time`, `type`
- Flow: converts Lead to Contact+Account in Zoho → calls `/api/book` → confirms in Discord

### Command Registration
```bash
cd discord-bot
node register.js
# Clears global commands first, then registers guild commands (instant)
```

**Key lesson learned**: Global commands take up to 1 hour to propagate. Guild commands are instant. Always register to guild for development and production.

---

## 9. Upload Prospects — Full Feature History

This section documents the complete history of the upload feature including all iterations, bugs, and fixes.

### What It Does
Accepts a CSV file, cleans and maps fields, creates leads in Zoho CRM in bulk, tags existing leads with new event attendance, and logs everything to Google Sheets.

### The Rules Engine (`app/api/upload-prospects/route.ts`)

**Rule 1 — Priority filter**
If `Priority` column value is `"Skip"` (case-insensitive) → exclude the row entirely. Shown as "Excluded" (grey) in results.

**Rule 2 — Smart email selection**
Prefers work email (any column header containing "work" + "email") over personal email. Falls back to personal if work email is a free provider (gmail, yahoo, hotmail, outlook, live, rediffmail, icloud, etc.). Row is invalid only if both are empty.

**Rule 3 — Placeholder cleanup**
Values of `.` or `-` or `n/a` or `na` or `none` → treated as empty.

**Rule 4 — Phone normalisation**
Strips all non-digit characters. Prepends `+` if > 10 digits. Scientific notation in CSVs (e.g. `9.19884E+11` from Excel display) is a display-only issue — the raw CSV text has the full number.

**Rule 5 — City validation**
Maps `city` or `location` column to Zoho `City` field. Skips all-digit values, n/a, dashes, etc.

**Rule 6 — Attendance → Lead Status**
| CSV value | Zoho Lead_Status |
|---|---|
| attended, yes, true, 1, going, checked in, approved | Contacted |
| anything else / absent | Not Contacted |

**Rule 7 — Empty column headers**
Columns with blank headers are ignored entirely.

**Rule 8 — Name fallback chain**
1. Use `First Name` + `Last Name` if both present
2. If last name is empty/dot placeholder, split full `Name` column
3. If no name at all, use Company as Last Name
4. Zoho requires Last_Name — rows without any name or company are errored

**Rule 9 — Within-file deduplication**
Before sending to Zoho, deduplicate by email (case-insensitive), phone (normalised), and full name. First occurrence wins; subsequent = "Skipped (duplicate in file)".

**Rule 10 — P1/P2/P3 tagging**
If `Priority` column has `P1`, `P2`, or `P3` (case-insensitive), that value is added as a Zoho tag on the lead automatically.

**Rule 11 — Duplicate event tagging (upsert)**
When Zoho returns `DUPLICATE_DATA` for an email, instead of just skipping:
1. Searches for the existing lead by email
2. Adds the Lvl 2 Source value (e.g. "RAG Workshop with Janani (04.06.26)") as a Zoho tag
3. Status shown as "Updated" (blue) instead of "Skipped"
This enables multi-event attendance tracking without creating duplicates.

### Column Detection — Supported Headers

| Field | Detected headers |
|---|---|
| First Name | firstname, first name, first_name |
| Last Name | lastname, last name, last_name |
| Full Name | name, fullname, full name, attendee, participant |
| Company | company, organization, organisation, account, company name, employer, org |
| Email | email, emailaddress, email address, e-mail, contact email |
| Work Email | any header containing both "work" and "email" |
| Phone | phone_number, phone, mobile, phone number, contact number, contact phone, cell, telephone, work phone |
| Designation | designation, title, role, job title, position, job role, seniority |
| City | city, location |
| Attendance | attendance, checked in, check in, ticket status, registration status, going, status |
| Priority | priority |

### Source Platform Support
| Platform | Notes |
|---|---|
| **Zoom** | Full support — work email, phone_number, organisation, attendance, city, priority |
| **Apollo.io** | Contact Email, Contact Phone, Location (city), Company Name, Job Title |
| **Luma** | Checked In / Going / Not Going / Pending / Waitlist for attendance |
| **GMass** | EmailAddress, FirstName, LastName, Company |
| **Google Forms** | Works if question labels match above variants (inherently unpredictable) |
| **Manual lists** | Any CSV with at minimum an Email column |

### Lvl 1 Source Options
- Webinar
- Events
- Email
- Cold Outreach (Apollo, bought lists)
- Referrals
- Internal Community Data

### Lvl 2 Source
- Loaded live from Zoho's `Lvl_2_Source` picklist on page load
- Can add new values directly from the dashboard — writes to Zoho's field metadata immediately
- Current values include: TribeQonf'25, TribeQonf'26, QonfX'25 (Hyd), QonfX'25 (Blr), QonfX'26 (Blr), Testflix'25, Webinar - Ganesa (22.04.26), Webinar - Anshu Tiwari (19.05.26), Webinar - RAG Workshop with Janani (04.06.26), Email Sample Set, IntComData - As of 22.05.26, Saurabh Mishra

### Results Display
5-card grid: **Created** (green) / **Updated** (blue) / **Skipped** (yellow) / **Excluded** (grey) / **Errors** (red)

### Google Sheets Logging
Every created and updated lead is logged to the `Prospects` tab:
`Date | Email | First Name | Last Name | Company | Designation | City | Phone | Lvl 1 Source | Lvl 2 Source | Priority | Status`

### Iteration History

| Iteration | Issue | Fix |
|---|---|---|
| v1 | Basic CSV upload, no field cleaning | — |
| v2 | Real webinar CSV had work email, phone_number, city, attendance columns not mapped | Added all field detection rules |
| v3 | Upload showed 0/0/0 | TypeScript build error — `'excluded'` missing from status union |
| v4 | 870 "Created" but nothing in Zoho | Zoho's 100-record limit — sending all at once returned no `data` array. Added BATCH_SIZE=100 loop |
| v5 | Company field null on all leads | Zoho Leads has two fields: `Company` and `Company_Name`. Both must be sent |
| v6 | Source selectors only visible after file selection | Moved Lvl 1/Lvl 2 selectors above drop zone — always visible |
| v7 | Source selectors hardcoded | Made Lvl 2 a live Zoho picklist lookup with "+" to add new values inline |
| v8 | Phone numbers showed as 8-digit truncated (`91967811`) | Scientific notation in CSV — added `normalisePhone` |
| v9 | Phone numbers showed trailing zeros (`+917711000000`) | `parseFloat` lost precision — reverted to simple strip, Excel display was misleading |
| v10 | Duplicate leads just skipped | Added upsert behaviour — tags existing lead with event name instead |
| v11 | P1/P2/P3 not tracked | Added auto-tagging from Priority column |
| v12 | No audit trail | Added Google Sheets logging to Prospects tab on every upload |
| v13 | Multiple format sources | Expanded column detection for Apollo, Luma, GMass |

---

## 10. Google Sheet Structure

**URL**: https://docs.google.com/spreadsheets/d/1aIbzFh0vH-9XYeuNeNRRqcyG_dWnwIPBs4cqJGyyoD4/edit

| Tab | Columns | Written by | Status |
|---|---|---|---|
| **Meetings** | Meeting ID, Account Name, Contact Name, Contact Email, Meeting Time, Meeting Type (L1/L2/L3+), G-Meet Link, Deal ID, Status, Notes Status, Created At | `/api/book` + OpenClaw | Exists |
| **Notes** | Meeting ID, Account Name, Summary, Actionables, Assigned To, Created At | OpenClaw Notes Summarisation Agent (via Circleback MCP) | Exists |
| **Communications** | Thread ID, Account Name, Source (Discord/Gmail), Message Preview, Timestamp | OpenClaw Communications Tracker Agent | Exists |
| **Accounts** | Account Name, Primary Contact, Contact Email, Stage, Last Activity | Manual + OpenClaw | Exists |
| **Prospects** | Date, Email, First Name, Last Name, Company, Designation, City, Phone, Lvl 1 Source, Lvl 2 Source, Priority, Status | `/api/upload-prospects` | Exists — uncalled leads only |
| **Calling** | Date Moved, Email, First Name, Last Name, Company, Designation, City, Phone, Lvl 1 Source, Lvl 2 Source, Priority, Original Upload Date | Calling Team Agent (when call is logged) | New |
| **Calls** | Date, Time, Account, Contact Name, Contact Phone, SDR, Duration, Outcome, Notes, Zoho Call ID, Follow-up Date, Recording Drive Link, Transcript Summary, Auto Tags | Calling Team Agent + Call Transcription Agent | New |
| **Targets** | Month, Metric Name, Target Value, Actual Value | `#targets` Discord channel bot | New |
| **Tasks** | Date, Task, Type (P0/Objective), Assigned To, Linked Deal, Status, Completed At | P0 Agent + manual | New |
| **Payments** | Date, Account, Deal, Amount, Invoice Date, Due Date, Status, Notes | Manual + Payments Agent | New |
| **Trainers** | Trainer ID, Name, LinkedIn, Specialisation, Availability, Day Rate, Rating Score, Status (Prospect/Vetted/Onboarded), Contract Signed, Notes | Supply Agent | New |
| **People** | Email, First Name, Last Name, Company, Designation, City, Phone, Lvl 1 Source, Lvl 2 Source, Priority, Lead Status, Account Intelligence Summary, Last Updated | People & Accounts Agent | New |
| **Account Intelligence** | Account Name, Updated At, Meeting Count, Last Meeting, Status, Email Intel, Circleback Intel, Call Intel, Manual Notes, Cumulative Summary, Next Action, Last Contact Date (cols A–L) | All intel triggers + scripts | Live — 177 accounts |
| **Contact Intelligence** | 23 cols: Zoho IDs, Name, Email, Phone, Title, Company, L1/L2 Source, SDR, call stats, meeting booked, last call date/outcome, Zoho stage, call history JSON (cols A–W) | `scripts/build-contact-intelligence.js` | Live — 2,372 contacts |

**Key data rule — Prospect → Calling transition**: When any call is logged for a prospect, the row moves from the `Prospects` tab → `Calling` tab. The `Prospects` tab always represents uncalled leads only ("calling stock"). Weeks of stock = `COUNT(Prospects rows) ÷ 250` (Tanishq's weekly call capacity).

---

## 11. Mission Control Dashboard — Full Build Plan

> Last updated: 2026-06-06. This section replaces all prior planning notes for the dashboard.

### Overview

The current Sales Pipeline homepage will be replaced by the **Master Tracker** — a live business command centre. The system is backed by a multi-agent AI layer (OpenClaw on Hostinger VPS) with Discord as the interaction surface.

**13 modules. 4 personalised views. 1 master orchestrator.**

---

### 11.1 — Agent Architecture

```
                    ┌──────────────────────────────┐
                    │   MOONLIT HORIZON             │
                    │   (Master Orchestrator)       │
                    │   Listens on: #sales-ops      │
                    └────────────┬─────────────────┘
                                 │ routes to
     ┌──────────┬────────────────┼────────────┬──────────┬──────────┬──────────┐
     ▼          ▼                ▼            ▼          ▼          ▼          ▼
  Calling    Meetings          Emails       Funnel      P0s       Stats    Payments
   Team        Team             Team         Team       Team       Team      Team
     │           │               │            │          │          │          │
#calls-log  #meetings-log   #email-log  #funnel-upd  #p0-tasks   #stats   #payments
```

**Platform**: OpenClaw on Hostinger VPS (no additional cost)

**Master Agent — Moonlit Horizon**
- Single entry point: commands arrive in `#sales-ops`
- Routes to the right sub-agent team; handles cross-module queries
- Daily morning briefing at 9am IST → `#sales-ops`
- Weekly digest every Monday 9am → `#stats`

**Example commands:**
```
/mh status Wabtec
/mh briefing
/mh book meeting
/mh log call
/mh p0 today
/mh funnel
/mh stats
```

---

### 11.2 — Homepage: Master Tracker

The homepage is a **five-column live metrics grid**. All columns show toggle: **Daily | Weekly | Monthly**. Targets shown in muted grey; achieved value is larger and glows gold (`#FFD700`) when actual ≥ target.

---

**Column I — Calls**

| Metric | Source | Notes |
|---|---|---|
| Calls Dialled | `Calls` Sheets tab + Zoho CRM Calls module | Cross-checked; any discrepancy flagged |
| Calls Connected | Zoho CRM call results: Meeting Scheduled / Call Back Later / Send More Info / Connected / Not Interested | Any result confirming the call was answered |
| Meetings Booked | `Meetings` Sheets tab + Zoho Deals (stage ≥ "Meeting Booked") | Must match; discrepancy flagged |

---

**Column II — Meetings**

| Metric | Source | Notes |
|---|---|---|
| L1 Meetings Booked | Zoho Deals — always matches `Meetings` sheet | Discrepancy auto-flagged |
| L1 Meetings Conducted | Circleback MCP (notes received = conducted); SDR fallback via Discord; Zoho Deal stage | Each conducted meeting: LLM extracts 2-3 line action points per person (Tanishq / Ashutosh / Anurag / trainer / Mahesh) stored in `Notes` tab (Assigned To column). Account Intelligence generated and stored in `People` tab. |
| L2 Meetings Conducted | `Meetings` Sheets tab filtered by Meeting Type = "L2+" | |

---

**Column III — Leads**

Hot / Warm / Cold counts with icon and % change week-on-week.

| Bucket | Score range | Source |
|---|---|---|
| Hot | ≥ 75 | Zoho CRM lead score |
| Warm | 50–74 | Zoho CRM lead score |
| Cold | < 50 | Zoho CRM lead score |

---

**Column IV — Current Funnel**

Visual funnel from Zoho Deal stages:
`Prospect → Call Attempted → Connected → L1 Booked → L1 Conducted → L2 Booked → L2 Conducted → Proposal Sent → Negotiation → Won / Lost`

Count + value at each stage. Drawn as a narrow vertical funnel or horizontal bar chart.

---

**Column V — Metrics Graph**

Filter bar: **Calls | Meetings | Lead Conversion | Emails**. Weekly time series.

| Metric | Category |
|---|---|
| Calls Dialled | Calls |
| Calls Connected | Calls |
| Meetings Booked | Calls |
| Calls Dialled → Connected % | Calls |
| Connected → Meeting Booked % | Calls |
| Meeting Booked → L1 Conducted % | Meetings |
| L1 → L2 Conversion % | Meetings |
| L2 → L3+ % | Meetings |
| Dials to Payment Conversion | Lead Conversion |
| Lead Conversion Time per stage | Lead Conversion |
| Emails Sent per week | Emails |
| Email Open Rate | Emails |

Lead Conversion Time = days a lead stays in each stage, calculated from Zoho creation date + status change history.

---

**Below the columns:**

**Weekly Summary** — LLM-generated, 5 bullets. Sources: all Sheets tabs + Zoho Deals + Calls. Covers: what went well, what didn't, focus areas, objective progress, notable lead movements. Auto-posted to `#stats` every Monday 9am IST.

**Monthly Summary** — LLM-generated, posted to `#stats` on the 1st of each month with a download link to the monthly report PDF.

*(Phase 3 — optional)* A named AI persona (e.g. "MH") in the bottom-right corner of the dashboard. Click → real-time LLM summary from live data.

---

### 11.3 — Person Views

Four circular avatar icons at the top of every page (M / A / A / T — initials). Active view has a Vermillion ring. Clicking switches context. Default = **Overall Business** (all modules).

Icons use initials for Phase 1; face illustrations (Midjourney or equivalent) deferred to Phase 3.

---

**Mahesh's View** — Founder. Busy. Numbers only.

| Section | Content |
|---|---|
| Weekly Summary | Max 6-7 bullets. Metric deviations from targets (WoW delta for: Calls Dialled, Connected, L1 Booked, L2 Booked, L3+ Booked, Payment Pending, Negotiation, Won, Lost). What's working, what isn't, payment status. |
| Weekly Report | Download link (PDF, auto-generated Sunday night) |
| Monthly Report | Download link (auto-generated 1st of month); previous month link stays visible |
| Stats at a Glance | Same 5-column grid as homepage (condensed) |
| Call-outs & Reminders | Card list from `/reminder` Discord command |
| Funnel View | Same funnel chart as homepage |

*Revisit after first weekly use for any additional items.*

---

**Ashutosh's View** — Co-founder, daily operations, manages Anurag + Tanishq.

| Section | Content |
|---|---|
| Weekly Summary | Operations-focused |
| Prospect Database Health | Total uncalled count; weeks of stock remaining (÷ 250/week); breakdown by Lvl 1 Source; ⚠ notice if any source < 2 weeks; actionable per source |
| Email Status | Weekly + Monthly: Emails Sent / Opened / Actions. Filter by Lvl 1 + Lvl 2 Source. Active campaign performance view. |
| Pending Tasks | `Tasks` tab filtered by Assigned To = Ashutosh / Anurag / Tanishq |
| Funnel | Same as homepage |
| Leads Overview | Hot/Warm/Cold counts + Total + WoW change |
| Weekly Report | Download link (Ashutosh-specific: pipeline health, calling performance, objective progress) |
| Objective Progress | Short-term + long-term progress bars per objective area |

Source types tracked in Prospect Database Health: Events (Webinars + Conferences), Cold-Engineering (Apollo), Cold-L&D (Apollo), Email-Engineering, Email-L&D, Referrals, Internal Community Data.

---

**Tanishq's View** — SDR. Daily execution: who to call, what meetings are coming up.

| Section | Content |
|---|---|
| Targets vs Achieved | Toggle: Daily / Weekly / Monthly. Calls Dialled / Connected / Meetings Booked — target vs actual. Gold glow when achieved ≥ target. Targets from `Targets` Sheets tab; daily = monthly ÷ 22; weekly = monthly ÷ 4. |
| Prospects to Call — Today | Top 50 uncalled leads by score. Download CSV link. |
| Prospects to Call — This Week | Top 250 uncalled leads, split Mon–Fri (50/day). Download link per day + weekly cumulative. Ranked by Lead Scoring Rubric (Fit 10pts + Need 20pts + Budget 13pts + Authority 13pts + Timeline 8pts = 64pts max from available fields; remaining 36pts from Engagement + Personal where known). Re-ranked every Sunday 11pm. Top 250 get `#top250` tag in Zoho; tag removed from those outside 250. |
| Meetings for Today | Card list. Cards flip on click to reveal account intel summary (from People & Accounts, sourced via Circleback MCP). |
| Follow-ups & Reminders | To-do card list: leads stale in same stage too long; leads with overdue actionables; leads tagged for callback from previous call. |

---

**Anurag's View** — Category Head. Cross-functional overview.

| Section | Content |
|---|---|
| Pending Tasks | All open tasks across Tanishq + Ashutosh + Anurag (`Tasks` tab) |
| Objective Tracking | All objective areas, short-term + long-term progress bars |
| Meetings Today | Same card view as Tanishq's |
| Funnel at a Glance | Condensed funnel |
| Payments Pending | Invoices due or overdue |
| Prospect Database Health | Same as Ashutosh's view |
| Quick Links | Zoho CRM, Google Sheets, Calendar, Circleback, Discord, Upload Prospects, Book Meeting |

*This view will be finalised after Phase 1 build using cumulative real data.*

---

### 11.4 — All Modules

#### Module 1 — Prospect Database
- **Source**: `Prospects` tab (uncalled only) + Zoho CRM Leads (Not Contacted)
- **Shows**: total count, weeks of stock by source, source breakdown chart
- **Interaction**: download top-250 list, trigger manual re-ranking
- **Agent**: Prospect Health Monitor — posts to `#funnel-updates` when any source drops below 2-week threshold

#### Module 2 — Calling
- **Source**: `Calls` Sheets tab + Zoho CRM Calls module
- **Shows**: calls today / this week / this month; by outcome; by SDR; timeline of recent calls
- **Prospect transition**: when a call is logged → row moves from `Prospects` tab → `Calling` tab
- **Agents**: Call Logger, Call Monitor (polls Zoho every 30min), Call Summariser

**Call Recording Pipeline:**
- iPad recordings uploaded manually to Google Drive folder `Call Recordings/`
- Call Transcription Agent uses Google Drive MCP (`list_recent_files`, `download_file_content`) to detect new files
- **Transcription**: Whisper (open-source, Docker on Hostinger VPS) — zero cost, no API tokens
- **Linking**: filename convention `YYYYMMDD_FirstnameLastname.m4a` → agent matches to Zoho contact
- **Post-transcription**:
  1. Transcript stored in `Calls` tab (Recording Drive Link + Transcript Summary columns)
  2. LLM generates 3-5 line call summary (~500 tokens)
  3. Zoho auto-tagged via keyword matching (no LLM): `Callback-Requested`, `Not-Interested`, `Meeting-Scheduled`
  4. If meeting scheduled: triggers meeting booking flow automatically
  5. Summary appended to account intelligence in `People` tab

#### Module 3 — Emails
- **Source**: `Communications` Sheets tab + Gmail API
- **Shows**: threads by account, filter by date/source, unactioned threads flagged
- **Metrics**: emails sent per week, open rate (GMass or equivalent tracking)
- **Agents**: Comms Tracker (existing ✅) + Email Draft Agent (new 🆕)

#### Module 4 — Meetings
- **Source**: `Meetings` Sheets tab + Google Calendar + Zoho Deals
- **Circleback MCP** is the primary source for meeting notes and transcripts. All agents needing meeting context call Circleback MCP (`SearchMeetings`, `ReadMeetings`, `GetTranscriptsForMeetings`). No reliance on manual notes entry.
- **Shows**: upcoming meetings, meeting funnel (Booked → Conducted → Follow-up Sent → Proposal Sent), notes status per account
- **Action points**: per meeting, LLM extracts 2-3 line actions assigned per person (Tanishq / Ashutosh / Anurag / trainer / Mahesh)
- **Agents**: Meeting Booking Agent ✅, Notes Summarisation Agent ✅, Follow-up Reminder Agent 🆕 (24h after meeting with no follow-up → ping SDR in `#meetings-log`)

#### Module 5 — People & Accounts
- **Two Sheets tabs**: `People` (all contacts) + `Accounts` (companies with meeting history)
- **People tab**: contacts with full history, lead status, account intel summary
- **Accounts tab**: company-level view — all contacts at that company, deal stage, last activity, notes
- **Account Intelligence**: LLM aggregates Zoho CRM history + Circleback MCP transcripts + email threads + Communications tab → stored in `People` tab → surfaced as flip card (Tanishq's view) and detail panel (client page)
- **Trigger**: regenerated whenever a new meeting or email arrives for an account (~1,500 tokens/account)
- **Phase 2+ module** — data collection starts in Phase 1

#### Module 6 — P0 Tasks
- **Source**: `Tasks` Sheets tab
- **P0 Generator**: runs 8:30am IST — auto-creates tasks from meetings with no follow-up (>24h), proposals overdue, payments pending
- **P0 Notifier**: tags assignee in `#p0-tasks`; re-pings at 2pm if still open
- **P0 Closer**: listens for "done" / "mark complete" in `#p0-tasks` → updates Sheets

#### Module 7 — Objectives
- **Short-term** (weekly/monthly) + **long-term** (quarterly) per objective area
- **Objective areas**: Lead Generation, Calling, Meetings, Lead Conversion, Trainer Supply, Service Delivery, Admin, Process Setup, Revenue, Team Capacity
- **Update via Discord**: `/objective update` → bot asks short-term or long-term → objective area → logs to `Tasks` tab (Type = Objective)
- **Dashboard**: progress bars per area, grouped by short/long-term
- **Discord channel**: `#objectives`

#### Module 8 — Reports
- Auto-generated PDFs: Weekly (Sunday night) + Monthly (1st of month)
- Mahesh view: metric deviations, payments
- Ashutosh view: pipeline health, objectives
- Anurag view: full operational summary
- Download links on each person's view
- *PDF generation tool TBD: Puppeteer, @react-pdf/renderer, or Sheets export. Decide before Phase 1b.*

#### Module 9 — Payments
- **Source**: `Payments` Sheets tab (manual entry to start)
- **Shows**: invoiced / received / outstanding this month; per-deal status; overdue invoices
- **Agents**: Invoice Tracker + Overdue Alerter (daily check; tags Anurag in `#payments`)
- **Future**: Zoho Books or Razorpay API integration

#### Module 10 — Stats
- Aggregates all metrics from all other modules
- Daily snapshot → `#stats` at 9am IST
- Weekly digest → `#stats` every Monday

#### Module 11 — Supply (Trainer Sourcing)
Trainer pipeline: LinkedIn outreach → Google Form → Meeting → Sample Video review → Rating Rubric → Onboarded

| Stage | Action |
|---|---|
| LinkedIn | Connection + message sent |
| Google Form | Trainer fills in profile, specialisations, availability, day rate, sample video |
| Meeting | Booked via Moonlit Horizon booking flow |
| Sample Video | Reviewed via Google Drive link in Form response |
| Rating Rubric | Scored on: technical depth, delivery quality, responsiveness, pricing (rubric in existing Google Sheet — user to share link) |
| Onboarded | Contract signed; added to `Trainers` Sheets tab with Status = Onboarded |

**Dashboard view**: trainer pipeline stage counts, upcoming actions, available trainers by specialisation, deal-trainer mapping (which trainer is confirmed for which engagement).

*Details TBD: user to share Google Form and rating rubric Sheets before Phase 3.*

#### Module 12 — Lead Generation
- Tracks lead source performance: # uploaded / # called / # connected / # meetings booked — per source
- Identifies top-performing and underperforming sources
- Alerts when a source type drops below threshold

#### Module 13 — Quick Links
- Static card grid: Zoho CRM, Google Sheets, Google Calendar, Circleback, Discord, Upload Prospects, Book Meeting
- No agent. Pure UI.

---

### 11.5 — Monthly Target Setting (#targets Flow)

1. **1st of each month**: bot posts a structured message in `#targets` requesting targets for all tracked metrics
2. Team fills in the values; bot records to `Targets` Sheets tab
3. Message is pinned for the month
4. **Last day of month**: bot compares actuals vs targets for each metric, posts end-of-month recommendations, unpins old message
5. **Daily/weekly derivation**: daily target = monthly ÷ 22 working days; weekly = monthly ÷ 4

---

## 12. Design System

### Colours

| Role | Hex | Usage |
|---|---|---|
| Background | `#0A0A0A` | Page background (near-black) |
| Surface / cards | `#111111` / `#161616` | Card backgrounds, alternating table rows |
| Primary text | `#FFFFFF` | All body and metric text |
| Secondary text | `#999999` | Labels, timestamps, helper text |
| Accent | `#E8341C` | Vermillion — metric labels, active states, pointers |
| Positive delta | `#22C55E` | Green — % change indicators only, used sparingly |
| Negative delta | `#FF4444` | Red — % change indicators only, used sparingly |
| Target achieved | `#FFD700` | Gold glow — achieved metric when actual ≥ target |
| Border | `#2A2A2A` | Card and table borders |

Gold glow CSS: `box-shadow: 0 0 12px #FFD70088; color: #FFD700;`

### Typography

**Font**: Poppins (Google Fonts) — add via `next/font/google`. Fallback: Inter.

| Element | Weight | Size |
|---|---|---|
| Primary KPI values | 600 | 2.5–3rem |
| Secondary metrics | 600 | 1.5–2rem |
| Section headings | 700 | 1.25rem |
| Card labels (Vermillion) | 400 | 0.75rem, uppercase, letter-spacing 0.05em |
| Body text | 400 | 0.875rem |
| Secondary / muted | 400 | 0.75rem, `#999999` |

### Components

All cards: `border-radius: 12px; padding: 20px; border: 1px solid #2A2A2A; background: #111111;`

All tables: alternating rows `#111111` / `#161616`; header row `#1A1A1A` with Vermillion text.

Person view circles: 40px diameter, initials centred (Poppins 600), active view = 2px Vermillion ring.

Spacing unit: 8px grid. Target achieved value: larger font + gold glow. Metric that is below target: shown normally (no red — red is only for explicit negative % change).

### Responsiveness
Desktop-first at 1280px+. Layout must not break at 1024px.

---

## 13. Data Architecture & Lead Journey

### The Full Lead Journey

```
[CSV Upload] → Prospects tab (Not Contacted, uncalled stock)
                    ↓
           [Top-250 re-ranking] every Sunday 11pm
           Score by Fit/Need/Budget/Authority/Timeline rubric
           Top 250 get #top250 Zoho tag
                    ↓
       [Tanishq calls] → Call logged (Zoho CRM + Calls tab)
       Prospect row moved: Prospects tab → Calling tab
                    ↓
            [iPad recording uploaded to Drive]
            Whisper transcription → Calls tab
            Zoho auto-tagged (keyword match)
                    ↓  (if call connected)
            Lead_Status = Contacted in Zoho
                    ↓  (if meeting scheduled)
            Zoho Deal created → Meetings tab row added
                    ↓
         [L1 Meeting Conducted]
         Circleback MCP → Notes tab (summary + action points)
         Account Intelligence generated → People tab
                    ↓
         [L2 Meeting Conducted]
                    ↓
         [Proposal Sent → Won]
         Payments tab (invoice created)
                    ↓
               Payment Received
```

### Prospect Stock Rule

- `Prospects` tab = Not Contacted only (uncalled stock)
- `Calling` tab = anyone a call has been logged for
- Movement is one-way: once a call is logged, a lead never returns to Prospects tab
- **Weeks of stock** = `COUNT(Prospects rows) ÷ 250`
- Low stock threshold: < 2 weeks remaining for any source type → Prospect Health Monitor alert

### Top-250 Weekly Re-ranking

Runs every Sunday at 11pm IST:
1. Agent reads all rows in `Prospects` tab
2. Scores each lead using: Fit (10pts) + Need (20pts) + Budget (13pts) + Authority (13pts) + Timeline (8pts) = 64pts max from available fields
3. Top 250 by score → tagged `#top250` in Zoho CRM; tag removed from all others
4. Tanishq's call list is built from this tagged set each week
5. Process is fully rule-based — zero LLM tokens consumed

### Account Intelligence

Generated per account when a new meeting or email arrives:
- **Input**: Zoho CRM field history + Circleback MCP transcripts/notes + `Communications` Sheets tab threads
- **Output**: 200-word summary stored in `People` tab (Account Intelligence Summary column)
- **Surfaced**: flip card in Tanishq's meetings view; detail panel in `/client/[account]` page
- **Token cost**: ~1,500 tokens/account/update

---

## 14. Discord Channels & Slash Commands

### Channel Structure

| Channel | Purpose | Posting agents |
|---|---|---|
| `#sales-ops` | All commands in — single entry point | Moonlit Horizon master + morning briefing |
| `#calls-log` | Call logs, summaries, daily tally | Calling Team |
| `#meetings-log` | Booking confirmations, follow-up reminders | Meetings Team |
| `#email-log` | Thread alerts, email draft suggestions | Emails Team |
| `#funnel-updates` | Deal stage changes, stale alerts, prospect DB low-stock alerts | Funnel Team + Prospect Health Monitor |
| `#p0-tasks` | Today's critical tasks, completions | P0 Team |
| `#objectives` | Objective updates, progress tracking | Objectives bot |
| `#stats` | Daily/weekly/monthly digest + summaries | Stats Team |
| `#payments` | Invoice sent, payment received, overdue alerts | Payments Team |
| `#targets` | Monthly target setting; pinned message; end-of-month review | Targets bot |

### Slash Commands

| Command | Effect |
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

---

## 15. Testing Strategy & Failure Recovery

### Integration Failure Modes

| Integration | Common Failure | Detection | Recovery |
|---|---|---|---|
| Zoho CRM API | 401 Unauthorized | Token expiry (> 55min idle) | `_tokenCache` auto-refreshes on next call — transparent |
| Zoho CRM API | 429 Rate Limit | `RATE_LIMIT` in response | Exponential backoff, max 3 retries with 1s/2s/4s delays |
| Google Sheets | 403 Forbidden | OAuth refresh expired | If refresh fails → `console.error` + Discord alert to `#sales-ops` via bot |
| Google Sheets | Append fails silently | No rows written | **Fix needed**: send Discord alert in `appendProspectRows` catch block |
| Zoho Leads batch | Empty `data` array | `json.data` undefined | Already handled — marks entire batch as errors |
| Discord bot crash | Process exits | VPS has no auto-restart | **Fix needed**: use `pm2` to manage the bot process; `pm2 startup` for auto-restart on reboot |
| Whisper Docker | Container down | Transcription job fails | Job queued; retry after 5 min; alert to `#calls-log` if still failing |
| OpenClaw agent | Hallucinated tool call | LLM error / unexpected output | Each agent has `max_iterations = 5`; failures posted to `#sales-ops` |
| Vercel build | TypeScript error | CI fails, no deploy | Check all `UploadResponse` branches include `updated` field |
| Vercel deployment | Queued / stuck | Dashboard shows Queued > 10min | Cancel all queued from Vercel dashboard; redeploy latest SHA |
| Circleback MCP | No meeting found | Empty search result | Graceful fallback — log to Notes tab as "Notes pending" |
| Google Drive MCP | File not found | `download_file_content` 404 | Skip file; post filename to `#calls-log` for manual re-upload |

### Pre-deploy Smoke Test

Before every production deploy:
1. Upload a test CSV (5 rows: 1 normal, 1 duplicate, 1 Skip priority) → verify: 1 created, 1 updated/skipped, 1 excluded
2. Check Zoho lead created with correct Lvl 1 + Lvl 2 Source and any tags
3. Check `Prospects` tab in Sheets has the new row
4. Check Lvl 2 Source dropdown still loads from Zoho API

### Call Recording Test
1. Upload a test `.m4a` named `YYYYMMDD_TestUser.m4a` to the `Call Recordings/` Drive folder
2. Verify Whisper transcription completes within 2 minutes
3. Verify `Calls` tab has the new row with Transcript Summary filled
4. Verify Zoho contact receives the auto-tag matching the transcript content

---

## 16. Token Optimisation Guardrails

### Principles

1. **Agents never receive raw data dumps.** Always aggregate server-side first; pass only summaries to the LLM.
2. **Dashboard reads are cached** for 5 minutes in the API route — no re-fetch on every component render.
3. **Summaries are cached with TTL.** Weekly/monthly summaries stored in `Tasks` tab with a `Generated At` timestamp. Regenerate only if > 7 days old or explicitly triggered.
4. **Account Intelligence is event-triggered**, not scheduled — regenerated only when a new meeting note or email arrives for that account.
5. **Top-250 re-ranking is rule-based** — zero LLM tokens.
6. **Call recording tagging is rule-based** — keyword match on transcript, no LLM.
7. **Discord bot only processes messages in designated channels** — not the full server stream.
8. **All polling loops have minimum intervals**: Calls = 30min, Gmail = 15min, Funnel = 60min. No sub-minute polling.

### Token Budget (approximate)

| Task | Tokens in+out | Frequency | Monthly cost |
|---|---|---|---|
| Daily morning briefing | ~2,000 | Daily | ~60,000/mo |
| Weekly summary generation | ~4,000 | Weekly | ~16,000/mo |
| Monthly report generation | ~8,000 | Monthly | ~8,000/mo |
| Account intelligence update | ~1,500/account | Per meeting/email | Varies |
| Meeting action points extraction | ~1,000/meeting | Per conducted meeting | Varies |
| Call summary (LLM) | ~500/call | Per transcribed call | ~10,000/mo at 20 calls/day |
| Email draft suggestion | ~1,200 | On-demand | Minimal |
| Top-250 re-ranking | 0 | Weekly | 0 |
| Call auto-tagging | 0 | Per call | 0 |

**Total baseline (before account intel and meeting actions)**: ~94,000 tokens/month.

OpenClaw model selection: use the cheapest model tier for rule-following tasks (call logger, P0 generator); reserve Claude Sonnet 4.x for intelligence tasks (account intel, summaries, email drafts).

---

## 17. Build Sequence & Timeline

### Phase 0 — Foundation ✅ Complete

- [x] Add Poppins to Next.js via `next/font/google`; update `tailwind.config.ts` with design tokens (colours, font, spacing)
- [x] Create new Sheets tabs: `Calls`, `Calling`, `Targets`, `Tasks`, `Payments`
- [x] Create Discord channels: `#targets`, `#objectives`
- [x] Set up `pm2` on VPS for Discord bot auto-restart

### Phase 1 — Master Tracker UI ✅ Complete

- [x] Replace homepage (`app/page.tsx`) with Master Tracker 5-column layout
- [x] Column I: Calls metrics (Zoho Calls + Sheets Calls merged, deduped by date+account)
- [x] Column II: Meetings metrics (from `Meetings` tab + Zoho Deals)
- [x] Column III: Leads Hot/Warm/Cold counts (from Zoho CRM)
- [x] Column IV: Funnel (from Zoho Deals — all stages, count + amount)
- [x] Column V: Metrics graph (Recharts 8-week line chart)
- [x] Weekly Summary card (LLM bullets from Summaries sheet)
- [x] Person view selector (4 circles at top of every page)

### Phase 1b — Person Views UI ✅ Complete

- [x] Mahesh's view — Won/Pipeline/Value; Funnel; 6-stat grid; Weekly Summary; Weekly + Monthly PDF links
- [x] Tanishq's view — Daily/Weekly/Monthly targets with gold glow; Today's Meetings; Follow-ups
- [x] Ashutosh's view — Leads H/W/C; Funnel; Prospect DB Health; Pending Tasks; Objective Progress bars; Trainer Supply; Monthly PDF link
- [x] Anurag's view — Today's Meetings; Funnel; Pending Tasks; Payments Pending; Objective Progress bars; Quick Links; Weekly + Monthly PDF links
- [x] PDF reports via `@react-pdf/renderer` (declared as `serverExternalPackages` in `next.config.js`)

### Phase 2 — Core Agent Layer ✅ Complete

- [x] All slash commands live (see Section 14)
- [x] Scheduled cron jobs: P0 scan, daily digest, weekly summary, Top-250, monthly targets, end-of-month review
- [x] P0 Generator, P0 Notifier, P0 Closer
- [x] Stats Team: Daily Stats Agent, Weekly Digest Agent
- [x] Payments: `Payments` tab + `/mh log payment`

### Phase 2b — Intelligence & Automation Layer ✅ Complete

- [x] LLM Weekly Summary generation (`claude-haiku-4-5-20251001`)
- [x] `#targets` monthly bot (target setting + end-of-month review)
- [x] `/mh objective set` + `/mh objective update` Discord commands
- [x] Top-250 weekly re-ranker (rule-based, Sunday 11pm cron)
- [x] Circleback webhook sync (marks Conducted + writes Notes + updates intel + Last Contact Date)

### Phase 3 — Supply Module ✅ Complete

- [x] Trainer pipeline + roster + topic coverage data from Trainer Sheets
- [x] Trainer pipeline panel on Ashutosh's view
- [x] Sheet A (Outreach & Onboarding): `1Xol3kb_5GDxS-Su-fAs1tIvTSLfGahNXWHv0MKUOY9I`
- [x] Sheet B (Pricing & Supply): `1R8FqcifveekYZsaS3taHARaQAo3CjZ0FqdHnNOcZg2U`

### Phase 4 — Account Intelligence ✅ Complete

- [x] Account Intelligence sheet (cols A–L) for 177 accounts
- [x] 4 intel layers: Email, Circleback, Call, Manual Notes → Cumulative Summary
- [x] Event-driven triggers: Circleback webhook, `/mh log call`, `addManualNote()`
- [x] Gmail intel sync (`scripts/sync-gmail-intel.js`) — pull-based (push pending)
- [x] Last Contact Date (col L) — auto-detected + editable via dashboard + `/mh intel touch`
- [x] Full suite of `/mh intel` Discord commands

### Phase 5 — Contact Intelligence ✅ Complete

- [x] 2,372 unique contacts from DCT v1 written to "Contact Intelligence" sheet
- [x] 64% matched to Zoho Lead/Contact IDs; 96% matched to Zoho Deal IDs
- [x] 23 columns: Zoho IDs, Name, Email, Phone, Title, Company, L1/L2 Source, SDR, call stats, meeting booked, last call date/outcome, Zoho stage, full call history JSON
- [x] 125 unmatched contacts pushed to Zoho Leads
- [x] 204 historical meetings (Jan–Jun 2026) backfilled to Meetings sheet

---

## Open Items

| Item | Owner | Needed by |
|---|---|---|
| Supply Module: share Google Form + rating rubric Sheets | Anurag | Before Phase 3 |
| Anurag's view: finalize after Phase 1 build | Anurag | After Phase 1b |
| Mahesh's view: additional items after first weekly use | Mahesh / Anurag | After first Monday |
| Email open rate tracking mechanism (GMass or equivalent) | Anurag | Before Module 3 build |
| Lead Conversion Time: historical stage data for existing leads | Anurag | Phase 2b |
| Reports PDF generation tool decision | Anurag | Before Phase 1b |
| Person avatar illustrations (initials used in Phase 1) | Anurag | Phase 3 |
| Ashutosh's weekly report: KPI priorities | Ashutosh / Anurag | Before Phase 1b |

---

---

## 19. Account Intelligence — Full Spec

### Sheet Structure (cols A–L)

| Col | Field | Updated by |
|-----|-------|------------|
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

### Event-Driven Triggers

| Trigger | What fires | What updates |
|---------|-----------|--------------|
| New email in Gmail | `sync-gmail-intel.js` (manual/cron — push pending) | Email Intel → Cumulative (`email` priority) |
| Circleback meeting notes | `/api/circleback-sync` webhook | Circleback Intel + Last Contact Date → Cumulative (`meeting` priority) |
| `/mh log call` Discord | `/api/intel-triggers/call` (fire-and-forget) | Call Intel + Last Contact Date → Cumulative (`call` priority) |
| Manual note added | `addManualNote()` server action | Cumulative (`notes` priority — highest weight if recent) |

### Key Functions

- `syncCallIntel(account)` — regenerates Call Intelligence from Calls sheet → updates col H
- `syncCirclebakIntel(account, meetings, date)` — updates col G + Last Contact Date
- `regenerateCumulative(account, changedLayer?)` — recency-weighted prompt; labels most recent layer as "⬆ LATEST UPDATE"

### Gmail Sync Script

`scripts/sync-gmail-intel.js` — searches Gmail for all 177 accounts by contact email + subject `"The Test Tribe <> <Account Name>"`. Excludes newsletters. Compact format: 2-line summary + numbered dated list per thread.

Run: `node scripts/sync-gmail-intel.js` (single account: `node scripts/sync-gmail-intel.js "AccountName"`)

### Known Gap — Gmail Push Notifications

Gmail sync is still pull-based. Next priority: Gmail Watch API + Google Cloud Pub/Sub → `POST /api/intel-triggers/gmail`. See HANDOVER.md §7 Priority 1 for full setup steps.

---

## 20. Contact Intelligence — Full Spec

### Overview

2,372 unique contacts from DCT v1 (cleaned, deduped) written to "Contact Intelligence" Google Sheet tab.

### Match Rates

- 64% matched to Zoho Lead/Contact IDs
- 96% matched to Zoho Deal IDs
- 125 unmatched contacts pushed to Zoho Leads (Callback Later + Send More Info + Meeting Booked outcomes)

### Sheet Schema (cols A–W)

| Col range | Fields |
|-----------|--------|
| A–C | Zoho Lead ID, Zoho Contact ID, Zoho Deal ID |
| D–H | Name, Email, Phone, Title, Company |
| I–J | L1 Source, L2 Source (mapped to Zoho picklist values) |
| K | SDR name |
| L–N | Total calls, Connected calls, Meeting booked (bool) |
| O–P | Last call date, Last call outcome |
| Q | Zoho stage |
| R–T | Call stats breakdown |
| U | Full call history (JSON) |
| V–W | Notes Summary (blank — needs AI enrichment pass) |

### Scripts

- `scripts/build-contact-intelligence.js` — builds and writes the full sheet
- `scripts/export-unmatched-prospects.js` — exports contacts not matched in Zoho

### Known Gap

Column W (Notes Summary) is blank for all 2,372 contacts. Needs an AI enrichment pass using the call history JSON in col U.

---

## 21. Historical Data — DCT v1 & Meetings

### DCT v1 Calling Data (local `../CRM/` files)

| File | Rows | Description |
|------|------|-------------|
| `DCT-v1-cleaned.csv` | 2,759 | Source of truth — clean calling history |
| `never-called-prospects.csv` | 278 | Uploaded but never called — future outreach pool |
| `rnr-prospects.csv` | 577 | RNR + Not Interested — parked |
| `excluded-prospects.csv` | 156 | Not Relevant + Wrong Number — archived |
| `unmatched-prospects.csv` | 125 | Pushed to Zoho Leads (96% match rate) |

### Historical Meetings Backfill

- 204 meetings from Jan–Jun 2026 written to Meetings sheet (IDs: HIST-001 through HIST-204)
- 146/204 linked to Circleback meeting URLs (col G)
- 196/204 linked to Zoho Deal IDs (col H)
- Source CSV: `Others/Dashboard/Jan-June Meetings-CT - Final Cumulative Meeting Sheet.csv`
- Script: `scripts/push-historical-meetings.js`

### Zoho L2 Source Picklist — 6 Values Added (2026-06-07)

- `Webinar - Fireside Chat with Revathi Chanda Syren (30.03.26)`
- `Webinar - Ask Me Anything with Kiran Chandaka (15.04.26)`
- `Fireside Chat with Aparana Gupta (07.04.26)`
- `AI Adoption for IT Leaders - Sahil Garg (08.04.26)`
- `Cutting through the BS of AI: Playwright Agents in Action - Md. Tanweer (22.01.26)`
- `Boosting QA Productivity Through Copilot - Siva Prasad Reddy (24.02.26)`

---

*This document is the single source of truth for the Moonlit Horizon system. Update it as new features are built.*
