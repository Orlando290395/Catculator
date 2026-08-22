/* Pruebas del motor de expresiones de Catculator.
   Se corre con: npm test

   Por qué Electron y no Node a secas: la lógica vive en renderer.js, que toca
   el DOM desde la primera línea (getElementById, localStorage) y no se puede
   importar en un Node pelado. Así que se carga la app de verdad en una ventana
   oculta y se prueba el código tal cual se ejecuta en producción — sin copias
   del parser que se desincronicen.

   Salida: una línea por fallo y un resumen. Devuelve código 1 si algo falla,
   para que sirva en un hook o en CI. */
const { app, BrowserWindow } = require('electron');
const path = require('path');

/* [expresión, esperado] — 'ERR' significa "esto tiene que fallar".
   Los números se comparan con tolerancia porque el motor redondea a 12 cifras. */
const CASOS = [
  ['— Aritmética y precedencia —'],
  ['2+3', 5],
  ['2+3*4', 14],
  ['(2+3)*4', 20],
  ['2-3-4', -5],
  ['10/4', 2.5],
  ['2^3^2', 512],
  ['7mod3', 1],
  ['0.1+0.2', 0.3],
  ['1/3', 0.333333333333],

  ['— Signo unario —'],
  ['-5', -5],
  ['-5^2', -25],
  ['(-5)^2', 25],
  ['3*-2', -6],
  ['--3', 3],

  ['— Multiplicación implícita —'],
  ['2π', 6.28318530718],
  ['2(3)', 6],
  ['(2)(3)', 6],
  ['2sqrt(9)', 6],

  ['— Funciones (en grados) —'],
  ['sin(30)', 0.5],
  ['cos(60)', 0.5],
  ['ln(e)', 1],
  ['log(100)', 2],
  ['sqrt(16)', 4],
  ['cbrt(27)', 3],
  ['abs(-7)', 7],

  ['— Factorial —'],
  ['0!', 1],
  ['5!', 120],
  ['3!+1', 7],
  ['2^3!', 64],

  ['— Porcentaje estilo calculadora —'],
  ['50%', 0.5],
  ['50+10%', 55],
  ['50-10%', 45],
  ['200*10%', 20],
  ['200/10%', 2000],
  ['(50+10%)', 55],
  ['2+3+10%', 5.5],
  ['2*3+10%', 6.6],
  ['50+(3+4)%', 53.5],
  ['-10%', -0.1],

  ['— Errores que deben cazarse —'],
  ['', 'ERR'],
  ['1/0', 'ERR'],
  ['0/0', 'ERR'],
  ['ln(0)', 'ERR'],
  ['sqrt(-1)', 'ERR'],
  ['asin(2)', 'ERR'],
  ['1.2.3', 'ERR'],
  ['(1+2', 'ERR'],
  ['1+2)', 'ERR'],
  ['2^10000', 'ERR'],
  ['2.5!', 'ERR']
];

/* Lo que no se puede expresar como "evalúa esta cadena": estado, teclado, DOM.
   Cada prueba devuelve [nombre, obtenido, esperado]. */
