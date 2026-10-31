# Curriculum map — גנב הפרספקטיבה

Source of truth: Workbook, grade 8, chapter 6 (פרק 6: דמיון משולשים ודמיון מצולעים), and grade 7, chapter 5 (נפח התיבה) for the volume extension. Every module below exists on Workbook; the terms in the game are Workbook's terms.

| Module | URL | What the game takes from it |
|---|---|---|
| similarity-concept (מהו דמיון) | https://math.workbook.co.il/grade-8/chapter-6/similarity-concept | יחס דמיון k; every length is multiplied by the same k; k > 1 enlarges, 0 < k < 1 shrinks, k = 1 gives the same shape (חפיפה); direction matters (3 vs ⅓); a rectangle 4×6 is not similar to 4×9 |
| corresponding-sides-similarity (צלעות מתאימות ויחס דמיון) | https://math.workbook.co.il/grade-8/chapter-6/corresponding-sides-similarity | ratios only between צלעות מתאימות, all in the same direction; a rotated drawing does not change the correspondence |
| similar-triangles-aa (דמיון משולשים לפי זוויות) | https://math.workbook.co.il/grade-8/chapter-6/similar-triangles-aa | משפט ז.ז.; the "triangle inside a triangle" (קו מקביל לצלע) configuration; right triangles with a common acute angle; shadows at the same hour |
| missing-lengths-proportion (מציאת אורכים חסרים) | https://math.workbook.co.il/grade-8/chapter-6/missing-lengths-proportion | build the proportion from corresponding sides, then solve; sanity check (enlargement → bigger answer) |
| real-life-similarity (שימושים בדמיון) | https://math.workbook.co.il/grade-8/chapter-6/real-life-similarity | indirect measurement: the 1.6 m person / 2 m shadow / 9 m tree shadow → 7.2 m example; height ↔ height, shadow ↔ shadow; קנה מידה |
| perimeter-area-ratio (יחס היקפים ויחס שטחים) | https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio | יחס היקפים = k, יחס שטחים = k²; given an area ratio, take the square root; "volume would get exponent 3" (named by the module as the 3D continuation — the basis of World 4) |
| similar-polygons (דמיון מצולעים) | https://math.workbook.co.il/grade-8/chapter-6/similar-polygons | polygons need equal angles **and** proportional sides; not all rectangles are similar; equal area does not mean similar (square 4×4 vs rectangle 2×8) |
| congruence-vs-similarity (חפיפה מול דמיון) | https://math.workbook.co.il/grade-8/chapter-6/congruence-vs-similarity | חפיפה is similarity with k = 1; every congruence is a similarity, not the reverse |
| grade 7 box-volume (נפח התיבה) | https://math.workbook.co.il/grade-7/chapter-5/box-volume | V = a³ for a cube (מקצוע); enlarging every edge × k multiplies the volume × k³ (×2 → ×8, ×3 → ×27) |

**The lens rule (stated in level 1):** an exhibit grabbed at floor distance d₁ and dropped at d₂ is scaled by k = d₂ ÷ d₁ in every length. The HUD never shows k or the resulting size; the player reads placards and plates and computes d₂ = k · d₁. Tolerance ±2 % of k unless the target has real physical slack (levels 2 and 3). `tests/traps.test.ts` proves that ±5 % and ±10 % fail everywhere else.

## World 1 — אולם האורכים (lengths)

