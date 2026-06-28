# CSV Level Design (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Author/tune per-level *knobs* in CSV at build time; the CSV overrides code defaults, is pre-seeded from current levels, and a round-trip test proves the seed reproduces today's levels.

**Architecture:** Pure `src/data/levelKnobs.js` (`mergeLevelKnobs` + CSV parse/serialize, no Phaser). `scripts/exportLevels.mjs` seeds `gdd/*.csv` from `RAW_LEVELS`; `scripts/genLevels.mjs` parses them into committed `src/data/levelOverrides.generated.js`; `leveldata.js` resolves `ALL_LEVELS` through the merge.

**Tech Stack:** Node ESM scripts, Vitest. CSV in-cell lists use `;` (so the `,` row delimiter is unambiguous).

**Spec:** `docs/superpowers/specs/2026-06-28-convoy-and-csv-levels-design.md`

## Global Constraints

- Code (`leveldata.js`) is geometry + defaults; CSV overrides knobs where present; a missing level row keeps code values (never blanks by omission).
- `DEV_STRESS` is excluded from the CSV (dev sandbox; code-only).
- Generated file is committed and hand-readable; no CSV parser ships in the runtime bundle.
- Stage-only (no commits this pass).

---

## Task B1: `levelKnobs.js` — merge + parse/serialize (pure)

**Files:** Create `src/data/levelKnobs.js`; Test `tests/levelKnobs.test.js`.

**Interfaces (Produces):**
- `KNOWN_VEHICLE_TYPES`, `KNOWN_SIZES`
- `mergeLevelKnobs(base, knobs, { roadMat, woodMat })` → new level object
- `parseLevelsCsv(text)` → `{ [id]: knobs }`; `parseDesignsCsv(text)` → `{ [levelId]: { [type]: design } }`
- `serializeLevelsCsv(rawLevels, ids)` → csv text; `serializeDesignsCsv(rawLevels, ids)` → csv text
- knobs shape: `{ budget?, vehicles?:string[], spawnAt?, convoyGapMs?, roadSizes?, woodSizes?, tools?, span?, gravity?, ui?, stressGlow?, designs? }`

- [ ] **Step 1: failing tests** (`tests/levelKnobs.test.js`) — merge precedence, vehicle expansion + designs, size→material, parse round-trip, validation. (Full code in implementation.)
- [ ] **Step 2:** run → fail.
- [ ] **Step 3:** implement `levelKnobs.js`.
- [ ] **Step 4:** run → pass.

## Task B2: wire `leveldata.js` + initial generated file

**Files:** Create `src/data/levelOverrides.generated.js` (initially `export const LEVEL_OVERRIDES = {}`); Modify `src/data/leveldata.js` (export `RAW_LEVELS`; resolve `ALL_LEVELS` through `mergeLevelKnobs`).

- [ ] Build `RAW_LEVELS` from the L01..L12 + DEV_STRESS objects; `ALL_LEVELS` = each raw level merged with `LEVEL_OVERRIDES[id]` (via `mergeLevelKnobs(lv, ov, { roadMat, woodMat })`), DEV_STRESS passes through.
- [ ] `npm test` stays green (empty overrides == identity).

## Task B3: export + gen scripts, package.json, seed

**Files:** Create `scripts/exportLevels.mjs`, `scripts/genLevels.mjs`; Modify `package.json` (`export:levels`, `gen:levels`); generate `gdd/levels.csv`, `gdd/vehicle_designs.csv`, populate `src/data/levelOverrides.generated.js`.

- [ ] `exportLevels.mjs`: import `RAW_LEVELS`, serialize L01..L12 to the two CSVs; refuse to overwrite existing files unless `--force`.
- [ ] `genLevels.mjs`: parse both CSVs, validate (ids in RAW_LEVELS; types ∈ KNOWN_VEHICLE_TYPES; sizes ∈ KNOWN_SIZES; numbers parse), write `levelOverrides.generated.js`.
- [ ] Run `npm run export:levels` then `npm run gen:levels`; `npm test` stays green.

## Task B4: round-trip test

**Files:** Create `tests/roundtrip.test.js`.

- [ ] For each L01..L12: `mergeLevelKnobs(RAW_LEVELS[id], parsedKnobs[id], { roadMat, woodMat })` deep-equals `RAW_LEVELS[id]` (seeded CSV is a faithful mirror). Also assert `ALL_LEVELS[id]` deep-equals `RAW_LEVELS[id]` after seeding.

## Self-Review
- Spec CSV columns, precedence, seed/refuse-`--force`, round-trip → B1–B4 ✓.
- Out of scope: runtime CSV load, geometry authoring, apps/modules CSV.
