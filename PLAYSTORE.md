# Publicar Catculator en Google Play

Todo lo que hay que pegar en Play Console, en el orden en que la consola lo pide.
El material gráfico sale de `npm run icon` y `npm run capturas` (carpeta `tienda/`, no versionada).

## Datos de la app

| Campo | Valor |
|---|---|
| Nombre de la app | `Catculator` |
| ID de la aplicación | `com.catculator.app` — **permanente, no se puede cambiar tras publicar** |
| Categoría | Herramientas |
| Tipo | Aplicación (no juego) |
| Gratuita/de pago | **De pago: 1 USD.** Sin compras dentro de la app, sin anuncios |
| Política de privacidad | https://orlando290395.github.io/Catculator/privacidad.html |
| Correo de contacto | orlando-egs@outlook.es (queda público en la ficha) |
| versionCode actual | `1` — **hay que subirlo a mano en `android/app/build.gradle` en cada subida** |

## Ficha de tienda

### Título (máx. 30)

```
Catculator: Calculadora Gato
```

### Descripción corta (máx. 80)

```
Una calculadora con un gato que te mira, ronronea y se enoja si divides entre 0
```

### Descripción completa (máx. 4000)

```
Catculator es una calculadora de verdad con un gato de verdad viviendo dentro.

Haz cuentas normales — sumar, restar, multiplicar, dividir, porcentajes — mientras un gato te
observa desde arriba de la pantalla. Sus ojos siguen tu dedo. Parpadea. Mueve la cola. Se enoja
si divides entre cero. Celebra cuando te sale el resultado. Y si lo dejas solo 45 segundos, se
duerme. Acarícialo tocándolo: ronronea.

MODO CIENTÍFICO
Toca el botón 🔬 y la calculadora se abre entera:
• Trigonometría: sin, cos, tan y sus inversas, con conmutador DEG/RAD
• Logaritmos ln y log, más eˣ y 10ˣ
• Potencias y raíces: x², x³, xʸ, √, ∛, 1/x
• Constantes π y e, factorial n!, valor absoluto, módulo, notación científica EXP
• Ans para reutilizar el último resultado
• Memoria completa: MC, MR, M+, M−, MS con indicador en pantalla
• Paréntesis, orden de operaciones y vista previa del resultado mientras escribes

PERSONALÍZALA
• 6 temas de color: Cian, Rosa, Menta, Lavanda, Atigrado y Noche
• 5 colores de pelaje para el gato: Carbón, Naranja, Gris, Negro y Blanco
• Sonidos gatunos sintetizados — clics, maullidos, ronroneos y bufidos — que puedes apagar
• Se acuerda de cómo la dejaste

PAGAS UNA VEZ Y YA
Catculator cuesta lo que cuesta un café de máquina, una sola vez. A cambio:
• Sin anuncios. Nunca. Ni ahora ni en la próxima actualización
• Sin compras dentro de la app ni funciones bloqueadas — la tienes completa
• Sin suscripciones
• Sin cuentas ni registro
• Sin permisos: ni cámara, ni contactos, ni ubicación, ni almacenamiento
• Sin internet — funciona completa en modo avión
• Sin recoger un solo dato tuyo

Las calculadoras gratis se pagan con tus datos o con anuncios a pantalla completa
entre una suma y otra. Esta se paga una vez, con un dólar, y se acabó.

Pesa menos de 3 MB. Prueba a escribir 9, 42 o 3.14 y mira qué hace el gato.

Hecho con 🐾 y mucho ronroneo.
```

## Formulario: Seguridad de los datos

La respuesta corta es **no** a todo. Google define "recoger" como *transmitir los datos fuera del
dispositivo*. Las preferencias de Catculator viven en `localStorage` y nunca salen del teléfono,
así que **no cuentan como recogidas**. No declares nada ahí.

| Pregunta de la consola | Respuesta |
|---|---|
| ¿Tu app recoge o comparte alguno de los tipos de datos requeridos? | **No** |
| ¿Los datos están cifrados en tránsito? | (no aplica — no se recoge nada) |
| ¿Ofreces una forma de solicitar la eliminación de datos? | (no aplica) |
| ¿La app ha sido revisada de forma independiente? | No |

Resultado en la ficha: **"No se recopilan datos"**. Es cierto y es un argumento de venta —
déjalo así.

## Formulario: Clasificación de contenido (IARC)

| Pregunta | Respuesta |
|---|---|
| Categoría | Utilidad, productividad, comunicación u otros |
| ¿Violencia, sangre, lenguaje soez, sexo, drogas, apuestas, terror? | **No** a todas |
| ¿Comparte ubicación, información personal, permite comprar? | **No** a todas |
| ¿Contenido generado por usuarios? | **No** |

Resultado esperado: apta para todo público.

## Público objetivo

Elige **13 años en adelante**, no marques "menores de 13".

Motivo: si declaras que la app va dirigida a niños entras en la **política de Familias**, que trae
revisión extra, requisitos de anuncios y más rechazos. Catculator es apta para niños y puede usarla
cualquiera, pero declararla como *dirigida a niños* te complica la aprobación sin darte nada a cambio.

