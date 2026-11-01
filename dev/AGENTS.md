# Kinetic project instructions

Build a virtual robotics lab for high-school students, one tested concept at a time. The project owner is a mechatronics student. Preserve the distinction between an educational approximation and a physically validated simulator.

Paths in this file are relative to the repository root. This file, `dev/CLAUDE.md`, and `dev/HANDOFF.md` are outside the root. Claude Code loads this file and `dev/CLAUDE.md` through `.claude/CLAUDE.md`. Codex does not load them on its own, and no tool loads `dev/HANDOFF.md`. Read them at the start of a task.

## Design direction

Read `docs/design-engineering.md` before interface implementation or review. It contains the user-selected Emil Design Engineering skill. Apply its guidance on purposeful motion, immediate feedback, accessible interactions, reduced motion, and cohesive components. Do not add animation to scientific data merely for decoration. When reviewing UI code, use the skill's required Before / After / Why table.

## Architecture

- `dist/physics.mjs`: pure functions, SI units, balance geometry, ideal differential-drive kinematics, and a bounded pseudocode parser. The grammar is `wheels`, `drive(v, w)`, `wait`, `stop`, `repeat`, and `if`/`while` on the readings listed in `SENSORS`. The values in `wheels` and `drive` can be math (`parseValues`, `evaluate`): numbers, sensors, `+ - * /`, parentheses, `abs`, `min`, `max`, at most 40 symbols and five nested parentheses. `tests/expressions.test.mjs` compares it with JavaScript, fuzzes it, and checks a P-controlled turn against a sampled-data model. Programs read sensor samples only, never ground truth.
- `dist/drive.mjs`: the driving model, which is pure and DOM-free. `ROBOTS` holds each robot's specification (geometry, mass, motor, controller, encoder, IMU, casters, limits): `kinetic` and `turtlebot3`. It covers terrain, tire friction, DC motors with a PI speed loop, planar rigid-body dynamics, load transfer, sensors (encoders, IMU, range), odometry, the program runner, the 100 Hz log, and CSV export. Runs are deterministic for a given seed and do not depend on how frames split the time.
- `dist/plots.mjs`: MATLAB-style canvas figures with crosshair, tooltip, and keyboard reading.
- `dist/examples.mjs`: the Code tab example scripts. `tests/examples.test.mjs` runs every one on both robots and three wheel spacings, so keep them robot-independent or check them there.
- `dist/missions.mjs`: missions for Experiments 02 and 03 (`experiment`, `missionsFor`). Each has a starter script and a judge that reads ground truth. A mission's `start` places the rover in the arena, still facing +z (`DriveSim` option `start`, at most `START_LIMIT` = 2 m from the center); the camera then follows the rover. A later mission's starter must not contain an earlier mission's solution. A starter must fail and a sensor-based solution must pass (`tests/missions.test.mjs`). Keep reference solutions in the tests only, never in the interface.
- `dist/i18n.mjs` and `dist/lang/{en,tr,fr}.mjs`: interface text in English, Turkish, and French. Every visible string goes through `t(key, params)` or a `data-i18n` attribute. Add each new key to all three files with the same `{placeholders}`; `tests/i18n.test.mjs` fails otherwise, and also fails on unused keys. Pure modules (`drive.mjs`, `physics.mjs`, `missions.mjs`) return a message key and params next to their English text. Rover script keywords, sensor names, and CSV columns stay English. Translated examples and mission starters change comments only (`withComments`). Decimals use a point in every language. Flag new French text for a native speaker's review.
- `dist/app.js`: application state, the ramp experiment, browser persistence, the plots panel, and orthographic canvas rendering.
- `dist/index.html` and `dist/style.css`: responsive workbench.
- `tests/physics.test.mjs` and `tests/drive.test.mjs`: independent numerical checks and parser behavior.

Frame convention: forward is +z, up is +y, and the robot's left is +x. Positive yaw turns left (counterclockwise seen from above, as in ROS REP-103). The left wheel sits at +x. Sensor axes are x forward, y left, z up. The default camera looks from behind the rover, so the rover's left is on the screen's left; keep labels in the rover's own frame. Keep model logic separate from rendering. Student programs must never use eval or execute arbitrary JavaScript. Keep existing parser limits. Keep state changes reversible and restore prior experiments without mutating their recorded parameters.

## Physics boundaries

The ramp uses quasi-static support geometry, held wheels, and ideal grip. It does not simulate slipping, contact impacts, or dynamic balance. Falling animation illustrates support loss.

