# Kinetic — shared handoff

Codex and Claude Code work on this repository one after the other. This file is the record they share: where the work stands, what was decided, and what the last session did. The protocol for reading and updating it is in `dev/AGENTS.md` under "Handoff between Codex and Claude Code".

Status words used below: **local** (changed in the working tree, not committed), **committed**, **pushed** (on `origin/main`), **deployed** (live on Vercel production, https://kinetic-robotics-lab.vercel.app). Since 2026-10-29 the Vercel project is connected to the GitHub repository, so a push to `main` also deploys. The older ChatGPT Sites prototype is separate and never updated from here.

## Current state

Last verified 2026-11-01 by Claude Code. Verify again with Git before relying on it.

- `main` is the deployed branch, kept equal to `origin/main` (check with `git status --short --branch`). Cloud sessions (claude.ai/code) work on their own `claude/...` branch, and the owner merges into `main`; see Decisions. Remote: `github.com/sinangulecyuz-dev/kinetic-robotics-lab`, public. Everything under "What exists" is committed, pushed to `main`, and deployed on Vercel. The newest session log entry gives the status of the latest change. Check `git log` for the latest commit and `vercel ls` for the latest deployment.
- Layout: `AGENTS.md`, `CLAUDE.md`, and this file are in `dev/`. `.claude/CLAUDE.md` imports `dev/CLAUDE.md` and `dev/AGENTS.md`, so Claude Code loads them, in the cloud too. Codex does not, and nothing loads this file.
- What exists:
  - Milestone 1: rover builder, ramp-balance experiment, bounded pseudocode controller, local notebook (`kinetic-v1`).
  - New: a realistic driving model (`dist/drive.mjs`) on flat, rough, and slippery terrain.
  - New: rotating wheels and a swiveling caster in the 3D view.
  - New: simulated encoders, IMU, motor current, and range sensor, logged at 100 Hz.
  - New: a Plots tab with nine MATLAB-style figures (`dist/plots.mjs`) and CSV export.
  - New: closed-loop control. Student programs can use `drive(v, w)` and test sensor readings in `if` and `while`.
  - New: a TurtleBot3 Waffle Pi preset (driving only), calibrated to the owner's lab data. Also new: "desired" logging, a Lab 1–style position-error figure, and Lab 1 A, B, and C examples.
  - New: a 2D LiDAR (LDS-01 class) on both robots, arena walls at ±2.5 m, LiDAR program readings, a scan overlay, a polar scan plot, a ranges plot, and LiDAR CSV export.
  - New: a complementary filter (gyro and encoder heading) with filtered odometry, `filter(alpha)` and `fused_*` readings, a green filtered path, and filter series in Plots.
  - New: Experiment 02 "Where am I?": a lesson switch (01/02) and three missions judged on ground truth (`dist/missions.mjs`).
  - New: the interface in English, Turkish, and French, with a header language picker (`dist/i18n.mjs`, `dist/lang/`). See README "Languages".
  - New: math in `wheels` and `drive` values, on sensor readings, and a "P control · smooth 90° turn" example.
  - New: learning feedback (what the robot reads, running line, mission verdict with prediction under Run, mission plot with target band, insert buttons), the sky moved into outdoor scenes, clear walls, and a LiDAR layer that follows the lesson.
  - New: "Build your own robot" shown as coming soon in the robot picker, not selectable.
  - New: a decorative header sky, sun and moon by the local clock (`dist/sky.mjs`), at the owner's request.
  - New: Experiment 04 "Hold the line" (integral term, one mission in wind on ice), and `let` variables.
  - New: indoor/outdoor environments, a grass terrain, and a switchable gusty wind outdoors.
  - New: Experiment 03 "Follow the wall" (P control): two missions that start near a wall, "Park 0.5 m from the wall" and "Follow the wall at 0.5 m".
- The README ("What the model means") and `dev/AGENTS.md` ("Physics boundaries") describe the model and its limits.
- Verification on 2026-11-01: `npm test` 85/85 pass, `npm run check` passes, `npm run test:browser` 13/13 pass (headless Chromium, needs Playwright).
- Hosting: Vercel project `kinetic-robotics-lab` (account `sinangulecyuz-dev`), production https://kinetic-robotics-lab.vercel.app, public. First deployed 2026-10-29 from the working tree (`dpl_3G6yP79eBdPdD1jneEAh5woLMove`). `vercel.json` serves `dist` only. The project is connected to the GitHub repository, so pushes to `main` deploy production. The older private ChatGPT Sites prototype (https://kinetic-robotics-lab.famousbadge2.chatgpt.site) is separate and not updated from this repository.
- Dev server: `npm run dev` listens on **127.0.0.1 only** (IPv4), so open http://127.0.0.1:5173. On 2026-10-28 another server held 5173 and served a different copy of the lab (`C:\Users\sinan\OneDrive\Documents\ChatGPT\robotikLab\dist`). That server has since stopped. Since 2026-10-29 both 5173 and 5174 serve this repository (started by Claude Code). Before trusting what a port shows, check which folder its process serves (`Get-NetTCPConnection -LocalPort 5173`). The ChatGPT-hosted prototype is older and is not updated by pushes.

## Open items

- **Codex instructions do not load on their own (since the move to `dev/`):** Codex must be told to read `dev/AGENTS.md` at the start of each session. Claude Code loads them through `.claude/CLAUDE.md` since 2026-11-01.
- **Private link still public:** the ChatGPT Sites URL remains in this file and in Git history, in a public repository. The owner asked to remove it from the README only.
- **Vercel, not yet explicitly decided:** `vercel link --yes` connected the GitHub repository on its own, and the first CLI deploy went straight to production instead of a preview. Told that a push deploys the public site, the owner said "commit and push" (2026-10-29). The connection and the public site stay until the owner says otherwise. To deploy by hand instead: `vercel git disconnect`. To take the site down: `vercel remove`.
- **Review:** the French text needs a native speaker at Saint Michel. The owner reviews the Turkish.
- **Finding, not fixed:** with four experiments, the lesson strip still fits a 377 px phone, but the text beside it is narrow; a fifth experiment needs a new layout.
- **Finding, not fixed:** on a 377 px phone emulation the header's help (?) button is cut off at the right edge; the page itself does not scroll sideways. This predates the 2026-11-01 work.
- **Finding, not fixed:** in the shorter stage (Plots and Results tabs), the "Program complete" pill overlaps the rover. This positioning predates the current work.
- Not verified: touch interaction on a real phone, Safari, Firefox, and a visual review by the owner. `npm run test:browser` covers Chromium and two Chromium phone emulations only.
- **Not verified:** whether Vercel builds a preview deployment for pushes to `claude/...` branches, and whether such previews ask for a Vercel login. If they build, a preview link is the way to try a branch on a real phone and in Safari before merging.
- **TurtleBot3 calibration, open points.** The full table is in the README, "TurtleBot3 Waffle Pi calibration".
  - Not reproduced: the shorter forward legs of the straight-line test (forward/backward asymmetry), and the 4.5 cm drift of the v = 0.15 m/s circle.
  - The model predicts about 3% straight-line odometry overstatement from ball-caster drag. A tape measure in the next lab can test this.
  - The Lab 1 `.mat` files were not found on this machine. The owner will save CSV (`writetable`) in future labs.
  - The Kinetic rover itself (a made-up design) remains unvalidated.
- Plan for the cloud-credit days (proposed by Claude Code and followed by the owner so far, 2026-11-01): browser test (done), math in rover scripts (done), Experiment 03 (done), then Experiment 04 (PID: decide variables or an `integral` reading first), then an instructor kit for Saint Michel (TR/FR/EN). Dropping LiDAR scan matching as too advanced for high school was proposed, not yet confirmed by the owner.
- Items 0–3 of the agreed plan are done. The owner asked for, in order: the slider and camera frame fix, a 2D LiDAR, and a complementary filter. All three are done. Next candidates: raw-log comparison after the next lab, or an absolute heading reference (LiDAR scan matching).

## Decisions

- Agent files live in `dev/`, and the README opens with the project (owner, 2026-11-01). AI use is not hidden: Git history and co-author lines stay, and the README points to `dev/`.
- The owner's credit wording stays "Conceived and directed", not "Designed and built", because AI agents wrote the code (owner, 2026-11-01). The phrase is not in this repository.
- Experiment 03 (2026-11-01): two missions, not three. A "drive straight on gravel" mission was dropped because open-loop drift (1.6–4.4 cm) did not separate the starter from a P solution, and a "turn to 90° with P" mission would have repeated the P example. Mission starts are positions only; the rover always starts facing +z, so odometry, desired paths, and plots keep their frame.
- Interface languages: English, Turkish, and French, for the Saint Michel robotics club (owner, 2026-10-29). Rover script keywords, sensor names, and CSV columns stay English. Translated examples and mission starters change comments only. Decimals use a point in every language, to match code and MATLAB. Simulator, parser, and judge messages carry keys, so results redraw after a language switch.
- Hosting: Vercel (owner, 2026-10-29). The owner had not used GitHub Pages.
- One branch only: all work is committed on `main` and pushed there. No feature branches (owner's decision, 2026-10-28). Exception (owner's go-ahead, 2026-11-01): cloud sessions work on their own `claude/...` branch and never push to `main`, because a push to `main` deploys production. The owner reviews and merges. Run cloud sessions that touch `dist/`, `lang/`, or this file one at a time.
- Left/right fixed (owner approved, 2026-10-28). Before the fix, `wheels(l, r)` drove the physically mirrored wheels, so `wheels(2, 5)` turned right. Now the robot's left is +x, a faster right wheel turns left, and positive yaw is counterclockwise (ROS REP-103). Old saved drive runs replay with the corrected direction.
- Physics depth: planar rigid-body dynamics with motors, tire slip, load transfer, and terrain following (owner's choice, 2026-10-28). Full 3D contact, bouncing, and flight are out of scope. A lifting contact stops the run with a message.
- Sensors were plotted only at first (owner's choice, 2026-10-28). Since 2026-10-29, programs can read them (owner chose closed-loop control as the next step). They read the latest sample only, never ground truth.
- Rover script additions, with the existing parser limits unchanged and no `eval`:
  - `drive(v, w)`: |v| ≤ 0.75 m/s, |w| ≤ 6 rad/s. It maps to wheel targets (v ± w·W/2)/R. Above 10 rad/s, both wheels scale down together so the radius is kept.
  - `while sensor op N … end`, and `if` with any sensor. Operators are `< > <= >=`.
  - Sensors: `distance` (m), `heading` (gyro-integrated IMU yaw in degrees, positive left), `odom_heading` (degrees), `gyro_z` (rad/s), `encoder_left` and `encoder_right` (counts), `odom_x` and `odom_y` (m), `time` (s).
  - A loop without `wait` hits the existing guard.
  - Math in `wheels` and `drive` values (2026-11-01, owner's go-ahead for "bounded expressions, no variables"): numbers, sensors, `+ - * /`, parentheses, `abs`, `min`, `max`; 40 symbols and five nested parentheses per instruction. Math without sensors is computed by the parser and keeps the range errors. Math with sensors is clipped to the same limits at run time. Division by zero has no value: a parse error for constant math, `sim.noValue` during a run. `if`/`while` stay "one sensor against one number". Variables came next (owner chose them over a built-in `integral` reading, 2026-11-01): `let name = math`, at most 10, reserved names refused; tests compare one sensor or variable with one number.
- TurtleBot3 model choices (2026-10-29):
  - Only two parameters are fitted: battery 10.93 V and ball-caster friction 0.261.
  - A command-latency parameter was tried and dropped. The circle data fit best with zero latency (rms 1.9° over five circles).
  - Speed loop gains are kp 0.3, ki 1 (0% overshoot straight, 3% spinning).
  - The two ball casters share their load equally, which keeps moment balance with the three-point solve.
  - Desired paths are drawn as a dotted ink reference line, not a series hue.
- Item 2 scope (owner's decisions, 2026-10-29): the TurtleBot3 preset is for the driving experiment only, with no ramp. The 30-second run limit stays, so the in-place test uses 4 turns and compares drift per turn. The measured lab numbers may go into the repo, but never names, student IDs, or photos.
- One frame everywhere (owner approved, 2026-10-29). The default camera looks from behind the rover (`VIEW_YAW` = π + 0.73), so its own left is on the screen's left. The top view puts forward up the screen. The Sideways position slider is `dir="rtl"` and reads "N cm left/right" in the rover's frame. The ramp text now says it lifts the rover's left side. Physics, stored values, and tests are unchanged.
- Plot colors: MATLAB colororder slots 1, 2, and 4 (#0072BD, #D95319, #7E2F8E). Slot 3 (#EDB120) fails the lightness and contrast checks on white. Color follows the entity: true path is orange, odometry blue, gyro purple, left wheel blue, right wheel orange.
- Load transfer lags acceleration by 20 ms. Without the lag, traction and load form an instantaneous loop that diverges for tall rovers (loop gain μ·h/0.30 > 1) and produces false wheelies.
- Speed loop gains: kp 1, ki 1.5. On concrete the step overshoot is 0.2%. Wheelspin on ice still overshoots, as a real controller would.
- Design skill: Emil Design Engineering, kept at `docs/design-engineering.md`. It is identical to the copy installed for Claude Code (`~/.claude/skills/emil-design-eng`) and the shared copy (`~/.agents/skills/emil-design-eng`).
- This file is the single shared record. Claude Code's project memory lives outside the repository, and Codex does not read it reliably. Anything the other tool needs goes here.

## Session log

Newest first. Keep about the last 10 entries. Fold older ones into "Current state" or "Decisions" instead of letting the file grow.

Entry template:

```md
### YYYY-MM-DD — Codex | Claude Code — short task name
- Changed: files, commit hashes
- Verified: commands actually run, with results (say what was not verified)
- Status: local | committed | pushed | deployed
- Next / open: what remains, decisions waiting for the owner
```

### 2026-11-01 — Claude Code (cloud) — clearer missions, reasons, and hints

- Owner's report from the live site: in Experiment 04, with an edited example in the editor, the verdict "3.6 cm off on average" did not say what was asked or what was wrong.
- Changed: the verdict strip always shows the goal and offers the starter back; after a failed run it lists why (`diagnose` in `dist/missions.mjs`: blind script, missing sensor, encoder heading, no integral variable, and which way it missed) and opens graded hints (idea, tool, code shape with blanks; `HINTS`). Stop messages for the box, the edge, the time limit, and the instruction limit now name the line and the cause. The wind indicator has its own light label. Texts in English, Turkish, and French (French needs review).
- Verified: `npm test` 85/85, `npm run check`, `npm run test:browser` 13/13 (new checks: goal shown, reasons listed, three hint levels, starter restored). Re-enacted the owner's case in Turkish in headless Chromium: the verdict names a blind script, no variable, and 3.2 cm too far from the wall.
- Status: committed and pushed to branch `claude/serene-mccarthy-1vb6oq`; not yet on `main`.
- Next / open: the owner decides when to put it live. French text needs review.

### 2026-11-01 — Claude Code (cloud) — learning feedback, sky in the scene, clear walls

- Owner's review of the live site: the header sky was not visible (scrolled away, and at 23:03 neither sun nor moon was up), and LiDAR dots along the walls looked like a map boundary. The owner chose: move the sky into the scene, make walls clear with the LiDAR layer by lesson, and build the pedagogical improvements.
- Changed: `dist/sky.mjs` (scene band), `dist/missions.mjs` (`missionTrace`), `dist/app.js`, `dist/index.html`, `dist/style.css`, `dist/lang/*` (watch, verdict, mission plot, insert texts), tests, README "Learning feedback" and "Outdoor sky", `dev/AGENTS.md`.
- Verified: `npm test` 83/83, `npm run check`, `npm run test:browser` 13/13. Each mission's plot ends at the judge's own value (14.7 cm, 352.3°, 46.7 cm, 41.1 cm on seed 1). Deliberate breaks of the refused-line mark, the watch card, the prediction check, and the insert indentation each failed a browser test and were reverted. Looked at in headless Chromium: day, night, and zoomed-out outdoor skies, Experiment 03 walls, the watch card on desktop and phone, the verdict strip in Turkish, the mission plot, the insert bar in French.
- Status: pushed to `main` (fast-forward, owner's go-ahead "canlıya al", 2026-11-01), which triggers the Vercel production deploy. Not verified from the cloud session: its network policy refuses the vercel.app host.
- Next / open: French text needs review. Terminology (experiment, mission, lesson, discovery) is still four words.

### 2026-11-01 — Claude Code (cloud) — variables, wind and grass, Experiment 04, header sky, "coming soon" robot

- Changed (commits `30cb041`, `52f3bf9`, `9ddda0c`, `a2cc125`, and the one with this entry):
  - `dist/physics.mjs`, `dist/drive.mjs`: `let` variables; `ENVIRONMENTS`, the grass terrain, and the switchable wind (`AIR`, `WIND`, `DriveSim` option `wind`, CSV `wind_*`).
  - `dist/missions.mjs`: Experiment 04 mission `wind`. `dist/sky.mjs`: new. `dist/app.js`, `dist/index.html`, `dist/style.css`, `dist/lang/*`: environment picker, wind switch and indicator, lesson 04, header sky, the coming-soon robot card. Terrain labels are now Concrete, Gravel, Grass, Ice.
  - Tests: `tests/wind.test.mjs`, `tests/sky.test.mjs`, more in `tests/expressions.test.mjs` and `tests/missions.test.mjs`, three browser tests. README, `dev/AGENTS.md`.
- Verified:
  - `npm test` 83/83, `npm run check`, `npm run test:browser` 13/13. The 156-run fingerprint of the existing log channels is still bit-identical.
  - Wind: the first push on a resting rover matches 0.5·ρ·Cd·A·U²/m to 1e-9; mirror symmetry; frame-split determinism; its own random stream.
  - Experiment 04 with its own judge over 40 seeds: starter 0 pass (average miss 2.6–6.5 cm), reference PID 40 pass (at most 2.2 cm). Margins are thin; README says so.
  - Deliberate breaks of `let`, the reserved names, unset reads, and the "judged only in its wind" check each failed the expected test and were reverted.
  - Looked at in headless Chromium: outdoor grass with the wind indicator, the environment panel, four header-sky times, the robot picker, and the four-lesson strip on a phone.
  - Not verified: real phones, Safari, Firefox; native French review of all new text.
- Findings: `lidar_min` reads about 1.5 cm short (minimum of noisy beams); without static friction a parked rover creeps in wind. Both are documented, not changed.
- Status: pushed to `main` (fast-forward to `7faff6a`, owner's go-ahead, 2026-11-01), which triggers the Vercel production deploy. Not verified from the cloud session: its network policy refuses `kinetic-robotics-lab.vercel.app`, and its GitHub tools do not show deployments. Check with `vercel ls` or by opening the site.
- Next / open: Experiment 04 has one mission; six other mission ideas were measured and dropped (README). "Build your own robot" is only announced.

### 2026-11-01 — Claude Code (cloud) — Experiment 03 "Follow the wall"

- Changed:
  - `dist/drive.mjs`: `DriveSim` option `start` ({x, z}, still facing +z, clamped to `START_LIMIT` = 2 m), kept as `origin`.
  - `dist/missions.mjs`: `experiment` on every mission, `missionsFor`, and two Experiment 03 missions, `park` and `wall`, with starts, judges, and Turkish and French texts.
  - `dist/app.js`, `dist/index.html`: lesson 03 button, per-experiment mission card titles, `startPose()` for the idle view, runs, records, and replays; the camera follows the rover when the run starts off-center; the lesson 3 details dialog. Fixed: after a reload, Experiment 02 or 03 came back in ramp mode; it now comes back in drive mode.
  - `dist/lang/{en,tr,fr}.mjs`: lesson 3, mission card, discovery, judge, and details texts; the learning path gets "Steer by feedback" as item 03 and renumbers the planned items 04–06. French needs the native speaker's review.
  - Tests: two reference solutions and three tests in `tests/missions.test.mjs`, the lesson 3 keys in `tests/i18n.test.mjs`, one browser test. README "Experiment 03", `dev/AGENTS.md`.
- Verified:
  - `npm test` 66/66, `npm run check`, `npm run test:browser` 11/11 pass.
  - The 156-run fingerprint (every example and Experiment 02 starter, both robots, three terrains, noise on and off) is still bit-identical.
  - Park: the starter stops at 41–46 cm, a P solution at 49.4–50.2 cm. Wall: the starter hits the wall for seeds 1–4; distance-only control hit the wall for every gain tried (0.2–4, on `lidar_left` and `lidar_min`); with a heading term the largest miss over 40 seeds is 8.3 cm (gyro) or 5.1 cm (LiDAR wall angle), against a ±10 cm tolerance. Driving straight misses by 30 cm and fails.
  - Start geometry checked independently: `lidar_left` reads 2.5 − 1.7 = 0.8 m at the wall start with noise off.
  - The tests can fail: start ignored in the simulator, start never passed by the app, lesson 3 not restored, a 1 m wall tolerance, and the judge measuring the wrong wall each failed the expected tests; all were reverted.
  - Looked at in headless Chromium: the rover centered at the wall start, the wall and LiDAR dots in view, the reference solution passing in the app with a 3.2 cm miss.
  - A saved Experiment 03 run replays from its start after a reload: the browser test reads the replayed LiDAR CSV, whose 270° beam sees the right wall about 1.0 m away.
  - Not verified: real phones, Safari, Firefox; a native French review.
- Status: committed and pushed to branch `claude/serene-mccarthy-1vb6oq`, not to `main`, so nothing deployed.
- Next / open: Experiment 04 needs the owner's decision on variables or an `integral` reading. The owner merges the branch into `main` at the end.

### 2026-11-01 — Claude Code (cloud) — math in rover scripts (P control)

- Changed:
  - `dist/physics.mjs`: `parseValues` (tokenizer and recursive-descent parser, no `eval`), `evaluate`, `MATH_FUNCTIONS`, `MATH_LIMITS`. `wheels` and `drive` take math. The parser's `fail` moved to module scope.
  - `dist/drive.mjs`: `value()` evaluates math on the latest sensor samples and clips it; NaN stops the run with `sim.noValue` and the line.
  - `dist/lang/{en,tr,fr}.mjs`: 7 parser messages, `sim.noValue`, `example.pturn`, and a "Math from sensors" section in the rover script reference. French needs the native speaker's review.
  - `dist/examples.mjs`, `dist/index.html`: the "P control · smooth 90° turn" example. `dist/style.css`: inline code in dialogs no longer breaks across lines.
  - New `tests/expressions.test.mjs` (8 tests), added to `npm test`. One browser test added. `npm run check` also checks the browser test's syntax. README and `dev/AGENTS.md` updated.
- Verified:
  - `npm test` 62/62, `npm run check`, `npm run test:browser` 10/10 pass.
  - 156 runs (every example and mission starter × 2 robots × 3 terrains × noise on/off) hashed before and after: all bit-identical, so number-only programs, missions, and saved runs behave as before.
  - Expressions: 3000 generated expressions give exactly JavaScript's value; 20 000 random strings only ever raise line-numbered parser messages; hostile names (`constructor`, `__proto__`, `alert`) are refused.
  - P turn against an independent sampled-data model: k = 0.02 ends at 82.5° against 82.1° predicted; k = 0.3 overshoots (108° simulated, 98° in the model, which leaves out motor lag).
  - The tests can fail: six deliberate breaks (reversed subtraction, right-associative `*` and `/`, function lookup through the prototype, no clipping, no NaN stop, no depth limit), each reverted, failed the expected tests. Only the JavaScript comparison caught the associativity break.
  - Looked at in headless Chromium: the reference section in Turkish and French, the example in French (its long comment line was split after this check), and the three dialogs on a phone emulation with no sideways overflow.
  - Not verified: real phones, Safari, Firefox; a native French review.
- Status: committed and pushed to branch `claude/serene-mccarthy-1vb6oq`, not to `main`, so nothing deployed.
- Next / open: the owner merges into `main` if wanted. The P example also shows a pattern for the "turn once around" mission, though not its reference solution. Next planned step: Experiment 03, wall following with P control.

### 2026-11-01 — Claude Code (cloud) — instructions load on their own, browser smoke test

- Changed:
  - New `.claude/CLAUDE.md`: imports `dev/CLAUDE.md` and `dev/AGENTS.md`, so Claude Code sessions, including cloud sessions, load them without a pasted prompt. The root stays free of agent files.
  - New `tests/browser/smoke.test.mjs` (9 tests) and `npm run test:browser`. Headless Chromium against `scripts/serve.mjs` on a free port, with a Playwright fake clock driving `requestAnimationFrame`. Expected texts come from `dist/lang/*.mjs` and `dist/missions.mjs`, the CSV header from `toCsv`. Any console error, exception, failed request, or HTTP error fails the test. A failure leaves a screenshot in `test-results/` (ignored by Git).
  - `scripts/serve.mjs`: prints the real address, `http://127.0.0.1:<port>`, and `PORT=0` picks a free port. This closes the old "serve.mjs prints localhost" finding.
  - `dev/AGENTS.md`, `README.md`: the browser test, and how the instructions load. `.gitignore`: `test-results/`.
  - No change under `dist/`.
- Verified:
  - `npm test` 54/54, `npm run check` pass, `npm run test:browser` 9/9 pass (about 10 s).
  - The test can fail: six deliberate breaks, each reverted with `git checkout`, failed the expected tests. A 800 px minimum width failed both phone tests; a dead CSV button failed the drive test; a dead `?` key failed the keyboard test; not restoring the saved language failed the language test; a missing module (404) failed all 9; an exception in `finish()` during drive runs failed the 4 tests that finish a drive run. That last result showed the phone tests run a drive, not the ramp, because opening the Code tab switches to driving; the test name and check were corrected.
  - Writing `.claude/CLAUDE.md` made Claude Code load both imported files in this session. Not verified: a freshly started session.
  - Not verified: Firefox, WebKit, and Safari (only Chromium is installed in the cloud container), and real phones.
- Status: committed and pushed to branch `claude/serene-mccarthy-1vb6oq`, not to `main`, so nothing deployed.
- Next / open: the owner merges into `main` if wanted. Next planned step: bounded expressions in rover scripts (for example `drive(0.3, 2*(lidar_left-0.3))`), as the prerequisite for P and PID lessons.

### 2026-11-01 — Claude Code — agent files moved to `dev/`, README opens with the project

- Changed:
  - `AGENTS.md`, `CLAUDE.md`, and `HANDOFF.md` moved to `dev/` with `git mv`, and their references to each other updated. Older session log entries keep the old names.
  - `README.md`: removed "Continue in Codex or Claude Code" with the private ChatGPT Sites link, and the prototype sentence under "Hosting". Rewrote the opening around the project and its model. Added a one-line "Development notes" pointer to `dev/`.
  - Outside the repository: a Claude Code project memory that points at `dev/`.
- Verified:
  - `npm test` 54/54, `npm run check` pass.
  - `chatgpt.site` now appears only in `dev/HANDOFF.md`. The README has no bare references to the moved files.
  - The opening's 10 kHz and 100 Hz PI figures match `DT` and `CONTROL_STEPS` in `dist/drive.mjs`.
  - Not verified: a fresh Claude Code or Codex session on the new layout, and the README as rendered on GitHub.
- Status: committed together with this entry and pushed to `origin/main` (owner's go-ahead, 2026-11-01); the push deploys production through the Git connection.
- Next / open: see Open items.

### 2026-10-29 — Claude Code — three interface languages and Vercel hosting

- Changed:
  - New `dist/i18n.mjs` and `dist/lang/en.mjs`, `tr.mjs`, `fr.mjs` (351 keys each, including the help dialogs).
  - `dist/index.html`: `data-i18n` attributes and a language picker. `dist/style.css`: picker style and three selectors narrowed for wrapped text.
  - `dist/app.js`: every visible string through `t()`. Language-dependent text is kept as functions, so a switch redraws it. Saved runs store a message key. An unedited example or starter follows the language.
  - `dist/drive.mjs`, `dist/physics.mjs`, `dist/missions.mjs`: message keys and params next to the English text. `dist/examples.mjs` and `dist/missions.mjs`: Turkish and French comments and mission texts. `dist/plots.mjs`: two strings through `t()`.
  - New `tests/i18n.test.mjs` (5 tests). `package.json`, README ("Languages", "Hosting"), `AGENTS.md`, `.gitignore` (`.vercel`), new `vercel.json`.
- Verified:
  - `npm test` 54/54, `npm run check` pass.
  - Headless Chrome on 127.0.0.1:5174 and on the live site: no English text left on screen in Turkish or French (one false match, "Rover programı"). A Turkish mission run shows the outcome, judge, result card, plots, and CSV meta in Turkish. Switching to French redraws all of them and swaps the starter's comments. Parser errors redraw. All six dialogs translate. The language survives a reload. No horizontal overflow at 390 px. Zero console errors.
  - Live site: `index.html`, `.mjs`, and `.css` return 200 with JavaScript and CSS MIME types. `tests/` and `HANDOFF.md` return 404.
  - Not verified: a native French review, real phones, Safari, Firefox.
- Status: deployed to Vercel production from the working tree first. Then committed together with this entry and pushed to `origin/main` (owner's go-ahead, 2026-10-29); the push deploys production again through the Git connection.
- Next / open: native French review, the owner's Turkish review, and the Vercel item in Open items.

### 2026-10-29 — Claude Code — example scripts fixed and put under test

- The owner reported that "Repeat a square" did not draw a square. Cause: it used `wheels(4, -4)` for a fixed time. The turn rate R·Δω/W depends on wheel spacing and robot, so the square only closed at 44 cm. At 24 cm a corner was −175°, at 60 cm −66°, and on the TurtleBot3 −59°.
- Changed:
  - "Repeat a square" now uses `drive(0.2, 0)` for 2 s and `drive(0, 1)` for 1.6 s. That is π/2 plus spin-up and slow-down time, and it turns left.
  - "Straight & turn" (`wheels(4, 4)` 1 s, then `wheels(1, 5)` 1.5 s) no longer reaches the box at 60 cm.
  - The examples moved from `app.js` into `dist/examples.mjs`.
  - New `tests/examples.test.mjs` (2 tests): every example must finish without hitting anything on flat ground with Kinetic at 24, 44, and 60 cm and with the TurtleBot3, and the square must turn 90 ± 3° per corner and close within 6 cm. That test is what found the "Straight & turn" collision.
- Verified:
  - `npm test` 49/49, `npm run check` pass.
  - The square turns 88.5–91.5° per corner and ends 1.2–3.6 cm from the start on all four setups.
  - Headless Chrome top view shows a closed square. Zero console errors.
- Status: committed and pushed to `origin/main` with the three commits before it (owner's go-ahead, 2026-10-29).
- Next / open: none.

### 2026-10-29 — Claude Code — complementary filter

- Changed:
  - `dist/drive.mjs`: `FUSION_ALPHA` = 0.999, a 100 Hz fused heading, filtered odometry and its path, and `fused*` channels (CSV `fused_*`).
  - `dist/physics.mjs`: the `filter(alpha)` statement and `fused_heading`, `fused_x`, `fused_y` readings.
  - `dist/plots.mjs`: a fourth color, MATLAB slot 5 green. The validator passes it, with a contrast warning that legends and CSV cover.
  - `dist/app.js`, `dist/index.html`, `dist/style.css`: filtered series in the trajectory, heading, and error plots, a green path toggle, the "Complementary filter on ice" example, and reference and model text.
  - Tests: new `tests/fusion.test.mjs` (4 tests).
- Decision: the default α is 0.999, not 0.98, from a measured comparison (README table). Both sensors err slowly, so a fast crossover helps almost nothing.
- Verified:
  - `npm test` 47/47, `npm run check` pass.
  - α = 1 equals gyro integration and α = 0 equals encoder odometry, to 1e-12.
  - With a parked rover, the steady state matches bias × α·T/(1 − α).
  - Headless Chrome: on ice the filtered path ends about 4.5 cm from the truth, against about 9.5 cm for encoder odometry. Zero console errors.
- Status: pushed to `origin/main` with the next entry (owner's go-ahead, 2026-10-29).
- Next / open: none for this entry.
