// Reference solutions for the missions: sensor-based programs that pass each judge.
// They live with the tests and go into the teacher kit (scripts/teacher-kit.mjs). They never go into dist, the interface students use.
export const SOLUTIONS={
  stop:'drive(0.3, 0)\nwhile distance > 0.35\n  wait(0.05)\nend\ndrive(0.08, 0)\nwhile distance > 0.21\n  wait(0.05)\nend\nstop()',
  turn:'drive(0, 1)\nwhile heading < 330\n  wait(0.05)\nend\ndrive(0, 0.3)\nwhile heading < 359.5\n  wait(0.05)\nend\nstop()',
  // P on speed: fast while far, slower as the gap closes.
  park:'while time < 15\n  drive(1*(distance - 0.5), 0)\n  wait(0.05)\nend\nstop()',
  // P on the perpendicular distance plus P on the angle to the wall, both from the LiDAR, so gyro drift does not bias it.
  wall:'while odom_x < 3.8\n  drive(0.2, 2*(lidar_min - 0.5) + 0.02*(lidar_min_angle - 90))\n  wait(0.05)\nend\nstop()',
  // PID: the P-and-D wall follower plus a running sum of the error, which cancels the steady push of the wind.
  wind:'let sum = 0\nwhile odom_x < 3.8\n  let e = lidar_min - 0.5\n  let sum = sum + e*0.05\n  drive(0.2, 2*e + 0.02*(lidar_min_angle - 90) + 1*sum)\n  wait(0.05)\nend\nstop()',
  square:'drive(0.15, 0)\nwhile odom_x < 0.5\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 88\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_y < 0.5\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 178\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_x > 0\n  wait(0.05)\nend\ndrive(0, 0.6)\nwhile heading < 268\n  wait(0.05)\nend\ndrive(0.15, 0)\nwhile odom_y > 0\n  wait(0.05)\nend\nstop()'
};
