# Playtest — גנב הפרספקטיבה (independent, automated)

**Date:** 2026-10-31. **Build:** `main` moved from `b7f21cf` to `c6f0bff` while I played (four commits landed and Vite reloaded the page several times). Every finding below was re-checked on `c6f0bff` unless it says otherwise.
**How:** headless Chromium (Playwright, `--use-angle=metal`), 1280×720 and 390×844 with touch. Input was real: Playwright clicks, taps and CDP touch drags for the UI, and `tests/autopilot.js` keyboard events plus `window.advanceTime` for movement. No state was injected and no sim methods were called. Level geometry (pads, anchors, free standing spots) came from a static dump of `src/levels.ts` / `findStand`, which stands in for a player reading the placards and the floor rings.
**Scripts:** `tests/playtest/` (`lib.mjs`, `first30.mjs`, `play.mjs <scenario>`, `stands.ts`, `dump-levels.ts`, `guardlook.mjs`, `l15regrab.mjs`). **Screenshots:** `test-output/playtest/*.png`, with the log in `test-output/playtest/log.txt` and the sweeps in `run-*.txt`.

## Scenarios run

| # | Scenario | Script |
|---|---|---|
| 1 | New player with empty storage: menu → clicking a locked node → level 1 → tutorial → look around → read placard → grab on pad → aim at the niche at 4.5 / 6 / 7.5 m → drop at 6 m → climb ×2 → exit → win card → map → reload | `first30.mjs` |
| 2 | L12 at k = 9: roof crash → alarm → watching the guard approach → hiding → search → worked card → retry and solve | `play.mjs l12k9,chase` |
| 3 | L12 at k = 9, then standing still and getting caught | `play.mjs l12caught` |
| 4 | Too-small drops: L1 (fallThrough), L2 (blownAway), L4 at d₁ + 0.3 (pocketed) | `play.mjs small` |
| 5 | L8 at the right k in the wrong orientation (jam), then rotating with R and solving | `play.mjs l8jam` |
| 6 | L15 with the equal-area rectangle at k = 3 (noFit) | `play.mjs l15nofit` |
| 7 | Hint (H key and button) in L12, then winning; hint in L18 | `play.mjs hint` |
| 8 | Pause (P / button), time while paused, mute (M / button / pause toggle), restart, back to map | `play.mjs pause` |
| 9 | Mobile 390×844 touch: menu, tutorial, HUD, stick, look drag, act button, fail card, climb, win | `play.mjs mobile` |
| 10 | Bypass sweep "fail once, read k off the card" on levels 1–17 | `play.mjs failread` → `run-failread.txt` |
| 11 | Bypass sweep "always 3× d₁" and "always 2× d₁" on levels 1–17 | `play.mjs constant` → `run-const3.txt`, `run-const2.txt` |
| 12 | Offline table of naive strategies for all 21 targets (×1.5…×4, d₁ + k, plate ratio as k) | `stands.ts` → `stands.json` |
| 13 | Floor preview, then k = 1 transfer (L1) | `play.mjs floorpreview` |
| 14 | Walking into the exit before solving (L2) | `play.mjs exitfirst` |
| 15 | Time to recover: hiding vs. getting caught (L12) | `play.mjs hidetiming` |
| 16 | Finale: carrying straight across the patrol, standing still in view for 10 s, walking through the middle, getting spotted | `play.mjs finale`, `guardlook.mjs` |
| 17 | Shadow readability: L6 rulers, plus L7, L10 and L18 views | `play.mjs shadows` |
| 18 | Frame rate in real time on L1, L6, L12 and L18 | `play.mjs fps` |

## Findings, ranked

### Bypasses (these undercut the learning goal and come first)

**B1. The fail card gives the answer, and failing costs the same as a hint.** All levels.
After any failed drop, the card prints `היה צריך k = 3` plus `הניחו רחוק/קרוב יותר`. A deliberate first drop at d₂ = d₁ (k = 1) is too small on almost every level, so it is quiet: no alarm and no chase. It costs one star, which is exactly what a hint costs, and the hint tells you less. The player then multiplies k by d₁ and wins.
- Repro: `node tests/playtest/play.mjs failread`. In-game result: **15 of 15 levels won with 2★** (1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 16, 17). The robot missed L8 and L15 because of its own pathing; I checked both separately. L8's jam card even says "היחס נכון".
- The worst cases are L6, L7 and L10. The card hands over k = 4 / 6 / 5, so the shadow and AA reasoning, which is the whole of World 2, never happens. In 12–16 the card also does the √ / ∛ step for you.
- Screenshots: `p02f-l12-worked-card.png`, `p03-L1-d2-d1-card.png`, `p09-failread-L06.png`.
- Fix idea: on the first failure, show the k that was used, which ratio type it is (length / area / volume) and the direction, but not `k needed`. Show the full working only after 2–3 failures, and/or price a failure above a hint.

