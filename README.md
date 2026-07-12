# Siddharth & Nandita — Wedding RSVP Website

A static RSVP website with two separate invitation URLs (one per side) that
saves every response into a Google Sheet.

- `siddharth/` → Groom's side RSVP page
- `nandita/` → Bride's side RSVP page
- `index.html` → simple landing page linking to both (optional to share)

Every submission is stored in the couple's Google Sheet: groom-side entries
go to the **Groom** tab and bride-side entries to the **Bride** tab, with
columns Timestamp, Name, Attending, Guests, Message.

## Setup — Part 1: Google Sheet + Apps Script (the data backend)

1. Open the RSVP spreadsheet (the sheet ID is already set in
   `apps-script/Code.gs`). It should have tabs named **Groom** and **Bride**;
   header rows are added automatically on first submission.
2. In the sheet, open **Extensions → Apps Script**.
3. Delete any code in the editor and paste the full contents of
   [`apps-script/Code.gs`](apps-script/Code.gs). Save (Ctrl+S).
4. Click **Deploy → New deployment**.
   - Click the gear icon and choose **Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** (required so guests can submit without logging in)
   - Click **Deploy** and authorize the script when prompted
     (you may need to click *Advanced → Go to … (unsafe)* — this is normal
     for your own scripts).
5. Copy the **Web app URL** (it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`).
6. Open [`assets/config.js`](assets/config.js) in this project and paste that
   URL in place of the placeholder:

   ```js
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```

That's it — each submission lands in the **Groom** or **Bride** tab
depending on which invitation link the guest used.

## Setup — Part 2: Hosting on GitHub Pages (the URLs)

1. Create a new GitHub repository (e.g. `wedding-rsvp`) and push this folder
   to it:

   ```
   git init
   git add .
   git commit -m "Wedding RSVP site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/wedding-rsvp.git
   git push -u origin main
   ```

2. On GitHub, open the repo → **Settings → Pages** → under *Build and
   deployment*, set Source to **Deploy from a branch**, branch `main`,
   folder `/ (root)`. Save.
3. After a minute, your URLs will be live:
   - Groom's side: `https://<your-username>.github.io/wedding-rsvp/siddharth/`
   - Bride's side: `https://<your-username>.github.io/wedding-rsvp/nandita/`

Share each link with the respective side's guests.

> **Note:** if you edit `config.js` after pushing, remember to commit and
> push again — GitHub Pages redeploys automatically.

## Testing locally

Open a terminal in this folder and run:

```
python -m http.server 8000
```

Then visit `http://localhost:8000/siddharth/` and `http://localhost:8000/nandita/`.
Submissions work locally too once `config.js` has the real script URL.

## Customizing

- **Wording / date / venue**: edit the text in `siddharth/index.html` and
  `nandita/index.html`.
- **Colors**: tweak the CSS variables at the top of `assets/style.css`.
- **Form fields**: add inputs in both HTML files (give them a `name`
  attribute) and add a matching column + `p.<name>` entry in
  `apps-script/Code.gs`, then create a **new deployment** of the script.
