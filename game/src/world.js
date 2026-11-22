// Night Vault — the simulation.
// Pure logic, no DOM and no canvas: given a room and a stream of
// inputs it advances the heist one tick at a time. The browser loop
// and the headless autopilot both drive it through stepWorld, so the
// game a human plays is exactly the game the tests exercise.

import {
  TILE,
  PLAYER_RADIUS,
  PLAYER_WALK,
  PLAYER_SNEAK,
  PLAYER_LIVES,
  GUARD_RADIUS,
  GUARD_PATROL_SPEED,
  GUARD_HUNT_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_VISION_RANGE,
  GUARD_VISION_HALF_ANGLE,
  GUARD_TURN_SPEED,
  ELITE_RANGE_BONUS,
  ELITE_SPEED_BONUS,
  ELITE_SUSPICION_BONUS,
  SUSPICION_WARY,
  SUSPICION_CHASE,
  SUSPICION_MAX,
  SUSPICION_GAIN,
  SUSPICION_DECAY,
  SNEAK_SPOT_FACTOR,
  CHASE_MEMORY,
  INVESTIGATE_LOOK_TIME,
  CAMERA_RANGE,
  CAMERA_HALF_ANGLE,
  CAMERA_SWEEP,
  CAMERA_SWEEP_SPEED,
  CAMERA_LOCK_TIME,
  ALARM_MAX,
  ALARM_CHASE_RATE,
  ALARM_CAMERA_RATE,
  ALARM_DECAY,
  ALARM_LOCKDOWN_DECAY,
  ALARM_GHOST_LIMIT,
  CAUGHT_ALARM_RELIEF,
  TOOLS_PER_ROOM,
  COIN_THROW_RANGE,
  COIN_HEARING_RANGE,
  SMOKE_RADIUS_TILES,
  SMOKE_DURATION,
  EMP_DURATION,
  ROOM_CLEAR_BONUS,
  TIME_BONUS_RATE,
  GHOST_BONUS,
} from './config.js';
import { inCone, findPath, isWall } from './vision.js';
import { makeRng, range } from './random.js';
import { ROOMS } from './levels.js';

const CATCH_DISTANCE = 0.65 * TILE;
const PICKUP_DISTANCE = 0.7 * TILE;
const GUARD_ARRIVE = 5; // pixels: close enough to a path point

function tileCentre(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

function circleHitsWall(grid, x, y, r) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (!isWall(grid, tx, ty)) continue;
      const closestX = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const closestY = Math.max(ty * TILE, Math.min(y, (ty + 1) * TILE));
      if (Math.hypot(x - closestX, y - closestY) < r) return true;
    }
  }
  return false;
}

// Move one axis at a time so the thief slides along walls instead of
// sticking to them.
function tryMove(grid, pos, dx, dy, r) {
  const nx = pos.x + dx;
  if (!circleHitsWall(grid, nx, pos.y, r)) pos.x = nx;
  const ny = pos.y + dy;
  if (!circleHitsWall(grid, pos.x, ny, r)) pos.y = ny;
}

function parseRoom(def) {
  const grid = def.map.map((row) => row.split(''));
  const found = { P: null, E: null, L: null, B: null };
  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (found[cell] !== undefined && found[cell] === null) found[cell] = { x, y };
    });
  });
  return { grid, ...found };
}

export function createWorld(roomIndex, seed) {
  const world = {
    roomIndex,
    seed,
    rng: makeRng(seed * 31 + roomIndex * 7 + 11),
    time: 0,
    state: 'play', // play | caught | win | gameover
    caughtTimer: 0,
    score: 0,
    lives: PLAYER_LIVES,
    totalTime: 0,
    events: [],
  };
  loadRoom(world, roomIndex);
  return world;
}

