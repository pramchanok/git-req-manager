!macro customInit
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\GitLab MR Manager"
!macroend

!macro customUnInstall
  RMDir /r "$LOCALAPPDATA\gitlab-req-manager-updater"
!macroend
