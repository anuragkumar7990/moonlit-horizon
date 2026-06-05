# Agent: Notes Summarisation Agent

## Purpose
After a meeting ends, fetch the transcript from Circleback, summarise it to 4 lines max and extract actionables, then write to Google Sheets and post to Discord.

## Trigger
Two triggers (either activates the agent):
1. **Automatic (cron)**: Every 30 minutes, check the `Meetings` sheet for rows where:
   - Meeting Time is in the past (> 30 minutes ago)
   - Status is "Meeting Booked" (not yet summarised)
2. **Manual**: Discord command `/notes {meeting-id}` or `/notes {account name}`

## Workflow

### Step 1 — Find the meeting
- Read the `Meetings` tab of the Google Sheet
- For cron: find all rows where Meeting Time < (now - 30min) and Status = "Meeting Booked"
- For manual: find the matching row by meeting ID or account name

### Step 2 — Fetch from Circleback
- Search Circleback for a meeting that matches the calendar title from the Meetings row.
- Use: search by title keywords (Account Name + "The Test Tribe")
- If no match found: skip and log "No Circleback recording found for {account} on {date}"

### Step 3 — Summarise
Use Claude AI to produce:

**Summary prompt:**
> You are a business development assistant. Summarise this meeting transcript in exactly 4 bullet points (max 1 sentence each). Then list all action items as bullet points. Format:
>
> SUMMARY:
> • [point 1]
> • [point 2]
> • [point 3]
> • [point 4]
>
> ACTIONABLES:
> • [action 1]
> • [action 2]
> ...

### Step 4 — Write to Google Sheets
Append a row to the `Notes` tab:
Columns: Meeting ID, Account Name, Summary (newline-separated bullets), Actionables (newline-separated), Created At

Also update the `Meetings` row: change Status from "Meeting Booked" to "Notes Ready"

### Step 5 — Post to Discord
Post in #sales-ops:

```
📝 **Meeting Notes: {Account Name}**
📅 {meeting date}

**Summary:**
{4 bullet points}

**Actionables:**
{action bullet points}
```

## Error handling
- If Circleback returns no transcript: update Meetings status to "No Recording" and skip.
- If Claude summarisation fails: retry once, then post raw transcript excerpt to Discord with a note.
