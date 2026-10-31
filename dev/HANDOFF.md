# Kinetic — shared handoff

Codex and Claude Code work on this repository one after the other. This file is the record they share: where the work stands, what was decided, and what the last session did. The protocol for reading and updating it is in `dev/AGENTS.md` under "Handoff between Codex and Claude Code".

Status words used below: **local** (changed in the working tree, not committed), **committed**, **pushed** (on `origin/main`), **deployed** (live on Vercel production, https://kinetic-robotics-lab.vercel.app). Since 2026-10-29 the Vercel project is connected to the GitHub repository, so a push to `main` also deploys. The older ChatGPT Sites prototype is separate and never updated from here.

## Current state

Last verified 2026-11-01 by Claude Code. Verify again with Git before relying on it.

- Single branch `main`, kept equal to `origin/main` (check with `git status --short --branch`). Remote: `github.com/sinangulecyuz-dev/kinetic-robotics-lab`, public. Everything under "What exists" is committed, pushed to `main`, and deployed on Vercel. The newest session log entry gives the status of the latest change. Check `git log` for the latest commit and `vercel ls` for the latest deployment.
- Layout: `AGENTS.md`, `CLAUDE.md`, and this file are in `dev/`, so coding tools do not load them on their own.
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
- The README ("What the model means") and `dev/AGENTS.md` ("Physics boundaries") describe the model and its limits.
- Verification on 2026-11-01: `npm test` 54/54 pass, `npm run check` passes.
- Hosting: Vercel project `kinetic-robotics-lab` (account `sinangulecyuz-dev`), production https://kinetic-robotics-lab.vercel.app, public. First deployed 2026-10-29 from the working tree (`dpl_3G6yP79eBdPdD1jneEAh5woLMove`). `vercel.json` serves `dist` only. The project is connected to the GitHub repository, so pushes to `main` deploy production. The older private ChatGPT Sites prototype (https://kinetic-robotics-lab.famousbadge2.chatgpt.site) is separate and not updated from this repository.
- Dev server: `npm run dev` listens on **127.0.0.1 only** (IPv4), so open http://127.0.0.1:5173. On 2026-10-28 another server held 5173 and served a different copy of the lab (`C:\Users\sinan\OneDrive\Documents\ChatGPT\robotikLab\dist`). That server has since stopped. Since 2026-10-29 both 5173 and 5174 serve this repository (started by Claude Code). Before trusting what a port shows, check which folder its process serves (`Get-NetTCPConnection -LocalPort 5173`). The ChatGPT-hosted prototype is older and is not updated by pushes.

## Open items

- **Instructions no longer load on their own (since the move to `dev/`):** Codex must be told to read `dev/AGENTS.md` at the start of each session. Claude Code is pointed there by a project memory on the owner's machine only.
- **Private link still public:** the ChatGPT Sites URL remains in this file and in Git history, in a public repository. The owner asked to remove it from the README only.
- **Vercel, not yet explicitly decided:** `vercel link --yes` connected the GitHub repository on its own, and the first CLI deploy went straight to production instead of a preview. Told that a push deploys the public site, the owner said "commit and push" (2026-10-29). The connection and the public site stay until the owner says otherwise. To deploy by hand instead: `vercel git disconnect`. To take the site down: `vercel remove`.
- **Review:** the French text needs a native speaker at Saint Michel. The owner reviews the Turkish.
- **Finding, not fixed:** `scripts/serve.mjs` still prints `http://localhost:5173`. The README and `dev/AGENTS.md` now say 127.0.0.1.
- **Finding, not fixed:** in the shorter stage (Plots and Results tabs), the "Program complete" pill overlaps the rover. This positioning predates the current work.
- Not verified: touch interaction on a real phone, Safari, Firefox, and a visual review by the owner.
- **TurtleBot3 calibration, open points.** The full table is in the README, "TurtleBot3 Waffle Pi calibration".
  - Not reproduced: the shorter forward legs of the straight-line test (forward/backward asymmetry), and the 4.5 cm drift of the v = 0.15 m/s circle.
  - The model predicts about 3% straight-line odometry overstatement from ball-caster drag. A tape measure in the next lab can test this.
  - The Lab 1 `.mat` files were not found on this machine. The owner will save CSV (`writetable`) in future labs.
  - The Kinetic rover itself (a made-up design) remains unvalidated.
- Items 0–3 of the agreed plan are done. The owner asked for, in order: the slider and camera frame fix, a 2D LiDAR, and a complementary filter. All three are done. Next candidates: raw-log comparison after the next lab, or an absolute heading reference (LiDAR scan matching).

## Decisions

- Agent files live in `dev/`, and the README opens with the project (owner, 2026-11-01). AI use is not hidden: Git history and co-author lines stay, and the README points to `dev/`.
- The owner's credit wording stays "Conceived and directed", not "Designed and built", because AI agents wrote the code (owner, 2026-11-01). The phrase is not in this repository.
- Interface languages: English, Turkish, and French, for the Saint Michel robotics club (owner, 2026-10-29). Rover script keywords, sensor names, and CSV columns stay English. Translated examples and mission starters change comments only. Decimals use a point in every language, to match code and MATLAB. Simulator, parser, and judge messages carry keys, so results redraw after a language switch.
- Hosting: Vercel (owner, 2026-10-29). The owner had not used GitHub Pages.
- One branch only: all work is committed on `main` and pushed there. No feature branches (owner's decision, 2026-10-28).
- Left/right fixed (owner approved, 2026-10-28). Before the fix, `wheels(l, r)` drove the physically mirrored wheels, so `wheels(2, 5)` turned right. Now the robot's left is +x, a faster right wheel turns left, and positive yaw is counterclockwise (ROS REP-103). Old saved drive runs replay with the corrected direction.
- Physics depth: planar rigid-body dynamics with motors, tire slip, load transfer, and terrain following (owner's choice, 2026-10-28). Full 3D contact, bouncing, and flight are out of scope. A lifting contact stops the run with a message.
- Sensors were plotted only at first (owner's choice, 2026-10-28). Since 2026-10-29, programs can read them (owner chose closed-loop control as the next step). They read the latest sample only, never ground truth.
- Rover script additions, with the existing parser limits unchanged and no `eval`:
  - `drive(v, w)`: |v| ≤ 0.75 m/s, |w| ≤ 6 rad/s. It maps to wheel targets (v ± w·W/2)/R. Above 10 rad/s, both wheels scale down together so the radius is kept.
  - `while sensor op N … end`, and `if` with any sensor. Operators are `< > <= >=`.
  - Sensors: `distance` (m), `heading` (gyro-integrated IMU yaw in degrees, positive left), `odom_heading` (degrees), `gyro_z` (rad/s), `encoder_left` and `encoder_right` (counts), `odom_x` and `odom_y` (m), `time` (s).
  - A loop without `wait` hits the existing guard.
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

### 2026-10-29 — Claude Code — rover-frame camera and labels, then a 2D LiDAR

- Changed (frame):
  - Chase camera (`VIEW_YAW` = π + 0.73), and the top view faces up.
  - The offset slider is `dir="rtl"` and reads "N cm left/right".
  - Ramp texts say it lifts the rover's left side.
  - The tilt-table label stays on screen.
- Changed (LiDAR):
  - `dist/drive.mjs`: `LIDAR`, `WALL`, `castRay` (box and walls), `lidarMeasure`, progressive scans with motion smear, a separate noise stream, `lidar*` log channels, and `toScanCsv`.
  - `dist/physics.mjs`: six LiDAR readings in `SENSORS`.
  - `dist/plots.mjs`: polar figures and gaps for no return.
  - `dist/app.js`, `dist/index.html`, `dist/style.css`: walls, scan dots, LiDAR toggle, a LiDAR puck on the Kinetic rover, polar scan and ranges plots, LiDAR CSV button, "Avoid the box with the LiDAR" example, and reference and model text.
  - Tests: new `tests/lidar.test.mjs` (7 tests).
- Behavior change: the front range sensor now sees the walls too (capped at 3 m). Before, it read 3 m whenever the box was not ahead.
- Verified:
  - `npm test` 43/43, `npm run check` pass.
  - LiDAR geometry matches hand-computed distances to the millimetre.
  - Beam noise while parked: 0.0173 m measured vs 0.0191 m expected.
  - Headless Chrome: the slider moves the payload to the screen side it names, the ramp tips to the low (right) side, `wheels(2, 5)` turns left in the top view, the LiDAR example completes on both robots and all terrains without collision, the polar plot reads correctly, and there are zero console errors.
- Found while testing: an example that drove off once a single beam was clear hit the box, because the rover is wider than a ray. The example now turns 90° with the gyro instead, and its comment explains why.
- Status: committed locally, not pushed (see the next entry).
- Next / open: none for this entry.

### 2026-10-29 — Claude Code — Experiment 02 lesson and missions (item 3)

- Changed:
  - New `dist/missions.mjs` with three missions: stop 20 cm from the box (Kinetic, flat), turn exactly once around (TurtleBot3, flat), and close a square on ice (Kinetic, slippery). Each has a starter that falls short on purpose, a judge on ground truth, and a hint shown after a failed attempt.
  - `dist/app.js`, `dist/index.html`, and `dist/style.css`: lesson switch, mission card in the builder, judging when a run finishes, mission result on result cards, lesson 02 details, and persisted progress (`lesson`, `mission`, `missionsDone`).
  - Tests: new `tests/missions.test.mjs` (5 tests) holding the reference solutions, which are never shown in the interface. `package.json`, README, and `AGENTS.md` updated.
- Verified:
  - `npm test` 36/36, `npm run check` pass.
  - Over 6 seeds, every starter fails and every reference solution passes.
  - Headless Chrome on 5174: the stop starter shows "Not yet" with a 14.7 cm gap, the solution passes at 20.1 cm and the mission shows DONE. The turn starter on the TurtleBot3 fails at 352.3° with the encoder hint. Result cards show mission status, switching back to lesson 01 restores the ramp, the phone width has no overflow, and there are zero app console errors.
- Status: committed together with this entry and pushed to `origin/main` (owner approved "everything", 2026-10-29).
- Next / open: no next item chosen yet.

### 2026-10-29 — Claude Code — TurtleBot3 preset and calibration (item 2)

- Changed:
  - `dist/drive.mjs`:
    - `ROBOTS` specification for `kinetic` and `turtlebot3`, and `TB3_FIT`.
    - `supportLoads` generalized to N casters.
    - Firmware v/w limits without wheel rescaling for the TurtleBot3.
    - Desired-trajectory channels `desX`, `desY`, `desYaw` (CSV columns `desired_*`).
  - `dist/app.js`, `dist/index.html`, and `dist/style.css`:
    - Robot picker that can select either robot; the TurtleBot3 hides the builder sliders and disables the ramp.
    - Simplified Waffle Pi drawing.
    - Desired series and a position-error figure in Plots.
    - Lab 1 A, B, and C examples, and a TurtleBot3 section in "About the model".
  - `dist/plots.mjs`: dotted line patterns.
  - Tests: new `tests/fixtures/turtlebot3-lab.json` (numbers only) and `tests/turtlebot3.test.mjs` (8 tests). `package.json`, README, and `AGENTS.md` updated.
- Verified:
  - Kinetic rover unchanged. Before refactoring, 144 cases (8 programs × 3 designs × 3 terrains × noise on/off) were fingerprinted, and all 144 were bit-identical after the refactor. They were identical again after the desired channels were added, with those channels excluded from the hash.
  - `npm test` 31/31, `npm run check` pass.
  - Headless Chrome on 5174: the picker selects the TurtleBot3, the ramp is disabled and the sliders hidden, the v = 0.20 circle opens as in the lab figure, and 10 figures render. Switching back to Kinetic restores the builder, and a ramp run succeeds. Zero console errors.
  - Not verified: real devices.
- Status: committed together with this entry and pushed to `origin/main` (owner's go-ahead, 2026-10-29).
- Next / open: item 3, the guided lesson.

### 2026-10-29 — Claude Code — closed-loop control (item 1)

- Changed:
  - `dist/physics.mjs`: `SENSORS`, `drive(v, w)`, and `if`/`while` on any sensor with four operators.
  - `dist/drive.mjs`: drive-to-wheel mapping with saturation scaling, `sensor()`/`test()` that read samples only, and `while` execution.
  - `dist/app.js` and `dist/index.html`: two new examples ("Turn 90° with the gyro", "Drive 0.5 m by encoders") and a rewritten command reference with a sensor list.
  - Tests: 1 parser test, the reject list extended, and 2 drive tests. README and `AGENTS.md` updated.
- Verified:
  - `npm test` 23/23, `npm run check` pass.
  - `drive(0.2, 1)` gives a 0.999 rad/s yaw rate at 0.199 m/s. Wheel targets match (v ± w·W/2)/R exactly. At saturation the wheel ratio is kept.
  - A gyro-guided 90° turn stops at about 96° true (polling plus braking). An encoder-guided turn travels one wheel circumference within 3 cm.
  - Headless Chrome on 5174: both new examples run, invalid programs show line-numbered errors and do not start, zero console errors.
  - Not verified: real devices.
- Known limit: on ice, a slow 90° turn shows only about 2° between the gyro and the encoders, because in-place scrubbing is under-modelled (see the TurtleBot gap in Open items). The tests therefore make no "gyro beats encoders on ice" claim yet.
- Status: committed together with this entry and pushed to `origin/main` (owner's go-ahead, 2026-10-29).
- Next / open: item 2 (TurtleBot3 preset and calibration).

### 2026-10-29 — Claude Code — wheels turn, terrain, sensors, MATLAB-style plots

- Changed:
  - New `dist/drive.mjs`: terrain, friction curve, motors with PI loop, planar dynamics, load transfer, encoders, IMU, range sensor, odometry, program runner, log, and CSV.
  - New `dist/plots.mjs`: figures with crosshair, tooltip, keyboard reading, and min/max decimation.
  - `dist/physics.mjs`: the `wheelVelocity` sign is fixed.
  - `dist/app.js`: wired to the new sim, with terrain selector, Plots tab, rotating wheels and caster, shaded rough terrain, icy floor, odometry trail, drive telemetry (speed, slip, dynamic margin, range), and model text updated in the modals.
  - `dist/index.html` and `dist/style.css`: Plots tab and panel, terrain buttons, odometry toggle.
  - Tests: new `tests/drive.test.mjs` (13 tests), and the spin expectation in `tests/physics.test.mjs` changed to -1.5.
  - `package.json`: scripts cover the new files. `README.md` and `AGENTS.md` updated.
- Verified:
  - `npm test` 20/20, `npm run check` pass.
  - The tests check independent expectations: lever-arm loads and load transfer; friction peak and asymptote; stall torque and free speed; a parked rover reading 9.81 m/s²; steady-state speed R·ω; turn yaw rate against R(ωr−ωl)/W, with the gyro reading it; centripetal a_y = ω·v and a_x = ω²·0.08 from rigid-body kinematics; encoder tick counting; ice acceleration ≤ μ·g; odometry drifting more than 3× on ice; roll and pitch rates only on rough ground; a tall rover lifting the caster under hard braking; seed determinism across frame splits; CSV shape.
  - In the browser: headless Chrome 155 over CDP against this repo on 127.0.0.1:5174. Every tab worked. A square run on rough ground and a hard start plus spin on ice both completed. Hovering a figure showed the tooltip. After a reload, saved runs replayed with identical odometry errors (4.7 cm and 8.4 cm). At 390 px phone width there was no horizontal overflow. Zero console errors or exceptions.
  - Correction to the 2026-10-28 entry: the server answering on 5173 was the `robotikLab` copy, not this repo.
- Status: committed together with this entry and pushed to `origin/main` (owner's go-ahead, 2026-10-29).
- Next / open: the owner reviews the feature in a browser on 5174 and decides about the slider labels. The next task is closed-loop control (`drive(v, w)`, sensor conditions, `while`).