const GUION_COMPORTAMIENTO = `(() => {
  const r = [];
  const prueba = (nombre, obtenido, esperado) => r.push([nombre, obtenido, esperado]);


  /* Los felinos salvajes se encienden con data-fur, y el riesgo real es que
     una capa se quede prendida donde no toca: un gato carbón con melena de
     león, o un tigre con la naricita rosa del gato encima de la suya. Se
     comprueba el interruptor en los dos sentidos. */
  const seVe = sel => {
    const el = document.querySelector(sel);
    return !!el && getComputedStyle(el).display !== 'none';
  };
  /* Con seis felinos el riesgo cambió de sitio. Antes era que una capa se
     quedara prendida donde no tocaba; ahora, además, CUATRO de ellos comparten
     capas (#manchado-base y #manchado-nariz), así que "no debe verse ninguna
     capa de otro" hay que calcularlo, no listarlo a mano: lo prohibido para
     cada uno es lo de los demás MENOS lo que comparten con él. Escrito a mano,
     esta tabla se desincronizaría al primer felino nuevo. */
  const CAPAS = {
    leon:     ['#especie-leon', '#leon-cara'],
    tigre:    ['#tigre-atras', '#tigre-base', '#tigre-cara'],
    leopardo: ['#manchado-base', '#manchado-nariz', '#leopardo-cara'],
    jaguar:   ['#manchado-base', '#manchado-nariz', '#jaguar-cara'],
    guepardo: ['#manchado-base', '#manchado-nariz', '#guepardo-cara'],
    nieves:   ['#manchado-base', '#manchado-nariz', '#nieves-cara', '#nieves-atras']
  };
  const SALVAJES = Object.keys(CAPAS);
  const TODAS_CAPAS = [];
  for (const e of SALVAJES) for (const c of CAPAS[e])
    if (TODAS_CAPAS.indexOf(c) === -1) TODAS_CAPAS.push(c);

  for (const especie of SALVAJES) {
    applyFur(especie);
    const faltan = CAPAS[especie].filter(c => !seVe(c));
    prueba(especie + ' enciende todas sus capas', faltan.join(','), '');
    const ajenas = TODAS_CAPAS.filter(c => CAPAS[especie].indexOf(c) === -1 && seVe(c));
    prueba('a ' + especie + ' no se le cuela ninguna capa ajena', ajenas.join(','), '');
    prueba(especie + ' trae su propia nariz', seVe('.nariz'), false);
    prueba(especie + ' lleva orejas redondas', seVe('#orejas-redondas'), true);
    prueba(especie + ' no lleva las puntiagudas', seVe('#ear-left'), false);
    // Y cada uno tiene que tener color propio: si dos comparten --fur, alguien
    // se olvidó de escribir su bloque y se está viendo el pelaje de al lado
    prueba(especie + ' tiene su propio color',
           getComputedStyle(document.documentElement).getPropertyValue('--fur').trim().length > 0, true);
  }

  const colores = SALVAJES.map(e => {
    applyFur(e);
    return getComputedStyle(document.documentElement).getPropertyValue('--fur').trim();
  });
  prueba('ningún felino repite el color de otro',
         new Set(colores).size, SALVAJES.length);

  applyFur('carbon');
  prueba('ninguna especie se cuela en un gato normal', TODAS_CAPAS.filter(seVe).join(','), '');
  prueba('el gato recupera su nariz', seVe('.nariz'), true);
  prueba('el gato recupera sus orejas puntiagudas', seVe('#ear-left'), true);

  // Cada felino salvaje necesita su nombre y su frase en los dos idiomas. La
  // prueba de paridad no basta: si la clave falta en ambos, pasa igual.
  for (const especie of SALVAJES) {
    for (const idioma of IDIOMAS) {
      prueba(especie + ' tiene nombre en ' + idioma, !!TEXTOS[idioma]['pelaje.' + especie], true);
      prueba(especie + ' tiene frase en ' + idioma, !!TEXTOS[idioma]['say.pelaje.' + especie], true);
    }
  }

  // ± tiene que ir y volver
  clearAll(true); pushToken('5');
  toggleSign(); prueba('± niega', rawExpr(), '(-5)');
  toggleSign(); prueba('± vuelve', rawExpr(), '5');
  toggleSign(); toggleSign(); prueba('± ida y vuelta otra vez', rawExpr(), '5');

  // ± sobre el último número de una expresión más larga
  clearAll(true); ['2','+','3'].forEach(pushToken);
  toggleSign(); prueba('± en expresión', rawExpr(), '2+(-3)');
  toggleSign(); prueba('± deshace en expresión', rawExpr(), '2+3');

  // Atajos del sistema no son teclas de calculadora
  clearAll(true); ['1','2','3'].forEach(pushToken);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
  prueba('Ctrl+C no borra', rawExpr(), '123');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
  prueba('la c sola sí borra', rawExpr(), '');

  // Números grandes que vuelven a la calculadora
  prueba('1e21 se expande', numberToTokens(1e21).join(''), '1000000000000000000000');
  prueba('1e21 se relee bien', evaluate(numberToTokens(1e21).join('')), 1e21);
  prueba('1e-7 se expande', numberToTokens(1e-7).join(''), '0.0000001');
  prueba('negativo se expande', numberToTokens(-42.5).join(''), '-42.5');

  // Un historial corrupto no puede tumbar el botón '='
  try {
    localStorage.setItem('catculator-history', '{"no":"soy un arreglo"}');
    const g = store.json('catculator-history', null);
    prueba('historial corrupto se descarta', Array.isArray(g) ? 'arreglo' : 'descartado', 'descartado');
  } finally { store.del('catculator-history'); }

  // La CSP ya no anula el estilo del gato
  const svg = document.querySelector('.sin-raton');
  prueba('sin-raton aplica',
    svg ? getComputedStyle(svg).pointerEvents : 'no existe', 'none');
  prueba('cero estilos en línea',
    document.querySelectorAll('[style]').length, 0);

  // El resultado se alcanza con el teclado
  prueba('resultado enfocable',
    document.getElementById('result').getAttribute('tabindex'), '0');

  // El formato respeta los separadores del sistema
  prueba('formato ida y vuelta',
    parseFloat(textoANumeroPlano(formatNumber(1234567.89))), 1234567.89);

  /* Separadores por idioma. El caso que importa es es-CR: su separador de miles
     oficial es un espacio duro (U+00A0) y en la pantalla se leería como varios
     números pegados, así que tiene que salir convertido en punto.
     Ojo al editar: esto vive dentro de una plantilla, por eso \\\\s y no \\s. */
  const sep = l => { const s = derivarSeparadores(l); return s.miles + '|' + s.decimal; };
  prueba('es-CR sin espacios', sep('es-CR'),  '.|,');
  prueba('fr-FR sin espacios', sep('fr-FR'),  '.|,');
  prueba('es-419 latino',      sep('es-419'), ',|.');
  prueba('es-MX latino',       sep('es-MX'),  ',|.');
  prueba('es-ES europeo',      sep('es-ES'),  '.|,');
  prueba('en-US inglés',       sep('en-US'),  ',|.');
  prueba('idioma inventado no rompe', typeof sep('xx-ZZ'), 'string');

  // Ningún idioma puede dar separadores iguales, vacíos o en blanco
  const idiomas = ['es', 'es-CR', 'es-419', 'es-MX', 'es-ES', 'en-US', 'pt-BR',
                   'fr-FR', 'de-DE', 'it-IT', 'ru-RU', 'ja-JP', 'zh-CN', 'pl-PL',
                   'nb-NO', 'cs-CZ', 'hu-HU', 'sv-SE', 'fi-FI', 'uk-UA'];
  const malos = idiomas.filter(l => {
    const s = derivarSeparadores(l);
    return !s.miles || !s.decimal || s.miles === s.decimal || /\\s/.test(s.miles);
  });
  prueba('ningún idioma da separadores inválidos', malos.join(','), '');

  // Y en todos ellos el copiado tiene que poder deshacer el formato
  const rotos = idiomas.filter(l => {
    const s = derivarSeparadores(l);
    const texto = '1' + s.miles + '234' + s.decimal + '56';
    return parseFloat(texto.split(s.miles).join('').split(s.decimal).join('.')) !== 1234.56;
  });
  prueba('el copiado se deshace en todos los idiomas', rotos.join(','), '');

  /* ---------- Diccionario de idiomas ----------
     Lo que más se rompe al traducir no es la traducción: es una clave escrita
     con un dedo torcido en un solo idioma, que deja la interfaz en blanco solo
     para quien use ese idioma. Todo esto se comprueba solo. */
  const soloEs = Object.keys(TEXTOS.es).filter(k => TEXTOS.en[k] === undefined);
  const soloEn = Object.keys(TEXTOS.en).filter(k => TEXTOS.es[k] === undefined);
  prueba('ninguna clave solo en español', soloEs.join(','), '');
  prueba('ninguna clave solo en inglés', soloEn.join(','), '');

  const vacio = v => Array.isArray(v)
    ? (v.length === 0 || v.some(x => !String(x).trim()))
    : !String(v).trim();
  const raros = Object.keys(TEXTOS.es).filter(k =>
    Array.isArray(TEXTOS.es[k]) !== Array.isArray(TEXTOS.en[k]) ||
    vacio(TEXTOS.es[k]) || vacio(TEXTOS.en[k]));
  prueba('ningún texto vacío ni de distinto tipo', raros.join(','), '');

  // Si el español dice {n}, el inglés tiene que decirlo también o se pierde el dato
  const marcas = v => (String(v).match(/\\{[a-z]\\}/g) || []).sort().join('');
  const desparejos = Object.keys(TEXTOS.es)
    .filter(k => marcas(TEXTOS.es[k]) !== marcas(TEXTOS.en[k]));
  prueba('los huecos {n} coinciden entre idiomas', desparejos.join(','), '');

  // Toda marca puesta en el HTML tiene que existir en el diccionario
  const usadas = new Set();
  ['data-i18n', 'data-i18n-title', 'data-i18n-ph', 'data-i18n-aria',
   'data-i18n-aria2', 'data-i18n-desc'].forEach(a =>
    document.querySelectorAll('[' + a + ']').forEach(el => usadas.add(el.getAttribute(a))));
  const huerfanas = [...usadas].filter(k => TEXTOS.es[k] === undefined || TEXTOS.en[k] === undefined);
  prueba('las claves del HTML existen', huerfanas.join(','), '');
  prueba('el HTML sí está marcado', usadas.size > 60, true);

  // Unidades y monedas: si falta un nombre sale el código crudo en pantalla
  const unidades = [];
  for (const c of Object.keys(CONV)) unidades.push(...Object.keys(CONV[c].units));
  const sinNombre = unidades.filter(u => !/^[°K]/.test(u) &&
    (TEXTOS.es['u.' + u] === undefined || TEXTOS.en['u.' + u] === undefined));
  prueba('todas las unidades tienen nombre', sinNombre.join(','), '');
  const sinCat = Object.keys(CONV).filter(c => TEXTOS.es['cat.' + c] === undefined);
  prueba('todas las categorías tienen nombre', sinCat.join(','), '');
  const sinMoneda = CURRENCIES.filter(c => TEXTOS.es['m.' + c.code] === undefined ||
    TEXTOS.en['m.' + c.code] === undefined).map(c => c.code);
  prueba('todas las monedas tienen nombre', sinMoneda.join(','), '');

  /* ---------- Conversiones ----------
     Las claves de las unidades cambiaron de nombre ('pulgadas' pasó a 'in')
     para poder traducirlas. Los factores tienen que haber sobrevivido. */
  const cerca = (a, b) => Math.abs(a - b) < 1e-9;
  const conv = (cat, de, a, v) => v * CONV[cat].units[de] / CONV[cat].units[a];
  prueba('1 pulgada son 2.54 cm', cerca(conv('longitud', 'in', 'cm', 1), 2.54), true);
  prueba('1 milla son 1609.344 m', cerca(conv('longitud', 'mi', 'm', 1), 1609.344), true);
  prueba('1 libra son 453.59237 g', cerca(conv('peso', 'lb', 'g', 1), 453.59237), true);
  prueba('1 galón son 3.785411784 l', cerca(conv('volumen', 'gal', 'l', 1), 3.785411784), true);
  prueba('100 km/h son 62.137 mph', Math.round(conv('velocidad', 'kmh', 'mph', 100) * 1000) / 1000, 62.137);
  prueba('0 °C son 32 °F', convertTemp(0, '°C', '°F'), 32);
  prueba('100 °C son 212 °F', convertTemp(100, '°C', '°F'), 212);
  prueba('-40 se cruzan', convertTemp(-40, '°C', '°F'), -40);
  prueba('0 °C son 273.15 K', cerca(convertTemp(0, '°C', 'K'), 273.15), true);
  prueba('32 °F son 0 °C', cerca(convertTemp(32, '°F', '°C'), 0), true);

  /* ---------- Antigüedad de las tasas de cambio ----------
     En español, para poder comparar los textos exactos. */
  const idiomaAntes = IDIOMA;
  aplicarIdioma('es');
  fechasTasas.CRC = Date.now();
  prueba('tasa de hoy', antiguedadTasa('CRC').texto, 'actualizada hoy');
  prueba('la de hoy no avisa', antiguedadTasa('CRC').vieja, false);
  fechasTasas.CRC = Date.now() - 5 * 86400000;
  prueba('tasa de cinco días', antiguedadTasa('CRC').texto, 'actualizada hace 5 días');
  fechasTasas.CRC = Date.now() - 59 * 86400000;
  prueba('a los 59 días todavía no avisa', antiguedadTasa('CRC').vieja, false);
  fechasTasas.CRC = Date.now() - 90 * 86400000;
  prueba('tasa de tres meses', antiguedadTasa('CRC').texto, 'actualizada hace 3 meses');
  prueba('la de tres meses sí avisa', antiguedadTasa('CRC').vieja, true);
  delete fechasTasas.CRC;
  prueba('sin tocar, dice desde cuándo', /2026/.test(antiguedadTasa('CRC').texto), true);

  /* ---------- Cambiar de idioma en caliente ---------- */
  aplicarIdioma('en');
  prueba('el panel cambia a inglés',
    document.querySelector('[data-i18n="hist.titulo"]').textContent, 'History 🕘');
  prueba('las unidades cambian a inglés', etiquetaUnidad('in'), 'inches');
  prueba('el pie de página cambia',
    /purring/.test(document.querySelector('.footer').textContent), true);
  prueba('el idioma del documento cambia', document.documentElement.lang, 'en');
  /* Con la interfaz en inglés, los números también tienen que ser ingleses:
     "39,370079 inches" se lee como treinta y nueve mil, no como treinta y nueve
     coma tres. Este fue un bug de verdad, lo cazó una captura de la tienda. */
  prueba('en inglés el decimal es punto', SEP.decimal, '.');
  prueba('en inglés los miles son coma', SEP.miles, ',');
  prueba('y el número sale bien', formatNumber(39.370079), '39.370079');
  prueba('la tecla decimal acompaña',
    document.querySelector('.key[data-k="."]').textContent, '.');

  aplicarIdioma('es');
  prueba('y vuelve a español',
    document.querySelector('[data-i18n="hist.titulo"]').textContent, 'Historial 🕘');
  prueba('las unidades vuelven', etiquetaUnidad('in'), 'pulgadas');
  prueba('el decimal vuelve a coma', SEP.decimal, ',');

  /* ---------- El botón de idioma ----------
     Se mudó del panel de personalizar a la barra de arriba: quien abre la app
     en el idioma que no es no tiene por qué adivinar que se cambia detrás de
     una paleta de colores. Al ser ahora un botón que alterna en vez de una
     lista, lo que hay que vigilar es que dé la vuelta entera y que la etiqueta
     diga siempre el idioma que se está usando. */
  const btnIdioma = document.getElementById('btn-lang');
  prueba('el botón de idioma está en la barra',
         !!btnIdioma && btnIdioma.closest('.topbar-actions') !== null, true);
  prueba('y ya no está escondido en el panel',
         document.querySelectorAll('#theme-panel .lang-swatch').length, 0);

  aplicarIdioma('es');
  prueba('el botón dice el idioma de ahora', btnIdioma.textContent, 'ES');
  btnIdioma.click();
  prueba('al pulsarlo cambia el idioma', IDIOMA, 'en');
  prueba('y la etiqueta acompaña', btnIdioma.textContent, 'EN');
  // Con dos idiomas tiene que volver; con tres tendría que seguir dando la vuelta
  for (let i = 0; i < IDIOMAS.length; i++) btnIdioma.click();
  prueba('el botón da la vuelta entera', IDIOMA, 'en');

  aplicarIdioma(idiomaAntes);
  store.del('catculator-idioma');   // que la prueba no deje el idioma fijado

  /* ---------- Cursor dentro de la expresión ----------
     Antes solo se borraba desde el final: si la errata estaba al principio de
     una cuenta larga, o borrabas todo o te aguantabas. Ahora hay un índice de
     inserción, y lo que hay que vigilar es que TODO lo que toca la expresión lo
     respete: teclear, borrar, el ±, y los bordes. */
  const histAntes = store.get('catculator-history');

  clearAll(true);
  pushToken('1'); pushToken('2'); pushToken('3');
  prueba('escribir deja el cursor al final', cursor, 3);

  ponerCursor(1);
  pushToken('9');
  prueba('se teclea donde está el cursor', rawExpr(), '1923');
  prueba('y el cursor avanza con lo tecleado', cursor, 2);

  backspace();
  prueba('borrar quita lo de detrás del cursor, no lo último', rawExpr(), '123');
  prueba('y el cursor retrocede', cursor, 1);

  ponerCursor(0);
  backspace();
  prueba('pegado al borde izquierdo, borrar no hace nada', rawExpr(), '123');
  prueba('ni se mueve más a la izquierda', moverCursor(-1), false);
  ponerCursor(999);
  prueba('el cursor no se sale por la derecha', cursor, tokens.length);
  prueba('ni se mueve más a la derecha', moverCursor(1), false);

  /* El cursor es un <span> vacío a propósito: fitResult() elige el tamaño de
     letra midiendo la longitud del texto, y un cursor hecho con un carácter
     encogía los números al escribir. */
  clearAll(true);
  pushToken('7'); pushToken('+'); pushToken('8');
  ponerCursor(1);
  prueba('cada pulsación es su propio trozo', document.querySelectorAll('#result .tok').length, 3);
  prueba('hay un cursor y solo uno', document.querySelectorAll('#result .caret').length, 1);
  prueba('y está en su sitio',
         document.querySelector('#result .caret').nextElementSibling.dataset.i, '1');
  prueba('el cursor no aporta texto', document.querySelector('#result .caret').textContent, '');
  prueba('la pantalla se sigue leyendo entera', elResult.textContent, '7+8');

  // El ± trabaja sobre el número que toca el cursor, no sobre el final
  clearAll(true);
  for (const k of ['1', '2', '+', '3', '4']) pushToken(k);
  ponerCursor(2);
  toggleSign();
  prueba('el ± niega el número del cursor', rawExpr(), '(-12)+34');
  toggleSign();
  prueba('y al repetirlo lo desenvuelve', rawExpr(), '12+34');

  /* ---------- Pegar ----------
     Lo pegado viene de donde sea: del banco, de un mensaje, de una web. Se mide
     que entienda las dos convenciones de separadores y, sobre todo, que diga
     que no antes que inventarse un número. */
  const idiomaPegar = IDIOMA;
  aplicarIdioma('es');                       // miles con punto, decimales con coma
  prueba('pega un entero pelado', numeroPegado('1234'), 1234);
  prueba('pega con moneda y espacios', numeroPegado(' $ 1.234,56 '), 1234.56);
  prueba('entiende los miles a la inglesa', numeroPegado('1,234.56'), 1234.56);
  prueba('un punto y tres cifras es de miles en español', numeroPegado('1.234'), 1234);
  prueba('una coma y tres cifras es decimal en español', numeroPegado('1,234'), 1.234);
  prueba('pega millones', numeroPegado('1.234.567'), 1234567);
  prueba('pega negativos', numeroPegado('-42,5'), -42.5);
  prueba('rechaza texto', numeroPegado('hola'), null);
  prueba('rechaza lo vacío', numeroPegado('   '), null);
  prueba('rechaza una fecha', numeroPegado('1.2.3'), null);
  prueba('rechaza una cuenta entera', numeroPegado('12+34'), null);
  prueba('rechaza un rango', numeroPegado('5-7'), null);

  clearAll(true);
  pushToken('5'); pushToken('+');
  pegarTexto('1.234,50');
  prueba('lo pegado entra donde está el cursor', rawExpr(), '5+1234.5');
  aplicarIdioma(idiomaPegar);

  /* ---------- Repetir con = ----------
     5+3= da 8 y volver a pulsar = da 11. Lo delicado es de dónde sale lo que se
     repite: el último operador de nivel superior, sin colarse en un paréntesis. */
  prueba('la cola de 5+3', colaRepetible(['5', '+', '3']).join(''), '+3');
  prueba('en 2*3+4 se repite lo último', colaRepetible(['2', '*', '3', '+', '4']).join(''), '+4');
  prueba('no se mete dentro del paréntesis',
         colaRepetible(['(', '1', '+', '2', ')', '*', '3']).join(''), '*3');
  prueba('tampoco dentro de una función',
         colaRepetible(['sqrt(', '4', '+', '5', ')']), null);
  prueba('un número suelto no tiene nada que repetir', colaRepetible(['7']), null);
  prueba('el menos de -5 es signo, no resta', colaRepetible(['-', '5']), null);
  prueba('una cuenta a medias tampoco', colaRepetible(['5', '+']), null);

  clearAll(true);
  for (const k of ['5', '+', '3']) pushToken(k);
  equals();
  prueba('5+3 da 8', ans, 8);
  equals();
  prueba('otro = repite el +3', ans, 11);
  equals();
  prueba('y otra vez', ans, 14);

  /* ---------- La cuenta a medias sobrevive al cierre ---------- */
  clearAll(true);
  for (const k of ['4', '2', '+', '8']) pushToken(k);
  ponerCursor(2);
  const sesion = JSON.parse(store.get('catculator-sesion'));
  prueba('se guarda la cuenta a medias', sesion.tokens.join(''), '42+8');
  prueba('y dónde estaba el cursor', sesion.cursor, 2);

  clearAll(true);
  store.set('catculator-sesion', JSON.stringify(sesion));
  restaurarSesion();
  prueba('al volver, la cuenta sigue ahí', rawExpr(), '42+8');
  prueba('y el cursor donde lo dejaste', cursor, 2);

  /* Lo guardado no es de fiar: localStorage lo puede tocar cualquiera y una
     versión vieja pudo dejar otro formato. Nunca debe dejar la app inservible. */
  clearAll(true);
  store.set('catculator-sesion', JSON.stringify({ tokens: ['3', 'jamón', '*'] }));
  restaurarSesion();
  prueba('un guardado con basura se ignora', rawExpr(), '');
  store.set('catculator-sesion', JSON.stringify({ tokens: 'no soy un arreglo' }));
  restaurarSesion();
  prueba('y uno con otro formato, también', rawExpr(), '');
  store.set('catculator-sesion', 'esto no es ni JSON');
  restaurarSesion();
  prueba('y uno que ni es JSON', rawExpr(), '');

  /* Ya no hay vibración ni interruptor: en Android no puede funcionar sin el
     permiso VIBRATE, y "sin permisos" es un gancho de la ficha y una promesa de
     privacidad.html. Esta prueba vigila que no vuelva a colarse a medias, con
     un botón que se enciende y no hace nada. */
  prueba('no queda interruptor de vibración', !!document.getElementById('btn-vibrar'), false);
  prueba('ni ajuste guardado', store.get('catculator-vibrar'), null);

  /* ---------- Ctrl+V en el escritorio ----------
     El atajo lo sirve el menú de Electron (main.js), pero quien recoge el
     evento es esta página, y esa mitad sí se puede probar aquí: se fabrica un
     evento paste igual que el que dispara webContents.paste(). */
  clearAll(true);
  const portapapeles = new DataTransfer();
  portapapeles.setData('text', '2500');
  document.dispatchEvent(new ClipboardEvent('paste', {
    clipboardData: portapapeles, bubbles: true, cancelable: true
  }));
  prueba('un evento paste mete el número en la cuenta', rawExpr(), '2500');

  /* El eco del pegado doble. En Windows un Ctrl+V puede llegar por dos caminos
     a la vez —el acelerador del menú de Electron y el manejo propio de
     Chromium— y el mismo número entraba dos veces: pegar un "0" dejaba "00" en
     pantalla. El segundo evento se ignora si trae el mismo texto y llega
     pegado al primero. */
  const pegarEvento = (texto) => {
    const d = new DataTransfer();
    d.setData('text', texto);
    document.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: d, bubbles: true, cancelable: true
    }));
  };

  clearAll(true);
  pegarEvento('0');
  pegarEvento('0');
  prueba('el eco del mismo texto no pega dos veces', rawExpr(), '0');

  // Pero dos números DISTINTOS seguidos sí entran los dos: no es un candado
  clearAll(true);
  pegarEvento('12');
  pegarEvento('34');
  prueba('dos textos distintos sí entran los dos', rawExpr(), '1234');

  /* ---------- El menú de copiar y pegar ----------
     Copiar se había quedado sin gesto: tocar la pantalla a media cuenta coloca
     el cursor, en el móvil no hay Ctrl+C y el user-select:none del CSS impide
     marcar el número con el ratón. El menú es la salida. */
  const menu = document.getElementById('clip-menu');
  const visor = document.getElementById('result');
  const menuAbierto = () => !menu.classList.contains('hidden');
  const derecho = () => {
    const r = visor.getBoundingClientRect();
    const ev = new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    });
    visor.dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  clearAll(true);
  prueba('el menú arranca escondido', menuAbierto(), false);
  prueba('el botón derecho lo abre', (derecho(), menuAbierto()), true);
  prueba('y se traga el menú del sistema', derecho(), true);
  prueba('tiene las dos opciones',
         menu.querySelectorAll('.clip-item').length, 2);

  /* Que quepa. En una pantalla estrecha, un menú colocado bajo el dedo se
     salía por el borde y la mitad quedaba fuera, donde no hay nada que tocar. */
  const cajaMenu = menu.getBoundingClientRect();
  const cajaVisor = document.querySelector('.display').getBoundingClientRect();
  prueba('no se sale por la izquierda', cajaMenu.left >= cajaVisor.left - 1, true);
  prueba('ni por la derecha', cajaMenu.right <= cajaVisor.right + 1, true);

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  prueba('Escape lo cierra', menuAbierto(), false);

  derecho();
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  prueba('tocar fuera también lo cierra', menuAbierto(), false);

  /* Qué se copia. Escribiendo "12+34" lo útil es el 46 de la vista previa, no
     la cadena "12+34": esa ni siquiera la acepta esta calculadora al pegarla. */
  clearAll(true);
  prueba('con la pantalla vacía se copia el cero', textoParaCopiar(), '0');

  clearAll(true);
  ['1', '2', '+', '3', '4'].forEach(k => pushToken(k));
  prueba('a media cuenta se copia la vista previa', textoParaCopiar(), '46');

  equals();
  prueba('y después del = se copia el resultado', textoParaCopiar(), '46');

  // Con la cuenta a medias no hay vista previa: se copia lo que se ve
  clearAll(true);
  ['1', '2', '+'].forEach(k => pushToken(k));
  prueba('sin vista previa se copia lo que hay', textoParaCopiar(), '12+');

  /* Que el menú SE LEA en los seis temas. Esto no salió de una medida sino de
     mirar una captura: en Noche el texto quedaba casi negro sobre el panel
     oscuro, porque .clip-item se ponía su propio color y le ganaba a la regla
     del tema. Ahora lo hereda del menú, y esto lo vigila. */
  const canal = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luz = (css) => {
    const [r, g, b] = css.match(/[0-9]+/g).map(Number);
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  };
  const contraste = (a, b) => {
    const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  const temaOriginal = document.documentElement.getAttribute('data-theme');
  derecho();
  for (const tema of ['cian', 'rosa', 'menta', 'lavanda', 'atigrado', 'noche']) {
    applyTheme(tema);
    const item = menu.querySelector('.clip-item');
    const c = contraste(getComputedStyle(item).color,
                        getComputedStyle(menu).backgroundColor);
    // 4.5 es el mínimo de la norma para texto normal; aquí es negrita de 14 px
    prueba('el menú se lee en el tema ' + tema, c >= 4.5, true);
  }
  applyTheme(temaOriginal || 'cian');
  cerrarMenuClip();

  clearAll(true);

  /* Y que escribiendo en las notas el pegado sea SUYO: sin esto, pegar dentro
     del bloc metía el número en la calculadora en vez de en el texto. */
  clearAll(true);
  const notas = document.getElementById('notes-text');
  if (notas) {
    const p2 = new DataTransfer();
    p2.setData('text', '77');
    notas.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: p2, bubbles: true, cancelable: true
    }));
    prueba('pegar dentro de las notas no toca la calculadora', rawExpr(), '');
  }

  /* ---------- Pegar en el móvil ----------
     El WebView de Android NO implementa navigator.clipboard.readText: lo
     rechaza sin preguntar siquiera. La única vía dentro de la app instalada es
     el plugin nativo de Capacitor, así que hay que probarlo PRIMERO.

     Esta prueba existe porque la primera versión no lo hacía y el fallo era de
     los malos: en el escritorio funcionaba perfectamente y en el móvil no, que
     es justo donde más falta hace y donde menos se prueba. Si alguien reordena
     esos dos bloques, aquí salta.

     El portapapeles falso devuelve algo que no es un número a propósito: así
     pegarTexto lo rechaza y no deja la calculadora tocada para las pruebas
     siguientes. */
  const capAntes = window.Capacitor;
  let pedidoAlNativo = 0;
  window.Capacitor = { Plugins: { Clipboard: {
    read: () => { pedidoAlNativo++; return Promise.resolve({ value: 'ni un número' }); }
  } } };
  pedirPegar();
  prueba('con Capacitor delante, se pide al portapapeles nativo', pedidoAlNativo, 1);
  if (capAntes === undefined) delete window.Capacitor; else window.Capacitor = capAntes;

  /* Y que lo que devuelve el plugin —un objeto {value}, no una cadena— se
     desenvuelva bien: pasarle el objeto entero a pegarTexto no debe colar
     ningún número inventado. */
  prueba('un objeto no es un número', numeroPegado({ value: '5' }), null);
  prueba('ni lo es un nulo', numeroPegado(null), null);

  // Que las pruebas no le dejen a nadie la calculadora sucia
  clearAll(true);
  store.del('catculator-sesion');
  if (histAntes === null) store.del('catculator-history');
  else store.set('catculator-history', histAntes);

  return r;
})()`;

