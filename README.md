# Catculator 🐱🧮

La calculadora con temática de gatos. App de escritorio para Windows hecha con Electron.

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
npm start          # ejecutar en modo desarrollo
npm run icon       # regenerar icon.png / icon.ico
npm run dist       # crear instalador de Windows (carpeta dist/)
```

## Instalador

`npm run dist` genera `dist/Catculator Setup 1.0.0.exe` — instalador NSIS con acceso directo en escritorio y menú inicio.
