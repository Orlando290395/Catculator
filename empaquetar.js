/* Prepara UNA PUBLICACIÓN entera y la deja en una sola carpeta.

       npm run paquetes                      compila todo y lo recoge
       npm run paquetes -- --solo-recoger    solo copia lo ya compilado

   Sale todo aquí, junto:

       <proyecto>\paquetes\<versión>\
           Catculator-<v>-vc<n>.apk        probar en el móvil
           Catculator-<v>-vc<n>.aab        subir a Google Play
           Catculator-<v>.appx             subir a Microsoft Store
           Catculator-Setup-<v>.exe        instalar en Windows
           NOVEDADES.txt                   textos de las dos tiendas, medidos
           capturas/                       capturas de lo nuevo, español
           capturas-en/                    ídem en inglés

   POR QUÉ EXISTE
   Cada pieza acababa en un sitio distinto —el .aab en android/app/build/...,
   el .appx en microsoft-store/dist/, el instalador fuera del proyecto entero, y
   las capturas y los textos donde cayera— y encima los dos de Android se llaman
   "app-release" en todas las versiones, así que fuera de su carpeta no había
   manera de saber cuál era cuál.

   EL MATIZ DE DEFENDER
   El instalador de Windows NO se puede COMPILAR dentro del proyecto: el Acceso
   Controlado a Carpetas de Defender tumba a NSIS, y por eso build-win.js compila
   en %LOCALAPPDATA%. Pero COPIAR el .exe ya hecho sí pasa, porque Node no está
   en la lista negra aunque los binarios de Git Bash sí lo estén. O sea: se
   compila fuera y se trae.

   La carpeta paquetes/ está en .gitignore: son 200 MB por versión y se
   regeneran con este mismo comando. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = __dirname;
const SOLO_RECOGER = process.argv.includes('--solo-recoger');
/* Entre comillas y con ruta completa: cmd.exe NO busca ejecutables en el
   directorio actual, asi que "gradlew.bat" a secas no se encuentra aunque el
   cwd sea android/. */
const GRADLEW = '"' + path.join(__dirname, 'android', 'gradlew.bat') + '"';

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

/* Lanza un comando y aborta si falla.

   shell:true es obligatorio en Windows: npx y gradlew son .cmd/.bat, y desde
   Node 20 spawn ya no los ejecuta solo.

   ELECTRON_RUN_AS_NODE se quita a mano: si viene puesta en el entorno, Electron
   arranca como Node, sin ventana, y las capturas salen en blanco sin decir por
   qué. */
function correr(titulo, comando, cwd) {
  console.log('--- ' + titulo + ' ---');
  const entorno = Object.assign({}, process.env);
  delete entorno.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(comando, { stdio: 'inherit', cwd: cwd || RAIZ, shell: true, env: entorno });
  if (r.error) { console.error('\nNo pude lanzarlo: ' + r.error.message); process.exit(1); }
  if (r.status !== 0) { console.error('\nFalló: ' + titulo + ' (código ' + r.status + ')'); process.exit(1); }
  console.log('');
}

if (!SOLO_RECOGER) {
  // El orden importa: la PWA alimenta a Android, y cap sync la copia dentro.
  correr('PWA', 'node build-pwa.js');
  correr('Sincronizar Android', 'npx cap sync android');
  correr('Android: bundle (.aab, es lo que sube a Play)', GRADLEW + ' bundleRelease --console=plain',
         path.join(RAIZ, 'android'));
  correr('Android: apk (para probar en el móvil)', GRADLEW + ' assembleRelease --console=plain',
         path.join(RAIZ, 'android'));
  correr('Windows: instalador', 'node build-win.js');
  correr('Microsoft Store: appx', 'npx electron-builder --config microsoft-store/electron-builder.yml');
  // Las capturas van DESPUÉS de la PWA: se sacan sirviendo pwa-dist
  correr('Capturas de novedades (español)', 'npx electron build-capturas-novedades.js');
  correr('Capturas de novedades (inglés)', 'npx electron build-capturas-novedades.js en');
  correr('Textos de novedades', 'node build-novedades.js');
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

/* Las capturas y los textos ya los escriben sus propios guiones dentro de la
   carpeta de la versión, así que aquí solo se comprueba que estén. */
console.log('');
for (const [sub, que] of [['NOVEDADES.txt', 'textos de las dos tiendas'],
                          ['capturas', 'capturas de lo nuevo (español)'],
                          ['capturas-en', 'capturas de lo nuevo (inglés)']]) {
  const f = path.join(carpeta, sub);
  if (!fs.existsSync(f)) {
    faltan++;
    console.log('  *** FALTA: ' + sub + '   ' + que);
    continue;
  }
  const s = fs.statSync(f);
  const detalle = s.isDirectory()
    ? fs.readdirSync(f).filter(x => x.endsWith('.png')).length + ' capturas'
    : (s.size / 1024).toFixed(1) + ' KB';
  console.log('  ' + sub.padEnd(32) + detalle.padStart(11) + '   ' + que);
}

if (faltan) {
  console.log('\nFaltan ' + faltan + ' piezas. Con --solo-recoger es normal si no' +
              ' las habías generado antes.');
}
if (bloqueados) {
  console.log('\n' + bloqueados + ' copias bloqueadas. Mira el registro de Defender:');
  console.log("  Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1123,1124} -MaxEvents 10");
}

console.log('\nTodo en:  ' + carpeta);
console.log('Abrir:    explorer "' + carpeta + '"');
console.log('\nEl APK es para probar en el móvil; a Play se sube el AAB. 🐱');
if (faltan || bloqueados) process.exit(1);