**B2. "Always drop at 3 × d₁" gets 3★ on 6 of 17 levels, including the k² and k³ levels.**
- Repro: `CONST=3 node tests/playtest/play.mjs constant`. Wins in game: **L1, L9, L11, L12, L15, L16, all at 3★** (`run-const3.txt`). With ×2, L13 is 3★ and L8 also falls once rotated. ×4 wins L5 and L6, ×2.5 wins L3, and ×1.5 wins L4 (`stands.json` table).
- Area and volume targets use k = 3, 2, 4, 3, 3, 3 (12, 13, 14-plate, 15, 16, 18-billboard). A kid who learned "it's always 3" passes the exact levels built to catch k vs k² and k³.
- Fix idea: vary k on the power-2/3 targets, e.g. L12 area ratio 6.25 → k = 2.5, L16 16 kg → k = 2, L15 k = 2.5. Then no constant should clear more than one of them.

**B3. Floor preview + k = 1 transfer wins with zero failures and never shows the worked card.** L1, and in general any level.
Floor drops never fail unless they crash, and the first re-grab is free (stars only drop at `regrabs > 1`).
- Repro: `play.mjs floorpreview`. I dropped the cube on the floor next to the niche at k ≈ 2.84 (`p11a-floor-preview-k2.8.png`). Its top sits visibly below the 1.5 m pillar beside the niche, and at k = 3.06 it sits level with it (`p11b`). I corrected the size, grabbed it from 3.16 m and dropped it into the niche from 3.16 m (k = 1, matching d to d₁ on the HUD). Result: **won 2★, 0 failures**.
- The pillars beside the target act as a free ruler. The held object is also drawn at a constant screen size right next to the target, so it is a coarse size preview: in `p01l-aim-niche-d4.5/d6/d7.5.png` the held cube matches the niche opening at about 6 m. The ±2% window stops pure eyeballing in one go, but the floor loop removes that limit.
- Fix idea: count floor drops near an active target as attempts, or rescale a floor drop only after a confirm. At the very least, the second floor re-grab should already cost the star.

**B4. Getting caught is faster than hiding and costs nothing extra.** L12 (and every alarm level).
- Repro: `play.mjs hidetiming`. From the alarm to the card took **8.2 s when hiding and 5.3 s when caught**. Stats are identical apart from `caught`, which `starsFor` ignores. So the best move after a crash is to stand still, and the chase has no stakes.
- The gold "🏺 מחבוא" chip is a `<button>` with no handler, so clicking or tapping it does nothing (`p02d-l12-guard-chase.png`). It doesn't point toward the sarcophagus either, which is behind the player in L12.
- Fix idea: if you're caught, the guard pockets the loot or you lose the alarm star twice; make the chip point at the hide spot, or make it a working "go hide" control on touch.

**B5. The finale guard is easy to ignore.** L18.
It freezes whenever you stop, and its vision is only checked while you move. I stood 7.5 m away facing it for 10 s and it did not move. Walking from (0, 8) straight through the middle of the patrol square to (0, −4.7) passed 3 m from the guard unseen (`guardlook` first run). Routes along the walls (> 8.5 m from the centre) never reach its 5.5 m cone. Being spotted while carrying does work: the ladder goes back to its pedestal and a chase starts (`p13b`, `p13c`). This is intended "no timers on thinking" behaviour, but the finale's tension is mostly absent. **Low.**

### Bugs

1. **Mobile map is cropped (390×844).** World 1 (levels 1–5, including the only unlocked level) and the Vault (16–17) are off-screen. A new phone player can't see where they are; Continue still works. The logo also runs into the mute/motion buttons. Repro: open `/` with `hasTouch`, 390×844. Screenshot `p08a-mobile-menu.png`.
2. **Mobile climb button never appears.** `#tClimb` stays `hidden` all the time (nothing unhides it), so tapping fails (Playwright tap timeout). Climbing works only through auto-climb by pushing the stick into the ledge. Screenshot `p08h-mobile-at-step.png`.
3. **The hide chip is not interactive** (see B4).
4. **A map toast leaks into the level.** On the map, click a locked node (`נעול — סיימו את השלב הקודם`), then press Continue. The toast is drawn over the level-1 tutorial card and HUD (`p01c-tutorial.png`, `p01d-spawn-view.png`).
5. **After a win, "למפה" leaves the map on the level you just finished.** The button reads `שחקו שוב · שלב 1` instead of `המשך · שלב 2`. `save.current` is set but `selected` isn't; it only becomes 2 after a reload. Repro: win L1 → למפה (`p01t-menu-after-win.png`, log "menu after win selected:1").
6. **The roof crash doesn't show a roof crash.** At k = 9 in L12, the 3.6 m painting appears against the end wall with debris and a red flash. Looking up shows an intact ceiling (`p02c-l12-roofcrash.png`, `p02c2-l12-roofcrash-lookup.png`). Mockup 03's glass bursting outward is the payoff of the headline mistake and it's missing.

