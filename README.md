# Night Vault — The Meridian Heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/riskiozora12/makefun-heist-game-01/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/riskiozora12/makefun-heist-game-01/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

Night Vault is a top-down stealth heist game. You are Rook, a thief
with one last job for the fixer Mara Quinn: the Meridian Diamond,
locked in the vault at the back of the Grand Meridian Museum. Three
rooms stand between the street and the diamond — the Gallery, the
Vault Corridor, and the Diamond Vault itself. Slip past patrolling
guards and sweeping cameras, stay out of the amber vision cones,
grab the loot and reach the exit before the alarm hits 100.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, plain
static files under `game/`.

## Play it

- **WASD / arrows** — move
- **Shift** — sneak (slower, half as easy to spot)
- **Click** — throw a coin (guards walk over to investigate the sound)
- **E** — smoke puff (blocks sight for a few seconds)
- **Q** — EMP (cameras go dark for six seconds)
- **P** — pause · **M** — mute

Each room restocks your tools: 3 coins, 2 smoke, 1 EMP. The exit
stays locked until you take the room's main loot.

## What is in the game

- Three hand-built rooms, each with its own routes, patrols and
  loot: the Gallery (the Gilded Muse, $400), the Vault Corridor
  (Vault Gold Bars, $600) and the Diamond Vault (the Meridian
  Diamond, $1,000) — plus a bonus treasure in every room.
- Guards who patrol waypoints, pause and sweep, grow suspicious in
  stages (a `?` when wary, a `!` when they chase), investigate
  noises, and give chase — with an elite guard in the final room
  who sees further and reacts faster.
- Cameras that sweep their cones, lock on and raise the alarm; the
  alarm climbs while you are hunted and falls while you stay hidden.
  At 100 the museum locks down and every guard comes for you.
- A fair caught moment: lose one of three lives, wake up at the
  room's entrance with the alarm knocked back down — never an
  instant game over for one mistake.
- Scoring that rewards a clean job: loot values, a room-clear bonus,
  a time bonus against each room's par, and a $200 ghost bonus for a
  room where the alarm never rose above 25.
- Synthesised sound (a low drone, footsteps, the coin's ring, the
  pickup chime, the alarm, the getaway) with no audio files, a best
  score kept in the browser, and a screen-reader status line that
  announces what is happening.

Night Vault is an original game: its museum, characters, names,
story, art and sounds are all its own. No part of it copies any
commercial game.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wt28nn7m&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
