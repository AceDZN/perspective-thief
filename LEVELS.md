# Levels — every heist, its math and its verified solution

All numbers come from `src/levels.ts` and the solver (`src/solver.ts` `plan()`); every solution below is played through the headless sim in `tests/levels.test.ts`, and every "wrong answer" row is played through the sim in `tests/traps.test.ts` (a real grab from the pad, a real standing spot in the room, a real drop).

**Lens rule:** grab at floor distance d₁ (the pad fixes it), drop at d₂ → every length × k = d₂ ÷ d₁. Perimeter × k, area × k², volume and weight × k³ (World 4 extension). Solve with d₂ = k · d₁.

**Window:** ±2 % of the exact k unless the target has real slack (levels 2 and 3). In metres that is about ±12 cm at 6 m. Eyeballing ±5 % / ±10 % fails on every ±2 % target (tested).

**Consequences:** `crash` (alarm + guard chase, hide to recover), `roofCrash` (taller than the ceiling, alarm + chase), `fallThrough`, `blownAway`, `pocketed`, `gapLeft`, `tooShort` (quiet failures, worked card), `jam` (right size, wrong orientation), `noFit` (not similar, never fits). After any failure the exhibit respawns on its pedestal at its level-start size and a worked card shows the k used vs the k needed.

## World 1 — אולם האורכים

### 1 · הרמה ראשונה
- **Situation:** a 3 m ledge with the exit; a niche between two pillars at its foot needs a 1.5 m step.
- **Given:** placard "קובייה עתיקה · מקצוע 0.5 מ'"; plate "גומחה למדרגה · גובה 1.5 מ'". Tutorial states the lens rule once.
- **Math:** 1.5 ÷ 0.5 = 3 → k = 3.
- **Grab d₁ = 2 m → drop d₂ = 6 m**, window k ∈ [2.94, 3.06] → d₂ ∈ [5.88, 6.12] m.
- **Wrong:** d₂ = 5 (k = d₂ − d₁ thinking) or 3 (step back as much as it grows) → too small → `fallThrough`; d₂ ≥ 6.13 → `crash`.

### 2 · מכווצים כדי להתגנב
- **Situation:** shrink the 3 m dinosaur crate into a floor vent where the raccoon waits.
- **Given:** "ארגז שלד דינוזאור · גובה 3 מ'"; "פתח אוורור · גובה 0.75 מ' · מרווח ±0.05 מ'".
- **Math:** 0.75 ÷ 3 = ¼ → k = 0.25; slack 0.70–0.80 m → k ∈ [0.233, 0.267].
- **Grab d₁ = 8 m → drop d₂ = 2 m**, window d₂ ∈ [1.867, 2.133] m (±6.7 %, so ±5 % passes here; ±10 % fails).
- **Wrong:** 1/k (k = 4 → 32 m, out of reach; anything past 2.13 m) → `crash`; closer than 1.87 m → `blownAway` by the vent fan.

### 3 · גשר על התהום
- **Situation:** a 3 m wide gap; the pillars on its two edges are 3.3 m apart (inside faces).
- **Given:** "קרש אלון · אורך 1.2 מ'"; "תהום · רוחב 3 מ' · בין העמודים 3.3 מ'".
- **Math:** length must be in [3.0, 3.3] → k ∈ [3 ÷ 1.2, 3.3 ÷ 1.2] = [2.5, 2.75].
- **Grab d₁ = 2 m → drop d₂ ∈ [5.0, 5.5] m** (solver aims at the middle, 5.25 m). ±5 % from the middle already fails (window is ±4.8 %).
- **Wrong:** < 5.0 m → `fallThrough`; > 5.5 m → `crash` into the pillars.

### 4 · מרחק לא עגול
- **Situation:** an empty plinth between two 0.9 m busts; its sensor wants a 0.9 m bust.
- **Given:** "פסל ראש משיש · גובה 0.6 מ'"; "כן ריק · חיישן גובה · גובה הפסל 0.9 מ'".
- **Math:** 0.9 ÷ 0.6 = 1.5.
- **Grab d₁ = 2.4 m → drop d₂ = 3.6 m**, window [3.528, 3.672] m.
- **Wrong:** 2.7 m (add the 0.3 m difference) → `pocketed` by the guard; 3.9 m (d₁ + k) → `crash`.

