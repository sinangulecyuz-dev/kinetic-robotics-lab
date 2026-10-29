// Experiment 02 missions. Each is judged on ground truth, which the rover's own program never sees.
// Every starter script is a reasonable first try that falls short, so the student has something to improve.
import {rangeTo,OBSTACLE} from './drive.mjs';
import {withComments} from './examples.mjs';

export const MISSIONS=[
  {
    id:'stop',title:'Stop 20 cm from the box',robot:'kinetic',terrain:'flat',
    goal:'End the run with the front sensor 20 cm from the box, within ±3 cm, without touching it.',
    lesson:'The sensor updates 20 times per second, your loop checks every 0.05 s, and braking takes distance. Slow down before the target.',
    tr:{title:'Kutudan 20 cm önce dur',goal:'Denemeyi ön sensör kutudan 20 cm uzaktayken, ±3 cm içinde ve ona değmeden bitir.',
      lesson:'Sensör saniyede 20 kez güncellenir, döngün her 0.05 s’de kontrol eder ve frenlemek mesafe ister. Hedeften önce yavaşla.',
      comments:['Görev: ön sensör kutudan 0.20 m uzaktayken dur (±3 cm).','Bu ilk deneme fren mesafesini hesaba katmıyor. Çalıştır, sonucu oku, sonra geliştir.']},
    fr:{title:'S’arrêter à 20 cm de la boîte',goal:'Termine l’essai avec le capteur avant à 20 cm de la boîte, à ±3 cm près, sans la toucher.',
      lesson:'Le capteur se met à jour 20 fois par seconde, ta boucle vérifie toutes les 0.05 s, et le freinage demande de la distance. Ralentis avant la cible.',
      comments:['Mission : s’arrêter avec le capteur avant à 0.20 m de la boîte (±3 cm).','Ce premier essai ignore la distance de freinage. Lance-le, lis le résultat, puis améliore-le.']},
    starter:'# Mission: stop with the front sensor 0.20 m from the box (±3 cm).\n# This first try ignores braking distance. Run it, read the result, then improve it.\ndrive(0.4, 0)\nwhile distance > 0.2\n  wait(0.05)\nend\nstop()',
    judge(sim){
      const gap=rangeTo(sim,OBSTACLE,sim.spec.rangeAhead);
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`,key:'judge.early'};
      return {pass:Math.abs(gap-.2)<=.03,text:`True gap ${(gap*100).toFixed(1)} cm (target 20 ± 3 cm).`,key:'judge.gap',params:{gap:(gap*100).toFixed(1)}};
    }
  },
  {
    id:'turn',title:'Turn exactly once around',robot:'turtlebot3',terrain:'flat',
    goal:'Turn in place and end within 3° of a full 360° turn, judged on the true heading.',
    lesson:'The encoders count wheel turns, but the ball casters drag and the wheels creep. The IMU measures the body itself.',
    tr:{title:'Tam bir tur dön',goal:'Yerinde dön ve tam 360°’lik dönüşün 3° yakınında bitir; gerçek yönelime göre değerlendirilir.',
      lesson:'Enkoderler teker turlarını sayar, ama bilyeli tekerler sürtünür ve tekerlekler kayar. IMU ise gövdenin kendisini ölçer.',
      comments:['Görev: yerinde tam 360° dön (±3°), gerçek yönelime göre değerlendirilir.','Bu ilk deneme tekerlek enkoderlerine güveniyor. Grafikler’de heading ile odom_heading’i karşılaştır.']},
    fr:{title:'Faire exactement un tour',goal:'Tourne sur place et termine à moins de 3° d’un tour complet de 360°, jugé sur le cap réel.',
      lesson:'Les encodeurs comptent les tours de roue, mais les roulettes à bille frottent et les roues glissent un peu. L’IMU mesure le corps lui-même.',
      comments:['Mission : tourner sur place d’exactement 360° (±3°), jugé sur le cap réel.','Ce premier essai fait confiance aux encodeurs des roues. Dans Courbes, compare heading et odom_heading.']},
    starter:'# Mission: turn in place exactly 360° (±3°), judged on the true heading.\n# This first try trusts the wheel encoders. In Plots, compare heading with odom_heading.\ndrive(0, 1)\nwhile odom_heading < 360\n  wait(0.05)\nend\nstop()',
    judge(sim){
      const yaw=sim.heading*180/Math.PI,a=sim.axle(),drift=Math.hypot(a.x-sim.start.x,a.z-sim.start.z);
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`,key:'judge.early'};
      return {pass:Math.abs(yaw-360)<=3&&drift<.05,text:`True turn ${yaw.toFixed(1)}° (target 360 ± 3°)${drift>=.05?`, but the rover wandered ${(drift*100).toFixed(0)} cm`:''}.`,key:drift>=.05?'judge.turnWander':'judge.turn',params:{yaw:yaw.toFixed(1),drift:(drift*100).toFixed(0)}};
    }
  },
  {
    id:'square',title:'Close a square on ice',robot:'kinetic',terrain:'slippery',
    goal:'Drive a square with 0.5 m sides and finish within 10 cm of where you started.',
    lesson:'On ice, time is not distance and wheel turns are not body turns. Measure distance with odometry, turns with the gyro, and drive gently.',
    tr:{title:'Buzda bir kareyi kapat',goal:'Kenarları 0.5 m olan bir kare çiz ve başladığın yerin 10 cm yakınında bitir.',
      lesson:'Buzda zaman mesafe değildir, teker dönüşü de gövde dönüşü değildir. Mesafeyi odometriyle, dönüşleri jiroskopla ölç ve yumuşak sür.',
      comments:['Görev: buzda kenarları 0.5 m olan bir kare çiz ve başlangıcın 10 cm yakınında bitir.','Bu ilk deneme yalnızca zamanlama kullanıyor. Buzda zaman mesafe değildir.']},
    fr:{title:'Fermer un carré sur la glace',goal:'Fais un carré de 0.5 m de côté et termine à moins de 10 cm de ton point de départ.',
      lesson:'Sur la glace, le temps n’est pas une distance et les tours de roue ne sont pas des tours du corps. Mesure la distance avec l’odométrie, les virages avec le gyroscope, et conduis en douceur.',
      comments:['Mission : faire un carré de 0.5 m de côté sur la glace et finir à moins de 10 cm du départ.','Ce premier essai n’utilise que le minutage. Sur la glace, le temps n’est pas une distance.']},
    starter:'# Mission: drive a square with 0.5 m sides on ice and end within 10 cm of the start.\n# This first try uses timing only. On ice, time is not distance.\nrepeat 4\n  drive(0.3, 0)\n  wait(1.7)\n  drive(0, 1.5)\n  wait(1.05)\nend\nstop()',
    judge(sim){
      const a=sim.axle(),miss=Math.hypot(a.x-sim.start.x,a.z-sim.start.z),length=sim.summary().distance;
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`,key:'judge.early'};
      if(length<1.6)return {pass:false,text:`The path was only ${length.toFixed(2)} m long. A 0.5 m square is 2 m.`,key:'judge.short',params:{length:length.toFixed(2)}};
      return {pass:miss<=.1,text:`Finished ${(miss*100).toFixed(1)} cm from the start (target 10 cm or less) after ${length.toFixed(2)} m.`,key:'judge.square',params:{miss:(miss*100).toFixed(1),length:length.toFixed(2)}};
    }
  }
];
export const missionById=id=>MISSIONS.find(m=>m.id===id);
// A mission's title, goal, lesson, and starter in one language. The starter keeps the English code lines under translated comments.
export function missionText(m,lang='en'){
  const x=lang==='en'?null:m[lang];
  return x?{title:x.title,goal:x.goal,lesson:x.lesson,starter:withComments(m.starter,x.comments)}:{title:m.title,goal:m.goal,lesson:m.lesson,starter:m.starter};
}
