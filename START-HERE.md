# ✅ DO THIS NOW — 3 things left (≈10 minutes)

Your screenshots show: GitHub account = **dindin1101**, Supabase project = **Dinks&Drinks (wryrseqayqvmorgpjqx)**, Vercel = ready to import.
Follow **in this exact order**. Don't skip #1 — Vercel needs the repo to exist first.

---

# ⚠️ FIRST — one thing in Supabase before anything else

Your project page says **"Last migration: No migrations"** — that means the database tables are **not created yet**. Do this now:

1. In your Supabase project, look at the **left sidebar** (the thin column of icons).
2. Click the icon that looks like a **terminal / command line** → it's **SQL Editor** (hover the icons to read their names).
   - Alternative: press `Ctrl` + `` ` `` … or just click the icon directly above the **database/table** icon.
3. Click **+ New query** (or the big blank editor area).
4. Open the file **`supabase/schema.sql`** from your project folder → select all → **copy**.
5. **Paste** it into the SQL editor.
6. Click **Run** (bottom-right) or press `Ctrl` + `Enter`.
7. You should see **"Success. No rows returned"** at the bottom. ✅ Tables created.

> Then go back to **Project Settings → API Keys** (gear icon at the bottom of the sidebar) and copy your **Publishable / anon** key — you'll need it in step 2.

---

# 1️⃣ GITHUB — create the repo and upload (≈4 min)

Your dashboard says **"No repositories found"**, so let's create the first one.

### 1a. Create it
1. On the GitHub dashboard (your 1st screenshot), click the **`+`** button at the **top-right** → **New repository**.
2. **Repository name:** type exactly `dinks-n-drinks-booking`
3. **Description:** `Dinks & Drinks Pickleball Zone — online court booking` (optional)
4. Choose **Public** ✅
5. **Leave all checkboxes UNCHECKED** (no README, no .gitignore, no license — you already have them).
6. Click the green **Create repository**.

### 1b. Upload the files
1. On the next page you'll see **"Quick setup"**. Click the link **"uploading an existing file"** (middle of the page, under the "…or upload an existing file" text).
2. Now open your project folder on your computer (unzip `dinks-n-drinks-booking.zip` somewhere first).
3. **Select EVERYTHING INSIDE the folder** (not the folder itself):
   ```
   admin.html        index.html      vercel.json      .gitignore
   README.md         DEPLOY-GUIDE.md
   assets/           supabase/
   ```
   💡 Easiest way: open the folder, press `Ctrl+A`, then drag all of it into the browser's drop box.
4. ⚠️ **Check before you commit:** the file list must show **`index.html` at the root**, plus folders `assets` and `supabase`. (If you see `dinks-n-drinks-booking/index.html`, you dragged the folder — remove everything and drag the *contents* instead.)
5. Wait for all ~28 files to upload (green ticks / "100%").
6. Scroll down to **"Commit changes"** → click the green **Commit changes** button. (Leave the default message.)
7. ✅ You should now see the repo home page listing `admin.html`, `assets`, `index.html`, `supabase`, `vercel.json`…

---

# 2️⃣ PASTE YOUR SUPABASE KEY (≈1 min)

You can do this **before** uploading (easier) or **after** (edit on GitHub — both fine).

### Before uploading (recommended)
1. Open **`assets/js/config.js`** in Notepad / VS Code / any text editor.
2. The URL is already filled in: `https://wryrseqayqvmorgpjqx.supabase.co` ✅
3. Paste your key here, between the quotes:
   ```js
   SUPABASE_ANON_KEY: "sb_publishable_xxxxxxxxxxxx"   // or "eyJhbGciOi..."
   ```
4. Save the file. Then upload as in step 1b.

### If you already uploaded
1. In your GitHub repo click **`assets`** → **`js`** → **`config.js`**
2. Click the **pencil ✏️** icon (top-right of the file).
3. Paste your key between the quotes on the `SUPABASE_ANON_KEY:` line.
4. Scroll down → **Commit changes**.

