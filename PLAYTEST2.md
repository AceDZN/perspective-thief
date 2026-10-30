# Playtest round 2: גנב הפרספקטיבה (independent, automated)

**Date:** 2026-10-31. **Build:** started on `78545b4`. `7749f6d` (laser challenge rooms), `2a2340e` (mouse sensitivity) and `b83b0f4` (README) landed during the run. None of them touch `world.ts`, `sim.ts` or `levels.ts`. The challenge-room sweep ran on the new generator.
**How:** headless Chromium (Playwright, `--use-angle=metal`) at 1280×720, plus 390×844 with touch. Input was real: keyboard events through `tests/autopilot.js`, `window.advanceTime`, and Playwright clicks and taps on the game's own buttons, with no injected state. I read pads and standing spots from the solver (`plan()` / `findStand()`), as stand-ins for the floor rings and rulers a player reads. I looked at every screenshot I cite.
**Scripts:** `tests/playtest2/` (`levels.mjs`, `flow.mjs`, `chase.mjs`, `bypass.mjs`, `finale.mjs`, `miss18.mjs`, `challenge.mjs`, `ui.mjs`, `views*.mjs`, `realtime18.mjs`, `floor.mjs`, `bidi.mjs`, `sheet.py` for contact sheets). **Screenshots and logs:** `test-output/playtest2/` (`run-*.txt`, `*.json`, `sheet-*.png`).

## Scenarios run

| # | Scenario | Script |
|---|---|---|
| 1 | Every level 1–17: intended solve from the pad. Screens: briefing, spawn, pad view, aim from the drop spot, success stamp, placed, results card | `levels.mjs solve` |
| 2 | Every level 1–17, first target: too big, then too small, then too big again. Consequence mid-air, chase, card text, then the correct solve and the results card | `levels.mjs miss` |
| 3 | L18 stealth solve along the walls; L18 too big, too small, too big; approach the guard from behind; walk straight across | `finale.mjs`, `miss18.mjs` |
| 4 | Fresh player without `unlock`: locked node, Continue, intro skip with a key, L1→L5 through "לשלב הבא", hall unlock, replay L1, the ★ challenge node, "עוד חדר אתגר", reload | `flow.mjs` |
| 5 | Challenge rooms from the ★ node: 4 per hall in halls 1–4 (16 rooms), each solved | `challenge.mjs` |
| 6 | Chase fairness: one crash per level (1–17), then run straight for the nearest sarcophagus | `chase.mjs` |
| 7 | Bypass: three quiet misses → read k off the card → pause → restart → solve (1–17) | `bypass.mjs` |
| 8 | Floor drops (repeat, cost, preview), drop while aiming at a wall | `floor.mjs`, `wall.mjs` |
| 9 | Hint (button + H), pause (P / button, time frozen), mute (pause toggle, M), finale hint disabled, Enter on the map | `ui.mjs controls,toast` |
| 10 | Mobile 390×844: menu, intro, briefing, HUD, grab and drop with the act button, fail card, chase, climb button, results, L12/L18 briefing + pause | `ui.mjs mobile` |
| 11 | Real-time frame pacing for 4 s of walking and turning on L1, L6, L12, L15, L18 | `ui.mjs fps` |
| 12 | Shadow and ruler readability (L6, L7, L10, L18), the L18 guard in real time (no `advanceTime`) | `views.mjs`, `views18*.mjs`, `realtime18.mjs` |
| 13 | RTL rendering of every level's `skill` line (the results card's "תרגלתם") and the hall intros | `bidi.mjs` |

## Findings, ranked

### 1. [bug, critical] L18: the rooftop casts no shadows, so the finale's first puzzle can't be reasoned out
The tower step needs the obelisk's 2 m shadow and the tower's 12 m shadow read off their rulers (`LEVELS.md` §18). On the rooftop neither shadow appears. The obelisk's ruler and the tower's ruler are evenly lit from the north, west, south and close up. The planters and the guard cast nothing either. Hall 2 (L6) shadows render fine.
- Repro: `node tests/playtest2/views18b.mjs` and `views18.mjs`. Screenshots: `view18-obelisk-close.png`, `view18-obelisk-close2.png`, `view18-tower-base.png`, `view18-obelisk-from-north.png`, `view18-tower-ruler-from-north.png`.
- The tower plate says only "ראש המגדל · הגיעו אליו בדיוק", so without shadows the only route is guessing until the 3rd-miss card gives k = 6.

