# Kinetic — Virtual Robotics Lab

A browser-based robotics lab for high-school students. Build a differential-drive rover, predict its balance on a ramp, program it in a small pseudocode language, and compare what its sensors report with what really happened. The interface is in English, Turkish, and French.

Under the interface is a planar rigid-body model integrated at 10 kHz: DC motors with a 100 Hz PI speed loop, a Pacejka-style tire friction curve, load transfer, and flat, rough, or slippery ground. Encoders, a noisy IMU, a range sensor, and a 2D LiDAR are logged and plotted in MATLAB-style figures. A TurtleBot3 Waffle Pi preset is calibrated to one robot's lab data. This is an educational model and a calibration of one robot, not a validated simulator; "What the model means" states its assumptions and limits.

Live: https://kinetic-robotics-lab.vercel.app (Vercel, see "Hosting").

## Run

This is a buildless, dependency-free static site. Install Node.js 20 or newer, open this folder in a terminal, and run:

```sh
npm run dev
```

Open http://127.0.0.1:5173. The server listens on IPv4 only, so `localhost` can fail where it resolves to IPv6 first. If port 5173 is already taken, run `PORT=5174 npm run dev`. There is no dependency installation step. Alternatively, serve `dist/` with any HTTP static server. Entry point: `dist/index.html`. Modules require HTTP rather than `file://`.

```sh
npm test
npm run check
```

The first command runs 83 model, dynamics, sensor, LiDAR, filter, parser, rover-script math and variables, wind, header sky, TurtleBot3 calibration, mission, example, and translation tests. The second checks JavaScript syntax.

An optional browser smoke test drives the real page in headless Chromium. It is the only part that needs a package, so it stays out of `npm test`:

```sh
npm i --no-save playwright && npx playwright install chromium
npm run test:browser
```

It checks loading without console errors, the ramp, a drive run with plots and CSV export, a parser error, rover-script math, mission judges in Experiments 02 to 04, outdoor wind, the three languages across a reload, the `?` guide, and two phone screens without sideways scrolling. Phone screens are Chromium emulation only; it does not test Firefox, Safari, or real phones.

The app is a static frontend; browser localStorage stores designs and experiments per device. There is no classroom backend in this version.

## What the model means

All physics functions in `dist/physics.mjs` use SI units; the builder displays centimeters. Center of mass sums the masses of a 1.8 kg chassis, a 0.5 kg battery, and a variable 0–3 kg payload. The structure changes size without changing chassis mass, an intentional teaching simplification. Payload height specifies its center above a 20 cm reference deck.

The two drive contacts and caster form a triangle. The tilt table rotates around the forward axis, lifting the rover's left side (+x). The gravity intersection in ramp coordinates is `x_com - y_com * tan(angle)` and `z_com`. Signed perpendicular distance to the closest triangle edge is the static margin. A binary search finds the first zero-margin positive tilt. Static contact loss triggers an illustrative falling animation; there is no contact solver, sliding, motor holding torque model, deformation, or impact simulation. Assume held wheels and ideal grip.

