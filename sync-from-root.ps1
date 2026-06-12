# Đồng bộ từ index.html gốc vào Mobile/index.html (giữ lại phần PWA)
$root = "$PSScriptRoot\..\index.html"
$mobile = "$PSScriptRoot\index.html"

if (-not (Test-Path $root)) { Write-Host "Không tìm thấy file gốc: $root"; exit 1 }

$src = Get-Content $root -Raw -Encoding UTF8

# Thay thế <head> để thêm PWA tags
$pwaTags = @'
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Bản đồ</title>

  <!-- PWA -->
  <link rel="manifest" href="manifest.json" />
  <meta name="theme-color" content="#1a73e8" />

  <!-- iOS -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Bản đồ" />
  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
'@

$oldHead = '  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bản đồ</title>'

$src = $src.Replace($oldHead, $pwaTags)

# Thay safe-area vào body
$oldBody = '      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }'

$newBody = '      height: 100vh;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }'

$src = $src.Replace($oldBody, $newBody)

# Thêm SW registration trước </body>
$swScript = @'

  <!-- Đăng ký Service Worker (PWA offline) -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  </script>
</body>
'@

$src = $src.Replace('</body>', $swScript)

$src | Set-Content $mobile -Encoding UTF8 -NoNewline
Write-Host "✅ Đã đồng bộ vào Mobile/index.html"
