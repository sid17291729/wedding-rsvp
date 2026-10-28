# Siddharth & Nandita — Wedding RSVP Website

A static RSVP website with two separate invitation URLs (one per side) that
saves every response into a Google Sheet.

- `siddharth/` → Groom's side RSVP page
- `nandita/` → Bride's side RSVP page
- `index.html` → simple landing page linking to both (optional to share)

Guests sign in with Google, so each person has **one RSVP they can come back
and edit**. All responses are stored in a single **RSVPs** tab (columns
Timestamp, Name, Email, Phone, Attending, Guests, Message, Side), and two
live, auto-updating views — **Groom** and **Bride** — are generated from it
for sharing with organizers, each with a headcount summary at the top.

## Setup — Part 1: Google Sign-In (OAuth Client ID)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a project (e.g. *Wedding RSVP*).
2. **APIs & Services → OAuth consent screen** → **External** → fill in app
   name, your support email, developer email. The default non-sensitive scopes
   (email, profile, openid) are all that's needed, so no verification review is
   required. **Publish** the app to *Production* (otherwise it's limited to 100
   test users and shows an "unverified" warning).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   Application type **Web application**.
4. Under **Authorized JavaScript origins**, add (origin only — no path, no
   trailing slash):
   - `https://sid17291729.github.io`
   - `http://localhost:8123` (for local testing)
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and paste it
   into **both**:
   - [`assets/config.js`](assets/config.js) → `GOOGLE_CLIENT_ID`
   - [`apps-script/Code.gs`](apps-script/Code.gs) → `CLIENT_ID`

   (They must match — the backend only accepts sign-in tokens issued for this
   exact Client ID.)

## Setup — Part 2: Google Sheet + Apps Script (the data backend)

1. Open the RSVP spreadsheet (its ID is already set in `apps-script/Code.gs`).
2. **Extensions → Apps Script**, delete any code, and paste the full contents
   of [`apps-script/Code.gs`](apps-script/Code.gs). Save (Ctrl+S).
3. In the editor's function dropdown, select **setupSheets** and click **Run**.
   Authorize when prompted. This creates the **RSVPs** master tab and the live
   **Groom** / **Bride** views. *(This rewrites the Groom/Bride tabs as filtered
   views — move any real data out first. Test rows can be ignored.)*
4. **Deploy → New deployment → Web app** → *Execute as* **Me**, *Who has
   access* **Anyone** → **Deploy**, authorize, and copy the **Web app URL**
   (`https://script.google.com/macros/s/AKfycb.../exec`).
5. Paste that URL into [`assets/config.js`](assets/config.js) → `SCRIPT_URL`.

That's it — each guest signs in, their one response lands in the **RSVPs** tab
tagged with their side, and the Groom/Bride views update automatically.

> After **editing** `Code.gs` later, redeploy with **Deploy → Manage
> deployments → ✏️ Edit → Version: New version**. The web app URL stays the same.

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
python -m http.server 8123
```

Then visit `http://localhost:8123/siddharth/` and `http://localhost:8123/nandita/`.
Google sign-in works locally only if `http://localhost:8123` is listed as an
authorized JavaScript origin on the OAuth Client ID (see Part 1).

## Customizing

- **Wording / date / venue**: edit the text in `siddharth/index.html` and
  `nandita/index.html`.
- **Colors**: tweak the CSS variables at the top of `assets/style.css`.
- **Form fields**: add inputs in both HTML files (give them a `name`
  attribute) and add a matching column to `HEADERS` + a `p.<name>` entry in
  `apps-script/Code.gs`, then redeploy a **new version** of the script.
