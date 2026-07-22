/* Genera icon.png e icon.ico (gato negro sobre fondo cian) sin dependencias. */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// ---------- Utilidades PNG ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filtro none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // profundidad
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- Geometría ----------
function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function inTriangle(x, y, [x1, y1], [x2, y2], [x3, y3]) {
  const d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2);
  const d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3);
  const d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function inRoundedRect(x, y, size, r) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  const cx = Math.max(r, Math.min(size - r, x));
  const cy = Math.max(r, Math.min(size - r, y));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function nearSegment(x, y, x1, y1, x2, y2, w) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  return (x - px) ** 2 + (y - py) ** 2 <= w * w;
}

// ---------- Escena (coordenadas en espacio 0..256) ----------
const C = {
  bg:    [0x67, 0xe8, 0xf9, 255],
  cat:   [0x2f, 0x2e, 0x36, 255],
  earIn: [0xf9, 0xa8, 0xd4, 255],
  eye:   [0xa5, 0xf3, 0xfc, 255],
  pupil: [0x16, 0x15, 0x1a, 255],
  glint: [0xff, 0xff, 0xff, 255],
  nose:  [0xf4, 0x72, 0xb6, 255],
  whisk: [0xe8, 0xe8, 0xee, 255]
};

/* Formas de fondo:
     (nada)  cuadrado redondeado — icono clásico
     bleed   cuadrado a sangre (Android recorta él mismo; iOS pinta de negro lo transparente)
     round   círculo — ic_launcher_round de Android
     noBg    sin fondo: el gato solo, para el icono adaptativo (el fondo lo pone Android)
   catScale encoge al gato para que quepa en la zona segura de cada formato. */
function scene(u, v, opts = {}) {
  const { bleed = false, round = false, noBg = false, catScale = 1 } = opts;

  let color = null;
  if (!noBg) {
    if (bleed) color = C.bg;
    else if (round) { if (!inEllipse(u, v, 128, 128, 128, 128)) return [0, 0, 0, 0]; color = C.bg; }
    else { if (!inRoundedRect(u, v, 256, 56)) return [0, 0, 0, 0]; color = C.bg; }
  }

  if (catScale !== 1) {
    u = (u - 128) / catScale + 128;
    v = (v - 128) / catScale + 128;
  }

  // orejas
  if (inTriangle(u, v, [46, 110], [64, 26], [118, 72])) color = C.cat;
  if (inTriangle(u, v, [210, 110], [192, 26], [138, 72])) color = C.cat;
  if (inTriangle(u, v, [62, 96], [70, 48], [100, 74])) color = C.earIn;
  if (inTriangle(u, v, [194, 96], [186, 48], [156, 74])) color = C.earIn;

  // cabeza
  if (inEllipse(u, v, 128, 152, 84, 78)) color = C.cat;

  // ojos
  if (inEllipse(u, v, 96, 142, 17, 21)) color = C.eye;
  if (inEllipse(u, v, 160, 142, 17, 21)) color = C.eye;
  if (inEllipse(u, v, 96, 143, 6.5, 14)) color = C.pupil;
  if (inEllipse(u, v, 160, 143, 6.5, 14)) color = C.pupil;
  if (inEllipse(u, v, 101, 134, 3.5, 3.5)) color = C.glint;
  if (inEllipse(u, v, 165, 134, 3.5, 3.5)) color = C.glint;

  // nariz
  if (inTriangle(u, v, [119, 172], [137, 172], [128, 184])) color = C.nose;

  // bigotes
  const whiskers = [
    [76, 172, 30, 164], [76, 180, 28, 180], [76, 188, 32, 198],
    [180, 172, 226, 164], [180, 180, 228, 180], [180, 188, 224, 198]
  ];
  for (const [x1, y1, x2, y2] of whiskers) {
    if (nearSegment(u, v, x1, y1, x2, y2, 2.4)) color = C.whisk;
  }

  return color || [0, 0, 0, 0]; // con noBg, fuera del gato no hay nada
}

