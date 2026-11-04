# Next TurtleBot3 lab: measurements for the simulator

Lab 2 left four questions that the logs cannot answer (README, "TurtleBot3 Waffle Pi calibration"). Each check below answers one of them in a few minutes. Numbers from these runs may go into `tests/fixtures/turtlebot3-lab.json`; names, student IDs, and photos never do.

Note which robot you used. Labs 0, 1, and 2 most likely used three different units, and runs from different units should not be mixed without saying so.

## 1. Log what the robot reports (every run, no extra time)

The Lab 2 logs hold MATLAB loop time only. The loop period varied from 0.10 to 0.38 s, so speeds per step are too noisy to use. Add the message time and the raw wheel angles, and save a CSV:

```matlab
% at the end of each loop pass, after send(velPub, velMsg):
k = k + 1;
stamp(k) = double(encMsg.header.stamp.sec) + 1e-9*double(encMsg.header.stamp.nanosec);
encL(k) = double(encMsg.position(iL));  encR(k) = double(encMsg.position(iR));
tLoop(k) = toc(t0);  vCmd(k) = v;  wCmd(k) = w;

% after the loop:
writetable(table(tLoop(1:k)', stamp(1:k)', encL(1:k)', encR(1:k)', vCmd(1:k)', wCmd(1:k)', ...
    'VariableNames', {'t_loop_s','stamp_s','encL_rad','encR_rad','v_cmd_m_s','w_cmd_rad_s'}), 'run01.csv');
```

## 2. Wheel speed against the command, lifted and on the floor (10 min)

Question: in Lab 2 the encoders ran 3–6 mm/s below the command at steady speed. Is that in the firmware, or does it come from load?

- Put the robot on a box so both wheels spin freely. Send `cmd_vel` with v = 0.01, 0.02, 0.05, 0.10, and 0.15 m/s and w = 0, for 10 s each.
- Repeat on the floor, with 2 m clear in front (5 s at the two higher speeds is enough).
- Wheel speed = R × (change in wheel angle) / (change in `stamp_s`) over the last half of each step.

If the gap is there with the wheels lifted, it is in the firmware or its units. If it appears only on the floor, the speed loop does not fully reject the load, for example because its integral is weak. Setting our model's integral gain to zero already gives 0.1345 m in the 0.05 m/s line run, against 0.1321 m measured.

## 3. Where the wheels stop (5 min)

Question: without the 0.02 m/s floor, the robot stopped for good 2.2–2.3 cm from the goal, with its wheels commanded 7–11 mm/s. The model keeps creeping.

- On the floor, start at v = 0.02 m/s and lower it by 0.002 m/s every 3 s down to 0. Note the command where the wheels stop.
- Then raise it again in the same steps and note where they start. The difference between the two is static friction.
- Repeat turning in place: w from 0.2 rad/s down to 0 and back.

## 4. One wheel over its limit, lifted only (2 min)

Question: in an early Lab 2 run (v = 0.18, w = 1.2, so one wheel was asked for 0.35 m/s) the robot froze. The model saturates that motor and keeps driving.

- With the wheels lifted, send v = 0.18 m/s, w = 1.2 rad/s for 3 s and watch both wheels. Does the fast wheel turn at its limit or stop? Does the slow wheel turn?

## 5. Tape-measure the real stop point (5 min)

Prediction: for this start, the first of Lab 2, the model says the robot really stops about 4 cm from the goal, although its odometry says under 2 cm (ball-caster drag makes the wheels slip).

- Tape the goal and the start (−0.5, −0.2, 0) on the floor, and place the axle center, midway between the wheels, on the start mark.
- Run the Lab 2 parking controller with the base gains (0.4, 1.5, −0.4).
- Measure where the axle center ends and the robot's final heading.

## 6. A 2 m straight line by tape (3 min)

Prediction: odometry overstates straight-line distance by about 3 %.

- Drive 2 m by odometry at 0.10 m/s and tape-measure the real distance. Do it forward and backward, which also tests Lab 1's forward/backward asymmetry.

## 7. One measured lap (5 min)

Prediction: in the Lab 2 circle (goal at 0.08 m/s on a 0.5 m circle) the robot's true radius is about 0.51 m, while its odometry says 0.494 m.

- Mark the start, run one lap, and measure the end point and heading against the mark.
