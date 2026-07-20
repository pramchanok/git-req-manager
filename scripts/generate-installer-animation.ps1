Add-Type -AssemblyName System.Drawing

$size = 80
$fps = 15
$frameCount = 30
$assetsDir = Join-Path $PSScriptRoot '..\assets'
$iconPath = Join-Path $assetsDir 'icon.png'
$outputPath = Join-Path $assetsDir 'installer-logo.avi'

function Write-FourCC([System.IO.BinaryWriter]$Writer, [string]$Value) {
    $Writer.Write([Text.Encoding]::ASCII.GetBytes($Value))
}

function Start-Chunk([System.IO.BinaryWriter]$Writer, [string]$Id) {
    Write-FourCC $Writer $Id
    $sizePosition = $Writer.BaseStream.Position
    $Writer.Write([uint32]0)
    return $sizePosition
}

function End-Chunk([System.IO.BinaryWriter]$Writer, [long]$SizePosition) {
    $end = $Writer.BaseStream.Position
    $size = $end - $SizePosition - 4
    $Writer.BaseStream.Position = $SizePosition
    $Writer.Write([uint32]$size)
    $Writer.BaseStream.Position = $end
    if (($size % 2) -ne 0) { $Writer.Write([byte]0) }
}

function New-RoundedRectanglePath([System.Drawing.RectangleF]$Rectangle, [float]$Radius) {
    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-AnimationFrame([int]$Index, [System.Drawing.Image]$Icon) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Match the splash gradient beneath the animation control (global y 16..95).
    for ($y = 0; $y -lt $size; $y++) {
        $t = ($y + 16) / 199.0
        $r = [int](13 + ((22 - 13) * $t))
        $g = [int](17 + ((27 - 17) * $t))
        $b = [int](23 + ((34 - 23) * $t))
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($r, $g, $b))
        $graphics.DrawLine($pen, 0, $y, $size, $y)
        $pen.Dispose()
    }

    $phase = (2 * [Math]::PI * $Index) / $frameCount
    $pulse = (1 + [Math]::Sin($phase)) / 2
    for ($layer = 3; $layer -ge 1; $layer--) {
        $radius = 21 + ($layer * 5) + (3 * $pulse)
        $alpha = [int](8 + ((4 - $layer) * 5) + (10 * $pulse))
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, 249, 115, 22))
        $graphics.FillEllipse($brush, 40 - $radius, 40 - $radius, $radius * 2, $radius * 2)
        $brush.Dispose()
    }

    $tilePath = New-RoundedRectanglePath ([System.Drawing.RectangleF]::new(12, 12, 56, 56)) 14
    $tileBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 30, 38, 49))
    $tilePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 249, 115, 22), 1)
    $graphics.FillPath($tileBrush, $tilePath)
    $graphics.DrawPath($tilePen, $tilePath)
    $graphics.DrawImage($Icon, 20, 20, 40, 40)

    $angle = $phase * 2
    $dotX = 40 + (34 * [Math]::Cos($angle))
    $dotY = 40 + (34 * [Math]::Sin($angle))
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 251, 146, 60))
    $graphics.FillEllipse($dotBrush, $dotX - 1.5, $dotY - 1.5, 3, 3)

    $dotBrush.Dispose(); $tilePath.Dispose(); $tileBrush.Dispose(); $tilePen.Dispose(); $graphics.Dispose()
    return $bitmap
}

function Get-DibBytes([System.Drawing.Bitmap]$Bitmap) {
    $rowSize = (($size * 3 + 3) -band -4)
    $bytes = New-Object byte[] ($rowSize * $size)
    for ($y = 0; $y -lt $size; $y++) {
        $sourceY = $size - 1 - $y
        for ($x = 0; $x -lt $size; $x++) {
            $color = $Bitmap.GetPixel($x, $sourceY)
            $offset = ($y * $rowSize) + ($x * 3)
            $bytes[$offset] = $color.B
            $bytes[$offset + 1] = $color.G
            $bytes[$offset + 2] = $color.R
        }
    }
    return $bytes
}

$icon = [System.Drawing.Image]::FromFile($iconPath)
$frames = New-Object System.Collections.Generic.List[byte[]]
for ($i = 0; $i -lt $frameCount; $i++) {
    $frame = New-AnimationFrame $i $icon
    $frames.Add((Get-DibBytes $frame))
    $frame.Dispose()
}
$icon.Dispose()

$stream = [System.IO.File]::Create($outputPath)
$writer = New-Object System.IO.BinaryWriter($stream)
$riff = Start-Chunk $writer 'RIFF'; Write-FourCC $writer 'AVI '
$hdrl = Start-Chunk $writer 'LIST'; Write-FourCC $writer 'hdrl'
$avih = Start-Chunk $writer 'avih'
$writer.Write([uint32](1000000 / $fps)); $writer.Write([uint32]($frames[0].Length * $fps)); $writer.Write([uint32]0); $writer.Write([uint32]0x10)
$writer.Write([uint32]$frameCount); $writer.Write([uint32]0); $writer.Write([uint32]1); $writer.Write([uint32]$frames[0].Length)
$writer.Write([uint32]$size); $writer.Write([uint32]$size); 1..4 | ForEach-Object { $writer.Write([uint32]0) }
End-Chunk $writer $avih
$strl = Start-Chunk $writer 'LIST'; Write-FourCC $writer 'strl'
$strh = Start-Chunk $writer 'strh'
Write-FourCC $writer 'vids'; Write-FourCC $writer 'DIB '; $writer.Write([uint32]0); $writer.Write([uint16]0); $writer.Write([uint16]0)
$writer.Write([uint32]0); $writer.Write([uint32]1); $writer.Write([uint32]$fps); $writer.Write([uint32]0); $writer.Write([uint32]$frameCount)
$writer.Write([uint32]$frames[0].Length); $writer.Write([int32]-1); $writer.Write([uint32]0)
$writer.Write([int16]0); $writer.Write([int16]0); $writer.Write([int16]$size); $writer.Write([int16]$size)
End-Chunk $writer $strh
$strf = Start-Chunk $writer 'strf'
$writer.Write([uint32]40); $writer.Write([int32]$size); $writer.Write([int32]$size); $writer.Write([uint16]1); $writer.Write([uint16]24)
$writer.Write([uint32]0); $writer.Write([uint32]$frames[0].Length); 1..4 | ForEach-Object { $writer.Write([uint32]0) }
End-Chunk $writer $strf; End-Chunk $writer $strl; End-Chunk $writer $hdrl
$movi = Start-Chunk $writer 'LIST'; Write-FourCC $writer 'movi'
$offsets = New-Object System.Collections.Generic.List[uint32]
$offset = 4
foreach ($data in $frames) {
    $offsets.Add([uint32]$offset); Write-FourCC $writer '00db'; $writer.Write([uint32]$data.Length); $writer.Write($data)
    if (($data.Length % 2) -ne 0) { $writer.Write([byte]0) }; $offset += 8 + $data.Length + ($data.Length % 2)
}
End-Chunk $writer $movi
$idx1 = Start-Chunk $writer 'idx1'
for ($i = 0; $i -lt $frameCount; $i++) { Write-FourCC $writer '00db'; $writer.Write([uint32]0x10); $writer.Write($offsets[$i]); $writer.Write([uint32]$frames[$i].Length) }
End-Chunk $writer $idx1; End-Chunk $writer $riff
$writer.Dispose(); $stream.Dispose()
Write-Host "Created $outputPath ($size x $size, $frameCount frames at $fps fps)"