| # | Level | Module(s) | Skill practised | Misconception checked | How the consequence exposes it |
|---|---|---|---|---|---|
| 1 | הרמה ראשונה | [similarity-concept](https://math.workbook.co.il/grade-8/chapter-6/similarity-concept) | k as the quotient of two corresponding lengths (0.5 → 1.5, k = 3); d₂ = k·d₁ | k = d₂ − d₁ (drop at 2 + 3 = 5 m); "move as many metres as it grows" (drop at 3 m) | k = 2.5 or 1.5: the cube is too small for the niche and falls through; the worked card shows ⟦k = 5 ÷ 2 = 2.5⟧ vs ⟦k = 3⟧ |
| 2 | מכווצים כדי להתגנב | [similarity-concept](https://math.workbook.co.il/grade-8/chapter-6/similarity-concept) | הקטנה: 0 < k < 1 (3 → 0.75, k = ¼), drop *closer* | k vs 1/k: computing 3 ÷ 0.75 = 4 and stepping back to "shrink" | anything farther than 2.13 m makes the crate bigger: it smashes the vent, alarm + guard; k = 4 (32 m) is not even reachable |
| 3 | גשר על התהום | [similarity-concept](https://math.workbook.co.il/grade-8/chapter-6/similarity-concept), [missing-lengths-proportion](https://math.workbook.co.il/grade-8/chapter-6/missing-lengths-proportion) | two length limits → a range of k, [2.5, 2.75] | looking for one magic k; ignoring one of the two limits | shorter than 3 m → falls into the gap; longer than 3.3 m → wedges into the pillars and crashes |
| 4 | מרחק לא עגול | [corresponding-sides-similarity](https://math.workbook.co.il/grade-8/chapter-6/corresponding-sides-similarity), [missing-lengths-proportion](https://math.workbook.co.il/grade-8/chapter-6/missing-lengths-proportion) | non-integer k (1.5) with a non-round grab distance (2.4 m) | additive thinking: the bust grows by 0.3 m, so step back 0.3 m (2.7 m) | k = 1.125: the bust is too small, the guard pops in and pockets it |
| 5 | פקק לדלת (transfer) | [corresponding-sides-similarity](https://math.workbook.co.il/grade-8/chapter-6/corresponding-sides-similarity), [similarity-concept](https://math.workbook.co.il/grade-8/chapter-6/similarity-concept) | choose the corresponding dimension (width ↔ width, 0.3 → 1.2, k = 4), then check the other one (3.2 m < 3.5 m ceiling) | matching the statue's height to the doorway's height (k = 3.75) | the statue is 1.125 m wide: a gap is left and the guard squeezes through; matching to the ceiling (k = 4.375) crashes |

## World 2 — אולם הצללים (AA, indirect measurement)

| # | Level | Module(s) | Skill practised | Misconception checked | How the consequence exposes it |
|---|---|---|---|---|---|
| 6 | מודדים בצל | [real-life-similarity](https://math.workbook.co.il/grade-8/chapter-6/real-life-similarity), [similar-triangles-aa](https://math.workbook.co.il/grade-8/chapter-6/similar-triangles-aa), [missing-lengths-proportion](https://math.workbook.co.il/grade-8/chapter-6/missing-lengths-proportion) | Workbook's own example: 1.6 m / 2 m shadow, statue shadow 9 m → 7.2 m; then a length ratio for the 1.8 m ladder (k = 4) | mixing a height with a shadow (ladder vs the 9 m shadow, k = 5); inverting the proportion (11.25 m) | k = 5: a 9 m ladder crashes into the statue; the inverted proportion goes through the 10 m roof |
| 7 | משולש הלייזר | [similar-triangles-aa](https://math.workbook.co.il/grade-8/chapter-6/similar-triangles-aa), [missing-lengths-proportion](https://math.workbook.co.il/grade-8/chapter-6/missing-lengths-proportion) | two right triangles with a common acute angle at the laser: 1/2 = h/6 → 3 m; mirror 0.5 → 3 (k = 6) | adding instead of multiplying: 1 + (6 − 2) = 5 m | a 5 m mirror (k = 10) smashes the wall; a short mirror misses the beam |
| 8 | צלעות מתאימות | [corresponding-sides-similarity](https://math.workbook.co.il/grade-8/chapter-6/corresponding-sides-similarity), [similar-triangles-aa](https://math.workbook.co.il/grade-8/chapter-6/similar-triangles-aa) | 30-40-50 sign into a 60-80-100 frame: k = 2, and rotate so each side meets its corresponding side | matching by position in the drawing (the 40 side "looks like the base" → 40 ↔ 60, k = 1.5) | k = 1.5 → the sign falls through; the right k in the wrong orientation jams in the frame and drops out (`jam`) |
| 9 | רמפה למרפסת | [similar-triangles-aa](https://math.workbook.co.il/grade-8/chapter-6/similar-triangles-aa), [corresponding-sides-similarity](https://math.workbook.co.il/grade-8/chapter-6/corresponding-sides-similarity) | similar right triangle: height ↔ height (0.5 → 1.75, k = 3.5), then check the base (7 m < 7.5 m hall; the 1.75 m balcony is too high to climb) | matching the ramp's base to the balcony height (k = 0.75) | too short a ramp does not reach the balcony (`tooShort`); too big a ramp overshoots and crashes (from k = 3.75 on it would not even fit in the 7.5 m hall) |
| 10 | משולש בתוך משולש (transfer) | [similar-triangles-aa](https://math.workbook.co.il/grade-8/chapter-6/similar-triangles-aa), [missing-lengths-proportion](https://math.workbook.co.il/grade-8/chapter-6/missing-lengths-proportion), [real-life-similarity](https://math.workbook.co.il/grade-8/chapter-6/real-life-similarity) | Workbook's "קו מקביל לצלע" configuration with no helper lines: banner 1.5 m at base 2, whole base 8 → 6 m; pole 1.2 → 6 (k = 5) | using the banner-to-wall part (6 m) instead of the whole base (8 m) → 4.5 m | k = 3.75: the pole stops short of the railing (`tooShort`) |

## World 3 — אולם הבד והשטיח (perimeter and area)

| # | Level | Module(s) | Skill practised | Misconception checked | How the consequence exposes it |
|---|---|---|---|---|---|
| 11 | גדר לייזר | [perimeter-area-ratio](https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio), [similar-polygons](https://math.workbook.co.il/grade-8/chapter-6/similar-polygons) | יחס היקפים = k (square 1 m, perimeter 4 → 14, k = 3.5) | comparing a side with a perimeter (1 vs 14); treating perimeter like area (k = √3.5) | too small leaves a gap in the laser loop; too big smashes through the beams |
| 12 | מכסים את חלון הירח | [perimeter-area-ratio](https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio), [similar-polygons](https://math.workbook.co.il/grade-8/chapter-6/similar-polygons) | יחס שטחים = k² (0.24 → 2.16, ratio 9, k = 3) | the classic "area ratio = k" (k = 9) | k = 9 makes a 3.6 m painting that crashes through the roof (`roofCrash`) — the headline mistake, physically reachable at 13.5 m |
| 13 | שטיח על לוחית | [perimeter-area-ratio](https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio) | area ratio 4 → k = 2 | k = 4 ("double the side, double the area" run backwards) | the rug comes out 4 × 2 m and crashes into the display |
| 14 | שתי לוחיות | [perimeter-area-ratio](https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio), [similar-polygons](https://math.workbook.co.il/grade-8/chapter-6/similar-polygons) | the same room asks both: perimeter × 2 → k = 2; area × 16 → k = 4 | one rule for both (k = 16 for the plate, or √2 for the loop) | k = 16 is out of reach and anything far crashes; √2 leaves a gap in the loop |
| 15 | ויטראז׳ (transfer) | [similar-polygons](https://math.workbook.co.il/grade-8/chapter-6/similar-polygons), [perimeter-area-ratio](https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio) | choose the similar piece (house pentagon), then area ratio 16 → k = 4; its 4 cm edge becomes 16 cm | "same area, so it fits" (the 10 × 5 rectangle, also 50 cm² — Workbook's square-vs-rectangle-with-equal-area point); k = 9 | the rectangle never fits for any k (`noFit`); the pentagon at k = 9 crashes |

## World 4 — הכספת (extension: volume k³; congruence)

World 4's volume level is an **extension (הרחבה)**: the perimeter-area-ratio module names volume and the exponent 3 as the 3D continuation of the pattern ("זה לא נושא הפרק"), and the grade 7 box-volume module teaches V = a³ and ×k → ×k³. The level and the world subtitle say "הרחבה".

| # | Level | Module(s) | Skill practised | Misconception checked | How the consequence exposes it |
|---|---|---|---|---|---|
| 16 | משקל המעלית (**extension**) | [perimeter-area-ratio](https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio) (3D continuation), [grade 7 box-volume](https://math.workbook.co.il/grade-7/chapter-5/box-volume) | weight follows volume: 2 → 16 kg, k³ = 8 → k = 2 | k = 8 (weight like length), k = √8 (weight like area), k = 4 | √8, 4 and 8 make a cube that crushes the elevator (crash + alarm) |
| 17 | מפתח חופף | [congruence-vs-similarity](https://math.workbook.co.il/grade-8/chapter-6/congruence-vs-similarity), [similarity-concept](https://math.workbook.co.il/grade-8/chapter-6/similarity-concept) | חפיפה = דמיון ביחס 1; undo an enlargement × 2 with k = ½ (total 2 × ½ = 1) | undoing × 2 with another × 2 (drop at 8 m); thinking "already the same shape, so k = 1 is fine" (similar ≠ congruent) | a 48 cm key or the 24 cm key does not fit the lock: crash / falls out |

## Finale — היציאה הגדולה (final transfer, no hints)

| # | Level | Module(s) | Skill practised | Misconception checked | How the consequence exposes it |
|---|---|---|---|---|---|
| 18 | היציאה הגדולה | [real-life-similarity](https://math.workbook.co.il/grade-8/chapter-6/real-life-similarity), [similar-triangles-aa](https://math.workbook.co.il/grade-8/chapter-6/similar-triangles-aa), [perimeter-area-ratio](https://math.workbook.co.il/grade-8/chapter-6/perimeter-area-ratio) | changed situation (dawn rooftop, different sun angle), three chained steps with no hints: tower by shadows (1.5/2 = h/12 → 9 m, ladder k = 6); banner by area ratio (0.2 → 1.8, k = 3); crate by perimeter (2 → 5, k = 2.5) | all of them: k vs k² (k = 9 on the banner), perimeter as area (√2.5), mismatched sides in the shadow step | every wrong step fails with its own consequence while a guard patrols; the steps unlock in order (`requires`) |

## Known curriculum caveats

- Workbook's corresponding-sides module warns that with a *declared* correspondence (△ABC ∼ △DEF) "short-to-short" is not a valid rule; level 8 has no letters, so matching by length is the only correspondence available (as in the similarity-concept module's 3-4-5 vs 10-8-6 example). The level hint words it as "צלע מתאימה לצלע מתאימה".
- World 2 relies on parallel light. The sim models it with a directional light (`sun` elevation); the scene must use a directional light too, not a point lamp, or the shadow triangles stop being similar. The level-6 tutorial says "moonlight arrives in parallel rays".
- The "d₂ − d₁" misconception is caught in level 1 and on 18 of 21 targets, but not everywhere (see LEVELS.md, "Known weak spots").
