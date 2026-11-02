# 🎾 Dinks & Drinks Pickleball Zone — Online Booking System

Online booking website for **Dinks & Drinks Pickleball Zone**, Brgy. Magsaysay, Naguilian, Isabela.
Facebook: [facebook.com/dinksNdrinks](https://www.facebook.com/dinksNdrinks)

Customers can:
- 🏟️ **Rent a court** — pick date + court (1/2/3) + hourly slots on a live availability grid (**₱250/court/hour · 8:00 AM – 5:00 PM**)
- 👥 **Join Open Play** — one daily session, **6:00 PM – 10:00 PM**, ₱100 per player
- 🏓 **Rent paddles** — simple *Yes/No* toggle + quantity (**₱100/paddle**, added to the total automatically)
- 📱 Pay via **GCash** (shows your number + collects the reference number) or 🧾 **Over the Counter**
- Get a **booking reference code** (e.g. `DND-AB12CD34`) they can screenshot / send to your Messenger

Owner (Team area at `/dinteams/login` → `/dinteams/dashboard`) can:
- See all bookings, filter by date/status/type, search by name/mobile/ref
- ✅ Confirm (after verifying GCash payment) or ❌ Cancel bookings (frees the slot instantly)
- 📊 **Reports** — this week / last week / this month / last month / custom range: bookings, confirmed revenue, pending amounts, court hours, paddles rented, payment mix, per-court usage, day-by-day table + CSV export
- ⚙️ Change the **GCash number, prices, hours, # of courts** — no coding needed

**Admin URLs** (free Vercel clean URLs): `/dinteams/login` · `/dinteams/dashboard` · `/dinteams/reports` · `/dinteams/settings` (the old `/admin` redirects to the login page)

**Stack:** Static website (HTML/CSS/JS) → hosted free on **Vercel**, code stored on **GitHub**, bookings database on **Supabase** (free tier is more than enough).

---

## ▶️ Just want to preview it first? (Demo Mode)

No setup needed. Just open `index.html` in a browser (or serve the folder with any static server).
While Supabase keys are empty, the site runs in **Demo Mode**: bookings are saved only in that browser (with a few sample bookings so the grid looks alive), and the Admin page PIN is `1234`.

---

## 🚀 GO LIVE — Step-by-Step

### STEP 1 — Supabase (database) · ~5 minutes
1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up (you can use your GitHub account).
2. **New Project** → Name: `dinks-ndrinks` → create a database password (save it somewhere) → Region: **Singapore** → Create. Wait ~1 minute.
3. Left menu → **SQL Editor** → **New query** → paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**. ✅ (This creates the bookings + settings tables and security rules.)
4. Left menu → **Authentication** → **Users** → **Add user** → enter *your owner email + password* → check **Auto Confirm User** → Create. *(This is your Admin login.)*
5. Left menu → **Settings (gear)** → **API** → copy these two:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (long `eyJ...` text) — ⚠️ use the **anon** key, *never* the `service_role` key.

### STEP 2 — Paste the keys into the code
Open [`assets/js/config.js`](assets/js/config.js) and paste:
```js
window.DND_CONFIG = {
  SUPABASE_URL: "https://abcdefgh.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...your-anon-key..."
};
```
*(The anon key is safe to be public — the Row Level Security rules in the SQL protect customer names/numbers. Customers can only create bookings and see which slots are taken.)*

### STEP 3 — GitHub (code storage)
**Easy way (no git commands):**
1. Go to [github.com](https://github.com) → **New repository** → name it `dinks-n-drinks-booking` → **Create repository**.
2. Click **uploading an existing file** → drag ALL files/folders of this project in (keep the folder structure: `assets/...`, `supabase/...`, `index.html`, `admin.html`, etc.) → **Commit changes**.

**Git way (optional):**
```bash
git init && git add -A && git commit -m "Dinks & Drinks booking system"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/dinks-n-drinks-booking.git
git push -u origin main
```

### STEP 4 — Vercel (free hosting) · ~3 minutes
1. Go to [vercel.com](https://vercel.com) → sign up with GitHub.
2. **Add New → Project** → pick `dinks-n-drinks-booking` → **Import**.
3. Framework Preset: **Other** (no build settings needed — it's a static site) → **Deploy**. 🎉
4. You'll get a live link like `https://dinks-n-drinks-booking.vercel.app` — that's your booking website!
   - Customer page: `https://…vercel.app`
   - Owner admin: `https://…vercel.app/admin`

> Every time you update the GitHub repo, Vercel redeploys automatically. ✔️

### STEP 5 — Before you share the link (important!)
1. Open `https://…vercel.app/admin` → log in with your Supabase owner email/password.
2. ⚙️ **Business Settings** → **Verify the GCash number & account name.**
   Preset from your FB page contact: **0917 708 2805**. The GCash *account name* shown to customers must match the name registered on that GCash account — update it if it's a personal name.
3. Confirm the preset prices (change anytime here):
   | Item | Preset |
   |---|---|
   | Court rental | ₱250 / court / hour |
   | Court hours | 8:00 AM – 5:00 PM (9 bookable hours per court) |
   | Open play | ₱100 / pax · **6:00 PM – 10:00 PM** (max 24 players) |
   | Paddle rental | ₱100 / paddle (flat per booking) |
4. Do a **test booking** yourself (GCash with a dummy ref, then cancel it in Admin).
5. Share it! Put the link on your FB page: **About → Website**, add a **"Book Now" action button**, and pin a post: *"Book your court online 👉 (your link)"*.

---

## 🧭 How daily operations work
| Customer pays | Booking status | What you do |
|---|---|---|
| 📱 GCash | ⏳ Pending (slot already reserved) | Check GCash for the amount + reference no. → Admin → **Confirm** |
| 🧾 Over the Counter | ⏳ Pending | Confirm when they arrive & pay. No-show after 15 mins → **Cancel** to free the slot |
| ❌ Cancelled (by you) | Slot becomes bookable again instantly | — |

## 🎨 Changing things
- **Logo:** replace `assets/img/logo.png` (square, transparent PNG works best). Original FB profile photo is kept as `assets/img/logo-original.jpg`. Cover photo: `assets/img/cover-fb.jpg`.
- **GCash QR code:** save your GCash QR image as `assets/img/gcash-qr.png`, then in `index.html` uncomment the `<img class="gcash-qr" …>` line (marked with a comment) — it will appear in the payment step.
- **Open play session times / text content:** edit in Supabase → Table Editor → `settings` (or ask your developer).
- **Font:** Poppins (self-hosted in `assets/fonts/`, so it loads fast and works offline — no Google Fonts dependency).
- **Colors:** sampled straight from your logo — navy `#1F3A57`, deep navy `#11263C`, lime `#9CC93E`, paddle green `#70A43E`, ball yellow `#E0C42A`, paddle orange `#B97A30`. All at the top of `assets/css/styles.css`.

## 🔒 Security notes
- Customer names & mobile numbers are **never** publicly readable — visitors only see taken/available slots (`public_availability` view). Only your logged-in admin account can read bookings.
- Never put the Supabase `service_role` key anywhere in this project.
- Demo Mode (no Supabase keys) has no real security — connect Supabase before sharing the link publicly.

## 🗂 Project structure
```
index.html              Customer booking page
admin.html              Redirect → /dinteams/login
dinteams/
  login.html            Team login (Supabase email/password, or demo PIN 1234)
  dashboard.html        Bookings dashboard (confirm / cancel / filter)
  reports.html          Weekly + monthly reports, CSV export
  settings.html         GCash, rates, courts, hours
assets/
  css/styles.css        All styling (brand colors at top)
  img/logo.png          Your logo (from FB page)
  img/cover-fb.jpg      Your FB cover photo (hero image)
  js/config.js          👈 paste Supabase URL + anon key here
  js/common.js          Shared data layer (Supabase ⇄ demo mode)
  js/app.js             Booking page logic
  js/admin-common.js    Auth guard, sidebar shell, date/CSV helpers
  js/admin-bookings.js  Dashboard logic
  js/admin-reports.js   Reports logic
  js/admin-settings.js  Settings logic
  fonts/poppins.css + poppins-*.woff2  Poppins font (self-hosted)
supabase/schema.sql     One-time database setup (paste in Supabase SQL Editor)
vercel.json             Vercel settings (clean URLs — /admin works)
```

*Eat. Play. Drink. 🥤 Play. Sip. Repeat. 🎾*