/* Pruebas de audio. Van aparte porque hay que renderizar y eso es asíncrono.

   No basta con comprobar que playRoar no revienta: ya pasó tres veces que el
   rugido corría sin un solo error y sonaba mal. Cada prueba de aquí abajo
   nació de un fallo real y los umbrales están puestos sobre medidas de las
   dos versiones —cuatro tiradas de cada una—, no a ojo. Entre paréntesis, lo
   medido: primero el rugido nuevo (león / tigre) y luego el viejo.

   - LA ALTURA NO SE CAE UNA OCTAVA. El fallo más gordo del rugido anterior:
     el código decía 125 Hz y el subarmónico iba tan fuerte que lo que se oía
     era una segunda nota a 50. Nuevo 159 / 115 Hz, viejo 46-51.
     Ojo con el detector: cualquier felino grande rompe el ciclo en dos, así
     que la autocorrelación encuentra el periodo doble y acierta. Por eso
     lleva corrección de octava —entre dos periodos casi igual de buenos gana
     el corto—, que es justo lo que separa una aspereza de una octava abajo.
   - DESGARRO. La textura de un felino vive entre 800 Hz y 2,5 kHz, y es la
     banda que un altavoz de teléfono sí da. Nuevo 18-21%, viejo 9-13%.
   - SILENCIO ANTES DEL ATAQUE. El temblor se sumaba a la envolvente en vez
     de multiplicarla, así que zumbaba con el golpe cerrado. Nuevo 0.
   - LOS GOLPES SE OYEN SEPARADOS. Con reverberación el hueco ya no es
     silencio digital, pero tiene que seguir siendo un hueco. Nuevo 0,02-0,04
     del cuerpo.
   - EL TIGRE NO ES EL LEÓN CON OTRO NOMBRE. Hasta esta versión sonaban
     exactamente igual.
   - QUE NO HAYA DOS IGUALES. La aspereza sale de ruido aleatorio; si alguien
     la cambia por un oscilador vuelve el trémolo de órgano.

   Los huecos y las ventanas de medida salen del guion que devuelve playRoar,
   no de tiempos copiados a mano: así no se quedan viejos al primer retoque.

   Lo que NO está aquí, y merece explicación:

   - El centroide espectral fue el diagnóstico que destapó lo de la corneta.
     Como prueba no sirve: da un 4% de margen entre versiones, y eso no es una
     prueba, es un falso fallo esperando.
   - "Se oye en un altavoz pequeño" (energía sobre 200 Hz) se queda porque
     protege de volver a un rugido todo subgrave, pero ya no distingue una
     versión de la otra: medido sobre varias ventanas, el viejo también lo
     pasaba. El que de verdad separa es el del desgarro. */
