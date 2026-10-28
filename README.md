# Kinetic — Virtual Robotics Lab

First student-facing milestone: a differential-drive rover with an adjustable structure and payload, a ramp-balance experiment, an editable pseudocode controller, and a local experiment notebook.

## Run

This is a buildless, dependency-free static site. Install Node.js 20 or newer, open this folder in a terminal, and run:

```sh
npm run dev
```

Open http://localhost:5173. There is no dependency installation step. Alternatively, serve `dist/` with any HTTP static server. Entry point: `dist/index.html`. Modules require HTTP rather than `file://`.

```sh
npm test
npm run check
```

The first command runs seven model/parser tests. The second checks JavaScript syntax. The app is a static frontend; browser localStorage stores designs and experiments per device. There is no classroom backend in this version.

## Continue in Codex or Claude Code

Open this folder in your preferred coding tool. `AGENTS.md` explains the architecture, project boundaries, and validation workflow. `CLAUDE.md` points Claude Code at the same instructions. `docs/design-engineering.md` preserves the design skill selected by the project owner.

The existing hosted prototype is https://kinetic-robotics-lab.famousbadge2.chatgpt.site (private ChatGPT access). This export is independent of the hosting configuration: pushing it to GitHub does not automatically redeploy that prototype. Deploy `dist/` to a static host, or explicitly publish later changes through ChatGPT Sites.

## What the model means

All physics functions in `dist/physics.mjs` use SI units; the builder displays centimeters. Center of mass sums the masses of a 1.8 kg chassis, a 0.5 kg battery, and a variable 0–3 kg payload. The structure changes size without changing chassis mass, an intentional teaching simplification. Payload height specifies its center above a 20 cm reference deck.

The two drive contacts and caster form a triangle. The tilt table rotates around the forward axis, rising to the right. The gravity intersection in ramp coordinates is `x_com - y_com * tan(angle)` and `z_com`. Signed perpendicular distance to the closest triangle edge is the static margin. A binary search finds the first zero-margin positive tilt. Static contact loss triggers an illustrative falling animation; there is no contact solver, sliding, motor holding torque model, deformation, or impact simulation. Assume held wheels and ideal grip.

The driving experiment is separate: ideal no-slip differential-drive kinematics integrated along an exact arc for each constant wheel-speed time slice. Wheel radius is 0.075 m. There is no acceleration or dynamic tipping model. A ray sensor checks one box up to 3 m ahead; conservative circular footprint proximity stops the rover before a collision. The 30-second run limit, parser depth limit, and instruction budget bound student programs. User code is parsed into a small AST, never evaluated as JavaScript.

The orthographic canvas renderer uses the same dimensions and transforms as the models. It supports orbit, zoom, top view, and overlay toggles without external packages. The static floor grid is illustrative; exact measurements appear in the controls and telemetry.

## Persistence

Design, script, and the last 30 completed runs use browser localStorage (`kinetic-v1`). This is per-device, not a multi-user classroom backend. Resets preserve design. Run restoration restores parameters and, for drive runs, the executed script. No analytics or external requests are required by the app.

## Next bricks

1. Validate dimensions and ramp thresholds against a physical rover; replace ideal assumptions where needed.
2. Add motor and friction models in a dedicated physics adapter (evaluate Webots for reference simulation).
3. Add attachable structural parts with mass and inertia, and a common robot specification.
4. Add omnidirectional bases, then an industrial arm. Treat humanoid standing before gait control.
5. Add equivalent MATLAB / ROS 2 examples and a validated controller bridge. No live MATLAB or ROS 2 integration is claimed in this milestone.
