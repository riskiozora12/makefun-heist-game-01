// Night Vault — shared tuning numbers and palette.
// One place for every constant the game balances on, so a tweak here
// retunes the whole museum at once. Nothing in this file touches the
// DOM or the canvas; the simulation and the renderer both read it.

export const TILE = 40; // pixels per tile
export const COLS = 22; // room width in tiles
export const ROWS = 18; // room height in tiles
export const VIEW_W = COLS * TILE; // 880 — playfield width
export const VIEW_H = ROWS * TILE; // 720 — playfield height
export const HUD_W = 400; // right-hand panel width
export const CANVAS_W = VIEW_W + HUD_W; // 1280
export const CANVAS_H = VIEW_H; // 720

// --- the thief -------------------------------------------------------------
export const PLAYER_RADIUS = 11;
export const PLAYER_WALK = 3.4; // tiles per second
export const PLAYER_SNEAK = 1.9; // tiles per second, half as easy to spot
export const PLAYER_LIVES = 3;

// --- guards ----------------------------------------------------------------
export const GUARD_RADIUS = 12;
export const GUARD_PATROL_SPEED = 1.55;
export const GUARD_HUNT_SPEED = 2.0; // walking to a noise or a last-seen spot
export const GUARD_CHASE_SPEED = 2.55;
export const GUARD_VISION_RANGE = 6.0; // tiles
export const GUARD_VISION_HALF_ANGLE = 0.61; // radians, about 35 degrees
export const GUARD_TURN_SPEED = 2.6; // radians per second while sweeping
export const ELITE_RANGE_BONUS = 1.5; // tiles of extra sight for elite guards
export const ELITE_SPEED_BONUS = 1.15; // multiplier on elite guard speeds
export const ELITE_SUSPICION_BONUS = 1.3; // multiplier on elite suspicion gain

// --- suspicion ---------------------------------------------------------------
export const SUSPICION_WARY = 35; // guard stops and looks: "?"
export const SUSPICION_CHASE = 75; // guard gives chase: "!"
export const SUSPICION_MAX = 100;
export const SUSPICION_GAIN = 55; // per second at point blank, scaled by closeness
export const SUSPICION_DECAY = 14; // per second while the thief is unseen
export const SNEAK_SPOT_FACTOR = 0.5; // sneaking halves how fast suspicion grows
export const CHASE_MEMORY = 3.0; // seconds a guard keeps hunting after losing sight
export const INVESTIGATE_LOOK_TIME = 2.0; // seconds a guard studies a spot

// --- cameras -----------------------------------------------------------------
export const CAMERA_RANGE = 7.0; // tiles
export const CAMERA_HALF_ANGLE = 0.52; // radians, about 30 degrees
export const CAMERA_SWEEP = 0.9; // radians either side of the base heading
export const CAMERA_SWEEP_SPEED = 0.5; // radians per second
export const CAMERA_LOCK_TIME = 0.8; // seconds of continuous sight to lock on

// --- alarm -------------------------------------------------------------------
export const ALARM_MAX = 100;
export const ALARM_CHASE_RATE = 8; // per second while any guard chases
export const ALARM_CAMERA_RATE = 6; // per second while a camera is locked on
export const ALARM_DECAY = 4; // per second while nobody is hunting
export const ALARM_LOCKDOWN_DECAY = 1; // per second during lockdown, unseen
export const ALARM_GHOST_LIMIT = 25; // stay at or under this for the ghost bonus
export const CAUGHT_ALARM_RELIEF = 40; // alarm knocked down after a catch

// --- tools -------------------------------------------------------------------
export const TOOLS_PER_ROOM = { coin: 3, smoke: 2, emp: 1 };
export const COIN_THROW_RANGE = 6; // tiles from the thief
export const COIN_HEARING_RANGE = 8; // tiles: guards inside this investigate
export const SMOKE_RADIUS_TILES = 1.6;
export const SMOKE_DURATION = 5; // seconds
export const EMP_DURATION = 6; // seconds of dark cameras

// --- scoring -----------------------------------------------------------------
export const ROOM_CLEAR_BONUS = 250;
export const TIME_BONUS_RATE = 10; // points per second under par
export const GHOST_BONUS = 200;

// --- palette -----------------------------------------------------------------
export const PALETTE = {
  floorA: '#1c2438',
  floorB: '#202a40',
  floorTrim: '#2a3550',
  wall: '#0d1120',
  wallEdge: '#3a4a6b',
  carpet: '#3d2b4f',
  gold: '#f2c14e',
  goldDim: '#a8823a',
  exit: '#39d98a',
  exitDark: '#1d7a4c',
  player: '#2dd4bf',
  playerDark: '#0f766e',
  guard: '#e5484d',
  guardDark: '#7f1d1d',
  cone: 'rgba(242, 193, 78, 0.20)',
  coneHot: 'rgba(229, 72, 77, 0.28)',
  cameraCone: 'rgba(229, 72, 77, 0.16)',
  smoke: 'rgba(203, 213, 225, 0.45)',
  hudBg: '#101527',
  hudPanel: '#171e33',
  hudLine: '#2a3550',
  text: '#e8ecf7',
  textDim: '#93a0bd',
  alarmLow: '#39d98a',
  alarmMid: '#f2c14e',
  alarmHigh: '#e5484d',
};
