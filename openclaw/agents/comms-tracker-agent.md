# Agent: Communications Tracker Agent

## Purpose
Continuously watch Discord #sales-ops and Gmail for messages related to known accounts, and log them to the Google Sheets `Communications` tab so the dashboard always shows an up-to-date conversation history.

## Triggers
- **Discord**: Any new message in #sales-ops that mentions an account name (checked against the `Accounts` sheet)
- **Gmail**: New email thread where sender or recipient email domain matches a known contact email (checked against the `Accounts` sheet)

## Workflow

### Loading account list
- Every 10 minutes, refresh the list of account names and contact email domains from the `Accounts` tab of the Google Sheet.
- Store this as an in-memory lookup: `{ accountName: string, contactEmail: string }[]`

### Discord monitoring

For each new message in #sales-ops:
1. Check if the message body mentions any known account name (case-insensitive substring match).
2. If yes: append a row to the `Communications` tab.

Row format:
- Thread ID: Discord message ID
- Account Name: matched account name
- Source: "Discord"
- Message Preview: first 200 characters of the message
- Timestamp: ISO timestamp of the message

Skip: bot messages, /command messages, messages by the OpenClaw bot itself.

### Gmail monitoring

Every 15 minutes, fetch the last 50 emails via Gmail API (threads, not individual messages).
For each thread:
1. Check if any participant (To/From/CC) matches a known contact email domain.
2. If yes and not already logged (check Thread ID uniqueness in the sheet):
   - Append a row to the `Communications` tab.

Row format:
- Thread ID: Gmail thread ID
- Account Name: matched account name
- Source: "Gmail"
- Message Preview: Subject line + first 150 chars of body snippet
- Timestamp: ISO timestamp of the latest message in the thread

Deduplicate: if a Thread ID already exists in the `Communications` tab, skip it (do not log duplicates).

### Google Sheets write
Append to `Communications!A:E`:
`[Thread ID, Account Name, Source, Message Preview, Timestamp]`

## Error handling
- If Google Sheets append fails: retry after 30 seconds, log error to console.
- If Gmail rate-limited: back off for 5 minutes.
- Never crash the Discord listener due to Sheets/Gmail errors.
