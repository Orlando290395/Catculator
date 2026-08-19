/* Capturas de lo NUEVO de la 1.2.0, para las fichas de las dos tiendas.

   Es una copia reducida de build-capturas.js con dos diferencias:

   1. Cada toma lleva su propio tamaño, porque hay que enseñar el diseño
      horizontal y ese no cabe en 360x640. Se respetan las proporciones que
      acepta Play: 9:16 en vertical (1080x1920) y 16:9 en horizontal
      (1920x1080).

   2. El rótulo del bocadillo va en las dos lenguas y se inyecta al guion. La
      primera versión lo llevaba escrito en español a pelo y la tanda inglesa
      salía con la app en inglés y el gato hablando español.

   Salida: tienda/novedades/ y tienda/novedades-en/ (tienda/ ya está ignorada) */
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROYECTO = __dirname;
const IDIOMA = process.argv.includes('en') ? 'en' : 'es';
const ROOT = path.join(PROYECTO, 'pwa-dist');
/* Las capturas van junto a los paquetes de su versión: todo lo de una
   publicación en una sola carpeta. */
const VERSION = require('./package.json').version;
const OUT = path.join(PROYECTO, 'paquetes', VERSION,
  IDIOMA === 'es' ? 'capturas' : 'capturas-' + IDIOMA);
const PORT = 8146;
const DPR = 3;

