// Night Vault — everything the player sees.
// Canvas 2D, top-down. The playfield is the room; the right panel is
// the HUD. Vision cones are raycast against the walls, so a cone that
// stops at a doorway shows exactly where it is safe to stand.

import {
  TILE,
  COLS,
  ROWS,
  VIEW_W,
  VIEW_H,
  HUD_W,
  PLAYER_RADIUS,
  GUARD_RADIUS,
  GUARD_VISION_RANGE,
  GUARD_VISION_HALF_ANGLE,
  CAMERA_RANGE,
  CAMERA_HALF_ANGLE,
  ELITE_RANGE_BONUS,
  SMOKE_RADIUS_TILES,
  ALARM_MAX,
  PALETTE,
} from './config.js';
import { isWall } from './vision.js';

// March a ray until it hits a wall; returns the distance in pixels.
function rayLength(grid, x, y, angle, maxLen) {
  for (let r = 6; r <= maxLen; r += 6) {
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (isWall(grid, Math.floor(px / TILE), Math.floor(py / TILE))) return r;
  }
  return maxLen;
}

function conePoints(grid, x, y, heading, halfAngle, rangePx) {
  const points = [[x, y]];
  const steps = 16;
  for (let i = 0; i <= steps; i += 1) {
    const a = heading - halfAngle + (2 * halfAngle * i) / steps;
    const d = rayLength(grid, x, y, a, rangePx);
    points.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return points;
}

function drawCone(ctx, grid, x, y, heading, halfAngle, rangePx, fill) {
  const pts = conePoints(grid, x, y, heading, halfAngle, rangePx);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawDiamond(ctx, x, y, r, colour) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

function drawRoom(ctx, world) {
  const grid = world.grid;
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const px = x * TILE;
      const py = y * TILE;
      if (grid[y][x] === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = PALETTE.wallEdge;
        ctx.fillRect(px, py, TILE, 3);
        ctx.fillRect(px, py, 3, TILE);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = PALETTE.floorTrim;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      }
    }
  }
}

function drawLoot(ctx, world, now) {
  const pulse = 0.7 + 0.3 * Math.sin(now / 300);
  if (!world.loot.taken) {
    drawDiamond(ctx, world.loot.x, world.loot.y, 13 * pulse + 4, PALETTE.gold);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.loot.name.toUpperCase(), world.loot.x, world.loot.y - 20);
  }
  if (!world.bonus.taken) {
    drawDiamond(ctx, world.bonus.x, world.bonus.y, 9, PALETTE.goldDim);
  }
}

function drawExit(ctx, world) {
  const e = world.exit;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 16, 0, Math.PI * 2);
  ctx.fillStyle = e.open ? PALETTE.exit : PALETTE.exitDark;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = e.open ? '#d1fae0' : '#14532d';
  ctx.stroke();
  ctx.fillStyle = '#06281a';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(e.open ? 'EXIT' : 'LOCKED', e.x, e.y + 3);
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    const rangePx = (GUARD_VISION_RANGE + (guard.elite ? ELITE_RANGE_BONUS : 0)) * TILE;
    const fill = guard.state === 'chase' ? PALETTE.coneHot : PALETTE.cone;
    drawCone(ctx, world.grid, guard.x, guard.y, guard.heading, GUARD_VISION_HALF_ANGLE, rangePx, fill);
  }
  for (const guard of world.guards) {
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = guard.elite ? '#7c3aed' : PALETTE.guard;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.guardDark;
    ctx.stroke();
    // facing tick
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.heading) * 16, guard.y + Math.sin(guard.heading) * 16);
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 3;
    ctx.stroke();
    // suspicion mark
    if (guard.state === 'wary' || guard.state === 'investigate') {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - 18);
    } else if (guard.state === 'chase') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 18);
    }
    // suspicion ring
    if (guard.suspicion > 0 && guard.state !== 'chase') {
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD_RADIUS + 5, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function drawCameras(ctx, world) {
  for (const camera of world.cameras) {
    const disabled = world.time < camera.disabledUntil;
    if (!disabled) {
      drawCone(ctx, world.grid, camera.x, camera.y, camera.heading, CAMERA_HALF_ANGLE, CAMERA_RANGE * TILE, PALETTE.cameraCone);
    }
    ctx.fillStyle = disabled ? '#475569' : camera.locked ? PALETTE.guard : PALETTE.gold;
    ctx.fillRect(camera.x - 7, camera.y - 7, 14, 14);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(camera.x - 7, camera.y - 7, 14, 14);
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = disabled ? '#1e293b' : '#ef4444';
    ctx.fill();
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  // sneak ring: faint when sneaking
  if (p.sneak) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.player;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.playerDark;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.heading) * 15, p.y + Math.sin(p.heading) * 15);
  ctx.strokeStyle = '#ccfbf1';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawSmokeAndCoins(ctx, world) {
  for (const smoke of world.smokes) {
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.smoke;
    ctx.fill();
  }
  for (const coin of world.coins) {
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.gold;
    ctx.fill();
  }
}

function alarmColour(alarm) {
  if (alarm < 40) return PALETTE.alarmLow;
  if (alarm < 75) return PALETTE.alarmMid;
  return PALETTE.alarmHigh;
}

function drawHud(ctx, world, view) {
  const x0 = VIEW_W + 20;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(VIEW_W, 0, HUD_W, VIEW_H);
  ctx.textAlign = 'left';
  let y = 36;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`ROOM ${world.roomIndex + 1} OF 3`, x0, y);
  y += 26;
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(world.def.name, x0, y);
  y += 30;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '14px sans-serif';
  const objective = world.loot.taken
    ? 'Loot secured — reach the green exit.'
    : `Steal ${world.loot.name} ($${world.loot.value}).`;
  ctx.fillText(objective, x0, y);
  y += 44;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SCORE', x0, y);
  y += 28;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`$${world.score}`, x0, y);
  y += 26;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '14px sans-serif';
  ctx.fillText(`Time ${Math.floor(world.totalTime / 60)}:${String(Math.floor(world.totalTime % 60)).padStart(2, '0')}  ·  Par ${world.def.par}s`, x0, y);
  y += 34;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('LIVES', x0, y);
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(x0 + 70 + i * 26, y - 4, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < world.lives ? PALETTE.guard : '#334155';
    ctx.fill();
  }
  y += 44;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`ALARM  ${Math.round(world.alarm)}${world.lockdown ? ' — LOCKDOWN' : ''}`, x0, y);
  y += 12;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x0, y, HUD_W - 40, 22);
  ctx.fillStyle = alarmColour(world.alarm);
  ctx.fillRect(x0, y, ((HUD_W - 40) * world.alarm) / ALARM_MAX, 22);
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y + 0.5, HUD_W - 41, 21);
  y += 52;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('TOOLS', x0, y);
  y += 24;
  ctx.font = '15px sans-serif';
  const toolRows = [
    [`Coins  × ${world.tools.coin}`, 'Click to throw — guards investigate the ring'],
    [`Smoke  × ${world.tools.smoke}`, 'E — a cloud that blocks sight'],
    [`EMP  × ${world.tools.emp}`, 'Q — cameras go dark for 6s'],
  ];
  for (const [label, hint] of toolRows) {
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(label, x0, y);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px sans-serif';
    ctx.fillText(hint, x0 + 110, y);
    ctx.font = '15px sans-serif';
    y += 26;
  }
  y += 14;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('LOOT', x0, y);
  y += 24;
  ctx.fillStyle = PALETTE.text;
  ctx.font = '15px sans-serif';
  ctx.fillText(`${world.loot.taken ? '✓' : '○'}  ${world.loot.name} — $${world.loot.value}`, x0, y);
  y += 26;
  ctx.fillText(`${world.bonus.taken ? '✓' : '○'}  ${world.bonus.name} — $${world.bonus.value}`, x0, y);
  y += 46;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move · Shift sneak · P pause · M mute', x0, y);
  y += 20;
  ctx.fillText('Best score this browser: $' + view.best, x0, y);
  if (view.status) {
    y += 34;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'italic 14px sans-serif';
    ctx.fillText(view.status, x0, y);
  }
}

