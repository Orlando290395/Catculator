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

  return r;
})()`;

function comparar(obtenido, esperado) {
  if (typeof esperado === 'number' && typeof obtenido === 'number') {
    return Math.abs(obtenido - esperado) <= 1e-9 * Math.max(1, Math.abs(esperado));
  }
  return obtenido === esperado;
}

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
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
  const obtenidos = await win.webContents.executeJavaScript(guion);

  expresiones.forEach(([expr, esperado], i) => {
    if (comparar(obtenidos[i], esperado)) pasan++;
    else { fallan++; fallos.push(`  evaluate(${JSON.stringify(expr)})  esperaba ${esperado}  obtuvo ${obtenidos[i]}`); }
  });

  // --- Comportamiento ---
  const conducta = await win.webContents.executeJavaScript(GUION_COMPORTAMIENTO);
  for (const [nombre, obtenido, esperado] of conducta) {
    if (comparar(obtenido, esperado)) pasan++;
    else { fallan++; fallos.push(`  ${nombre}  esperaba ${JSON.stringify(esperado)}  obtuvo ${JSON.stringify(obtenido)}`); }
  }

  if (fallos.length) {
    console.log('\nFALLOS:');
    for (const f of fallos) console.log(f);
  }
  console.log(`\n${pasan} pasan, ${fallan} fallan  ${fallan ? '😿' : '😺'}`);

  win.destroy();
  app.exit(fallan ? 1 : 0);
});
