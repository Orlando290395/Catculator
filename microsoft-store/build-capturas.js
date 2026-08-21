/* Capturas para la ficha de Microsoft Store: la app real a 1366x768 (el mínimo
   que exige la tienda para escritorio), enseñando las funciones estrella.
   Se corre con: npm run capturas:store  (la salida va a microsoft-store/capturas). */
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'pwa-dist');
// Mismo esquema que el generador de Play: 'en' manda la salida a capturas-en/
const IDIOMA_CAP = process.argv.includes('en') ? 'en' : 'es';
const OUT = path.join(__dirname, IDIOMA_CAP === 'es' ? 'capturas' : 'capturas-' + IDIOMA_CAP);
const PORT = 8146;
const W = 1366, H = 768;
/* Tamaño con el que abre la ventana de verdad (el de main.js). Las tomas de
   "ventana normal" se capturan así y luego se montan sobre el lienzo de la
   tienda: estirar una ventana estrecha hasta 1366 la deformaría. */
const W_VENTANA = 440, H_VENTANA = 820;
const TMP = path.join(require('os').tmpdir(), 'catculator-marco');

/* El montaje. La ventana va centrada, con esquinas redondeadas y sombra, para
   que se lea como una ventana sobre un escritorio y no como una captura
   estirada. El alto manda: 820 no cabe en 768, así que se escala a 704 y el
   ancho lo sigue solo. */
