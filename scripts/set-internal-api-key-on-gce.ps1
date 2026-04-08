# Set INTERNAL_API_KEY on GCE backend (acs-hss-server) from Firebase Secret Manager.
# Ensures userTenants Cloud Function and backend share the same key so /api/user-tenants works.
#
# Prereqs: gcloud auth login, firebase login
# Run from repo root: .\scripts\set-internal-api-key-on-gce.ps1

param(
    [string]$InstanceName = "acs-hss-server",
    [string]$Zone = "us-central1-a",
    [string]$Project = "",
    [string]$BackendDir = "/opt/lte-pci-mapper/backend-services",
    [switch]$UseIapTunnel = $false
)
$ErrorActionPreference = "Stop"
if (-not $Project) { $Project = (gcloud config get-value project 2>$null).Trim() }

if (-not $env:CLOUDSDK_COMPUTE_SSH_USE_OPENSSH) { $env:CLOUDSDK_COMPUTE_SSH_USE_OPENSSH = "true" }

$gcloudZone = @("--project=$Project", "--zone=$Zone")
if ($UseIapTunnel) { $gcloudZone = @("--tunnel-through-iap") + $gcloudZone }

Write-Host "Getting INTERNAL_API_KEY from Firebase Secret Manager..." -ForegroundColor Cyan
# Firebase may mix stderr (warnings) with stdout; take the last line that looks like the secret value.
$lines = @(firebase functions:secrets:access INTERNAL_API_KEY --project $Project 2>&1 | ForEach-Object { "$_".Trim() })
$candidate = $lines | Where-Object {
        $_ -and
        $_ -notmatch '^(Error|Warning|Visit http|Waiting|Success|Logged in|i\s|✔|\+)' -and
        $_ -notmatch 'Error:|HTTP Error|404|not found|Authentication'
    } | Select-Object -Last 1
$key = if ($candidate) { $candidate.Trim() } else { "" }
$fullLog = ($lines -join "`n")
if (-not $key -or $fullLog -match "Error: |404|not found|Authentication Error|HTTP Error") {
    Write-Host $fullLog -ForegroundColor Red
    if ($fullLog -match "404") {
        Write-Host "Secret INTERNAL_API_KEY does not exist yet. Create it, then redeploy functions that use it:" -ForegroundColor Yellow
        Write-Host "  firebase functions:secrets:set INTERNAL_API_KEY --project $Project --data-file path-to-key.txt" -ForegroundColor Gray
        Write-Host "  firebase deploy --only `"functions:userTenants,functions:authProxy,functions:apiProxy`" --project $Project" -ForegroundColor Gray
    } else {
        Write-Host "Try: firebase login --reauth" -ForegroundColor Yellow
    }
    exit 1
}

$tempFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempFile, $key)
    Write-Host "Copying key to GCE instance..." -ForegroundColor Cyan
    gcloud compute scp $tempFile "${InstanceName}:/tmp/internal_api_key.txt" @gcloudZone
    if ($LASTEXITCODE -ne 0) {
        Write-Host "SCP failed. Run: gcloud auth login" -ForegroundColor Red
        exit 1
    }

    $remoteCmd = "set -e; cd $BackendDir; if [ -f .env ]; then grep -v '^INTERNAL_API_KEY=' .env > .env.tmp; else touch .env.tmp; fi; echo -n 'INTERNAL_API_KEY=' >> .env.tmp; cat /tmp/internal_api_key.txt >> .env.tmp; echo '' >> .env.tmp; mv .env.tmp .env; rm -f /tmp/internal_api_key.txt; pm2 restart main-api --update-env; pm2 save; echo Done."
    Write-Host "Setting INTERNAL_API_KEY on backend and restarting main-api..." -ForegroundColor Cyan
    gcloud compute ssh $InstanceName @gcloudZone --command="$remoteCmd"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Done. /api/user-tenants should now return 200." -ForegroundColor Green
    } else {
        Write-Host "SSH command failed." -ForegroundColor Red
        exit 1
    }
} finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
}
