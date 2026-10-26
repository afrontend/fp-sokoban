# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, OpenCode, pi, …) working in this repository.
`CLAUDE.md` only imports this file (`@AGENTS.md`); edit this file, not `CLAUDE.md`.

## What this is

`fp-sokoban` is a functional Sokoban game-logic library plus a terminal game, reusable later by a web frontend. It sits in the afrontend game stack:

```
fp-panel (npm) → fp-sokoban (this repo)
```

Status: early. Local git repo on `main` with no remote yet, not published to npm, and no React web app. `PLAN.md` holds the agreed design — read it before changing behavior.

## Commands

```sh
npm test               # ESLint (pretest) then vitest run
npm run test:watch     # vitest in watch mode
npm start              # terminal game (node ./src/example.js)
npm run generate       # generate candidate levels (src/generate.js) → generated/*.json
npm run add-level      # append one generated level to lib/levels.js
npm run levels:append  # append generated levels (src/append.js)
npx vitest run lib/__tests__/levelsSolver.test.js   # single test file
```

ESLint + Prettier are configured in `eslint.config.js`; `pretest` runs ESLint, so lint errors block tests. `generated/*.json` is git-ignored output.

## Layout

- `lib/index.js` — game state machine and public API (CJS, hand-written source)
- `lib/levels.js` — built-in levels (`LEVELS`) and panel size tiers (`SIZE_TIERS`)
- `lib/solver.js` — deadlock detection, `solve`, `getHint`, `evaluateDifficulty`
- `lib/generator.js` — random level candidates, validation, scoring, canonicalization
- `lib/__tests__/` — `fpSokoban`, `levelsSolver`, `generator` tests
- `src/example.js` — terminal game; `src/generate.js` + `src/generator-worker.js` + `src/append.js` — level generation CLI

## Architecture

Levels are string maps: `#` wall, `@` player, `$` box, `.` goal, `*` box on goal, `+` player on goal, space floor.

Follows the shared API of the other game libraries (fp-tetris / fp-block / fp-snake / fp-space), with level-based init:

| Export | Description |
|---|---|
| `init(levelMap)` / `init({ level, levelNumber, rows, columns })` | Initial state from a string map or a built-in level; `init(rows, columns, level)` kept for compatibility |
| `initLevel(n)` / `nextLevel(state)` | Built-in levels; `nextLevel` only advances after the level is cleared |
| `tick(state)` | Advance one frame |
| `key(keyName, state)` | Arrows move/push; `'space'` toggles pause. Win is checked right after a push |
| `join(state)` | Merge panels into one renderable panel |
| `toArray`, `isBlank`, `getTickInterval`, `getDimensions` | Rendering / timing helpers |
| `serializeState` / `restoreState` | Save / load |

Built-in levels grow in panel size with difficulty (`SIZE_TIERS`, from 8×10 up to 14×16). A box on a goal is drawn `yellow`. All transitions are pure.
