/* Capturas para la ficha de Microsoft Store: la app real a 1366x768 (el mínimo
   que exige la tienda para escritorio), enseñando las funciones estrella.
   Se corre con: npm run capturas:store  (la salida va a microsoft-store/capturas). */
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'pwa-dist');
const OUT = path.join(__dirname, 'capturas');
const PORT = 8146;
const W = 1366, H = 768;

const log = (...a) => console.log(...a);

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

/* Cada toma: tema + pelaje + atuendo, y un guion que deja algo interesante en
   pantalla. Los guiones usan los ids reales de la app. */
const TOMAS = [
  {
    nombre: '1-fraccion-cian', tema: 'cian', pelaje: 'carbon', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['2', '/', '8']) { $(`.key[data-k="${k}"]`).click(); await wait(60); }
      $('[data-action="equals"]').click(); await wait(300);
      $('#btn-frac').click(); await wait(400);
    }
  },
  {
    nombre: '2-compras-menta', tema: 'menta', pelaje: 'gris', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['8', '5', '0', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('[data-action="equals"]').click(); await wait(250);
      $('#btn-shop').click(); await wait(500);
    }
  },
  {
    nombre: '3-quiz-lavanda', tema: 'lavanda', pelaje: 'naranja', atuendo: 'mago', modo: 'basic',
    guion: async ($, wait) => {
      $('#btn-quiz').click(); await wait(500);
    }
  },
  {
    nombre: '4-cientifica-noche', tema: 'noche', pelaje: 'negro', atuendo: 'ninguno', modo: 'sci',
    guion: async ($, wait) => {
      for (const k of ['sqrt(', '2', ')']) { $(`.key[data-k="${k}"], .skey[data-k="${k}"]`).click(); await wait(60); }
      $('[data-action="equals"]').click(); await wait(300);
    }
  },
  {
    nombre: '5-conversor-atigrado', tema: 'atigrado', pelaje: 'blanco', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['1', '0', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('#btn-conv').click(); await wait(500);
    }
  }
];

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: W, height: H, useContentSize: true, show: false,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, zoomFactor: 1,
      backgroundThrottling: false // ventana oculta: sin esto se congelan las animaciones
    }
  });

  // Sin esto se sirven archivos viejos: los guarda tanto la caché http de
  // Electron como el service worker de la propia app (cache-first por diseño).
  await win.webContents.session.clearCache();
  await win.webContents.session.clearStorageData();

  for (const t of TOMAS) {
    await win.loadURL(`http://localhost:${PORT}/`);
    await win.webContents.executeJavaScript(`
      localStorage.setItem('catculator-theme', '${t.tema}');
      localStorage.setItem('catculator-fur', '${t.pelaje}');
      localStorage.setItem('catculator-outfit', '${t.atuendo}');
      localStorage.setItem('catculator-mode', '${t.modo}');
      localStorage.setItem('catculator-sound', 'on');
      localStorage.removeItem('catculator-history');
      localStorage.removeItem('catculator-shop');
    `);
    await win.loadURL(`http://localhost:${PORT}/`);
    await new Promise(r => setTimeout(r, 1500));
    await win.webContents.insertCSS('::-webkit-scrollbar { width: 0 !important; height: 0 !important; }');
    // Los paneles entran con animación; en la captura deben estar ya asentados
    await win.webContents.insertCSS('.side-panel, .speech { animation: none !important; transition: none !important; }');

    const guion = `(async () => {
      const $ = s => document.querySelector(s);
      const wait = ms => new Promise(r => setTimeout(r, ms));
      try { await (${t.guion.toString()})($, wait); return 'ok'; }
      catch (e) { return 'error: ' + e.message; }
    })()`;
    const res = await win.webContents.executeJavaScript(guion);
    if (res !== 'ok') log('  aviso en ' + t.nombre + ': ' + res);
    await new Promise(r => setTimeout(r, 700));

    let img = await win.webContents.capturePage();
    const s = img.getSize();
    if (s.width !== W || s.height !== H) img = img.resize({ width: W, height: H, quality: 'best' });
    const dest = path.join(OUT, t.nombre + '.png');
    fs.writeFileSync(dest, img.toPNG());
    log(t.nombre.padEnd(24) + W + 'x' + H + '  ' + (fs.statSync(dest).size / 1024).toFixed(0) + ' KB');
  }
  log('FIN');
  app.quit();
}

app.whenReady().then(() => server.listen(PORT, () =>
  run().catch(e => { log('ERROR: ' + (e && e.stack || e)); app.quit(); })));
