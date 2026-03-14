!macro customInit
  ; 1. Fermer Clanwar Chat s'il tourne encore
  nsExec::ExecToStack 'taskkill /F /IM "Clanwar Chat.exe" /T'

  ; 2. Supprimer l'ancien répertoire de données (APPDATA) 
  ; Cela force la réinitialisation du fichier setup pour la v2.2.0
  RMDir /r "$APPDATA\clanwar-chat"

  ; 3. Désinstaller l'ancienne version si elle existe pour éviter les doublons
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\fr.clanwar.chat" "UninstallString"
  StrCmp $0 "" done
  
  DetailPrint "Désinstallation de l'ancienne version..."
  ExecWait '$0 /S _?=$INSTDIR' ; Désinstalle en mode silencieux
  
  done:
!macroend