The driving experiment lives in `dist/drive.mjs`. Frame convention: forward is +z, up is +y, the robot's left is +x, and positive yaw turns left (ROS REP-103). The rover is a planar rigid body (forward, sideways, yaw), integrated at 10 kHz with semi-implicit Euler.
- **Motors.** Each 0.075 m wheel is driven by a 12 V gear motor with back-EMF, gearbox friction, and reflected inertia: 1.36 N·m stall torque and 34.6 rad/s free speed at the wheel. `wheels(left, right)` sets speed targets. A 100 Hz firmware-style loop (feedforward plus PI on encoder speed, with anti-windup) sets each motor voltage.
- **Tires.** Each tire's force follows a velocity-based Pacejka-style curve on combined longitudinal and lateral slip. Grip peaks at 5 cm/s of slip and settles at the sliding coefficient. The model adds rolling resistance and a drag force on the swivel caster.
- **Terrain.** Concrete has μ 0.90 peak and 0.75 sliding, gravel 0.65 and 0.55, grass 0.55 and 0.45, ice 0.15 and 0.10. Gravel adds deterministic bumps of about 2 cm, grass the same pattern at half height. The body follows them through a support plane fitted to the three contacts, so slopes add a gravity component. Grass values are typical for short dry lawn (rolling resistance 0.08), not measurements. Indoors offers concrete and ice; outdoors offers grass, gravel, and ice.
- **Wind (outdoors, switchable).** Drag pushes the body on each axis, 0.5·ρ·Cd·A·v² with ρ 1.2 kg/m³, Cd 1.1, and v the air speed relative to the body. Areas: Kinetic about 0.08 m² front and side (chassis and wheels 0.14 m tall, plus the payload box), TurtleBot3 0.040 m² front and 0.043 m² side. The push acts at the body origin, so a centre of mass ahead of it turns the nose into the wind; the Kinetic rover's free caster offers little sideways grip, so it weathervanes clearly. A random wind has a mean of 2–9 m/s from any direction, chosen from the run's seed; gusts (a 25 % standard deviation of the speed) and a direction wobble are first-order random processes with a 2 s time constant, updated at 100 Hz from their own random stream. `tests/wind.test.mjs` checks the first push of a steady wind against the formula to 10⁻⁹, mirror symmetry, determinism across frame splits, and that wind off changes nothing. A limit: the friction model has no static friction, so a parked rover creeps in wind, about 3 cm in 12 s at 8 m/s on concrete, where a real one would likely hold still. On ice the same wind slides it about 2 m in 7 s. CSV columns `wind_speed_m_s` and `wind_toward_rad` (counterclockwise from +z, like heading) record it.
- **Load transfer.** Normal loads come from the three-point static support. The point where gravity minus acceleration meets the ground is lagged by 20 ms, which stands in for tire and chassis compliance. If any contact would lift, the run stops and says which one, because dynamic tipping, bouncing, and jumps are not simulated.
- **Encoders.** 1920 counts per wheel revolution. Odometry is dead reckoning from encoder counts only, so it drifts when wheels slip.
- **IMU.** MPU-6050 class, 100 Hz. The accelerometer reading comes from the IMU point's own 3D trajectory and the gyro reading from the change of the body axes. Both have noise, a seeded bias, and 16-bit steps.
- **Range sensor.** It looks up to 3 m ahead at 20 Hz, with about 1% noise. Low walls at ±2.5 m surround the arena, and the range sensor sees them as well as the box.
- **2D LiDAR.** Both robots carry an LDS-01-class LiDAR: 360 beams at 1°, 5 scans per second, 0.12–3.5 m. Accuracy is ±10 mm below 0.5 m and ±3.5% beyond, taken as 2σ, with readings in millimetres. Each 10 ms adds the next 18 beams from the pose at that moment, so a moving rover sees a slightly smeared scan. The scan plane is horizontal and ignores the robot's own body. LiDAR noise uses its own random stream, so the IMU noise sequence is unchanged.

Runs are deterministic for a seed. Saved runs store their seed, so plots can be regenerated exactly.

Known limits: slopes are assumed small, the friction model lets a parked rover creep a few mm/s on a slope, and every parameter is a typical datasheet value that has not been measured on a physical robot. A conservative circular footprint still stops the rover before a collision.

Student programs can command each wheel with `wheels(left, right)`, in rad/s. They can also command the whole rover with `drive(v, w)`, in m/s and rad/s, like ROS `/cmd_vel`. That command maps to wheel targets (v ± w·W/2)/R. If a wheel would pass 10 rad/s, both wheels are scaled down together, so the curve keeps its radius.

