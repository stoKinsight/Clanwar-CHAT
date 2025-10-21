// main.js - Version améliorée avec sécurité renforcée et meilleure expérience utilisateur
const { app, BrowserWindow, Tray, Menu, nativeImage, session, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const windowStateKeeper = require('electron-window-state');

// Configuration des logs
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let fenetrePrincipale = null;
let iconeBarreTaches = null;
let dernierCompteur = 0;
let estEnCoursDeQuitter = false;

// Verrou pour s'assurer qu'une seule instance de l'application est lancée
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    log.warn('Tentative de lancement d\'une seconde instance. L\'application va quitter.');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        log.info('Une seconde instance a été lancée, focus sur la fenêtre principale.');
        // Si l'utilisateur tente de lancer une nouvelle instance, on affiche l'existante
        if (fenetrePrincipale) {
            if (!fenetrePrincipale.isVisible()) {
                fenetrePrincipale.show();
            }
            if (fenetrePrincipale.isMinimized()) {
                fenetrePrincipale.restore();
            }
            fenetrePrincipale.focus();
        }
    });
}

// Fonction pour créer la fenêtre principale
function creerFenetre() {
    log.info('Création de la fenêtre principale');
    
    // Charge l'état précédent de la fenêtre
    let mainWindowState = windowStateKeeper({
        defaultWidth: 1200,
        defaultHeight: 800
    });
    
    fenetrePrincipale = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        minWidth: 800,
        minHeight: 600,
        show: false, // Important : la fenêtre est créée masquée
        skipTaskbar: true,
        icon: path.join(__dirname, 'icon.ico'),
        backgroundColor: '#1a1a1a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
        }
    });

    fenetrePrincipale.setMenu(null); // Supprime le menu supérieur
    
    // Gère automatiquement la sauvegarde de l'état
    mainWindowState.manage(fenetrePrincipale);

    // Charge le site web
    fenetrePrincipale.loadURL('https://clanwar.fr');

    // Affiche la fenêtre une fois prête (sauf si lancée au démarrage)
    fenetrePrincipale.once('ready-to-show', () => {
        log.info('Fenêtre prête à être affichée');
        log.debug('Arguments de la ligne de commande :', process.argv);

        // Vérifie si l'application a été lancée avec notre argument --autostart
        const aEteLanceEnAuto = process.argv.includes('--autostart');
        log.info(`Vérification démarrage : --autostart=${aEteLanceEnAuto}`);
        
        if (aEteLanceEnAuto) {
            log.info('Application lancée au démarrage (--autostart) : reste masquée.');
            // Ne rien faire, la fenêtre reste masquée (show: false)
        } else {
            log.info('Application lancée manuellement : affichage.');
            fenetrePrincipale.show();
            fenetrePrincipale.focus();
        }
    });

    // Gestion des erreurs de chargement
    fenetrePrincipale.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        log.error(`Échec du chargement : ${errorDescription} (${errorCode})`);
        
        // Charge la page d'erreur locale
        fenetrePrincipale.loadFile(path.join(__dirname, 'erreur.html'));
    });

    // Log quand la page est chargée avec succès
    fenetrePrincipale.webContents.on('did-finish-load', () => {
        log.info('Page chargée avec succès');
    });

    // Cache la fenêtre au lieu de quitter
    fenetrePrincipale.on('close', (event) => {
        if (!estEnCoursDeQuitter) {
            event.preventDefault();
            fenetrePrincipale.hide();
            log.info('Fenêtre masquée dans la zone de notification');
        }
    });

    // Gestion des notifications avec changement d'icône dynamique
    fenetrePrincipale.on('page-title-updated', (event, title) => {
        log.debug(`Titre de la page : ${title}`);
        
        const match = title.match(/\((\d+)\)/);

        if (match) {
            const count = parseInt(match[1], 10);
            
            // Change l'icône de la zone de notification avec le badge
            changerIconeAvecBadge(count);
            
            // Fait clignoter la fenêtre
            fenetrePrincipale.flashFrame(true);
            
            dernierCompteur = count;
        } else {
            // Pas de notifications - icône normale
            changerIconeAvecBadge(0);
            fenetrePrincipale.flashFrame(false);
            dernierCompteur = 0;
        }
    });
}