export function loadRoom(world, roomIndex) {
  const def = ROOMS[roomIndex];
  const parsed = parseRoom(def);
  world.roomIndex = roomIndex;
  world.def = def;
  world.grid = parsed.grid;
  world.roomTime = 0;
  world.maxAlarm = 0;
  world.alarm = 0;
  world.lockdown = false;
  const start = tileCentre(parsed.P.x, parsed.P.y);
  world.player = {
    x: start.x,
    y: start.y,
    heading: -Math.PI / 2,
    sneak: false,
    moving: false,
  };
  world.startTile = { x: parsed.P.x, y: parsed.P.y };
  const exitAt = tileCentre(parsed.E.x, parsed.E.y);
  world.exit = { x: exitAt.x, y: exitAt.y, tx: parsed.E.x, ty: parsed.E.y, open: false };
  const lootAt = tileCentre(parsed.L.x, parsed.L.y);
  world.loot = { x: lootAt.x, y: lootAt.y, taken: false, name: def.lootName, value: def.lootValue };
  const bonusAt = tileCentre(parsed.B.x, parsed.B.y);
  world.bonus = { x: bonusAt.x, y: bonusAt.y, taken: false, name: def.bonusName, value: def.bonusValue };
  world.guards = def.guards.map((g) => {
    const first = tileCentre(g.waypoints[0][0], g.waypoints[0][1]);
    return {
      x: first.x,
      y: first.y,
      heading: 0,
      elite: g.elite,
      waypoints: g.waypoints.map(([wx, wy]) => tileCentre(wx, wy)),
      waypointIndex: 1 % g.waypoints.length,
      state: 'patrol', // patrol | wary | investigate | chase
      suspicion: 0,
      pauseTimer: 0,
      sweepDir: 1,
      lookTimer: 0,
      lastSeen: null,
      memory: 0,
      path: null,
      pathTimer: 0,
      pathTarget: null,
    };
  });
  world.cameras = def.cameras.map((c) => {
    const at = tileCentre(c.x, c.y);
    return {
      x: at.x,
      y: at.y,
      baseHeading: c.heading,
      heading: c.heading,
      lock: 0,
      locked: false,
      disabledUntil: 0,
      phase: world.rng() * Math.PI * 2,
    };
  });
  world.tools = { ...TOOLS_PER_ROOM };
  world.smokes = [];
  world.coins = [];
  world.state = 'play';
}

function guardSpeed(guard, kind) {
  const base = kind === 'chase' ? GUARD_CHASE_SPEED : kind === 'hunt' ? GUARD_HUNT_SPEED : GUARD_PATROL_SPEED;
  return base * (guard.elite ? ELITE_SPEED_BONUS : 1) * TILE;
}

function guardRange(guard) {
  return GUARD_VISION_RANGE + (guard.elite ? ELITE_RANGE_BONUS : 0);
}

function moveAlongPath(world, guard, speed, dt) {
  if (!guard.path || guard.path.length === 0) return true;
  const target = guard.path[0];
  const dx = target[0] - guard.x;
  const dy = target[1] - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < GUARD_ARRIVE) {
    guard.path.shift();
    return guard.path.length === 0;
  }
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  const pos = { x: guard.x, y: guard.y };
  tryMove(world.grid, pos, nx - guard.x, ny - guard.y, GUARD_RADIUS);
  guard.x = pos.x;
  guard.y = pos.y;
  guard.heading = Math.atan2(dy, dx);
  return false;
}

function repathGuard(world, guard, tx, ty) {
  const fromTx = Math.floor(guard.x / TILE);
  const fromTy = Math.floor(guard.y / TILE);
  const path = findPath(world.grid, fromTx, fromTy, tx, ty, null);
  guard.path = path ? path.slice(1) : null;
  guard.pathTimer = 0.5;
  guard.pathTarget = { x: tx, y: ty };
}

