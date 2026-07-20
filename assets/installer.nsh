!ifndef BUILD_UNINSTALLER

Var SplashControl
Var SplashFrame
Var SplashBitmap
Var SplashTimerCallback

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

  ; 6. Repurpose control 1006 as an animated BMP splash image.
  ; Text + icon are baked into every frame so dialog repaints cannot cover them.
  GetDlgItem $1 $0 1006
  ; Change style to SS_BITMAP
  System::Call 'user32::GetWindowLong(i $1, i -16) i.r2'
  IntOp $2 $2 & 0xFFFFFF00
  IntOp $2 $2 | 0x0E ; SS_BITMAP
  System::Call 'user32::SetWindowLong(i $1, i -16, i $2)'
  ; Position full size, BOTTOM of Z-order
  System::Call 'user32::SetWindowPos(i $1, i 1, i 0, i 0, i 320, i 200, i 0x0040)'
  ShowWindow $1 1
  ; Extract all animation frames once. The timer swaps bitmaps on this existing
  ; dialog control, so the image survives InstFiles page repaints.
  InitPluginsDir
  File "/oname=$PLUGINSDIR\splash-frame-0.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-0.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-1.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-1.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-2.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-2.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-3.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-3.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-4.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-4.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-5.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-5.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-6.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-6.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-7.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-7.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-8.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-8.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-9.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-9.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-10.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-10.bmp"
  File "/oname=$PLUGINSDIR\splash-frame-11.bmp" "${BUILD_RESOURCES_DIR}\splash-frame-11.bmp"

  StrCpy $SplashControl $1
  StrCpy $SplashFrame 0
  System::Call 'user32::LoadImage(i 0, t "$PLUGINSDIR\splash-frame-0.bmp", i 0, i 320, i 200, i 0x0010) i.r2'
  StrCpy $SplashBitmap $2
  SendMessage $SplashControl 0x0172 0 $SplashBitmap

  ; 12 frames at ~12.5 FPS: visible motion without making the installer busy.
  ; Resolve the callback address explicitly so makensis retains the function.
  GetFunctionAddress $SplashTimerCallback AnimateSplash
  nsDialogs::CreateTimer $SplashTimerCallback 80

  ; 7. Style and position the Progress Bar (1004)
  GetDlgItem $3 $0 1004
  ; Position: centered x=32, y=163, w=256 (80%), h=6, TOP of Z-order
  System::Call 'user32::SetWindowPos(i $3, i 0, i 32, i 163, i 256, i 6, i 0x0040)'
  ShowWindow $3 1

  ; Remove Windows visual theme for flat look
  System::Call 'uxtheme::SetWindowTheme(i $3, t " ", t " ")'

  ; PBM_SETBKCOLOR: track = slate-700 #374151 -> BGR 0x514137
  SendMessage $3 0x2001 0 0x514137

  ; PBM_SETBARCOLOR: fill = orange-500 #F97316 -> BGR 0x1673F9
  SendMessage $3 0x0409 0 0x1673F9
FunctionEnd

Function AnimateSplash
  IntOp $SplashFrame $SplashFrame + 1
  IntCmp $SplashFrame 12 0 +2 +2
  StrCpy $SplashFrame 0

  System::Call 'user32::LoadImage(i 0, t "$PLUGINSDIR\splash-frame-$SplashFrame.bmp", i 0, i 320, i 200, i 0x0010) i.r0'
  StrCmp $0 0 animation_done

  ; STM_SETIMAGE returns the previous HBITMAP. Delete it after the control has
  ; accepted the new frame to prevent leaking GDI handles during long installs.
  SendMessage $SplashControl 0x0172 0 $0 $1
  StrCpy $SplashBitmap $0
  StrCmp $1 0 animation_done
  System::Call 'gdi32::DeleteObject(i $1)'

animation_done:
FunctionEnd

Function onInstFilesLeave
  nsDialogs::KillTimer $SplashTimerCallback
  StrCmp $SplashBitmap 0 +2
  System::Call 'gdi32::DeleteObject(i $SplashBitmap)'
  StrCpy $SplashBitmap 0

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
