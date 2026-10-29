# Kinetic — Virtual Robotics Lab

First student-facing milestone: a differential-drive rover with an adjustable structure and payload, a ramp-balance experiment, an editable pseudocode controller, and a local experiment notebook. The rover drives on flat, rough, or slippery ground. Its encoders, IMU, motors, and range sensor are logged and plotted in MATLAB-style figures.

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

The first command runs 43 model, dynamics, sensor, LiDAR, parser, TurtleBot3 calibration, and mission tests. The second checks JavaScript syntax. The app is a static frontend; browser localStorage stores designs and experiments per device. There is no classroom backend in this version.

## Continue in Codex or Claude Code

Open this folder in your preferred coding tool. `AGENTS.md` explains the architecture, project boundaries, and validation workflow. `CLAUDE.md` points Claude Code at the same instructions. `HANDOFF.md` records where the last session left off, so either tool can pick up the work. `docs/design-engineering.md` preserves the design skill selected by the project owner.

The existing hosted prototype is https://kinetic-robotics-lab.famousbadge2.chatgpt.site (private ChatGPT access). This export is independent of the hosting configuration: pushing it to GitHub does not automatically redeploy that prototype. Deploy `dist/` to a static host, or explicitly publish later changes through ChatGPT Sites.

## What the model means

All physics functions in `dist/physics.mjs` use SI units; the builder displays centimeters. Center of mass sums the masses of a 1.8 kg chassis, a 0.5 kg battery, and a variable 0–3 kg payload. The structure changes size without changing chassis mass, an intentional teaching simplification. Payload height specifies its center above a 20 cm reference deck.

The two drive contacts and caster form a triangle. The tilt table rotates around the forward axis, lifting the rover's left side (+x). The gravity intersection in ramp coordinates is `x_com - y_com * tan(angle)` and `z_com`. Signed perpendicular distance to the closest triangle edge is the static margin. A binary search finds the first zero-margin positive tilt. Static contact loss triggers an illustrative falling animation; there is no contact solver, sliding, motor holding torque model, deformation, or impact simulation. Assume held wheels and ideal grip.

The driving experiment lives in `dist/drive.mjs`. Frame convention: forward is +z, up is +y, the robot's left is +x, and positive yaw turns left (ROS REP-103). The rover is a planar rigid body (forward, sideways, yaw), integrated at 10 kHz with semi-implicit Euler.
- **Motors.** Each 0.075 m wheel is driven by a 12 V gear motor with back-EMF, gearbox friction, and reflected inertia: 1.36 N·m stall torque and 34.6 rad/s free speed at the wheel. `wheels(left, right)` sets speed targets. A 100 Hz firmware-style loop (feedforward plus PI on encoder speed, with anti-windup) sets each motor voltage.
- **Tires.** Each tire's force follows a velocity-based Pacejka-style curve on combined longitudinal and lateral slip. Grip peaks at 5 cm/s of slip and settles at the sliding coefficient. The model adds rolling resistance and a drag force on the swivel caster.
- **Terrain.** Concrete has μ 0.90 peak and 0.75 sliding, gravel 0.65 and 0.55, ice 0.15 and 0.10. Rough ground adds deterministic bumps of about 2 cm. The body follows them through a support plane fitted to the three contacts, so slopes add a gravity component.
- **Load transfer.** Normal loads come from the three-point static support. The point where gravity minus acceleration meets the ground is lagged by 20 ms, which stands in for tire and chassis compliance. If any contact would lift, the run stops and says which one, because dynamic tipping, bouncing, and jumps are not simulated.
- **Encoders.** 1920 counts per wheel revolution. Odometry is dead reckoning from encoder counts only, so it drifts when wheels slip.
- **IMU.** MPU-6050 class, 100 Hz. The accelerometer reading comes from the IMU point's own 3D trajectory and the gyro reading from the change of the body axes. Both have noise, a seeded bias, and 16-bit steps.
- **Range sensor.** It looks up to 3 m ahead at 20 Hz, with about 1% noise. Low walls at ±2.5 m surround the arena, and the range sensor sees them as well as the box.
- **2D LiDAR.** Both robots carry an LDS-01-class LiDAR: 360 beams at 1°, 5 scans per second, 0.12–3.5 m. Accuracy is ±10 mm below 0.5 m and ±3.5% beyond, taken as 2σ, with readings in millimetres. Each 10 ms adds the next 18 beams from the pose at that moment, so a moving rover sees a slightly smeared scan. The scan plane is horizontal and ignores the robot's own body. LiDAR noise uses its own random stream, so the IMU noise sequence is unchanged.

