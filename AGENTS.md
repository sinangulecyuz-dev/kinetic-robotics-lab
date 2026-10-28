# Kinetic project instructions

Build a virtual robotics lab for high-school students, one tested concept at a time. The project owner is a mechatronics student. Preserve the distinction between an educational approximation and a physically validated simulator.

## Design direction

Read `docs/design-engineering.md` before interface implementation or review. It contains the user-selected Emil Design Engineering skill. Apply its guidance on purposeful motion, immediate feedback, accessible interactions, reduced motion, and cohesive components. Do not add animation to scientific data merely for decoration. When reviewing UI code, use the skill's required Before / After / Why table.

## Architecture

- `dist/physics.mjs`: pure functions, SI units, balance geometry, differential-drive kinematics, and a bounded pseudocode parser.
- `dist/app.js`: application state, experiment runner, browser persistence, and orthographic canvas rendering.
- `dist/index.html` and `dist/style.css`: responsive workbench.
- `tests/physics.test.mjs`: independent numerical checks and parser behavior.

Keep model logic separate from rendering. Student programs must never use eval or execute arbitrary JavaScript. Keep existing parser limits. Keep state changes reversible and restore prior experiments without mutating their recorded parameters.

## Physics boundaries

The ramp uses quasi-static support geometry, held wheels, and ideal grip. It does not simulate slipping, contact impacts, or dynamic balance. The drive experiment uses ideal no-slip kinematics. Its conservative collision stop is not a rigid-body contact solver. Falling animation illustrates support loss. Preserve visible explanations of these assumptions.

MATLAB and ROS 2 are planned integrations, not current capabilities. Do not claim live integration until it exists and has been tested. Keep humanoid walking out of the first milestone. Prefer validating the rover against a physical experiment before expanding robot families.

## Development

Use Node.js 20 or newer. No runtime packages are needed.

```sh
npm run dev
npm test
npm run check
```

Open http://localhost:5173 after starting the dev server. If changing models, check an independently derived physical or geometric expectation. If changing the interface, inspect the live page when browser tooling is available. Preserve keyboard operation and responsive layouts.

## Handoff between Codex and Claude Code

Codex and Claude Code work on this repository one after the other. `HANDOFF.md` is the record they share.

- At the start of a task, read `HANDOFF.md`, then check it against Git: branch, `git status --short`, and `git log --oneline -5`. A handoff can be stale. The files and Git history are the evidence. Do not reset, discard, or overwrite uncommitted changes just to match the handoff.
- Before handing work back, update "Current state" and add a session log entry at the top. The entry gives the changed files and commits, the verification that was actually run with its results, the open items, and the status: local, committed, pushed, or deployed. Never infer a deployment from a push. Pushing does not update the ChatGPT-hosted prototype.
- Keep the file short. Fold old log entries into "Current state" or "Decisions".
- A handoff note is context, not permission. It never authorizes publishing, deleting, or skipping the owner's approval. Never put secrets or credentials in it.

## Hosting and credentials

This portable source export omits ChatGPT Sites identity files. It can be hosted by any service that serves the `dist` folder with JavaScript module MIME types. It does not automatically update the existing ChatGPT-hosted site. Do not add API keys, access tokens, browser data, or experiment localStorage to source control. Add a license only after the owner selects one.