The values in `wheels` and `drive` can be math on sensor readings: numbers, sensor names, `+ - * /`, parentheses, `abs(x)`, `min(a, b)`, and `max(a, b)`, for example `drive(0, 0.05*(90 - heading))`. A tokenizer and a recursive-descent parser build a small tree, and the simulator evaluates it from the latest sensor samples each time it reaches that line. There is no `eval`. Math without sensors is computed before the run and keeps the range checks above. Math with sensors is clipped to the same limits during the run, as a motor driver saturates. A division by zero has no value and stops the run on its line; a LiDAR beam with no return (infinity) saturates. Each instruction allows 40 symbols of math and five nested parentheses. `if` and `while` still compare one sensor with one number. `let name = math` stores a number in a variable (up to 10 per program), and a later `let` with the same name replaces it, so `let total = total + error*0.1` keeps the running sum an integral term needs. Variables can appear in math and in `if`/`while` tests. A name no `let` sets is a parse error; reading a variable before its `let` has run stops the run on that line. Names cannot be sensors, `abs`, `min`, `max`, or keywords.

The "P control · smooth 90° turn" example holds each command for 0.1 s. A sampled-data model of that loop, h ← h + 0.1·(180/π)·k·(90 − h) with the turn rate capped where a wheel reaches 10 rad/s, predicts 82.1° after 2 s for a gain k = 0.02, and a peak of 98° for k = 0.3. On the default Kinetic rover without noise, the simulator gives 82.5° and a peak of 108°. The model leaves out motor lag, the likely reason for the larger simulated overshoot. `tests/expressions.test.mjs` checks the first within 1.5° and that both overshoot.

`if` and `while` test sensor readings with `<`, `>`, `<=`, or `>=`. The readings are `distance`, `heading` (gyro-integrated IMU yaw in degrees), `odom_heading`, `gyro_z`, `encoder_left`, `encoder_right`, `odom_x`, `odom_y`, `time`, and the LiDAR beams `lidar_front`, `lidar_left`, `lidar_back`, `lidar_right` (0 when closer than 0.12 m, infinity with no return), plus `lidar_min` and `lidar_min_angle`, and the filtered estimates `fused_heading`, `fused_x`, `fused_y`. A program always reads the latest sensor sample and never sees ground truth.

The 30-second run limit, parser depth limit, and instruction budget bound student programs. A `while` loop without a `wait` hits the instruction guard. User code is parsed into a small AST, never evaluated as JavaScript.

