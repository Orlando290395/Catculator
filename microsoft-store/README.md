# Catculator en Microsoft Store

Todo lo específico de la tienda de Microsoft vive en esta carpeta. El flujo de
Play Store (android/, PLAYSTORE.md) y el instalador normal de Windows
(`npm run dist`) no se tocan.

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `electron-builder.yml` | Configuración del paquete `.appx` que exige la tienda |
| `build-iconos.js` | Genera los logos del paquete con el mismo gato de siempre |
| `build/appx/` | Logos generados (no se versionan) |
| `dist/` | Salida del empaquetado: `Catculator 1.0.0.appx` (no se versiona) |

## Camino completo (una sola vez)

1. **Cuenta de desarrollador — gratis.** Entrar EXACTAMENTE por
   https://storedeveloper.microsoft.com ("Get started for free" →
   "Individual developer"). Por otras rutas cobra 19 USD.
   Piden verificar identidad con cédula y selfie desde el celular.
2. **Reservar el nombre.** En Partner Center: Apps and games → New product →
   MSIX or PWA app → reservar "Catculator".
3. **Copiar la identidad.** Product management → Product identity: ahí están
   `Package/Identity/Name`, `Package/Identity/Publisher` y
   `PublisherDisplayName`. Pegarlos en los tres RELLENAR de
   `electron-builder.yml`.
4. **Generar el paquete.**
   ```
   npm run icon:store   (solo la primera vez o si cambia el gato)
   npm run dist:store
   ```
   Sale en `microsoft-store/dist/Catculator 1.0.0.appx`. NO se firma aquí:
   la tienda lo firma sola al certificarlo.
5. **Crear la sumisión.** En Partner Center: Packages → arrastrar el `.appx`;
   llenar precio (o gratis), clasificación de edad, descripción y capturas
   (mínimo 1366×768 para escritorio; NO sirven las de celular de tienda/).
   La política de privacidad es la misma de siempre:
   https://orlando290395.github.io/Catculator/privacidad.html
6. **Enviar a certificación.** Suele tardar 2-3 días. Aprobada, la app queda en
   la tienda con URL microsoft.com/store/apps/<ID>.

## Actualizaciones después de publicada

Subir `version` en package.json (p. ej. 1.0.1), regenerar con
`npm run dist:store` y subir el nuevo `.appx` en Partner Center → Update.
La tienda exige que la versión siempre crezca.
