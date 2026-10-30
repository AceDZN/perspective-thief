# Perspective Thief — גנב הפרספקטיבה — build handoff

Read `../COMMON.md` first. Repo `/Users/acedzn/dev/AceDZN-exp/perspective-thief` → public `AceDZN/perspective-thief`, port 5214 (preview 4214).

## Promise

A first-person night heist in the surreal **Museum of Proportions**. You stole the curator's antique camera lens, and it does one impossible thing: grab an exhibit, carry it, and drop it somewhere else, and it keeps its *on-screen* size, so its **real size changes**. Drop it farther away and it's a giant; drop it closer and it's a toy. Shrink a dinosaur skeleton to sneak it through a vent, grow a teacup into a bridge, blow up a painting to blot out the skylight beam. Get the size wrong and it smashes a display case, the alarm whoops, and a rigged, wobbly night guard comes waddling after you (Untitled Goose Game energy) while you hide in a sarcophagus. The fun is the "wait, *that* works?" moment and getting away with it.

Map evidence: Superliminal × Untitled Goose Game (related, density 0.629) and Superliminal × Katamari Damacy REROLL (0.602) are the two emptiest related regions this round; Superliminal itself is at the 85.0 originality percentile. Superliminal × Viewfinder (0.669) is the same idea with less mischief.

## Curriculum (Workbook grade 8, chapter 6; grade 7 chapter 5 for volume units)

