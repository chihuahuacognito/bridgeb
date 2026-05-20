# Feel-Check Log

Format per session:
## Session N — date

| Pillar | Score 1–5 | Notes |
|---|---|---|
| 1.1 Physics-feel  |  |  |
| 1.2 Visual language |  |  |
| 1.3 Camera        |  |  |
| 1.4 Audio         |  |  |

## Session 5 — 2026-05-11

| Pillar | Score 1–5 | Notes |
|---|---|---|
| 1.1 Physics-feel  | — | pending human verification — anchors held under code review; runtime stress test not performed by agent |
| 1.2 Visual language | N/A | unchanged this session |
| 1.3 Camera        | N/A | introduced in Task 8.5 |
| 1.4 Audio         | N/A | introduced in Task 8.5 |

## Session 6 — 2026-05-11

| Pillar | Score 1–5 | Notes |
|---|---|---|
| 1.1 Physics-feel  | — | pending human verification — runtime drive test not performed by agent |
| 1.2 Visual language | N/A | unchanged this session |
| 1.3 Camera        | — | pending human verification — runtime drive test not performed by agent |
| 1.4 Audio         | N/A | introduced in Task 8.5 |

## Session 11 — 2026-05-20

### What to test manually (browser required)

#### Budget system (commits a27c8b2 → 161a6c7)

| # | Action | Expected |
|---|--------|----------|
| 1 | Load L1 | Green `LEFT: 30` badge to the right of the TEST button |
| 2 | Place road segments | Counter decrements by **2** each time |
| 3 | Place beam segments | Counter decrements by **1** each time |
| 4 | Drain counter to 0 | Badge turns red |
| 5 | Click to place another segment at 0 budget | Badge shakes, **no segment placed**, `pendingJointA` cleared (you can start fresh) |
| 6 | Rapid-click at 0 budget | Badge shakes once cleanly, does not vibrate continuously |
| 7 | Hit **CLEAR** | Counter resets to 30, turns green |
| 8 | Place segments → TEST → hit **RESET** | Counter resets to 30 |
| 9 | Place segments → TEST → let vehicle fall → auto-return | Counter resets to 30 |
| 10 | Load DEV_STRESS | Counter shows 9999, placement never blocks |
| 11 | TEST at 0 budget | Vehicle still spawns and drives normally |

#### Force-based vehicle drive (commit 5f5555e)

The car now uses a proportional force toward target speed instead of a forced velocity. Slopes resist it.

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Flat road anchor-to-anchor | Car reaches normal speed, crosses cleanly |
| 2 | Road sagging into a V (no beam support) | Car slows visibly on the downslope, may stall climbing back up |
| 3 | Steep diagonal road segment (~40°+) | Car slows significantly or stalls |
| 4 | Well-supported flat bridge | Car crosses at full speed — no regression |
| 5 | Downslope segment | Car accelerates past target speed freely (coasts, no braking) |

**Tuning:** Open cheat panel → Vehicle → `Drive Force Gain` (default 0.001).
- Too easy to stall → bump gain up (try 0.002–0.003)
- Car still plows through steep slopes → lower gain (try 0.0005)
- `Drive Speed` is still the target speed the car tries to reach on flat ground

#### Vehicle presets (commit ab231a5 — regression check)

| # | Action | Expected |
|---|--------|----------|
| 1 | Press **1 / 2 / 3** or click CAR / TRUCK / TANK buttons | Active button highlights, density/speed update in cheat panel |
| 2 | TEST with each preset | Heavier vehicles (truck, tank) stall sooner on slopes than car |

---

## Session 8.5 — 2026-05-11

| Pillar | Score 1–5 | Notes |
|---|---|---|
| 1.1 Physics-feel  | — | wobble + slow-mo + cascade implemented; runtime cascade feel pending human gauntlet |
| 1.2 Visual language | — | wobble + glow + color implemented; visual confirmation pending |
| 1.3 Camera        | — | follow + punch-in implemented; smoothness pending |
| 1.4 Audio         | — | STUBBED — audio module is asset-guarded; no audio assets present in repo. Source CC0/CC-BY mp3s for creak/snap/thud/ambient before final gauntlet. |

Pending human verification:
- Phase-1 done-criteria gauntlet (Step 8.5.9) not run by agent — interactive.
- `git tag phase-1-done` (Step 8.5.10) and `releases/` zip artifact deferred to post-gauntlet human review.
- Audio assets: all `audio.playSnap` / `playThud` / `startCreak` / `updateCreak` / ambient-track calls no-op via `scene.cache.audio.exists(key)` guards. End-to-end visual juice (slow-mo, freeze-frame, shake, follow, punch-in, wobble, creak-trigger logic) is wired and will run; actual sound playback is pending asset sourcing.