## Checklist de publicación

1. **Cuenta de desarrollador** — 25 USD, pago único, en https://play.google.com/console/signup.
   Elige cuenta **personal**: la de organización exige un número D-U-N-S y empresa registrada.
   Te van a pedir verificar identidad con documento oficial. Tarda de horas a algunos días.
   **Empieza por aquí, es lo que bloquea todo lo demás.**

   > En ese formulario está el campo **"Nombre del desarrollador"**: es el texto público que sale
   > bajo el nombre de la app en la ficha — el "creador" que ve todo el mundo. **Pon `Catculator`**,
   > no tu nombre. No tiene que ser tu nombre legal. Cambiarlo después es un trámite.
2. **Perfil de pagos (comerciante)** — en Play Console, en cuanto la cuenta esté aprobada.
   **Tiene su propia verificación, aparte de la de identidad**: datos fiscales (incluida la
   información fiscal de EE. UU., normalmente el W-8BEN para no residentes) y cuenta bancaria en
   colones. **Arrancarlo de inmediato**: es otro reloj que corre solo y sin él no se puede cobrar.

3. **Crear la app** en la consola: nombre `Catculator`, idioma español, **app de pago**.

   > **El precio es una puerta de un solo sentido.** Una app publicada como gratuita no se puede
   > pasar nunca a de pago; al revés sí. Hay que fijar el precio ANTES de la primera publicación.
   >
   > De pago implica además: perfil de comerciante en Google Payments (datos fiscales y cuenta
   > bancaria) y **dirección legal completa visible en la ficha**.
   >
   > Costa Rica sí admite registro de comercio; la moneda de cobro es **CRC (colones)**. El precio
   > se fija como precio base y Google lo convierte por país: al ponerlo, revisar qué muestra para
   > Estados Unidos y cuadrarlo en 0,99–1,00 USD (el mínimo de Play ronda los 0,99 USD).
   >
   > Cuentas: Google se queda el 15%, quedan ~0,85 USD por venta, y el pago no se libera hasta el
   > umbral mínimo (~100 USD, verificar para CR) — más de 100 ventas antes del primer cobro.
   >
   > Pendiente de verificar: si los testers de la prueba cerrada tendrán que pagar el 1 USD o basta
   > con agregarlos en *License testing*. Comprobarlo ANTES de mandarles el enlace de opt-in: si les
   > sale pantalla de cobro se caen del programa y el reloj de 14 días se reinicia.
4. **Fijar el precio antes de publicar** — 1 USD. Revisar la conversión que propone Google para
   cada país, empezando por Estados Unidos.
5. **Ficha principal** — pegar título, descripciones y subir de `tienda/`:
   - Icono 512×512 → `tienda/icono-512.png`
   - Gráfico destacado 1024×500 → `tienda/grafico-destacado-1024x500.png`
   - Capturas de teléfono (mínimo 2, hay 5) → `tienda/capturas/`
6. **Publicar la política de privacidad**: hecho — ya está viva en
   https://orlando290395.github.io/Catculator/privacidad.html
7. **Rellenar los formularios** de arriba: seguridad de datos, clasificación, público objetivo,
   más anuncios (**no tiene**) y app de noticias (**no**).
8. **Prueba cerrada obligatoria** — para cuentas personales nuevas:
   - Mínimo **12 testers** que se queden **14 días seguidos** optados. Si alguien se sale, el
     contador se reinicia. Junta 14–15 personas por si acaso.
   - Los testers se agregan por correo (el de su cuenta de Google) o con una lista de Google Groups.
   - Sube `Catculator-1.0-release.aab` a la pista de prueba cerrada y pásales el enlace de opt-in.
   - **Este es el paso largo. Arráncalo en cuanto tengas la cuenta**, y mientras corren los 14 días
     dejas lista la ficha.
9. **Solicitar acceso a producción** — se habilita al cumplir los 14 días. Google revisa; suele
   tardar de días a un par de semanas en la primera app.
10. **Publicar.**

### Al subir el AAB

La primera vez Google te ofrece **Play App Signing**: acéptalo (es lo normal y ya no es opcional
para apps nuevas). Tu `catculator.jks` pasa a ser la *clave de subida* y Google guarda la *clave de
firma* con la que se distribuye la app.

> Matiz importante frente a lo que dice el README: **con Play App Signing, perder el `.jks` ya no
> es fatal.** Es la clave de subida, y Google la puede reiniciar si la pierdes. La que sí es
> irrecuperable es la clave de firma, y esa la custodia Google. Aun así, respalda el `.jks` y su
> contraseña: recuperarla es un trámite de días que te deja sin poder actualizar mientras tanto.

### En cada actualización posterior

```bash
# 1. sube versionCode en android/app/build.gradle (1 -> 2 -> 3...)
# 2. sube la versión del caché en sw.js (catculator-v1 -> v2)
npm run pwa && npx cap sync android
cd android && ./gradlew bundleRelease
```

Play Store rechaza cualquier AAB cuyo `versionCode` ya se haya subido.