### 2. [bypass, high] Three quiet misses, read k, restart → 3★ and the "🎯 first try, no help" badge, on every level
The 3rd-miss card prints the needed k. Restart (pause → התחלה מחדש) clears the stats but keeps the same authored numbers. Drop at k = d₂ ÷ d₁ from the card and you get a clean 3★ with "🎯 בניסיון הראשון, בלי עזרה".
- Repro: `node tests/playtest2/bypass.mjs`. Result: **16 of 16 levels** at 3★ with the badge (1, 2, 4–17). L3 also won 3★, but my probe found no quiet standing spot there, so k wasn't read off a card. The probes were too-small drops, so there was no alarm, about 40 s per level (`run-bypass.txt`). "שוב" on the win card is the same loophole one step later.
- Fix ideas: keep per-target miss counts and the revealed flag for the session (or in `save`) across restart and replay, and cap that run at 2★ with no badge. Or move the pad / change the numbers on restart, as the challenge rooms already do.

### 3. [bug/fun, high] Unfair chases: in L3 and L7 the only sarcophagus is next to the guard's door
After a crash the guard enters at `guardDoor`, and in these rooms that is 2.5–2.9 m from the only hide spot. Running straight for the sarcophagus means running into him. Getting caught costs an extra star, so one crash = 1★.
- Repro: `node tests/playtest2/chase.mjs 3,7`. L3: player→hide 6.8 m, guard→hide 2.5 m → **caught**. L7: 5.6 m vs 2.9 m → **caught**. Both end at 1★ after a single mistake. L4 is borderline (hide 3.4 m from the door): caught on both alarms in the miss run, made it in the straight-run test. Screenshots: `chase-L03-caught.png`, `chase-L07-caught.png`.
- All other levels give a fair run (table in `run-chase.txt`).

### 4. [bug, high] L18: on an alarm the patrolling guard teleports to the door at (0, −12), right next to the tower drop spot
`startChase(true)` moves the guard to `guardDoor` even while he is patrolling the middle. The natural stealth approach to the tower (along the south wall, as in `tests/browser-capture.mjs`) puts you about 2.4 m from that door. A too-big ladder gets you caught at once: 2 of 2 crashes, `caught: 2`, timeline `chase@0.8 → explain@0.9`.
- Repro: `node tests/playtest2/miss18.mjs`. Screenshots: `L18-miss1-b.png`, `L18-miss3-card.png`. Visually he vanishes from the patrol square and reappears behind you.

### 5. [bug, medium] L18: the guard stands in a T-pose until you first move, in real time with no test hooks
`gr.update(G.mode === 'patrol' && !sim.moved ? 0 : dt, …)` never advances the mixer while you stand still, so the idle clip's fade-in stays at weight 0 and the bind pose shows.
- Repro: `node tests/playtest2/realtime18.mjs` (real time only). Screenshots: `rt18-still.png` (arms straight out), `rt18-walking.png` (animated), `zoom-rt18.png`. The same pose is visible on mobile in `m-L18-hud.png`.
- This is the first thing a player sees in the finale.

### 6. [bug, medium] Replaying an earlier level moves "Continue" backwards
`showWin` sets `save.current = next.id` on every win, replays included. I cleared L1–L5 (frontier L6, "המשך · שלב 6"), then replayed L1. The map now says **"שחקו שוב · שלב 2"**, and that survives a reload.
- Repro: `node tests/playtest2/flow.mjs` (log lines "after replay" and "after reload"). Screenshot: `flow-13-menu-reload.png`.
- Fix: only advance `current` when `next.id > save.current`.

### 7. [bug, medium] The "locked" toast is invisible on the map
`#toast` lives inside `#hud`, which is hidden on the menu. Clicking a locked node gives no feedback; the toast's rect is 0×0.
- Repro: `node tests/playtest2/ui.mjs toast` (log line `locked toast {"w":0,"h":0,…}`). Screenshots: `ui-locked-toast.png`, `zoom-flow-locked.png`.
- Locked nodes also look almost the same as open ones (only a tiny lock glyph).