function updateGuard(world, guard, dt) {
  const player = world.player;
  const smokes = world.smokes;
  const seen = inCone(
    world.grid,
    { x: guard.x, y: guard.y, heading: guard.heading },
    player,
    guardRange(guard),
    GUARD_VISION_HALF_ANGLE,
    smokes,
  );
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
  if (seen) {
    const closeness = 1 - Math.min(1, dist / (guardRange(guard) * TILE));
    let gain = SUSPICION_GAIN * (0.35 + 0.65 * closeness) * dt;
    if (player.sneak) gain *= SNEAK_SPOT_FACTOR;
    if (guard.elite) gain *= ELITE_SUSPICION_BONUS;
    guard.suspicion = Math.min(SUSPICION_MAX, guard.suspicion + gain);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.memory = CHASE_MEMORY;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DECAY * dt);
    guard.memory = Math.max(0, guard.memory - dt);
  }

  if (guard.suspicion >= SUSPICION_CHASE && guard.state !== 'chase') {
    guard.state = 'chase';
    world.events.push('alert');
  } else if (guard.state === 'chase' && guard.suspicion < SUSPICION_WARY && guard.memory <= 0) {
    guard.state = 'investigate';
    guard.lookTimer = 0;
  } else if (guard.state !== 'chase' && guard.suspicion >= SUSPICION_WARY && guard.state === 'patrol') {
    guard.state = 'wary';
    guard.lookTimer = 1.2;
  }

  if (guard.state === 'patrol') {
    if (guard.pauseTimer > 0) {
      guard.pauseTimer -= dt;
      guard.heading += guard.sweepDir * GUARD_TURN_SPEED * dt * 0.4;
      if (guard.heading > Math.PI) guard.sweepDir = -1;
      if (guard.heading < -Math.PI) guard.sweepDir = 1;
      return;
    }
    // Walk the corridors to the next waypoint by breadth-first search,
    // so a patrol never gets stuck on a wall between two waypoints.
    const target = guard.waypoints[guard.waypointIndex];
    const tx = Math.floor(target.x / TILE);
    const ty = Math.floor(target.y / TILE);
    guard.pathTimer -= dt;
    if (!guard.path || guard.pathTimer <= 0) {
      const fromTx = Math.floor(guard.x / TILE);
      const fromTy = Math.floor(guard.y / TILE);
      const path = findPath(world.grid, fromTx, fromTy, tx, ty, null);
      guard.path = path ? path.slice(1) : null;
      guard.pathTimer = 0.5;
    }
    const arrived = moveAlongPath(world, guard, guardSpeed(guard, 'patrol'), dt);
    if (arrived || !guard.path) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.pauseTimer = range(world.rng, 0.6, 1.2);
      guard.path = null;
    }
    return;
  }

  if (guard.state === 'wary') {
    if (guard.lastSeen) {
      guard.heading = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
    }
    guard.lookTimer -= dt;
    if (guard.lookTimer <= 0) {
      guard.state = 'investigate';
      guard.path = null;
    }
    return;
  }

  if (guard.state === 'investigate') {
    if (!guard.lastSeen) {
      guard.state = 'patrol';
      return;
    }
    const tx = Math.floor(guard.lastSeen.x / TILE);
    const ty = Math.floor(guard.lastSeen.y / TILE);
    guard.pathTimer -= dt;
    if (!guard.path || guard.pathTimer <= 0) repathGuard(world, guard, tx, ty);
    const arrived = moveAlongPath(world, guard, guardSpeed(guard, 'hunt'), dt);
    if (arrived) {
      guard.lookTimer += dt;
      guard.heading += GUARD_TURN_SPEED * dt * 0.5;
      if (guard.lookTimer >= INVESTIGATE_LOOK_TIME) {
        guard.state = 'patrol';
        guard.lookTimer = 0;
        guard.path = null;
      }
    }
    return;
  }

  // chase
  if (seen) {
    const tx = Math.floor(player.x / TILE);
    const ty = Math.floor(player.y / TILE);
    guard.pathTimer -= dt;
    if (!guard.path || guard.pathTimer <= 0) repathGuard(world, guard, tx, ty);
    moveAlongPath(world, guard, guardSpeed(guard, 'chase'), dt);
  } else if (guard.lastSeen) {
    const tx = Math.floor(guard.lastSeen.x / TILE);
    const ty = Math.floor(guard.lastSeen.y / TILE);
    guard.pathTimer -= dt;
    if (!guard.path || guard.pathTimer <= 0) repathGuard(world, guard, tx, ty);
    moveAlongPath(world, guard, guardSpeed(guard, 'chase'), dt);
  }
}

