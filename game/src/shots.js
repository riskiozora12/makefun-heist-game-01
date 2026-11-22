// Night Vault — staged scenes for the screenshots.
// Each shot builds one exact, deterministic moment of the game:
// the title, a thief mid-room, a chase at full alarm, and the win.
// The page reads ?shot=<name>&seed=<n>; the scene is set up from the
// seed alone, so the same shot renders the same frame every time.

import { TILE } from './config.js';
import { createWorld } from './world.js';

function tileCentre(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

function placeThief(world, tx, ty, heading) {
  const at = tileCentre(tx, ty);
  world.player.x = at.x;
  world.player.y = at.y;
  world.player.heading = heading;
}

function placeGuard(world, index, tx, ty, heading, state, suspicion) {
  const guard = world.guards[index];
  const at = tileCentre(tx, ty);
  guard.x = at.x;
  guard.y = at.y;
  guard.heading = heading;
  guard.state = state;
  guard.suspicion = suspicion;
  if (state === 'chase') {
    guard.lastSeen = { x: world.player.x, y: world.player.y };
    guard.memory = 3;
  }
}

// The win screen's score comes from a real autopilot run of this
// build (see /tmp/autopilot.mjs); it is a measured result, not a wish.
export const END_SHOT_SCORE = 4110;
export const END_SHOT_TIME = 166;
export const END_SHOT_LIVES = 3;

export function buildShot(name, seed) {
  if (name === 'start') {
    const world = createWorld(0, seed);
    return { world, screen: 'title', status: 'Three rooms. One diamond. No alarms, if you are good.' };
  }
  if (name === 'play') {
    const world = createWorld(1, seed);
    world.time = 5;
    placeThief(world, 10, 8, -Math.PI / 2);
    world.score = 400;
    world.alarm = 32;
    world.maxAlarm = 32;
    return { world, screen: 'play', status: 'Crossing the Vault Corridor — the gold bars are ahead.' };
  }
  if (name === 'chase') {
    const world = createWorld(1, seed);
    world.time = 5;
    placeThief(world, 10, 8, Math.PI);
    placeGuard(world, 0, 13, 8, Math.PI, 'chase', 100);
    placeGuard(world, 1, 6, 12, 0, 'patrol', 0);
    world.score = 400;
    world.alarm = 88;
    world.maxAlarm = 88;
    return { world, screen: 'play', status: 'Spotted — the alarm is climbing. Run for cover.' };
  }
  if (name === 'end') {
    const world = createWorld(2, seed);
    world.state = 'win';
    world.score = END_SHOT_SCORE;
    world.totalTime = END_SHOT_TIME;
    world.lives = END_SHOT_LIVES;
    world.loot.taken = true;
    world.bonus.taken = true;
    world.exit.open = true;
    return { world, screen: 'win', status: 'The Meridian Diamond is yours.' };
  }
  return null;
}
