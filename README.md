# TypePoise · type with confidence

A local-first typing app for everyday English and code. Practise, take a timed test, play a game, and use one shared skill map to choose your next session.

## Run locally

Use Node.js 20 or later, then run:

```sh
npm start
```

Open **http://127.0.0.1:4173**. No install, account, API key, database, or external font service is needed to run the app. Use a web server rather than opening `index.html` directly, because the app uses JavaScript modules.

## Included in this version

- **Overview:** actual activity, streak, a benchmark from matching completed sessions, recent trend, and a recommended practice session. Standard 60-second tests take priority; other tests and completed practice work too. Empty profiles explain how to set the first benchmark.
- **Practice:** words, sentences, original prose passages (including an email), punctuation, numbers, symbol sets, custom text, and weak-key drills.
- **Code:** all six original languages and their snippets, keyword tracks, symbol sets, and optional automatic indentation.
- **Speed tests:** 15, 30, 60, 120, or a custom 10–600 seconds. Timing starts on the first typed character and text replenishes during a test.
- **Accuracy mode:** incorrect attempts cannot advance the cursor. Standard mode lets the user correct mistakes with Backspace.
- **Focus view:** hides navigation, setup controls, and live statistics until the result. Exit using the visible button or Escape.
- **Type Invaders:** a 60-second falling-word game with 10 shields, increasing pace, and shared per-key tracking. Type the highlighted word; it clears automatically. Spaces between words are optional. The current target and typed prefix stay visible. Wrong characters cost one shield; escaped words cost two. Interrupted games save partial progress.
- **Ghost Race:** one fixed original passage; the first completed race sets a replay, and faster races replace it. The ghost follows actual keystroke positions and corrections, rather than a simulated constant speed.
- **Skill map:** interactive US QWERTY heatmap, key accuracy and interval timing, mistaken characters, frequently missed letter pairs, targeted drills, filtered history, and speed trends.
- **Profile:** XP, levels, calendar-day streaks, four earned achievements, and Void / Paper / Ocean / Terminal themes.
- **Progress:** shared statistics across practice and games, local browser storage, validated JSON export/import, migration from the original `keyforge.v1` profile, and confirmed reset.

## Scoring and data

WPM uses retained correct characters divided by five, divided by elapsed minutes. Raw WPM uses all character attempts. Accuracy uses correct attempts / all attempts: correcting an error does not erase it. Automatic indentation is excluded. Consistency measures variability in correct-key intervals shorter than two seconds, and needs at least five intervals; it is a timing indicator rather than a clinical skill score.

Personal-record comparisons match mode, content track, time limit, accuracy setting, and indentation setting. The overview prefers standard 60-second tests, then another completed test, then completed practice or games. It labels the category used and never counts partial runs as a benchmark. Daily accuracy weights sessions by key attempts. Skill-map history defaults to all saved sessions and labels partial runs. Ghost records apply to the same completed passage only.

Progress is saved every five seconds while typing, on page hide/refresh, on navigation or settings changes, and at completion. Checkpoints update one session without duplicating XP or key counts. **Finish & save** ends early and records a partial session; it does not set a benchmark or ghost replay. Clock time continues if the app is backgrounded. Streaks use the browser's local calendar date. The latest 1,000 sessions are retained, alongside lifetime character/XP totals and aggregate key statistics. The original v1 saved copy stays intact during migration; an explicit reset clears it too. Import replaces the current profile, so export first to keep a copy. Different browsers or origins need export/import to transfer history.

No telemetry, external APIs, multiplayer servers, or AI services are used. All four themes are available immediately.

## Verification

```sh
npm test
```

The Node test suite covers scoring, corrections, timer boundaries, automatic indentation, actual ghost timing, streaks, consistency, shared totals, record categories, legacy migration, invalid imports, and unavailable storage.

Optional browser verification uses Playwright (`1.59.1` was used during development). With the app server running, install Playwright in your development environment and its Chromium browser, then run:

```sh
node tests/browser.mjs
node tests/regressions.mjs
```

Set `KEYFORGE_URL` to change the preview address. Browser checks cover completed practice and corrections, persistence, deadlines, replays, games, code, themes, focus, imports, export, reset confirmation, and overflow at 390px and 320px. Regression checks exercise real page scrolling and fixed desktop navigation, interrupted sessions, reload checkpoints, manual finish, non-60-second benchmarks, weighted accuracy, and a game run with repeated word clears, optional separators, shield loss, and game over. Temporary screenshots go to ignored `work/`. These checks cover the listed scenarios, not every possible device or interaction.

## Redeploy to Netlify

```sh
npm run build
```

This creates **dist/** with the complete static app and a cache-revalidation header file. For a manual deploy, upload the **contents of dist/** together, including every JavaScript module. For a repository deploy, include the new source files, `build.js`, and `netlify.toml` in your commit; Netlify uses `npm run build` and publishes `dist`. The local Node preview server is not needed in production. Desktop sidebar and header stay fixed while page content scrolls.

## Product roadmap

1. **This release — the typing gym:** everyday practice, preserved code tracks, timed tests, two working games, shared skill map, local progression, and themes.
2. **Learning depth:** beginner lessons, richer prose packs, longer-pattern analysis, personal practice goals, daily/weekly challenges, and more achievements. Separate time-on-task and consistency evidence before adding a distinct rhythm score.
3. **Adaptive sessions:** generate deterministic exercises from errors and common letter combinations, then evaluate whether users improve. Optional AI-generated exercises can follow once the local recommendations are useful.
4. **More play:** survival, short dungeon runs, and optional rhythm exercises with reduced-motion and sound settings.
5. **Connected features:** optional accounts and sync, friend challenges, multiplayer, and leaderboards with comparable scoring and replay validation.

### Naming

**TypePoise** is the selected product name. The tagline is **Type with confidence.** “Type” describes the activity, and “poise” suggests control, balance, and confidence. Saved progress intentionally retains the existing `keyforge.v2` and `keyforge.v1` storage identifiers so the rebrand does not reset history. Old backup files remain importable; new exports use `typepoise-progress-YYYY-MM-DD.json`. Existing `KEYFORGE_URL` and `KEYFORGE_ROOT` development overrides remain compatible.