function drawTitle(ctx, world, view) {
  ctx.fillStyle = 'rgba(6, 9, 20, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('NIGHT VAULT', VIEW_W / 2, 210);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText('The Meridian Heist', VIEW_W / 2, 250);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '16px sans-serif';
  ctx.fillText('Rook owes the fixer Mara Quinn one last job: the Meridian Diamond,', VIEW_W / 2, 310);
  ctx.fillText('locked in the vault at the back of the Grand Meridian Museum.', VIEW_W / 2, 334);
  ctx.fillText('Three rooms. Three guards\' patrols. One way out.', VIEW_W / 2, 358);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD / arrows — move      Shift — sneak      Click — throw a coin', VIEW_W / 2, 420);
  ctx.fillText('E — smoke      Q — EMP      P — pause      M — mute', VIEW_W / 2, 444);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 22px sans-serif';
  const blink = Math.floor(view.now / 500) % 2 === 0;
  if (blink) ctx.fillText('Press ENTER to start the job', VIEW_W / 2, 510);
  if (view.best > 0) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '14px sans-serif';
    ctx.fillText(`Best score: $${view.best}`, VIEW_W / 2, 550);
  }
}

function drawEndScreen(ctx, world, view, won) {
  ctx.fillStyle = 'rgba(6, 9, 20, 0.86)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? PALETTE.gold : PALETTE.guard;
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(won ? 'THE DIAMOND IS YOURS' : 'CAUGHT — GAME OVER', VIEW_W / 2, 180);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '18px sans-serif';
  ctx.fillText(
    won
      ? 'Rook slips into the night with the Meridian Diamond. Mara Quinn is paid.'
      : 'The museum keeps its secrets. The crew will have to try again.',
    VIEW_W / 2,
    220,
  );
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(`Final score  $${world.score}`, VIEW_W / 2, 290);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '15px sans-serif';
  const minutes = Math.floor(world.totalTime / 60);
  const seconds = Math.floor(world.totalTime % 60);
  ctx.fillText(`Time ${minutes}:${String(seconds).padStart(2, '0')}  ·  Lives left ${world.lives}`, VIEW_W / 2, 330);
  if (view.best > 0) ctx.fillText(`Best score: $${view.best}`, VIEW_W / 2, 358);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 20px sans-serif';
  const blink = Math.floor(view.now / 500) % 2 === 0;
  if (blink) ctx.fillText('Press R to play again', VIEW_W / 2, 430);
}

export function draw(ctx, world, view) {
  drawRoom(ctx, world);
  drawLoot(ctx, world, view.now);
  drawExit(ctx, world);
  drawSmokeAndCoins(ctx, world);
  drawCameras(ctx, world);
  drawGuards(ctx, world);
  drawPlayer(ctx, world);
  drawHud(ctx, world, view);
  if (view.screen === 'title') drawTitle(ctx, world, view);
  else if (view.screen === 'win') drawEndScreen(ctx, world, view, true);
  else if (view.screen === 'gameover') drawEndScreen(ctx, world, view, false);
  else if (view.screen === 'caught') {
    ctx.fillStyle = 'rgba(229, 72, 77, 0.25)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAUGHT!', VIEW_W / 2, VIEW_H / 2);
  } else if (view.screen === 'paused') {
    ctx.fillStyle = 'rgba(6, 9, 20, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
  }
}
