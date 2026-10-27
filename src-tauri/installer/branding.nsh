; Appearance only. Tauri retains all pages, callbacks, install/update/uninstall
; sections, passive-mode behavior and WebView2 handling. No custom template.
!define MUI_BGCOLOR "EDE7D9"
!define MUI_TEXTCOLOR "17121C"
!define MUI_INSTFILESPAGE_COLORS "EDE7D9 17121C"
!define MUI_CUSTOMFUNCTION_GUIINIT SonarielBrandingInit
!define MUI_CUSTOMFUNCTION_UNGUIINIT un.SonarielBrandingInit

!macro SonarielBrandingInitBody
  ; Keep standard Windows controls and fonts; no global font installation,
  ; owner-drawn controls, timers, registry writes or filesystem operations.
  SetCtlColors $HWNDPARENT "17121C" "EDE7D9"
  ; MUI's footer text remains a standard control. Its background/etched frame
  ; and all other controls keep their native behavior.
  GetDlgItem $0 $HWNDPARENT 1256 ; MUI branding text
  SetCtlColors $0 "17121C" "EDE7D9"
!macroend

Function SonarielBrandingInit
  Push $0
  !insertmacro SonarielBrandingInitBody
  Pop $0
FunctionEnd

Function un.SonarielBrandingInit
  Push $0
  !insertmacro SonarielBrandingInitBody
  Pop $0
FunctionEnd