const GUION_AUDIO = `(async () => {
  const r = [];
  const prueba = (nombre, obtenido, esperado) => r.push([nombre, obtenido, esperado]);

  /* Quién ruge y quién no. Esto no es una decisión de diseño que se pueda
     cambiar a gusto: solo león, tigre, leopardo y jaguar tienen el hioides que
     hace falta para rugir. El guepardo pía y el leopardo de las nieves
     resopla, y si alguien los mete en RUGEN el gato dirá una mentira. */
  prueba('el león ruge', (applyFur('leon'), vozDeLaEspecie()), 'rugido');
  prueba('el tigre también ruge', (applyFur('tigre'), vozDeLaEspecie()), 'rugido');
  prueba('el leopardo también', (applyFur('leopardo'), vozDeLaEspecie()), 'rugido');
  prueba('el jaguar también', (applyFur('jaguar'), vozDeLaEspecie()), 'rugido');
  prueba('el guepardo NO ruge: pía', (applyFur('guepardo'), vozDeLaEspecie()), 'chirrido');
  prueba('el de las nieves NO ruge: resopla', (applyFur('nieves'), vozDeLaEspecie()), 'prusten');
  prueba('el gato maúlla', (applyFur('carbon'), vozDeLaEspecie()), 'maullido');
  prueba('los demás pelajes maúllan', (applyFur('blanco'), vozDeLaEspecie()), 'maullido');
  prueba('rugen exactamente cuatro', RUGEN.length, 4);

  // Se rinde el rugido cambiando el contexto vivo por uno offline
  const guardado = audioCtx, sonabaAntes = soundOn;
  const sr = 22050;
  soundOn = true;   // que la prueba no dependa de si el usuario lo dejó apagado
  try {
    /* Se rinde el SINTETIZADO a propósito, no playRoar. El rugido que se oye
       ahora sale de una grabación, pero el sintetizado sigue en el código como
       plan B para cuando el archivo falte o no haya cargado todavía, y un plan
       B que nadie prueba no es un plan B. Las pruebas acústicas de abajo son
       las que impiden que se pudra sin que nadie se entere. */
    const render = async (especie, segundos) => {
      audioCtx = new OfflineAudioContext(1, Math.floor(sr * segundos), sr);
      const guion = rugidoSintetizado(especie);
      return { d: (await audioCtx.startRendering()).getChannelData(0), guion: guion };
    };

    const rms = (d, desde, hasta) => {
      let s = 0, n = 0;
      const a = Math.max(0, Math.floor(desde * sr)), b = Math.min(d.length, Math.floor(hasta * sr));
      for (let i = a; i < b; i++) { s += d[i] * d[i]; n++; }
      return n ? Math.sqrt(s / n) : 0;
    };

    /* Reparto por bandas con una DFT ingenua sobre ventanas de Hann. Las
       tablas de senos y cosenos se calculan una vez: sin ellas son diecisiete
       millones de llamadas a Math.cos y la prueba tarda segundos. */
    const N = 2048;
    const hann = new Float64Array(N), cosT = new Float64Array(N), senT = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      hann[n] = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / (N - 1));
      cosT[n] = Math.cos(-2 * Math.PI * n / N);
      senT[n] = Math.sin(-2 * Math.PI * n / N);
    }
    const espectro = (d, desdes) => {
      const pot = new Float64Array(N / 2);
      for (let v = 0; v < desdes.length; v++) {
        for (let k = 1; k < N / 2; k++) {
          let a = 0, b = 0;
          for (let n = 0; n < N; n++) {
            const x = (d[desdes[v] + n] || 0) * hann[n], j = (k * n) % N;
            a += x * cosT[j]; b += x * senT[j];
          }
          pot[k] += a * a + b * b;
        }
      }
      let total = 0;
      for (let k = 1; k < N / 2; k++) total += pot[k];
      return (lo, hi) => {
        let s = 0;
        for (let k = 1; k < N / 2; k++) { const f = k * sr / N; if (f >= lo && f < hi) s += pot[k]; }
        return 100 * s / (total || 1);
      };
    };

    /* Altura con corrección de octava (ver arriba: sin ella, la duplicación
       de periodo de cualquier felino la haría fallar siempre). */
    const altura = (d, desde) => {
      const lagMin = Math.floor(sr / 320), lagMax = Math.floor(sr / 35);
      const v = new Float64Array(lagMax + 2);
      let mejor = 0;
      for (let lag = lagMin; lag <= lagMax; lag++) {
        let s = 0, e1 = 0, e2 = 0;
        for (let i = 0; i < 1024; i++) {
          const a = d[desde + i] || 0, b = d[desde + i + lag] || 0;
          s += a * b; e1 += a * a; e2 += b * b;
        }
        v[lag] = s / (Math.sqrt(e1 * e2) || 1);
        if (v[lag] > mejor) mejor = v[lag];
      }
      for (let lag = lagMin; lag <= lagMax; lag++) {
        if (v[lag] >= 0.92 * mejor && v[lag] >= v[lag - 1] && v[lag] >= v[lag + 1]) return sr / lag;
      }
      return 0;
    };

    // Cinco sondas y nos quedamos con la de en medio: una sola se despista
    const alturaTipica = (d, golpe) => {
      const a = [];
      for (let k = 0; k < 5; k++) {
        a.push(altura(d, Math.floor((golpe.t + golpe.dur * (0.15 + 0.12 * k)) * sr)));
      }
      a.sort((x, y) => x - y);
      return a[2];
    };

    const revisa = (quien, d, guion, hzMin, hzMax) => {
      let pico = 0, suma = 0;
      for (let i = 0; i < d.length; i++) {
        const x = Math.abs(d[i]);
        if (x > pico) pico = x;
        suma += d[i] * d[i];
      }
      // El golpe largo es el bramido; lo demás son el quejido y los gruñidos
      const golpe = guion.reduce((a, b) => (b.dur > a.dur ? b : a));
      const cuerpo = rms(d, golpe.t + golpe.dur * 0.2, golpe.t + golpe.dur * 0.7);
      let hueco = null;
      for (let i = 1; i < guion.length; i++) {
        const a = guion[i - 1].t + guion[i - 1].dur, b = guion[i].t;
        if (!hueco || b - a > hueco.b - hueco.a) hueco = { a: a, b: b };
      }

      prueba(quien + ' programa su secuencia', guion.length > 1, true);
      prueba(quien + ' suena', pico > 0.05, true);
      prueba(quien + ' no satura', pico <= 1, true);
      prueba(quien + ' tiene cuerpo', Math.sqrt(suma / d.length) > 0.02, true);
      prueba(quien + ' no zumba antes de empezar', rms(d, 0, guion[0].t) < cuerpo * 0.1, true);
      prueba(quien + ' deja hueco entre golpes',
             rms(d, hueco.a + (hueco.b - hueco.a) * 0.25, hueco.b) < cuerpo * 0.2, true);

      const banda = espectro(d, [0.20, 0.35, 0.50, 0.65].map(
        f => Math.floor((golpe.t + golpe.dur * f) * sr)));
      prueba(quien + ' se oye en un altavoz pequeño', banda(200, sr / 2) > 50, true);
      /* Este umbral bajó de 60 a 45 al cambiar de motor, y conviene decir por
         qué para que nadie lo "arregle" subiéndolo otra vez: el 60 describía
         el rugido realista, que metía el 70% de su energía bajo 800 Hz y
         sonaba a bocinazo tapado. El maullido —que es el sonido que sí
         funciona en esta app— está en el 54%. El rugido nuevo, en el 58%: más
         grave que el maullido, como debe ser, pero de la misma familia. Lo
         que aquí se vigila ya no es "que sea grave" en absoluto sino que no
         se vuelva delgado; de que sea MÁS GRAVE QUE EL MAULLIDO se encarga la
         prueba de abajo, que es la que expresa la intención de verdad. */
      prueba(quien + ' no se queda delgado', banda(0, 800) > 45, true);
      prueba(quien + ' tiene desgarro', banda(800, 2500) > 15, true);

      const hz = alturaTipica(d, golpe);
      prueba(quien + ' no se cae una octava', hz > hzMin, true);
      prueba(quien + ' tampoco se agudiza', hz < hzMax, true);
      return { hz: hz, fin: guion[guion.length - 1].t + guion[guion.length - 1].dur };
    };

    const leon = await render('leon', 3.0);
    const tigre = await render('tigre', 2.2);
    const mLeon = revisa('el león', leon.d, leon.guion, 90, 260);
    const mTigre = revisa('el tigre', tigre.d, tigre.guion, 80, 200);

    // Y no pueden ser el mismo sonido con otro nombre
    prueba('el tigre ruge más grave que el león', mTigre.hz < mLeon.hz * 0.85, true);
    prueba('y más corto', mTigre.fin < mLeon.fin * 0.75, true);

    /* El rugido es el maullido con dos octavas menos: si alguien lo sube sin
       darse cuenta, deja de ser un felino grande y vuelve a ser un gato.
       Se compara con el maullido de verdad, no contra un número fijo, porque
       el maullido sale con altura aleatoria en cada tirada.
       Medido: maullido 258-383 Hz, león 165, tigre 131. */
    audioCtx = new OfflineAudioContext(1, Math.floor(sr * 1.0), sr);
    applyFur('carbon');
    playMeow();
    const maullido = (await audioCtx.startRendering()).getChannelData(0);
    const hzMaullido = alturaTipica(maullido, { t: 0.06, dur: 0.42 });
    prueba('el maullido sigue siendo agudo', hzMaullido > 200, true);
    prueba('el león ruge mucho más grave que el maullido',
           mLeon.hz < hzMaullido * 0.75, true);
    prueba('y el tigre más todavía', mTigre.hz < mLeon.hz, true);

    /* ---------- El rugido grabado ----------
       Lo que de verdad se oye. Aquí no se juzga si suena bien —eso es de
       oído—, se comprueba que llega entero y que no se queda por el camino.

       El fallo que más miedo da no es que suene mal: es que el archivo no
       entre en el paquete. Eso no lo nota nadie hasta que un usuario se pone
       de león en la versión publicada y no pasa nada. Por eso se leen las
       listas de las tres compilaciones y se exige que los dos WAV estén. */
    for (const especie of Object.keys(RUGIDOS_GRABADOS)) {
      const ruta = RUGIDOS_GRABADOS[especie];
      let bytes = null;
      try { const res = await fetch(ruta); if (res.ok) bytes = await res.arrayBuffer(); } catch (e) {}
      prueba('la grabación del ' + especie + ' está donde dice', !!bytes, true);
      if (!bytes) continue;

      audioCtx = new OfflineAudioContext(1, Math.floor(sr * 0.1), sr);
      const buf = await audioCtx.decodeAudioData(bytes);
      const d = buf.getChannelData(0);
      let pico = 0, suma = 0;
      for (let i = 0; i < d.length; i++) {
        const x = Math.abs(d[i]);
        if (x > pico) pico = x;
        suma += d[i] * d[i];
      }
      prueba('la del ' + especie + ' dura lo que un rugido',
             buf.duration > 0.8 && buf.duration < 3, true);
      prueba('la del ' + especie + ' no está muda', Math.sqrt(suma / d.length) > 0.02, true);
      prueba('la del ' + especie + ' no viene recortada por saturar', pico <= 1, true);
      /* Ojo con lo que se puede comprobar aquí: decodeAudioData remuestrea al
         ritmo del contexto, así que buf.sampleRate dice el del contexto y no
         el del archivo — comprobarlo no probaría nada. Lo que sí sobrevive es
         el número de canales, y el peso se mira en los bytes crudos, que es
         justo lo que se quiere vigilar: que nadie suelte aquí el WAV original
         de 6 MB del que salió el recorte. */
      prueba('la del ' + especie + ' es mono', buf.numberOfChannels, 1);
      prueba('la del ' + especie + ' no engorda la app',
             bytes.byteLength < 120 * 1024, true);
    }

    /* Que playRoar elija bien. Son tres caminos y los tres importan:
       la grabación si la tiene; esperarla si viene en camino; y el sintetizado
       para el que no tiene grabación ninguna.

       El de en medio es el que arregla un fallo real: antes, elegir un felino
       soltaba el sintetizado en el acto porque la descarga no había llegado, y
       ese primer rugido no volvía a oírse nunca más. */
    const habia = rugidoListo.leon;
    audioCtx = new OfflineAudioContext(1, Math.floor(sr * 0.5), sr);
    rugidoListo.leon = audioCtx.createBuffer(1, Math.floor(sr * 0.5), sr);
    const conGrabacion = playRoar('leon');
    prueba('con la grabación cargada, playRoar la usa',
           conGrabacion.length === 1 && conGrabacion[0].grabado === true, true);

    delete rugidoListo.leon;
    audioCtx = new OfflineAudioContext(1, Math.floor(sr * 3), sr);
    const enCamino = playRoar('leon');
    prueba('si la grabación viene en camino, la espera en vez de tirar del plan B',
           enCamino.length === 1 && enCamino[0].esperando === true, true);
    // Y termina llegando: si esto falla, el felino se quedaría con el plan B
    prueba('y acaba llegando', await prepararRugido('leon'), true);

    // Un pelaje sin grabación asignada sí tira del sintetizado, y en el acto
    audioCtx = new OfflineAudioContext(1, Math.floor(sr * 3), sr);
    const sinGrabacion = playRoar('carbon');
    prueba('sin grabación asignada, suena el sintetizado y no se queda mudo',
           sinGrabacion.length > 1 && !sinGrabacion[0].grabado, true);
    if (habia) rugidoListo.leon = habia;

    /* La precarga. El archivo se pide al elegir pelaje, no al pulsar, para que
       cuando el usuario haga rugir al gato ya esté. Se comprueba mirando la
       petición en vuelo y no el AudioBuffer: lo segundo obligaría a un
       AudioContext vivo, y en una ventana sin tarjeta de sonido eso se cuelga
       —costó cinco minutos de reloj descubrirlo—. */
    delete rugidoEnVuelo.tigre;
    delete rugidoListo.tigre;
    applyFur('tigre');
    prueba('elegir tigre pide su grabación', !!rugidoEnVuelo.tigre, true);
    applyFur('carbon');
    prueba('elegir gato normal no pide ninguna', !!rugidoEnVuelo.carbon, false);

    /* Las listas que deciden si el archivo llega al usuario. Son TRES, una por
       destino, y hay que mirarlas todas: la de Microsoft Store se quedó sin
       sonidos/** al añadirlos y el .appx habría salido mudo —con el gato
       cayendo al plan B justo en la versión de la tienda—, mientras las otras
       dos estaban bien. Un fallo así no se nota compilando: se nota cuando lo
       instala alguien. */
    const listas = [['sw.js', 'el caché sin conexión'],
                    ['build-pwa.js', 'el paquete de la PWA'],
                    ['microsoft-store/electron-builder.yml', 'el .appx de Microsoft Store']];
    for (const [archivo, queEs] of listas) {
      let texto = '';
      try { texto = await (await fetch(archivo)).text(); } catch (e) {}
      /* Cada lista nombra los archivos a su manera: sw.js y build-pwa.js los
         listan uno a uno, y el .yml usa un comodín de carpeta. Vale cualquiera
         de las dos formas mientras el archivo acabe dentro. */
      const cubre = (ruta) => {
        if (texto.indexOf(ruta) !== -1) return true;
        const carpeta = ruta.slice(0, ruta.lastIndexOf('/') + 1);
        return texto.indexOf(carpeta + '**') !== -1;
      };
      for (const especie of Object.keys(RUGIDOS_GRABADOS)) {
        prueba('el rugido del ' + especie + ' entra en ' + queEs,
               cubre(RUGIDOS_GRABADOS[especie]), true);
      }
    }

    /* Y que todo el que ruge tenga grabación: si alguien añade un felino a
       RUGEN y se olvida del archivo, se queda con el sintetizado para siempre
       sin que salte nada. */
    for (const especie of RUGEN) {
      prueba(especie + ' tiene grabación asignada', !!RUGIDOS_GRABADOS[especie], true);
      /* Y receta sintetizada PROPIA. Sin ella caen en la del león por el
         "|| RUGIDOS.leon" de playRoar, y el plan B suplanta a otro animal:
         medido, leopardo y jaguar salían con el espectro del león clavado.
         (Ojo: aquí no se pueden usar comillas invertidas. Esto vive dentro de
         una plantilla, y un par de ellas la parte en dos sin que node --check
         se queje — el guion llega cortado a la página y revienta allí.) */
      prueba(especie + ' tiene receta sintetizada propia', !!RUGIDOS[especie], true);
    }

    // La aspereza es ruido, no un oscilador: dos rugidos nunca salen iguales
    const otroLeon = await render('leon', 3.0);
    let iguales = true;
    for (let i = 0; i < leon.d.length; i += 97) {
      if (Math.abs(leon.d[i] - otroLeon.d[i]) > 1e-9) { iguales = false; break; }
    }
    prueba('no hay dos rugidos iguales', iguales, false);
  } finally {
    audioCtx = guardado;
    soundOn = sonabaAntes;
    applyFur('carbon');
  }

  return r;
})()`;