### Clarity (math and Hebrew)

1. **Gender/number mismatch.** The fail card says `השתמשת ב־k = …` (masculine singular, `rules.ts:139`, `sim.ts:468`), while the rest of the game uses plural (`הניחו`, `השתמשתם ברמז`). Use `השתמשתם`.
2. **`תפסתם מרחוק 2.00 מ'`** is unnatural Hebrew. Use `תפסתם ממרחק 2.00 מ'` (`main.ts:593`).
3. **Tutorial arrows in RTL** (`levels.ts:160`): `רחוק יותר → גדול יותר` renders with the arrow pointing back at "רחוק", and `k = 1 →` is stranded at the end of the line with `חופף.` wrapping below (`p01c-tutorial.png`, zoom `tut-zoom.png`). Use `←`, or words ("ולכן").
4. **Math wraps on its own line.** The hint box puts `k².` alone on a line (`p06a-l12-hint.png`). Bind the math to the word before it with a non-breaking space.
5. **L12 wording.** The target `צוהר הירח` is a window on the end wall, but every room has a real open skylight strip overhead (`p02a`). A 13-year-old will look up. Call it `חלון הירח`, or move the target into the ceiling.
6. **L15 target is tiny.** The frame is about 21 cm square on a wall. Its brass plate is larger than the frame, and the held glass piece is a speck (`p05b-l15-rect-aim.png`, `p05a`). The level's key idea, choosing the piece that is *similar* to the house shape, depends on seeing that shape. Make the frame and pieces physically bigger (the cm² numbers can stay).
7. **L8 side labels are unreadable.** The 30/40/50 and 60/80/100 labels on the sign and frame show as blank gold bars at every distance (`p04a`, `p04b`). Correspondence can only be guessed from the shape, so the "corresponding sides" lesson becomes "match the silhouette".
8. **L6 shadows: readable but washed out.** The statue's shadow tip lands right at 9 on its ruler (`p10c-l6-statue-shadow-tip.png`). The mannequin's tip lands at 2, but the low lamp's bloom/specular hotspot sits right on that ruler (`p10f`). Move the hotspot off the rulers.
9. **L3 card shows a single exact k.** It says `היה צריך k = 2.63` although any k in 2.5–2.75 works and the plate is written as a range.
10. **Plate legibility.** The L1 niche plate is unreadable from spawn and borderline at 6 m (about 8 px text, `p01l-aim-niche-d6`). It's fine once you walk closer, but nothing tells a new player to.

### Polish

- Compared with mockup 01 the scene is much plainer: boxy rooms, checkerboard floors, and a gold camera instead of the brass lens and glove. The HUD layout does match the mockup (stars, רמז, pause and mute top-left; level panel top-right; the lens bezel at the bottom with a locked gold d₁ and a large d).
- Mobile HUD: the act button overlaps the right edge of the lens bezel, and the prompt chip sits on the camera view model (`p08e-mobile-grabbed.png`).
- When the guard reaches you it fills the frame as a dark cap or blob (`p02d`, `p13e-0`). His fall when he catches you is funny, though (`p13e-2`).
- In L12 the guard's run path clips through the painting's pedestal (`p02j-guard-approach-3`).

## What worked well

- **The level-1 loop is clear and quick.** The objective names the 1.5 m niche, the placard gives 0.5 m, the floor ring says `2 מ'`, and the prompt adds `על משטח 2 מ'`. Grabbing locks `d₁ = 2.00`, the target glows when aimed at, and dropping at 5.99 m gives `מושלם! נכנס בדיוק` with sparkles and a cheering raccoon. Walking into the ledge auto-climbs; win card → 3★ → map → L2 unlocked. Stars persist across a reload. The robot did it in about 25 s of game time. Locked nodes give a clear toast.
- **Every failure kind I triggered is recoverable and the explanation is numerically right:** fallThrough, blownAway (with the correct "farther" for the shrink level), pocketed (the guard pops in, which is funny), jam ("היחס נכון…סובבו"), noFit ("שטח שווה לא אומר דמיון"), roofCrash and crash. The exhibit returns to its pedestal every time, and the retry worked in L8 and L12.
- **The k² trap holds.** Taking the plate ratio as k never wins an area or volume target. `d₁ + k` wins **0 of 21** targets (the old coincidences are gone). Walking into the exit before solving does nothing.
- **The chase reads well.** The Tripo guard runs in through the door with the alarm and red vignette (`p02j-*`), and the sarcophagus slit view with his flashlight while he searches is a nice touch (`p02k`, `p02l`). Animations play: guard run, look and fall; raccoon idle and cheer.
- **UI controls work.** Pause stops time (the player did not move during 1 s of W), restart resets everything, mute works from M, the button and the pause toggle, and the finale's hint is disabled with a toast. The hint costs a star right away and shows a correct, non-answer hint.
- **RTL math is isolated correctly in cards and the HUD** (`k = 10.8 ÷ 1.2 = 9` reads LTR inside Hebrew, units outside), and the RTL map order is correct.
- **Clean and fast.** There were **zero console errors or warnings** across all runs, and 60 fps with worst frame 17 ms on L1/L6/L12/L18 while walking and turning (this Mac with Metal; not measured on low-end phones).
- **Touch input works.** The stick moves, a right-side drag turns, and the act button grabs, drops and dismisses the fail card.

