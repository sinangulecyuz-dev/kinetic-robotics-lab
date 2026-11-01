// Missions for Experiments 02, 03, and 04. Each is judged on ground truth, which the rover's own program never sees.
// Every starter script is a reasonable first try that falls short, so the student has something to improve.
// start places the rover in the arena, still facing +z; without it the rover starts at the center.
// wind is the mission's own outdoor wind ({speed, toward, gust}); a mission without one is judged only without wind.
import {rangeTo,OBSTACLE,WALL} from './drive.mjs';
import {withComments} from './examples.mjs';

export const MISSIONS=[
  {
    id:'stop',experiment:2,title:'Stop 20 cm from the box',robot:'kinetic',terrain:'flat',
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
    id:'turn',experiment:2,title:'Turn exactly once around',robot:'turtlebot3',terrain:'flat',
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
    id:'square',experiment:2,title:'Close a square on ice',robot:'kinetic',terrain:'slippery',
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
  },
  {
    id:'park',experiment:3,title:'Park 0.5 m from the wall',robot:'kinetic',terrain:'flat',start:{x:-1.5,z:-2},
    goal:'End the run with the front sensor 0.50 m from the wall ahead, within ±2 cm.',
    lesson:'Braking from full speed takes several centimeters. Make the speed proportional to the distance left, so the rover slows down by itself as it arrives, and keep the loop running until it settles.',
    tr:{title:'Duvardan 0.5 m önce park et',goal:'Denemeyi ön sensör öndeki duvardan 0.50 m uzaktayken, ±2 cm içinde bitir.',
      lesson:'Tam hızdan frenlemek birkaç santimetre sürer. Hızı kalan mesafeyle orantılı yap; böylece rover yaklaştıkça kendiliğinden yavaşlar. Döngüyü rover durulana kadar sürdür.',
      comments:['Görev: ön sensör öndeki duvardan 0.50 m uzaktayken park et (±2 cm).','Bu ilk deneme 0.5 m/s ile gidiyor ve çizgide frenliyor. Çalıştır, sonucu oku, sonra geliştir.']},
    fr:{title:'Se garer à 0.5 m du mur',goal:'Termine l’essai avec le capteur avant à 0.50 m du mur devant, à ±2 cm près.',
      lesson:'Freiner depuis la pleine vitesse demande plusieurs centimètres. Rends la vitesse proportionnelle à la distance restante : le rover ralentit de lui-même en arrivant. Laisse la boucle tourner jusqu’à ce qu’il se stabilise.',
      comments:['Mission : se garer avec le capteur avant à 0.50 m du mur devant (±2 cm).','Ce premier essai roule à 0.5 m/s et freine sur la ligne. Lance-le, lis le résultat, puis améliore-le.']},
    starter:'# Mission: park with the front sensor 0.50 m from the wall ahead (±2 cm).\n# This first try drives at 0.5 m/s and brakes at the line. Run it, read the result, then improve it.\ndrive(0.5, 0)\nwhile distance > 0.5\n  wait(0.05)\nend\nstop()',
    judge(sim){
      const gap=rangeTo(sim,OBSTACLE,sim.spec.rangeAhead);
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`,key:'judge.early'};
      return {pass:Math.abs(gap-.5)<=.02,text:`True gap ${(gap*100).toFixed(1)} cm (target 50 ± 2 cm).`,key:'judge.park',params:{gap:(gap*100).toFixed(1)}};
    }
  },
  {
    id:'wall',experiment:3,title:'Follow the wall at 0.5 m',robot:'kinetic',terrain:'flat',start:{x:1.7,z:-2},
    goal:'Drive along the wall on your left and keep 0.5 m from it, within ±10 cm, over the last 1.8 m.',
    lesson:'When the rover turns toward the wall, the left beam hits it at a slant and reads long, and even the true distance changes only after the rover has turned. Steering on distance alone always overshoots. Also steer back toward running parallel to the wall: the gyro heading, or the angle of the closest LiDAR return, tells you how far you are turned.',
    tr:{title:'Duvarı 0.5 m’den takip et',goal:'Solundaki duvar boyunca sür ve son 1.8 m boyunca ondan 0.5 m uzakta kal, ±10 cm içinde.',
      lesson:'Rover duvara doğru döndüğünde sol ışın duvara eğik çarpar ve uzun okur; gerçek mesafe de ancak rover döndükten sonra değişir. Yalnızca mesafeye göre direksiyon kırmak hep hedefi aşar. Duvara paralel gitmeye doğru da dön: jiroskop yönelimi ya da en yakın LiDAR dönüşünün açısı ne kadar döndüğünü söyler.',
      comments:['Görev: son 1.8 m boyunca solundaki duvarı 0.50 m’den takip et (±10 cm).','Bu ilk deneme yalnızca sol LiDAR okumasıyla orantılı direksiyon kırıyor. Çalıştır ve yolu izle.']},
    fr:{title:'Suivre le mur à 0.5 m',goal:'Longe le mur à ta gauche et reste à 0.5 m de lui, à ±10 cm près, sur les 1.8 derniers mètres.',
      lesson:'Quand le rover tourne vers le mur, le faisceau gauche le touche en biais et mesure trop long, et même la vraie distance ne change qu’après le virage. Diriger avec la distance seule dépasse toujours. Ramène aussi le rover parallèle au mur : le cap du gyroscope, ou l’angle du retour LiDAR le plus proche, indique de combien il est tourné.',
      comments:['Mission : longer le mur à gauche à 0.50 m (±10 cm) sur les 1.8 derniers mètres.','Ce premier essai dirige seulement en proportion de la mesure LiDAR gauche. Lance-le et regarde le trajet.']},
    starter:'# Mission: follow the wall on your left at 0.50 m (±10 cm) over the last 1.8 m.\n# This first try steers in proportion to the left LiDAR reading alone. Run it and watch the path.\nwhile odom_x < 3.8\n  drive(0.2, 1*(lidar_left - 0.5))\n  wait(0.05)\nend\nstop()',
    // The judged stretch is the true path between z = 0 and z = 1.8, after 2 m to settle from the 0.8 m start.
    judge(sim){
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`,key:'judge.early'};
      const L=sim.log;let miss=0,length=0;
      for(let i=0;i<L.t.length;i++){const z=sim.start.z+L.trueX[i];length=Math.max(length,L.trueX[i]);if(z>=0&&z<=1.8)miss=Math.max(miss,Math.abs(WALL-(sim.start.x+L.trueY[i])-.5));}
      if(length<3.5)return {pass:false,text:`The rover covered only ${length.toFixed(2)} m along the wall. Drive at least 3.5 m.`,key:'judge.wallShort',params:{length:length.toFixed(2)}};
      return {pass:miss<=.1,text:`Farthest from 0.5 m: ${(miss*100).toFixed(1)} cm over the last 1.8 m (target 10 cm or less).`,key:'judge.wall',params:{miss:(miss*100).toFixed(1)}};
    }
  },
  {
    id:'wind',experiment:4,title:'Hold the line in the wind',robot:'kinetic',terrain:'slippery',start:{x:2,z:-2},wind:{speed:5,toward:-90,gust:.15},
    goal:'On ice, with the wind pushing you away from the wall, keep 0.5 m from the wall on your left: within ±2.4 cm on average over the last 3 m, and never more than 10 cm off.',
    lesson:'The wind pushes steadily, so the rover must keep steering slightly into it. P and D can only ask for that steering while the rover sits a little off the line: a steady error. Add the error up over time with let, and steer with that sum too. The sum grows until the steady error is gone. Start it from zero and keep its gain small.',
    tr:{title:'Rüzgarda çizgiyi tut',goal:'Buzda, rüzgar seni duvardan uzağa iterken solundaki duvardan 0.5 m uzakta kal: son 3 m’de ortalama ±2.4 cm içinde ve hiçbir zaman 10 cm’den fazla sapmadan.',
      lesson:'Rüzgar sürekli iter, bu yüzden rover hep biraz rüzgara doğru dönmelidir. P ve D bu dönüşü ancak rover çizginin biraz dışındayken isteyebilir: kalıcı bir hata. Hatayı let ile zaman içinde topla ve bu toplamla da dön. Toplam, kalıcı hata yok olana kadar büyür. Sıfırdan başlat ve kazancını küçük tut.',
      comments:['Görev: rüzgarda solundaki duvardan 0.50 m uzakta kal (ortalama ±2.4 cm içinde).','Bu ilk deneme mesafeye ve duvara göre açıya göre dönüyor: P ve D. Çalıştır ve ortalama sapmasını oku.']},
    fr:{title:'Tenir la ligne dans le vent',goal:'Sur la glace, avec le vent qui te pousse loin du mur, reste à 0.5 m du mur à ta gauche : à ±2.4 cm près en moyenne sur les 3 derniers mètres, et jamais à plus de 10 cm.',
      lesson:'Le vent pousse sans arrêt, donc le rover doit toujours tourner un peu face à lui. P et D ne peuvent demander ce virage que si le rover reste un peu à côté de la ligne : une erreur permanente. Additionne l’erreur dans le temps avec let, et dirige aussi avec cette somme. La somme grandit jusqu’à ce que l’erreur permanente disparaisse. Pars de zéro et garde un petit gain.',
      comments:['Mission : rester à 0.50 m du mur à gauche dans le vent (à ±2.4 cm près en moyenne).','Ce premier essai dirige selon la distance et l’angle par rapport au mur : P et D. Lance-le et lis son écart moyen.']},
    starter:'# Mission: keep 0.50 m from the wall on your left in the wind (average within ±2.4 cm).\n# This first try steers on the distance and on the angle to the wall: P and D. Run it and read its average miss.\nwhile odom_x < 3.8\n  drive(0.2, 2*(lidar_min - 0.5) + 0.02*(lidar_min_angle - 90))\n  wait(0.05)\nend\nstop()',
    // Judged on the true path between z = -1.2 and z = 1.8: the average miss is the steady error, the largest one catches oscillation.
    judge(sim){
      if(!sim.success)return {pass:false,text:`The run stopped early: ${sim.message}`,key:'judge.early'};
      const L=sim.log;let sum=0,n=0,max=0,length=0;
      for(let i=0;i<L.t.length;i++){const z=sim.start.z+L.trueX[i];length=Math.max(length,L.trueX[i]);if(z>=-1.2&&z<=1.8){const e=WALL-(sim.start.x+L.trueY[i])-.5;sum+=e;n++;max=Math.max(max,Math.abs(e));}}
      if(length<3.5)return {pass:false,text:`The rover covered only ${length.toFixed(2)} m along the wall. Drive at least 3.5 m.`,key:'judge.wallShort',params:{length:length.toFixed(2)}};
      const mean=sum/n;
      return {pass:Math.abs(mean)<=.024&&max<=.1,text:`${(Math.abs(mean)*100).toFixed(1)} cm off on average, ${(max*100).toFixed(1)} cm at most, over the last 3 m (target: average within 2.4 cm, never over 10 cm).`,key:'judge.windMean',params:{mean:(Math.abs(mean)*100).toFixed(1),max:(max*100).toFixed(1)}};
    }
  }
];
// What each judge measures, over the whole run, for a plot with the target band: kind names the quantity, lo and hi the band.
// Ground truth from the 100 Hz log: the axle position, turned back into the body origin that rangeTo expects.
const origin=(sim,i)=>{const L=sim.log,h=L.trueYaw[i];return {x:sim.start.x+L.trueY[i]-Math.sin(h)*sim.axleZ,z:sim.start.z+L.trueX[i]-Math.cos(h)*sim.axleZ,heading:h};};
const series=(sim,f)=>sim.log.t.map((_,i)=>f(i));
const TRACES={
  stop:sim=>({kind:'gap',lo:.17,hi:.23,y:series(sim,i=>rangeTo(origin(sim,i),OBSTACLE,sim.spec.rangeAhead))}),
  park:sim=>({kind:'gap',lo:.48,hi:.52,y:series(sim,i=>rangeTo(origin(sim,i),OBSTACLE,sim.spec.rangeAhead))}),
  turn:sim=>({kind:'heading',lo:357,hi:363,y:series(sim,i=>sim.log.trueYaw[i]*180/Math.PI)}),
  square:sim=>({kind:'home',lo:0,hi:.1,y:series(sim,i=>Math.hypot(sim.log.trueX[i],sim.log.trueY[i]))}),
  wall:sim=>({kind:'wall',lo:.4,hi:.6,y:series(sim,i=>WALL-(sim.start.x+sim.log.trueY[i]))}),
  wind:sim=>({kind:'wall',lo:.476,hi:.524,y:series(sim,i=>WALL-(sim.start.x+sim.log.trueY[i]))})
};
export const missionTrace=(m,sim)=>({...TRACES[m.id](sim),t:sim.log.t});

