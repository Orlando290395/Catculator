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
  Menu.setApplicationMenu(null);
  win.loadFile('index.html');

  if (process.env.CATCULATOR_SHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (process.env.CATCULATOR_TEST) {
          const result = await win.webContents.executeJavaScript(process.env.CATCULATOR_TEST);
          console.log('TEST RESULT:', JSON.stringify(result));
          await new Promise(r => setTimeout(r, 600));
        }
        const img = await win.webContents.capturePage();
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