## What automation cannot tell you

This was a scripted robot playing through real input and reading screenshots. **It cannot measure fun, frustration, or whether a 13-year-old learns similarity from this.** It can't say whether the slapstick is funny, whether a kid notices the plates, or whether the bypasses above are actually found and used by real players rather than merely possible. That needs a few real grade-8 players, watched without help, with a before/after item on k vs k².

## Lead's response — what was changed after this playtest (2026-10-31)

Re-verified afterwards: `npm test` 59/59; all 18 levels played start to finish again through keyboard events in headless Chromium (`npm run capture` scenarios `solveAll` + `finale`, 3★ each); new captures in `docs/captures/`.

| Finding | Status |
|---|---|
| **B1** fail card gives the answer | **Fixed.** The card is progressive per target: 1st miss shows only the ratio you used and "closer/farther"; 2nd adds which kind of ratio (lengths / area k² / volume k³); only the 3rd shows the needed k and the root. A second failed drop now costs a second star (two misses → 1★). Tests: `explain is progressive…`, `starsFor`. |
| **B2** "always 3× d₁" wins L1, 9, 11, 12, 15, 16 | **Not changed.** Those k values are the handoff's authored numbers (k = 3 in each). Mitigations: it never wins a multi-target level or the finale, and the replay rooms vary k (1.5, 2.5, 3, 4, 5, never 2). Recorded as a known limit. |
| **B3** floor preview + k = 1 transfer | **Fixed.** A drop anywhere other than a target now flies the exhibit back to its pedestal at its starting size ("העדשה עובדת רק על מטרה"). No floor fine-tuning, no re-grab chains. Test: `a drop anywhere but a target…`. |
| **B4** caught is faster than hiding, same stars | **Fixed.** Getting caught costs an extra star; the hide wait is shorter (search 2.8 s, then the guard leaves); the hide chip is now a non-clickable arrow that points at the nearest sarcophagus. |
| **B5** finale guard easy to ignore | **Partly.** His flashlight cone is now checked even while you stand still (he still only *moves* while you move); the cone is drawn so you can read it. Walking behind him is still allowed; that is the stealth. |
| Bug 1 mobile map cropped | **Fixed.** The map camera fits the whole museum to any aspect; smaller logo on narrow screens (`docs/captures/00-menu-mobile.jpg`). |
| Bug 2 touch climb button | **Fixed.** Shown when a climbable ledge is in front of you (`Sim.climbable()`). |
| Bug 3 hide chip does nothing | **Fixed** (it's an arrow indicator now, not a button). |
| Bug 4 map toast leaks into the level | **Fixed** (toast cleared on level start). |
| Bug 5 map stays on the finished level | **Fixed** (selection moves to the next level on a win). |
| Bug 6 no visible roof crash | **Fixed.** Rooms no longer have a bright skylight strip; a roof crash punches a jagged moonlit hole with a light shaft and debris, and the camera tilts up to it (`03-failure-crash.jpg`). |
| "השתמשת" singular, "מרחוק", tutorial arrows, k² wrap | **Fixed** ("השתמשתם", "ממרחק", tutorial without arrows, math spans don't wrap). |
| L12 "צוהר" vs real skylights | **Fixed** (renamed "חלון הירח" everywhere; skylight strips removed). |
| L3 card shows one exact k for a range | **Fixed** (states the window "בין 2.5 ל־2.75"). |
| L8 side labels unreadable | **Improved** (labels ~2× larger on the sign and the frame). |
| L15 frame tiny, plate bigger than frame | **Improved** (smaller plate); the frame stays 24 cm as the handoff's cm² numbers require. |
| L6 lamp glare on the mannequin ruler | **Fixed** (no wall sconces in the Hall of Shadows; the single lamp is the light source). |
| L1 plate unreadable from spawn | **Improved** (bigger niche plate). |
| Mobile act button overlaps the bezel | **Fixed** (smaller, moved up on narrow screens). |
| Guard close-up dark / clips through pedestals | **Not changed** (no path-finding around props). |
| Lens view model reads as a camera | **Not changed** (Tripo output; budget spent). |
