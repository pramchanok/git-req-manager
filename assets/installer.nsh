SilentInstall silent
!macro customInit
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\GitLab MR Manager"
!macroend

!macro customUnInstall
  RMDir /r "$LOCALAPPDATA\gitlab-req-manager-updater"
!macroend

!macro customInstall
  Exec '"$INSTDIR\GitLab MR Manager.exe" --first-run'
!macroend
