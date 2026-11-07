/**
 * Wedding RSVP backend — Google-login RSVP with one editable entry per email.
 *
 * All responses are stored in a single master "RSVPs" tab. Five live, filtered
 * views (3 for Bride's links, 2 for Groom's links) are generated in separate
 * tabs within the same spreadsheet for sharing with organizers.
 *
 * One-time setup after pasting this file:
 *   1. Set CLIENT_ID below to the same OAuth Client ID the website uses.
 *   2. In the editor, select setupSheets from the function list and click Run
 *      (authorize when prompted). This creates the RSVPs tab and all 5 link tabs.
 *   3. Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone).
 *
 * After any later edit, redeploy with Deploy -> Manage deployments -> Edit ->
 * Version: New version (and re-run setupSheets if tab definitions changed).
 * The web app URL stays the same.
 */

var SPREADSHEET_ID = "1K8y7N59tV47CxEYDeZGzEnHppT_Xg7-TbchB7IKZ69Q";
var DATA_SHEET = "RSVPs";
var HEADERS = ["Timestamp", "Name", "Email", "Phone", "Attending", "Guests", "Message", "Side"];

var INVITE_GROUPS = [
  "Bride - All Events",
  "Bride - Cocktail & Reception",
  "Bride - Reception",
  "Groom - All Events",
  "Groom - Wedding & Reception"
];

// Must match GOOGLE_CLIENT_ID in assets/config.js.
var CLIENT_ID = "973698773655-dels4j40amar5trtbm60eaombdrstrpm.apps.googleusercontent.com";

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};

    // Verify the Google identity token outside the lock so network I/O runs in parallel.
    var claims = verifyToken(p.credential);
    if (!claims) return json({ result: "error", error: "auth" });
    var email = claims.email;

    var action = p.action || "submit";
    var group = cleanGroup(p.side);

    // Read-only lookup needs no write lock — signing-in guests won't block submits.
    if (action === "lookup") {
      var ssLookup = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheetLookup = ssLookup.getSheetByName(DATA_SHEET);
      var hits = sheetLookup ? findRowsByEmail(sheetLookup, email) : [];
      if (hits.length > 0) {
        return json({ result: "success", found: true, entry: rowToEntry(hits[hits.length - 1].values) });
      }
      return json({ result: "success", found: false });
    }

    // Serialize writes only; return "busy" instead of writing unlocked if overloaded.
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) {
      return json({ result: "error", error: "busy" });
    }

    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheet = getDataSheet(ss);

      // Ensure this link's dedicated tab exists in the spreadsheet
      if (INVITE_GROUPS.indexOf(group) !== -1 && !ss.getSheetByName(group)) {
        buildSideView(ss, group);
      }

      // action === "submit" -> globally unique per email across all links;
      // submitting on a different link updates Side and moves the entry to that tab.
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
        group
      ];

      var matches = findRowsByEmail(sheet, email);
      if (matches.length > 0) {
        sheet.getRange(matches[0].rowIndex, 1, 1, HEADERS.length).setValues([row]);
        for (var j = matches.length - 1; j >= 1; j--) {
          sheet.deleteRow(matches[j].rowIndex);
        }
        SpreadsheetApp.flush();
        return json({ result: "success", updated: true });
      }
      sheet.appendRow(row);
      SpreadsheetApp.flush();
      return json({ result: "success", created: true });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ result: "error", error: String(err) });
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

function getDataSheet(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(DATA_SHEET);
  if (!sheet) sheet = ss.insertSheet(DATA_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRowsByEmail(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var matches = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][2]).toLowerCase() === email) {
      matches.push({ rowIndex: i + 2, values: rows[i] });
    }
  }
  return matches;
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

function cleanGroup(side) {
  var raw = String(side || "").trim();
  for (var i = 0; i < INVITE_GROUPS.length; i++) {
    if (INVITE_GROUPS[i].toLowerCase() === raw.toLowerCase()) {
      return INVITE_GROUPS[i];
    }
  }
  var s = raw.toLowerCase();
  if (s === "bride - sangeet & reception") return "Bride - Cocktail & Reception";
  if (s.indexOf("bride") !== -1) return "Bride - All Events";
  if (s.indexOf("groom") !== -1) return "Groom - All Events";
  return "Other";
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- One-time setup: build the master tab and the 5 link view tabs --------

/**
 * Run this once from the editor. Creates the RSVPs master tab (if missing)
 * and rebuilds the 5 live tabs (3 Bride links + 2 Groom links). Safe to
 * re-run; it only rewrites the view tabs, never the master data.
 */
function setupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getDataSheet(ss);
  for (var i = 0; i < INVITE_GROUPS.length; i++) {
    buildSideView(ss, INVITE_GROUPS[i]);
  }
  removeLegacyViewIfAutoGenerated(ss, "Groom");
  removeLegacyViewIfAutoGenerated(ss, "Bride");
  removeLegacyViewIfAutoGenerated(ss, "Bride - Sangeet & Reception");
}

function removeLegacyViewIfAutoGenerated(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return;
  var formula = sh.getRange("A6").getFormula();
  if (formula && formula.indexOf("FILTER(" + DATA_SHEET) !== -1) {
    ss.deleteSheet(sh);
  }
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