// ---------- Render con supermuestreo 3x3 ----------
function render(size, opts = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = 256 / size;
  const SS = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) * scale;
          const v = (y + (sy + 0.5) / SS) * scale;
          const c = scene(u, v, opts);
          r += c[0] * (c[3] / 255);
          g += c[1] * (c[3] / 255);
          b += c[2] * (c[3] / 255);
          a += c[3];
        }
      }
      const n = SS * SS;
      const alpha = a / n;
      const i = (y * size + x) * 4;
      if (alpha > 0) {
        rgba[i]     = Math.round((r / n) * 255 / alpha);
        rgba[i + 1] = Math.round((g / n) * 255 / alpha);
        rgba[i + 2] = Math.round((b / n) * 255 / alpha);
      }
      rgba[i + 3] = Math.round(alpha);
    }
  }
  return rgba;
}

/* Splash: lienzo rectangular de fondo cian con el gato centrado. La escena mide
   256x256, asi que se mapea a un cuadrado centrado que ocupa una fraccion del
   lado corto (45% por defecto; el poster de Microsoft Store usa mas). */
function renderSplash(w, h, escala = 0.45) {
  const rgba = Buffer.alloc(w * h * 4);
  const lado = Math.min(w, h) * escala;
  const x0 = (w - lado) / 2, y0 = (h - lado) / 2;
  const SS = 3;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          const c = scene((px - x0) / lado * 256, (py - y0) / lado * 256, { noBg: true });
          const a = c[3] / 255;
          // el gato va compuesto sobre el cian, no sobre transparencia
          r += c[0] * a + C.bg[0] * (1 - a);
          g += c[1] * a + C.bg[1] * (1 - a);
          b += c[2] * a + C.bg[2] * (1 - a);
        }
      }
      const n = SS * SS, i = (y * w + x) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

/* Grafico destacado de Play Store: 1024x500, degradado cian con el gato y huellitas.
   Coordenadas en pixeles reales, no en el espacio 256 de la escena. */
function huella(x, y, cx, cy, r, giro) {
  const dx = x - cx, dy = y - cy;
  const c = Math.cos(giro), s = Math.sin(giro);
  const u = dx * c + dy * s, v = -dx * s + dy * c;   // rotar al marco de la huella
  if (u * u / (r * r) + v * v / (r * 1.15) ** 2 <= 1) return true;   // almohadilla
  for (const [tu, tv, tr] of [[-1.15, -1.5, 0.42], [-0.42, -1.9, 0.44],
                              [0.42, -1.9, 0.44], [1.15, -1.5, 0.42]]) {
    const du = u - tu * r, dv = v - tv * r;
    if (du * du + dv * dv <= (tr * r) ** 2) return true;             // deditos
  }
  return false;
}

function renderBanner(w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  const lado = h * 0.78;
  const x0 = (w - lado) / 2, y0 = (h - lado) / 2;
  const HUELLAS = [
    [0.10, 0.22, 26, -0.4], [0.17, 0.52, 20, -0.2], [0.08, 0.78, 23, -0.6],
    [0.90, 0.25, 24, 0.4], [0.83, 0.58, 19, 0.25], [0.93, 0.80, 22, 0.5]
  ];
  const SS = 3;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;

          // degradado diagonal, del cian oscuro al claro
          const t = Math.min(1, Math.max(0, (px / w) * 0.6 + (py / h) * 0.4));
          let cr = 0xae + (0xd8 - 0xae) * t;
          let cg = 0xf0 + (0xf9 - 0xf0) * t;
          let cb = 0xfa + (0xff - 0xfa) * t;

          for (const [hx, hy, hr, giro] of HUELLAS) {
            if (huella(px, py, hx * w, hy * h, hr, giro)) { cr *= 0.88; cg *= 0.93; cb *= 0.97; }
          }

          const c = scene((px - x0) / lado * 256, (py - y0) / lado * 256, { noBg: true });
          const a = c[3] / 255;
          r += c[0] * a + cr * (1 - a);
          g += c[1] * a + cg * (1 - a);
          b += c[2] * a + cb * (1 - a);
        }
      }
      const n = SS * SS, i = (y * w + x) * 4;
      rgba[i] = Math.round(r / n); rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n); rgba[i + 3] = 255;
    }
  }
  return rgba;
}

