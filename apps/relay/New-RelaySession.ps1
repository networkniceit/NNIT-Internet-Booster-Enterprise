[CmdletBinding()]
param([string]$RelayUrl='http://localhost:4500',[string]$ClientName=$env:COMPUTERNAME)
$ErrorActionPreference='Stop'
$session=Invoke-RestMethod -Method Post -Uri "$RelayUrl/sessions" -ContentType 'application/json' -Body (@{clientName=$ClientName}|ConvertTo-Json)
Write-Host 'Relay session created.' -ForegroundColor Green
Write-Host "Session ID: $($session.sessionId)"
Write-Host "Token: $($session.token)"
Write-Host "Run: .\Test-RelayPath.ps1 -Token `"$($session.token)`"" -ForegroundColor Cyan
