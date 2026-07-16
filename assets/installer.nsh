SilentInstall silent
!macro customInit
  nsExec::ExecToStack 'taskkill /F /IM "GitLab MR Manager.exe"'
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\GitLab MR Manager"
!macroend

!macro customUnInstall
  RMDir /r "$LOCALAPPDATA\gitlab-req-manager-updater"
!macroend

!macro customInstall
  Exec '"$INSTDIR\GitLab MR Manager.exe" --first-run'
!macroend
