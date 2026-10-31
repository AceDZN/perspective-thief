Original prompt: build Perspective Thief (גנב הפרספקטיבה), a real-3D, genuinely fun web math game for grade-8 similarity in Hebrew, 18 levels, per `docs/handoff/BUILD_HANDOFF.md` and `docs/handoff/COMMON.md` (gameplay mockups first, Tripo models with a rigged guard, build, review against the mockups, playtest, public repo AceDZN/perspective-thief, no AI attribution in commits).

# Progress

## 2026-10-30 → 31

1. Repo created and pushed (public `AceDZN/perspective-thief`), handoff docs copied, `GAME_IDENTITY.md` written.
2. **Mockups** (visual helper, ChatGPT in the user's Chrome): 4 gameplay images in `docs/visual-targets/` with prompts in `PROMPTS.md`. No `OPENAI_API_KEY`, so the imagegen CLI route was not used.
3. **Tripo** (visual helper, user's Chrome): searched the user's assets and the community gallery first, then generated 8 models and rigged 2 (guard, raccoon), plus 1 AI animation (scratch head). 300 credits, within budget. Details in `ASSETS.md`.
4. **Core:** pure rules (`src/rules.ts`), 18 levels (`src/levels.ts`), shapes, headless sim and solver. Every level solvable through the sim (tests).
5. **Math review** (level designer helper): fixed wording, terms (מקצוע, חיישן גובה…), missing numbers (L6 mannequin sign, L10 banner), L9 pad, L12 room length, L13 plate shape; added `tests/rules.test.ts`, `tests/traps.test.ts`, `CURRICULUM.md`, `LEVELS.md`. The lead then moved pads on L12/13/17/18 so "d₁ + k" or "d₁ − 2" can never land on the answer.
6. **Scene/HUD/audio/menu** built to match the mockups; level 1 proven end to end with real keyboard input in the browser pane; then all 18 levels played start to finish by the keyboard autopilot in headless Chromium (17 via solver stands, the finale via a stealth route). 3 stars on each.
7. **Visual review** against the mockups with real captures: `docs/VISUAL_REVIEW.md`, `docs/captures/`. Fixed: overexposure, ruler orientation, vent hidden behind the wainscot, exit arch over the vent, held object hiding the target (now held lower right), menu RTL order, mobile HUD overlap, pause on failed pointer lock, hide camera inside the sarcophagus, guard searching nose-to-nose, keyboard turn speed.
8. **Independent playtest** (`PLAYTEST.md`): found 5 bypasses, 6 bugs, clarity items. Fixed: progressive worked-ratio card (no answer on the 1st miss), floor drops return to the pedestal, caught costs a star + hide arrow, guard sees while you stand still, touch climb button, visible roof hole + camera tilt, mobile map fit, toast leak, map selection after a win, Hebrew wording, L12 rename, L3 range wording, larger L8 labels. Not changed: ×3 constant wins 6 single-target levels (handoff's authored k values). Re-verified all 18 levels in the browser afterwards.

9. **AAA pass (user request: "make it look awesome… test each and every level… until it's perfect")**: audited all 18 levels from contact sheets; new room art (floors, pilasters, chandeliers, panels, cases, target spotlights, dust, grade), deep chasm, gloved brass lens, rooftop city/sun/string lights; cinematic intro, hall briefings with difficulty tiers, results screen with accuracy and badges, challenge rooms on the map (two templates per hall), success stamp, slow-mo, shockwave, per-hall music, sensitivity setting. Fixed z-fighting, and a global bug where sun shadows only existed within 5 m of each room's centre.
10. **Round-2 playtest** (`PLAYTEST2.md`): every level played with three wrong drops each; 21 findings; all but the ×3-constant one fixed (see the response table). Re-verified all 18 levels in the browser.

## State

- `npm test`: 64/64 pass. `npm run build`: OK. Dev server: port 5214.
- Measured 60 fps (headless GPU, 720p/1080p). Bundle: JS 875 KB (234 KB gz), models 5.9 MB.

## TODO / ideas

- More set dressing per hall (display cases, armour, vases) to reach the mockups' density.
- A darker, moodier Hall of Shadows.
- Real-device check (phone/tablet), a classroom test with students.
- Optional: code-split three.js examples to shrink the first load.