function marcoHTML(fondo) {
  return `<!doctype html><meta charset="utf-8"><style>
  html, body { margin: 0; height: 100%; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: ${fondo};
  }
  img {
    height: 704px; width: auto; display: block;
    border-radius: 18px;
    box-shadow: 0 24px 60px rgba(15, 30, 50, 0.28),
                0 4px 14px rgba(15, 30, 50, 0.16);
  }
  </style><img src="ventana.png">`;
}

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
   pantalla. Los guiones usan los ids reales de la app.
   El reparto busca enseñar el gato nuevo (dos tomas con traje: mago y pirata),
   los cinco pelajes y una función distinta por captura. */
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
    // Una sola toma cubre el panel entero: descuento/IVA/propina/dividir arriba
    // y el conversor de divisas abajo (a 768 px de alto cabe completo).
    nombre: '2-compras-menta', tema: 'menta', pelaje: 'gris', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['8', '5', '0', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('[data-action="equals"]').click(); await wait(250);
      $('#btn-shop').click(); await wait(500);
      $('#shop-panel').scrollTop = 0;
    }
  },
  {
    /* El menú del portapapeles. En el escritorio se abre con el botón derecho;
       aquí se llama a la función directamente porque un contextmenu sintético
       no siempre llega igual. Desde el borde de abajo del visor: a media altura
       el menú roza los dígitos. */
    nombre: '3-copiar-pegar-cian', tema: 'cian', pelaje: 'nieves', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      pegarTexto(document.documentElement.lang === 'en' ? '1,234.56' : '1.234,56');
      await wait(400);
      const r = $('#result').getBoundingClientRect();
      abrirMenuClip(r.left + r.width * 0.62, r.bottom - 4);
      await wait(350);
    }
  },
  {
    /* Corregir en medio de una cuenta larga: el cursor metido entre los
       dígitos, que es justo lo que antes no se podía hacer. */
    nombre: '4-cursor-menta', tema: 'menta', pelaje: 'leon', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['1', '2', '3', '4', '+', '5', '6', '7', '*', '8']) {
        $(`.key[data-k="${k}"]`).click(); await wait(40);
      }
      ponerCursor(3);
      await wait(300);
    }
  },
  {
    nombre: '5-personaliza-rosa', tema: 'rosa', pelaje: 'negro', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['1', '2', '*', '1', '2']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('[data-action="equals"]').click(); await wait(250);
      $('#btn-theme').click(); await wait(600);
      $('#theme-panel').scrollTop = 0;
    }
  },
  {
    nombre: '6-quiz-lavanda', tema: 'lavanda', pelaje: 'negro', atuendo: 'pirata', modo: 'basic',
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
    nombre: '7-cientifica-noche', tema: 'noche', pelaje: 'carbon', atuendo: 'ninguno', modo: 'sci',
    guion: async ($, wait) => {
      for (const k of ['sqrt(', '2', ')']) { $(`.key[data-k="${k}"], .skey[data-k="${k}"]`).click(); await wait(60); }
      $('[data-action="equals"]').click(); await wait(300);
    }
  },
  {
    nombre: '8-conversor-atigrado', tema: 'atigrado', pelaje: 'blanco', atuendo: 'ninguno', modo: 'basic',
    guion: async ($, wait) => {
      for (const k of ['1', '0', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('#btn-conv').click(); await wait(500);
    }
  },
  {
    /* La app tal y como abre: ventana estrecha, una columna. Aquí los paneles
       caen donde tienen que caer, que es lo que no se ve en las tomas de
       ventana maximizada. */
    nombre: '9-ventana-normal', tema: 'cian', pelaje: 'naranja', atuendo: 'ninguno', modo: 'basic',
    ventana: 'normal', fondo: 'linear-gradient(135deg, #dfe9f3 0%, #c6d6e6 100%)',
    guion: async ($, wait) => {
      for (const k of ['1', '2', '5', '0', '*', '3']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('[data-action="equals"]').click(); await wait(400);
    }
  },
  {
    /* El bloc de notas, que no salía en ninguna toma de la ficha. Y de paso
       otra de ventana normal, que es lo que se pidió. */
    nombre: '10-ventana-notas', tema: 'lavanda', pelaje: 'gris', atuendo: 'ninguno', modo: 'basic',
    ventana: 'normal', fondo: 'linear-gradient(135deg, #e8e3f5 0%, #cdc4e8 100%)',
    guion: async ($, wait) => {
      for (const k of ['2', '4', '0', '0']) { $(`.key[data-k="${k}"]`).click(); await wait(50); }
      $('[data-action="equals"]').click(); await wait(250);
      $('#btn-notes').click(); await wait(500);
      const ta = $('#notes-text');
      if (ta) {
        /* El corrector subraya en rojo "Cat food" y "Litter" en la version
           inglesa. En la app esta bien que corrija; en una captura de tienda
           parecen faltas de ortografia. */
        ta.spellcheck = false;
        ta.value = document.documentElement.lang === 'en'
          ? 'Shopping\n- Cat food  2400\n- Litter     1800'
          : 'Compras\n- Comida gato  2400\n- Arena        1800';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      /* El globo del gato sale al abrir el bloc y el panel lo parte por la
         mitad: media frase asomando por detras se ve a descuido. Aqui no
         aporta nada, asi que fuera. */
      const globo = $('.speech');
      if (globo) globo.classList.add('hidden');
      await wait(300);
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
    // Antes de cargar: las media queries dependen del tamaño, no al revés
    const normal = t.ventana === 'normal';
    win.setContentSize(normal ? W_VENTANA : W, normal ? H_VENTANA : H);
    await new Promise(r => setTimeout(r, 200));
    await win.loadURL(`http://localhost:${PORT}/`);
    await win.webContents.executeJavaScript(`
      localStorage.setItem('catculator-theme', '${t.tema}');
      localStorage.setItem('catculator-fur', '${t.pelaje}');
      localStorage.setItem('catculator-outfit', '${t.atuendo}');
      localStorage.setItem('catculator-mode', '${t.modo}');
      localStorage.setItem('catculator-sound', 'on');
      localStorage.setItem('catculator-idioma', '${IDIOMA_CAP}');
      localStorage.removeItem('catculator-rates');
      localStorage.removeItem('catculator-rates-fechas');
      localStorage.removeItem('catculator-history');
      localStorage.removeItem('catculator-shop');
    `);
    await win.loadURL(`http://localhost:${PORT}/`);
    await new Promise(r => setTimeout(r, 1500));
    await win.webContents.insertCSS('::-webkit-scrollbar { width: 0 !important; height: 0 !important; }');
    // Los paneles entran con pop-in (arranca en opacity 0) y en ventana oculta esa
    // animación a veces no avanza: el panel quedaba invisible en la captura. Se
    // anula la animación y se fuerza el estado final SOLO en los paneles abiertos
    // (el globo de diálogo se esconde con opacity: 0, así que no se toca).
    await win.webContents.insertCSS(
      '.side-panel, .theme-panel, .speech, .clip-menu { animation: none !important; transition: none !important; }' +
      '.side-panel:not(.hidden), .theme-panel:not(.hidden), .clip-menu:not(.hidden) { opacity: 1 !important; }' +
      /* El cursor parpadea con step-end: la mitad del tiempo es invisible y
         la captura salía sin él, que es justo lo que se quiere enseñar. */
      '.caret { animation: none !important; opacity: 1 !important; }');

    const guion = `(async () => {
      const $ = s => document.querySelector(s);
      const wait = ms => new Promise(r => setTimeout(r, ms));
      try { await (${t.guion.toString()})($, wait); return 'ok'; }
      catch (e) { return 'error: ' + e.message; }
    })()`;
    const res = await win.webContents.executeJavaScript(guion);
    if (res !== 'ok') log('  aviso en ' + t.nombre + ': ' + res);
    await new Promise(r => setTimeout(r, 700));
    // Con la ventana oculta, capturePage devuelve el ÚLTIMO cuadro pintado: si el
    // guion solo abrió un panel (sin animaciones de por medio) la toma sale como
    // si nada hubiera pasado. Esto obliga a repintar antes de disparar.
    win.webContents.invalidate();
    await new Promise(r => setTimeout(r, 300));

    let img = await win.webContents.capturePage();

    /* Montaje de las tomas de ventana normal. El HTML del marco vive en la
       carpeta temporal del sistema y no en el proyecto: dentro del proyecto el
       Acceso Controlado a Carpetas de Defender tumba las escrituras. */
    if (normal) {
      fs.mkdirSync(TMP, { recursive: true });
      fs.writeFileSync(path.join(TMP, 'ventana.png'), img.toPNG());
      fs.writeFileSync(path.join(TMP, 'marco.html'), marcoHTML(t.fondo));
      win.setContentSize(W, H);
      await new Promise(r => setTimeout(r, 200));
      await win.loadFile(path.join(TMP, 'marco.html'));
      await new Promise(r => setTimeout(r, 700));
      win.webContents.invalidate();
      await new Promise(r => setTimeout(r, 300));
      img = await win.webContents.capturePage();
    }

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