Runs are deterministic for a seed. Saved runs store their seed, so plots can be regenerated exactly.

Known limits: slopes are assumed small, the friction model lets a parked rover creep a few mm/s on a slope, and every parameter is a typical datasheet value that has not been measured on a physical robot. A conservative circular footprint still stops the rover before a collision.

Student programs can command each wheel with `wheels(left, right)`, in rad/s. They can also command the whole rover with `drive(v, w)`, in m/s and rad/s, like ROS `/cmd_vel`. That command maps to wheel targets (v ± w·W/2)/R. If a wheel would pass 10 rad/s, both wheels are scaled down together, so the curve keeps its radius.

`if` and `while` test sensor readings with `<`, `>`, `<=`, or `>=`. The readings are `distance`, `heading` (gyro-integrated IMU yaw in degrees), `odom_heading`, `gyro_z`, `encoder_left`, `encoder_right`, `odom_x`, `odom_y`, `time`, and the LiDAR beams `lidar_front`, `lidar_left`, `lidar_back`, `lidar_right` (0 when closer than 0.12 m, infinity with no return), plus `lidar_min` and `lidar_min_angle`. A program always reads the latest sensor sample and never sees ground truth.

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

### Experiment 02: Where am I?

The lesson strip switches between Experiment 01 (balance on a ramp) and Experiment 02, which is about odometry, the gyro, and ground truth. Experiment 02 has three missions in `dist/missions.mjs`:

| Mission | Robot and ground | Passes when |
|---|---|---|
| Stop 20 cm from the box | Kinetic rover, flat | the true gap is 20 ± 3 cm and the rover did not touch the box |
| Turn exactly once around | TurtleBot3, flat | the true heading change is 360 ± 3° and the rover stayed within 5 cm |
| Close a square on ice | Kinetic rover, slippery | the path is at least 1.6 m and the rover ends within 10 cm of the start |

Missions are judged on the simulator's ground truth, which student programs never see. That plays the role of a motion-capture system or a tape measure in a real lab. Each starter script is a reasonable first try that falls short on purpose: it ignores braking, trusts the encoders, or uses timing on ice. The hint appears after a failed attempt.

`tests/missions.test.mjs` checks, for four seeds each, that every starter fails and a sensor-based reference solution passes. The reference solutions live only in the tests, so the lab never shows the answers. Completed missions are stored per device.

The orthographic canvas renderer uses the same dimensions and transforms as the models. It supports orbit, zoom, top view, and overlay toggles without external packages. The static floor grid is illustrative; exact measurements appear in the controls and telemetry.

## Persistence

Design, script, terrain, and the last 30 completed runs use browser localStorage (`kinetic-v1`). This is per-device, not a multi-user classroom backend. Resets preserve design. Run restoration restores parameters and, for drive runs, the executed script and terrain. Sensor logs are not stored. A drive run stores its seed instead, and its plots are replayed from design, terrain, script, and seed. Runs saved before seeds existed replay under the current model with a seed derived from their id. No analytics or external requests are required by the app.

## Next bricks

1. Validate dimensions, ramp thresholds, motor constants, and friction against a physical rover. The CSV columns are meant to line up with logs from a real robot.
2. Compare full curves against raw lab logs (CSV or `.mat`) instead of values read from plots. Run the tape-measure test of the predicted 3% straight-line overstatement, and look for the cause of the two unreproduced effects. Evaluate Webots as a reference simulator for the dynamics.
3. Add attachable structural parts with mass and inertia, and a common robot specification.
4. Add omnidirectional bases, then an industrial arm. Treat humanoid standing before gait control.
5. Add equivalent MATLAB / ROS 2 examples and a validated controller bridge. No live MATLAB or ROS 2 integration is claimed in this milestone.
