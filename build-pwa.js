/* Arma pwa-dist/: solo lo que la versión web necesita.
   Sirve para arrastrar a Netlify Drop o para publicar en GitHub Pages.
   Deja fuera Electron (main.js, node_modules, iconos de escritorio). */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'pwa-dist');

const FILES = [
  'index.html',
  'style.css',
  'renderer.js',
  'manifest.json',
  'sw.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

fs.rmSync(OUT, { recursive: true, force: true });

let total = 0;
for (const file of FILES) {
  const src = path.join(__dirname, file);
  if (!fs.existsSync(src)) throw new Error('falta ' + file + ' (¿corriste "npm run icon"?)');
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  total += fs.statSync(src).size;
}

console.log('pwa-dist/ listo: ' + FILES.length + ' archivos, ' + (total / 1024).toFixed(1) + ' KB 🐱');
console.log('Arrastra la carpeta pwa-dist a https://app.netlify.com/drop');
