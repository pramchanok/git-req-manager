!macro customInit
  HideWindow
  nsExec::ExecToStack 'taskkill /F /IM "GitLab MR Manager.exe"'
!macroend

!macro customInstall
  Exec '"$INSTDIR\GitLab MR Manager.exe" --first-run'
!macroend

!macro customUnInstall
  RMDir /r "$LOCALAPPDATA\gitlab-req-manager-updater"
  RMDir /r "$APPDATA\GitLab MR Manager"
!macroend