### 5 · פקק לדלת (transfer, hints name the comparison only)
- **Situation:** plug the guard's doorway with a statue so no gap is left; the hall ceiling is 3.5 m.
- **Given:** "פסל אלה · גובה 0.8 מ' · רוחב 0.3 מ'"; "דלת השומר · רוחב 1.2 מ' · גובה 3 מ'"; sign "גובה התקרה 3.5 מ'".
- **Math:** width ↔ width: 1.2 ÷ 0.3 = 4 → the statue becomes 3.2 m tall < 3.5 m ceiling, so it fits.
- **Grab d₁ = 1.5 m → drop d₂ = 6 m**, window [5.88, 6.12] m.
- **Wrong:** height ↔ doorway height (3 ÷ 0.8 = 3.75 → 5.625 m) → `gapLeft` (1.125 m wide); height ↔ ceiling (4.375) → `crash`.

## World 2 — אולם הצללים

### 6 · מודדים בצל
- **Situation:** reach the crown on top of a statue with a ladder. Moonlight casts parallel shadows (directional light, elevation atan(1.6 / 2) = 38.66°).
- **Given:** sign "בובה · גובה 1.6 מ'"; floor rulers read the mannequin's shadow (2 m) and the statue's (9 m); placard "סולם · גובה 1.8 מ'". The plate gives no height.
- **Math:** 1.6 / 2 = h / 9 → h = 7.2 m (Workbook's own example); 7.2 ÷ 1.8 = 4. Check: shadow = h × 2/1.6 → 9 m. ✓
- **Grab d₁ = 1.5 m → drop d₂ = 6 m**, window [5.88, 6.12] m.
- **Wrong:** ladder vs shadow (9 ÷ 1.8 = 5 → 7.5 m) → `crash`; inverted proportion (h = 11.25 → 9.375 m) → `roofCrash` (10 m hall); too short → `tooShort`.

### 7 · משולש הלייזר
- **Situation:** a laser from floor level grazes the top of a 1 m pedestal 2 m away and hits the wall 6 m away; a mirror's top edge must catch it.
- **Given:** sign "עמוד · גובה 1 מ'"; floor ruler 0–6 m along the beam; "מראה עתיקה · גובה 0.5 מ'".
- **Math:** common angle at the laser + right angles (ז.ז.): 1 / 2 = h / 6 → h = 3 m; 3 ÷ 0.5 = 6.
- **Grab d₁ = 1 m → drop d₂ = 6 m**, window [5.88, 6.12] m.
- **Wrong:** additive 1 + (6 − 2) = 5 m (k = 10, 10 m) → `crash`; short → `tooShort`.

### 8 · צלעות מתאימות
- **Situation:** a triangular sign must go into a triangular frame hole; the sign sits on its 40 cm side.
- **Given:** "שלט משולש · צלעות 30, 40, 50 ס"מ" (labels on the sides); "מסגרת · צלעות 60, 80, 100 ס"מ" (its 60 side on the bottom). R / rotate button turns the held sign (cyclic, no mirror).
- **Math:** 60 ÷ 30 = 80 ÷ 40 = 100 ÷ 50 = 2; rotate twice so 30 lies on the base, facing 60.
- **Grab d₁ = 1.5 m → drop d₂ = 3 m**, window [2.94, 3.06] m, orientation 0 (30 cm side down).
- **Wrong:** right k, not rotated or rotated once → `jam`; base-to-base 40 ↔ 60 (k = 1.5 → 2.25 m) → `fallThrough`; too big → `crash`.

### 9 · רמפה למרפסת
- **Situation:** a 1.5 m balcony; the floor in front of it is 6.5 m long.
- **Given:** "רמפה · בסיס 2 מ' · גובה 0.5 מ'"; "מרפסת · גובה 1.5 מ'"; sign "אורך האולם 6.5 מ'".
- **Math:** height ↔ height: 1.5 ÷ 0.5 = 3 → base 6 m < 6.5 m, so it fits.
- **Grab d₁ = 2 m → drop d₂ = 6 m**, window [5.88, 6.12] m. (Pad moved from 1.5 m to 2 m in review: with 1.5 m, d₁ + k = 4.5 = k · d₁, so the wrong additive rule won.)
- **Wrong:** base ↔ balcony height (k = 0.75 → 1.5 m) → `tooShort`; k = 3.5 → `crash`.

### 10 · משולש בתוך משולש (transfer, hints name the comparison only)
- **Situation:** a rope runs from the 6 m-high balcony edge down to the floor 8 m away; a vertical banner stands under it 2 m from the rope's foot, its top touching the rope. Reach the balcony railing with a climbing pole. No helper lines.
- **Given:** sign "באנר · גובה 1.5 מ'"; floor ruler from the rope's foot (0) past the banner (2) to the wall (8); "עמוד טיפוס · גובה 1.2 מ'". The balcony height is not written.
- **Math:** banner ∥ wall → △ small ∼ △ large (ז.ז.): 1.5 / 2 = h / 8 → h = 6 m; 6 ÷ 1.2 = 5.
- **Grab d₁ = 1 m → drop d₂ = 5 m**, window [4.9, 5.1] m.
- **Wrong:** banner-to-wall 6 instead of 8 (h = 4.5, k = 3.75) → `tooShort`; too big → `crash`.

## World 3 — אולם הבד והשטיח

### 11 · גדר לייזר
- **Given:** "בסיס ריבועי · צלע 1 מ'"; "לולאת לייזר · היקף 12 מ'" (a 3 × 3 m laser square).
- **Math:** perimeter 4 → 12: יחס היקפים = k = 3.
- **Grab d₁ = 2 m → drop d₂ = 6 m**, window [5.88, 6.12] m.
- **Wrong:** k = √3 (perimeter like area) → `gapLeft`; side vs perimeter (k = 12, out of reach) or anything too far → `crash`.

### 12 · מכסים את הצוהר
- **Situation:** black out the moon window with a painting of the same shape.
- **Given:** "ציור שמן · 0.6 × 0.4 מ'" (0.24 m²); "צוהר הירח · שטח 2.16 מ"ר · אותה צורה כמו הציור". Tutorial: lengths × k → area × k².
- **Math:** 2.16 ÷ 0.24 = 9 = k² → k = 3 (1.8 × 1.2 m).
- **Grab d₁ = 1.2 m → drop d₂ = 3.6 m**, window [3.528, 3.672] m. (Pad moved from 1.5 m so that d₁ + k ≠ k · d₁.)
- **Wrong:** k = 9 → 10.8 m (a real spot: the hall was lengthened to z = 9 for this) → a 3.6 m painting → `roofCrash` + alarm + guard; too small → `gapLeft`.

### 13 · שטיח על לוחית
- **Given:** "שטיח פרסי · 1 × 0.5 מ'" (0.5 m²); "לוחית לחץ · שטח 2 מ"ר · אותה צורה כמו השטיח" (2 × 1 m outline).
- **Math:** 2 ÷ 0.5 = 4 = k² → k = 2.
- **Grab d₁ = 1.5 m → drop d₂ = 3 m**, window [2.94, 3.06] m. (Pad moved from 2 m so that d₁ + k ≠ k · d₁.)
- **Wrong:** k = 4 → 6 m → `crash`; too small → `gapLeft`.

### 14 · שתי לוחיות (two targets, any order)
- **Given:** "אדנית ריבועית · צלע 1.5 מ'" (perimeter 6) and "לולאת לייזר · היקף 12 מ'"; "שטיחון ריבועי · 0.5 × 0.5 מ'" (0.25 m²) and "לוחית לחץ ריבועית · שטח 4 מ"ר".
- **Math:** loop 12 ÷ 6 = 2 → k = 2; plate 4 ÷ 0.25 = 16 = k² → k = 4.
- **Planter: d₁ = 1.5 → d₂ = 3 m** ([2.94, 3.06]); **mat: d₁ = 1.5 → d₂ = 6 m** ([5.88, 6.12]).
- **Wrong:** k = 16 for the mat (24 m, out of reach; the farthest real drop crashes); k = √2 for the loop → `gapLeft`.

### 15 · ויטראז׳ (transfer, hints name the comparison only)
- **Situation:** fill a house-shaped (pentagon) stained-glass frame. Two glass pieces on the table.
- **Given:** "זכוכית מחומשת · שטח 50 סמ"ר · צלע אנכית 4 ס"מ" (8 × 4 cm square body + 4.5 cm roof: 32 + 18 = 50 ✓); "זכוכית מלבנית · 10 × 5 ס"מ · שטח 50 סמ"ר"; "מסגרת ויטראז׳ · שטח 450 סמ"ר".
- **Math:** only the pentagon is similar to the frame; 450 ÷ 50 = 9 = k² → k = 3; the 4 cm edge becomes 12 cm.
- **Grab d₁ = 0.8 m → drop d₂ = 2.4 m**, window [2.352, 2.448] m.
- **Wrong:** the rectangle at any k → `noFit` (tested for 14 values of k); pentagon at k = 9 (7.2 m) → `crash`; too small → `fallThrough`.

## World 4 — הכספת (extension)

### 16 · משקל המעלית (הרחבה)
- **Given:** "קוביית זהב · מקצוע 20 ס"מ · משקל 2 ק"ג"; "מעלית · משקל נדרש 54 ק"ג". Tutorial: lengths × k → volume and weight × k³.
- **Math:** 54 ÷ 2 = 27 = k³ → k = 3 (a 60 cm cube).
- **Grab d₁ = 1.2 m → drop d₂ = 3.6 m**, window [3.528, 3.672] m.
- **Wrong:** k = √27 (6.24 m) or 9 (10.8 m) → `crash`; k = 27 needs 32.4 m, beyond the 16 m lens range (the farthest real drop crashes; a 5.4 m cube would also exceed the 4 m ceiling); too small → `tooShort`.

### 17 · מפתח חופף
- **Situation:** the lock takes only a key congruent to the original; you enlarged the key × 2 earlier.
- **Given:** "המפתח הגנוב · אורך עכשיו 24 ס"מ · (הגדלתם אותו פי 2)"; "מנעול הכספת · רק מפתח חופף למקורי · מקורי: 12 ס"מ".
- **Math:** 12 ÷ 24 = ½ → total ratio 2 × ½ = 1 (חפיפה).
- **Grab d₁ = 3 m → drop d₂ = 1.5 m**, window [1.47, 1.53] m. (Pad moved from 4 m so that "subtract 2" (d₁ − 2 = 1) no longer lands on the answer.)
- **Wrong:** × 2 again (6 m, 48 cm key) → `crash`; k = 1 (3 m, still 24 cm) → `crash`; d₁ − 2 = 1 m → `fallThrough`; too small → `fallThrough`.

## Finale

### 18 · היציאה הגדולה (no hints, patrolling guard, dawn rooftop)
Three targets unlock in order.
1. **Tower** — sun elevation atan(1.5 / 2) = 36.87°, shadows toward −x. Sign "אובליסק · גובה 1.5 מ'"; rulers read the obelisk's shadow (2 m) and the tower's (12 m, from its west face). 1.5 / 2 = h / 12 → h = 9 m; "סולם · גובה 1.5 מ'" → k = 6. **d₁ = 1 → d₂ = 6 m** ([5.88, 6.12]). Wrong: mismatched pair / short → `tooShort` or `crash`.
2. **Billboard in front of the camera** — "באנר · 0.5 × 0.4 מ'" (0.2 m²) → "שטח 1.8 מ"ר · אותה צורה כמו הבאנר": 1.8 ÷ 0.2 = 9 = k² → k = 3. **d₁ = 1.2 → d₂ = 3.6 m** ([3.528, 3.672]). Wrong: k = 9 (10.8 m) → `crash`.
3. **Laser loop** — "ארגז · בסיס ריבועי · צלע 0.5 מ'" (perimeter 2) → "היקף 5 מ'": k = 2.5. **d₁ = 2 → d₂ = 5 m** ([4.9, 5.1]). Wrong: k = √2.5 → `gapLeft`.

## Bypass checks (from `tests/traps.test.ts`)

- **Eyeballing:** ±5 % and ±10 % of the exact k fail on all 19 default-tolerance targets. Level 3 rejects ±5 % too; level 2's handoff slack (±0.05 m on 0.75 m) accepts ±5 %.
- **Constant multiples of the grab distance** (21 targets): × 1 wins 0; × 1.5 wins 1 (4); × 2 wins 3 (8, 13, 14-loop); × 2.5 wins 2 (3, 18-loop); × 3 wins 7 (1, 9, 11, 12, 15, 16, 18-billboard); × 4 wins 3 (5, 6, 14-plate). No constant wins a multi-target level; "drop at 2 × grab" wins whole levels 8 and 13 only.
- **d₂ = d₁ + k** fails on all 21 targets (after the pad moves on 12, 13, 17 and 18-billboard).

## Known weak spots (for the lead)

- **× 3 is over-represented:** "always drop at 3 × grab" clears 7 of 21 targets and whole levels 1, 9, 11, 12, 15, 16. Varying a few k values (e.g. loop 12 → 10 m in level 11, k = 2.5) would cut it.
- ~~Additive coincidences on 12, 13, 18-billboard~~ and ~~level 17's subtraction bypass~~: **fixed** by the lead (pads 12 → 1.2 m, 13 → 1.5 m, 18 banner → 1.2 m, 17 → 3 m); `tests/traps.test.ts` now allows no coincidence at all.
- **× 3 stays over-represented** on purpose: those k values are the handoff's authored numbers (levels 1, 9, 11, 12, 15, 16). The constant strategy still never wins a multi-target level, never the finale, and costs stars on every level it fails.
- **Level 16's k = 27** cannot be played (32.4 m > 16 m lens range in a 12 m vault), so the handoff's "k = 27 → roof crash" can't happen in game; the player who believes 27 walks to the wall and gets an ordinary crash.