function comparar(obtenido, esperado) {
  if (typeof esperado === 'number' && typeof obtenido === 'number') {
    return Math.abs(obtenido - esperado) <= 1e-9 * Math.max(1, Math.abs(esperado));
  }
  return obtenido === esperado;
}

app.on('window-all-closed', () => {});

/* Corre una fase y, si revienta, lo DICE. Antes no: si el guion lanzaba, la
   promesa de executeJavaScript quedaba rechazada sin recoger, el proceso se
   quedaba colgado sin imprimir nada y había que salir a buscar el error por
   fuera. Un banco de pruebas que se cuelga en silencio es peor que uno que
   falla. */
/* ---------- Diseño al girar el móvil ----------
   Esto no cabe en el guion de comportamiento: las media queries dependen del
   tamaño REAL de la ventana, y desde dentro de la página no se puede cambiar.
   Hay que redimensionar de verdad y volver a medir, así que es una fase aparte.

   Lo que se vigila: que en horizontal el teclado se vaya a su columna, que
   quepa entero, que las teclas no se queden en tamaño de hormiga, y —lo más
   importante— que el vertical de siempre no se haya movido ni un pelo. */
const TAMANOS = [
  { nombre: 'móvil girado',                 w: 844,  h: 390, sci: false, cols: 2 },
  { nombre: 'móvil girado con científica',  w: 844,  h: 390, sci: true,  cols: 3 },
  { nombre: 'móvil pequeño girado',         w: 640,  h: 360, sci: false, cols: 2 },
  { nombre: 'móvil pequeño con científica', w: 640,  h: 360, sci: true,  cols: 3 },
  { nombre: 'tablet en horizontal',         w: 1024, h: 768, sci: false, cols: 2 },
  { nombre: 'tablet con científica',        w: 1024, h: 768, sci: true,  cols: 3 },
  { nombre: 'móvil de pie',                 w: 440,  h: 780, sci: false, cols: 0 },
  { nombre: 'móvil de pie con científica',  w: 440,  h: 780, sci: true,  cols: 0 }
];

