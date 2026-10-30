# Assets — גנב הפרספקטיבה (Perspective Thief)

All 3D models were made in **Tripo Studio** (https://studio.tripo3d.ai/workspace/generate/) in the user's Chrome on 2026-10-30: **HD Model**, AI model **"H3.1 – Best Quality"**, text-to-3D, Geometry & Texture: Texture on, 2K, Remove Lighting on, PBR on, topology **Triangle**, polycount **20000**. Raw exports are 18–20k triangles, 3.0–5.4 MB.

Everything that carries the math — cubes, planks, frames, rugs, plates, placards, floor measuring strips, rangefinder dot, lasers, rings, shadow lines — is **procedural Three.js** and reflects the rules module exactly. Generated meshes are never colliders or math surfaces. Their real size in the game is whatever the level data says; the GLB is only scaled to fit.

## Budget and credits

- **8 of 8** allowed generations, **3 of 3** rig/animation jobs (2 auto-rigs + 1 AI animation). Preset animation retargets showed no cost on the button and did not move the balance when I watched it (3370 before and after adding `run`). No credits were bought, no plan was upgraded, no API or token was used. "Free Retry" was not used.
- Costs shown on the buttons: generation **30** each (8 × 30 = 240), Auto Rig **20** each (2 × 20 = 40), AI animation **20** (1). **Total for this game: 300 credits.**
- Header balance: **4040** when I first opened Tripo, **3720** right before my first generation, **3200** after my last task. The account is shared with other crews generating at the same time (Slope Sled, Pie Duel and others), so the 520-credit drop over that window is not all mine; my own tasks account for 300. Per-task readings (before → after, read within ~4 s of each click): guard 3720 → 3690, raccoon 3690 → 3660, lens 3660 → 3630, dino crate 3590 → 3560, bust 3560 → 3530, sarcophagus 3530 → 3500, statue 3500 → 3470, guard rig 3450 → 3430, raccoon rig 3430 → 3410, guard AI animation 3280 → 3260, lens-hand 3230 → 3200.

## Search before generating

- **User's own assets** (https://studio.tripo3d.ai/assets, Rigged filter, ~48 rigged models listed):
  - *police officer* (task `25a002f5-6366-46db-8123-74da1c34b142`, rigged, clips frightened/sit/walk/look_around/run/idle/angry_01) — a close match for the guard, but it is already the guard in **Short Circuit** (`short-circuit/ASSETS.md`). Not reused so the two games don't share a villain; it stays a fallback if `guard.glb` ever fails.
  - *raccoon mascot* (task `3bc68067-2954-4d62-b535-93de36cb34ca`, rigged) — it is **Rule Rascals'** mascot (yellow bandana, utility belt). Not reused for the same reason, and it has no backpack.
- **Community gallery** (featured, keyword searches "sarcophagus", "marble bust", "dinosaur skeleton"): found lying sarcophagus chests and mummy dioramas, realistic/edgy character busts, and loose dinosaur skeletons. None fit the stylized Pixar-ish museum look or the gameplay needs (an upright sarcophagus to hide in; a crated dinosaur), and the model pages showed **no licence or reuse terms** (example checked: https://studio.tripo3d.ai/3d-model/ornate-egyptian-sarcophagus-with-hieroglyphic-reliefs-teal-blue-and-g-427d5335-8e73-4252-a557-19dcf5a6ee85). Nothing was downloaded from the community gallery.

Everything in `public/models/` is therefore **generated for this game** in the user's own account.

## Models (`public/models/`)

Tripo normalises each model to a max dimension of 1.0 with the base at y = 0, centred on x/z. Bounds below were measured in three.js 0.186 (`Box3.setFromObject(obj, true)`, skinned meshes in bind/T-pose) on the optimized files. One `OPAQUE` PBR material each (base colour + metallic-roughness + normal, WebP 1024²). Task pages: `https://studio.tripo3d.ai/workspace/generate/<task id>`.

| File | Task id | Triangles | Size | Bounds x × y × z | Front / forward | Notes |
|---|---|---|---|---|---|---|
| `guard.glb` | `bc696852-2c5a-4c6d-b19b-c560364d2616` | 18,982 | 1,298,716 B | 1.000 × 0.958 × 0.497 (T-pose, arms set the width) | faces **+Z** | rigged, 8 clips, see below |
| `raccoon.glb` | `71ba0126-5c48-4a64-8523-1873a716813d` | 18,953 | 1,221,120 B | 0.956 × 1.000 × 0.762 (T-pose; tail adds depth behind) | faces **+Z** | rigged, 5 clips, see below |
| `lens.glb` | `daf7aa58-4948-4924-8703-56f228d676ef` | 18,199 | 318,312 B | 1.000 × 0.558 × 0.604 | barrel along **X**, glass front at **+X**, leather grip at −X | lens alone |
| `lens-hand.glb` | `62d280b7-4d84-4b07-8287-abafe0e84588` | 19,818 | 303,428 B | 0.933 × 1.000 × 0.894 | glass faces **+Z**; black glove below, wrist stump at the bottom-back | view-model variant, see notes |
| `dino-crate.glb` | `15c3943c-6852-477f-acfb-fc8bc5555195` | 12,912 | 259,732 B | 0.769 × 0.985 × 1.000 | front **+Z** | crate body is not a cube: deeper (z) than wide (x); the T-rex skull sticks ~0.25 above the lid |
| `bust.glb` | `e56f3e64-cf88-4a83-8225-351a06524490` | 11,734 | 241,104 B | 0.726 × 1.000 × 0.501 | faces **+Z** | white marble philosopher on a dark round socle |
| `sarcophagus.glb` | `d9242e39-afe8-482d-9e15-bcbd4e0ea026` | 11,973 | 360,348 B | 0.317 × 0.999 × 0.342 | faces **+Z** | upright gold/lapis pharaoh coffin on a stone foot; **one closed mesh, the lid does not open** |
| `statue.glb` | `936f9cf0-bc56-4279-bac3-5a79288abf17` | 11,978 | 224,724 B | 0.336 × 1.000 × 0.331 | faces **+Z** | tall narrow goddess on a square plinth (~3× taller than wide) |

### Night guard — `guard.glb`

Prompt (T-Pose toggle ON):

> A round chubby cartoon museum night watchman, single full-body humanoid character in a neutral T-pose, stylized Pixar / Untitled Goose Game style. Big round belly, short stubby legs, small hands, rosy cheeks, sleepy droopy eyes, a HUGE bushy grey walrus mustache, an OVERSIZED navy peaked security cap with a shiny brass badge and a black visor that slightly droops over his eyes. Navy blue watchman uniform jacket with two rows of brass buttons and a gold name tag, a brown belt with a ring of big old museum keys, navy trousers, chunky black boots. A small brass-and-black flashlight clipped to his belt. Clean separated limbs and fingers, arms straight out to the sides, legs slightly apart, facing forward, hand-painted stylized texture, saturated navy and brass colours. No base, no scenery, no text, no weapon, suitable for humanoid auto-rig and walk run animation.

Rig: Tripo Auto Rig, **Humanoid / Mixamo** preset. One skinned mesh, one skin, **65 joints**, Mixamo names, root joint **`mixamorig:Hips`**. Feet at y = 0 in bind pose. Exported GLB with skeleton, 8 animations, "Animation stay in Place" ON.

| Clip (exact name) | Duration | Use | Hips x/z (first = last?) |
|---|---|---|---|
| `idle` | 15.33 s | standing / loop | constant (0.002, −0.018) |
| `walk` | 2.33 s | patrol waddle, loop | constant |
| `run` | 1.25 s | chase, loop | **constant but offset: z = +0.254** (see quirk) |
| `look_around` | 15.58 s | searching after an alarm | constant |
| `scratch_head` | 4.96 s | confused / lost you (Tripo **AI animation**, see below) | constant |
| `frustrated_02` | 10.79 s | preset alternative with hand on head; long, play a slice | constant |
| `frightened` | 3.38 s | startled "!" reaction to the crash | constant |
| `fall` | 3.00 s | trips and ends **lying on the floor** (faceplant/fall; hips drop from y 0.245 to 0.089) | constant x/z |

- `scratch_head` was made with Tripo's AI Animation (5 s), prompt: *"A chubby night watchman stands in place, stops, tilts his head and slowly scratches the top of his head under his cap with his right hand, looking confused and puzzled, then lowers his arm back to his side."* Tripo names AI clips after the prompt; I renamed the clip to `scratch_head` in the optimized file (glTF-Transform, name only, no data change).
- **Quirk:** `run` holds the Hips half a body-depth forward (z ≈ +0.254 in rig units vs −0.018 in the other clips), the same Tripo `run` quirk sign-runner found. Strip the Hips x/z translation track (keep y) in code, or offset the model while `run` plays, or crossfades will slide.
- Hips translation values are in the rig's own units (the armature node carries Tripo's scale); compare them with each other, not with world metres.
- The flashlight is a small prop on his belt, not in his hand. Add the beam (and a procedural hand-held flashlight if wanted) in code.

### Raccoon accomplice — `raccoon.glb`

Prompt (T-Pose toggle ON):

> A cheeky cartoon raccoon thief accomplice, single full-body biped humanoid character standing upright in a neutral T-pose, stylized Pixar / Untitled Goose Game style. Grey-brown fluffy fur, a bold black bandit eye mask marking, bright mischievous eyes, big round ears, a small black knit beanie hat, a tiny worn brown leather backpack with brass buckles strapped on its back, small black fingerless gloves, a fluffy ringed striped tail curling clear of the legs, bare paws. Chubby small body, big head, clean separated arms, legs and fingers, arms straight out to the sides, legs slightly apart, facing forward, hand-painted stylized texture. No scarf, no base, no scenery, no text, no weapon, suitable for humanoid auto-rig and full-body animation.

Result: black beanie, bandit mask, orange-brown backpack, black gloves, ringed tail. Rig: Auto Rig **Humanoid / Mixamo**, **65 joints**, root **`mixamorig:Hips`**, feet at y = 0. Exported with 5 preset clips, "in place" ON.

| Clip (exact name) | Duration | Use | Hips |
|---|---|---|---|
| `idle` | 15.33 s | waiting at the vent, loop | constant x/z (0.014, 0.061) |
| `greet_01` | 3.50 s | waves at the player from the vent | constant |
| `cheer` | 12.08 s | level win (long; play the first 2–3 s or loop) | constant |
| `lift_heavy` | 19.50 s | **grab/steal** stand-in: starts crouched (hips y 0.071) and ends standing (0.244); play the crouch-and-lift part | constant x/z |
| `run` | 1.25 s | scurry off with the loot | **z offset +0.348** (same quirk as the guard's `run`) |

- No dedicated "steal/grab" preset exists; `lift_heavy` is the closest. The AI-animation budget went to the guard's `scratch_head`.
- The tail has no tail bones (Mixamo humanoid rig); it follows the hips.

### Antique brass lens — `lens.glb` and `lens-hand.glb`

`lens.glb` prompt:

> An antique Victorian brass camera lens as a hand-held game prop, a single chunky cylindrical lens barrel lying horizontally, polished warm brass with engraved ring grooves, two knurled focus rings and a small aperture lever, a dark stitched leather grip band wrapped around the middle, a large clear glass front element with a faint blue-violet coated reflection, a slightly narrower rear mount end. Stylized but detailed, Pixar-like proportions, slightly oversized and chunky, hand-painted PBR texture, clean silhouette. Single object only, no camera body, no hand, no stand, no base, no text.

Result: lumpy but readable brass barrel, leather band, pale glass disc at +X. The brass reads quite yellow; tint or lower roughness in code. Glass is opaque: add an emissive/transparent disc in code for the "glowing glass" HUD look.

`lens-hand.glb` (made after the lead asked for a view model matching mockups 01/02) prompt:

> First-person game view model: a right hand in a black leather glove holding an antique brass camera lens, hand and lens only, no arm beyond the wrist. The gloved hand wraps around a chunky cylindrical polished brass lens barrel with engraved rings, two knurled focus rings, a dark stitched leather grip band, and a large glowing glass front element with a faint blue-violet coated reflection pointing forward away from the wrist. Thumb on top, fingers curled underneath. Stylized Pixar-like proportions, rich warm brass and black leather, hand-painted PBR texture, clean silhouette. Single object, no body, no sleeve, no base, no text.

Result: Tripo added a small brass **camera body** behind the lens (it reads as an antique brass camera with a big lens), held from below by a black glove, with a violet glass front. **Quirks:** the glass faces **+Z** (rotate 180° about Y so it points away from a camera looking down −Z); a short **skin-coloured wrist stump** sticks out of the glove at the bottom-back — keep it below/behind the screen edge or cover it with a procedural sleeve.

### Exhibits

- `dino-crate.glb` — *"A museum shipping crate holding a cartoon dinosaur skeleton: a sturdy cube-shaped wooden crate made of chunky pine planks with dark iron corner brackets and rivets, gaps between the slats, the top open with a few loose boards, and a cute stylized T-rex skeleton made of ivory bones packed inside so its big toothy skull pokes out over the top edge, its ribcage visible through the slats and the bony tail sticking out through a gap in one side. A stencilled fragile glass icon on the front. Stylized Pixar-like proportions, chunky, warm wood and bone colours, hand-painted PBR texture, game prop. Single object, no base, no ground, no text letters."* Result: closed-looking crate with the skull on top; no ribs or tail are visible through the slats from the front (I did not inspect the back). Not a cube — if a level calls it a cube with side *s*, scale it non-uniformly or use the procedural cube collider and treat the mesh as dressing.
- `bust.glb` — *"A classical white marble museum bust of a Greek philosopher with a curly beard, curly hair and a calm proud expression, head and shoulders with a draped toga, sitting on a short round dark-veined marble socle base. Polished creamy white Carrara marble with subtle grey veins and slight wear, stylized Pixar-like chunky proportions with a slightly oversized head, clean silhouette, hand-painted PBR texture, game prop. Single object, no plinth column, no text, no scenery."*
- `sarcophagus.glb` — *"An ancient Egyptian pharaoh sarcophagus standing UPRIGHT like a tall cabinet, human-shaped anthropoid coffin with a golden pharaoh face mask, blue-and-gold striped nemes headdress, arms crossed over the chest holding crook and flail, turquoise, lapis blue and gold painted bands with hieroglyph patterns down the body, a closed lid with a visible seam line around its edge, standing on a low flat rectangular stone foot. Big enough for a person to hide inside. Stylized Pixar-like chunky proportions, rich saturated gold and blue, hand-painted PBR texture, museum exhibit game prop. Single object, front-facing, no mummy, no scenery, no text letters."* One mesh: for "hide inside", fade/zoom the camera into it, or swing the whole mesh as a door around a hinge at one side edge.
- `statue.glb` — *"A tall narrow classical white marble statue of a Greek goddess standing upright in a long flowing pleated robe, arms close to the body holding a small laurel wreath at her chest, calm face, hair in a bun, standing on a square marble plinth. Tall slender silhouette roughly four times taller than wide, compact with no outstretched limbs. Polished creamy white marble with subtle grey veins, stylized Pixar-like proportions, clean silhouette, hand-painted PBR texture, museum exhibit game prop. Single object, front-facing, no scenery, no text."* Came out ~3× taller than wide (0.336 × 1.0), good for the doorway plug and the shadow statue.

Not made (budget spent): oversized teacup, stepladder, gold cube (procedural anyway), stained glass.

## Processing

`scripts/optimize-model.mjs` (already in the repo): weld → meshoptimizer `simplifySloppy` per primitive → prune/dedup → WebP textures → meshopt compression; skins, joints and animation channels pass through. Files need `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)` (`three/examples/jsm/libs/meshopt_decoder.module.js`); they use `EXT_meshopt_compression` and `EXT_texture_webp`.

```
node scripts/optimize-model.mjs assets-src/tripo/<file>.glb public/models/<name>.glb <targetTris> [textureSize] [maxError]
```

Used: guard, raccoon, lens, lens-hand **20000 / 1024** (no simplification; skinned meshes untouched); dino-crate, bust, sarcophagus, statue **12000 / 1024** (simplified 18–19k → 11.7–12.9k, simplifier error 0.006–0.014 of the mesh extent). After optimizing the guard, the AI clip was renamed to `scratch_head` with a one-off glTF-Transform script (name only).

## Verification

- `assets-src/verify/stats.mjs` (gitignored) read every optimized file with glTF-Transform: triangle counts, joints, root joint, clip durations and Hips root-motion ranges above come from it.
- `assets-src/verify/render.mjs` (gitignored) loaded all eight optimized files in **headless Chromium (Playwright 1.64) with three.js 0.186.1 GLTFLoader + MeshoptDecoder**, served from disk through `page.route` (no server), measured bounds, listed clips, and rendered a contact sheet `assets-src/model-render-check.png` (SHA-256 `5c7ca8bd4101b50fb2cc0e4683189f6b5abd361e17a5aae131b109fdff02f1c6`): all models in rest pose, plus the guard at 40 % of `walk`, `run`, `fall`, `scratch_head` and the raccoon at 40 % of `lift_heavy`, `run`, `greet_01`, `cheer`. **No load errors, no console errors**, skinning deforms correctly in every sampled clip, and all characters and exhibits face +Z.
- Not verified: close-up holes on the simplified props, the clips at frames other than 40 %, how the models look under the game's own lights, and performance in the real scene.

## Originals (gitignored `assets-src/`)

SHA-256 of the Tripo exports (`assets-src/tripo/`):

| File | Bytes | SHA-256 |
|---|---|---|
| `perspective-thief-guard-8anims.glb` | 4,394,756 | `7993f8e308debe1e0f300cf3613528a6dc3fb428c3902a7ef4163e5208436fb0` |
| `perspective-thief-raccoon-5anims.glb` | 5,448,112 | `39b381ec61c1a4a7646b15a27bd7d2b6642ebfa57cf4f4188ff68fe91cd33569` |
| `perspective-thief-lens.glb` | 3,056,124 | `078f10bd68849975ebbd486e29d40c829f3dc104a5eafe18152b1884603b6dce` |
| `perspective-thief-lens-hand.glb` | 2,963,616 | `a2a7f3c23a86a16227e772e36c36ac3487b114acf82a925fb21be99b345656c1` |
| `perspective-thief-dino-crate.glb` | 3,380,472 | `87b1488cd1027f733d3bb0551977d3bf22afdd4ed9c8b9f4e5ec3559220250aa` |
| `perspective-thief-bust.glb` | 3,340,480 | `88b709332fd1b22bf2e2fea0c8b0415fc1cbf7cbfedb7ced1734586c8f7de6b1` |
| `perspective-thief-sarcophagus.glb` | 4,710,540 | `c6d2a5fb88ee1575eab3c2c021ee44e90875fe2249ea59ce49e75a6aebfcc87c` |
| `perspective-thief-statue.glb` | 3,661,144 | `63209af42b05f4901466e4859c8a5718b9c1c857d63af1e886b023de487d6d18` |

SHA-256 of the shipped files (`public/models/`):

| File | SHA-256 |
|---|---|
| `guard.glb` | `32c25aec26dd15cb5289c2eb19ccaa3c1e560f849b5459b2b5cc9f4b59f0417b` |
| `raccoon.glb` | `ee22dd6bd7c9967b9e0f98aa0648c9b3a17dc3ef515a2a924c4e2864d69fd34c` |
| `lens.glb` | `c6c6ddc953e9a710ab98dc13da8e413162ae9c38e383c1c5b131c9af7e0df28a` |
| `lens-hand.glb` | `16cc8e0c05ef5c58e1cf20762eb248c9a2821e83069b3d4cbcbca2fada78951d` |
| `dino-crate.glb` | `471c314666f463156666acfce454f6fb7bb256fedaced472695c5d5fe26fe03f` |
| `bust.glb` | `4a742d6b5cb15fbfdaec4e912298f7b25de464b02e91c8e70c493f19899852ea` |
| `sarcophagus.glb` | `e46213f5b1d86e424fa03bcb4bb8b4a6f9668c703a27aa53a807d3a7705c7ec7` |
| `statue.glb` | `cf8b0544180d7ec14119d1d988fb313a285587f945b7a1c5782024b3c2d1890d` |

## Mockups (design reference, never shipped)

`docs/visual-targets/01-first-30s.png`, `02-core-carry.png`, `03-failure-crash.png`, `04-level-select.png`: ChatGPT image generation in the user's Chrome, 2026-10-30, chat https://chatgpt.com/c/6ae50726-16ec-83ed-ab92-f975defb7d80. Prompts and per-image notes in `docs/visual-targets/PROMPTS.md`. The repo copies are the downloaded PNGs re-encoded losslessly (sharp, PNG level 9). Downloaded originals in `assets-src/mockups/`:

| File | Bytes | SHA-256 (original) | SHA-256 (repo copy) |
|---|---|---|---|
| `01-first-30s.png` | 2,244,064 | `fa8f35766a272f11d7aefa26088b30fd313b4e8a7d58098f1702f970fc737ac5` | `b847e8ffaa31f8b183ec5dbdcca17a5a3dc7e5ac927126b27b3e9f4cb8707b4b` |
| `02-core-carry.png` | 2,247,236 | `0621753c3fe1011144dd805d3375fb637958c0711d13638dc6f1af06a344b786` | `eeaf2984fa0de2a09587696f4be8afae46027c5d2fcc009124472b87c6da0857` |
| `03-failure-crash.png` | 2,525,642 | `26eff02fc087d945d5942a352b72ee4b1931a025522e44a58f85dcdf815f1db8` | `53041c9d76740274e6ac49820d14792f49eb68a2057269bcb2d8554ab837c9a7` |
| `04-level-select.png` | 2,584,415 | `6c4965469179b082542ed75f21c9fe085dc5967f7bd2fa9d34af677cd77d9e0d` | `b8cb4716ca90ae7e0dd948bffe2db415f36c48cfe193d8f79de9c69379fc682b` |
