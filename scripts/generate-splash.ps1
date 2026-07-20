Add-Type -AssemblyName System.Drawing

$width = 320
$height = 200
$assetsDir = Join-Path $PSScriptRoot '..\assets'

function New-SplashImage {
    param(
        [string]$OutputPath
    )

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # App theme: GitHub-like #0d1117 with a subtle #161b22 vertical lift.
    $backgroundRect = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
    $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $backgroundRect,
        [System.Drawing.Color]::FromArgb(13, 17, 23),
        [System.Drawing.Color]::FromArgb(22, 27, 34),
        90
    )
    $graphics.FillRectangle($backgroundBrush, $backgroundRect)

    # The 80x80 logo area at (120, 16) is supplied by installer-logo.avi.

    $centerFormat = New-Object System.Drawing.StringFormat
    $centerFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $leftFormat = New-Object System.Drawing.StringFormat
    $leftFormat.Alignment = [System.Drawing.StringAlignment]::Near
    $rightFormat = New-Object System.Drawing.StringFormat
    $rightFormat.Alignment = [System.Drawing.StringAlignment]::Far

    $titleFont = New-Object System.Drawing.Font('Segoe UI Semibold', 12, [System.Drawing.FontStyle]::Bold)
    $statusFont = New-Object System.Drawing.Font('Segoe UI', 9)
    $microFont = New-Object System.Drawing.Font('Segoe UI Semibold', 7)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 237, 243))
    $statusBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(139, 148, 158))
    $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(251, 146, 60))

    $graphics.DrawString('GitLab MR Manager', $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(0, 96, 320, 24), $centerFormat)
    $graphics.DrawString('Preparing your review workspace', $statusFont, $statusBrush, [System.Drawing.RectangleF]::new(0, 121, 320, 20), $centerFormat)
    $graphics.DrawString('INSTALLING', $microFont, $accentBrush, [System.Drawing.RectangleF]::new(32, 147, 100, 12), $leftFormat)
    $graphics.DrawString('SECURE DESKTOP APP', $microFont, $statusBrush, [System.Drawing.RectangleF]::new(158, 147, 130, 12), $rightFormat)

    # The native NSIS progress bar is placed at y=163 over this bitmap.
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(48, 54, 61), 1)
    $graphics.DrawRectangle($borderPen, 0, 0, 319, 199)

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

    $backgroundBrush.Dispose()
    $borderPen.Dispose()
    $titleFont.Dispose()
    $statusFont.Dispose()
    $microFont.Dispose()
    $titleBrush.Dispose()
    $statusBrush.Dispose()
    $accentBrush.Dispose()
    $centerFormat.Dispose()
    $leftFormat.Dispose()
    $rightFormat.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$outputPath = Join-Path $assetsDir 'splash.bmp'
New-SplashImage -OutputPath $outputPath

Write-Host "Created $outputPath (320x200)"
