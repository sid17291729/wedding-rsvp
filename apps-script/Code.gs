/**
 * Wedding RSVP backend — Google-login RSVP with one editable entry per email.
 *
 * All responses are stored in a single master "RSVPs" tab. Two live, filtered
 * views ("Groom" and "Bride") are generated for sharing with organizers.
 *
 * One-time setup after pasting this file:
 *   1. Set CLIENT_ID below to the same OAuth Client ID the website uses.
 *   2. In the editor, select setupSheets from the function list and click Run
 *      (authorize when prompted). This creates the RSVPs tab and the two views.
 *   3. Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone).
 *
 * After any later edit, redeploy with Deploy -> Manage deployments -> Edit ->
 * Version: New version. The web app URL stays the same.
 */

var SPREADSHEET_ID = "1K8y7N59tV47CxEYDeZGzEnHppT_Xg7-TbchB7IKZ69Q";
var DATA_SHEET = "RSVPs";
var HEADERS = ["Timestamp", "Name", "Email", "Phone", "Attending", "Guests", "Message", "Side"];

// Must match GOOGLE_CLIENT_ID in assets/config.js.
var CLIENT_ID = "973698773655-dels4j40amar5trtbm60eaombdrstrpm.apps.googleusercontent.com";

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var p = (e && e.parameter) || {};

    // Trust nothing from the browser except a Google-verified identity token.
    var claims = verifyToken(p.credential);
    if (!claims) return json({ result: "error", error: "auth" });
    var email = claims.email;

    var sheet = getDataSheet();
    var action = p.action || "submit";

    if (action === "lookup") {
      var hit = findRowByEmail(sheet, email);
      if (hit) {
        return json({ result: "success", found: true, entry: rowToEntry(hit.values) });
      }
      return json({ result: "success", found: false });
    }

    // action === "submit" -> create or update this email's single row
    var attending = p.attending || "";
    var guests = attending === "Yes" ? Number(p.guests || 0) : 0;
    var row = [
      new Date(),
      p.name || claims.name || "",
      email,
      "'" + (p.phone || ""), // leading apostrophe keeps Sheets from mangling +91… numbers
      attending,
      guests,
      p.message || "",
      cleanSide(p.side)
    ];

    var existing = findRowByEmail(sheet, email);
    if (existing) {
      sheet.getRange(existing.rowIndex, 1, 1, HEADERS.length).setValues([row]);
      return json({ result: "success", updated: true });
    }
    sheet.appendRow(row);
    return json({ result: "success", created: true });
  } catch (err) {
    return json({ result: "error", error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ status: "RSVP endpoint is live" });
}

// --- Google ID token verification ----------------------------------------

function verifyToken(token) {
  if (!token) return null;
  var url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token);
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return null; // expired/invalid tokens 400 here
  var info = JSON.parse(resp.getContentText());
  if (info.aud !== CLIENT_ID) return null;          // token must be for THIS app
  if (String(info.email_verified) !== "true") return null;
  if (!info.email) return null;
  return { email: String(info.email).toLowerCase(), name: info.name || "" };
}

// --- Sheet helpers --------------------------------------------------------

function getDataSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(DATA_SHEET);
  if (!sheet) sheet = ss.insertSheet(DATA_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRowByEmail(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var emails = sheet.getRange(2, 3, last - 1, 1).getValues(); // column C = Email
  for (var i = 0; i < emails.length; i++) {
    if (String(emails[i][0]).toLowerCase() === email) {
      var rowIndex = i + 2;
      return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0] };
    }
  }
  return null;
}

function rowToEntry(v) {
  return {
    name: v[1],
    email: v[2],
    phone: String(v[3]).replace(/^'/, ""),
    attending: v[4],
    guests: v[5],
    message: v[6],
    side: v[7]
  };
}

function cleanSide(side) {
  var s = String(side || "").toLowerCase();
  if (s.indexOf("bride") !== -1) return "Bride";
  if (s.indexOf("groom") !== -1) return "Groom";
  return "Other";
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- One-time setup: build the master tab and the two sharing views -------

/**
 * Run this once from the editor. Creates the RSVPs master tab (if missing)
 * and rebuilds the live "Groom" and "Bride" views. Safe to re-run; it only
 * rewrites the two view tabs, never the master data.
 */
function setupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getDataSheet();
  buildSideView(ss, "Groom");
  buildSideView(ss, "Bride");
}

function buildSideView(ss, side) {
  var sh = ss.getSheetByName(side);
  if (!sh) sh = ss.insertSheet(side);
  sh.clear();

  // Live headcount for this side
  sh.getRange("A1").setValue(side + " — Guests attending:");
  sh.getRange("B1").setFormula(sumAttendingFormula(side));
  sh.getRange("A2").setValue(side + " — Families accepted:");
  sh.getRange("B2").setFormula(countFormula(side, "Yes"));
  sh.getRange("A3").setValue(side + " — Declined:");
  sh.getRange("B3").setFormula(countFormula(side, "No"));
  sh.getRange("A1:A3").setFontWeight("bold");

  // Live, auto-updating list of just this side's responses
  var headerRow = 5;
  sh.getRange(headerRow, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  sh.getRange(headerRow + 1, 1).setFormula(
    '=IFERROR(FILTER(' + DATA_SHEET + '!A2:H, ' + DATA_SHEET + '!H2:H="' + side + '"), "No responses yet")'
  );
  sh.setFrozenRows(headerRow);
}

function sumAttendingFormula(side) {
  return '=SUMIFS(' + DATA_SHEET + '!F:F,' + DATA_SHEET + '!H:H,"' + side + '",' + DATA_SHEET + '!E:E,"Yes")';
}

function countFormula(side, answer) {
  return '=COUNTIFS(' + DATA_SHEET + '!H:H,"' + side + '",' + DATA_SHEET + '!E:E,"' + answer + '")';
}
