# 品牌圖示產生器(MoneyCare)——以 System.Drawing 繪製「硬幣+三柱」幾何標記,重跑可再現。
# token 對齊 src/theme/tokens.json:紙底 #F6F5F0 / 墨棕 #26251F / 松綠 #3F7A5E。
# 用法:pwsh -File scripts/make-brand-icons.ps1(repo 根執行)
# 注意:限 PowerShell 7(pwsh)——WinPS 5.1 將無 BOM UTF-8 中文註解誤讀為 CP950,會靜默漏行。
Add-Type -AssemblyName System.Drawing

$Paper  = [System.Drawing.ColorTranslator]::FromHtml('#F6F5F0')
$Ink    = [System.Drawing.ColorTranslator]::FromHtml('#26251F')
$Accent = [System.Drawing.ColorTranslator]::FromHtml('#3F7A5E')

function New-Canvas([int]$size) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  return @{ Bmp = $bmp; G = $g }
}

# 繪製「硬幣環 + 三柱(遞增)」:環=accent、柱=ink(最高柱 accent)。
# $size 畫布邊長;$diameter 硬幣直徑;$bg 背景色($null=透明);$mono $true=全 ink(Android themed icon 用 alpha)
function Draw-Mark([hashtable]$c, [double]$diameter, [object]$bg, [bool]$mono) {
  $g = $c.G; $S = $c.Bmp.Width
  $cx = $S / 2.0; $cy = $S / 2.0
  $R = $diameter / 2.0
  $ringW = $diameter * 0.075
  $ringColor = $Ink
  $accentColor = if ($mono) { $Ink } else { $Accent }

  if ($null -ne $bg) { $g.Clear($bg) } else { $g.Clear([System.Drawing.Color]::Transparent) }

  # 硬幣環
  $penRing = [System.Drawing.Pen]::new($accentColor, [float]$ringW)
  $rRing = $R - $ringW / 2.0
  $g.DrawEllipse($penRing, [float]($cx - $rRing), [float]($cy - $rRing), [float](2 * $rRing), [float](2 * $rRing))
  $penRing.Dispose()

  # 三柱(底對齊、遞增;最高柱 accent):柱寬/間距依硬幣內徑縮放
  $inner = $R - $ringW * 1.6
  $barW = $inner * 0.16
  $gap = $inner * 0.12
  $totalW = 3 * $barW + 2 * $gap
  $baseY = $cy + $inner * 0.52
  # 注意:PowerShell 逗號優先權高於 *,陣列元素必須逐項括號
  $heights = @(($inner * 0.34), ($inner * 0.56), ($inner * 0.80))
  $colors = @($ringColor, $ringColor, $accentColor)
  $x0 = $cx - $totalW / 2
  for ($i = 0; $i -lt 3; $i++) {
    $brush = [System.Drawing.SolidBrush]::new($colors[$i])
    $h = $heights[$i]
    $x = $x0 + $i * ($barW + $gap)
    $rect = [System.Drawing.RectangleF]::new([float]$x, [float]($baseY - $h), [float]$barW, [float]$h)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $r = [Math]::Min($barW / 3, $h / 2)  # 圓角頂
    $path.AddArc($rect.X, $rect.Y, 2 * $r, 2 * $r, 180, 90)
    $path.AddArc([float]($rect.Right - 2 * $r), $rect.Y, 2 * $r, 2 * $r, 270, 90)
    $path.AddLine([float]$rect.Right, [float]($rect.Y + $r), [float]$rect.Right, [float]$rect.Bottom)
    $path.AddLine([float]$rect.Right, [float]$rect.Bottom, [float]$rect.X, [float]$rect.Bottom)
    $path.AddLine([float]$rect.X, [float]$rect.Bottom, [float]$rect.X, [float]($rect.Y + $r))
    $path.CloseFigure()
    $g.FillPath($brush, $path)
    $path.Dispose(); $brush.Dispose()
  }
}

function Save-Png([hashtable]$c, [string]$path) {
  $c.G.Dispose()
  $c.Bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $c.Bmp.Dispose()
  Write-Host "OK $path"
}

$root = $PSScriptRoot | Split-Path
$img = Join-Path $root 'assets\images'
New-Item -ItemType Directory -Force $img | Out-Null

# 1) 主圖示(iOS/通用)1024——紙底滿版
$c = New-Canvas 1024; Draw-Mark $c 640 $Paper $false; Save-Png $c (Join-Path $img 'icon.png')

# 2) Android adaptive 前景 512——透明底,內容限安全區(直徑 ≤ 66%)
$c = New-Canvas 512; Draw-Mark $c 268 $null $false; Save-Png $c (Join-Path $img 'android-icon-foreground.png')

# 3) Android themed(monochrome)432——透明底全 ink(僅 alpha 有意義)
$c = New-Canvas 432; Draw-Mark $c 300 $null $true; Save-Png $c (Join-Path $img 'android-icon-monochrome.png')

# 4) Splash 圖 256——透明底
$c = New-Canvas 256; Draw-Mark $c 224 $null $false; Save-Png $c (Join-Path $img 'splash-icon.png')

# 5) Favicon 48——紙底
$c = New-Canvas 48; Draw-Mark $c 36 $Paper $false; Save-Png $c (Join-Path $img 'favicon.png')
