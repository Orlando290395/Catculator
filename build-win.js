/* Compila el instalador de Windows FUERA de la carpeta OneDrive.

   Por qué existe este archivo en vez de un simple "electron-builder --win":
   compilando dentro de C:\Users\...\OneDrive\... el paso final de NSIS falla
   siempre con

       File: "...\dist\__uninstaller-nsis-catculator.exe" -> no files found

   NSIS crea el desinstalador y acto seguido intenta meterlo dentro del
   instalador, pero el filtro de OneDrive se interpone con el archivo recién
   escrito y para NSIS es como si no existiera. No hace falta que la carpeta
   esté sincronizando: basta con que el filtro esté montado en esa ruta.

   Comprobado a la contra: la misma compilación, con la misma configuración,
   sale a la primera si la salida va a %LOCALAPPDATA%.

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

const instalador = fs.readdirSync(SALIDA).find(f => /Setup .*\.exe$/.test(f));
if (instalador) {
  const p = path.join(SALIDA, instalador);
  console.log('\nListo: ' + p);
  console.log('       ' + (fs.statSync(p).size / 1048576).toFixed(1) + ' MB 🐱');
  console.log('\nPara abrir la carpeta:  explorer "' + SALIDA + '"');
} else {
  console.log('\nCompiló, pero no encuentro el instalador en ' + SALIDA);
}
