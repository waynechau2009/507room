# 507 room

A shared room occupancy calendar for Yoyo, Sum, Hilary, Leo, Wayne and Cindy.

Click a date, select everyone staying, and save. Uncheck everyone to make the date available again. Dates start blank; multiple roommates can stay on the same day. Everyone using the website shares the same bookings. Changes refresh every eight seconds and when you return to the page. Concurrent edits prompt you to review the latest booking instead of overwriting someone else's changes.

## Put the website online (GitHub Pages + Supabase)

GitHub Pages displays the calendar. Supabase stores the bookings. You do not need to install anything on your computer for this setup.

This is a guest calendar: anyone with the website link or public app configuration can read and edit all dates, without an account. Names are selections, not verified identities. The public key is meant to be visible in the website; it is not a password. The database setup limits access to validated calendar operations. If you need a private calendar, add authentication before sharing it publicly.

### 1. Create the free database

1. Go to [supabase.com](https://supabase.com) and sign up (you can use your GitHub account).
2. Click **New project**. If asked to create an organization, choose the free plan.
3. Name your project `507room`, choose a region near you, and create a database password. Store that password privately; do not put it in GitHub or chat.
4. Wait until the project finishes starting.
5. Open **SQL Editor**, then create a **New query**.
6. Open [supabase/setup.sql](supabase/setup.sql) in this repository. Click **Raw**, copy the entire file, and paste it into the Supabase query.
7. Click **Run**. This creates the calendar storage and the functions that read and save bookings. You can run the script again safely; it preserves existing bookings.

### 2. Copy two public settings into GitHub

In your Supabase project, find the **Project URL** under **Project Settings → Data API**, and the **Publishable key** under **Project Settings → API Keys**. You may also find them in the project's **Connect** panel. Labels can vary slightly.

- The URL looks like `https://YOUR-PROJECT.supabase.co`.
- The publishable key starts with `sb_publishable_`. The legacy `anon` key also works.
- **Never use a secret key, a `service_role` key, or your database password.**

Then open [your repository's Actions variables](https://github.com/waynechau2009/507room/settings/variables/actions):

1. Choose **New repository variable**.
2. Name it `SUPABASE_URL`. Paste the Project URL as its value, and click **Add variable**.
3. Create another variable named `SUPABASE_PUBLISHABLE_KEY`. Paste the public publishable key as its value.

These go in **Variables**, not environment secrets. They are public settings that the website needs.

### 3. Turn on GitHub Pages

1. Open [Settings → Pages](https://github.com/waynechau2009/507room/settings/pages) in this GitHub repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open the [Actions tab](https://github.com/waynechau2009/507room/actions).
4. Select **Deploy calendar to GitHub Pages** on the left.
5. Click **Run workflow**, choose `main`, then click the green **Run workflow** button. If a previous automatic run failed because settings were missing, this new run uses your saved settings.
6. Wait for both **build** and **deploy** to show green checkmarks.
7. Open the website address shown by the deployment. It will normally be `https://waynechau2009.github.io/507room/`.

If GitHub asks you to upgrade your plan to enable Pages for a private repository, check GitHub's current plan requirements. Do not make the repository public unless you are comfortable doing so.

### 4. Test before sharing

1. Open the website and click a date.
2. Select your name and click **Save changes**.
3. Open the same website on your phone or another browser. Your booking should appear there too.
4. Click the date again, choose **Clear date**, then **Save changes** to remove your test stay.
5. Share the website address with your friends.

Creating the Supabase project and adding its settings are required before the live calendar works. The deployment intentionally fails with instructions when those settings are missing. Future pushes to `main` automatically update the website. Supabase data remains separate from GitHub deployments and is not erased by a code update. Free hosting/database plans may have usage limits or pause inactive projects; check the provider dashboard if the calendar becomes unavailable.

## Local development

Requires Node.js 24 or newer. No third-party application dependencies are needed.

```sh
npm start
```

The local Node server listens on port 3000 and stores bookings in `data/room.sqlite`. For development use `npm run dev`; run tests with `npm test`. `PORT` and an absolute `DATA_FILE` can override the defaults. Keep the SQLite database and its WAL files if you need those local bookings.

Local SQLite bookings are separate from your Supabase calendar and are not automatically copied. GitHub Pages only publishes the static files in `public/`; the SQLite database, SQL setup, tests and server code are not published as website files.

To build the static website, set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to your public project settings, then run `npm run build:pages`. Output goes to ignored `dist/`. GitHub Actions does this automatically. The generated config contains only those two public settings. Do not replace `public/config.json` with privileged credentials; its committed local default keeps `npm start` working without Supabase.
