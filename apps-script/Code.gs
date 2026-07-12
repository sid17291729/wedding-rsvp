/**
 * Wedding RSVP backend — receives form submissions and appends them
 * to the Google Sheet this script is attached to.
 *
 * Setup: open your Google Sheet -> Extensions -> Apps Script,
 * paste this file, then Deploy -> New deployment -> Web app
 * (Execute as: Me, Who has access: Anyone). See README.md.
 */

var SHEET_NAME = "RSVPs";

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(["Timestamp", "Side", "Name", "Attending", "Guests", "Message"]);
      sheet.getRange("A1:F1").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var p = e.parameter;
    sheet.appendRow([
      new Date(),
      p.side || "",
      p.name || "",
      p.attending || "",
      p.guests || "",
      p.message || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Lets you sanity-check the deployment by opening the web app URL in a browser.
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "RSVP endpoint is live" }))
    .setMimeType(ContentService.MimeType.JSON);
}
