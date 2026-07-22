/* Genera los logos que exige el paquete de Microsoft Store (.appx),
   con el mismo gato de build-icon.js. Se corren con: npm run icon:store */
const fs = require('fs');
const path = require('path');
const { render, renderSplash, encodePNG } = require('../build-icon.js');

const OUT = path.join(__dirname, 'build', 'appx');
fs.mkdirSync(OUT, { recursive: true });

const write = (name, rgba, w, h) =>
  fs.writeFileSync(path.join(OUT, name), encodePNG(rgba, w, h));

// Los mosaicos de Windows son cuadrados sin recorte: fondo cian a sangre
write('StoreLogo.png', render(50, { bleed: true, catScale: 0.8 }), 50, 50);
write('Square44x44Logo.png', render(44, { bleed: true, catScale: 0.8 }), 44, 44);
write('Square150x150Logo.png', render(150, { bleed: true, catScale: 0.72 }), 150, 150);
write('Wide310x150Logo.png', renderSplash(310, 150), 310, 150);

console.log('Logos de Microsoft Store listos en microsoft-store/build/appx 🐱');

// Imágenes de marca para la FICHA de la Store (se suben a mano en Partner
// Center → Logotipos de Store). Las grandes tardan un poquito: paciencia.
const FICHA = path.join(__dirname, 'logos-ficha');
fs.mkdirSync(FICHA, { recursive: true });
const writeFicha = (name, rgba, w, h) =>
  fs.writeFileSync(path.join(FICHA, name), encodePNG(rgba, w, h));

writeFicha('poster-9x16-1440x2160.png', renderSplash(1440, 2160, 0.66), 1440, 2160);
writeFicha('caja-1x1-2160.png', render(2160, { bleed: true, catScale: 0.86 }), 2160, 2160);
writeFicha('icono-300.png', render(300, { bleed: true, catScale: 0.86 }), 300, 300);
writeFicha('icono-150.png', render(150, { bleed: true, catScale: 0.86 }), 150, 150);
writeFicha('icono-71.png', render(71, { bleed: true, catScale: 0.8 }), 71, 71);

console.log('Imágenes de la ficha listas en microsoft-store/logos-ficha 🐱');
