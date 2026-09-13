const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, dialog, shell, nativeImage } = require('electron');
const { startServer } = require('./server');

// Must run before the app is ready, otherwise userData is already resolved.
// package.json has no productName, which would otherwise give lowercase "remotec".
app.setName('RemoteC');

let mainWindow = null;
let serverInfo = null;
let configPath = null;

const BUNDLED_CONFIG = path.join(__dirname, 'config.json');
const EXAMPLE_CONFIG = path.join(__dirname, 'config.example.json');
const ICON_PATH = path.join(__dirname, 'build', 'icon.png');

// __dirname points inside app.asar in a packaged build and is read-only, so all
// mutable state (pairing key, edited config) lives in userData instead.
function resolveDataDir() {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveConfigPath(dataDir) {
  const target = path.join(dataDir, 'config.json');
  if (fs.existsSync(target)) return target;
  const seed = [BUNDLED_CONFIG, EXAMPLE_CONFIG].find((f) => fs.existsSync(f));
  if (seed) fs.copyFileSync(seed, target);
  return target;
}

function buildMenu(url) {
  const template = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Remote',
      submenu: [
        {
          label: 'Open in browser',
          click: () => url && shell.openExternal(url),
        },
        {
          label: 'Reveal config.json',
          click: () => configPath && shell.showItemInFolder(configPath),
        },
        {
          label: 'Reveal data folder',
          click: () => shell.openPath(app.getPath('userData')),
        },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 940,
    minWidth: 340,
    minHeight: 620,
    title: 'RemoteC',
    backgroundColor: '#0b0d10',
    titleBarStyle: 'hiddenInset',
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(url);
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function boot() {
  try {
    if (process.platform === 'darwin' && app.dock && fs.existsSync(ICON_PATH)) {
      app.dock.setIcon(nativeImage.createFromPath(ICON_PATH));
    }
    const dataDir = resolveDataDir();
    configPath = resolveConfigPath(dataDir);
    if (!fs.existsSync(configPath)) {
      dialog.showErrorBox(
        'Missing config.json',
        `Create ${configPath} with { "tvIp": "...", "tvMac": "..." } and relaunch.`
      );
      app.quit();
      return;
    }
    serverInfo = await startServer({ configPath, dataDir });
    buildMenu(serverInfo.url);
    createWindow(serverInfo.url);
  } catch (err) {
    dialog.showErrorBox('RemoteC failed to start', err.message);
    app.quit();
  }
}

app.whenReady().then(boot);

app.on('activate', () => {
  if (mainWindow === null && serverInfo) createWindow(serverInfo.url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverInfo && serverInfo.server) serverInfo.server.close();
});
