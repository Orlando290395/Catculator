/* Genera TODOS los paquetes de una versión y los deja en un solo sitio.

       npm run paquetes                      compila todo y lo recoge
       npm run paquetes -- --solo-recoger    solo copia lo ya compilado

   Existe porque cada paquete acababa en una carpeta distinta, y uno de ellos ni
   siquiera dentro del proyecto:

       android/app/build/outputs/bundle/release/app-release.aab
       android/app/build/outputs/apk/release/app-release.apk
       microsoft-store/dist/Catculator 1.2.0.appx
       %LOCALAPPDATA%/Catculator-build/Catculator Setup 1.2.0.exe

   Encima los dos de Android se llaman igual en todas las versiones
   ("app-release.apk"), así que fuera de su carpeta no hay manera de saber cuál
   es cuál. Aquí salen renombrados con versión y versionCode.

   DÓNDE QUEDAN

       <proyecto>\paquetes\<versión>\

   Dentro del proyecto porque es donde Orlando los busca. Ojo con el matiz que
   hace falta para que eso funcione: el instalador de Windows NO se puede
   COMPILAR aquí dentro —el Acceso Controlado a Carpetas de Defender bloquea a
   NSIS, por eso existe build-win.js y compila en %LOCALAPPDATA%— pero COPIAR el
   .exe ya hecho sí pasa, porque Node no está en la lista negra de Defender
   mientras que los binarios de Git Bash sí. O sea: se compila fuera y se trae.

   La carpeta paquetes/ está en .gitignore: son 200 MB por versión y se
   regeneran con un comando. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = __dirname;
const SOLO_RECOGER = process.argv.includes('--solo-recoger');

// ---------- Qué versión es esta ----------
const version = require('./package.json').version;
const gradle = fs.readFileSync(path.join(RAIZ, 'android/app/build.gradle'), 'utf8');
const vc = (gradle.match(/versionCode\s+(\d+)/) || [])[1] || '0';
const vn = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1] || '?';

const DESTINO = path.join(RAIZ, 'paquetes', version);
// Si Defender llegara a bloquear también la copia, al menos que no se pierdan
const RESERVA = path.join(process.env.LOCALAPPDATA || os.tmpdir(),
  'Catculator-paquetes', version);

console.log('Catculator ' + version + '   (Android versionCode ' + vc + ' / ' + vn + ')');
console.log('Destino: ' + DESTINO + '\n');

/* Lanza un comando y aborta si falla. shell:true es obligatorio en Windows: npx
   y gradlew son .cmd/.bat, y desde Node 20 spawn ya no los ejecuta solo. */
function correr(titulo, comando, cwd) {
  console.log('--- ' + titulo + ' ---');
  const r = spawnSync(comando, { stdio: 'inherit', cwd: cwd || RAIZ, shell: true });
  if (r.error) { console.error('\nNo pude lanzarlo: ' + r.error.message); process.exit(1); }
  if (r.status !== 0) { console.error('\nFalló: ' + titulo + ' (código ' + r.status + ')'); process.exit(1); }
  console.log('');
}

if (!SOLO_RECOGER) {
  // El orden importa: la PWA alimenta a Android, y cap sync la copia dentro.
  correr('PWA', 'node build-pwa.js');
  correr('Sincronizar Android', 'npx cap sync android');
  correr('Android: bundle (.aab, es lo que sube a Play)', 'gradlew.bat bundleRelease --console=plain',
         path.join(RAIZ, 'android'));
  correr('Android: apk (para probar en el móvil)', 'gradlew.bat assembleRelease --console=plain',
         path.join(RAIZ, 'android'));
  correr('Windows: instalador', 'node build-win.js');
  correr('Microsoft Store: appx', 'npx electron-builder --config microsoft-store/electron-builder.yml');
}

// ---------- Recoger ----------
const LOCAL = process.env.LOCALAPPDATA || os.tmpdir();
const PIEZAS = [
  { que: 'probar en el móvil',      de: 'android/app/build/outputs/apk/release/app-release.apk',
    a: 'Catculator-' + version + '-vc' + vc + '.apk' },
  { que: 'subir a Google Play',     de: 'android/app/build/outputs/bundle/release/app-release.aab',
    a: 'Catculator-' + version + '-vc' + vc + '.aab' },
  { que: 'subir a Microsoft Store', de: 'microsoft-store/dist/Catculator ' + version + '.appx',
    a: 'Catculator-' + version + '.appx' },
  { que: 'instalar en Windows',     de: path.join(LOCAL, 'Catculator-build', 'Catculator Setup ' + version + '.exe'),
    a: 'Catculator-Setup-' + version + '.exe' }
];

let carpeta = DESTINO;
try {
  fs.mkdirSync(DESTINO, { recursive: true });
} catch (e) {
  console.log('AVISO: no puedo crear ' + DESTINO);
  console.log('       (' + e.message + ')');
  console.log('       Suele ser el Acceso Controlado a Carpetas de Defender.');
  console.log('       Uso la carpeta de reserva.\n');
  carpeta = RESERVA;
  fs.mkdirSync(RESERVA, { recursive: true });
}

let faltan = 0, bloqueados = 0;
console.log('--- Recogiendo ---');
for (const p of PIEZAS) {
  const origen = path.isAbsolute(p.de) ? p.de : path.join(RAIZ, p.de);
  if (!fs.existsSync(origen)) {
    faltan++;
    console.log('  *** FALTA: ' + p.a + '   (esperaba ' + origen + ')');
    continue;
  }
  try {
    fs.copyFileSync(origen, path.join(carpeta, p.a));
    const mb = (fs.statSync(path.join(carpeta, p.a)).size / 1048576).toFixed(1);
    console.log('  ' + p.a.padEnd(32) + mb.padStart(7) + ' MB   ' + p.que);
  } catch (e) {
    bloqueados++;
    console.log('  *** BLOQUEADO al copiar ' + p.a + ': ' + e.message);
  }
}

if (faltan) {
  console.log('\nFaltan ' + faltan + ' por compilar. Con --solo-recoger es normal' +
              ' si no los habías hecho antes.');
}
if (bloqueados) {
  console.log('\n' + bloqueados + ' copias bloqueadas. Mira el registro de eventos de Defender:');
  console.log("  Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1123,1124} -MaxEvents 10");
}

console.log('\nTodo en:  ' + carpeta);
console.log('Abrir:    explorer "' + carpeta + '"');
console.log('\nEl APK es para probar en el móvil; a Play se sube el AAB. 🐱');
if (faltan || bloqueados) process.exit(1);
