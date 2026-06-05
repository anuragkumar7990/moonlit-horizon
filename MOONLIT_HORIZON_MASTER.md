# Moonlit Horizon — Master Reference Document

> The Test Tribe · Corporate Training Business  
> Owner: Anurag Kumar (anurag@thetesttribe.com)  
> Last updated: 2026-06-05

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
11. [What's Planned — Mission Control Dashboard](#11-whats-planned--mission-control-dashboard)

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

| Tab | Columns | Written by |
|---|---|---|
| **Meetings** | Meeting ID, Account Name, Contact Name, Contact Email, Meeting Time, Meeting Type, G-Meet Link, Deal ID, Status, Created At | OpenClaw Meeting Booking Agent + `/api/book` |
| **Notes** | Meeting ID, Account Name, Summary, Actionables, Created At | OpenClaw Notes Summarisation Agent |
| **Communications** | Thread ID, Account Name, Source (Discord/Gmail), Message Preview, Timestamp | OpenClaw Communications Tracker Agent |
| **Accounts** | Account Name, Primary Contact, Contact Email, Stage, Last Activity | Manual + OpenClaw |
| **Prospects** | Date, Email, First Name, Last Name, Company, Designation, City, Phone, Lvl 1 Source, Lvl 2 Source, Priority, Status | `/api/upload-prospects` (auto-created on first upload) |

---

## 11. What's Planned — Mission Control Dashboard

### Overview
The current Sales Pipeline homepage will be replaced by a full Mission Control Dashboard. It will be the single source of truth for the entire business — pulling from Zoho CRM, Google Sheets, and payment systems.

### The 5 Views
The dashboard opens to **Overall Business View** by default. A selector at the top lets you switch between:

| View | Focus |
|---|---|
| **Overall Business** | All modules, full picture — the default opening view |
| **Anurag's View** | Strategic metrics, payments, funnel health |
| **Mahesh's View** | TBD based on Mahesh's role |
| **Ashutosh's View** | TBD based on Ashutosh's role |
| **Tanishq's View** | SDR-focused — calls, meetings booked, pipeline |

Each view picks specific modules and filters from the 7 core modules below.

---

### Module 1 — Calling Tracker

**Purpose**: Track all outbound/inbound calls from Zoho CRM, surface them on the dashboard, and sync to Google Sheets.

**Data flow**: Zoho CRM Calls module → Dashboard → Google Sheets

**What it will show**:
- Total calls today / this week
- Calls by outcome (Connected, No Answer, Callback Requested, etc.)
- Calls per SDR (Tanishq and others)
- Timeline of recent calls with account name, contact, duration, outcome, notes
- Calls linked to deals/accounts

**Implementation plan**:
- New Zoho function: `getCalls()` — queries Calls module with COQL
- New Sheets tab: `Calls` — append on each call logged
- New API route: `GET /api/calls`
- New dashboard module component: `CallingTracker`

---

### Module 2 — Meetings

**Purpose**: Full view of all past and upcoming meetings, connected to Zoho deals and Circleback notes.

**What it will show**:
- Upcoming meetings this week (already partially built on homepage)
- Past meetings with notes status (notes received / pending)
- Meeting funnel: Booked → Attended → Follow-up Sent → Proposal Sent
- Meetings per account, per week

**Current state**: Meetings tab in Sheets is populated by OpenClaw. MeetingTimeline component exists per client. Moving this to a global meetings view across all accounts.

---

### Module 3 — Emails

**Purpose**: See all email threads with prospects and clients in one place.

**Data flow**: Gmail (via Communications Tracker Agent) → `Communications` tab in Sheets → Dashboard

**What it will show**:
- Recent email threads per account
- Filter by: account, date range, source (Gmail vs Discord)
- Unread/unactioned threads flagged
- Quick reply or note-to-self capability

**Note**: The Communications Tracker Agent already logs Gmail threads to Sheets. This module surfaces them properly.

---

### Module 4 — Funnel

**Purpose**: Visual sales funnel showing deal progression from Prospect → Contacted → Meeting Booked → Proposal → Closed.

**Data flow**: Zoho CRM Leads + Deals → Dashboard

**What it will show**:
- Count and value at each stage
- Drop-off rates between stages
- Average time in each stage
- Deals at risk (no activity in N days)
- Filter by: date range, source (Webinar, Events, Cold Outreach, etc.)

---

### Module 5 — P0 Tasks

**Purpose**: A lightweight task tracker for the most critical actions that need to happen today.

**What it will show**:
- Auto-generated P0s from: meetings with no follow-up sent, proposals overdue, payments pending
- Manual P0s that can be added from the dashboard
- Assigned to: Anurag / Tanishq / Ashutosh / Mahesh
- Completed today vs pending
- Each P0 links to the relevant Zoho deal or contact

**Implementation**: Likely a separate `Tasks` tab in Sheets or a lightweight Zoho Tasks API integration.

---

### Module 6 — Stats

**Purpose**: The numbers that matter — business health at a glance.

**What it will show**:
- Revenue this month vs last month vs target
- Leads added this month (by source)
- Conversion rate: Leads → Meetings → Proposals → Closed
- Average deal size
- Win rate
- Top sources by conversion (Webinar vs Events vs Cold Outreach)
- Team performance: calls/meetings/deals per person

---

### Module 7 — Payments and Invoices

**Purpose**: Track what's been invoiced, what's been paid, and what's overdue.

**Data flow**: TBD — likely manual Google Sheet input or Zoho Books/Razorpay integration

**What it will show**:
- Total invoiced this month
- Total received this month
- Outstanding (overdue) amounts
- Per-deal payment status
- Invoice list with: client, amount, date, status (Draft / Sent / Paid / Overdue)

---

### Build Sequence

The Mission Control Dashboard will be built in this order:

1. **View selector** — top-level UI component to switch between the 5 views
2. **Module 2 (Meetings)** — extends existing code, lowest lift
3. **Module 4 (Funnel)** — Zoho Deals + Leads data already accessible
4. **Module 6 (Stats)** — aggregates what's already being tracked
5. **Module 1 (Calling Tracker)** — new Zoho Calls integration + Sheets tab
6. **Module 3 (Emails)** — surfaces existing Communications data
7. **Module 5 (P0 Tasks)** — new lightweight task layer
8. **Module 7 (Payments)** — last, pending decision on data source

---

*This document is the single source of truth for the Moonlit Horizon system. Update it as new features are built.*
