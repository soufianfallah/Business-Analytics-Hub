param([string]$OutputDirectory = "backups", [int]$RetentionDays = 14)
$ErrorActionPreference = "Stop"
if (-not $env:DIRECT_URL) { throw "DIRECT_URL is required." }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutputDirectory "business-analytics-hub-$stamp.dump"
& pg_dump --format=custom --no-owner --no-acl --file=$target $env:DIRECT_URL
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
Get-ChildItem -LiteralPath $OutputDirectory -Filter "*.dump" -File |
  Where-Object LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) |
  Remove-Item -Force
Write-Output "Backup created: $target"
