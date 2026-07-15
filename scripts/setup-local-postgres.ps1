$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$dockerEnvPath = Join-Path $projectRoot ".env.docker"
$appEnvPath = Join-Path $projectRoot ".env.local"

function Write-Utf8WithoutBom {
  param(
    [Parameter(Mandatory = $true)] [string] $Path,
    [Parameter(Mandatory = $true)] [string[]] $Lines
  )

  $content = ($Lines -join [Environment]::NewLine) + [Environment]::NewLine
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($Path, $content, $encoding)
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerCli = if ($dockerCommand) {
  $dockerCommand.Source
} else {
  "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
}

if (-not (Test-Path $dockerCli)) {
  throw "Docker não encontrado. Instale e inicie o Docker Desktop antes de continuar."
}

$dockerBin = Split-Path -Parent $dockerCli
if (($env:Path -split ";") -notcontains $dockerBin) {
  $env:Path = "$dockerBin;$env:Path"
}

& $dockerCli info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop está instalado, mas o engine não está em execução."
}

if ((Test-Path $dockerEnvPath) -or (Test-Path $appEnvPath)) {
  throw "Arquivos locais de ambiente já existem. Revise-os antes de qualquer sobrescrita."
}

$passwordBytes = New-Object byte[] 24
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $random.GetBytes($passwordBytes)
} finally {
  $random.Dispose()
}
$password = [BitConverter]::ToString($passwordBytes).Replace("-", "").ToLowerInvariant()

Write-Utf8WithoutBom -Path $dockerEnvPath -Lines @(
  "POSTGRES_PASSWORD=$password"
  "POSTGRES_PORT=5433"
)

Write-Utf8WithoutBom -Path $appEnvPath -Lines @(
  "DATABASE_URL=postgresql://secc_app:$password@127.0.0.1:5433/secc"
  "APP_DATA_DIR=./local/private"
  "PRIVATE_STORAGE_DIR=./local/private/uploads"
  "PUBLIC_RELEASE_DIR=./local/publicacao-onedrive/excel-sanitizado"
)

& $dockerCli compose --env-file $dockerEnvPath up -d postgres
if ($LASTEXITCODE -ne 0) {
  throw "Não foi possível iniciar o PostgreSQL."
}

Write-Host "PostgreSQL local solicitado na porta 5433."
Write-Host "Credenciais foram gravadas somente em arquivos ignorados pelo Git."
Write-Host "Execute: docker compose --env-file .env.docker ps"