The Plots tab draws nine figures from the 100 Hz log: trajectory (true path vs. odometry), heading (true, odometry, and gyro integration), wheel speed (command vs. encoder), wheel slip, encoder counts, motor current, gyroscope, and accelerometer. Lines use MATLAB colororder slots 1, 2, and 4. Slot 3 (#EDB120) is skipped because it fails contrast on a white background. **Download CSV** writes one unit-labelled column per channel, with simulator-only values prefixed `true_`, so you can run `T = readtable('kinetic-run-1.csv')` in MATLAB. **LiDAR CSV** writes one row per scan, with 360 ranges from 0° counterclockwise and 0 for no return, like the LDS-01 and the filter in a typical MATLAB `polarplot` script. The Plots tab also draws the last scan as a polar plot. That is a file export, not a live MATLAB connection.

### TurtleBot3 Waffle Pi calibration

The TurtleBot3 preset is for driving only. It starts from datasheet values:
- 0.033 m wheels, 0.287 m track, 1.8 kg, and two ball casters.
- Dynamixel XM430-W210 servos: 3.0 N·m stall and 77 rpm at 12 V.
- 4096-count encoders.
- Firmware limits of 0.26 m/s and 1.82 rad/s, applied to `drive(v, w)` without rescaling the wheels.

Two parameters were then fitted to one robot's measurements from an ME425 lab course. The measurements are in `tests/fixtures/turtlebot3-lab.json`, numbers only. Every other row below is an independent check, and `tests/turtlebot3.test.mjs` enforces the matching ones.

| Quantity | Measured (≈ read from plots) | Simulated | Role |
|---|---|---|---|
| v = 0.20 m/s circle, final odometry heading | 333° | 333.5° | fitted: battery 10.93 V (outer wheel at the motor limit) |
| Turning in place at 1 rad/s, encoder minus IMU | 9.4° per turn | 9.4° per turn | fitted: ball-caster friction 0.261 |
| Circles at w = 0.3, v = 0.05 / 0.10 / 0.15, final heading | 360 / 358 / 357° | 358.8 / 359.4 / 359.6° | predicted, within ±3° reading error |
| Circles at v = 0.1, w = 0.5 / 0.8, final heading | 360 / 360° | 359.3 / 357.1° | predicted |
| v = 0.20 m/s circle, final odometry-vs-desired error | 0.35 m | 0.33 m | follows from the battery fit |
| Other circles, final error | 0.003–0.012 m | 0.004–0.005 m | predicted, within 1 cm |
| v = 0.15 m/s circle, final error | 0.045 m | 0.004 m | **not reproduced** |
| Gyro during a 0.5 rad/s spin (Lab 0) | 0.47–0.50 rad/s | 0.469 rad/s | predicted (at the edge) |
| IMU at rest: az mean and spread, ax mean | 9.9, 9.3–10.4, −0.16 m/s² | matched | fitted |
| Straight line at 0.1 m/s, forward leg by odometry | 0.275–0.28 m | 0.297 m | **not reproduced** (forward/backward asymmetry) |

The fit also produces a testable prediction. Ball-caster drag makes the wheels creep, so odometry should overstate straight-line distance by about 3%. A tape measure can check this without the IMU.

The 31.4 s run at w = 0.2 rad/s exceeds the 30 s limit and is not replayed. Lab 0's forward run was recorded on another day with an unknown battery charge and is not used.

All of this comes from one robot, on one floor, at one battery charge, with values read from plots. It is a calibration, not a general validation. The Plots tab shows the desired (commanded) path and a Lab 1–style error figure, which separates two things the lab could not tell apart: the robot leaving its command (true vs desired) and the odometry misjudging the robot (odometry vs true).

### Complementary filter

Every 0.01 s the fused heading is updated as α·(fused heading + gyro turn) + (1 − α)·encoder heading: the gyro for quick changes, the encoders over the long run. The crossover time constant is τ = α·T/(1 − α). Filtered odometry adds up encoder distance along the fused heading. Programs set α with `filter(alpha)`: 1 trusts only the gyro, 0 only the encoders.

The default is α = 0.999 (τ ≈ 10 s), not the textbook 0.98 (τ ≈ 0.5 s). Both sensors here err slowly: wheel slip and caster drag bend the encoder heading, and bias tilts the gyro. A fast crossover therefore hands control back to the encoders before their error shows. The comparison below is the mean of 4 seeds and is enforced loosely by `tests/fusion.test.mjs`:

| Test | α = 0 (encoders) | 0.98 | 0.999 (default) | 1 (gyro) |
|---|---|---|---|---|
| TurtleBot3, 4 turns in place, heading error | 37.4° | 37.0° | 24.1° | 0.6° |
| Kinetic, square on ice, position error | 9.4 cm | 8.6 cm | 4.6 cm | 4.1 cm |
| Kinetic, square on concrete, position error | 1.2 cm | 1.2 cm | 1.3 cm | 1.6 cm |
| Kinetic, parked 25 s, heading error | 0.00° | 0.07° | 1.3° | 3.6° |

No single α wins everywhere. Neither sensor is an absolute reference, so a real robot would add one, such as a compass or LiDAR scan matching.

### Experiment 02: Where am I?

The lesson strip switches between Experiment 01 (balance on a ramp), Experiment 02, Experiment 03, and Experiment 04 (below). Experiment 02 is about odometry, the gyro, and ground truth. It has three missions in `dist/missions.mjs`:

| Mission | Robot and ground | Passes when |
|---|---|---|
| Stop 20 cm from the box | Kinetic rover, flat | the true gap is 20 ± 3 cm and the rover did not touch the box |
| Turn exactly once around | TurtleBot3, flat | the true heading change is 360 ± 3° and the rover stayed within 5 cm |
| Close a square on ice | Kinetic rover, slippery | the path is at least 1.6 m and the rover ends within 10 cm of the start |

Missions are judged on the simulator's ground truth, which student programs never see. That plays the role of a motion-capture system or a tape measure in a real lab. Each starter script is a reasonable first try that falls short on purpose: it ignores braking, trusts the encoders, or uses timing on ice. The hint appears after a failed attempt.

`tests/missions.test.mjs` checks, for four seeds each, that every starter fails and a sensor-based reference solution passes. The reference solutions live only in the tests, so the lab never shows the answers. Completed missions are stored per device.

### Experiment 03: Follow the wall

Experiment 03 is about proportional (P) control: a command that grows with the error, written with math on sensors. Its missions start the rover near a wall instead of at the center, still facing +z, so odometry keeps its frame. The camera then follows the rover itself.

| Mission | Start | Passes when |
|---|---|---|
| Park 0.5 m from the wall | x = −1.5 m, z = −2 m, wall 4.2 m ahead of the front sensor | the true gap from the front sensor to the wall is 50 ± 2 cm |
| Follow the wall at 0.5 m | x = 1.7 m, z = −2 m, 0.8 m from the left wall | the rover covers at least 3.5 m, and between z = 0 and z = 1.8 m it stays 0.5 ± 0.1 m from the wall |

The park starter drives at 0.5 m/s and brakes at the line, so it stops 4–9 cm short; a speed proportional to the remaining distance parks within 1 cm. The wall starter steers in proportion to `lidar_left` alone and runs into the wall.

That second result is physics, not a tuning problem. Steering changes the heading, and only the heading changes the distance, so distance feedback alone acts on a double integrator and keeps overshooting. When the rover turns, the left beam also meets the wall at a slant and reads d / cos θ, which pushes it further. In the simulator every distance-only controller tried, on `lidar_left` or on the true perpendicular distance `lidar_min`, with gains from 0.2 to 4, hits the wall. Adding a term that steers back toward running parallel works. With the gyro heading, gyro drift biases the distance: over 40 seeds the largest miss is 8.3 cm. With the wall angle from the LiDAR (`lidar_min_angle − 90`), it is 5.1 cm. The tolerance of ±10 cm lets both pass.

### Experiment 04: Hold the line

Experiment 04 is about the integral term of PID, written with `let`. Its one mission runs outdoors on ice: the rover starts 0.5 m from the left wall (x = 2 m, z = −2 m), and a 5 m/s wind with gusts (15 %) blows toward −x, away from the wall. It passes when, between z = −1.2 m and z = 1.8 m, the true distance to the wall averages within 0.5 ± 0.024 m and never misses by more than 10 cm. It is judged only in that wind.

The starter is the P-and-D wall follower from Experiment 03 (`lidar_min` and `lidar_min_angle`). In the wind it settles a steady 2.6–6.5 cm off over 40 seeds; adding a running sum of the error (`let sum = sum + e*0.05`, gain 1) brings the average to 2.2 cm or less, and the largest miss to 9.1 cm or less, on all 40. Part of what remains is the sensor: `lidar_min`, the smallest of many noisy beams, reads about 1.5 cm short (0.485 m for a true 0.5 m), and no controller can remove a sensor's bias.

The margins are thin (2.6 against 2.4, and 2.2 against 2.4), and other mission ideas did not separate starter from solution, so Experiment 04 has one mission. Tried and dropped: an integral on heading in a crosswind (the motors' own PI wheel-speed loops already cancel a push that only twists the rover), holding heading in place on ice, parking on ice in a tailwind (the rover slides away), a fast turn without overshoot for the D term (the turn-rate limit dominates, so P alone is within 0.1 s of PD), parking on ice with a derivative from `distance` (noise), and a windup mission from 0.8 m (the best anti-windup solutions overlapped the starter).

The orthographic canvas renderer uses the same dimensions and transforms as the models. It supports orbit, zoom, top view, and overlay toggles without external packages. The static floor grid is illustrative; exact measurements appear in the controls and telemetry.

## Languages

The header has a language picker: English, Türkçe, Français. On a first visit the lab uses the browser's language if it is one of the three, and English otherwise. The choice is saved with the rest of the lab.

- Visible text lives in `dist/lang/en.mjs`, `tr.mjs`, and `fr.mjs`, one key per string, and `dist/i18n.mjs` looks it up. The page marks static text with `data-i18n` attributes. A key missing from a translation falls back to English.
- Rover script keywords (`wheels`, `drive`, `while`), sensor names, and CSV columns stay in English, as in a real programming language. Example scripts and mission starters translate only their comments: the code lines are copied from the English version, so every language runs the same program.
- Numbers use a decimal point in every language, to match the code, the CSV files, and MATLAB.
- Simulator, parser, and judge messages carry a key and values, so a finished run, an error, or a saved result is shown again in the new language after a switch.
- `tests/i18n.test.mjs` checks that all three dictionaries have the same keys and placeholders, that code inside the help text is unchanged, that translated examples and starters run the same code, and that every key the interface uses exists and every key is used.
- The French text was written by Claude Code and still needs a review by a native speaker. The Turkish text needs a review by the owner.

## Header sky

The dark header shows the sun by day and the moon, with its phase, by night, placed by the visitor's local clock (`dist/sky.mjs`). It is decoration, not astronomy: it assumes solar noon at 12:00 and a mid-northern day length (12 ± 3.4 h over the year), and the moon crosses the sky centred on 12:00 + 24 h × phase. It is redrawn once a minute and never animated. `tests/sky.test.mjs` checks the phase against the new moon of 2024-01-11 and the full moon of 2024-01-25.

## Persistence

Design, script, terrain, language, and the last 30 completed runs use browser localStorage (`kinetic-v1`). This is per-device, not a multi-user classroom backend. Resets preserve design. Run restoration restores parameters and, for drive runs, the executed script and terrain. Sensor logs are not stored. A drive run stores its seed instead, and its plots are replayed from design, terrain, script, and seed. Runs saved before seeds existed replay under the current model with a seed derived from their id. No analytics or external requests are required by the app.

## Hosting

The lab is a Vercel project (`kinetic-robotics-lab`, account `sinangulecyuz-dev`). `vercel.json` serves the `dist` folder with no build step, so only the app is public. Tests, docs, and lab data are not served. Production: https://kinetic-robotics-lab.vercel.app. The Vercel project is connected to this GitHub repository, so every push to `main` deploys production. A manual deploy from a working tree is `vercel deploy`.

## Next bricks

1. Validate dimensions, ramp thresholds, motor constants, and friction against a physical rover. The CSV columns are meant to line up with logs from a real robot.
2. Compare full curves against raw lab logs (CSV or `.mat`) instead of values read from plots. Run the tape-measure test of the predicted 3% straight-line overstatement, and look for the cause of the two unreproduced effects. Evaluate Webots as a reference simulator for the dynamics.
3. Add attachable structural parts with mass and inertia, and a common robot specification.
4. Add omnidirectional bases, then an industrial arm. Treat humanoid standing before gait control.
5. Add equivalent MATLAB / ROS 2 examples and a validated controller bridge. No live MATLAB or ROS 2 integration is claimed in this milestone.

## Development notes

`dev/` holds the instructions and session log for the AI coding agents used on this project.