// ---------- ICO (entradas PNG) ----------
function buildICO(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // tipo icono
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);  // planos
    e.writeUInt16LE(32, 6); // bits
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]);
}

function write(name, size, opts) {
  const dest = path.join(__dirname, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, encodePNG(render(size, opts), size, size));
  return name;
}

// Ejecutado directo genera todo; requerido como módulo solo presta sus funciones
// (las usa microsoft-store/build-iconos.js para los logos de la tienda).
module.exports = { render, renderSplash, renderBanner, encodePNG };
if (require.main === module) {

// Escritorio (Electron)
const sizes = [256, 64, 48, 32, 16];
const pngs = sizes.map(size => ({ size, data: encodePNG(render(size), size, size) }));
fs.writeFileSync(path.join(__dirname, 'icon.png'), pngs[0].data);
fs.writeFileSync(path.join(__dirname, 'icon.ico'), buildICO(pngs));

// PWA
write('icons/icon-192.png', 192);
write('icons/icon-512.png', 512);
write('icons/icon-maskable-512.png', 512, { bleed: true, catScale: 0.72 });
write('icons/apple-touch-icon.png', 180, { bleed: true, catScale: 0.86 });

// Android (Capacitor), solo si el proyecto nativo ya existe
const ANDROID_RES = 'android/app/src/main/res';
if (fs.existsSync(path.join(__dirname, ANDROID_RES))) {
  const densidades = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [dpi, d] of Object.entries(densidades)) {
    const dir = `${ANDROID_RES}/mipmap-${dpi}`;
    write(`${dir}/ic_launcher.png`, Math.round(48 * d));
    write(`${dir}/ic_launcher_round.png`, Math.round(48 * d), { round: true, catScale: 0.82 });
    /* Icono adaptativo: el lienzo mide 108dp pero la zona segura es solo el círculo
       central de 72dp — fuera de ahí cada launcher recorta con su propia forma, así que
       el gato entero (orejas incluidas) tiene que caber dentro de ese círculo. */
    write(`${dir}/ic_launcher_foreground.png`, Math.round(108 * d), { noBg: true, catScale: 0.64 });
  }
  console.log('  + mipmaps de Android (5 densidades x 3 variantes)');

  /* Splash para Android 11 y anteriores (en 12+ manda windowSplashScreen* de styles.xml).
     Los tamaños son los que trae el proyecto de Capacitor. */
  const splashes = [
    ['drawable', 480, 320],
    ['drawable-port-mdpi', 320, 480], ['drawable-land-mdpi', 480, 320],
    ['drawable-port-hdpi', 480, 800], ['drawable-land-hdpi', 800, 480],
    ['drawable-port-xhdpi', 720, 1280], ['drawable-land-xhdpi', 1280, 720],
    ['drawable-port-xxhdpi', 960, 1600], ['drawable-land-xxhdpi', 1600, 960],
    ['drawable-port-xxxhdpi', 1280, 1920], ['drawable-land-xxxhdpi', 1920, 1280]
  ];
  for (const [carpeta, w, h] of splashes) {
    const dest = path.join(__dirname, ANDROID_RES, carpeta, 'splash.png');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, encodePNG(renderSplash(w, h), w, h));
  }
  console.log('  + ' + splashes.length + ' splash con el gato sobre cian');
}

// Material para la ficha de Play Store
write('tienda/icono-512.png', 512, { bleed: true, catScale: 0.86 });
const BANNER = path.join(__dirname, 'tienda/grafico-destacado-1024x500.png');
fs.mkdirSync(path.dirname(BANNER), { recursive: true });
fs.writeFileSync(BANNER, encodePNG(renderBanner(1024, 500), 1024, 500));
console.log('  + material de Play Store (icono 512 y grafico destacado)');

console.log('Iconos generados 🐱');

}
