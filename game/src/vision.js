// Night Vault — seeing and being seen.
// Pure geometry: given a wall grid, can this watcher see that spot?
// The simulation asks these questions every tick; the renderer uses
// the same answers to draw the cones, so what you see is what the
// guards see.

import { TILE } from './config.js';

export function isWall(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
  return grid[ty][tx] === '#';
}

// Bresenham over tile centres: true when no wall tile stands between
// the two points. The endpoints themselves are never walls.
export function lineOfSight(grid, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (!(x === x0 && y === y0) && !(x === x1 && y === y1) && isWall(grid, x, y)) return false;
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Is the target inside the watcher's cone (range, angle, clear sight)?
// smokes is a list of {x, y, r} in pixels; a smoke cloud between the
// two blocks the view outright.
export function inCone(grid, watcher, target, rangeTiles, halfAngle, smokes) {
  const dx = target.x - watcher.x;
  const dy = target.y - watcher.y;
  const distPx = Math.hypot(dx, dy);
  if (distPx > rangeTiles * TILE) return false;
  if (distPx < 1) return true;
  const heading = angleTo(watcher.x, watcher.y, target.x, target.y);
  if (Math.abs(angleDiff(heading, watcher.heading)) > halfAngle) return false;
  const tx = Math.floor(target.x / TILE);
  const ty = Math.floor(target.y / TILE);
  const wx = Math.floor(watcher.x / TILE);
  const wy = Math.floor(watcher.y / TILE);
  if (!lineOfSight(grid, wx, wy, tx, ty)) return false;
  for (const smoke of smokes) {
    if (segmentHitsCircle(watcher.x, watcher.y, target.x, target.y, smoke.x, smoke.y, smoke.r)) return false;
  }
  return true;
}

// Does the segment (x0,y0)-(x1,y1) pass through the circle?
function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((cx - x0) * dx + (cy - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + t * dx;
  const py = y0 + t * dy;
  return Math.hypot(px - cx, py - cy) < r;
}

// Breadth-first search over walkable tiles. Returns a list of tile
// centres (pixels) from start to goal, or null when no route exists.
// costAt(tx, ty) prices each step, so the caller can steer around
// danger instead of through it.
export function findPath(grid, startTx, startTy, goalTx, goalTy, costAt) {
  const rows = grid.length;
  const cols = grid[0].length;
  if (isWall(grid, goalTx, goalTy)) return null;
  const key = (x, y) => y * cols + x;
  const came = new Map();
  const cost = new Map();
  const open = [[0, startTx, startTy]];
  came.set(key(startTx, startTy), null);
  cost.set(key(startTx, startTy), 0);
  const goalKey = key(goalTx, goalTy);
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i][0] < open[best][0]) best = i;
    const [, cx, cy] = open.splice(best, 1)[0];
    const ck = key(cx, cy);
    if (ck === goalKey) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (isWall(grid, nx, ny)) continue;
      const nk = key(nx, ny);
      const step = costAt ? costAt(nx, ny) : 1;
      const nc = cost.get(ck) + step;
      if (!cost.has(nk) || nc < cost.get(nk)) {
        cost.set(nk, nc);
        came.set(nk, ck);
        open.push([nc, nx, ny]);
      }
    }
  }
  if (!came.has(goalKey)) return null;
  const tiles = [];
  let cur = goalKey;
  while (cur !== null) {
    const ty = Math.floor(cur / cols);
    const tx = cur - ty * cols;
    tiles.push([(tx + 0.5) * TILE, (ty + 0.5) * TILE]);
    cur = came.get(cur);
  }
  tiles.reverse();
  return tiles;
}