function updateCamera(world, camera, dt) {
  camera.heading = camera.baseHeading + Math.sin(world.time * CAMERA_SWEEP_SPEED + camera.phase) * CAMERA_SWEEP;
  if (world.time < camera.disabledUntil) {
    camera.lock = 0;
    camera.locked = false;
    return;
  }
  const seen = inCone(
    world.grid,
    { x: camera.x, y: camera.y, heading: camera.heading },
    world.player,
    CAMERA_RANGE,
    CAMERA_HALF_ANGLE,
    world.smokes,
  );
  if (seen) {
    camera.lock = Math.min(CAMERA_LOCK_TIME, camera.lock + dt);
    camera.locked = camera.lock >= CAMERA_LOCK_TIME;
  } else {
    camera.lock = Math.max(0, camera.lock - dt * 2);
    camera.locked = false;
  }
}

function applyCatch(world) {
  world.lives -= 1;
  world.events.push('caught');
  if (world.lives <= 0) {
    world.state = 'gameover';
    world.events.push('gameover');
    return;
  }
  world.state = 'caught';
  world.caughtTimer = 1.4;
}

function respawn(world) {
  const start = tileCentre(world.startTile.x, world.startTile.y);
  world.player.x = start.x;
  world.player.y = start.y;
  world.player.heading = -Math.PI / 2;
  world.alarm = Math.max(0, world.alarm - CAUGHT_ALARM_RELIEF);
  world.lockdown = false;
  for (const guard of world.guards) {
    const first = guard.waypoints[0];
    guard.x = first.x;
    guard.y = first.y;
    guard.state = 'patrol';
    guard.suspicion = 0;
    guard.lastSeen = null;
    guard.memory = 0;
    guard.path = null;
    guard.waypointIndex = 1 % guard.waypoints.length;
  }
  for (const camera of world.cameras) {
    camera.lock = 0;
    camera.locked = false;
  }
  world.state = 'play';
}

function finishRoom(world) {
  const def = world.def;
  const timeBonus = Math.max(0, def.par - world.roomTime) * TIME_BONUS_RATE;
  const ghost = world.maxAlarm <= ALARM_GHOST_LIMIT ? GHOST_BONUS : 0;
  const gained = ROOM_CLEAR_BONUS + Math.round(timeBonus) + ghost;
  world.score += gained;
  world.events.push('roomclear');
  if (world.roomIndex + 1 >= ROOMS.length) {
    world.state = 'win';
    world.events.push('win');
    return;
  }
  const score = world.score;
  const lives = world.lives;
  const totalTime = world.totalTime;
  loadRoom(world, world.roomIndex + 1);
  world.score = score;
  world.lives = lives;
  world.totalTime = totalTime;
}

