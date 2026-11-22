// Night Vault — keyboard and mouse.
// One object owns every key the game cares about, so the simulation
// reads plain booleans and the page never has to know which key is
// which. Mouse clicks arrive as tile targets for the coin throw.

export class Input {
  constructor() {
    this.keys = new Set();
    this.coinTarget = null; // {x, y} in pixels, set on click, consumed by the loop
    this.pressed = new Set(); // edge-triggered keys, consumed by the loop
  }

  attach(canvas) {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.pressed.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousedown', (event) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.coinTarget = {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    });
  }

  // Movement vector from WASD or the arrow keys, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  get sneak() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  // True once per physical press; the loop clears it after reading.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.coinTarget = null;
  }
}
