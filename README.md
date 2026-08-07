# ⚡ Zero to Hero — Summer Camp Scoring System

A comic-book-themed scoring system for an 8-team summer camp: judges score
Games, Bible activities, Individual challenges, and Mentor evaluations from
their phones; everyone watches a live public leaderboard. No servers, no
hosting bills — just static HTML/CSS/JS talking to a Google Apps Script Web
App, with Google Sheets as the database.

---

## 1. What you're deploying

- **Frontend** — plain HTML/CSS/JS. Can be opened directly as a file, hosted
  on GitHub Pages, Google Sites, or any static host.
- **Backend** — a Google Apps Script Web App bound to a Google Sheet. This is
  your entire "server" and database.

No npm, no build step, nothing to compile.

---

## 2. Backend setup (15 minutes)

### Step 1 — Create the Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   blank spreadsheet. Name it **"Zero to Hero Data"**.

### Step 2 — Open Apps Script
1. In the Sheet, go to **Extensions → Apps Script**.
2. Delete the default empty `Code.gs` content.

### Step 3 — Copy in the backend files
1. In the Apps Script editor, create each of the following files (use the
   **+ → Script** button, and match the filenames exactly, without the
   `.gs` — Apps Script adds that automatically) and paste in the matching
   content from this project's `apps-script/` folder:
   - `Code.gs`
   - `Auth.gs`
   - `Scores.gs`
   - `Teams.gs`
   - `Users.gs`
   - `Reports.gs`
2. Click the gear icon (**Project Settings**) → open `appsscript.json` via
   **Show "appsscript.json" manifest file in editor**, then replace its
   contents with the `apps-script/appsscript.json` file from this project.

### Step 4 — Run setup once
1. Back in the `Code.gs` file, select the function dropdown at the top
   (next to Debug) and choose **`setupSpreadsheet`**.
2. Click **Run**. The first time, Google will ask you to authorize the
   script — click through **Review permissions → (your account) →
   Advanced → Go to project (unsafe) → Allow**. This is your own script
   running on your own Sheet; "unsafe" is Google's generic warning for any
   script that hasn't been published to the store.
3. Check the Sheet — you should now see tabs for Teams, Children, Mentors,
   Users, Game Scores, Bible Scores, Individual Scores, Mentor Scores,
   Mentor Questions, Config, Audit Log, and Sessions, pre-loaded with 8
   sample teams and demo accounts (see Step 6).

### Step 5 — Deploy as a Web App
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Settings:
   - **Execute as:** Me (your account)
   - **Who has access:** Anyone
4. Click **Deploy**, authorize again if asked, and copy the **Web app URL**
   it gives you (ends in `/exec`). You'll need this in the next section.

> Any time you edit the backend `.gs` files later, use **Deploy → Manage
> deployments → Edit (pencil) → New version → Deploy** so the live URL picks
> up your changes.

