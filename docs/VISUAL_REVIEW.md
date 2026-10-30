# Visual review — mockups vs the real game

Targets: `docs/visual-targets/01–04` (ChatGPT image generation, design targets only; see `PROMPTS.md`).
Actual: `docs/captures/*.jpg`, captured 2026-10-31 by `tests/browser-capture.mjs` in headless Chromium (Metal/ANGLE GPU), 1280 × 720 (the mockups' 16:9), playing through **keyboard events only** (`tests/autopilot.js`) plus the deterministic `advanceTime` hook. Nothing was posed by setting game state. Run `npm run capture` with the dev server up to regenerate (writes `test-output/captures/`).

## 01 · First 30 seconds → `01-first-30s.jpg`, `01b-grabbed.jpg`, `01c-aim-6m.jpg`, `01d-fit.jpg`

| | Mockup | Game | Verdict |
|---|---|---|---|
| Camera | Eye height, slightly low, wide FOV, crate on the left, niche centre-right | Eye height 1.6 m, FOV 70°, crate on its pedestal left of centre, niche under the mezzanine centre-right | Match |
| Set | Moonlit marble hall, arched moon window, mezzanine balustrade, velvet ropes, display cases, gilded frames | Moonlit hall, arched moon window (left wall), mezzanine with balustrade, velvet rope line, gilded paintings, busts, brass sconces | Close. The mockup is denser (glass display cases, armour, vases); ours has fewer props and a plainer ceiling. |
| Placards/plates | Brass placard on the pedestal, brass plate beside the niche | Same, both readable at 2–6 m | Match |
| Floor ruler | Brass strip with engraved numbers running into the room | Exact procedural strip from the niche: ticks every 0.1/0.5 m, numbers every metre, reading toward the drop spot | Match (and correct, the mockup's numbers were wrong) |
| HUD | Stars + hint pill + pause + mute top-left; dark gold-bordered panel top-right; round brass lens bezel bottom-centre with small gold `d₁` over big white `d` | Same layout and hierarchy; the bezel is a half-round dome; numbers in LTR isolates | Match |
| Lens view model | Brass lens in a black glove, lower right | Tripo "lens in a gloved hand" (it came out as a brass camera with a lens; the glove is dark, the back of the camera dominates) | Deviation: reads as an antique camera more than a lens. Accepted. |
| Rangefinder | Red dot on the floor | Red glowing dot on the aimed surface + thin red beam from the lens while carrying | Match |
| Carry (01b/01c) | — | Held crate keeps its exact on-screen size, gold outline + sparkles, held lower right so the target stays visible; `🔒 d₁ = 2.00`, `d = 6.00` | Matches mockup 02's carry language |

## 02 · Core carry → `02-core-carry.jpg`, `02b-vent-raccoon.jpg`

- **Match:** the dinosaur crate (Tripo, skull poking out) floats with a gold outline and sparkles; locked `d₁ = 8.00`, live `d`; the target prompt chip "לחצו להניח על: פתח אוורור" bottom right; brass plate with the vent's numbers; floor ruler; raccoon (Tripo, rigged, idle) waiting next to the vent.
- **Deviation:** the mockup's vent is high on the wall with the raccoon inside it; ours is at floor level (the crate must land on the floor) and the raccoon waits beside it, then cheers and takes the crate on success. In the carry shot the big held crate still covers part of the low vent at some angles; `02b` shows the vent itself (brass frame, spinning fan).
- **Deviation:** no padlock icon in the release chip and no mouse icon; the chip is text only.

## 03 · Failure → `03-failure-crash.jpg`, `03b-guard-chase.jpg`, `03c-hidden.jpg`, `03d-worked-ratio.jpg`

Real sequence on level 12: grab the painting at d₁ = 1.20 m, drop at d = 10.80 m (k = 9, the area ratio taken as k).
- **Match:** the painting grows ×9 and rises through the ceiling (roof crash) with glass/plaster particles and falling debris, screen-edge red vignette, red pulsing alarm lights, the lens bezel turns red, a star is lost, toast "דרך הגג! ענק מדי".
- **Match:** the rigged Tripo guard (round, mustache, peaked cap) runs in from his door (`run` clip) with a flashlight cone; a round gold "מחבוא" chip appears on the right; hiding in the upright Tripo sarcophagus switches to a peek view while the guard searches with `look_around`/`scratch_head` and then leaves.
- **Match:** the worked-ratio card: big red "אופס!", the used ratio `k = 10.8 ÷ 1.2 = 9`, the needed `k = 3 · יחס שטחים = k²`, the root line `k = √9 = 3`, which way to move, and a round retry button. The mockup's RTL bug (k² on the wrong side) is fixed: math sits in LTR isolates.
- **Deviation:** the mockup shows everything in one frame (crash + guard + card). The game sequences them: crash (1.6 s) → chase → hide → card, so the card never covers the chase.
- **Deviation:** our painting is a procedural gold frame with a drawn cat; the mockup's is a lavish oil painting.

## 04 · Level select → `00-menu.jpg`

- **Match:** a 3D miniature museum on a dark wood table: four colour-coded halls (marble/blue, amber, burgundy, teal vault) plus the dawn rooftop on top, dark name plaques, brass medallion nodes with numbers and 3 stars each, glowing dotted path, the current node glowing with the raccoon figurine, total stars pill top-left with mute and reduced-motion buttons, gold logo top-right, big brass "המשך · שלב N" button bottom-centre, selected-level card.
- **Fixes vs mockup:** all 18 nodes are present (the mockup skipped 11), the order runs right-to-left (World 1 is the rightmost hall) and the level card sits bottom-left so it doesn't cover node 1.
- **Deviation:** fewer table props (no sticky-note checklist, no flashlight), and the halls are simpler boxes than the mockup's detailed rooms.

## Other captures

- `06-shadows.jpg` — Hall of Shadows: warm amber floor, real directional shadows from a single low brass lamp at atan(1.6/2) = 38.66°; the 7.2 m Tripo statue's shadow runs along its floor ruler; the crown glows on top; display cases line the walls. **Deviation:** the mannequin's thin shadow is hard to read from the spawn point (walk to its ruler).
- `18-rooftop.jpg`, `18-finale-solved.jpg` — dawn rooftop, patrol guard with a visible flashlight cone, upright sarcophagi as hide spots, 9 m tower. **Deviation:** the city backdrop is plain boxes.
- `01-mobile.jpg` — 390 × 844 touch: compact HUD, full-width objective panel, bezel bottom-centre, big "תפסו" button bottom-right, prompt above it, no overlaps.

## Remaining honest gaps

1. Set dressing is still lighter than the mockups (display cases now line the walls, but ceilings and the rooftop city are plain).
2. The lens view model reads as a camera.
3. Hall of Shadows could be darker and moodier.
4. These are automated captures; nobody has judged them on a real phone or a classroom screen yet.
