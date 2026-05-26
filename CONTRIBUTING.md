# Contributing to Recall

Thanks for taking the time — contributions of any size are welcome.

## Reporting a bug

Open a [GitHub Issue](https://github.com/Garuda8887/recall/issues) and include:
- What you did
- What you expected to happen
- What actually happened
- Your Node.js version (`node -v`)

## Suggesting a feature

Open an issue with the **enhancement** label. Describe the problem you're trying to solve, not just the solution — it helps figure out the best way to approach it.

## Submitting a pull request

1. Fork the repo and create a branch (`git checkout -b my-feature`)
2. Make your changes
3. Test manually — start the server, register an account, and verify the feature works end-to-end
4. Open a PR with a clear description of what changed and why

## Code style notes

- The entire frontend lives in `public/index.html` — vanilla HTML/CSS/JS, no build step, no bundler
- The backend is a single `server.js` — Node.js + Express + better-sqlite3
- Keep it dependency-light; the current stack has exactly 4 npm packages

## Questions

Just open an issue — no question is too small.
