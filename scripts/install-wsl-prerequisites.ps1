#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host "Habilitando Windows Subsystem for Linux..."
$wsl = Enable-WindowsOptionalFeature `
  -Online `
  -FeatureName Microsoft-Windows-Subsystem-Linux `
  -All `
  -NoRestart

Write-Host "Habilitando Virtual Machine Platform..."
$vm = Enable-WindowsOptionalFeature `
  -Online `
  -FeatureName VirtualMachinePlatform `
  -All `
  -NoRestart

Write-Host ""
Write-Host "WSL: $($wsl.State)"
Write-Host "Virtual Machine Platform: $($vm.State)"
Write-Host "Reinicie o Windows antes de instalar ou iniciar o Docker Desktop."
