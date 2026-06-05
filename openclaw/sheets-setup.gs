/**
 * Run this script once in Google Apps Script to set up
 * the Notes, Communications, and Accounts tabs in the spreadsheet.
 *
 * How to run:
 * 1. Open the Google Sheet: https://docs.google.com/spreadsheets/d/1aIbzFh0vH-9XYeuNeNRRqcyG_dWnwIPBs4cqJGyyoD4
 * 2. Click Extensions → Apps Script
 * 3. Paste this entire script, replacing any existing content
 * 4. Click Run → setupSheets
 * 5. Authorise when prompted
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const SHEETS = {
    'Meetings': [
      'Meeting ID', 'Account Name', 'Contact Name', 'Contact Email',
      'Meeting Time', 'Meeting Type', 'G-Meet Link', 'Deal ID', 'Status', 'Created At'
    ],
    'Notes': [
      'Meeting ID', 'Account Name', 'Summary', 'Actionables', 'Created At'
    ],
    'Communications': [
      'Thread ID', 'Account Name', 'Source', 'Message Preview', 'Timestamp'
    ],
    'Accounts': [
      'Account Name', 'Primary Contact', 'Contact Email', 'Stage', 'Last Activity'
    ],
  };

  Object.entries(SHEETS).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      Logger.log('Created sheet: ' + name);
    } else {
      Logger.log('Sheet already exists: ' + name);
    }

    // Write headers if row 1 is empty
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (!firstRow[0]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers.length).setBackground('#0369a1');
      sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      Logger.log('Headers set for: ' + name);
    }
  });

  // Delete the default "Sheet1" if it exists and is empty
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() <= 1) {
    ss.deleteSheet(defaultSheet);
    Logger.log('Deleted default Sheet1');
  }

  Logger.log('✅ Setup complete!');
}
