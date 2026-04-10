# Build Module Manager and deploy Firebase Hosting (management site).
# Requires: Node.js, Firebase CLI (`npm i -g firebase-tools`), logged-in `firebase login`.
# Usage: .\scripts\demo\deploy-wisptools-test.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

Write-Host "==> Building Module_Manager..."
Push-Location (Join-Path $Root "Module_Manager")
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

Write-Host "==> Deploying Firebase hosting:management..."
firebase deploy --only hosting:management
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. See docs/deployment/DEMO_SITE.md for backend and seed steps."
