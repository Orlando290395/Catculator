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
`Tres arreglos:

• Al girar el móvil o estirar la ventana, los paneles se abrían ENCIMA del
teclado y tapaban los números. Ahora se abren al lado, en el hueco que quedaba
libre, y las teclas se ven enteras.

• Los importes largos del modo compras ya no se cortan: cuando no caben al
lado de su etiqueta, bajan a su propia línea.

• Y el gato ya no habla por fuera del borde: en horizontal sus frases largas
empezaban cortadas.

¡Gracias por usar Catculator! 🐱` },

  'play-en': { limite: 500, texto:
`Three fixes:

• Turning your phone or widening the window opened the panels ON TOP of the
keypad, hiding the numbers. They now open beside it, in the space that was
going to waste, and the keys stay visible.

• Long amounts in shopping mode are no longer cut off: when they don't fit
beside their label, they drop to their own line.

• And the cat no longer talks off the edge: in landscape its longer lines
started mid-word.

Thanks for using Catculator! 🐱` },

  'microsoft-es': { limite: 1500, texto:
`Catculator 1.2.1 — tres arreglos

LOS PANELES YA NO TAPAN EL TECLADO
Con la ventana maximizada o el móvil girado, la calculadora se reparte en dos
columnas: la cuenta a la izquierda y las teclas a la derecha. Los paneles de
compras, temas, notas y conversor seguían abriéndose pegados a la derecha —que
en vertical es el sitio natural— y ahí caían justo encima de los números: del
teclado solo asomaba la primera columna.

Ahora se abren en la columna izquierda, que era el espacio que quedaba sin usar.
El teclado numérico se ve entero mientras el panel está abierto, y el hueco que
sobraba pasa a tener un uso.

Con el teclado científico abierto el panel conserva su ancho para que los
importes no salgan cortados: en ese caso tapa parte de las teclas científicas,
pero nunca las numéricas.

LOS IMPORTES LARGOS YA NO SE CORTAN
En el modo compras, un precio de cinco cifras dejaba el descuento en
"111.110,4 (−12…": la cifra no cabía al lado de su etiqueta y se recortaba con
puntos suspensivos. Esto no venía del diseño horizontal — pasaba igual con el
móvil de pie. Ahora, cuando no cabe al lado, el importe baja a su propia línea
y se lee entero.

Y EL GATO YA NO HABLA POR FUERA DEL BORDE
Su bocadillo se centra sobre él, y en horizontal le toca una columna estrecha:
las frases largas empezaban cortadas por el borde izquierdo de la pantalla.
Ahora se ajustan a la columna y se leen enteras.

¡Gracias por usar Catculator! 🐱` },

  'microsoft-en': { limite: 1500, texto:
`Catculator 1.2.1 — three fixes

PANELS NO LONGER COVER THE KEYPAD
With the window maximised, or the phone turned sideways, the calculator splits
into two columns: the sum on the left, the keys on the right. The shopping,
theme, notepad and converter panels still opened flush right —which is the
natural spot in portrait— and there they landed straight on top of the numbers:
only the first column of keys stayed visible.

They now open in the left column, which was the space going to waste. The number
keys stay fully visible while a panel is open, and the empty area finally earns
its keep.

With the scientific keypad open the panel keeps its width so the amounts don't
get cut off: it covers part of the scientific keys in that case, but never the
number keys.

LONG AMOUNTS ARE NO LONGER CUT OFF
In shopping mode a five-figure price left the discount reading
"111,110.4 (−12…": the figure didn't fit beside its label and was trimmed with
an ellipsis. This one wasn't about the landscape layout — it happened in
portrait too. Now, when it doesn't fit alongside, the amount drops to its own
line and reads in full.

AND THE CAT NO LONGER TALKS OFF THE EDGE
Its speech bubble is centred over the cat, and in landscape the cat gets a
narrow column: longer lines started mid-word, off the left of the screen. They
now fit the column and read in full.

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
