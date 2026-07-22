/* Capturas para la ficha de Play Store: la app real, a 1080x1920, con temas distintos.
   Se sirve por http para que el localStorage persista por origen. */
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'pwa-dist');
const OUT = path.join(__dirname, 'tienda/capturas');

const PORT = 8145;
const ESCALA = 3; // 360x640 logicos x3 = 1080x1920 reales


const log = (...a) => console.log(...a);   // Electron en Windows no lo muestra; usar > archivo

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const TOMAS = [
  { nombre: '1-basica-cian',      tema: 'cian',     pelaje: 'carbon',  modo: 'basic' },
  { nombre: '2-cientifica-menta', tema: 'menta',    pelaje: 'gris',    modo: 'sci'   },
  { nombre: '3-noche',            tema: 'noche',    pelaje: 'negro',   modo: 'basic' },
  { nombre: '4-atigrado',         tema: 'atigrado', pelaje: 'naranja', modo: 'basic' },
  { nombre: '5-rosa',             tema: 'rosa',     pelaje: 'blanco',  modo: 'sci'   }
];

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: 360, height: 640, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, zoomFactor: 1 }
  });

  // Sin esto se sirven archivos viejos: los guarda tanto la caché http de
  // Electron como el service worker de la propia app (cache-first por diseño).
  await win.webContents.session.clearCache();
  await win.webContents.session.clearStorageData();

  for (const t of TOMAS) {
    // fijar preferencias antes de que arranque renderer.js
    await win.loadURL(`http://localhost:${PORT}/`);
    await win.webContents.executeJavaScript(`
      localStorage.setItem('catculator-theme', '${t.tema}');
      localStorage.setItem('catculator-fur', '${t.pelaje}');
      localStorage.setItem('catculator-mode', '${t.modo}');
      localStorage.setItem('catculator-sound', 'on');
    `);
    await win.loadURL(`http://localhost:${PORT}/`); // recarga ya con las preferencias
    await new Promise(r => setTimeout(r, 1600));

    /* Chromium en Windows dibuja barras de scroll clasicas; Android las superpone y
       las desvanece. Ocultarlas hace que la captura se parezca al movil de verdad. */
    await win.webContents.insertCSS('::-webkit-scrollbar { width: 0 !important; height: 0 !important; }');

    // algo en pantalla: mejor que un 0 pelado
    await win.webContents.executeJavaScript(`
      (() => {
        const pulsa = t => {
          const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t);
          if (b) b.click();
          return !!b;
        };
        const ok = ['7','.','5','×','8'].map(pulsa);
        pulsa('=');
        return ok.every(Boolean);
      })()
    `).then(ok => { if (!ok) log('  aviso: no se pulsaron todas las teclas en ' + t.nombre); })
      .catch(e => log('  error pulsando: ' + e));
    await new Promise(r => setTimeout(r, 1200));

    const img = await win.webContents.capturePage();
    const grande = img.resize({ width: 360 * ESCALA, height: 640 * ESCALA, quality: 'best' });
    const dest = path.join(OUT, t.nombre + '.png');
    fs.writeFileSync(dest, grande.toPNG());
    const s = grande.getSize();
    log(t.nombre.padEnd(20) + s.width + 'x' + s.height + '  ' +
        (fs.statSync(dest).size / 1024).toFixed(0) + ' KB');
  }
  log('FIN');
  app.quit();
}

app.whenReady().then(() => server.listen(PORT, () =>
  run().catch(e => { log('ERROR: ' + (e && e.stack || e)); app.quit(); })));
