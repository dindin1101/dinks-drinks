# 🚀 GO LIVE GUIDE — Dinks & Drinks Booking System

Follow in this order: **Supabase → GitHub → Vercel**. Total time: ~15 minutes.
Have ready: an email you check often, and your GCash number + exact GCash account name.

---

# PART 1 — SUPABASE (the database) · ~6 min

### 1.1 Create your account
1. Open **https://supabase.com** in a browser.
2. Click **Start your project** → sign in with **GitHub** (easiest) or email.
3. After login you land on the dashboard.

### 1.2 Create the project
1. Click **New project** (green button).
2. **Organization:** pick the one it created for you (or create one — any name).
3. **Project name:** `dinks-n-drinks`
4. **Database Password:** click **Generate a password** and **COPY IT** somewhere safe (you rarely need it, but don't lose it).
5. **Region:** choose **Southeast Asia (Singapore)** ← closest to Isabela = fastest.
6. **Plan:** Free.
7. Click **Create new project** → wait 1–2 minutes until the green **Project is ready** appears.

### 1.3 Install the tables (one paste)
1. In the left sidebar, click **SQL Editor**.
2. Click **+ New query** (or the blank editor).
3. Open the file **`supabase/schema.sql`** from this project, select **ALL** (Ctrl+A), copy, and paste it into the editor.
4. Click **Run** (or press Ctrl+Enter).
5. You should see **Success. No rows returned** at the bottom. ✅
   *(This created your `bookings` table, `settings` table, the public availability view, and all security rules.)*

> 🔁 If you run it again later, it is safe — it won't delete bookings.

### 1.4 Create YOUR admin login
1. Left sidebar → **Authentication**.
2. Click **Users** → **Add user** → **Create new user**.
3. **Email:** your email (e.g. `dinksndrinks@gmail.com`)
4. **Password:** a strong password you'll remember — **write it down**.
5. ✅ Tick **Auto Confirm User** so it works right away.
6. Click **Create user**. This is the login you'll use at `/admin`.

### 1.5 Copy your 2 keys
1. Left sidebar → **Project Settings** (the gear ⚙️ at the bottom).
2. Click **API** (or **API Keys**).
3. Copy these two things (keep this tab open, you'll need them in Part 2):
   - **Project URL** → looks like `https://abcdefghijk.supabase.co`
   - **anon / public** key → the long `eyJhbGciOi...` text
   > ⚠️ Use the **anon / public** key ONLY. Never the `service_role` key.

---

# PART 2 — GITHUB (store your code) · ~4 min

### 2.1 Create the account + repo
1. Go to **https://github.com** → **Sign up** (or log in).
2. After login click the **+** at the top-right → **New repository**.
3. **Repository name:** `dinks-n-drinks-booking`
4. **Public** (recommended — Vercel's free plan works best; nobody can edit it, only view).
5. **Do NOT** add a README or .gitignore (you already have them).
6. Click **Create repository**.

### 2.2 Paste your Supabase keys FIRST (important!)
1. In your workspace, open **`assets/js/config.js`** and edit just the two lines:
```js
window.DND_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...your-long-anon-key...",
  ...
};
```
2. Paste the **Project URL** from step 1.5 into `SUPABASE_URL` and the **anon key** into `SUPABASE_ANON_KEY` (keep the quotes `" "`).
3. Save the file. *(Do this before uploading so you only upload once.)*

### 2.3 Upload the files
**Option A — drag & drop (easiest):**
1. On the new repo page, click **uploading an existing file** (a link in the middle of the page).
2. Open the project folder, select **everything inside it** (`index.html`, `admin.html`, `assets` folder, `supabase` folder, `vercel.json`, `README.md`, `.gitignore`) and drag it all into the browser box.
   > ⚠️ Drag the **contents**, not the folder itself — `index.html` must sit at the very top level of the repo.
3. Wait for all files to finish (there are ~21 files, ~1.6 MB).
4. **Commit changes** (scroll down, green button) — leave the message as is.

**Option B — upload the ZIP:**
1. Unzip `dinks-n-drinks-booking.zip` on your computer first.
2. Then follow Option A with the unzipped contents.

**Option C — git command line:**
```bash
cd dinks-n-drinks-booking
git init
git add -A
git commit -m "Dinks & Drinks booking system"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/dinks-n-drinks-booking.git
git push -u origin main
```

---

# PART 3 — VERCEL (free hosting) · ~3 min

### 3.1 Import the repo
1. Go to **https://vercel.com** → **Sign up** → **Continue with GitHub** → Authorize.
2. You land on **Overview**. Click **Add New…** → **Project**.
3. Find `dinks-n-drinks-booking` in the list → click **Import**.
   *(If you don't see it: click "Adjust GitHub App Permissions" → grant access to that repo.)*
4. **Configure Project:**
   - Project Name: `dinks-n-drinks` (this becomes your link)
   - Framework Preset: **Other** ✅ (very important — no build step)
   - Root Directory: leave as `./`
   - Build & Output Settings: **leave everything empty/default**
   - Environment Variables: **none needed** (keys live in `config.js`)
5. Click **Deploy** → wait ~30 seconds → 🎉 **Congratulations!**

### 3.2 Your links
| What | Link |
|---|---|
| Customer booking page | `https://dinks-n-drinks.vercel.app` |
| Owner dashboard | `https://dinks-n-drinks.vercel.app/admin` |
| Facebook page button | paste the customer link |

> Later updates: any change you upload to GitHub → Vercel redeploys automatically in ~30 s.

---

# PART 4 — FIRST LOGIN & SETUP (5 min)

1. Open **`https://your-site.vercel.app/admin`**
2. Log in with the **Supabase email + password** you created in step 1.4.
   - (You'll see the demo PIN screen — that's only for the offline demo. Once Supabase is connected, the email login is the real one.)
3. Go to **⚙️ Business Settings** and **verify**:
   - 📱 **GCash number** — preset `0917 708 2805` (your FB contact). Change it if the GCash number is different.
   - **GCash account name** — must match exactly the name on the GCash account (it shows to customers).
   - Court rate **250** · Open play **100/pax** · Paddle **100**
   - Courts **3** · Court hours **8 → 17** (8 AM–5 PM) · Open play **18 → 22** (6–10 PM) · Capacity **24**
4. Click **💾 Save Settings**.
5. **Test it:** open the customer page → book a slot → pay GCash with a dummy ref → go to Admin → you should see the booking → click **Cancel** to free the slot.
6. Share the link on Facebook:
   - FB Page → **Edit** → **Contact and Basic Info** → **Website** → paste your Vercel link
   - Add a **"Book Now"** action button pointing to it
   - Pin a post: *"Book your court online 24/7 🎾👉 (your link)"*
   - Add it to your page bio/username area

---

# ✅ Daily cheat-sheet

| Customer pays | In Admin it says | What you do |
|---|---|---|
| GCash | ⏳ pending | Check your GCash for the amount + **reference no.** → click **Confirm** |
| Over the counter | ⏳ pending | Confirm when they arrive and pay |
| No-show | ⏳ pending | **Cancel** — the slot opens again instantly |

**Filters:** date, status, type, and search by name / mobile / booking ref.

---

# 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| Site shows "Demo mode" banner | The keys in `assets/js/config.js` are empty or wrong — re-check Part 2.2, save, re-upload to GitHub |
| Admin says "Could not load bookings" | Make sure you ran `schema.sql` (Part 1.3) **and** logged in with the Supabase user (Part 1.4) |
| `404` on `/admin` | Confirm `vercel.json` was uploaded to the repo root |
| Customer sees "Booked" on every slot | Run `schema.sql` again — the availability view/grants were missing |
| Bookings don't appear | Upload `config.js` again — check no typo in the URL/key (no spaces) |
| Need to change a price | Admin → Business Settings → Save (customers see it immediately) |

---

# 📌 Keep these safe
- Supabase email + password (admin login)
- Supabase database password
- GitHub + Vercel logins

**Do not share your Supabase `service_role` key with anyone.**