/* "Alcanzable" no es lo mismo que "cabe en pantalla": en vertical con la
   científica abierta el teclado se sale por abajo desde siempre, y está bien
   porque .pad-wrap se desplaza. Lo que nunca puede pasar es que quede fuera
   SIN forma de llegar a él. */
const MEDIR_DISENO = `(() => {
  const g = getComputedStyle(document.getElementById('app'));
  const visible = (e) => e && getComputedStyle(e).display !== 'none';
  const alcanzable = (sel) => {
    const e = document.querySelector(sel);
    if (!visible(e)) return true;
    const r = e.getBoundingClientRect();
    if (r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1) return true;
    for (let p = e.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === 'auto' || o === 'scroll') return true;
    }
    return false;
  };
  const rk = document.querySelector('.keypad').getBoundingClientRect();
  const rd = document.querySelector('.display').getBoundingClientRect();
  return {
    columnas: g.display === 'grid' ? g.gridTemplateColumns.split(' ').length : 0,
    aLaDerecha: rk.left > rd.right - 2,
    tecladoCabe: rk.bottom <= innerHeight + 1 && rk.right <= innerWidth + 1,
    todoAlcanzable: alcanzable('.keypad') && alcanzable('#sci-pad'),
    filaTecla: Math.round((rk.height - 40) / 5)
  };
})()`;

