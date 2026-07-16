Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap(320, 200)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'

# Background: slate-900 #111827
$g.Clear([System.Drawing.Color]::FromArgb(17, 24, 39))

# Icon: 64x64, centered at y=32
$icon = [System.Drawing.Image]::FromFile("$PSScriptRoot\..\assets\icon.png")
$g.DrawImage($icon, 128, 32, 64, 64)
$icon.Dispose()

# Title: "GitLab MR Manager" - white, Segoe UI Semibold 12pt
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$titleFont = New-Object System.Drawing.Font("Segoe UI Semibold", 12, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(249, 250, 251))
$g.DrawString("GitLab MR Manager", $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(0, 108, 320, 24), $sf)

# Status: "Installing..." - slate-400, Segoe UI 9pt
$statusFont = New-Object System.Drawing.Font("Segoe UI", 9)
$statusBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(156, 163, 175))
$g.DrawString("Installing...", $statusFont, $statusBrush, [System.Drawing.RectangleF]::new(0, 134, 320, 20), $sf)

# Subtle border: slate-700 #374151
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(55, 65, 81))
$g.DrawRectangle($borderPen, 0, 0, 319, 199)

# Save as BMP
$outPath = "$PSScriptRoot\..\assets\splash.bmp"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

$g.Dispose()
$bmp.Dispose()
$titleFont.Dispose()
$titleBrush.Dispose()
$statusFont.Dispose()
$statusBrush.Dispose()
$borderPen.Dispose()
$sf.Dispose()

Write-Host "Created $outPath with baked text (320x200)"
