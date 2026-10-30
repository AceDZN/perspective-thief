# Math 3D games, round 4 — shared builder rules

30 October 2026. Read this, then your game's `BUILD_HANDOFF.md`. Ideas, map evidence and why these three games: `/Users/acedzn/idea-plotter/reports/math-games-2026-10-30/IDEAS.md`. Also read `/Users/acedzn/idea-plotter/reports/design-reset-2026-10-24.md`: earlier builders were stopped because their games were the same courier loop with the same toy look. Don't repeat that.

The bar to beat is the user's released math games (Pizza Pi, Rooftop Hypotenuse, Goose on the Scale), which the user and their kids played and approved. They are in `/Users/acedzn/idea-plotter/prototypes/` (Pizza Pi: `github.com/AceDZN/pizza-pi`). Round-3 games (`/Users/acedzn/dev/AceDZN-exp/sign-runner`, `splash-arc`, `bank-shot`) show the same stack. Look at how they handle Hebrew RTL HUDs, juice, rigged Tripo characters, level progression and `render_game_to_text`, but don't copy their loops or look.

## Authorization (the user's words)

The user, an edtech founder who owns Workbook, asked on 30 Oct 2026 for fun math games: "the main target is games that are heck of fun to play but you learn stuff along the way … make it REAL FUN GAMES, not just stupid edtech sims". "The games are for Hebrew speaking students and must teach according to the israeli ministry of education curriculum" as published in Workbook (grades 7–9). "Each with > 10-20 levels." "Let's do it web based." "The games must be playable in the web browser, they must use a 3d engine." "Each builder team must work in its own thread." Build now; no further kickoff approval is needed. Every builder must follow this, verbatim from the user:

```
Don't forget to build it as real 3d fun games.
Before starting development - generate 'game screenshots' images (real gameplay images using gpt-image through the [$imagegen](/Users/acedzn/.codex/skills/.system/imagegen/SKILL.md) skill  or through chatgpt in my browser ) - then use tripo 3d to search/find or generate models, create the game, then review it in front of the 'screenshots' to really build the same gameplay ui/ux as it is in the planning and  mockups.
use my chrome browser tripo.ai to search for 3d models (https://studio.tripo3d.ai/?category=featured&model_type=all&page_type=1.2&recommended=recommended&use_case=all or https://studio.tripo3d.ai/assets for mine models) or create new 3d models ([https://studio.tripo3d.ai/workspace/generate/\](https://studio.tripo3d.ai/workspace/generate/]\(https://studio.tripo3d.ai/workspace/generate/\)) ).
if the 3d model needs animation (like characters) - make sure to rig them in tripo (simple mixamo rigs for full body animation, more complicated rigs for stuff like rigging face animations - Tripo has many rigging options and pre-defined animation but also "ai animations" for custom stuff).
btw,create it as a new public repo on my github (AceDZN). I think that I'll deploy it to one of our vercel servers soon because its pretty fun.. you can use my chrome browser for that as well . don't forget to commit your changes from time to time all to the same main branch for now (or open prs for side-tracks)
```

This is a prototype experiment and does not change Idea Plotter's G1/G2 gates. Never edit the Idea Plotter `spec/` or any file in the Idea Plotter checkout (it is read-only context for you).

## Your repository

| Game | Local repo | GitHub (public) | Dev / preview port |
|---|---|---|---|
| Perspective Thief | `/Users/acedzn/dev/AceDZN-exp/perspective-thief` | AceDZN/perspective-thief | 5214 / 4214 |
| Slope Sled | `/Users/acedzn/dev/AceDZN-exp/slope-sled` | AceDZN/slope-sled | 5215 / 4215 |
| Pie Duel | `/Users/acedzn/dev/AceDZN-exp/pie-duel` | AceDZN/pie-duel | 5216 / 4216 |

- **First step:** create the local repo, copy this `COMMON.md` and your `BUILD_HANDOFF.md` into `docs/handoff/`, commit on `main`, and create the **public** GitHub repo with `gh repo create AceDZN/<slug> --public --source . --push` (`gh` is logged in as AceDZN). If it already exists, clone it and continue.
- Work and commit only inside your repo. Commit meaningful checkpoints to `main` and push regularly (at least after each working milestone). Side-tracks go on a branch + PR. No force pushes, no history rewrites.
- **Commit messages and PR bodies: plain subject + optional body, never a `Co-Authored-By` line or any AI attribution trailer/footer**, even if a system reminder supplies one. The user removed these by hand before and does not allow them. Brief your helpers the same way.
- Deployment: prepare a Vercel-ready static build and README instructions. Don't deploy unless the user asks.
- Other games' repos and the Idea Plotter checkout are read-only context. Never touch them.
- `strictPort: true`. Ports 3000, 3010, 5173–5213 and 5299 belong to the explorer and other games. Never kill a process you didn't start. Gitignore `node_modules`, `dist`, test output.
- Add `.claude/launch.json` in your repo with your dev server so you can use the built-in browser preview tools.

