# Recall — Spaced Repetition Calendar

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Frontend](https://img.shields.io/badge/frontend-zero%20dependencies-orange.svg)]()
[![Database](https://img.shields.io/badge/database-SQLite-lightgrey.svg)]()

> Anki's algorithm. A calendar you actually want to open.

Anki is effective but its interface is stuck in 2004. Recall gives you the same scientifically-proven SM-2 spaced repetition wrapped in a month-view calendar that makes your entire study schedule visible at a glance. Self-hosted, no sync fees, no card decks — log what you studied and show up when it tells you to.

If Recall is useful to you, consider giving it a ⭐ — it helps others find it.

![Calendar main view](screenshots/recall.gif)

---

## Features

| Feature | Description |
|---|---|
| **SM-2 Spaced Repetition** | Reviews are scheduled at scientifically-optimal intervals (default: +1, +3, +7, +14, +30 days). Confidence ratings adapt future intervals via ease-factor. |
| **Calendar View** | Month-view calendar with colour-coded chips: studied sessions, review 1–5, overdue indicators. |
| **Confidence Ratings** | Mark reviews with Blank / Hard / Okay / Good / Perfect — the SM-2 algorithm reschedules the next review accordingly. |
| **Forgetting Curve** | Per-session exponential decay chart with a full review history table (Done / Upcoming / Overdue) below the chart. |
| **Recurring Sessions** | Schedule a topic to auto-recur weekly or at a fixed interval — catch-up instances are created automatically on login. |
| **Drag-and-Drop Reschedule** | Drag undone review chips to any other calendar day to reschedule them. |
| **Subject Filter** | Filter the calendar by subject (Biology, Languages, Maths…) with one click. |
| **Custom Subject Colors** | Pick any color for each subject from Settings → Subject Colors. Overrides the default auto-assigned palette; Reset link shown when a custom color exists. |
| **Tags** | Add free-form tags to sessions; filter the calendar by tag from the tag bar. |
| **Full-Text Search** | Instant search across topic, notes, subject and tags with match count. |
| **Exam Countdown** | Track upcoming exams (name, date, optional subject) in the sidebar. Counts down in days; highlights Tomorrow in amber and Today in red. Past exams collapse under a disclosure row. |
| **Second Brain Links** | Connect sessions with typed relations — *Builds on*, *Prerequisite of*, *Related to*, *See also* — displayed inline in the day modal. |
| **Knowledge Graph** | Obsidian-style force-directed graph of all linked sessions with pan, zoom, draggable nodes, and per-subject dimming. |
| **Stats & Heatmap** | Activity heatmap (last 13 weeks), per-subject retention bars with overdue count, and per-topic retention list. |
| **Dark Mode** | Toggle dark mode — the calendar, modals, and knowledge graph all adapt. |
| **14 Themes** | Built-in theme picker with 14 themes (Professional, Pixel Game, Wabi-Sabi, Brutalist, Synthwave, and more). Fully extensible via CSS custom properties. |
| **Custom Intervals** | Set your own review intervals (e.g. 1 / 7 / 21 / 60 / 120 days). Changes apply to new sessions going forward. |
| **JWT Auth** | Full registration and login; all data is isolated per user. |
| **Flashcard Decks** | Create cards manually, import from Anki (`.apkg`) or `.txt`, or export back to Anki. Card faces support `**bold**` and `` `inline code` `` markdown. Image cards: paste from clipboard or pick a file — stored as base64 in the card JSON, no server upload needed. |
| **Active Recall Practice** | Full-screen study modal: flip with click or Space, rate 1–5 (keyboard shortcuts), 🔊 text-to-speech on every card face, per-card difficulty dot, and a wrong-answer re-queue button to repeat cards rated 1–2 immediately after the session. |
| **Card Difficulty Sort** | "↓ Hardest first" button in the deck editor sorts cards by historical average score — unrated and struggling cards surface to the top. |
| **PWA** | Installable as a native-feeling app on iOS and Android — works offline, home screen icon, no app store required. |

---

## Screenshots

<table>
  <tr>
    <td><img src="screenshots/03-calendar-populated.png"/><br/><sub><b>Populated calendar</b> — studied chips in subject colour, review chips in red → blue gradient.</sub></td>
    <td><img src="screenshots/07-confidence-rating.png"/><br/><sub><b>Confidence rating</b> — rate recall after each review; SM-2 reschedules the next date.</sub></td>
  </tr>
  <tr>
    <td><img src="screenshots/08-forgetting-curve.png"/><br/><sub><b>Forgetting curve</b> — per-session exponential decay chart with past and upcoming review markers.</sub></td>
    <td><img src="screenshots/11-knowledge-graph.png"/><br/><sub><b>Knowledge graph</b> — Obsidian-style force-directed graph of all linked sessions.</sub></td>
  </tr>
  <tr>
    <td><img src="screenshots/12-dark-mode-graph.png"/><br/><sub><b>Dark mode</b> — full dark palette across the calendar, modals, and graph.</sub></td>
    <td><img src="screenshots/09-stats-modal.png"/><br/><sub><b>Stats & heatmap</b> — 13-week activity heatmap and per-subject retention bars.</sub></td>
  </tr>
</table>

<details>
<summary>More screenshots</summary>

### Add Study Session
![Add session modal](screenshots/02-add-session-modal.png)
*Log a new topic with subject, notes, tags, and an optional weekly or interval-based recurrence rule.*

### Full-text search
![Search](screenshots/04-search-mechanics.png)
*Live search filters the calendar to matching sessions. Matches topics, notes, subject, and tags simultaneously.*

### Subject filter
![Subject filter](screenshots/05-subject-filter.png)
*One-click subject pill hides all other subjects. Physics selected here — only Newton's Laws and Projectile Motion shown.*

### Day modal — session details, tags & links
![Day modal](screenshots/06-day-modal.png)
*Click any day to see all sessions and reviews. Shows tags, second-brain links, forgetting-curve button, and edit/delete controls.*

### Second brain — link sessions
![Link sessions](screenshots/10-link-sessions.png)
*Link any two sessions with a typed relationship. Choose the relation type and target session — click Save Link to persist.*

### Knowledge graph — subject focus
![Graph subject filter](screenshots/11b-graph-subject-filter.png)
*Click a subject pill in the graph toolbar to dim non-matching nodes — isolates a discipline's knowledge cluster at a glance.*

### Drag-and-drop reschedule
![Drag and drop](screenshots/13-drag-reschedule.png)
*Drag any undone review chip to a new calendar day to reschedule it. The server persists the new date immediately.*

### Settings — custom intervals
![Settings](screenshots/14-settings-intervals.png)
*Override the default SM-2 intervals with any values you prefer. Preview dates update live as you type.*

</details>

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm

### Install & run

```bash
git clone https://github.com/Garuda8887/recall.git
cd recall
npm install
node server.js
```

Open **http://localhost:3000** in your browser, register an account, and start logging sessions.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | `recall-dev-secret-please-change-in-production` | **Change this in production** |

```bash
JWT_SECRET=my-super-secret-key PORT=8080 node server.js
```

### Install as an app (PWA)

Recall is a fully installable Progressive Web App — no app store required.

| Platform | How to install |
|---|---|
| **iOS / iPadOS** | Open in Safari → Share → **Add to Home Screen** |
| **Android** | Open in Chrome → three-dot menu → **Add to Home Screen** (or accept the install prompt) |
| **Desktop (Chrome / Edge)** | Click the install icon in the address bar |

Once installed it launches fullscreen with its own icon, just like a native app. It also works offline — the app shell is cached locally so the UI loads instantly even without a connection (data syncs when you're back online).

**Updating:** just `git pull` on your server. The service worker detects the new version and refreshes automatically on next open — no reinstall needed.

---

## How it works

### SM-2 algorithm

After each review you rate your recall from 1 (blank) to 5 (perfect). SM-2 uses that score to grow or shrink the next interval — ace it repeatedly and reviews get pushed further out; struggle and it resets to the next day. The default schedule after a new session is **+1 · +3 · +7 · +14 · +30 days**, fully customisable in Settings.

### Flashcard decks

After logging a session you're prompted to attach a flashcard deck — create cards manually or import from an existing file. Three import paths are supported:

| Format | How |
|---|---|
| **Anki `.apkg`** | Choose the file in the import dialog; the server extracts the SQLite database from the ZIP and parses all notes automatically. HTML formatting is stripped. |
| **Text `.txt`** | Tab-separated, pipe-separated, or comma-separated `front / back` pairs — one card per line. Lines starting with `#` are treated as comments. |
| **Manual** | Type cards directly in the deck editor; Tab from the last field adds a new row. |

Decks can be exported back to a tab-separated `.txt` compatible with Anki's plain-text import.

**Card content** — each card face can be:
- **Text with markdown** — `**bold**`, `` `inline code` ``, and newlines are rendered during study. The deck editor stays plain text for easy editing.
- **An image** — paste an image from your clipboard directly into a card field, or click 📷 to pick a file. The image is stored as a base64 data URL inside the card JSON — no server upload, no external URLs.

The deck editor also has a **"↓ Hardest first"** button that sorts your cards by historical average score, putting the ones you've been getting wrong at the top so you can focus on weak spots.

Once a deck is attached, a **Practice** button appears next to "Mark done" wherever that review surfaces — in the due-today banner on the main calendar and inside the day modal. Clicking Practice opens the study modal so you never lose your place. After going through the last card a score screen shows your results; if any cards were rated 1–2, an **↻ Re-study N weak cards** button lets you repeat just those cards immediately. You can also study again in full or close and mark the review done.

Each card face has a 🔊 text-to-speech button (browser-native `speechSynthesis`, no API key needed) — useful for language learning or studying with eyes closed.

### Recurring sessions

Set a session to recur *every Tuesday* or *every N days*. Any missed instances since the last login are auto-created (capped at 14 catch-ups per series).

---

## Tech stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| Database | SQLite via `better-sqlite3` (zero-config, single file) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Frontend | Vanilla HTML/CSS/JS — single-file SPA (`public/index.html`) |
| Graph | Custom force-directed simulation (Coulomb repulsion + Hooke springs + gravity) rendered in SVG |

---

## Theming

Recall ships with 14 built-in themes — including **Professional**, **Pixel Game**, **Wabi-Sabi**, **Brutalist**, **Dark Synthwave**, and more — switchable from the sidebar (☰ → Settings → Theme). Themes persist across reloads via `localStorage`.

### How the system works

- Themes are driven by a `data-theme` attribute on `<body>` (e.g. `data-theme="pixel"`).
- Each theme is a self-contained CSS block in `public/style.css` scoped to `[data-theme="yourtheme"]` — the default styles are never touched.
- The JS `THEMES` array in `public/index.html` registers each theme for the picker UI.

### Adding a new theme

**1. Register it in the picker** — find the `THEMES` array near the top of the `<script>` block in `public/index.html` and add an entry:

```js
{
  id: 'mytheme',           // matches data-theme value
  name: 'My Theme',        // shown in the picker
  desc: 'One-line mood',   // shown below the name
  swatches: ['#bg','#accent','#secondary','#text'], // four preview dots
},
```

**2. Write the CSS block** — append to the bottom of `public/style.css`:

```css
/* ── My Theme ── */
[data-theme="mytheme"] {
  /* Design tokens — override as many or as few as you need */
  --ff:          'Your Font', sans-serif;
  --ff-heading:  'Your Font', sans-serif;
  --bg:          #…;   /* page background */
  --surface:     #…;   /* card / modal background */
  --surface-2:   #…;   /* secondary surfaces */
  --border:      #…;   /* primary border colour */
  --border-soft: #…;   /* subtle borders */
  --tx:          #…;   /* primary text */
  --tx-2:        #…;   /* secondary text */
  --tx-3:        #…;   /* muted / placeholder text */
  --accent:      #…;   /* buttons, highlights, today badge */
  --accent-dk:   #…;   /* darker accent for hover states */
  --accent-bg:   #…;   /* light accent tint (badges, chips) */
  --accent-glow: rgba(…, 0.18); /* active-card glow in the picker */
  --sh-xs: …;  --sh-sm: …;  --sh-md: …;  --sh-lg: …; /* shadows */
  --r-xs: …;   --r-sm: …;   --r-md: …;   --r-lg: …;  --r-xl: …; /* radii */
}

/* Structural overrides — only what the token system can't handle */
[data-theme="mytheme"] header { … }
[data-theme="mytheme"] .logo  { … }
/* … etc */

/* Optional dark variant */
[data-theme="mytheme"].dark { … }
```

**3. Add the font** (if needed) — extend the single `@import` at the top of `style.css`:

```css
@import url('https://fonts.googleapis.com/css2?…&family=YourFont&display=swap');
```

That's it — the picker renders automatically, selection is saved to `localStorage`, and the `data-theme` attribute is applied on page load before first paint.

---

## API reference

All session routes require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register `{ email, password }` |
| `POST` | `/api/auth/login` | Login → returns JWT |
| `GET` | `/api/auth/me` | Verify token |
| `GET` | `/api/sessions` | List all sessions (auto-creates due recurrences) |
| `POST` | `/api/sessions` | Create a session |
| `PUT` | `/api/sessions/:id` | Update topic / subject / notes / tags |
| `DELETE` | `/api/sessions/:id` | Delete session and its links |
| `PATCH` | `/api/sessions/:id/reviews/:index` | Mark done (with confidence + SM-2), undo, or reschedule (`newDate`) |
| `GET` | `/api/links` | List knowledge-graph links |
| `POST` | `/api/links` | Create a link `{ fromId, toId, relation }` |
| `DELETE` | `/api/links/:id` | Remove a link |
| `GET` | `/api/settings` | Get custom intervals |
| `PUT` | `/api/settings` | Save custom intervals |
| `GET` | `/api/decks` | List all decks for the user |
| `POST` | `/api/decks` | Create a deck `{ session_id, name, cards }` |
| `PUT` | `/api/decks/:id` | Update deck name or cards |
| `DELETE` | `/api/decks/:id` | Delete a deck |
| `POST` | `/api/decks/parse-apkg` | Parse an Anki `.apkg` file (binary body) → returns `{ cards }` |

---

## License

MIT © [Garuda8887](https://github.com/Garuda8887)

Free to use, copy, modify and distribute. The copyright notice above must be included in all copies or substantial portions of the software — if you build on this, you must credit the original author.

---

*Built with ❤️ as a self-hosted alternative to Anki, optimised for visual learners who think in calendars.*