// Fonction pour obtenir le chemin de l'icône selon le compteur
function obtenirCheminIcone(count) {
    if (count === 0) {
        return path.join(__dirname, 'badges', 'icon-badge-0.png');
    } else if (count <= 9) {
        return path.join(__dirname, 'badges', `icon-badge-${count}.png`);
    } else {
        return path.join(__dirname, 'badges', 'icon-badge-9plus.png');
    }
}

// Fonction pour changer l'icône avec le badge approprié
function changerIconeAvecBadge(count) {
    if (!iconeBarreTaches) return;
    
    let iconePath = obtenirCheminIcone(count);
    let tooltipText;
    
    if (count === 0) {
        tooltipText = 'Clanwar Chat';
    } else if (count <= 9) {
        tooltipText = `Clanwar Chat - ${count} nouveau${count > 1 ? 'x' : ''} message${count > 1 ? 's' : ''}`;
    } else {
        tooltipText = `Clanwar Chat - ${count} nouveaux messages`;
    }
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(iconePath)) {
        log.error(`Icône manquante : ${iconePath}`);
        iconePath = path.join(__dirname, 'badges', 'icon-badge-0.png'); // Fallback
    }
    
    // Charge et applique la nouvelle icône
    const nouvelleIcone = nativeImage.createFromPath(iconePath);
    iconeBarreTaches.setImage(nouvelleIcone);
    iconeBarreTaches.setToolTip(tooltipText);
}

// Fonction pour créer l'icône dans la zone de notification
function creerIconeBarreTaches() {
    log.info('Création de l\'icône dans la zone de notification');
    
    // Démarre avec l'icône normale (sans badge)
    const iconePath = path.join(__dirname, 'badges', 'icon-badge-0.png');
    const icone = nativeImage.createFromPath(iconePath);
    iconeBarreTaches = new Tray(icone);

    const menuContextuel = Menu.buildFromTemplate([
        { 
            label: 'Ouvrir Clanwar Chat', 
            click: () => {
                fenetrePrincipale.show();
                fenetrePrincipale.focus();
                log.info('Fenêtre ouverte depuis le menu');
            }
        },
        { type: 'separator' },
        {
            label: 'Lancer au démarrage',
            type: 'checkbox',
            // Lit l'état actuel au démarrage
            checked: app.getLoginItemSettings().openAtLogin,
            click: (menuItem) => {
                // Cette fonction ne doit être utilisée que sur l'app 'buildée'
                if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
                    log.warn('Le lancement au démarrage est désactivé en mode développement.');
                    menuItem.checked = false; // Annule le clic
                    dialog.showMessageBox(fenetrePrincipale, {
                        type: 'warning',
                        title: 'Mode Développement',
                        // LIGNE CORRIGÉE : Apostrophe échappée
                        message: 'Cette option est uniquement disponible dans la version installée de l\'application.'
                    });
                    return;
                }
                
                // Applique le réglage
                app.setLoginItemSettings({
                    openAtLogin: menuItem.checked,
                    openAsHidden: true, // Gardé pour macOS
                    // CORRECTION : Ajoute l'argument --autostart si la case est cochée
                    args: menuItem.checked ? ['--autostart'] : []
                });
                log.info(`Lancement au démarrage défini sur : ${menuItem.checked}`);
            }
        },
        { 
            label: 'Réduire dans la zone de notification', 
            click: () => {
                fenetrePrincipale.hide();
                log.info('Fenêtre réduite depuis le menu');
            }
        },
        { 
            label: 'Vider le cache', 
            click: async () => {
                await session.defaultSession.clearCache();
                log.info('Cache vidé');
                dialog.showMessageBox(fenetrePrincipale, {
                    type: 'info',
                    title: 'Cache vidé',
                    message: 'Le cache a été vidé avec succès.'
                });
            }
        },
        { 
            label: 'Réinitialiser complètement et redémarrer', 
            click: async () => {
                await session.defaultSession.clearCache();
                await session.defaultSession.clearStorageData({
                    storages: ['cookies', 'localstorage', 'sessionstorage']
                });
                log.info('Données complètement effacées, redémarrage...');
                app.relaunch();
                app.quit();
            }
        },
        { type: 'separator' },
        { 
            label: 'Quitter', 
            click: () => {
                log.info('Fermeture de l\'application');
                estEnCoursDeQuitter = true;
                app.quit();
            }
        }
    ]);

    iconeBarreTaches.setToolTip('Clanwar Chat');
    iconeBarreTaches.setContextMenu(menuContextuel);

    // Clic gauche pour afficher/cacher
    iconeBarreTaches.on('click', () => {
        if (fenetrePrincipale.isVisible()) {
            fenetrePrincipale.hide();
            log.info('Fenêtre masquée (clic sur icône)');
        } else {
            fenetrePrincipale.show();
            fenetrePrincipale.focus();
            log.info('Fenêtre affichée (clic sur icône)');
        }
    });
    
    // Double-clic pour restaurer
    iconeBarreTaches.on('double-click', () => {
        fenetrePrincipale.show();
        fenetrePrincipale.focus();
        log.info('Fenêtre restaurée (double-clic)');
    });
}

