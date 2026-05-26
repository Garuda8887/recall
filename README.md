# Recall — Spaced Repetition Calendar

> A self-hosted, privacy-first study planner that automatically schedules reviews using the SM-2 spaced-repetition algorithm — visualised as a calendar so you always know what to revise and when.

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

---

## Screenshots

### Calendar — main view
![Calendar main view](screenshots/01-calendar-main.png)
*Month view with colour-coded studied sessions and upcoming review chips. Streak counter and due-today banner at the top.*

---

### Add Study Session
![Add session modal](screenshots/02-add-session-modal.png)
*Log a new topic with subject, notes, tags, and an optional weekly or interval-based recurrence rule.*

---

### Populated calendar
![Populated calendar](screenshots/03-calendar-populated.png)
*Multiple sessions across the month — studied chips in their subject colour, review chips in red → orange → yellow → green → blue gradient.*

---

### Full-text search
![Search](screenshots/04-search-mechanics.png)
*Live search filters the calendar to matching sessions. Matches topics, notes, subject, and tags simultaneously.*

---

### Subject filter
![Subject filter](screenshots/05-subject-filter.png)
*One-click subject pill hides all other subjects from the calendar. Physics selected here — only Newton's Laws of Motion and Projectile Motion are shown.*

---

### Day modal — session details, tags & links
![Day modal](screenshots/06-day-modal.png)
*Click any day to see all sessions and reviews. Shows tags, second-brain links with relation labels, forgetting-curve button, and edit/delete controls.*

---

### Confidence rating popup
![Confidence rating](screenshots/07-confidence-rating.png)
*After clicking "Mark done" on a review, pick your recall confidence. The SM-2 algorithm uses your rating to reschedule the next review.*

---

### Forgetting curve
![Forgetting curve](screenshots/08-forgetting-curve.png)
*Per-session exponential decay chart. Filled dots = reviewed; hollow dots = upcoming reviews. Recurring session indicator shown in the header.*

---

### Stats modal
![Stats modal](screenshots/09-stats-modal.png)
*Progress dashboard: activity heatmap (last 13 weeks), per-subject review completion bars with overdue counts, and per-topic retention percentages.*

---

### Second brain — link sessions
![Link sessions](screenshots/10-link-sessions.png)
*Link any two sessions with a typed relationship. Choose the relation type and target session — click Save Link to persist the connection.*

---

### Knowledge graph
![Knowledge graph](screenshots/11-knowledge-graph.png)
*Force-directed graph of all linked topics. Drag nodes to reposition, scroll to zoom, pan the canvas. Edge colours indicate relation type (purple = builds-on, orange = prerequisite, teal = see-also).*

---

### Knowledge graph — subject focus
![Graph subject filter](screenshots/11b-graph-subject-filter.png)
*Click a subject pill in the graph toolbar to dim non-matching nodes and edges — isolates a discipline's knowledge cluster at a glance.*

---

### Dark mode
![Dark mode graph](screenshots/12-dark-mode-graph.png)
*Toggle dark mode from the header. The full app — calendar, modals, and knowledge graph — switches to a deep-navy palette.*

---

### Drag-and-drop reschedule
![Drag and drop](screenshots/13-drag-reschedule.png)
*Drag any undone review chip to a new calendar day to reschedule it. The chip moves and the server persists the new date immediately.*

---

### Settings — custom intervals
![Settings](screenshots/14-settings-intervals.png)
*Override the default SM-2 intervals (1 / 3 / 7 / 14 / 30 days) with any values you prefer. Preview dates update live as you type.*

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm

### Install & run

```bash
# Clone or download the project
cd calender

# Install dependencies
npm install

# Start the server
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

---

## How it works

### SM-2 algorithm

When you mark a review done with a confidence rating (1–5), the server computes:

```
newEaseFactor = max(1.3, EF + 0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
nextInterval  = max(1, round(currentInterval × newEaseFactor))
```

- **Confidence ≥ 3** → pass; ease factor increases slightly; next interval grows.
- **Confidence < 3** → fail; ease factor decreases; review resets to +1 day.
- **"Reschedule from today"** anchors the next review to today rather than the originally-scheduled date, useful for late reviews.

### Review intervals

Default schedule after a study session: **+1 · +3 · +7 · +14 · +30 days**.  
Customise via Settings — changes apply to new sessions only.

### Recurring sessions

Set a session to recur *every Tuesday* or *every N days*. On each page load, the server auto-generates any missing instances up to today (capped at 14 catch-up instances per series to prevent runaway creation).

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