/* ---------- Mantener pulsado ----------
   El camino de Android, y el único que no cabe en el guion de comportamiento:
   el menú sale de un temporizador de 550 ms, así que hay que esperar de verdad.
   Se vigilan las dos mitades, porque la que importa es la segunda: que un
   toque normal NO abra el menú. Si se abriera, colocar el cursor se volvería
   imposible. */
async function fasePulsacionLarga(win) {
  const espera = (ms) => new Promise(res => setTimeout(res, ms));
  const js = (s) => win.webContents.executeJavaScript(s);
  const dedoAbajo = `(() => {
    const el = document.getElementById('result');
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    }));
    return 'ok';
  })()`;
  const dedoArriba = `(() => {
    document.getElementById('result')
      .dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return 'ok';
  })()`;
  const abierto = "!document.getElementById('clip-menu').classList.contains('hidden')";

  const r = [];
  await js("closePanels(); clearAll(true); cerrarMenuClip(); 'listo';");

  await js(dedoAbajo);
  await espera(750);
  r.push(['mantener pulsado abre el menú', await js(abierto), true]);
  await js(dedoArriba);
  await js("cerrarMenuClip(); 'listo';");

  // Y un toque normal no: si abriera, no se podría colocar el cursor
  await js(dedoAbajo);
  await espera(150);
  await js(dedoArriba);
  await espera(600);
  r.push(['un toque corto no lo abre', await js(abierto), false]);

  await js("cerrarMenuClip(); clearAll(true); 'listo';");
  return r;
}

