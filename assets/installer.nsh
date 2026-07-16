!ifndef BUILD_UNINSTALLER

!macro customInstallMode
  ; Skip the "Choose Installation Options" page completely
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW onInstFilesShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE onInstFilesLeave
!macroend

Function onInstFilesShow
  ; 1. Auto close when finished
  SetAutoClose true

  ; 2. Remove borders and title bar (Frameless)
  System::Call 'user32::GetWindowLong(i $HWNDPARENT, i -16) i.r0'
  IntOp $0 $0 & 0xFF3BFFFF ; Remove WS_CAPTION and WS_THICKFRAME
  System::Call 'user32::SetWindowLong(i $HWNDPARENT, i -16, i $0)'

  ; 3. Center and resize main window to 320x200
  System::Call 'user32::GetSystemMetrics(i 0) i .r1'
  System::Call 'user32::GetSystemMetrics(i 1) i .r2'
  IntOp $3 $1 - 320
  IntOp $3 $3 / 2
  IntOp $4 $2 - 200
  IntOp $4 $4 / 2
  System::Call 'user32::SetWindowPos(i $HWNDPARENT, i 0, i $3, i $4, i 320, i 200, i 0x0040)'
  SetCtlColors $HWNDPARENT "" 0x111827

  ; 4. Hide ALL buttons and controls on parent window
  GetDlgItem $1 $HWNDPARENT 1
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 2
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 3
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1034
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1035
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1036
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1037
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1038
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1039
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1045
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1256
  ShowWindow $1 0

  ; 5. Setup Inner Dialog
  FindWindow $0 "#32770" "" $HWNDPARENT
  System::Call 'user32::SetWindowPos(i $0, i 0, i 0, i 0, i 320, i 200, i 0x0040)'
  SetCtlColors $0 "" 0x111827

  ; Hide file list and text controls
  GetDlgItem $1 $0 1016
  ShowWindow $1 0

  ; 6. Repurpose control 1006 as BMP splash image
  ; (Text + icon are ALL baked into the BMP - no separate text controls needed)
  GetDlgItem $1 $0 1006
  ; Change style to SS_BITMAP
  System::Call 'user32::GetWindowLong(i $1, i -16) i.r2'
  IntOp $2 $2 & 0xFFFFFF00
  IntOp $2 $2 | 0x0E ; SS_BITMAP
  System::Call 'user32::SetWindowLong(i $1, i -16, i $2)'
  ; Position full size, BOTTOM of Z-order
  System::Call 'user32::SetWindowPos(i $1, i 1, i 0, i 0, i 320, i 200, i 0x0040)'
  ShowWindow $1 1
  ; Load BMP
  InitPluginsDir
  File "/oname=$PLUGINSDIR\splash.bmp" "${BUILD_RESOURCES_DIR}\splash.bmp"
  System::Call 'user32::LoadImage(i 0, t "$PLUGINSDIR\splash.bmp", i 0, i 320, i 200, i 0x0010) i.r2'
  SendMessage $1 0x0172 0 $2

  ; 7. Style and position the Progress Bar (1004)
  GetDlgItem $3 $0 1004
  ; Position: centered x=32, y=162, w=256 (80%), h=8, TOP of Z-order
  System::Call 'user32::SetWindowPos(i $3, i 0, i 32, i 162, i 256, i 8, i 0x0040)'
  ShowWindow $3 1

  ; Remove Windows visual theme for flat look
  System::Call 'uxtheme::SetWindowTheme(i $3, t " ", t " ")'

  ; PBM_SETBKCOLOR: track = slate-700 #374151 -> BGR 0x514137
  SendMessage $3 0x2001 0 0x514137

  ; PBM_SETBARCOLOR: fill = orange-500 #F97316 -> BGR 0x1673F9
  SendMessage $3 0x0409 0 0x1673F9
FunctionEnd

Function onInstFilesLeave
  ; Launch app normally
  Exec '"$INSTDIR\GitLab MR Manager.exe"'
  Quit
FunctionEnd

!endif ; BUILD_UNINSTALLER

!macro customInstall
  CreateDirectory "$SMPROGRAMS\GitLab MR Manager"
  CreateShortCut "$SMPROGRAMS\GitLab MR Manager\GitLab MR Manager.lnk" "$INSTDIR\GitLab MR Manager.exe"
  CreateShortCut "$DESKTOP\GitLab MR Manager.lnk" "$INSTDIR\GitLab MR Manager.exe"
!macroend

!macro customUnInstall
  RMDir /r "$LOCALAPPDATA\gitlab-req-manager-updater"
  RMDir /r "$APPDATA\GitLab MR Manager"
!macroend
