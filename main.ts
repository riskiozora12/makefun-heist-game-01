// Night Vault — the hand-in program (Node 22, standard library only).
// It takes the game as it stands in this repository and writes the
// entry the grader reads: game/ and screenshots/ copied to /output,
// plus /output/dossier.json built by the vendored make.fun library.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output. Run it twice and the bytes must match.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SCREENSHOT_BYTES = 262144;
const MAX_SCREENSHOTS = 4;

function fail(message) {
  console.error(`night-vault: ${message}`);
  process.exit(1);
}

function checkGame() {
  const index = join(REPO_ROOT, 'game', 'index.html');
  if (!existsSync(index)) {
    fail('game/index.html is missing — the game cannot be handed in without it.');
  }
  const shots = join(REPO_ROOT, 'screenshots');
  if (!existsSync(shots)) fail('screenshots/ is missing — the entry needs 3 or 4 screenshots.');
  const files = readdirSync(shots).filter((name) => !name.startsWith('.'));
  if (files.length < 3 || files.length > MAX_SCREENSHOTS) {
    fail(`screenshots/ holds ${files.length} images; the entry needs 3 or 4.`);
  }
  for (const name of files) {
    const size = statSync(join(shots, name)).size;
    if (size > MAX_SCREENSHOT_BYTES) {
      fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap.`);
    }
  }
}

function copyEntry() {
  mkdirSync(OUT_DIR, { recursive: true });
  cpSync(join(REPO_ROOT, 'game'), join(OUT_DIR, 'game'), { recursive: true });
  cpSync(join(REPO_ROOT, 'screenshots'), join(OUT_DIR, 'screenshots'), { recursive: true });
}

function writeDossier() {
  // The caps mirror the sealed gate's: the dossier text is capped at
  // 160 KiB, screenshots at 4 files of 256 KiB, game/ at 993 files
  // and 48 MiB, every game path within 1,000 bytes.
  const dossier = buildDossier(OUT_DIR, {
    text_max_bytes: 163840,
    screenshots: { max: MAX_SCREENSHOTS, max_bytes: MAX_SCREENSHOT_BYTES },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(OUT_DIR, 'dossier.json'), dossier);
}

checkGame();
copyEntry();
writeDossier();
console.log(`night-vault: entry written to ${OUT_DIR}`);