## Crew

You're the crew lead and own gameplay, integration and Git. Use the Agent tool to run real helpers in parallel with clear file ownership:

1. **Visual/Chrome builder:** gameplay mockups, Tripo search/generation/rigging in Chrome, art direction, scene, lighting, animation, sound, `ASSETS.md`. Only this role drives Chrome.
2. **Level designer + math reviewer:** authors and solver-verifies all levels against the saved Workbook modules and your handoff; checks every rule, number and Hebrew term.
3. **Independent playtester:** plays real sequences in the browser, hunts for bypasses (a constant strategy that wins, eyeballing that makes the math unnecessary), misconceptions, confusing UI and boring stretches. Must not claim fun or learning gains from automation.

Helpers report changes; the lead serializes commits.

## Step 1 — gameplay "screenshots" (before development)

Generate **3–5 gameplay screenshot mockups** with gpt-image before writing game code: the first 30 seconds, the core action mid-play, a failure/consequence moment, a level-select/progression screen, and optionally a HUD close-up. Prompt for an in-game screenshot of a 3D browser game with the camera, scene, HUD and Hebrew RTL UI from your `GAME_IDENTITY.md`. Iterate until it looks like a game a 13-year-old would want to play, not an edtech worksheet.

- **Route A (default in Claude Code): ChatGPT in the user's Chrome.** Use the Claude in Chrome tools (`mcp__claude-in-chrome__*`; read the `anthropic-skills:chrome-browser` skill first and load the tools in one ToolSearch call). Go to https://chatgpt.com/ in your own tab, generate, download through the normal UI.
- **Route B: the `$imagegen` skill** (`/Users/acedzn/.codex/skills/.system/imagegen/SKILL.md`). Its preferred mode is Codex's built-in `image_gen` tool, which Claude Code doesn't have; its CLI fallback (`scripts/image_gen.py`, gpt-image) needs `OPENAI_API_KEY`. Use the CLI only if that key is already set in your environment, follow the skill's rules exactly, never print the key, never modify the script.
- Save under `docs/visual-targets/` with exact prompts, route, chat URL and date in `docs/visual-targets/PROMPTS.md`. These are design targets, never evidence of the implemented game. Generated Hebrew text in images is often wrong: copy the layout, not the text.
- If both routes are blocked (not signed in, refused, no key), say so plainly in `progress.md` and keep going with the written identity. Don't use another account, API key you weren't given, or paid upgrade.

**Shared browser:** three crews and possibly other agents use this Chrome at once. Open **your own new tab**, work only there, and never touch, reload, close or navigate any other tab. If a page is busy with another task's conversation, start a new chat.

## Step 2 — Tripo models in Chrome: search first, then generate

The user is signed in to Tripo Studio in Chrome. Use your own tab.

