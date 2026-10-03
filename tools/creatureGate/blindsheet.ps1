# blindsheet.ps1 — grid every creature's q34 + side 24px thumbs with ANONYMOUS
# numeric labels for the context-free reader. Writes blind-sheet.png and
# blind-map.json (number -> plan id; never shown to the reader).
param([string]$SweepDir = ".agent/scratch/creature-gate")
Add-Type -AssemblyName System.Drawing

$dirs = Get-ChildItem $SweepDir -Directory | Sort-Object Name
$cols = 5
$cell = 250
$labelH = 24
$rows = [Math]::Ceiling($dirs.Count / $cols)

$sheet = New-Object System.Drawing.Bitmap ($cols * $cell * 2), ($rows * ($cell + $labelH))
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black
$map = @{}

for ($i = 0; $i -lt $dirs.Count; $i++) {
  $n = $i + 1
  $map["$n"] = $dirs[$i].Name
  $x = ($i % $cols) * $cell * 2
  $y = [Math]::Floor($i / $cols) * ($cell + $labelH)
  $g.DrawString("#$n", $font, $brush, $x + 4, $y + 2)
  $vx = $x
  foreach ($view in @("q34_thumb24.png", "side_thumb24.png")) {
    $p = Join-Path $dirs[$i].FullName $view
    if (Test-Path $p) {
      $img = [System.Drawing.Image]::FromFile($p)
      $g.DrawImage($img, $vx + 5, $y + $labelH, $cell - 10, $cell - 10 - $labelH)
      $img.Dispose()
    }
    $vx += $cell
  }
}
$out = Join-Path $SweepDir "blind-sheet.png"
$sheet.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $sheet.Dispose()
$map | ConvertTo-Json | Set-Content (Join-Path $SweepDir "blind-map.json") -Encoding utf8
Write-Output "saved $out + blind-map.json ($($dirs.Count) creatures)"
