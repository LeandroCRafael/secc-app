$ErrorActionPreference = "Stop"

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "winget não foi encontrado. Instale o App Installer pela Microsoft Store."
}

$wslStatus = & wsl.exe --status 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "WSL 2 ainda não está disponível. Execute install-wsl-prerequisites.ps1 como administrador e reinicie o Windows."
}

winget install `
  --exact `
  --id Docker.DockerDesktop `
  --accept-package-agreements `
  --accept-source-agreements

Write-Host "Docker Desktop instalado. Abra o aplicativo uma vez e aceite somente os termos necessários."
