// Example rover scripts for the Code tab. Kept free of DOM code so tests can run every one of them.
export const EXAMPLES={
  turn:'# Both wheel speeds are in rad/s. A faster right wheel turns left.\n# The rover moves while it waits.\nwheels(4, 4)\nwait(1)\nwheels(1, 5)\nwait(1.5)\nstop()',
  square:'# A 0.4 m square, turning left at each corner. drive(v, w) works for any robot and wheel spacing.\n# A 90° turn at 1 rad/s ideally takes π/2 = 1.57 s; 1.6 s makes up for speeding up and slowing down.\n# Timing alone only works on firm ground. Try it on ice, then see Experiment 02.\nrepeat 4\n  drive(0.2, 0)\n  wait(2)\n  drive(0, 1)\n  wait(1.6)\nend\nstop()',
  sensor:'# distance is a front ray sensor, in meters.\n# Sample it once every 0.1 seconds.\nrepeat 20\n  if distance < 0.4\n    stop()\n  else\n    wheels(4, 4)\n  end\n  wait(0.1)\nend\nstop()',
  gyro:'# Turn 90° left and stop on the IMU heading (degrees).\n# Then try odom_heading, and compare both on slippery ground.\ndrive(0, 1)\nwhile heading < 90\n  wait(0.05)\nend\nstop()',
  pturn:'# P control: the turn rate is proportional to the heading error, 90 - heading.\n# As the error shrinks, the turn slows down by itself.\n# Try a gain of 0.02, then 0.3, and compare the heading in Plots.\nrepeat 20\n  drive(0, 0.05*(90 - heading))\n  wait(0.1)\nend\nstop()',
  odometry:'# Drive 0.5 m as measured by the wheel encoders.\n# Open Plots: does the true path agree?\ndrive(0.25, 0)\nwhile odom_x < 0.5\n  wait(0.05)\nend\nstop()',
  lidar:'# Drive until the LiDAR sees the box 0.6 m ahead, turn a quarter left with the gyro,\n# then drive on until the LiDAR sees the wall. One clear beam is not enough to pass:\n# the rover is much wider than a ray. LiDAR scans 5 times per second.\ndrive(0.25, 0)\nwhile lidar_front > 0.6\n  wait(0.05)\nend\ndrive(0, 1)\nwhile heading < 90\n  wait(0.05)\nend\ndrive(0.25, 0)\nwhile lidar_front > 0.6\n  wait(0.05)\nend\nstop()',
  fusion:'# Complementary filter: filter(alpha) weighs the gyro against the encoders for heading.\n# filter(1) trusts only the gyro, filter(0) only the encoders, 0.999 is the default.\n# Drive a square on ice, then compare filtered and encoder odometry in Plots.\nfilter(0.999)\nrepeat 4\n  drive(0.2, 0)\n  wait(2.5)\n  drive(0, 1)\n  wait(1.57)\nend\nstop()',
  lab1a:'# ME425 Lab 1, Part A: three times forward 3 s, stop 1 s, back 3 s, stop 1 s, at 0.10 m/s.\n# Try it on the TurtleBot3. In Plots, compare odometry with the desired path.\nrepeat 3\n  drive(0.1, 0)\n  wait(3)\n  stop()\n  wait(1)\n  drive(-0.1, 0)\n  wait(3)\n  stop()\n  wait(1)\nend',
  lab1b:'# ME425 Lab 1, Part B: one circle at v = 0.10 m/s, w = 0.30 rad/s (T = 2π/w = 20.94 s).\n# On the TurtleBot3, change v to 0.2: the outer wheel hits the motor limit and the circle opens.\ndrive(0.1, 0.3)\nwait(10)\nwait(10)\nwait(0.94)\nstop()',
  lab1c:'# ME425 Lab 1, Part C: turn in place at 1 rad/s. Four turns fit the 30 s limit (25.13 s).\n# In Plots, compare the IMU heading with the encoder heading, and both with the truth.\ndrive(0, 1)\nwait(10)\nwait(10)\nwait(5.13)\nstop()'
};
// Comments in the student's language. The French comments still need a native speaker's review.
const COMMENTS={
  tr:{
    turn:['İki teker hızı da rad/s cinsinden. Daha hızlı bir sağ teker sola döndürür.','Rover beklerken hareket eder.'],
    square:['0.4 m’lik bir kare, her köşede sola dönerek. drive(v, w) her robotta ve her teker aralığında çalışır.','1 rad/s ile 90° dönüş ideal olarak π/2 = 1.57 s sürer; 1.6 s hızlanma ve yavaşlamayı telafi eder.','Yalnızca zamanlama sadece sert zeminde işe yarar. Buzda dene, sonra Deney 02’ye bak.'],
    sensor:['distance öndeki ışın sensörüdür, metre cinsinden.','Onu her 0.1 saniyede bir oku.'],
    gyro:['90° sola dön ve IMU yönelimine (derece) göre dur.','Sonra odom_heading’i dene ve ikisini kaygan zeminde karşılaştır.'],
    pturn:['P kontrolü: dönüş hızı yönelim hatasıyla, 90 - heading ile orantılıdır.','Hata küçüldükçe dönüş kendiliğinden yavaşlar.','Kazancı önce 0.02, sonra 0.3 yap ve Grafikler’de yönelimi karşılaştır.'],
    odometry:['Tekerlek enkoderlerinin ölçtüğü 0.5 m’yi git.','Grafikler’i aç: gerçek yol aynı fikirde mi?'],
    lidar:['LiDAR kutuyu 0.6 m önde görene kadar sür, jiroskopla çeyrek tur sola dön,','sonra LiDAR duvarı görene kadar devam et. Geçmek için tek bir boş ışın yetmez:','rover bir ışından çok daha geniştir. LiDAR saniyede 5 kez tarar.'],
    fusion:['Tamamlayıcı filtre: filter(alpha) yönelim için jiroskopu enkoderlere karşı tartar.','filter(1) yalnızca jiroskopa, filter(0) yalnızca enkoderlere güvenir; varsayılan 0.999.','Buzda bir kare sür, sonra Grafikler’de filtrelenmiş odometriyi enkoder odometrisiyle karşılaştır.'],
    lab1a:['ME425 Lab 1, Bölüm A: üç kez 3 s ileri, 1 s dur, 3 s geri, 1 s dur, 0.10 m/s ile.','TurtleBot3 ile dene. Grafikler’de odometriyi istenen yolla karşılaştır.'],
    lab1b:['ME425 Lab 1, Bölüm B: v = 0.10 m/s, w = 0.30 rad/s ile bir çember (T = 2π/w = 20.94 s).','TurtleBot3’te v’yi 0.2 yap: dış teker motor sınırına dayanır ve çember açılır.'],
    lab1c:['ME425 Lab 1, Bölüm C: 1 rad/s ile yerinde dön. Dört tur 30 s sınırına sığar (25.13 s).','Grafikler’de IMU yönelimini enkoder yönelimiyle, ikisini de gerçekle karşılaştır.']
  },
  fr:{
    turn:['Les deux vitesses de roue sont en rad/s. Une roue droite plus rapide fait tourner à gauche.','Le rover bouge pendant qu’il attend.'],
    square:['Un carré de 0.4 m, en tournant à gauche à chaque coin. drive(v, w) marche pour tout robot et tout écartement.','Un virage de 90° à 1 rad/s dure en théorie π/2 = 1.57 s ; 1.6 s compense l’accélération et le freinage.','Le minutage seul ne marche que sur sol ferme. Essaie sur la glace, puis vois l’Expérience 02.'],
    sensor:['distance est un capteur à rayon vers l’avant, en mètres.','On le lit une fois toutes les 0.1 secondes.'],
    gyro:['Tourne de 90° à gauche et arrête-toi sur le cap de l’IMU (en degrés).','Essaie ensuite odom_heading, et compare les deux sur sol glissant.'],
    pturn:['Commande P : la vitesse de rotation est proportionnelle à l’erreur de cap, 90 - heading.','Quand l’erreur diminue, la rotation ralentit d’elle-même.','Essaie un gain de 0.02, puis de 0.3, et compare le cap dans Courbes.'],
    odometry:['Roule 0.5 m, mesurés par les encodeurs des roues.','Ouvre Courbes : le trajet réel est-il d’accord ?'],
    lidar:['Avance jusqu’à ce que le LiDAR voie la boîte à 0.6 m, tourne d’un quart à gauche au gyroscope,','puis avance jusqu’à ce que le LiDAR voie le mur. Un seul faisceau libre ne suffit pas pour passer :','le rover est bien plus large qu’un rayon. Le LiDAR balaie 5 fois par seconde.'],
    fusion:['Filtre complémentaire : filter(alpha) pèse le gyroscope contre les encodeurs pour le cap.','filter(1) ne croit que le gyroscope, filter(0) que les encodeurs ; 0.999 par défaut.','Fais un carré sur la glace, puis compare l’odométrie filtrée et celle des encodeurs dans Courbes.'],
    lab1a:['ME425 Lab 1, partie A : trois fois 3 s en avant, 1 s d’arrêt, 3 s en arrière, 1 s d’arrêt, à 0.10 m/s.','Essaie-le sur le TurtleBot3. Dans Courbes, compare l’odométrie avec le trajet de consigne.'],
    lab1b:['ME425 Lab 1, partie B : un cercle à v = 0.10 m/s, w = 0.30 rad/s (T = 2π/w = 20.94 s).','Sur le TurtleBot3, passe v à 0.2 : la roue extérieure atteint la limite du moteur et le cercle s’ouvre.'],
    lab1c:['ME425 Lab 1, partie C : rotation sur place à 1 rad/s. Quatre tours tiennent dans la limite de 30 s (25.13 s).','Dans Courbes, compare le cap de l’IMU avec celui des encodeurs, et les deux avec la réalité.']
  }
};
// Translated comments sit over the English example's own code lines, so every language runs the same program.
export const withComments=(source,comments)=>comments.map(c=>'# '+c).join('\n')+'\n'+source.split('\n').filter(l=>!l.startsWith('#')).join('\n');
export function example(name,lang='en'){const c=COMMENTS[lang]?.[name];return c?withComments(EXAMPLES[name],c):EXAMPLES[name];}
