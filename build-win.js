/* Compila el instalador de Windows FUERA de la carpeta del proyecto.

   Por qué existe este archivo en vez de un simple "electron-builder --win":
   compilando dentro del proyecto, el paso final de NSIS falla siempre con

       File: "...\dist\__uninstaller-nsis-catculator.exe" -> no files found

   La culpa NO es de OneDrive, aunque la ruta lo lleve en el nombre (esa carpeta
   es local y OneDrive ni siquiera está instalado). Es el **Acceso Controlado a
   Carpetas** de Windows Defender, que está activado y protege Documentos — y el
   proyecto vive dentro. NSIS crea el desinstalador y, al intentar meterlo en el
   instalador, Defender bloquea la operación en silencio: para NSIS el archivo
   no existe.

   Se ve en el visor de eventos, y no es un caso aislado: el mismo bloqueo
   tumbaba a rm, cp y mkdir dentro del proyecto, que es lo que durante meses
   pareció "el shell falla a ratos".

       Get-WinEvent -FilterHashtable @{
         LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1123,1124 }

   Comprobado a la contra: la misma compilación, con la misma configuración,
   sale a la primera si la salida va a %LOCALAPPDATA%, que no está protegido.

   Arreglo de raíz, si algún día se quiere (pide administrador): añadir la
   carpeta del proyecto a las carpetas permitidas en
   Seguridad de Windows → Protección antivirus → Acceso controlado a carpetas.
   Mientras tanto, este rodeo basta y no toca la configuración del sistema.

   De paso, un aviso para quien venga a tocar la lista `files` de package.json:
   los paquetes de @capacitor están excluidos a propósito. Solo sirven para
   compilar Android, en escritorio no se usan (`window.Capacitor` lo inyecta el
   WebView de Android, no el paquete de npm), y al colarse arrastraban el árbol
   de gradle entero: rutas de más de 260 caracteres que Windows no sabe ni
   borrar. El app.asar pasó de arrastrar eso a pesar 512 KB. */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SALIDA = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'Catculator-build');

fs.mkdirSync(SALIDA, { recursive: true });
console.log('Compilando en ' + SALIDA + '  (fuera de OneDrive, ver el comentario de arriba)');

/* shell:true es obligatorio: en Windows electron-builder es un .cmd, y desde
   Node 20 spawn ya no los ejecuta solo (lo quitaron por seguridad). Sin esto
   falla al instante con código null, que no dice absolutamente nada. */
const r = spawnSync(
  'npx electron-builder --win --config.directories.output="' + SALIDA + '"',
  { stdio: 'inherit', cwd: __dirname, shell: true }
);

if (r.error) {
  console.error('\nNo pude ni lanzar electron-builder: ' + r.error.message);
  process.exit(1);
}
if (r.status !== 0) {
  console.error('\nLa compilación falló (código ' + r.status + ')');
  process.exit(r.status || 1);
}

/* El más reciente, no el primero que aparezca: la carpeta guarda los
   instaladores de versiones anteriores y con find() se anunciaba el viejo.
   Compilabas la 1.2.0 y el mensaje final decía 1.1.0. */
const instalador = fs.readdirSync(SALIDA)
  .filter(f => /Setup .*\.exe$/.test(f))
  .map(f => ({ f, t: fs.statSync(path.join(SALIDA, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)
  .map(x => x.f)[0];
if (instalador) {
  const p = path.join(SALIDA, instalador);
  console.log('\nListo: ' + p);
  console.log('       ' + (fs.statSync(p).size / 1048576).toFixed(1) + ' MB 🐱');
  console.log('\nPara abrir la carpeta:  explorer "' + SALIDA + '"');
} else {
  console.log('\nCompiló, pero no encuentro el instalador en ' + SALIDA);
}
