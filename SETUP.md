# Moonlit Horizon — Setup Guide

Follow these steps in order. Each step takes 5–15 minutes.

---

## Prerequisites

1. Install [Node.js 20+](https://nodejs.org/) on your machine (needed to run the dashboard locally and deploy)
2. Have access to:
   - The TTT Google Workspace account (anurag@thetesttribe.com)
   - The TTT Discord server (admin access to add a bot)
   - Hostinger VPS with SSH access
   - Zoho CRM (admin or API access)

---

## Step 1 — Google Sheets Setup (5 min)

The spreadsheet is already created at:
https://docs.google.com/spreadsheets/d/1aIbzFh0vH-9XYeuNeNRRqcyG_dWnwIPBs4cqJGyyoD4

**Add the remaining 3 tabs automatically:**
1. Open the spreadsheet → click **Extensions → Apps Script**
2. Paste the contents of `openclaw/sheets-setup.gs`
3. Click **Run → setupSheets**
4. Authorise when prompted

This creates: Meetings, Notes, Communications, Accounts tabs with colour-coded headers.

---

## Step 2 — Google Cloud Service Account (10 min)

The dashboard and OpenClaw both need a service account to read/write Sheets and Calendar.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a new project called `moonlit-horizon`
2. Enable these APIs:
   - Google Sheets API
   - Google Calendar API
   - Gmail API
3. Go to **IAM & Admin → Service Accounts** → create service account named `moonlit-dashboard`
4. Download the JSON key file
5. **Share the spreadsheet** with the service account email (e.g. `moonlit-dashboard@moonlit-horizon.iam.gserviceaccount.com`) — give it **Editor** access
6. **Share your Google Calendar** with the service account email — give it **Make changes to events** access

Copy the JSON key content (one-line) into `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env.local`.

---

## Step 3 — Zoho CRM OAuth (10 min)

1. Go to [Zoho API Console](https://api-console.zoho.in/) → **Add Client → Server-based Application**
2. Set Redirect URI to `https://www.zoho.in/crm/developer/documentation`
3. Copy **Client ID** and **Client Secret** into `.env.local`
4. Generate a **Refresh Token** with these scopes:
   ```
   ZohoCRM.modules.ALL,ZohoCRM.settings.ALL
   ```
   (Use the Zoho OAuth Playground in the API console)
5. Copy the Refresh Token into `.env.local`

---

## Step 4 — Discord Bot Setup (10 min)

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → name it `Moonlit Horizon`
2. Go to **Bot** tab → **Add Bot** → copy the **Token**
3. Under **OAuth2 → URL Generator**: check `bot` + `applications.commands`, then select:
   - Read Messages/View Channels
   - Send Messages
   - Use Slash Commands
4. Open the generated URL → invite the bot to the TTT Discord server
5. Get the Channel ID of `#sales-ops`: right-click the channel → Copy Channel ID
6. Get the Guild (Server) ID: right-click the server name → Copy Server ID

These go into the OpenClaw `.env` on the VPS (see Step 6).

---

## Step 5 — Install & run the dashboard locally (5 min)

```bash
cd moonlit-horizon
npm install
cp .env.local.example .env.local
# Fill in all values in .env.local
npm run dev
```

Open http://localhost:3000 — enter password `thetesttribe`.

---

## Step 6 — Deploy OpenClaw on Hostinger VPS

### SSH into your VPS:
```bash
ssh root@<your-vps-ip>
```

### Install Docker:
```bash
curl -fsSL https://get.docker.com | sh
```

### Copy files to VPS:
```bash
# From your local machine:
scp -r moonlit-horizon/openclaw/ root@<vps-ip>:/opt/moonlit-openclaw/
```

### Create `.env` on the VPS:
```bash
nano /opt/moonlit-openclaw/.env
```

Paste and fill:
```env
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_CHANNEL_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
SHEETS_SPREADSHEET_ID=1aIbzFh0vH-9XYeuNeNRRqcyG_dWnwIPBs4cqJGyyoD4
CIRCLEBACK_API_KEY=
DASHBOARD_BOOK_URL=https://moonlit-horizon.vercel.app/api/book
```

### Start OpenClaw:
```bash
cd /opt/moonlit-openclaw
docker compose up -d
docker compose logs -f   # watch startup
```

### Load agents:
In the OpenClaw web UI (http://<vps-ip>:3001):
1. Go to Agents → New Agent
2. Copy-paste the contents of each `.md` file in `openclaw/agents/`
3. Save and activate all 3 agents

---

## Step 7 — Deploy dashboard to Vercel (5 min)

1. Push the `moonlit-horizon/` folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Set root directory to `moonlit-horizon`
4. Add all environment variables from `.env.local` in Vercel's dashboard
5. Deploy → your URL will be `https://moonlit-horizon.vercel.app`

---

## Step 8 — End-to-end test

1. In Discord `#sales-ops`, type: `/book meeting`
2. Fill in the form the bot replies with
3. Verify:
   - ✅ Calendar invite arrives in all 5 inboxes
   - ✅ Zoho CRM shows new Deal under the account
   - ✅ Google Sheets `Meetings` tab has a new row
   - ✅ Dashboard `https://moonlit-horizon.vercel.app` shows the client card
4. After a test meeting (even 2 minutes long via Circleback):
   - ✅ Notes appear on the client detail page

---

## Environment variables reference

| Variable | Where to get it |
|---|---|
| `SHEETS_SPREADSHEET_ID` | URL of the Google Sheet |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud Console → Service Account key (JSON, one line) |
| `GOOGLE_CALENDAR_ID` | Google Calendar settings → Calendar ID (usually `primary`) |
| `ZOHO_CLIENT_ID` | Zoho API Console |
| `ZOHO_CLIENT_SECRET` | Zoho API Console |
| `ZOHO_REFRESH_TOKEN` | Zoho OAuth Playground |
| `DASHBOARD_PASSWORD` | `thetesttribe` (or change it) |
