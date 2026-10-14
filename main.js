const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Izinkan video langsung diputar tanpa interaksi pengguna
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 900,
    minHeight: 600,
    fullscreen: true,          // Fullscreen secara default
    autoHideMenuBar: true,
    backgroundColor: '#fff6d6',
    title: 'Video Ceria',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));

  // F11 = masuk/keluar fullscreen. Cegah reload & DevTools lewat keyboard.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const k = input.key.toLowerCase();
    if (k === 'f11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (k === 'f5' || k === 'f12' || ((input.control || input.meta) && (k === 'r' || (input.shift && k === 'i')))) {
      event.preventDefault();
    }
  });

  // Jangan pernah berpindah halaman (mis. saat file di-drop di luar area)
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