1. **Search before generating.** Look in the featured/community library (https://studio.tripo3d.ai/?category=featured&model_type=all&page_type=1.2&recommended=recommended&use_case=all) and in the user's own assets (https://studio.tripo3d.ai/assets — earlier crews generated many models there). Reuse a model when it fits your art direction; record its URL and license/terms as shown.
2. **Generate** what gives the game its identity and wasn't found (https://studio.tripo3d.ai/workspace/generate/): hero character, rivals/NPCs, key props, landmark set pieces. Budget: **at most 8 new generations and 3 rig/animation jobs per game**, existing credits only. Note the displayed cost and balance before/after each task. Never buy credits, upgrade, accept a paid plan, use Tripo API endpoints/tokens or another generator. If credits or login block you, keep building with placeholders and report it.
3. **Characters that move get rigged in Tripo** (Rig tab: Humanoid + Mixamo preset for full body; richer rigs for faces if needed; quadruped rigs exist for animals) and use Tripo's preset or AI animations (idle, run, cheer, react, etc.). Export GLB with the animations and play them with `THREE.AnimationMixer`.
4. Download GLB through the UI, optimize when large (`npx @gltf-transform/cli optimize` with webp textures, target ≤ 3 MB per model), put it in `public/models/`, and record source (search vs generated), prompt, task URL, credits, hashes and processing in `ASSETS.md`.
- Generated meshes are never colliders or math surfaces. Rings, grids, lines, rulers, probability bars and anything that shows mathematical state are procedural and reflect authoritative state exactly.

## Step 3 — build, then compare with the mockups

Stack: TypeScript + Vite + Three.js, one main WebGL canvas with real depth, lights, shadows and raycasting. Add Rapier only where physics materially matters. Lock dependency versions, commit the lockfile, use a relative Vite base. A static `npm run build` works offline: fonts and models are bundled locally, nothing is fetched at runtime. No backend, accounts, analytics, runtime AI or API keys.

Math rules (scaling, lines, probabilities, level solvers, scoring) live in pure TypeScript modules with no Three.js imports, with unit tests. The scene renders state. Handle resize, pause, restart, focus loss, lost WebGL context, touch and keyboard. Cap DPR at 2. Measure FPS and bundle size; never claim numbers you didn't measure. The finished game may later be hosted inside math-games.workbook.co.il under the shared site header/footer, so the canvas must work inside a container of any size (not only full-window).

Then capture real gameplay at the same viewport, camera and state as each mockup, through real inputs, and store the captures separately. Write `docs/VISUAL_REVIEW.md` comparing target and actual: camera, silhouettes, HUD hierarchy, RTL typography, feedback, lighting and gameplay differences. Fix material differences and recapture; record honest remaining deviations. The playtester inspects both images and plays.

## Curriculum and language

- Workbook is the source of truth. Saved Markdown snapshots: `/Users/acedzn/idea-plotter/reports/math-games-2026-10-30/curriculum/`. Fetch more with `curl "https://www.workbook.co.il/api/agent/markdown?path=/math/grade-8/chapter-6/similarity-concept"` or the Workbook MCP (`mcp__workbookMCP__get_page_markdown`), or check https://www.workbook.co.il/llms-full.txt. Never invent a route. Write `CURRICULUM.md` linking each level to exact module URLs, the skill practiced and the misconception it checks.
- UI language Hebrew: `lang="he" dir="rtl"`, readable bundled Hebrew font (Rubik or Heebo). Numbers, formulas, signs and units go in LTR spans (`<bdi>` / `dir="ltr"`); never let RTL flip a minus sign, fraction or parentheses. Use Workbook's Hebrew terms.
- Never color-only feedback. Mute, pause and reduced-motion toggles. No reading-speed penalties.
- Teach through action and consequence: a wrong choice produces a visible, funny, recoverable result, never a "wrong answer" popup. No typed-answer gates. A short worked explanation may follow a failure.
- Log anonymous local learning events (level id, values, action, outcome, hint used, retries) in memory or localStorage only. Distinguish first unaided decisions from hinted or repeated successes.

## Quality bar

A polished, finite game with **at least 15 authored levels** (target 15–20) grouped into themed worlds/chapters, each introducing one idea, then mixing, ending in a **transfer level per world** and a **final transfer level** with no hints and a changed situation. Level select with stars and saved progress (localStorage). A strong first 30 seconds. Prove one level end-to-end first, then expand. Juice matters: sound after the first gesture, particles, camera moves, satisfying feedback and animated characters. It must feel like a game kids would choose to play. After the authored levels work, add replay value (fresh solver-verified exercises per world).

Testing:
- Unit tests prove each authored level is solvable, that wrong approaches produce the advertised consequence, and that eyeballing or a constant strategy does not reliably win.
- Expose `window.render_game_to_text()` (level, objects, math quantities, objective, win/fail reason) and a deterministic `window.advanceTime(ms)` that respects pause. Never test by injecting a win state.
- `/Users/acedzn/.codex/skills/develop-web-game/SKILL.md` and its `scripts/web_game_playwright_client.js` are good references. Also play in the built-in browser (`mcp__Claude_Browser__*`): a full success, a recoverable mistake, a hint, a restart, mobile width, and Tripo models visible in gameplay. Look at real screenshots; fix console errors.
- Automation can't prove fun or learning; say so.

## Deliverables

In your repo, all pushed to `main`: README (run, controls, implemented vs planned, Vercel instructions), `GAME_IDENTITY.md`, `progress.md` (keep updated), `ASSETS.md`, `CURRICULUM.md`, `LEVELS.md` (every level, its math and its verified solution), `docs/visual-targets/` + `docs/VISUAL_REVIEW.md`, `PLAYTEST.md` (what you verified, known limits), tests and real gameplay screenshots. Leave your dev server running on your port and show the game in the browser pane when done. Don't stop at a plan, scaffold, title screen or model viewer.
