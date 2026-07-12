/**
 * Wedding RSVP backend — receives form submissions and appends them
 * to the Groom or Bride tab of the RSVP Google Sheet.
 *
 * Setup: open the RSVP Google Sheet -> Extensions -> Apps Script,
 * paste this file, then Deploy -> New deployment -> Web app
 * (Execute as: Me, Who has access: Anyone). See README.md.
 */

var SPREADSHEET_ID = "1K8y7N59tV47CxEYDeZGzEnHppT_Xg7-TbchB7IKZ69Q";
var HEADERS = ["Timestamp", "Name", "Attending", "Guests", "Message"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var p = e.parameter;

    // Route to the tab matching the invitation link the guest used
    var side = String(p.side || "").toLowerCase();
    var tabName = side.indexOf("bride") !== -1 ? "Bride"
                : side.indexOf("groom") !== -1 ? "Groom"
                : "Other";

    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      new Date(),
      p.name || "",
      p.attending || "",
      p.guests || "",
      p.message || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", tab: tabName }))
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
