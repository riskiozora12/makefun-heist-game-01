// Night Vault — the browser shell: loop, screens, sound, status.
// This is the only module that knows about the page. The simulation
// lives in world.js and the drawing in render.js; this file wires
// them to the keyboard, the mouse and requestAnimationFrame.

import { CANVAS_W, CANVAS_H } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { draw } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { buildShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const BEST_KEY = 'night-vault-best';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') || 1);

let best = 0;
try {
  best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
} catch (err) {
  best = 0;
}

const input = new Input();
input.attach(canvas);
const sounds = new SoundBank();

let world;
let screen; // title | play | paused | caught | win | gameover
let status = '';
let stepDistance = 0;
let lastFootstepAt = 0;

function setStatus(text) {
  status = text;
  if (statusEl) statusEl.textContent = text;
}

function saveBest() {
  if (world.score > best) {
    best = world.score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (err) {
      // Private mode or no storage: the score just is not kept.
    }
  }
}

function handleEvents(events) {
  for (const event of events) {
    if (event === 'pickup') {
      sounds.pickup();
      setStatus(world.loot.taken && world.exit.open ? 'Loot secured — get to the exit.' : 'Treasure pocketed.');
    } else if (event === 'coin') {
      sounds.coinRing();
      setStatus('Coin thrown — a guard goes to listen.');
    } else if (event === 'smoke') {
      sounds.smoke();
      setStatus('Smoke out — their cones cannot see through it.');
    } else if (event === 'emp') {
      sounds.emp();
      setStatus('EMP fired — the cameras are blind for six seconds.');
    } else if (event === 'alert') {
      sounds.alert();
      setStatus('Spotted! Break line of sight.');
    } else if (event === 'caught') {
      sounds.caught();
      setStatus('Caught! One life gone.');
    } else if (event === 'roomclear') {
      setStatus(world.state === 'win' ? 'The diamond is yours.' : 'Room clear — on to the next.');
    } else if (event === 'win') {
      sounds.win();
      sounds.stopDrone();
      saveBest();
    } else if (event === 'gameover') {
      sounds.stopDrone();
      saveBest();
    }
  }
}

function buildInput() {
  const vec = input.moveVector();
  return {
    mx: vec.x,
    my: vec.y,
    sneak: input.sneak,
    coin: input.coinTarget,
    smoke: input.wasPressed('KeyE'),
    emp: input.wasPressed('KeyQ'),
  };
}

// --- staged screenshot mode -------------------------------------------------
if (shotName) {
  // The shots are framed on the canvas alone: hide the status line so
  // the page is exactly the canvas and no scrollbar appears.
  if (statusEl) statusEl.style.display = 'none';
  const shot = buildShot(shotName, Number.isFinite(seedParam) ? seedParam : 1);
  if (shot) {
    world = shot.world;
    screen = shot.screen;
    setStatus(shot.status);
    draw(ctx, world, { screen, status, best, now: 0 });
    window.__nightVault = { world, screen };
    window.__shotReady = true;
  }
}

// --- the live game ------------------------------------------------------------
if (!shotName) {
  world = createWorld(0, 1);
  screen = 'title';
  setStatus('Press ENTER to start the job.');

  let last = performance.now();
  let accumulator = 0;
  const STEP = 1 / 60;

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;

    if (input.wasPressed('KeyM')) {
      sounds.setMuted(!sounds.muted);
      setStatus(sounds.muted ? 'Sound off.' : 'Sound on.');
    }

    if (screen === 'title') {
      if (input.wasPressed('Enter')) {
        sounds.ensure();
        sounds.startDrone();
        world = createWorld(0, (Date.now() % 2147483647) || 1);
        screen = 'play';
        setStatus('Stay out of the amber cones.');
      }
      draw(ctx, world, { screen, status, best, now });
      input.endFrame();
      return;
    }

    if (screen === 'win' || screen === 'gameover') {
      if (input.wasPressed('KeyR')) {
        sounds.ensure();
        sounds.startDrone();
        world = createWorld(0, (Date.now() % 2147483647) || 1);
        screen = 'play';
        setStatus('Stay out of the amber cones.');
      }
      draw(ctx, world, { screen, status, best, now });
      input.endFrame();
      return;
    }

    if (input.wasPressed('KeyP') && (screen === 'play' || screen === 'paused')) {
      screen = screen === 'play' ? 'paused' : 'play';
      setStatus(screen === 'paused' ? 'Paused.' : 'Back to the job.');
    }

    if (screen === 'paused') {
      draw(ctx, world, { screen, status, best, now });
      input.endFrame();
      return;
    }

    // screen === 'play' (the world may itself be in its 'caught' beat)
    accumulator += elapsed;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const before = { x: world.player.x, y: world.player.y };
      const events = stepWorld(world, buildInput(), STEP);
      handleEvents(events);
      const moved = Math.hypot(world.player.x - before.x, world.player.y - before.y);
      stepDistance += moved;
      if (world.player.moving && stepDistance - lastFootstepAt > 34) {
        lastFootstepAt = stepDistance;
        sounds.footstep();
      }
      input.endFrame();
      if (world.state === 'caught') screen = 'caught';
      else if (world.state === 'win') screen = 'win';
      else if (world.state === 'gameover') screen = 'gameover';
      else if (screen === 'caught') screen = 'play';
    }
    draw(ctx, world, { screen, status, best, now });
  }

  window.__nightVault = { get world() { return world; }, get screen() { return screen; } };
  requestAnimationFrame(frame);
}
