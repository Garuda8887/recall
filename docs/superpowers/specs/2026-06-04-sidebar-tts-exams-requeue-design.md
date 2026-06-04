# Design: Sidebar Nav, TTS, Exam Countdown, Wrong-Answer Re-queue

**Date:** 2026-06-04  
**Status:** Approved

---

## Overview

Four features shipped together:

1. **Header cleanup + right sidebar** — collapse 5 header icons into one `☰` nav drawer
2. **Exam countdown panel** — multi-exam board with name, optional subject, live day countdown
3. **Text-to-speech on flashcards** — manual 🔊 button per card face, browser-native
4. **Wrong-answer re-queue** — offer to re-study session-weak cards (rated 1–2) at study complete

All changes are confined to `public/index.html`, `public/style.css`, and `public/auth.css` (no server changes, no new dependencies).

---

## 1. Header & Sidebar

### Header — before vs after

| Before | After |
|--------|-------|
| search, streak, stats icon, graph icon, dark toggle, theme icon*, settings icon*, add btn, avatar | search, streak, dark toggle, add btn, avatar, `☰` |

*theme icon and settings icon both called `openSettings()` — this is a pre-existing duplicate that is fixed as part of this work.

Net change: **5 buttons removed, 1 added.**

### Sidebar structure

- Slides in from the right, fixed width 280px
- Semi-transparent backdrop (`rgba(0,0,0,0.18)`) covers the rest of the page; clicking it closes the sidebar
- `Escape` key closes it (wired into the existing global keydown handler)
- Sidebar header: "Menu" label + `×` close button
- Four sections stacked vertically:

```
┌─────────────────────────────┐
│  Menu                    ×  │
├─────────────────────────────┤
│  🎓  Exams        [+ Add]   │
│  ── exam list ──            │
├─────────────────────────────┤
│  📊  Stats            →     │
├─────────────────────────────┤
│  🕸️  Knowledge Graph   →     │
├─────────────────────────────┤
│  ⚙️  Settings          →     │
└─────────────────────────────┘
```

Stats, Graph, and Settings rows are single-tap buttons that open their existing modals (no content moved inline). Only Exams lives inline in the sidebar.

### z-index layering

Sidebar: `z-index: 200`. Backdrop: `z-index: 199`. Existing modals: `z-index: 100`. No conflicts.

---

## 2. Exam Countdown Panel

### Data model

Stored in `localStorage` key `recall_exams`. No server endpoint needed — works identically in local and server modes.

```js
// Shape of each exam object
{
  id: string,        // crypto.randomUUID()
  name: string,      // e.g. "Biology Mock"
  date: string,      // ISO date "YYYY-MM-DD"
  subject: string | null  // must match an existing subject slug, or null
}
```

### Display rules

| Days until exam | Countdown label | Style |
|----------------|-----------------|-------|
| > 1 | "X days" | normal |
| 1 | "Tomorrow" | amber |
| 0 | "Today!" | red, bold |
| < 0 | archived | faded, collapsed under "Past" toggle |

Exams are sorted soonest-first. Past exams collapse under a faded "Past ▼" disclosure row; they are not deleted automatically.

### Add exam form

Inline inside the sidebar Exams section, toggled by `+ Add`:

- **Name** — text input, required, max 60 chars
- **Date** — `<input type="date">`, required, min = today
- **Subject** — `<select>` populated from `[...new Set(sessions.map(s => s.subject).filter(Boolean))]` plus a "No subject" option at top; optional
- Save button: "Add Exam" — disabled until name + date are filled
- Cancel link dismisses the form without saving

### Delete

Each exam card has a `×` delete button. No confirmation dialog (low stakes, easily re-added).

### Loading exams

```js
function loadExams() {
  try { return JSON.parse(localStorage.getItem('recall_exams') || '[]'); }
  catch { return []; }
}
function saveExams(exams) {
  localStorage.setItem('recall_exams', JSON.stringify(exams));
}
```

---

## 3. Text-to-Speech

### API used

`window.speechSynthesis` — available in all modern browsers and Capacitor WebViews with no configuration.

### Behaviour

- `renderStudyCard()` appends a `<button class="tts-btn">` to both `#fcFront` and `#fcBack` after setting their text content.
- Button is positioned `absolute; top: 8px; right: 8px` inside the card face (which gets `position: relative`).
- `onclick` calls `speakText(text)` and `e.stopPropagation()` to prevent triggering the card flip.
- `speakText(text)`: calls `speechSynthesis.cancel()` then `speechSynthesis.speak(new SpeechSynthesisUtterance(text))`.
- Flipping the card (`flipCard()`) calls `speechSynthesis.cancel()` so audio from the front doesn't overlap with the back.
- `closeStudyModal()` calls `speechSynthesis.cancel()`.

### No language picker

Uses the browser/OS default voice. A language picker is out of scope for this release.

### Graceful degradation

If `window.speechSynthesis` is undefined, the TTS buttons are not rendered (feature-detected at render time).

---

## 4. Wrong-Answer Re-queue

### Trigger

At the end of a study session, `showStudyComplete()` inspects `studyState.sessionScores` (a `Map<cardId, score>` already populated during the session). Cards with score `< 3` are collected into `weakIds`.

### UI change on complete screen

- If `weakIds.length === 0`: complete screen unchanged.
- If `weakIds.length > 0`: a third button is added **above** "Study again" and "Done":

  **`↻ Re-study N weak card(s)`** (styled like `btn-ghost`)

### Re-queue session

Clicking the button calls `openStudyModal(deckId, { requeueIds: weakIds })`.

`openStudyModal` gains a new branch:

```js
if (opts.requeueIds && opts.requeueIds.length) {
  const idSet = new Set(opts.requeueIds);
  cards = cards.filter(c => idSet.has(c.id));
  if (!cards.length) { showToast('No weak cards to re-study'); return; }
}
```

The existing `weakOnly` mode (filters on all-time average `< 3`) is **not changed**.

The re-queue session is a fresh `studyState` — `sessionScores` resets — so the user can potentially trigger another re-queue at the end of the re-queue session.

---

## Files Changed

| File | Changes |
|------|---------|
| `public/index.html` | Remove 5 header icon buttons; add `☰` button; add sidebar HTML; add exam panel markup; update `renderStudyCard` for TTS; update `showStudyComplete` for re-queue; add `openStudyModal` requeueIds branch; add JS for sidebar, exams, speakText |
| `public/style.css` | Sidebar slide-in styles; backdrop; exam card styles; TTS button styles; re-queue button on complete screen |

No changes to `server.js`, `local-api.js`, `auth.html`, or `auth.css`.

---

## Out of Scope

- Voice/language selection for TTS
- Exam readiness % score (could be a follow-up)
- Server-side exam persistence (localStorage is sufficient for now)
- Notifications/reminders for exam dates
