/* Capturas de lo NUEVO de la versión, para las fichas de las dos tiendas.

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
    /* La novedad entera de esta versión, en una imagen: el panel de compras
       abierto y, al lado, el teclado numérico ENTERO. Antes de la 1.2.1 el
       panel caía justo encima y del teclado solo asomaba la primera columna.

       Va con un precio escrito porque el panel vacío no enseña nada: lo que
       hay que ver es que los importes se leen y las teclas también. */
    nombre: '1-panel-al-lado', w: 640, h: 360,
    tema: 'cian', pelaje: 'naranja', atuendo: 'ninguno', modo: 'basic',
    rotulo: { es: 'El panel ya no tapa el teclado 🛒',
              en: 'The panel no longer covers the keypad 🛒' },
    guion: async ($, wait, rotulo) => {
      for (const k of ['1', '2', '9', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(40); }
      $('#btn-shop').click();
      await wait(300);
      const precio = $('#shop-price');
      precio.value = '1290';
      precio.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(250);
      say(rotulo, 6000);
      await wait(300);
    }
  },
  {
    /* Con la científica son tres columnas y el panel tapa parte de las
       funciones, pero NUNCA los números. Sin rótulo a propósito: el bocadillo
       del gato se centra sobre su columna, que aquí es estrecha, y se sale por
       el borde izquierdo. La imagen se explica sola. */
    nombre: '2-tambien-con-cientifica', w: 640, h: 360,
    tema: 'noche', pelaje: 'tigre', atuendo: 'ninguno', modo: 'sci',
    guion: async ($, wait) => {
      for (const k of ['1', '2', '9', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(40); }
      $('#btn-shop').click();
      await wait(300);
      const precio = $('#shop-price');
      precio.value = '1290';
      precio.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(400);
    }
  },
  {
    /* No es cosa solo del modo compras: se mudaron los cuatro paneles. El de
       temas es el que mejor se lee de un vistazo en una miniatura. */
    nombre: '3-vale-para-todos', w: 640, h: 360,
    tema: 'menta', pelaje: 'gris', atuendo: 'ninguno', modo: 'basic',
    rotulo: { es: 'Vale para todos los paneles 🎨',
              en: 'Works for every panel 🎨' },
    guion: async ($, wait, rotulo) => {
      for (const k of ['4', '2', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(40); }
      $('#btn-theme').click();
      await wait(350);
      say(rotulo, 6000);
      await wait(300);
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
      '.side-panel, .theme-panel, .speech, .clip-menu { animation: none !important; transition: none !important; }' +
      '.side-panel:not(.hidden), .theme-panel:not(.hidden), .clip-menu:not(.hidden) { opacity: 1 !important; }' +
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

    /* El bocadillo del gato se centra sobre su columna, que en horizontal es
       estrecha, así que un rótulo largo se sale por el borde y la palabra
       aparece cortada. En inglés pasa antes: casi siempre es más largo. */
    const globo = await win.webContents.executeJavaScript(`(() => {
      const g = document.getElementById('speech');
      if (!g || g.classList.contains('hidden')) return null;
      const b = g.getBoundingClientRect();
      return { izq: Math.round(b.left), der: Math.round(b.right), ancho: innerWidth };
    })()`);
    if (globo && (globo.izq < 0 || globo.der > globo.ancho)) {
      log('  *** el rótulo de ' + t.nombre + ' se sale (' + globo.izq + '..' +
          globo.der + ' en ' + globo.ancho + '): acórtalo');
    }
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
