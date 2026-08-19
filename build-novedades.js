/* Redacta las novedades de la versión para las dos tiendas y COMPRUEBA que
   caben en cada campo.

       node build-novedades.js

   Play Store corta "Novedades" a 500 caracteres por idioma y no avisa con
   suavidad: te rechaza el guardado. Microsoft Store da 1500. Se mide aquí en
   vez de contar a ojo, porque los emojis ocupan 2 unidades en UTF-16 —que es
   como cuentan las dos tiendas y como cuenta JavaScript— y a mano siempre se
   falla por poco.

   Sale en paquetes/<versión>/NOVEDADES.txt, junto a los paquetes de esa misma
   versión, para tener todo lo de una publicación en una sola carpeta.

   AL SACAR UNA VERSIÓN NUEVA: cambiar los textos de aquí abajo. */
const fs = require('fs');
const path = require('path');

const version = require('./package.json').version;
const DESTINO = path.join(__dirname, 'paquetes', version);

const TEXTOS = {
  'play-es': { limite: 500, texto:
`Seis mejoras para el día a día:

• PEGAR números de otras apps: Ctrl+V, o mantén pulsada la pantalla.
• VIBRA al pulsar, con interruptor propio: se nota aunque lleves el móvil en silencio.
• CORRIGE EN MEDIO: toca donde está el error y arréglalo ahí, sin borrarlo todo.
• NO SE PIERDE la cuenta a medias al cerrar la app.
• PULSA = OTRA VEZ y repite la última operación.
• HORIZONTAL: gira el móvil y cabe todo, con la científica al lado.

¡Gracias por usar Catculator! 🐱` },

  'play-en': { limite: 500, texto:
`Six everyday improvements:

• PASTE numbers from other apps: Ctrl+V, or press and hold the display.
• VIBRATES on tap, with its own switch: you feel it even on silent.
• FIX THE MIDDLE: tap where the mistake is and fix it there, no clearing everything.
• KEEPS your half-finished sum when you close the app.
• PRESS = AGAIN to repeat the last operation.
• LANDSCAPE: turn your phone and it all fits, scientific keys alongside.

Thanks for using Catculator! 🐱` },

  'microsoft-es': { limite: 1500, texto:
`Catculator 1.2.0 — seis mejoras de uso diario

PEGAR NÚMEROS
Ya se pueden traer cifras desde otras aplicaciones: Ctrl+V en el teclado, o
mantener pulsada la pantalla. Entiende los dos formatos (1.234,56 y 1,234.56) y
avisa cuando lo pegado no es un número, en vez de inventarse uno.

CORREGIR EN MEDIO DE LA CUENTA
Antes solo se podía borrar desde el final: si la errata estaba al principio de
una operación larga, había que empezar de cero. Ahora hay cursor: toca donde
esté el error, o muévelo con las flechas, y corrige ahí mismo.

NO SE PIERDE LO QUE ESTABAS ESCRIBIENDO
La operación a medias sobrevive a cerrar la aplicación.

EL = REPITE
Pulsa = otra vez y repite la última operación: 5+3 da 8, otra vez 11, otra 14.

VIBRACIÓN AL PULSAR
Con interruptor propio en el panel de personalizar, aparte del sonido.

DISEÑO HORIZONTAL
Al girar el dispositivo o estirar la ventana, la calculadora se reorganiza en
dos columnas —y en tres con el teclado científico abierto— en vez de dejar los
lados vacíos. También aprovecha mejor las pantallas de tableta.

¡Gracias por usar Catculator! 🐱` },

  'microsoft-en': { limite: 1500, texto:
`Catculator 1.2.0 — six everyday improvements

PASTE NUMBERS
You can now bring figures in from other apps: Ctrl+V, or press and hold the
display. It understands both formats (1,234.56 and 1.234,56) and tells you when
what you pasted isn't a number, instead of making one up.

FIX THE MIDDLE OF A SUM
Before, you could only delete from the end: if the typo was at the start of a
long calculation, you had to start over. Now there's a cursor — tap where the
mistake is, or move it with the arrow keys, and fix it right there.

YOUR HALF-FINISHED SUM SURVIVES
Close the app and come back: the calculation you were typing is still there.

PRESS = AGAIN TO REPEAT
5+3 gives 8, press = again for 11, again for 14.

VIBRATION ON TAP
With its own switch in the customise panel, separate from the sound.

LANDSCAPE LAYOUT
Turn the device or widen the window and the calculator rearranges into two
columns — three with the scientific keypad open — instead of leaving the sides
empty. Tablet screens are put to better use too.

Thanks for using Catculator! 🐱` }
};

let volcado = 'NOVEDADES DE CATCULATOR ' + version + '\n' +
  '='.repeat(40) + '\n\n' +
  'Copia y pega el bloque que toque. El recuento es de caracteres reales:\n' +
  'Play Store admite 500 por idioma, Microsoft Store 1500.\n\n\n';
let algunoSePasa = false;

for (const [nombre, t] of Object.entries(TEXTOS)) {
  const texto = t.texto.trim();
  const n = texto.length;   // UTF-16, igual que cuentan las tiendas
  const cabe = n <= t.limite;
  if (!cabe) algunoSePasa = true;
  console.log('  ' + (cabe ? 'OK  ' : '*** ') + nombre.padEnd(14) +
    String(n).padStart(5) + ' / ' + t.limite +
    (cabe ? '   (sobran ' + (t.limite - n) + ')' : '   *** SE PASA POR ' + (n - t.limite)));
  volcado += '========== ' + nombre.toUpperCase() + '   (' + n + '/' + t.limite + ') ==========\n\n' +
             texto + '\n\n\n';
}

fs.mkdirSync(DESTINO, { recursive: true });
fs.writeFileSync(path.join(DESTINO, 'NOVEDADES.txt'), volcado, 'utf8');
console.log('\n  ' + path.join(DESTINO, 'NOVEDADES.txt'));
if (algunoSePasa) {
  console.log('\n  Algún texto se pasa del límite: recórtalo antes de publicar.');
  process.exit(1);
}
