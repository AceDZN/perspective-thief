# גנב הפרספקטיבה — Perspective Thief

A first-person 3D night heist in the surreal **Museum of Proportions**, teaching **grade-8 similarity** (Israeli curriculum as published in Workbook, grade 8 chapter 6). Your stolen antique lens keeps an exhibit's *on-screen* size, so when you grab it at distance **d₁** and drop it at **d₂**, every length is multiplied by the similarity ratio **k = d₂ ÷ d₁**. Perimeter scales by k, area by k², weight by k³ (World 4 extension). Compute where to stand, drop, and get away with it. Get it wrong and the exhibit crashes through the roof, the alarm whoops and a waddling night guard comes after you.

Hebrew RTL UI, Three.js, 18 authored levels in 5 halls, plus generated "surprise rooms" per hall after you clear it.

## Run

```bash
npm install
npm run dev        # http://localhost:5214  (strict port)
npm test           # 65 unit tests: rules, all 18 levels solvable through the sim, misconception traps
npm run build      # static build in dist/ (relative base, works offline)
npm run preview    # http://localhost:4214
npm run capture    # needs the dev server: plays scenarios in headless Chromium, saves screenshots
node tests/audio-check.mjs   # needs the dev server: measures each hall's music/ambience level, chase layer, heartbeat
```

URL options: `?level=N` jumps into a level, `?unlock=all` unlocks the whole map (for teachers/testing).

## Controls

| | Desktop | Touch |
|---|---|---|
| Move | WASD (Shift = slow, for exact distances) | left-side stick |
| Look | mouse (click to capture); arrows turn, Q/Z look up/down; click-drag if pointer lock is unavailable | drag on the right side |
| Grab / drop | click or E | big "תפסו / הניחו" button |
| Rotate a triangle | R or right click | ⟳ button |
| Climb | Space, or keep walking into a ledge ≤ 1.6 m | keep pushing forward |
| Hint (costs a star) · pause · mute · fullscreen | H · P/Esc · M · F | top-left buttons |

The lens HUD shows the locked grab distance **d₁** and the live rangefinder distance **d**. It never shows k or the resulting size: placards give the exhibits' real sizes, brass plates give the targets' numbers, and brass floor rulers mark distances. Standing on a round grab pad snaps d₁ to the pad's exact value. Tolerance is ±2 % of k (some targets have physical slack), so eyeballing fails.

## What's implemented

