const { app, BrowserWindow, Tray, Menu, nativeImage, session, dialog, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const windowStateKeeper = require('electron-window-state');

// Identité unique de l'application
app.setAppUserModelId("fr.clanwar.chat");

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let fenetrePrincipale = null;
let iconeBarreTaches = null;
let dernierCompteur = -1; 
let estEnCoursDeQuitter = false;
let premierLancement = false; // Variable pour forcer l'affichage de la coche au 1er démarrage

// Empêcher les instances multiples
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (fenetrePrincipale) {
            if (!fenetrePrincipale.isVisible()) fenetrePrincipale.show();
            if (fenetrePrincipale.isMinimized()) fenetrePrincipale.restore();
            fenetrePrincipale.focus();
        }
    });
}

function obtenirCheminIcone(count) {
    let nomImage = count === 0 ? 'icon-badge-0.png' : (count > 9 ? 'icon-badge-9plus.png' : `icon-badge-${count}.png`);
    let cheminComplet = path.join(__dirname, 'badges', nomImage);
    if (!fs.existsSync(cheminComplet)) return path.join(__dirname, 'icon.ico');
    return cheminComplet;
}

function creerFenetre() {
    let mainWindowState = windowStateKeeper({ defaultWidth: 1200, defaultHeight: 800 });
    fenetrePrincipale = new BrowserWindow({
        x: mainWindowState.x, y: mainWindowState.y,
        width: mainWindowState.width, height: mainWindowState.height,
        minWidth: 800, minHeight: 600,
        show: false, skipTaskbar: true,
        icon: path.join(__dirname, 'icon.ico'),
        backgroundColor: '#1a1a1a',
        webPreferences: {
            nodeIntegration: false, contextIsolation: true,
            sandbox: true, webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    fenetrePrincipale.setMenu(null);
    mainWindowState.manage(fenetrePrincipale);
    fenetrePrincipale.loadURL('https://clanwar.fr');

    fenetrePrincipale.once('ready-to-show', () => {
        if (process.argv.includes('--autostart')) {
            log.info('Lancement auto détecté : masqué.');
        } else {
            fenetrePrincipale.show();
            fenetrePrincipale.focus();
        }
    });

    fenetrePrincipale.on('close', (e) => {
        if (!estEnCoursDeQuitter) { e.preventDefault(); fenetrePrincipale.hide(); }
    });

    fenetrePrincipale.on('page-title-updated', (event, title) => {
        const match = title.match(/\((\d+)\)/);
        const count = match ? parseInt(match[1], 10) : 0;
        if (count !== dernierCompteur) {
            const iconePath = obtenirCheminIcone(count);
            if (iconeBarreTaches) {
                iconeBarreTaches.setImage(nativeImage.createFromPath(iconePath));
                iconeBarreTaches.setToolTip(count > 0 ? `Clanwar Chat - ${count} message(s)` : 'Clanwar Chat');
            }
            if (count > 0 && count > dernierCompteur) {
                fenetrePrincipale.flashFrame(true);
            } else {
                fenetrePrincipale.flashFrame(false);
            }
            dernierCompteur = count;
        }
    });
}

function actualiserMenu() {
    const argsAuto = ['--autostart'];
    const settings = app.getLoginItemSettings({ path: process.execPath, args: argsAuto });
    const version = app.getVersion();
    
    // Si c'est le 1er lancement, on force la coche à true, sinon on lit Windows
    const etatCoche = premierLancement ? true : settings.openAtLogin;

    const menuContextuel = Menu.buildFromTemplate([
        { label: '“Win + .” emojis chat', enabled: false },
        { type: 'separator' },
        {
            label: 'Lancer au démarrage',
            type: 'checkbox',
            checked: etatCoche,
            click: (menuItem) => {
                premierLancement = false; // Dès qu'on clique, on repasse en mode normal
                app.setLoginItemSettings({
                    openAtLogin: menuItem.checked,
                    path: process.execPath,
                    args: menuItem.checked ? argsAuto : []
                });
                actualiserMenu();
            }
        },
        { 
            label: 'Réinitialiser et redémarrer', 
            click: async () => { 
                await session.defaultSession.clearCache(); 
                await session.defaultSession.clearStorageData({ storages: ['cookies', 'localstorage', 'sessionstorage'] });
                app.relaunch(); app.quit(); 
            }
        },
        { type: 'separator' },
        { label: `Quitter (v${version}) par stoK 🇫🇷`, click: () => { estEnCoursDeQuitter = true; app.quit(); } }
    ]);
    if (iconeBarreTaches) iconeBarreTaches.setContextMenu(menuContextuel);
}

// MISE À JOUR AUTOMATIQUE
autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'question', title: 'Mise à jour prête',
        message: 'L\'installation va fermer le logiciel. Installer maintenant ?',
        buttons: ['Oui', 'Plus tard']
    }).then((r) => { 
        if (r.response === 0) {
            estEnCoursDeQuitter = true; 
            autoUpdater.quitAndInstall(false, true);
            if (fenetrePrincipale) fenetrePrincipale.destroy();
            process.nextTick(() => { app.quit(); });
        }
    });
});

app.on('ready', () => {
    const setupFile = path.join(app.getPath('userData'), '.setup_v220_final');
    
    // Premier lancement : on inscrit l'app au démarrage
    if (!fs.existsSync(setupFile)) {
        premierLancement = true; 
        app.setLoginItemSettings({ 
            openAtLogin: true, 
            path: process.execPath,
            args: ['--autostart']
        });
        fs.writeFileSync(setupFile, 'done');
    }

    creerFenetre();
    iconeBarreTaches = new Tray(nativeImage.createFromPath(obtenirCheminIcone(0)));
    iconeBarreTaches.on('click', () => {
        fenetrePrincipale.isVisible() ? fenetrePrincipale.hide() : fenetrePrincipale.show();
    });

    actualiserMenu();

    globalShortcut.register('CommandOrControl+Shift+C', () => {
        if (fenetrePrincipale) fenetrePrincipale.isVisible() ? fenetrePrincipale.hide() : fenetrePrincipale.show();
    });
    autoUpdater.checkForUpdatesAndNotify();
});

app.on('before-quit', () => {
    estEnCoursDeQuitter = true;
    if (iconeBarreTaches) iconeBarreTaches.destroy();
});