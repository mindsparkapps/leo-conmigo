# Abre Leo Conmigo en el computador: arranca el servidor local (si no está corriendo) y abre la app
# en una ventana propia de Chrome. Lo usa el acceso directo del escritorio.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$puerto = 8080
$url = "http://localhost:$puerto/"

function Escuchando {
  [bool](Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Escuchando)) {
  $python = (Get-Command python -ErrorAction Stop).Source
  Start-Process -FilePath $python -ArgumentList "`"$raiz\tests\servidor.py`"", $puerto -WindowStyle Hidden
  for ($i = 0; $i -lt 50 -and -not (Escuchando); $i++) { Start-Sleep -Milliseconds 200 }
}

$navegadores = @(
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$navegador = $navegadores | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($navegador) {
  Start-Process -FilePath $navegador -ArgumentList "--app=$url"
} else {
  Start-Process $url
}
