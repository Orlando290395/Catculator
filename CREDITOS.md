# Créditos de material de terceros

Casi todo Catculator es original: el gato es SVG escrito a mano y los sonidos
—maullido, ronroneo, bufido, clic— están sintetizados con Web Audio, sin
archivos.

La excepción son los dos rugidos. Se intentaron sintetizar en cuatro versiones
distintas y ninguna acababa de sonar a felino grande, así que se optó por
grabaciones reales. Las dos se eligieron con un criterio duro: **licencia que
no obliga a atribuir**, porque la app se publica en Google Play y en Microsoft
Store y ahí una obligación de atribución mal cumplida es un problema. Aun así
se documentan aquí, que es lo correcto aunque no sea obligatorio.

## sonidos/rugido-leon.wav

- **Origen:** [File:Lion raring-sound1TamilNadu178.ogg](https://commons.wikimedia.org/wiki/File:Lion_raring-sound1TamilNadu178.ogg)
  en Wikimedia Commons
- **Autor:** த*உழவன் (trabajo propio)
- **Licencia:** **Dominio público**
- **Descripción original:** "the roaring of a lion in captivity" — grabado en un
  parque zoológico de Tamil Nadu, India
- **Qué se le hizo:** recorte de 1,70 s desde el segundo 0,47 del original,
  mezclado a mono, remuestreado a 16 kHz, normalizado a −3 dBFS y con
  desvanecidos de 12 ms en los extremos para que no chasquee al empezar y
  terminar

## sonidos/rugido-tigre.wav

- **Origen:** [File:439280 schots angry-tiger.wav](https://commons.wikimedia.org/wiki/File:439280_schots_angry-tiger.wav)
  en Wikimedia Commons, procedente de
  [Freesound](https://freesound.org/people/schots/sounds/439280/)
- **Autor:** schots
- **Licencia:** **CC0 1.0** (dedicación al dominio público)
- **Descripción original:** "Tiger in a cage, growling and snarling. Lots of
  reverb"
- **Qué se le hizo:** recorte de 1,50 s desde el segundo 23,23 del original
  (que dura 65 s), remuestreado a 16 kHz, normalizado a −3 dBFS y con los
  mismos desvanecidos

## sonidos/rugido-leopardo.wav y sonidos/rugido-jaguar.wav

**No son grabaciones de leopardo ni de jaguar, y conviene decirlo claro:** son
dos recortes distintos de la misma grabación CC0 de tigre de arriba, con el
tono cambiado. El leopardo va del segundo 42,70 acelerado un 26% (más agudo y
más corto, como su llamada real) y el jaguar del 33,88 ralentizado un 12% (más
grave). Al ser CC0 la fuente, los derivados no arrastran ninguna obligación.

Se hizo así porque **no hay alternativa limpia**:

- De leopardo no existe ninguna grabación en Wikimedia Commons.
- Del jaguar solo hay una,
  [File:Jaguar saw.flac](https://commons.wikimedia.org/wiki/File:Jaguar_saw.flac),
  y es **CC BY**: obligaría a atribuir dentro de la app.
- Del guepardo hay una excelente —las llamadas completas de un estudio
  publicado en PLOS ONE— pero también **CC BY**.

Si algún día se decide asumir la atribución (una pantalla de créditos dentro de
la app basta), esas dos grabarían mejor que lo que hay ahora. Es un cambio de
un archivo, sin tocar código.

## Los que no rugen: guepardo y leopardo de las nieves

No llevan archivo: sus voces están **sintetizadas** en `renderer.js`
(`playChirrido` y `playPrusten`). No es una rebaja, es que sus sonidos sí se
dejan sintetizar: el guepardo pía como un pájaro —corto y casi un tono puro— y
el leopardo de las nieves resopla, que es ruido pulsado sin voz. Lo que no se
dejaba sintetizar era el rugido, y por eso ese sí es grabado.

De paso, el reparto es zoología y no capricho: **solo cuatro felinos rugen**
—león, tigre, leopardo y jaguar—, porque son los únicos con el hioides sin
osificar del todo. Hay una prueba que lo vigila.

## Por qué 16 kHz

Porque se midió: ninguna de las dos grabaciones tiene energía por encima de
8 kHz, así que bajar de 48 kHz a 16 no quita nada audible y deja los dos
archivos en unos 50 KB cada uno en vez de 150.

## Si algún día hay que sustituirlos

Los dos archivos se cargan por nombre desde `RUGIDOS_GRABADOS`, en
`renderer.js`. Basta con dejar otro WAV con el mismo nombre. Si el archivo
falta o no se puede decodificar, la app cae sola en el rugido sintetizado que
sigue en el código, así que no se queda muda.
