# Recall — Spaced Repetition Calendar

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Frontend](https://img.shields.io/badge/frontend-zero%20dependencies-orange.svg)]()
[![Database](https://img.shields.io/badge/database-SQLite-lightgrey.svg)]()

> Anki's algorithm. A calendar you actually want to open.

Anki is effective but its interface is stuck in 2004. Recall gives you the same scientifically-proven SM-2 spaced repetition wrapped in a month-view calendar that makes your entire study schedule visible at a glance. Self-hosted, no sync fees, no card decks — log what you studied and show up when it tells you to.

If Recall is useful to you, consider giving it a ⭐ — it helps others find it.

![Calendar main view](screenshots/01-calendar-main.png)

---

## Features

| Feature | Description |
|---|---|
| **SM-2 Spaced Repetition** | Reviews are scheduled at scientifically-optimal intervals (default: +1, +3, +7, +14, +30 days). Confidence ratings adapt future intervals via ease-factor. |
| **Calendar View** | Month-view calendar with colour-coded chips: studied sessions, review 1–5, overdue indicators. |
| **Confidence Ratings** | Mark reviews with Blank / Hard / Okay / Good / Perfect — the SM-2 algorithm reschedules the next review accordingly. |
| **Forgetting Curve** | Per-session exponential decay chart showing memory retention over time with study and upcoming review markers. |
| **Recurring Sessions** | Schedule a topic to auto-recur weekly or at a fixed interval — catch-up instances are created automatically on login. |
| **Drag-and-Drop Reschedule** | Drag undone review chips to any other calendar day to reschedule them. |
| **Subject Filter** | Filter the calendar by subject (Biology, Languages, Maths…) with one click. |
| **Tags** | Add free-form tags to sessions; filter the calendar by tag from the tag bar. |
| **Full-Text Search** | Instant search across topic, notes, subject and tags with match count. |
| **Second Brain Links** | Connect sessions with typed relations — *Builds on*, *Prerequisite of*, *Related to*, *See also* — displayed inline in the day modal. |
| **Knowledge Graph** | Obsidian-style force-directed graph of all linked sessions with pan, zoom, draggable nodes, and per-subject dimming. |
| **Stats & Heatmap** | Activity heatmap (last 13 weeks), per-subject retention bars with overdue count, and per-topic retention list. |
| **Dark Mode** | Toggle dark mode — the calendar, modals, and knowledge graph all adapt. |
| **Custom Intervals** | Set your own review intervals (e.g. 1 / 7 / 21 / 60 / 120 days). Changes apply to new sessions going forward. |
| **JWT Auth** | Full registration and login; all data is isolated per user. |
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

---

## License

MIT © [Garuda8887](https://github.com/Garuda8887)

Free to use, copy, modify and distribute. The copyright notice above must be included in all copies or substantial portions of the software — if you build on this, you must credit the original author.

---

*Built with ❤️ as a self-hosted alternative to Anki, optimised for visual learners who think in calendars.*
