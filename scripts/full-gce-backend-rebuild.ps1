# Delete acs-hss-server, create minimal e2-micro, wait for SSH, run gce-bootstrap-backend.sh, optional deploy upload.
# Prerequisites: gcloud auth login, project set. Run from repo root.
#
# Usage:
#   .\scripts\full-gce-backend-rebuild.ps1
#   .\scripts\full-gce-backend-rebuild.ps1 -SkipDeploy
#   .\scripts\full-gce-backend-rebuild.ps1 -ReserveStaticIp:$false

param(
    [string]$Project = "lte-pci-mapper-65450042-bbf71",
    [string]$Zone = "us-central1-a",
    [string]$InstanceName = "acs-hss-server",
    [switch]$ReserveStaticIp = $true,
    [switch]$SkipDeploy = $false
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoRoot

Write-Host "=== Recreate minimal VM ===" -ForegroundColor Cyan
& "$repoRoot\scripts\recreate-hss-gce-minimal.ps1" -Project $Project -Zone $Zone -InstanceName $InstanceName -ReserveStaticIp:$ReserveStaticIp
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== Wait for SSH (up to ~120s) ===" -ForegroundColor Cyan
$gcloudSshArgs = @("compute", "ssh", "${InstanceName}", "--project=$Project", "--zone=$Zone", "--command=true")
$ok = $false
for ($i = 0; $i -lt 24; $i++) {
    & gcloud @gcloudSshArgs 2>$null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $ok) {
    Write-Host "SSH not ready. Run bootstrap manually after VM is up:" -ForegroundColor Yellow
    Write-Host "  gcloud compute scp scripts/gce-bootstrap-backend.sh ${InstanceName}:~/ --zone=$Zone --project=$Project" -ForegroundColor Gray
    Write-Host "  gcloud compute ssh $InstanceName --zone=$Zone --project=$Project --command='chmod +x ~/gce-bootstrap-backend.sh && ~/gce-bootstrap-backend.sh'" -ForegroundColor Gray
    exit 1
}

Write-Host "`n=== Upload and run bootstrap ===" -ForegroundColor Cyan
$bootstrap = Join-Path $repoRoot "scripts\gce-bootstrap-backend.sh"
if (-not (Test-Path $bootstrap)) { Write-Host "Missing $bootstrap" -ForegroundColor Red; exit 1 }
gcloud compute scp "$bootstrap" "${InstanceName}:~/gce-bootstrap-backend.sh" --project=$Project --zone=$Zone
if ($LASTEXITCODE -ne 0) { Write-Host "SCP failed." -ForegroundColor Red; exit 1 }
gcloud compute ssh $InstanceName --project=$Project --zone=$Zone --command="chmod +x ~/gce-bootstrap-backend.sh && ~/gce-bootstrap-backend.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "Bootstrap failed." -ForegroundColor Red; exit 1 }

if (-not $SkipDeploy) {
    Write-Host "`n=== Deploy backend (Upload) ===" -ForegroundColor Cyan
    & "$repoRoot\deploy-backend-to-gce.ps1" -Project $Project -Zone $Zone -InstanceName $InstanceName -DeployMethod Upload -UseIapTunnel:$false
}

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "1. If first deploy: SSH and create /opt/lte-pci-mapper/backend-services/.env (MONGODB_URI, FIREBASE_*, INTERNAL_API_KEY)." -ForegroundColor White
Write-Host "2. DNS A: hss.wisptools.io -> reserved/static IP from recreate step." -ForegroundColor White
Write-Host "3. TLS: sudo certbot --nginx -d hss.wisptools.io" -ForegroundColor White
Write-Host "4. Verify: curl -sS http://<IP>/health (or https after certbot)" -ForegroundColor White
