const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 440,
    height: 820,
    minWidth: 380,
    minHeight: 680,
    backgroundColor: '#c7f4fb',
    title: 'Catculator',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  /* El menú se ESCONDE, pero no se elimina.

     Antes había un setApplicationMenu(null) y eso rompía Ctrl+V sin que se
     notara: en Electron los atajos de portapapeles no los sirve Chromium por su
     cuenta fuera de un campo de texto, los sirve el menú de la aplicación. Sin
     menú no hay acelerador, sin acelerador no llega ningún evento 'paste' a la
     página, y el escuchador de renderer.js nunca se enteraba. Copiar seguía
     yendo porque eso lo hace la propia app al tocar la pantalla.

     El rol 'paste' llama a webContents.paste(), que sí dispara el evento de
     verdad. Y los aceleradores siguen vivos con la barra oculta, así que la
     ventana se ve exactamente igual de limpia que antes. */
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Editar',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ]));
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');

  /* Gancho de desarrollo para capturas y pruebas. Va detrás de isPackaged a
     propósito: CATCULATOR_TEST se evalúa como código en la página, y eso no
     tiene por qué viajar dentro del .appx que se vende en la tienda. */
  if (!app.isPackaged && process.env.CATCULATOR_SHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (process.env.CATCULATOR_TEST) {
          const result = await win.webContents.executeJavaScript(process.env.CATCULATOR_TEST);
          console.log('TEST RESULT:', JSON.stringify(result));
          await new Promise(r => setTimeout(r, 600));
        }
        // Si la ventana quedó tapada no se pinta y la captura sale vacía:
        // traerla al frente y reintentar hasta que haya píxeles.
        win.show();
        win.moveTop();
        let img = await win.webContents.capturePage();
        for (let i = 0; i < 4 && img.isEmpty(); i++) {
          await new Promise(r => setTimeout(r, 500));
          img = await win.webContents.capturePage();
        }
        require('fs').writeFileSync(process.env.CATCULATOR_SHOT, img.toPNG());
        app.quit();
      }, 1800);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
