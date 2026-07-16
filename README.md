# Catculator 🐱🧮

La calculadora con temática de gatos. Corre en tres sitios con el mismo código:

- **Escritorio** (Windows) — Electron, instalador NSIS.
- **Web / celular** — PWA instalable, funciona sin conexión: <https://orlando290395.github.io/Catculator/>
- **Android** — APK / AAB vía Capacitor.

Todo el UI (`index.html`, `style.css`, `renderer.js`) es web pura: no usa nada de Electron ni de
Node, solo `localStorage`. Por eso el mismo código sirve para las tres.

## Características

- **Calculadora básica**: suma, resta, multiplicación, división, porcentaje, cambio de signo, borrado, decimales y separadores de miles.
- **Modo científico** (botón 🔬): evaluador de expresiones con paréntesis y orden de operaciones, vista previa del resultado en vivo, y:
  - Trigonometría `sin cos tan` y sus inversas (botón **2nd**), con conmutador **DEG/RAD**.
  - Logaritmos `ln`, `log`, y `eˣ` / `10ˣ` (2nd).
  - Potencias y raíces: `x²`/`x³`, `xʸ`, `√`/`∛`, `1/x`.
  - Constantes `π` y `e`, factorial `n!`, valor absoluto `|x|`, módulo `mod`, notación científica `EXP` y `Ans` (último resultado).
  - **Memoria**: `MC MR M+ M− MS` con indicador.
- **Gato animado**: sus ojos siguen el cursor, parpadea, mueve la cola y las patitas, se enoja si divides entre cero, celebra tus resultados y se duerme si lo ignoras 45 segundos. Haz clic en él para acariciarlo.
- **6 temas de color** (botón 🎨): Cian (predeterminado), Rosa, Menta, Lavanda, Atigrado y Noche. Se guarda tu preferencia.
- **5 colores de pelaje** (mismo panel 🎨): Carbón (predeterminado), Naranja, Gris, Negro y Blanco. También se guarda.
- **Sonidos gatunos sintetizados** (botón 🔊): clics, maullidos, ronroneos y bufidos — sin archivos de audio.
- **Huellitas** 🐾 al calcular y frases sorpresa (prueba 9, 42, 3.14 o dividir entre cero...).
- **Teclado físico**: números, `+ - * /`, `Enter` (=), `Backspace`, `Esc` o `C` (limpiar), `%`.

## Desarrollo

```bash
npm install        # instalar dependencias
npm start          # ejecutar en modo desarrollo (Electron)
npm run icon       # regenerar todos los iconos (escritorio y móvil)
npm run pwa        # armar pwa-dist/ — solo los archivos de la versión web
npm run dist       # crear instalador de Windows (carpeta dist/)
```

`build-icon.js` dibuja el gato por código y genera tanto `icon.ico`/`icon.png` (escritorio) como
`icons/` (192, 512, maskable y apple-touch para móvil). No hay dependencias ni archivos fuente.

## Escritorio

`npm run dist` genera `dist/Catculator Setup 1.0.0.exe` — instalador NSIS con acceso directo en escritorio y menú inicio.

## PWA

Publicada con GitHub Pages desde la raíz de `main`: basta un `git push` y en ~1 minuto está arriba.
Todas las rutas son relativas, así que funciona igual en la subcarpeta `/Catculator/` que en la raíz
de un dominio.

> **Al cambiar el código, sube la versión del caché en `sw.js`** (`catculator-v1` → `v2`). Si no, los
> celulares que ya la tengan instalada seguirán sirviendo la versión vieja desde el caché.

Para publicarla en otro hosting (Netlify, etc.), `npm run pwa` deja en `pwa-dist/` solo lo necesario
(~77 KB). Nunca subas la carpeta del proyecto entera: lleva `node_modules` con Electron dentro.

## Android

Requiere **JDK 21** (Capacitor 8 compila con `source release 21`; con el 17 falla con
`invalid source release: 21`) y el SDK de Android con la plataforma 36. En esta máquina:

| | |
|---|---|
| `JAVA_HOME` | `%LOCALAPPDATA%\Java\jdk-21.0.11+10` |
| `ANDROID_HOME` | `%LOCALAPPDATA%\Android\Sdk` |

`capacitor.config.ts` apunta a `pwa-dist/` como `webDir`, así que **hay que correr `npm run pwa`
antes de cada `npx cap sync`** o Capacitor empaquetará una versión vieja.

```bash
npm run pwa                  # 1. armar los archivos web
npx cap sync android         # 2. copiarlos al proyecto Android
cd android && ./gradlew assembleDebug   # 3. APK de pruebas
```

El APK sale en `android/app/build/outputs/apk/debug/`. Para Play Store se necesita un AAB firmado
(`bundleRelease`) y una clave de firma propia.
