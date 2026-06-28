// src/systems/convoy.js
// Pure convoy controller — NO Phaser/Matter. The scene passes in its clock (nowMs) and
// the live per-vehicle states each frame; this decides spawn cadence + win/fail. Pure so
// cadence and the win condition are unit-testable with deterministic time.
const FALL_MARGIN = 40; // px below world bottom = fell (mirrors LevelScene.checkFall)

export function makeConvoyController({ count, gapMs, checkpointX, worldHeight }) {
  let spawned = 0;
  let startedAt = null;        // nowMs of the first tick; vehicle 0 spawns immediately

  return {
    total: count,
    tick(nowMs, states) {
      if (startedAt === null) startedAt = nowMs;
      const toSpawn = [];
      while (spawned < count && nowMs - startedAt >= spawned * gapMs) {
        toSpawn.push({ index: spawned });
        spawned++;
      }

      let crossedCount = 0;
      let failed = false;
      for (const s of states) {
        if (s.crossed || s.x >= checkpointX) crossedCount++;
        if (s.y > worldHeight + FALL_MARGIN) failed = true;
      }
      const won = !failed && spawned === count && crossedCount >= count;
      return { toSpawn, won, failed, crossedCount, total: count };
    },
  };
}
