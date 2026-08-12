/* Capturas para la ficha de Play Store: la app real en pantalla de teléfono
   (360x640 lógicos) a 1080x1920 de verdad, enseñando las funciones estrella.
   Se corre con: npm run capturas  (la salida va a tienda/capturas).

   Por qué el DevTools Protocol y no capturePage(): la ventana no puede pasar del
   área de trabajo del monitor (~775 px de alto aquí), así que capturePage daba
   660 px que había que estirar a 1920 → capturas borrosas. Con
   Emulation.setDeviceMetricsOverride la página se RENDERIZA a 3x y
   Page.captureScreenshot devuelve 1080x1920 nítidos. */
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

/* El idioma se siembra en localStorage antes de cargar la página, igual que el
   tema y el pelaje: es más fiable que forzar el idioma de Chromium y usa el
   mismo camino que un usuario que lo elige a mano.
     npm run capturas      → español, a tienda/capturas
     npm run capturas:en   → inglés,  a tienda/capturas-en */
const IDIOMA_CAP = process.argv.includes('en') ? 'en' : 'es';

const ROOT = path.join(__dirname, 'pwa-dist');
const OUT = path.join(__dirname,
  IDIOMA_CAP === 'es' ? 'tienda/capturas' : 'tienda/capturas-' + IDIOMA_CAP);
const PORT = 8145;
const W = 360, H = 640, DPR = 3;   // 360x640 x3 = 1080x1920

const log = (...a) => console.log(...a);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };

fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

/* Cada toma: tema + pelaje + atuendo, y un guion que deja algo interesante en
   pantalla. Los guiones usan los ids reales de la app. Dos tomas llevan traje
   (mago y pirata) para enseñar el gato nuevo sin repetir siempre el mismo. */
