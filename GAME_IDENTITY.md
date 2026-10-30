# Game identity — גנב הפרספקטיבה (Perspective Thief)

## One line
A first-person night heist in the surreal **Museum of Proportions**: a stolen antique lens lets you grab an exhibit and drop it farther or closer — it keeps its on-screen size, so its real size changes by **k = d₂ ÷ d₁**. Compute where to stand, drop, and get away with it.

## Who and why
Hebrew-speaking grade-8 students (13–14). Workbook grade 8 chapter 6 (similarity). The fun is the "wait, *that* works?" moment: a dinosaur crate shrunk into a vent, a teacup-sized plank turned into a bridge, a postcard painting blown up to black out a skylight. Mistakes are slapstick, never a red X: a too-big painting crashes through the roof, the alarm whoops and a wobbly night guard waddles after you while you hide in a sarcophagus.

## Pillars
1. **Forced perspective is the star.** Grab → the exhibit floats in front of the lens at the same apparent size. Drop → a short "whoosh" and it lands at its new real size, k × every length.
2. **The number is the only way.** The lens HUD shows d₁ (locked at grab) and the live rangefinder distance d. It never shows k or the resulting size. Placards and brass plates give real dimensions; you compute d₂ = k · d₁. Tolerance ±2 % (eyeballing fails).
3. **Mischief, not worksheets.** Every wrong size has a funny, recoverable consequence: crash + alarm + guard chase, falling through a grate, a vent fan blowing it away, the guard pocketing it. A short worked explanation follows (the ratio you used vs. the one needed).
4. **One idea per hall.** Lengths → shadows (AA) → perimeter & area (k vs k²) → the vault (k³ extension, congruence k = 1) → a no-hints rooftop finale at dawn.

## Look
- **Moonlit museum at night:** cool blue moonlight through tall windows and skylights, warm brass display lamps, deep red velvet ropes, white-and-grey marble floors with inlaid brass measuring strips (ticks every 0.5 m, numbers every metre), dark wood display cases, gilded frames. Long dramatic shadows (World 2 uses a real shadow-casting light).
- **Surreal exhibits:** oversized teacups, a dinosaur skeleton in a wooden crate, marble busts, a gold cube, stained glass, giant paintings. Slightly stylized (chunky proportions, saturated accents) but not toy plastic — think *Superliminal* meets *Untitled Goose Game* with Pixar-ish lighting.
- **World palettes:** W1 Gallery of Lengths — midnight blue + brass. W2 Hall of Shadows — dark amber, single low lamp, black shadows. W3 Canvas & Carpet — burgundy + gold frames. W4 The Vault — steel teal + gold. Finale — rooftop sculpture garden at pink-orange dawn.
- **Characters (Tripo, rigged):** the **night guard** — round, mustached, oversized cap, flashlight, waddling walk, scratches head, faceplants. The **raccoon accomplice** — masked, tiny backpack, waits at vents, cheers and snatches the loot.
- **Hero prop:** the **antique brass camera lens** held in the lower-right of the first-person view; its glass is the HUD.

## HUD (Hebrew, RTL)
- **Lens HUD (bottom centre, round brass bezel):** `d₁ = 2.00 מ'` (locked, gold) and the live `d = 5.62 מ'` (white, big). Rangefinder red dot on the floor/target. Numbers always LTR (`<bdi dir="ltr">`).
- **Top-right:** level name (`1 · הרמה ראשונה`), objective line (`הניחו את הקובייה בגומחה של 1.5 מ'`).
- **Top-left:** stars ★★★, hint button (`רמז`, costs a star), pause, mute.
- **Placards:** small brass/paper cards on exhibits — `קובייה · צלע 0.5 מ'`. **Target plates:** brass plates on vents, ledges, frames — `גומחה · גובה 1.5 מ'`.
- **Feedback:** gold outline + thunk + sparkles on fit. Red pulsing vignette + siren + guard on crash. A worked-ratio card after a failure: `השתמשת ב־k = 9 · היה צריך k = 3 (יחס שטחים = k²)`.
- Font: Rubik, bundled. Never colour-only feedback (icon + word + sound).

## Controls
Desktop: WASD/arrows to move, mouse to look (pointer lock), click to grab/drop, R to rotate the held piece, Shift to creep slowly, Space to climb. Touch: left stick, drag to look, big grab/drop button, rotate button.

## Not this
Not a courier loop, not a quiz with a 3D background, not a runner, not a toy-plastic diorama. No timers on thinking: guards only patrol in the finale (slowly, with hide spots) and freeze while you aim the lens.
