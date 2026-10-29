// Experiment 02 missions. Each is judged on ground truth, which the rover's own program never sees.
// Every starter script is a reasonable first try that falls short, so the student has something to improve.
import {rangeTo,OBSTACLE} from './drive.mjs';

export const MISSIONS=[
  {
    id:'stop',title:'Stop 20 cm from the box',robot:'kinetic',terrain:'flat',
    goal:'End the run with the front sensor 20 cm from the box, within ±3 cm, without touching it.',
    lesson:'The sensor updates 20 times per second, your loop checks every 0.05 s, and braking takes distance. Slow down before the target.',
    starter:'# Mission: stop with the front sensor 0.20 m from the box (±3 cm).\n# This first try ignores braking distance. Run it, read the result, then improve it.\ndrive(0.4, 0)\nwhile distance > 0.2\n  wait(0.05)\nend\nstop()',
    judge(sim){
      const gap=rangeTo(sim,OBSTACLE,sim.spec.rangeAhead);
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`};
      return {pass:Math.abs(gap-.2)<=.03,text:`True gap ${(gap*100).toFixed(1)} cm (target 20 ± 3 cm).`};
    }
  },
  {
    id:'turn',title:'Turn exactly once around',robot:'turtlebot3',terrain:'flat',
    goal:'Turn in place and end within 3° of a full 360° turn, judged on the true heading.',
    lesson:'The encoders count wheel turns, but the ball casters drag and the wheels creep. The IMU measures the body itself.',
    starter:'# Mission: turn in place exactly 360° (±3°), judged on the true heading.\n# This first try trusts the wheel encoders. In Plots, compare heading with odom_heading.\ndrive(0, 1)\nwhile odom_heading < 360\n  wait(0.05)\nend\nstop()',
    judge(sim){
      const yaw=sim.heading*180/Math.PI,a=sim.axle(),drift=Math.hypot(a.x-sim.start.x,a.z-sim.start.z);
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`};
      return {pass:Math.abs(yaw-360)<=3&&drift<.05,text:`True turn ${yaw.toFixed(1)}° (target 360 ± 3°)${drift>=.05?`, but the rover wandered ${(drift*100).toFixed(0)} cm`:''}.`};
    }
  },
  {
    id:'square',title:'Close a square on ice',robot:'kinetic',terrain:'slippery',
    goal:'Drive a square with 0.5 m sides and finish within 10 cm of where you started.',
    lesson:'On ice, time is not distance and wheel turns are not body turns. Measure distance with odometry, turns with the gyro, and drive gently.',
    starter:'# Mission: drive a square with 0.5 m sides on ice and end within 10 cm of the start.\n# This first try uses timing only. On ice, time is not distance.\nrepeat 4\n  drive(0.3, 0)\n  wait(1.7)\n  drive(0, 1.5)\n  wait(1.05)\nend\nstop()',
    judge(sim){
      const a=sim.axle(),miss=Math.hypot(a.x-sim.start.x,a.z-sim.start.z),length=sim.summary().distance;
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`};
      if(length<1.6)return {pass:false,text:`The path was only ${length.toFixed(2)} m long. A 0.5 m square is 2 m.`};
      return {pass:miss<=.1,text:`Finished ${(miss*100).toFixed(1)} cm from the start (target 10 cm or less) after ${length.toFixed(2)} m.`};
    }
  }
];
export const missionById=id=>MISSIONS.find(m=>m.id===id);