### 8. [clarity, medium] Math in the results card's "תרגלתם" line renders wrong in RTL
The `skill` strings have no ⟦…⟧ LTR isolation.
- L2 `0 < k < 1` → shows **`k < 1 > 0`**
- L12 `k = √(יחס השטחים)` → the √ detaches: **`(יחס השטחים)√ = k`**
- L13 `יחס שטחים 4 → k = 2` and L14 `היקף → k, שטח → k²` → the arrows point backwards
- L17 `1/k` → **`k/1`**

Repro: `node tests/playtest2/bidi.mjs`. Screenshots: `bidi-skills.png`, `zoom-bidi-l2.png`, `zoom-bidi-l12.png`, `zoom-L17-skill.png` (from a real win card).

### 9. [visual/fairness, medium] L18: the guard's vision decal can't be read, and the 1.4 m "too close" radius isn't drawn
The additive cone at opacity 0.32 almost disappears on the bright dawn floor. From the spawn and from 7 m you see a faint glow at his feet, not a cone with edges. I was spotted from directly behind at 1.23 m (the sim's `dist < 1.4` rule), outside anything drawn.
- Screenshots: `L18-spawn-guard.png`, `zoom-L18-guard.png`, `zoom-L18-decal.png`. Repro: `finale.mjs behind` (log "L18 approach … d=1.23 chase").
- Walking along the walls is never spotted (3★ wall route in `run-finale.txt`). The stealth is fair but unreadable.

### 10. [clarity, medium] Target plates are blown out by the target spotlight at the drop spot
- L4 at 3.6 m: the top line "כן ריק · חיישן גובה" is washed out (`zoom-L04-plate.png`).
- L13 at 3 m: "לוחית לחץ / שטח 2 מ"ר" is washed out, and the key number is barely legible (`zoom-L13-plate.png`).
- Both are readable only closer up (`L13-miss2-b.png`).

### 11. [clarity, medium] L8 side labels are still unreadable
The labels show as gold bars with illegible digits on both the held sign and the frame at the 3 m drop spot (`zoom-L08-frame.png`). Generated triangle rooms are worse: a 12.5 / 30 / 32.5 cm sign (`ch-w2-2-aim-frame.png`).

### 12. [clarity, medium] L15 is still tiny
The house-shaped hole is a dark speck on a small panel. The pentagon on the table is a 2 cm sprite on a huge flat gold slab (`L15-pad-penta.png`, `L15-aim-frame.png`, `L15-miss2-b.png`). The lesson ("only the similar shape fits") depends on seeing the shapes.

### 13. [visual, medium] L17 vault: you can't see the key, the keyhole or what happens to them
The vault wall is washed out by glare. The keyhole is a small plate with no visible slot, and the 12 cm key is a glint. At 15 cm (crash) or 9 cm (fall-through) nothing visible happens beyond the red flash and toast (`sheet-L17.png`, `sheet-L17b.png`).

### 14. [visual, medium] Mobile 390×844: the prompt chip sits under the act button
The prompt rect is x 274–382, y 651–694; `#tAct` is x 300–384, y 640–724. The prompt "לחצו להניח על: גומחה" is cut to "…להניח על: גומחה" (`m-04-aim.png`, `m-05-chase.png`, `m-07-climb.png`).
- The mobile pause card lists keyboard controls (WASD, R, Shift, H, עכבר) on a touch device (`m-L12-pause.png`).
- On mobile the briefing math wraps alone: "k²." on its own line in L12 (`m-L12-brief.png`).

### 15. [clarity, medium] Results card praises accuracy after three wrong drops
"דיוק ההנחה 99.8%" and the "🔬 דיוק של צלף" badge are computed from successful fits only. After 3 failures + alarm (1★) the card still shows a sniper-accuracy badge (`zoom-L01-miss-results.png`). After one miss it reads "**1 הנחות שגויות**"; that needs singular grammar (`m-08-results.png`).

### 16. [clarity, medium] Challenge-room text and naming
- W1 bust rooms say **"כן ריק · חיישן משקל"** (a weight sensor) but measure height (`generator.ts:66`; the authored L4 says "חיישן גובה"). In hall 4 weight scales by k³, so this is a real misconception trap.
- In the same room the two neighbouring busts stay 0.9 m while the plate asks for 1.2 m, so the room's visual symmetry suggests the wrong size (`ch-w1-3-aim-plinth.png`).
- One thing has four names: the map says "אתגר", the intro "חדר אתגר", the level title "חדר מפתיע (…)", and the level card button "חדר חדש ב…". The HUD title wraps to two lines on desktop (`ch-w1-3-spawn.png`).

### 17. [visual, low-medium] The roof-crash hole and its light cylinder stay for the rest of the level
On the next drop they wrap the exhibit like a hologram: the L5 gap-left statue stands inside it (`L05-miss2-b.png`). The roof crash itself (L5, k = 5) shows a statue cut off at the ceiling with no readable hole from the drop spot (`L05-miss1-b.png`).

### 18. [visual, low-medium] Payoffs you can't see
- L7: the placed 3 m mirror is a black slab against a black wall, and the stamp covers the laser hit (`sheet-L07b.png`).
- L10: from the drop spot the pole runs off the top of the screen, so you never see it touch the rail (`sheet-L10.png`).
- L14: the 3 × 3 m planter fills the whole view at 3 m (`L14-drop-loop-b.png`).

### 19. [visual, low] Art nits
- Window light shafts are hard-edged translucent quads that slice through pilasters and walls: L1, L3, L12, L15 (`L01-pad-cube.png`, `L15-pad-penta.png`).
- Empty pedestal caps and tables are flat untextured gold slabs that glare up close: L1, L3, L12, L15, L16 (`L01-aim-niche.png`).
- The L14 planter shrub is a low-poly green blob.
- Crashes mostly show interpenetration plus a red flash, with no breakage: the L3 plank through the pillars, the L9 ramp through a glass case (`L03-miss1-b.png`, `L09-miss1-b.png`).
- The caught close-up is still a dark cap filling the frame (`chase-L03-caught.png`).

### 20. [clarity, low] Smaller text issues
- In the "no hints" finale (L18), the 3rd-miss card still gives "היה צריך k = 6" (`L18-miss3-card.png`). Decide whether that's intended.
- The 2nd-miss line for length targets, "זה יחס אורכים — k עצמו.", is awkward. Suggest "זה יחס אורכים: האורך גדל פי k".
- The "היציאה נפתחה! רוצו אליה" toast (fired 1.2 s after the fit) shows through behind the results title when the exit is close (`zoom-L01-miss-results.png`, `flow-L5-wincard.png`).
- Objective lines wrap with one-word orphans: L3 "מדי", L8 "הנכון".
- The aim dot lands on the placard digit when you aim at an exhibit's middle: L6 "1.8", L11 "1" (`L06-pad-ladder.png`, `L11-pad-plinth.png`).

### 21. [bypass, known] "Always ×3" still clears the single-target k = 3 levels
L1, 9, 11, 12, 15 and 16 (round-1 B2) are unchanged and acknowledged. The constant still never clears a multi-target level or the finale.

## What worked

- **All 18 levels were solved through keyboard input, all at 3★** with the results numbers matching. Accuracy was 99.4–100 % and game time 0:08–0:20 for L1–17 (1:49 for L18). The success stamp shows "מושלם! k = … · נכנס בדיוק".
- **The progressive card is correct on all 18 first targets.** The 1st miss shows the ratio used and the direction, the 2nd adds the ratio kind (k / k² / k³), and the 3rd adds the needed k (a range on L2 and L3, the √ / ∛ working on L12, 13, 15 and 16). Three misses end at 1★, and the exhibit always returns to its pedestal.
- **Every consequence I triggered looks right.** I saw crash, roofCrash, fallThrough, blownAway, pocketed, gapLeft and tooShort.
- **Floor drops are free and give no size preview.** The exhibit flies back at its original size; a floor drop that hits a wall is a crash.
- **The menu flow works.** Locks hold without `unlock` (only L1 is open), and the tiers (מתחילים / בינוני / מתקדם / מומחה · הרחבה / אתגר סופי) show on the map and in the briefings. "לשלב הבא" chains L1→L5. The L5 card announces "נפתח: אולם הצללים" plus a challenge room, and the ★ node appears for hall 1. "עוד חדר אתגר" works and the ★ counter reads "אתגר · 2". Stars persist across reload, and a replay keeps the best score.
- **Challenge rooms: 16 of 16 were solvable and won**, with k values of 1.5, 2.5, 3, 4, 4.5, 5, ⅓ and ¼. The rooms make sense apart from #16.
- **The intro skips on any key, and the briefings read well.** Pause freezes time. Mute works from the pause toggle, M and the button. The hint costs one star once. The finale's hint is disabled with a toast. Enter on the map starts the level. The mobile climb button now appears at the ledge, and the mobile act button grabs, drops and dismisses cards.
- **No console errors** in any run. Frame pacing was a steady 60 fps on L1, 6, 12, 15 and 18 (p95 16.8 ms, worst frame 33–50 ms; this Mac's GPU, not a phone).

## Per-level table

| Level | Solved | Stars (clean / 3 misses) | Consequences seen | Visual / clarity issues |
|---|---|---|---|---|
| 1 | yes | 3 / 1 | crash (hid), fallThrough | light-shaft quads; gold pedestal slab; toast behind results title |
| 2 | yes | 3 / 1 | crash (hid), blownAway | vent small from spawn; skill line `k < 1 > 0` |
| 3 | yes | 3 / 1 | crash (**caught**), fallThrough | held plank hides the gap target at the drop spot; crash = plank through pillars; hide next to guard door (#3) |
| 4 | yes | 3 / 1 | crash (caught / hid), pocketed | target plate blown out at 3.6 m; borderline chase |
| 5 | yes | 3 / 1 | roofCrash (hid), gapLeft | roof hole + light cylinder persist; doorway reads as a flat blue panel |
| 6 | yes | 3 / 1 | crash (hid), tooShort | shadows readable on the rulers (good); aim dot over the "1.8" |
| 7 | yes | 3 / 1 | crash (**caught**), tooShort | very dark; placed mirror invisible; hide next to guard door (#3) |
| 8 | yes | 3 / 1 | crash (hid), fallThrough | side labels unreadable |
| 9 | yes | 3 / 1 | crash (hid), tooShort | crash = ramp clipping through a glass case |
| 10 | yes | 3 / 1 | crash (hid), tooShort | rail not visible from the drop spot |
| 11 | yes | 3 / 1 | crash (hid), gapLeft | aim dot over the "1" |
| 12 | yes | 3 / 1 (2★ with hint) | roofCrash at k = 9 (hid), gapLeft, crash | skill line √ detached; roof hole persists |
| 13 | yes | 3 / 1 | crash at k = 4 (hid), gapLeft | plate blown out at 3 m; skill arrow reversed |
| 14 | yes | 3 / 1 | crash (hid), gapLeft | planter fills the view; shrub blob; skill arrows reversed |
| 15 | yes | 3 / 1 | crash at k = 9 (hid), fallThrough | frame and pieces tiny; gold table slab |
| 16 | yes | 3 / 1 | crash (hid), tooShort | fine |
| 17 | yes | 3 / 1 | crash (hid), fallThrough | vault glare; key, keyhole and consequences invisible; skill `k/1` |
| 18 | yes (wall route) | 3 / 1 | crash (**caught ×2**, guard teleport), tooShort | **no shadows**; guard T-pose; cone decal unreadable; 3rd card gives k in the "no hints" level |

## What automation cannot tell you

A robot pressing keys and reading screenshots **can't measure fun, frustration, or whether a 13-year-old learns similarity from this**. It can't tell whether the slapstick lands, whether kids read the plates, or whether they will actually find the restart bypass. Audio was not checked. Nothing ran on a real phone or with a real mouse and pointer lock. The next step is a handful of grade-8 players, watched without help, with a before/after item on k vs k² vs k³.