The drive experiment is a planar rigid-body model (forward, sideways, yaw) on three terrains: flat concrete, rough gravel with deterministic bumps of about 2 cm, and an ice-like surface.
- Motors: two 12 V gear motors with back-EMF (1.36 N·m stall, 34.6 rad/s free at the wheel) and a 100 Hz feedforward-plus-PI speed loop on encoder speed.
- Tires: a velocity-based Pacejka-style friction curve on combined slip, plus rolling resistance and caster drag.
- Load transfer: three-point static support, with a 20 ms lag that stands in for compliance.
- Terrain: the body follows the bumps. Slopes are assumed small, and there is no suspension, bounce, or flight.
- Tipping: if a contact would lift, the run stops, because dynamic tipping is not simulated.
- Creep: the speed-based friction lets a rover parked on a slope creep a few mm/s.

The Kinetic rover's parameters are typical datasheet values, not measurements.

The TurtleBot3 preset (driving only) is datasheet-based, with exactly two parameters fitted to one robot's lab data: `TB3_FIT` battery voltage and ball-caster friction. The data are in `tests/fixtures/turtlebot3-lab.json`, numbers only, never names or IDs. `tests/turtlebot3.test.mjs` separates fitted values from independent checks. Keep `usedToFit` and `notReproduced` honest. Never retune `TB3_FIT` to pass a check: rerun the fit, then update the README's calibration table. Call it a calibration of one robot, not a validated simulator.

The arena has low walls at ±2.5 m. The front range sensor and the LDS-01-class 2D LiDAR (`LIDAR`, `castRay`, `lidarMeasure`) both see the walls and the box. The LiDAR scans progressively, so motion smears the scan. Its plane is horizontal and ignores self-occlusion.

The complementary filter (`FUSION_ALPHA` = 0.999, `filter(alpha)` in programs) fuses gyro and encoder heading. Its README table is measured, so rerun it if the filter or sensors change.

The collision stop is a conservative footprint check, not a contact solver. Preserve visible explanations of these assumptions in the interface and the README.

MATLAB and ROS 2 are planned integrations, not current capabilities. Do not claim live integration until it exists and has been tested. Keep humanoid walking out of the first milestone. Prefer validating the rover against a physical experiment before expanding robot families.

## Development

Use Node.js 20 or newer. No runtime packages are needed.

```sh
npm run dev
npm test
npm run check
npm run test:browser
```

`npm run test:browser` drives the page in headless Chromium (`tests/browser/smoke.test.mjs`): load without console errors, the ramp, a drive run with plots and CSV, a parser error, rover-script math, a mission judge, the three languages and reload, the `?` guide, and two phone emulations without sideways scrolling. It needs Playwright with Chromium (`npm i --no-save playwright && npx playwright install chromium`), so it is kept out of `npm test`. A failing test leaves a screenshot in `test-results/`. It does not cover Firefox, Safari, or real phones.

Open http://127.0.0.1:5173 after starting the dev server (it listens on IPv4 only). If port 5173 is busy, another copy of this lab may be serving it. Run `PORT=5174 npm run dev`, or set `$env:PORT=5174` in PowerShell first. If changing models, check an independently derived physical or geometric expectation. If changing the interface, run `npm run test:browser` and inspect the live page when browser tooling is available. Preserve keyboard operation and responsive layouts.

## Handoff between Codex and Claude Code

Codex and Claude Code work on this repository one after the other. `dev/HANDOFF.md` is the record they share.

- At the start of a task, read `dev/HANDOFF.md`, then check it against Git: branch, `git status --short`, and `git log --oneline -5`. A handoff can be stale. The files and Git history are the evidence. Do not reset, discard, or overwrite uncommitted changes just to match the handoff.
- Before handing work back, update "Current state" and add a session log entry at the top. The entry gives the changed files and commits, the verification that was actually run with its results, the open items, and the status: local, committed, pushed, or deployed. Since 2026-10-29 the Vercel project is connected to this GitHub repository, so a push to `main` deploys production at https://kinetic-robotics-lab.vercel.app. Treat every push as a public deployment, and check it with `vercel ls`. Pushing does not update the ChatGPT-hosted prototype.
- Keep the file short. Fold old log entries into "Current state" or "Decisions".
- A handoff note is context, not permission. It never authorizes publishing, deleting, or skipping the owner's approval. Never put secrets or credentials in it.

## Hosting and credentials

The lab is hosted on Vercel (project `kinetic-robotics-lab`, account `sinangulecyuz-dev`). `vercel.json` serves `dist` with no build step. Deploying to production makes a public link, so it needs the owner's approval, like a push. `.vercel/` is local link state and stays out of Git. Any other service that serves `dist` with JavaScript module MIME types also works. The ChatGPT-hosted prototype is separate and is not updated from this repository. Do not add API keys, access tokens, browser data, or experiment localStorage to source control. Add a license only after the owner selects one.