### Step 6 — Default logins
Setup seeds these accounts (change the passwords immediately in the Users
sheet or the Admin → Users tab once you're in):

| Username            | Password    | Role              |
|---------------------|-------------|-------------------|
| `admin`              | `ZeroToHero2024!` | Admin |
| `games_judge`        | `camp2024`  | Games Judge |
| `bible_judge`        | `camp2024`  | Bible Judge |
| `individual_judge`   | `camp2024`  | Individual Judge |
| `mentor_judge`       | `camp2024`  | Mentor Judge |

---

## 3. Frontend setup (2 minutes)

1. Open `js/config.js` in this project.
2. Replace the placeholder with the Web App URL from Step 5:

   ```js
   window.ZTH_CONFIG = {
     API_URL: 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec'
   };
   ```
3. Save. That's it — every page reads from this one file.

### Running it
- **Quickest test:** double-click `index.html` to open it in a browser.
- **For real camp use:** host the folder somewhere so everyone gets a
  clean URL:
  - **GitHub Pages** (free): push this folder to a GitHub repo, enable
    Pages in repo Settings → Pages, pointing at the root of the `main`
    branch.
  - **Google Sites / Drive-hosted:** works too, any static host is fine.

---

## 4. Using the system

- **Public leaderboard:** `leaderboard.html` — no login, auto-refreshes,
  confetti when the #1 team changes. Put this on a projector in "Projector
  Mode" for the hall.
- **Team pages:** click any team on the leaderboard, or link directly to
  `team.html?id=T1`.
- **Judge login:** `login.html` → routes Games/Bible/Individual/Mentor
  judges to their scoring form on `judge.html`.
- **Admin:** `login.html` with the `admin` account → `admin.html` for
  managing teams, campers, mentors, user accounts, point values, the mentor
  questionnaire, undoing mistaken scores, the audit log, CSV export, and
  search.

## 5. How scoring math works

- Nothing is hardcoded: default point values for Games/Bible/Individual and
  the whole Mentor questionnaire (questions, answer options, and their point
  values) live in the **Config** and **Mentor Questions** sheets, editable
  from Admin → Scoring Config.
- Every submission is appended as a new row (never overwritten) and adds to
  the team's **Total Score** on the Teams sheet, inside a `LockService` lock
  so two judges saving at the same instant can't corrupt the total.
- "Undo" (Admin → Overview → Undo a Score) marks the row `Voided` and
  reverses its points — the original entry stays in the sheet for the audit
  trail rather than being deleted.

## 6. Project structure

```
index.html          Landing page
login.html           Judge/Admin login
leaderboard.html      Public live leaderboard
team.html            Public team detail page
judge.html           Judge scoring console (role-aware)
admin.html           Admin dashboard

css/
  style.css          Design tokens, base styles, buttons, badges, toasts
  dashboard.css       Leaderboard/team/admin layouts
  forms.css          Login, judge forms, admin CRUD modals

js/
  config.js          <-- EDIT THIS: your Apps Script Web App URL
  api.js             Fetch wrapper — the only file that talks to the backend
  auth.js            Login/logout/session guard
  utils.js           DOM helpers, toasts, confetti, formatting
  leaderboard.js      Public leaderboard polling + rendering
  teams.js           Team detail page
  judge.js           Judge scoring forms
  admin.js           Admin dashboard (CRUD, config, audit, export, search)

apps-script/
  Code.gs            Web app entry point, routing, one-time setup + seed data
  Auth.gs            Login, sessions, password hashing, role guard
  Scores.gs          Game/Bible/Individual/Mentor score submission (locked)
  Teams.gs           Leaderboard data, team detail, Teams/Children/Mentors CRUD
  Users.gs           Admin user management
  Reports.gs         Dashboard stats, config, undo, audit log, export, search
  appsscript.json     Apps Script project manifest
```

## 7. Security notes

- Passwords are stored as salted SHA-256 hashes, never in plain text.
- Every judge/admin action re-validates the session token **and role** on
  the server — the frontend's claimed role is never trusted.
- All free-text input (notes, activity/task names) is sanitized and length
  limited server-side before being written to the Sheet.
- The public leaderboard endpoints (`getLeaderboard`, `getTeamDetail`,
  `getRecentActivity`, `getPublicStats`) require no login by design — that's
  the whole point of a public scoreboard — but they only ever return
  read-only, non-sensitive data.

## 8. Troubleshooting

- **"Zero to Hero is not connected yet"** — you haven't set `API_URL` in
  `js/config.js`.
- **Login fails with no clear reason** — re-check the Users sheet has an
  `Active` value of `TRUE` for that account, and that you deployed a *New
  version* after any backend edits.
- **Scores aren't showing up** — open the Apps Script editor → Executions
  (left sidebar) to see the actual error from the most recent call.
- **CORS / blank response** — make sure the deployment's "Who has access"
  is set to **Anyone**, not "Anyone with a Google account".
