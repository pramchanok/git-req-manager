Add-Type -AssemblyName System.Drawing

$width = 400
$height = 300
$assetsDir = Join-Path $PSScriptRoot '..\assets'
$iconPath = Join-Path $assetsDir 'icon.png'

function New-RoundedRectanglePath {
    param([System.Drawing.RectangleF]$Rectangle, [float]$Radius)
    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

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

    # Stable fallback logo. The native AVI control covers this region when it
    # opens successfully, but the installer never shows an empty logo area.
    $centerX = 200
    $centerY = 92
    for ($layer = 3; $layer -ge 1; $layer--) {
        $radius = 29 + ($layer * 7)
        $alpha = 4 + ((4 - $layer) * 2)
        $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, 249, 115, 22))
        $graphics.FillEllipse($glowBrush, $centerX - $radius, $centerY - $radius, $radius * 2, $radius * 2)
        $glowBrush.Dispose()
    }
    $tilePath = New-RoundedRectanglePath ([System.Drawing.RectangleF]::new(172, 64, 56, 56)) 14
    $tileBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 30, 38, 49))
    $tilePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(48, 249, 115, 22), 1)
    $graphics.FillPath($tileBrush, $tilePath)
    $graphics.DrawPath($tilePen, $tilePath)
    $icon = [System.Drawing.Image]::FromFile($iconPath)
    $graphics.DrawImage($icon, 180, 72, 40, 40)

    $centerFormat = New-Object System.Drawing.StringFormat
    $centerFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $leftFormat = New-Object System.Drawing.StringFormat
    $leftFormat.Alignment = [System.Drawing.StringAlignment]::Near
    $rightFormat = New-Object System.Drawing.StringFormat
    $rightFormat.Alignment = [System.Drawing.StringAlignment]::Far

    $titleFont = New-Object System.Drawing.Font('Segoe UI Semibold', 14, [System.Drawing.FontStyle]::Bold)
    $statusFont = New-Object System.Drawing.Font('Segoe UI', 10)
    $microFont = New-Object System.Drawing.Font('Segoe UI Semibold', 7)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 237, 243))
    $statusBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(139, 148, 158))
    $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(251, 146, 60))

    $graphics.DrawString('GitLab MR Manager', $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(0, 154, 400, 28), $centerFormat)
    $graphics.DrawString('Preparing your review workspace', $statusFont, $statusBrush, [System.Drawing.RectangleF]::new(0, 184, 400, 22), $centerFormat)
    $graphics.DrawString('INSTALLING', $microFont, $accentBrush, [System.Drawing.RectangleF]::new(40, 222, 120, 12), $leftFormat)
    $graphics.DrawString('SECURE DESKTOP APP', $microFont, $statusBrush, [System.Drawing.RectangleF]::new(240, 222, 120, 12), $rightFormat)

    # The native NSIS progress bar is placed at y=240 over this bitmap.
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(48, 54, 61), 1)
    $graphics.DrawRectangle($borderPen, 0, 0, 399, 299)

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

    $backgroundBrush.Dispose()
    $icon.Dispose()
    $tilePath.Dispose()
    $tileBrush.Dispose()
    $tilePen.Dispose()
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

Write-Host "Created $outputPath (400x300)"