const log = (...a) => console.log(...a);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav',
               '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const TOMAS = [
  {
    // Lo más difícil de enseñar y lo más útil: el cursor metido en medio de una
    // cuenta larga, que es justo lo que antes no se podía hacer.
    nombre: '1-cursor-en-medio', w: 360, h: 640,
    tema: 'cian', pelaje: 'naranja', atuendo: 'ninguno', modo: 'basic',
    rotulo: { es: 'Toca donde quieras y corrige ahí mismo ✏️',
              en: 'Tap anywhere and fix it right there ✏️' },
    guion: async ($, wait, rotulo) => {
      for (const k of ['1', '2', '3', '4', '+', '5', '6', '7', '*', '8']) {
        $(`.key[data-k="${k}"]`).click(); await wait(40);
      }
      ponerCursor(3);
      await wait(200);
      say(rotulo, 6000);
      await wait(300);
    }
  },
  {
    // El = repetido: la pantalla enseña 11+3 = 14, o sea la tercera pulsación.
    nombre: '2-igual-repite', w: 360, h: 640,
    tema: 'menta', pelaje: 'gris', atuendo: 'ninguno', modo: 'basic',
    rotulo: { es: 'Pulsa = otra vez y repite la operación 🔁',
              en: 'Press = again to repeat the operation 🔁' },
    guion: async ($, wait, rotulo) => {
      for (const k of ['5', '+', '3']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      for (let i = 0; i < 3; i++) { $('[data-action="equals"]').click(); await wait(300); }
      say(rotulo, 6000);
      await wait(300);
    }
  },
  {
    // Pegar: se enseña el resultado del pegado y el gato diciéndolo.
    nombre: '3-pegar', w: 360, h: 640,
    tema: 'rosa', pelaje: 'blanco', atuendo: 'ninguno', modo: 'basic',
    rotulo: { es: 'Pega precios desde donde sea 📋',
              en: 'Paste prices from anywhere 📋' },
    guion: async ($, wait, rotulo) => {
      pegarTexto(document.documentElement.lang === 'en' ? '1,234.56' : '1.234,56');
      await wait(400);
      say(rotulo, 6000);
      await wait(300);
    }
  },
  {
    // Horizontal, dos columnas. 640x360 lógicos = 1920x1080 reales (16:9).
    nombre: '4-horizontal', w: 640, h: 360,
    tema: 'atigrado', pelaje: 'leon', atuendo: 'ninguno', modo: 'basic',
    rotulo: { es: 'Gíralo y cabe todo 📱', en: 'Turn it and it all fits 📱' },
    guion: async ($, wait, rotulo) => {
      for (const k of ['1', '2', '3', '4', '+', '5', '6', '7']) {
        $(`.key[data-k="${k}"]`).click(); await wait(40);
      }
      say(rotulo, 6000);
      await wait(300);
    }
  },
  {
    // Horizontal con la científica: tres columnas.
    nombre: '5-horizontal-cientifica', w: 640, h: 360,
    tema: 'noche', pelaje: 'tigre', atuendo: 'ninguno', modo: 'sci',
    guion: async ($, wait) => {
      for (const k of ['sqrt(', '1', '4', '4', ')']) {
        const b = $(`.skey[data-k="${k}"]`) || $(`.key[data-k="${k}"]`);
        if (b) { b.click(); await wait(50); }
      }
      $('[data-action="equals"]').click(); await wait(300);
    }
  }
];

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));

  const win = new BrowserWindow({
    width: 420, height: 760, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, zoomFactor: 1,
                      backgroundThrottling: false }
  });
  await win.webContents.session.clearCache();
  await Promise.race([
    win.webContents.session.clearStorageData(),
    new Promise(r => setTimeout(() => { log('aviso: clearStorageData no respondió, sigo'); r(); }, 5000))
  ]);

  await win.loadURL(`http://localhost:${PORT}/`);
  await win.webContents.executeJavaScript(`(async () => {
    if (navigator.serviceWorker) {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    }
    if (window.caches) { for (const k of await caches.keys()) await caches.delete(k); }
    return 'limpio';
  })()`);

  const dbg = win.webContents.debugger;
  dbg.attach('1.3');
  await dbg.sendCommand('Page.enable');

  for (const t of TOMAS) {
    await win.loadURL(`http://localhost:${PORT}/`);
    await win.webContents.executeJavaScript(`
      localStorage.setItem('catculator-theme', '${t.tema}');
      localStorage.setItem('catculator-fur', '${t.pelaje}');
      localStorage.setItem('catculator-outfit', '${t.atuendo}');
      localStorage.setItem('catculator-mode', '${t.modo}');
      localStorage.setItem('catculator-sound', 'on');
      localStorage.setItem('catculator-idioma', '${IDIOMA}');
      localStorage.removeItem('catculator-history');
      localStorage.removeItem('catculator-sesion');
    `);
    await win.loadURL(`http://localhost:${PORT}/`);
    await dbg.sendCommand('Emulation.setDeviceMetricsOverride',
      { width: t.w, height: t.h, deviceScaleFactor: DPR, mobile: false });
    await new Promise(r => setTimeout(r, 1500));

    await win.webContents.insertCSS('::-webkit-scrollbar { width: 0 !important; height: 0 !important; }');
    await win.webContents.insertCSS(
      '.side-panel, .theme-panel, .speech { animation: none !important; transition: none !important; }' +
      '.side-panel:not(.hidden), .theme-panel:not(.hidden) { opacity: 1 !important; }' +
      /* El cursor parpadea con step-end: la mitad del tiempo es invisible y la
         captura salía sin él, que es justo lo que se quiere enseñar. */
      '.caret { animation: none !important; opacity: 1 !important; }');

    const guion = `(async () => {
      const $ = s => document.querySelector(s);
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const rotulo = ${JSON.stringify(t.rotulo ? t.rotulo[IDIOMA] : '')};
      try { await (${t.guion.toString()})($, wait, rotulo); return 'ok'; }
      catch (e) { return 'error: ' + e.message; }
    })()`;
    const res = await win.webContents.executeJavaScript(guion);
    if (res !== 'ok') log('  aviso en ' + t.nombre + ': ' + res);
    await new Promise(r => setTimeout(r, 700));
    win.webContents.invalidate();
    await new Promise(r => setTimeout(r, 300));

    const shot = await dbg.sendCommand('Page.captureScreenshot',
      { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const buf = Buffer.from(shot.data, 'base64');
    fs.writeFileSync(path.join(OUT, t.nombre + '.png'), buf);
    const ancho = buf.readUInt32BE(16), alto = buf.readUInt32BE(20);
    const esperado = (ancho === t.w * DPR && alto === t.h * DPR);
    log('  ' + t.nombre.padEnd(26) + ancho + 'x' + alto +
        (esperado ? '' : '  *** no es el tamaño pedido') +
        '   ' + (buf.length / 1024).toFixed(0) + ' KB');
  }
  log('\nsalida: ' + OUT);
  app.quit();
}

app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
app.whenReady().then(() => server.listen(PORT, () =>
  run().catch(e => { log('ERROR: ' + (e && e.stack || e)); app.quit(); })));