async function faseDiseno(win) {
  const r = [];
  const original = win.getContentSize();
  for (const t of TAMANOS) {
    win.setContentSize(t.w, t.h);
    await new Promise(res => setTimeout(res, 220));
    await win.webContents.executeJavaScript(
      "closePanels(); applyMode('" + (t.sci ? 'sci' : 'basic') + "'); clearAll(true);" +
      "for (const k of ['1','2','3','4','+','5','6']) pushToken(k); 'listo';");
    await new Promise(res => setTimeout(res, 200));
    const m = await win.webContents.executeJavaScript(MEDIR_DISENO);
    const n = t.nombre;
    r.push([n + ': columnas', m.columnas, t.cols]);
    r.push([n + ': no deja nada inalcanzable', m.todoAlcanzable, true]);

    /* El panel abierto no puede comerse el teclado NUMÉRICO. En una sola
       columna sí lo tapa, y está bien: mientras usas el panel no tecleas. Pero
       en horizontal la derecha es el teclado, y el panel de compras se lo
       comía entero — solo asomaban la C, el 7, el 4, el 1 y el ±.

       Las teclas científicas sí se pueden tapar en parte: el panel conserva su
       ancho para que los importes no salgan cortados, y quien reparte una
       cuenta no anda buscando el seno.

       Y no basta con que no tape: tiene que LEERSE. Apartarlo a la columna
       izquierda con un ancho en píxeles lo dejó en 286px en una ventana de 640,
       y ahí el descuento salía "1.161 (−1…".

       Por eso se prueba con dos precios y en TODOS los tamaños, también en
       vertical: uno de los de todos los días y uno desmedido. El grande no es
       un capricho — con cinco cifras ya se cortaba, y en vertical también, así
       que el recorte no era cosa del diseño horizontal. */
    for (const precio of ['1290', '999999999']) {
      await win.webContents.executeJavaScript(`(() => {
        closePanels(); document.getElementById('btn-shop').click();
        const p = document.getElementById('shop-price');
        p.value = '${precio}';
        p.dispatchEvent(new Event('input', { bubbles: true }));
        return 'listo';
      })()`);
      await new Promise(res => setTimeout(res, 300));
      const panel = await win.webContents.executeJavaScript(`(() => {
        const p = document.querySelector('.side-panel:not(.hidden)');
        const k = document.querySelector('.keypad');
        if (!p) return { abierto: false };
        /* El panel entra con pop-in, que arranca en scale(0.95). En una ventana
           oculta las animaciones no avanzan, así que se medía un panel un 5% más
           chico que el de verdad — 16px de gracia justo donde se decide si tapa
           el teclado. Adelantarla al final da la medida que ve el usuario. */
        p.getAnimations().forEach(an => an.finish());
        const a = p.getBoundingClientRect(), b = k.getBoundingClientRect();
        return {
          abierto: true,
          libre: a.right <= b.left || a.left >= b.right ||
                 a.bottom <= b.top || a.top >= b.bottom,
          cabe: a.left >= -1 && a.right <= innerWidth + 1,
          cortados: [...p.querySelectorAll('.shop-res')]
            .filter(e => e.scrollWidth > e.clientWidth + 1)
            .map(e => e.textContent.trim()).join(' | ')
        };
      })()`);
      const con = n + ' con ' + precio;
      r.push([con + ': el panel se abre', panel.abierto, true]);
      r.push([con + ': los importes se leen enteros', panel.cortados, '']);
      if (t.cols > 0) {
        r.push([con + ': el panel no tapa el teclado', panel.libre, true]);
        r.push([con + ': y el panel cabe en pantalla', panel.cabe, true]);
      }
    }
    await win.webContents.executeJavaScript(`(() => {
      const p = document.getElementById('shop-price');
      p.value = ''; p.dispatchEvent(new Event('input', { bubbles: true }));
      closePanels(); return 'listo';
    })()`);
    await new Promise(res => setTimeout(res, 150));
    if (t.cols) {
      r.push([n + ': el teclado va a la derecha de la cuenta', m.aLaDerecha, true]);
      r.push([n + ': el teclado cabe entero', m.tecladoCabe, true]);
      r.push([n + ': teclas de tamaño usable', m.filaTecla >= 40, true]);
    } else {
      r.push([n + ': sigue en una sola columna', m.aLaDerecha, false]);
    }
  }
  win.setContentSize(original[0], original[1]);
  await new Promise(res => setTimeout(res, 200));
  await win.webContents.executeJavaScript(
    "applyMode('basic'); clearAll(true);" +
    "store.del('catculator-mode'); store.del('catculator-sesion'); 'listo';");
  return r;
}

async function fase(win, nombre, guion) {
  try {
    return await win.webContents.executeJavaScript(guion);
  } catch (e) {
    console.log('\n💥 La fase "' + nombre + '" reventó antes de terminar:');
    console.log('   ' + e.message);
    console.log('   (el error de verdad sale arriba, en la consola de la página)');
    win.destroy();
    app.exit(1);
    return [];
  }
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  // Sin esto, un error dentro de la página no se ve por ningún lado
  win.webContents.on('console-message', (ev, nivel, mensaje, linea, fuente) => {
    if (nivel >= 2) console.log('   [página] ' + mensaje + '  (' + fuente + ':' + linea + ')');
  });
  win.webContents.on('render-process-gone', (ev, detalle) => {
    console.log('\n💥 La página se murió: ' + JSON.stringify(detalle));
    app.exit(1);
  });
  await win.loadFile(path.join(__dirname, 'index.html'));

  let pasan = 0, fallan = 0;
  const fallos = [];

  // --- Motor de expresiones ---
  const expresiones = CASOS.filter(c => c.length === 2);
  const guion = `(() => {
    const casos = ${JSON.stringify(expresiones.map(c => c[0]))};
    return casos.map(s => {
      try { const v = evaluate(s); return isFinite(v) ? v : 'ERR'; }
      catch (e) { return 'ERR'; }
    });
  })()`;
  const obtenidos = await fase(win, 'motor de expresiones', guion);

  expresiones.forEach(([expr, esperado], i) => {
    if (comparar(obtenidos[i], esperado)) pasan++;
    else { fallan++; fallos.push(`  evaluate(${JSON.stringify(expr)})  esperaba ${esperado}  obtuvo ${obtenidos[i]}`); }
  });

  // --- Comportamiento ---
  const conducta = await fase(win, 'comportamiento', GUION_COMPORTAMIENTO);
  for (const [nombre, obtenido, esperado] of conducta) {
    if (comparar(obtenido, esperado)) pasan++;
    else { fallan++; fallos.push(`  ${nombre}  esperaba ${JSON.stringify(esperado)}  obtuvo ${JSON.stringify(obtenido)}`); }
  }

  /* --- El menú de Electron, que es lo que hace funcionar Ctrl+V ---
     Esta ventana la crea el propio banco de pruebas, así que no puede
     comprobar el menú de la app de verdad; lo que sí puede es leer main.js y
     asegurarse de que nadie vuelve a dejarlo en null.

     Por qué importa: en Electron los atajos de portapapeles fuera de un campo
     de texto los sirve el menú de la aplicación. Con setApplicationMenu(null)
     —que es como estuvo— Ctrl+V no pegaba nada y no había ni error: el evento
     paste sencillamente no llegaba nunca a la página. */
  /* Se le quitan los comentarios antes de mirar: el propio comentario que hoy
     explica el arreglo menciona setApplicationMenu(null) en prosa, y la prueba
     se disparaba con el en vez de con codigo de verdad. */
  const CODIGO = (t) => t.split('/*').map((trozo, i) =>
    i === 0 ? trozo : trozo.slice(trozo.indexOf('*/') + 2)).join('');
  const mainJs = CODIGO(require('fs').readFileSync(path.join(__dirname, 'main.js'), 'utf8'));
  for (const [nombre, obtenido, esperado] of [
    ['main.js no deja el menú en null', /setApplicationMenu\(\s*null\s*\)/.test(mainJs), false],
    ['main.js registra el rol paste', /role:\s*'paste'/.test(mainJs), true],
    ['y también copiar y cortar',
     /role:\s*'copy'/.test(mainJs) && /role:\s*'cut'/.test(mainJs), true],
    ['pero esconde la barra de menú', /setMenuBarVisibility\(\s*false\s*\)/.test(mainJs), true]
  ]) {
    if (comparar(obtenido, esperado)) pasan++;
    else { fallan++; fallos.push(`  ${nombre}  esperaba ${JSON.stringify(esperado)}  obtuvo ${JSON.stringify(obtenido)}`); }
  }

  // --- Diseño al girar (redimensiona la ventana de verdad) ---
  const diseno = await faseDiseno(win);
  for (const [nombre, obtenido, esperado] of diseno) {
    if (comparar(obtenido, esperado)) pasan++;
    else { fallan++; fallos.push(`  ${nombre}  esperaba ${JSON.stringify(esperado)}  obtuvo ${JSON.stringify(obtenido)}`); }
  }

  // --- Mantener pulsado (espera de verdad los 550 ms) ---
  const pulsacion = await fasePulsacionLarga(win);
  for (const [nombre, obtenido, esperado] of pulsacion) {
    if (comparar(obtenido, esperado)) pasan++;
    else { fallan++; fallos.push(`  ${nombre}  esperaba ${JSON.stringify(esperado)}  obtuvo ${JSON.stringify(obtenido)}`); }
  }

  // --- Audio ---
  const audio = await fase(win, 'audio', GUION_AUDIO);
  for (const [nombre, obtenido, esperado] of audio) {
    if (comparar(obtenido, esperado)) pasan++;
    else { fallan++; fallos.push('  ' + nombre + '  esperaba ' + JSON.stringify(esperado) + '  obtuvo ' + JSON.stringify(obtenido)); }
  }
  if (fallos.length) {
    console.log('\nFALLOS:');
    for (const f of fallos) console.log(f);
  }
  console.log(`\n${pasan} pasan, ${fallan} fallan  ${fallan ? '😿' : '😺'}`);

  win.destroy();
  app.exit(fallan ? 1 : 0);
});
