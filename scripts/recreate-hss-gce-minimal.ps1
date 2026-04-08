# Recreate HSS backend VM on minimal (cheap) GCE shape, optional static IP for stable DNS.
# Run from repo root AFTER: gcloud auth login && gcloud config set project lte-pci-mapper-65450042-bbf71
#
# Usage:
#   .\scripts\recreate-hss-gce-minimal.ps1
#   .\scripts\recreate-hss-gce-minimal.ps1 -SkipDelete    # only create if instance missing (dev)
#
# DNS: Point hss.wisptools.io (A record) to the printed external IP. If you use -ReserveStaticIp,
#      the IP stays the same across recreates—update DNS once to that IP.

param(
    [string]$Project = "lte-pci-mapper-65450042-bbf71",
    [string]$Zone = "us-central1-a",
    [string]$InstanceName = "acs-hss-server",
    [string]$MachineType = "e2-micro",
    [int]$BootDiskGb = 20,
    [string]$StaticAddressName = "hss-wisptools-static",
    [switch]$ReserveStaticIp = $true,
    [switch]$SkipDelete = $false
)

# gcloud writes status to stderr; do not use Stop or native stderr becomes terminating errors in some hosts.
$ErrorActionPreference = "Continue"

function Assert-Gcloud {
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Write-Host "gcloud not found. Install Google Cloud SDK." -ForegroundColor Red
        exit 1
    }
}

Assert-Gcloud
gcloud config set project $Project 2>$null | Out-Null

Write-Host "`n=== Step 1: Regional static IP (stable DNS across VM rebuilds) ===" -ForegroundColor Cyan
$address = $null
if ($ReserveStaticIp) {
    $exists = gcloud compute addresses describe $StaticAddressName --region=us-central1 --project=$Project 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating reserved address $StaticAddressName in us-central1..."
        gcloud compute addresses create $StaticAddressName --region=us-central1 --project=$Project
    } else {
        Write-Host "Reserved address $StaticAddressName already exists."
    }
    $address = (gcloud compute addresses describe $StaticAddressName --region=us-central1 --project=$Project --format="value(address)").Trim()
    Write-Host "Static IP for DNS A record: $address" -ForegroundColor Green
} else {
    Write-Host "Skipping static IP (ephemeral IP will change on each recreate)." -ForegroundColor Yellow
}

Write-Host "`n=== Step 2: Delete existing VM (if any) ===" -ForegroundColor Cyan
$inst = gcloud compute instances describe $InstanceName --zone=$Zone --project=$Project 2>$null
if ($LASTEXITCODE -eq 0) {
    if ($SkipDelete) {
        Write-Host "Instance exists and -SkipDelete set; exiting without changes." -ForegroundColor Yellow
        exit 0
    }
    Write-Host "Deleting $InstanceName in $Zone..."
    gcloud compute instances delete $InstanceName --zone=$Zone --project=$Project --quiet
} else {
    Write-Host "No existing instance named $InstanceName (nothing to delete)."
}

Write-Host "`n=== Step 3: Create minimal VM ===" -ForegroundColor Cyan
# Ubuntu 22.04 LTS, minimal disk, allow HTTP/HTTPS tags (adjust if your firewall rules use other tags)
$createArgs = @(
    "compute", "instances", "create", $InstanceName,
    "--zone=$Zone",
    "--project=$Project",
    "--machine-type=$MachineType",
    "--image-family=ubuntu-2204-lts",
    "--image-project=ubuntu-os-cloud",
    "--boot-disk-size=${BootDiskGb}GB",
    "--boot-disk-type=pd-balanced",
    "--tags=http-server,https-server",
    "--scopes=https://www.googleapis.com/auth/cloud-platform"
)
# Regional static IP: attach via network-interface (quote on Windows so comma is not split).
if ($ReserveStaticIp -and $address) {
    $createArgs += "--network-interface=subnet=default,address=$StaticAddressName"
}

& gcloud @createArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Instance create failed." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== External IP (use for DNS) ===" -ForegroundColor Green
if ($ReserveStaticIp -and $address) {
    Write-Host "  $address  ->  set A record:  hss.wisptools.io  ->  $address" -ForegroundColor White
} else {
    $ephemeral = (gcloud compute instances describe $InstanceName --zone=$Zone --project=$Project --format="value(networkInterfaces[0].accessConfigs[0].natIP)").Trim()
    Write-Host "  $ephemeral  ->  set A record:  hss.wisptools.io  ->  $ephemeral" -ForegroundColor White
}

Write-Host "`n=== Next steps (run on your machine) ===" -ForegroundColor Cyan
Write-Host "1. DNS: At your DNS host (where wisptools.io is managed), set:" -ForegroundColor White
Write-Host "     Type A   name: hss   value: <IP above>" -ForegroundColor Gray
Write-Host "   Propagation can take a few minutes." -ForegroundColor Gray
Write-Host "2. First-time server setup (SSH once, install Node/nginx/pm2), or use bootstrap: scripts/gce-bootstrap-backend.sh" -ForegroundColor White
Write-Host "3. Deploy backend from repo root:" -ForegroundColor White
Write-Host "     .\deploy-backend-to-gce.ps1 -DeployMethod Upload" -ForegroundColor Gray
Write-Host "4. TLS: On the VM, run certbot for hss.wisptools.io after DNS resolves." -ForegroundColor White
Write-Host "5. Firewall: Ensure VPC firewall allows tcp:80,443 to this instance (default http-server/https-server tags)." -ForegroundColor White
Write-Host ""
