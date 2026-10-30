// Keyboard + mouse (pointer lock) + touch (left stick, drag to look, buttons) → sim Input.
import type { Input } from './sim.ts';

export class Controls {
  keys = new Set<string>();
  private lookDX = 0;
  private lookDY = 0;
  private actQ = false;
  private rotQ = false;
  private climbQ = false;
  stick = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
  private lookTouch = { id: -1, x: 0, y: 0 };
  sensitivity = 0.0022;
  locked = false;
  private dragging: { x: number; y: number; moved: number } | null = null;
  private dragFallback = false;
  touch = false;
  enabled = true;
  onKey: ((code: string) => void) | null = null;

  constructor(private el: HTMLElement, private stickEl: HTMLElement, private knobEl: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!this.keys.has(e.code)) {
        if (e.code === 'KeyR') this.rotQ = true;
        if (e.code === 'Space') this.climbQ = true;
        if (e.code === 'KeyE' || e.code === 'Enter') this.actQ = true;
        this.onKey?.(e.code);
      }
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousedown', (e) => {
      if (this.touch) return;
      if (!this.enabled) return;
      if (!this.locked) {
        // The first click only captures the mouse. Where pointer lock is unavailable (some
        // iframes), click-drag looks around and a click without dragging grabs/drops.
        this.dragging = { x: e.clientX, y: e.clientY, moved: 0 };
        try { const r = el.requestPointerLock?.() as unknown as Promise<void> | undefined; r?.catch?.(() => undefined); } catch { /* unavailable */ }
        return;
      }
      if (e.button === 0) this.actQ = true;
      if (e.button === 2) this.rotQ = true;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
    });
    window.addEventListener('mouseup', () => {
      if (this.dragging && !this.locked && this.dragging.moved < 6 && this.dragFallback) this.actQ = true;
      this.dragging = null;
    });
    document.addEventListener('pointerlockerror', () => { this.dragFallback = true; });
    document.addEventListener('mousemove', (e) => {
      if (this.dragging && !this.locked && this.enabled) {
        const dx = e.clientX - this.dragging.x, dy = e.clientY - this.dragging.y;
        this.dragging.moved += Math.abs(dx) + Math.abs(dy);
        this.dragging.x = e.clientX;
        this.dragging.y = e.clientY;
        this.lookDX += dx * 1.4;
        this.lookDY += dy * 1.4;
        return;
      }
      if (!this.locked || !this.enabled) return;
      this.lookDX += e.movementX;
      this.lookDY += e.movementY;
    });
    // Touch.
    el.addEventListener('touchstart', (e) => this.onTouch(e, 'start'), { passive: false });
    el.addEventListener('touchmove', (e) => this.onTouch(e, 'move'), { passive: false });
    el.addEventListener('touchend', (e) => this.onTouch(e, 'end'), { passive: false });
    el.addEventListener('touchcancel', (e) => this.onTouch(e, 'end'), { passive: false });
  }

  private onTouch(e: TouchEvent, kind: 'start' | 'move' | 'end'): void {
    this.touch = true;
    document.body.classList.add('touch');
    e.preventDefault();
    const rect = this.el.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      const x = t.clientX - rect.left, y = t.clientY - rect.top;
      if (kind === 'start') {
        if (x < rect.width * 0.4 && this.stick.id < 0) {
          this.stick = { x: 0, y: 0, id: t.identifier, ox: x, oy: y };
          this.stickEl.style.display = 'block';
          this.stickEl.style.left = `${x - 60}px`;
          this.stickEl.style.top = `${y - 60}px`;
          this.knobEl.style.transform = 'translate(0px,0px)';
        } else if (this.lookTouch.id < 0) {
          this.lookTouch = { id: t.identifier, x, y };
        }
      } else if (kind === 'move') {
        if (t.identifier === this.stick.id) {
          let dx = x - this.stick.ox, dy = y - this.stick.oy;
          const m = Math.hypot(dx, dy);
          if (m > 50) { dx = (dx / m) * 50; dy = (dy / m) * 50; }
          this.stick.x = dx / 50;
          this.stick.y = dy / 50;
          this.knobEl.style.transform = `translate(${dx}px,${dy}px)`;
        } else if (t.identifier === this.lookTouch.id) {
          this.lookDX += (x - this.lookTouch.x) * 1.6;
          this.lookDY += (y - this.lookTouch.y) * 1.6;
          this.lookTouch.x = x;
          this.lookTouch.y = y;
        }
      } else {
        if (t.identifier === this.stick.id) {
          this.stick = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
          this.stickEl.style.display = 'none';
        }
        if (t.identifier === this.lookTouch.id) this.lookTouch.id = -1;
      }
    }
  }

  pressAct(): void { this.actQ = true; }
  pressRotate(): void { this.rotQ = true; }
  pressClimb(): void { this.climbQ = true; }

  read(): Input {
    const k = this.keys;
    let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    // Keyboard turning (arrows) and looking up/down (PageUp/PageDown or Q/Z) — playable without a mouse.
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
    const tilt = (k.has('PageUp') || k.has('KeyQ') ? 1 : 0) - (k.has('PageDown') || k.has('KeyZ') ? 1 : 0);
    this.lookDX -= turn * 7 * (k.has('ShiftLeft') || k.has('ShiftRight') ? 0.35 : 1);
    this.lookDY -= tilt * 5;
    if (this.stick.id >= 0) {
      fwd = -this.stick.y;
      strafe = this.stick.x;
    }
    const input: Input = {
      fwd: this.enabled ? fwd : 0,
      strafe: this.enabled ? strafe : 0,
      creep: k.has('ShiftLeft') || k.has('ShiftRight'),
      look: [-this.lookDX * this.sensitivity, -this.lookDY * this.sensitivity],
      act: this.actQ,
      rotate: this.rotQ,
      climb: this.climbQ,
    };
    this.lookDX = this.lookDY = 0;
    this.actQ = this.rotQ = this.climbQ = false;
    return input;
  }

  /** Drop queued one-shot presses (used when a menu closes). */
  clear(): void {
    this.actQ = this.rotQ = this.climbQ = false;
    this.lookDX = this.lookDY = 0;
  }
}