const TOMAS = [
  {
    nombre: '1-fraccion-cian', tema: 'cian', pelaje: 'naranja', atuendo: 'mago', modo: 'basic',
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
      $('#shop-panel').scrollTop = 0;
    }
  },
  {
    // En pantalla de teléfono el panel de compras no cabe entero: esta toma lo
    // baja hasta el conversor de divisas, que es lo nuevo de la versión.
    nombre: '3-divisas-rosa', tema: 'rosa', pelaje: 'blanco', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['2', '5', '0', '0', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('[data-action="equals"]').click(); await wait(250);
      $('#btn-shop').click(); await wait(500);
      $('#shop-panel').scrollTop = $('#shop-panel').scrollHeight;
      await wait(300);
    }
  },
  {
    nombre: '4-personaliza-atigrado', tema: 'atigrado', pelaje: 'negro', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['1', '2', '*', '1', '2']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('[data-action="equals"]').click(); await wait(250);
      $('#btn-theme').click(); await wait(600);
      // Arriba del todo, no abajo: ahi esta el selector de idioma, lo unico
      // que no se ve en ninguna otra toma. Los atuendos salen puestos en el
      // gato en las tomas 1 (mago) y 5 (pirata), y lucen mejor asi.
      $('#theme-panel').scrollTop = 0;
      await wait(300);
    }
  },
  {
    nombre: '5-quiz-lavanda', tema: 'lavanda', pelaje: 'negro', atuendo: 'pirata', modo: 'basic',
    guion: async ($, wait) => {
      $('#btn-quiz').click(); await wait(600);
      // Contesta bien la pregunta que salga: así la toma muestra al gato
      // celebrando, la racha 🔥 y la siguiente pregunta ya en pantalla.
      const txt = $('#expression').textContent.replace('🎓', '').split('=')[0].trim();
      const m = txt.match(/^(\d+)\s*([+−×÷])\s*(\d+)$/);
      if (m) {
        const a = +m[1], b = +m[3];
        const r = m[2] === '+' ? a + b : m[2] === '−' ? a - b
                : m[2] === '×' ? a * b : a / b;
        for (const d of String(r)) { $(`.key[data-k="${d}"]`).click(); await wait(70); }
        $('[data-action="equals"]').click(); await wait(400);
      }
    }
  },
  {
    nombre: '6-cientifica-noche', tema: 'noche', pelaje: 'carbon', atuendo: 'ninguno', modo: 'sci',
    guion: async ($, wait) => {
      for (const k of ['sqrt(', '2', ')']) { $(`.key[data-k="${k}"], .skey[data-k="${k}"]`).click(); await wait(60); }
      $('[data-action="equals"]').click(); await wait(300);
    }
  },
  {
    nombre: '7-conversor-gris', tema: 'menta', pelaje: 'blanco', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['1', '0', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('#btn-conv').click(); await wait(500);
    }
  }
];

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  // La carpeta es 100% generada: se limpia para que no queden capturas viejas
  // de tomas que ya se renombraron o se quitaron.
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
  }

  const win = new BrowserWindow({
    width: 420, height: 760, show: false,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, zoomFactor: 1,
      backgroundThrottling: false // ventana oculta: sin esto se congelan las animaciones
    }
  });

  // Sin esto se sirven archivos viejos: los guarda tanto la caché http de
  // Electron como el service worker de la propia app (cache-first por diseño).
  // clearStorageData se queda colgado para siempre si otro Electron zombi tiene
  // tomada la base de datos de la sesión ("Failed to delete the database"), así
  // que se le pone plazo: la limpieza que de verdad importa se hace en la página.
  await win.webContents.session.clearCache();
  await Promise.race([
    win.webContents.session.clearStorageData(),
    new Promise(r => setTimeout(() => { log('aviso: clearStorageData no respondió, sigo'); r(); }, 5000))
  ]);

  // El tamaño real de la ventana ya da igual: manda la emulación. Ojo, hay que
  // cargar una página ANTES de atacar el debugger o Electron se cae en seco.
  await win.loadURL(`http://localhost:${PORT}/`);
  // El service worker es cache-first: si sobrevive, sirve el HTML/CSS viejo.
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
  // mobile:true también tumba el proceso; con esto basta para el viewport y el 3x
  const emular = () => dbg.sendCommand('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: DPR, mobile: false });

  for (const t of TOMAS) {
    await win.loadURL(`http://localhost:${PORT}/`);
    await win.webContents.executeJavaScript(`
      localStorage.setItem('catculator-theme', '${t.tema}');
      localStorage.setItem('catculator-fur', '${t.pelaje}');
      localStorage.setItem('catculator-outfit', '${t.atuendo}');
      localStorage.setItem('catculator-mode', '${t.modo}');
      localStorage.setItem('catculator-sound', 'on');
      localStorage.setItem('catculator-idioma', '${IDIOMA_CAP}');
      localStorage.removeItem('catculator-history');
      localStorage.removeItem('catculator-shop');
      localStorage.removeItem('catculator-rates');
      localStorage.removeItem('catculator-rates-fechas');
    `);
    await win.loadURL(`http://localhost:${PORT}/`);
    await emular();
    await new Promise(r => setTimeout(r, 1500));

    /* Chromium en Windows dibuja barras de scroll clásicas; Android las superpone
       y las desvanece. Ocultarlas hace que la captura se parezca al móvil real. */
    await win.webContents.insertCSS('::-webkit-scrollbar { width: 0 !important; height: 0 !important; }');
    // Los paneles entran con pop-in (arranca en opacity 0) y en ventana oculta esa
    // animación a veces no avanza: el panel salía invisible. Se anula la animación
    // y se fuerza el estado final SOLO en los paneles abiertos (el globo de
    // diálogo .speech se esconde justo con opacity: 0, así que no se toca).
    await win.webContents.insertCSS(
      '.side-panel, .theme-panel, .speech { animation: none !important; transition: none !important; }' +
      '.side-panel:not(.hidden), .theme-panel:not(.hidden) { opacity: 1 !important; }');

    const guion = `(async () => {
      const $ = s => document.querySelector(s);
      const wait = ms => new Promise(r => setTimeout(r, ms));
      try { await (${t.guion.toString()})($, wait); return 'ok'; }
      catch (e) { return 'error: ' + e.message; }
    })()`;
    const res = await win.webContents.executeJavaScript(guion);
    if (res !== 'ok') log('  aviso en ' + t.nombre + ': ' + res);
    await new Promise(r => setTimeout(r, 700));
    // Con la ventana oculta el compositor solo repinta si algo se anima: sin esto
    // una toma que solo abre un panel sale como si nada hubiera pasado.
    win.webContents.invalidate();
    await new Promise(r => setTimeout(r, 300));

    const shot = await dbg.sendCommand('Page.captureScreenshot',
      { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const buf = Buffer.from(shot.data, 'base64');
    const dest = path.join(OUT, t.nombre + '.png');
    fs.writeFileSync(dest, buf);
    const ancho = buf.readUInt32BE(16), alto = buf.readUInt32BE(20);
    if (ancho !== W * DPR || alto !== H * DPR) log('  ¡ojo! ' + t.nombre + ' salió a ' + ancho + 'x' + alto);
    log(t.nombre.padEnd(24) + ancho + 'x' + alto + '  ' + (buf.length / 1024).toFixed(0) + ' KB');
  }
  log('FIN');
  app.quit();
}

app.whenReady().then(() => server.listen(PORT, () =>
  run().catch(e => { log('ERROR: ' + (e && e.stack || e)); app.quit(); })));