// Graduated hints after the concept in each mission's lesson: which tool to use, then the shape of the code with blanks.
// The blanks (___) are what the student decides; a hint never gives the values that pass.
const HINTS={
  stop:{
    en:['Measure with distance. Brake in two steps: drive fast until distance is about 0.35 m, then switch to a slow speed for the last part.','drive(fast, 0)\nwhile distance > ___\n  wait(0.05)\nend\ndrive(slow, 0)\nwhile distance > ___\n  wait(0.05)\nend\nstop()'],
    tr:['Ölçümü distance ile yap. İki adımda fren yap: distance yaklaşık 0.35 m olana kadar hızlı git, sonra son kısım için yavaş bir hıza geç.','drive(hızlı, 0)\nwhile distance > ___\n  wait(0.05)\nend\ndrive(yavaş, 0)\nwhile distance > ___\n  wait(0.05)\nend\nstop()'],
    fr:['Mesure avec distance. Freine en deux temps : roule vite jusqu’à ce que distance vaille environ 0.35 m, puis passe à une vitesse lente pour la fin.','drive(vite, 0)\nwhile distance > ___\n  wait(0.05)\nend\ndrive(lent, 0)\nwhile distance > ___\n  wait(0.05)\nend\nstop()']},
  turn:{
    en:['Use heading (the IMU) instead of odom_heading (the encoders), and turn slower near the end so the rover does not overshoot.','drive(0, 1)\nwhile heading < ___\n  wait(0.05)\nend\ndrive(0, slow)\nwhile heading < ___\n  wait(0.05)\nend\nstop()'],
    tr:['odom_heading (enkoderler) yerine heading (IMU) kullan ve sona doğru yavaşla ki rover hedefi aşmasın.','drive(0, 1)\nwhile heading < ___\n  wait(0.05)\nend\ndrive(0, yavaş)\nwhile heading < ___\n  wait(0.05)\nend\nstop()'],
    fr:['Utilise heading (l’IMU) au lieu de odom_heading (les encodeurs), et tourne plus lentement vers la fin pour ne pas dépasser.','drive(0, 1)\nwhile heading < ___\n  wait(0.05)\nend\ndrive(0, lent)\nwhile heading < ___\n  wait(0.05)\nend\nstop()']},
  square:{
    en:['Measure each side with odom_x or odom_y, and each corner with heading. Drive slowly, about 0.15 m/s, so the wheels do not slip.','Side: drive(0.15, 0), then while odom_x < ___ … end (or odom_y, or > 0 on the way back).\nCorner: drive(0, slow), then while heading < ___ … end.\nFour sides; each corner adds about 90° to heading.'],
    tr:['Her kenarı odom_x ya da odom_y ile, her köşeyi heading ile ölç. Tekerler kaymasın diye yavaş, yaklaşık 0.15 m/s ile sür.','Kenar: drive(0.15, 0), sonra while odom_x < ___ … end (ya da odom_y, ya da dönüşte > 0).\nKöşe: drive(0, yavaş), sonra while heading < ___ … end.\nDört kenar; her köşe heading’e yaklaşık 90° ekler.'],
    fr:['Mesure chaque côté avec odom_x ou odom_y, et chaque coin avec heading. Roule lentement, environ 0.15 m/s, pour que les roues ne glissent pas.','Côté : drive(0.15, 0), puis while odom_x < ___ … end (ou odom_y, ou > 0 au retour).\nCoin : drive(0, lent), puis while heading < ___ … end.\nQuatre côtés ; chaque coin ajoute environ 90° à heading.']},
  park:{
    en:['Make the speed a gain times the distance left: drive(k*(distance - 0.5), 0), inside a loop that runs for a fixed time.','while time < ___\n  drive(___*(distance - 0.5), 0)\n  wait(0.05)\nend\nstop()'],
    tr:['Hızı, bir kazanç çarpı kalan mesafe yap: drive(k*(distance - 0.5), 0); bunu sabit süre dönen bir döngünün içine koy.','while time < ___\n  drive(___*(distance - 0.5), 0)\n  wait(0.05)\nend\nstop()'],
    fr:['Rends la vitesse égale à un gain fois la distance restante : drive(k*(distance - 0.5), 0), dans une boucle qui tourne un temps fixe.','while time < ___\n  drive(___*(distance - 0.5), 0)\n  wait(0.05)\nend\nstop()']},
  wall:{
    en:['Steer with two terms: one for the distance error, lidar_min - 0.5, and one for the angle to the wall, lidar_min_angle - 90, which is 0 when you drive parallel.','while odom_x < 3.8\n  drive(0.2, ___*(lidar_min - 0.5) + ___*(lidar_min_angle - 90))\n  wait(0.05)\nend\nstop()'],
    tr:['İki terimle dön: biri mesafe hatası için, lidar_min - 0.5; diğeri duvara göre açı için, lidar_min_angle - 90; paralel giderken bu 0’dır.','while odom_x < 3.8\n  drive(0.2, ___*(lidar_min - 0.5) + ___*(lidar_min_angle - 90))\n  wait(0.05)\nend\nstop()'],
    fr:['Dirige avec deux termes : l’un pour l’erreur de distance, lidar_min - 0.5, l’autre pour l’angle au mur, lidar_min_angle - 90, qui vaut 0 quand tu roules parallèle.','while odom_x < 3.8\n  drive(0.2, ___*(lidar_min - 0.5) + ___*(lidar_min_angle - 90))\n  wait(0.05)\nend\nstop()']},
  wind:{
    en:['Keep the starter’s P and D. Before the loop, set a variable to 0. In the loop, add the distance error to it, and steer with a small multiple of it too.','let sum = 0\nwhile odom_x < 3.8\n  let e = lidar_min - 0.5\n  let sum = sum + ___\n  drive(0.2, 2*e + 0.02*(lidar_min_angle - 90) + ___*sum)\n  wait(0.05)\nend\nstop()'],
    tr:['Başlangıç betiğindeki P ve D’yi koru. Döngüden önce bir değişkeni 0 yap. Döngüde mesafe hatasını ona ekle ve onun küçük bir katıyla da dön.','let sum = 0\nwhile odom_x < 3.8\n  let e = lidar_min - 0.5\n  let sum = sum + ___\n  drive(0.2, 2*e + 0.02*(lidar_min_angle - 90) + ___*sum)\n  wait(0.05)\nend\nstop()'],
    fr:['Garde le P et le D du script de départ. Avant la boucle, mets une variable à 0. Dans la boucle, ajoute-lui l’erreur de distance, et dirige aussi avec un petit multiple d’elle.','let sum = 0\nwhile odom_x < 3.8\n  let e = lidar_min - 0.5\n  let sum = sum + ___\n  drive(0.2, 2*e + 0.02*(lidar_min_angle - 90) + ___*sum)\n  wait(0.05)\nend\nstop()']}
};
// The sensors each mission is about. A script that reads none of them cannot succeed except by luck.
const NEEDS={stop:['distance','lidar_front','lidar_min'],turn:['heading','fused_heading','gyro_z','odom_heading'],square:['odom_x','odom_y','fused_x','fused_y'],park:['distance','lidar_front','lidar_min'],wall:['lidar_min','lidar_left'],wind:['lidar_min','lidar_left']};
// Signed distance error to the wall at 0.5 m over a stretch of the true path: positive means too far from the wall.
function wallStats(sim,from,to){
  const L=sim.log;let sum=0,n=0,max=0;
  for(let i=0;i<L.t.length;i++){const z=sim.start.z+L.trueX[i];if(z>=from&&z<=to){const e=WALL-(sim.start.x+L.trueY[i])-.5;sum+=e;n++;max=Math.max(max,Math.abs(e));}}
  return {mean:n?sum/n:0,max};
}
// Why a run fell short, as message keys with params: what the script reads, then which way the result missed.
// names lists the sensors and variables the script uses.
export function diagnose(m,sim,names){
  const out=[],used=new Set(names.sensors),cm=v=>(Math.abs(v)*100).toFixed(1);
  if(!names.sensors.length)out.push({key:'diag.blind'});
  else if(!NEEDS[m.id].some(s=>used.has(s)))out.push({key:'diag.needSensor',params:{sensors:NEEDS[m.id].slice(0,2).join(', ')}});
  if(m.id==='turn'&&used.has('odom_heading')&&!used.has('heading'))out.push({key:'diag.encoders'});
  if(m.id==='wind'&&!names.variables.length)out.push({key:'diag.noSum'});
  if(!sim.success)return out;
  if(m.id==='stop'||m.id==='park'){const target=m.id==='stop'?.2:.5,tol=m.id==='stop'?.03:.02,gap=rangeTo(sim,OBSTACLE,sim.spec.rangeAhead)-target;
    if(gap>tol)out.push({key:'diag.short',params:{cm:cm(gap)}});else if(gap<-tol)out.push({key:'diag.over',params:{cm:cm(gap)}});}
  if(m.id==='turn'){const d=sim.heading*180/Math.PI-360;if(d<-3)out.push({key:'diag.turnShort',params:{deg:Math.abs(d).toFixed(1)}});else if(d>3)out.push({key:'diag.turnOver',params:{deg:d.toFixed(1)}});}
  if(m.id==='wall'||m.id==='wind'){
    const w=m.id==='wall'?wallStats(sim,0,1.8):wallStats(sim,-1.2,1.8),meanTol=m.id==='wall'?.05:.024;
    if(Math.abs(w.mean)>meanTol)out.push({key:w.mean>0?'diag.far':'diag.near',params:{cm:cm(w.mean)}});
    else if(w.max>.1)out.push({key:'diag.wobble',params:{cm:cm(w.max)}});
  }
  return out;
}
export const missionById=id=>MISSIONS.find(m=>m.id===id);
export const missionsFor=experiment=>MISSIONS.filter(m=>m.experiment===experiment);
// A mission's title, goal, lesson, and starter in one language. The starter keeps the English code lines under translated comments.
export function missionText(m,lang='en'){
  const x=lang==='en'?null:m[lang];
  const [tool,skeleton]=HINTS[m.id]?.[lang]??HINTS[m.id]?.en??['',''];
  return x?{title:x.title,goal:x.goal,lesson:x.lesson,tool,skeleton,starter:withComments(m.starter,x.comments)}:{title:m.title,goal:m.goal,lesson:m.lesson,tool,skeleton,starter:m.starter};
}