// Gestion des certificats SSL
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(false);
    
    log.error(`Erreur de certificat pour ${url} : ${error}`);
    
    dialog.showMessageBox('Erreur de sécurité', 
        `Le certificat du site n'est pas valide.\nConnexion refusée pour votre sécurité.`);
});

// Démarrage de l'application
app.on('ready', () => {
    // Le code 'ready' ne s'exécute que si on a le verrou (première instance)
    log.info('Application démarrée');
    
    creerFenetre();
    creerIconeBarreTaches();
    
    // Raccourci clavier global Ctrl+Shift+C
    const ret = globalShortcut.register('CommandOrControl+Shift+C', () => {
        if (fenetrePrincipale.isVisible()) {
            fenetrePrincipale.hide();
            log.info('Fenêtre masquée (raccourci clavier)');
        } else {
            fenetrePrincipale.show();
            fenetrePrincipale.focus();
            log.info('Fenêtre affichée (raccourci clavier)');
        }
    });
    
    if (!ret) {
        log.error('Échec de l\'enregistrement du raccourci clavier');
    } else {
        log.info('Raccourci clavier Ctrl+Shift+C enregistré');
    }

    // Activer F5 et Ctrl+R uniquement en mode développement
    if (process.env.NODE_ENV === 'development') {
        globalShortcut.register('F5', () => {
            fenetrePrincipale.webContents.reload();
            log.info('Rechargement via F5');
        });
        globalShortcut.register('CommandOrControl+R', () => {
            fenetrePrincipale.webContents.reload();
            log.info('Rechargement via Ctrl+R');
        });
        log.info('Raccourcis de rechargement (F5, Ctrl+R) enregistrés pour le dev.');
        
        // Optionnel : ouvrir les outils de développement
        fenetrePrincipale.webContents.openDevTools();
    }
    
    // Vérifier les mises à jour
    autoUpdater.checkForUpdatesAndNotify();
});

// Gestion des mises à jour
autoUpdater.on('update-available', () => {
    log.info('Mise à jour disponible');
    dialog.showMessageBox(fenetrePrincipale, {
        type: 'info',
        title: 'Mise à jour disponible',
        message: 'Une nouvelle version est disponible. Elle sera téléchargée en arrière-plan.'
    });
});

autoUpdater.on('update-downloaded', () => {
    log.info('Mise à jour téléchargée');
    dialog.showMessageBox(fenetrePrincipale, {
        type: 'info',
        title: 'Mise à jour prête',
        message: 'La mise à jour sera installée au redémarrage.',
        buttons: ['Redémarrer maintenant', 'Plus tard']
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

// Empêche la fermeture complète
app.on('window-all-closed', () => {
    // Ne rien faire - l'icône de la zone de notification maintient l'app en vie
    log.info('Toutes les fenêtres fermées, mais l\'app reste active');
});

// Réactive l'app sur macOS
app.on('activate', () => {
    if (fenetrePrincipale === null) {
        creerFenetre();
    } else {
        fenetrePrincipale.show();
    }
});

// Quitte proprement
app.on('before-quit', () => {
    estEnCoursDeQuitter = true;
    log.info('Fermeture de l\'application');
});

// Libère les raccourcis clavier
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    log.info('Raccourcis clavier libérés');
});