[similarity-concept](https://math.workbook.co.il/grade-8/chapter-6/similarity-concept), [similar-triangles-aa](https://math.workbook.co.il/grade-8/chapter-6/similar-triangles-aa), [corresponding-sides-similarity](https://math.workbook.co.il/grade-8/chapter-6/corresponding-sides-similarity), [missing-lengths-proportion](https://math.workbook.co.il/grade-8/chapter-6/missing-lengths-proportion), [perimeter-area-ratio](https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio), [similar-polygons](https://math.workbook.co.il/grade-8/chapter-6/similar-polygons), [real-life-similarity](https://math.workbook.co.il/grade-8/chapter-6/real-life-similarity), [congruence-vs-similarity](https://math.workbook.co.il/grade-8/chapter-6/congruence-vs-similarity); volume context [grade-7 box-volume](https://math.workbook.co.il/grade-7/chapter-5/box-volume). Snapshots in `/Users/acedzn/idea-plotter/reports/math-games-2026-10-30/curriculum/grade-8_chapter-6_*.md`.

Rules:
- **The lens rule (game physics, state it in-game):** an object grabbed at distance d₁ and dropped at distance d₂ is scaled by the **similarity ratio k = d₂ / d₁** in every length. The new object is similar to the old one (same angles, all sides × k). k = 1 means congruent (חופף).
- Perimeter scales by k, area by k² (core curriculum: the perimeter-area-ratio module). Volume and weight by k³ — the same module names this as the 3D continuation, so World 4 is an **extension**, labeled as such.
- AA: two triangles with two equal angles are similar; corresponding sides are in ratio k. Shadows from the same light at the same moment form similar triangles (the real-life-similarity module's 1.6 m person / 2 m shadow / tree example).
- Hebrew terms: יחס דמיון, משולשים דומים, צלעות מתאימות, דמיון לפי ז.ז., יחס היקפים, יחס שטחים, חפיפה מול דמיון, קנה מידה.

Misconceptions to catch: area scales by k (the classic "double the side, double the area"); computing k as d₂ − d₁ instead of d₂ ÷ d₁; k vs 1/k (drop *closer* to shrink); matching non-corresponding sides; thinking any two rectangles are similar.

## Loop and controls

- First-person (WASD/arrows + mouse look; touch: left stick + drag). Click/tap to grab, again to drop. Grabbing locks d₁, shown on the lens HUD; while carrying, the lens shows the **live distance d** (a laser rangefinder dot on the floor/wall). Floor rings every 0.5 m with numbers help.
- **No live result preview:** the HUD never shows k or the resulting size before the drop. Placards on exhibits give their real dimensions; targets (vents, ledges, gaps, skylights, scales) have their numbers on brass plates. You compute d₂ = k·d₁. The solver's tolerance is ±2 % of d₂ unless the target's physical slack allows more (compute it per level) — tight enough that eyeballing the visual size fails (prove it in tests).
- Drop result: correct → satisfying *thunk*, snaps into place with a gold outline. Too big → crashes, alarm, guard chase (hide spots nearby, recoverable, object respawns on its pedestal). Too small → it falls through the grate / gets blown away by a vent fan / the guard pockets it. A short worked explanation (the ratio you used vs the one needed) follows a failure.
- Hint (logged, costs a star): highlights which two numbers make the ratio and which kind it is (lengths / perimeter / area / weight), never the answer.
- Stars: no hints, no alarms, few re-grabs. Guards never time your thinking: they patrol only in the final heist, slowly, with hide spots, and freeze while you hold the lens up to "aim" (no reading-speed penalty).

## Levels (author exactly; tests prove each; 18 total)

**World 1 — Gallery of Lengths · אולם האורכים** (similarity-concept, corresponding-sides)
1. **First lift** — a 0.5 m cube; the ledge needs a 1.5 m step → k = 3. Grab pad at 2 m → drop at 6 m. Tutorial with the ratio explained once.
2. **Shrink to sneak** — a 3 m dinosaur crate must fit a 0.75 m vent slot (snug ±0.05 m) → k = ¼. Grab at 8 m → drop at 2 m.
3. **Bridge the gap** — a 1.2 m plank must span a 3 m gap between pillars that are 3.3 m apart → k ∈ [2.5, 2.75]. Grab at 2 m → drop between 5.0 and 5.5 m.
4. **Odd distance** — grab pad at 2.4 m, the pedestal needs a 1.5× taller bust → drop at 3.6 m.
5. **Transfer: the doorway plug** — a statue 0.8 m tall, 0.3 m wide must plug a 1.2 m-wide doorway → k = 4 → it becomes 3.2 m tall; the ceiling is 3.5 m, so it fits. Grab at 1.5 m → drop at 6 m. No hint marker on which dimension matters.

**World 2 — Hall of Shadows · אולם הצללים** (similar-triangles-aa, missing-lengths-proportion, real-life-similarity)
6. **Shadow measure** — a 1.6 m mannequin casts a 2 m shadow; the statue's shadow is 9 m → statue 7.2 m. You need a 7.2 m ladder from a 1.8 m stepladder → k = 4 (grab 1.5 m → drop 6 m).
7. **Laser triangle** — a laser from floor level passes a 1 m pedestal 2 m away and hits the wall 6 m away → 3 m high (AA). Scale a 0.5 m mirror to 3 m → k = 6 (grab 1 m → drop 6 m).
8. **Corresponding sides** — a triangular frame hole with sides 6, 8, 10; the stolen triangular sign is 3, 4, 5 but rotated so the 4 side looks like the base → k = 2 and side 4 must face side 8. A rotate key exists; wrong orientation jams.
9. **Ramp to the balcony** — a ramp 2 m long rising 0.5 m; the balcony is 1.5 m high → k = 3 → ramp length 6 m; the hall is 6.5 m long, so it fits.
10. **Transfer: nested triangles** — a rope from a balcony and a parallel banner form two similar triangles (small base 2 m, height 1.5 m; large base 8 m). Height needed = 6 m; scale a 1.2 m pole → k = 5. No glowing helper lines.

**World 3 — Canvas & Carpet · אולם הבד והשטיח** (perimeter-area-ratio, similar-polygons)
11. **Rope fence** — a laser fence loop must match a plinth's perimeter: plinth square 1 m (perimeter 4 m), target loop 12 m → k = 3.
12. **Cover the skylight** — a 0.6 × 0.4 m painting (0.24 m²) must blot out a 2.16 m² skylight beam of the same shape → area ratio 9 → **k = 3, not 9**. A k = 9 drop produces a giant painting that crashes through the roof (the misconception's funniest consequence).
13. **Pressure rug** — a rug must cover exactly 4× its area on a pressure plate → k = 2.
14. **Two plates** — one laser fence needs perimeter × 2, one floor plate needs area × 16 → two objects, k = 2 and k = 4.
15. **Transfer: stained glass** — a pentagon glass piece of 50 cm² must fill a 450 cm² frame → k = 3; its 4 cm edge becomes 12 cm. A rectangle piece that is *not* similar (different proportions) is also on the table and never fits.

**World 4 — The Vault · הכספת** (extension: volume k³; congruence-vs-similarity)
16. **Elevator scale** — a 20 cm gold cube weighs 2 kg; the elevator needs 54 kg → k³ = 27 → k = 3. Labeled "הרחבה".
17. **Congruent key** — the vault accepts only a key **congruent** to the original. Earlier you enlarged it × 2; restore k = ½ (drop at half the grab distance) so the total ratio is 1.
18. **Final heist: the Grand Exit (no hints)** — a slowly patrolling guard, hide spots, and three chained steps: measure a tower's height by shadows, scale a banner by area ratio to block a camera, scale a crate by perimeter to fit a laser loop. Changed look (rooftop sculpture garden at dawn), no ratio-type hints.

After the authored levels work: generated rooms per world from a solver with integer or simple-fraction k, verified unique within tolerance, and verified that a fixed "drop at 2× grab" strategy fails.

## 3D and art

Moonlit marble halls, velvet ropes, oversized surreal exhibits, long dramatic shadows (World 2 needs real shadow-casting lights), a dawn rooftop finale. Forced perspective is the star: implement it exactly (screen-space size preserved on drop, physics body rescaled to the authoritative k), and add a short "whoosh" scale animation. Procedural: floor distance rings, rangefinder dot, placards, target plates, laser fences, shadow lines (all exact). Tripo (search the library/assets first, then generate): a **rigged night guard** (Mixamo walk, run, look-around, scratch-head, faceplant), a **raccoon accomplice** who takes loot at the vent (rigged, cheer/steal), the **antique lens** hero prop (first-person view model), and exhibits with personality (dinosaur crate, bust, teacup, gold cube, stained glass).

## Acceptance

In the first 30 seconds: read the cube placard (0.5 m) and ledge plate (1.5 m), grab at 2 m, walk to the 6 m ring, drop, climb. Make a deliberate k = 9 skylight mistake and get the roof-crash + guard chase + worked ratio. All scaling, AA solutions and tolerances come from the pure module; tests cover all 18 levels, the k-vs-k² trap, the 1/k trap and the transfer levels.
