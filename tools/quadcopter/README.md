# Quadcopter model (ME 425 study tool)

A browser tool for seeing how the quadcopter model of the ME 425 slides "Motion Control of a Quadcopter I–II" answers throttle, roll, pitch, and yaw. It is a study aid for that course, separate from the Kinetic lab: it lives outside `dist`, so it is not part of the public site.

- `quad.mjs`: the model, with no DOM. Equations of motion in the hybrid frame, T<sub>Θ</sub>, the U1–U4 equations and their inverse, RK4 at 1/240 s, the PID of the slides, hover control, and trajectory control with virtual inputs.
- `quad.test.mjs`: 13 checks, run with `npm run test:quad`.
- `index.html`, `app.mjs`: the page. Three.js 0.160 comes from a CDN, so it needs a network connection.

Run it from the repository root and open http://127.0.0.1:8770:

```sh
python3 -m http.server 8770 --bind 127.0.0.1 --directory tools/quadcopter
```

## What it shows

- The solid vehicle flies the model you choose. Tick "T_Θ ≈ I", "Drop the gyroscopic terms", or "Traditional PID", and a ghost appears that flies the full slide model with the improved PID on the same commands, so the difference is on screen and dashed in the plots.
- The six equations of motion with the live value of every term. A term lights up by its share of its row.
- U1 as an arrow along Z<sub>B</sub>, and its horizontal part (Ẍ, Ÿ) on the ground under the vehicle.
- Eight experiments, each with one question.

## Conventions

Z is up. X<sub>B</sub> points to the FRONT rotor (Ω1) and Y<sub>B</sub> to the LEFT rotor (Ω4); Ω2 is RIGHT and Ω3 is REAR. Front and rear turn counterclockwise, left and right clockwise. Speeding up the left rotor gives +φ, the rear rotor +θ, and the left-right pair +ψ, as in the slide figures.

## Where it departs from the slides

- The yaw slide's text speeds up the front-rear pair, but its figure and the U4 equation speed up left-right. The figure and equation are used.
- The U1 formula is written with μ<sub>y</sub> unsquared. The three equations it comes from give μ<sub>y</sub>², which is used.
- Rotor speeds are limited to 0…Ω max (400 rad/s by default), and the page warns when a limit acts. The slides have no limit.
- Near θ = ±90° the factor 1/cos θ in T<sub>Θ</sub> is bounded so the state stays finite, and the page warns.
- A floor at Z = 0 stops a fall. Gains act on accelerations, and U2–U4 are scaled by the inertias, as in the attitude-control slides. Hover control divides U1 by cos θ·cos φ.

## What the checks cover

Hover equilibrium at Ω_H = 199.85 rad/s; one input moving one axis (φ = U2·t²/(2·I<sub>XX</sub>)); the signs of the slide figures; T<sub>Θ</sub> against the rotation matrix (dR/dt = R[ω]×, independent of the slide's matrix); Ÿ = −g·tan φ when a 10° roll is held; both teaching switches; no NaN through the singularity; the two PID drawbacks; circle and line tracking within 5 cm; and a halved step giving the same answer.

Not checked: the page in Firefox or Safari, and on a phone. Motor dynamics, wind, and sensor noise are not modeled.
