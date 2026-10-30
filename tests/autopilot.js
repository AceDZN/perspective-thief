// Browser-side autopilot for playtests: drives the game ONLY through keyboard events
// (the game's own input handler) and the deterministic window.advanceTime hook.
(() => {
  const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  const S = () => JSON.parse(window.render_game_to_text());
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const AP = {
    S,
    key,
    tick(ms = 16) { window.advanceTime(ms); },
    press(code) { key(code, true); window.advanceTime(16); key(code, false); window.advanceTime(16); },
    turnTo(yaw) {
      for (let i = 0; i < 400; i++) {
        const d = wrap(yaw - S().player.yaw);
        if (Math.abs(d) < 0.006) break;
        const fine = Math.abs(d) < 0.04;
        if (fine) key('ShiftLeft', true);
        const code = d > 0 ? 'ArrowLeft' : 'ArrowRight';
        key(code, true); window.advanceTime(16); key(code, false);
        if (fine) key('ShiftLeft', false);
      }
      window.advanceTime(16);
    },
    pitchTo(p) {
      for (let i = 0; i < 300; i++) {
        const d = p - S().player.pitch;
        if (Math.abs(d) < 0.012) break;
        const code = d > 0 ? 'KeyQ' : 'KeyZ';
        key(code, true); window.advanceTime(16); key(code, false);
      }
      window.advanceTime(16);
    },
    face(x, z) {
      const p = S().player;
      AP.turnTo(Math.atan2(-(x - p.x), -(z - p.z)));
    },
    walkTo(x, z, tol = 0.04) {
      for (let pass = 0; pass < 6; pass++) {
        const p = S().player;
        const dist = Math.hypot(x - p.x, z - p.z);
        if (dist < tol) return true;
        AP.face(x, z);
        const creep = dist < 0.6;
        if (creep) key('ShiftLeft', true);
        key('KeyW', true);
        window.advanceTime(Math.max(16, (dist / (creep ? 0.9 : 3.2)) * 1000 * (pass ? 0.95 : 0.98)));
        key('KeyW', false);
        if (creep) key('ShiftLeft', false);
        window.advanceTime(16);
      }
      const p = S().player;
      return Math.hypot(x - p.x, z - p.z) < tol * 3;
    },
    aimAt(x, y, z) {
      const s = S();
      const p = s.player;
      AP.turnTo(Math.atan2(-(x - p.x), -(z - p.z)));
      AP.pitchTo(Math.atan2(y - (p.y + 1.6), Math.hypot(x - p.x, z - p.z)));
    },
    act() { AP.press('KeyE'); },
    settle(ms = 1200) { window.advanceTime(ms); },
  };
  window.AP = AP;
  return 'autopilot ready';
})();