export function stepWorld(world, input, dt) {
  world.events = [];
  world.time += dt;
  world.totalTime += dt;
  if (world.state === 'caught') {
    world.caughtTimer -= dt;
    if (world.caughtTimer <= 0) respawn(world);
    return world.events;
  }
  if (world.state !== 'play') return world.events;

  world.roomTime += dt;
  const player = world.player;

  // --- tools ---------------------------------------------------------------
  if (input.coin && world.tools.coin > 0) {
    const dx = input.coin.x - player.x;
    const dy = input.coin.y - player.y;
    const dist = Math.hypot(dx, dy);
    const rangePx = COIN_THROW_RANGE * TILE;
    const land = dist > rangePx
      ? { x: player.x + (dx / dist) * rangePx, y: player.y + (dy / dist) * rangePx }
      : { x: input.coin.x, y: input.coin.y };
    world.tools.coin -= 1;
    world.coins.push({ x: land.x, y: land.y, ttl: 2 });
    world.events.push('coin');
    for (const guard of world.guards) {
      const gdist = Math.hypot(guard.x - land.x, guard.y - land.y);
      if (gdist <= COIN_HEARING_RANGE * TILE && guard.state !== 'chase') {
        guard.lastSeen = { x: land.x, y: land.y };
        guard.state = 'investigate';
        guard.path = null;
        guard.lookTimer = 0;
      }
    }
  }
  if (input.smoke && world.tools.smoke > 0) {
    world.tools.smoke -= 1;
    world.smokes.push({ x: player.x, y: player.y, r: SMOKE_RADIUS_TILES * TILE, ttl: SMOKE_DURATION });
    world.events.push('smoke');
  }
  if (input.emp && world.tools.emp > 0) {
    world.tools.emp -= 1;
    for (const camera of world.cameras) camera.disabledUntil = world.time + EMP_DURATION;
    world.events.push('emp');
  }

  // --- movement --------------------------------------------------------------
  const speed = (input.sneak ? PLAYER_SNEAK : PLAYER_WALK) * TILE;
  player.sneak = !!input.sneak;
  const mx = input.mx || 0;
  const my = input.my || 0;
  player.moving = mx !== 0 || my !== 0;
  if (player.moving) {
    player.heading = Math.atan2(my, mx);
    tryMove(world.grid, player, mx * speed * dt, my * speed * dt, PLAYER_RADIUS);
  }

  // --- timers ------------------------------------------------------------------
  for (const smoke of world.smokes) smoke.ttl -= dt;
  world.smokes = world.smokes.filter((s) => s.ttl > 0);
  for (const coin of world.coins) coin.ttl -= dt;
  world.coins = world.coins.filter((c) => c.ttl > 0);

  // --- guards and cameras -------------------------------------------------------
  for (const guard of world.guards) updateGuard(world, guard, dt);
  for (const camera of world.cameras) updateCamera(world, camera, dt);

  // --- alarm ---------------------------------------------------------------------
  const anyChase = world.guards.some((g) => g.state === 'chase');
  const anyLock = world.cameras.some((c) => c.locked);
  if (anyChase) world.alarm += ALARM_CHASE_RATE * dt;
  else if (anyLock) world.alarm += ALARM_CAMERA_RATE * dt;
  else if (world.alarm >= ALARM_MAX) world.alarm -= ALARM_LOCKDOWN_DECAY * dt;
  else world.alarm -= ALARM_DECAY * dt;
  world.alarm = Math.max(0, Math.min(ALARM_MAX, world.alarm));
  world.maxAlarm = Math.max(world.maxAlarm, world.alarm);
  world.lockdown = world.alarm >= ALARM_MAX;
  if (world.lockdown) {
    for (const guard of world.guards) {
      if (guard.state === 'patrol') {
        guard.lastSeen = { x: player.x, y: player.y };
        guard.state = 'investigate';
        guard.path = null;
        guard.lookTimer = 0;
      }
    }
  }

  // --- caught? ---------------------------------------------------------------------
  for (const guard of world.guards) {
    if (Math.hypot(guard.x - player.x, guard.y - player.y) < CATCH_DISTANCE) {
      applyCatch(world);
      return world.events;
    }
  }

  // --- loot -------------------------------------------------------------------------
  if (!world.loot.taken && Math.hypot(world.loot.x - player.x, world.loot.y - player.y) < PICKUP_DISTANCE) {
    world.loot.taken = true;
    world.score += world.loot.value;
    world.exit.open = true;
    world.events.push('pickup');
  }
  if (!world.bonus.taken && Math.hypot(world.bonus.x - player.x, world.bonus.y - player.y) < PICKUP_DISTANCE) {
    world.bonus.taken = true;
    world.score += world.bonus.value;
    world.events.push('pickup');
  }

  // --- exit ----------------------------------------------------------------------------
  if (world.exit.open && Math.hypot(world.exit.x - player.x, world.exit.y - player.y) < PICKUP_DISTANCE) {
    finishRoom(world);
  }
  return world.events;
}

// A plain snapshot for tests, determinism checks and the autopilot log.
export function snapshot(world) {
  return {
    room: world.roomIndex,
    state: world.state,
    score: world.score,
    lives: world.lives,
    alarm: Math.round(world.alarm * 10) / 10,
    time: Math.round(world.totalTime * 100) / 100,
    player: { x: Math.round(world.player.x), y: Math.round(world.player.y) },
    guards: world.guards.map((g) => ({
      x: Math.round(g.x),
      y: Math.round(g.y),
      state: g.state,
      suspicion: Math.round(g.suspicion),
    })),
    lootTaken: world.loot.taken,
    bonusTaken: world.bonus.taken,
    exitOpen: world.exit.open,
  };
}