- **18 authored levels** (`src/levels.ts`; levels 9, 11, 15 and 16 re-authored from the handoff so that no fixed "drop at N × grab" wins more than 4 of 21 targets): Gallery of Lengths (1–5), Hall of Shadows (6–10, real shadow-casting light, AA similar triangles), Canvas & Carpet (11–15, perimeter k vs area k²), The Vault (16–17, k³ extension and congruence k = 1), and the no-hints rooftop finale at dawn (18) with a patrolling guard who only moves while you move. Each world ends in a transfer level. See `LEVELS.md` for every level's numbers and solution, and `CURRICULUM.md` for the Workbook module links.
- **Pure math** in `src/rules.ts` (ratio, k windows for powers 1/2/3, drop verdicts, worked explanations, stars) and a **headless sim** in `src/sim.ts` (movement, aiming, grab/drop, consequences, guard, stealth). The Three.js scene only renders the sim.
- **Consequences:** crash and roof-crash (alarm, guard chase, hide in a sarcophagus or get caught), fall-through, blown away by the vent fan, pocketed by the guard, too short, gap left, jam (wrong corresponding sides), not similar. Every mistake is recoverable and is followed by a worked-ratio card that reveals more on each repeated miss (ratio used → ratio kind → needed k). A drop anywhere but a target sends the exhibit back to its pedestal.
- **Tripo 3D models** (`public/models/`, see `ASSETS.md`): rigged night guard (walk/run/look-around/scratch-head/fall), rigged raccoon accomplice (idle/greet/cheer), lens-in-glove view model, dinosaur crate, bust, statue, upright sarcophagus. Everything that carries a number is procedural and exact.
- **Progression:** five halls, each a new subject at a higher tier — Gallery of Lengths (מתחילים), Hall of Shadows (בינוני), Canvas & Carpet (מתקדם), The Vault (מומחה · הרחבה), Rooftop finale (אתגר סופי). Levels unlock in order; a hall briefing introduces each new subject; any finished level can be replayed from the map for more stars; clearing a hall opens its **★ challenge rooms** (fresh solver-checked numbers every time).
- **Presentation:** cinematic level intro (letterbox fly-in with hall, tier and objective; any key skips), results screen (stars, drop accuracy, time and personal best, badges, **your worked solution** — ratio → k → d₂ — for every fit, what you practised, what unlocked, rank-ups), success stamp with the k you used, slow-mo, gold shockwave, roof-crash camera tilt. The guard and the raccoon talk in speech bubbles ("עצור! גנב!", "לאן נעלמת…?"); a player stuck for 40 s gets a free raccoon nudge that points at the placards/plates or restates d₂ = k × d₁ (never the answer).
- **Sound:** all synthesized (no files): a lookahead music sequencer with a chord pad, pizzicato bass, brushed drums and a bell motif per hall, a generated hall reverb, a faster chase layer during the alarm, a heartbeat that quickens as the guard nears, and ambience per hall (room air, vault hum, rooftop wind).
- **Progression extras:** thief ranks by total stars (כייס מתחיל → אגדת המוזיאון), personal-best time per level.
- **Art:** per-hall inlaid marble floors / herringbone parquet, fluted pilasters, chandeliers, walnut-panelled mezzanines, glass display cases, a spotlight on every target, museum uplight washes in the Hall of Shadows, drifting dust, cinematic colour grade; a lit dawn skyline with string lights on the rooftop.
- **3D level select** (a museum diorama on a chalk blueprint of the heist, right-to-left, a tiny guard patrolling the rooftop), stars and progress saved in `localStorage`, hints, pause (mouse sensitivity, reduced motion, mute), touch controls, Hebrew Rubik font bundled.
- **Challenge rooms:** built from each hall's templates (two per hall) with new numbers, verified by the solver: solvable through the sim, and the constant "drop at 2× grab" strategy fails (tested on 100 seeds).
- **Learning log:** anonymous local events (level, d₁, d₂, k, needed k, outcome, hint used, attempt, first unaided decision) in `localStorage` (`perspective-thief:learn`); `window.learning_log()` returns them.
- **Test hooks:** `window.render_game_to_text()` (full state as JSON) and `window.advanceTime(ms)` (deterministic steps, respects pause).

## Planned / not done

- More set dressing (display cases, richer ceilings and city backdrop) to match the mockups' density; see `docs/VISUAL_REVIEW.md`.
- No teacher dashboard or server; the learning log stays on the device.
- Not tested on real phones or with students yet; automation cannot measure fun or learning.

## Measured

- Production build: JS 914 KB (247 KB gzip), CSS 19 KB, models 5.9 MB total (`dist/` 7.2 MB). No runtime network requests beyond the static files.
- Frame rate (`node tests/perf.mjs`, headless Chromium on this Mac's GPU): 60 fps at 1280×720 and 1920×1080 on levels 1, 6, 12 and 18. Not measured on phones.

## Deploy to Vercel (when you want to)

Static site, no server. In Vercel: **New Project → import `AceDZN/perspective-thief` → Framework preset "Vite"** (build `npm run build`, output `dist`). The relative `base: './'` also lets it live under a sub-path (e.g. inside math-games.workbook.co.il) or in an iframe; the canvas fills whatever container it is given. Not deployed yet.

## Docs

`GAME_IDENTITY.md` · `LEVELS.md` · `CURRICULUM.md` · `ASSETS.md` · `PLAYTEST.md` · `progress.md` · `docs/visual-targets/` (mockups + prompts) · `docs/VISUAL_REVIEW.md` · `docs/captures/` (real gameplay screenshots) · `docs/handoff/` (build brief).