> 🔑 Which key? **Publishable / anon** only. It's designed to be public. Never the `service_role` / `secret`.

---

# 3️⃣ VERCEL — deploy (≈3 min)

You're on the right screen (your 3rd screenshot).

### 3a. Connect GitHub
1. Click the big **GitHub** button under **"Import Git Repository"**.
2. A GitHub popup appears: click **Authorize Vercel**.
3. If it asks which repositories: choose **"Only select repositories"** → pick `dinks-n-drinks-booking` → **Install / Save**.
4. You'll come back to Vercel with a list of your repos.

### 3b. Import + deploy
1. Find **`dinks-n-drinks-booking`** → click **Import**.
2. On the configure screen:
   - **Project Name:** `dinks-n-drinks` ✅ (this makes your link `dinks-n-drinks.vercel.app`; Vercel adds a suffix if the name is taken)
   - **Framework Preset:** **Other** ← important, nothing else
   - **Root Directory:** `./` (leave it)
   - **Build Command / Output Directory / Install Command:** leave **empty**
   - **Environment Variables:** none
3. Click **Deploy** → wait ~30 seconds → confetti 🎉
4. Click **Continue to Dashboard** → copy your **Domains** link (e.g. `https://dinks-n-drinks.vercel.app`).

### 3c. Test it
| Open | You should see |
|---|---|
| `https://YOUR-SITE.vercel.app` | Booking page — **no yellow "Demo mode" banner** |
| `https://YOUR-SITE.vercel.app/admin` | Admin login screen |

**At `/admin`** → sign in with the **Supabase email + password** you made in **Authentication → Users**.
*(The PIN `1234` only works in demo mode; with Supabase connected use the email login.)*

> If you haven't created your admin user yet: Supabase → **Authentication** → **Users** → **Add user** → your email + password → ✅ **Auto Confirm User** → create.

---

# 4️⃣ FINAL CHECKS (2 min)

1. **Admin → ⚙️ Business Settings** → verify:
   - GCash number `0917 708 2805` (change if it's different)
   - **GCash account name** = the exact name registered on GCash
   - Court ₱250/hr · Open play ₱100/pax · Paddle ₱100 · Courts 3
   - Courts 8→17 (8 AM–5 PM) · Open play 18→22 (6–10 PM)
2. Click **💾 Save Settings**.
3. **Test a booking**: on the site, pick a slot → "Rent paddle? Yes" → fill in a test name/mobile → GCash with a dummy reference → Confirm.
4. Go to `/admin` → the booking should appear → click **Cancel** to free the slot.
5. Put the link on Facebook: Page → **Edit** → **Contact and Basic Info** → **Website** → paste your link, and add a **"Book Now"** button.

---

# 🆘 If something looks wrong

| What you see | What it means | Fix |
|---|---|---|
| Yellow **"Demo mode"** banner on the live site | key not pasted / typo | Re-do step 2, then wait 30 s for Vercel to redeploy |
| `/admin` says "Could not load bookings" | tables not created | Re-run `supabase/schema.sql` (the ⚠️ section at the top) |
| Login fails at `/admin` | no user, or not confirmed | Supabase → Authentication → Users → **Add user** + **Auto Confirm User** |
| Slots all show **Booked** | missing permissions | Run `supabase/schema.sql` again (safe, won't delete data) |
| Vercel build error | usually a wrong preset | Project → Settings → **Framework Preset = Other**, Build Command empty |
| 404 on `/admin` | `vercel.json` missing | Make sure `vercel.json` is at the repo root (re-upload it) |

---

## 🔑 Keep these safe
- Supabase email + password (your admin login)
- GitHub (`dindin1101`) + Vercel logins
- Your Supabase **secret** / `service_role` key — **never** put it in the website code

**Tip:** if you send me your Vercel link once it's live, I can check the deployed page for problems.
