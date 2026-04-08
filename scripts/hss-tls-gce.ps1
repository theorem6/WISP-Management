# Manage TLS for hss.wisptools.io on acs-hss-server (GCE).
#
# Free cert: Let's Encrypt (certbot) — already used if you ran certbot on the VM.
# Custom cert: PEM full chain + private key (e.g. commercial CA or your own files).
#
# Usage (from repo root, gcloud auth + project set):
#   .\scripts\hss-tls-gce.ps1 -Action Status
#   .\scripts\hss-tls-gce.ps1 -Action RenewLetsEncrypt
#   .\scripts\hss-tls-gce.ps1 -Action InstallLetsEncrypt   # first-time LE (needs DNS A -> VM)
#   .\scripts\hss-tls-gce.ps1 -Action UploadCustom -FullChainPath C:\path\fullchain.pem -PrivateKeyPath C:\path\privkey.pem
#
param(
    [ValidateSet('Status', 'RenewLetsEncrypt', 'InstallLetsEncrypt', 'UploadCustom')]
    [string]$Action = 'Status',
    [string]$InstanceName = 'acs-hss-server',
    [string]$Zone = 'us-central1-a',
    [string]$Project = '',
    [string]$Domain = 'hss.wisptools.io',
    [string]$FullChainPath = '',
    [string]$PrivateKeyPath = '',
    [string]$ContactEmail = 'admin@wisptools.io'
)

$ErrorActionPreference = 'Stop'
if (-not $Project) { $Project = (gcloud config get-value project 2>$null).Trim() }
if (-not $env:CLOUDSDK_COMPUTE_SSH_USE_OPENSSH) { $env:CLOUDSDK_COMPUTE_SSH_USE_OPENSSH = 'true' }
$gz = @('--project', $Project, '--zone', $Zone)

function Invoke-GceSshCmd([string]$cmd) {
    gcloud compute ssh $InstanceName @gz --command $cmd
}

if ($Action -eq 'Status') {
    Write-Host "=== Certbot certs on $InstanceName ===" -ForegroundColor Cyan
    Invoke-GceSshCmd "sudo certbot certificates 2>/dev/null; echo ---; sudo nginx -t 2>&1; echo ---; echo | openssl s_client -connect 127.0.0.1:443 -servername $Domain 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || true"
    Write-Host "`n=== Public HTTPS check ===" -ForegroundColor Cyan
    try {
        $r = Invoke-WebRequest -Uri "https://$Domain/health" -UseBasicParsing -TimeoutSec 15
        Write-Host "GET https://$Domain/health -> $($r.StatusCode)" -ForegroundColor Green
        Write-Host $r.Content.Substring(0, [Math]::Min(200, $r.Content.Length))
    } catch {
        Write-Host $_ -ForegroundColor Red
    }
    exit 0
}

if ($Action -eq 'RenewLetsEncrypt') {
    Write-Host "Renewing Let's Encrypt certs (if due)..." -ForegroundColor Cyan
    Invoke-GceSshCmd 'sudo certbot renew --non-interactive && sudo systemctl reload nginx'
    exit $LASTEXITCODE
}

if ($Action -eq 'InstallLetsEncrypt') {
    Write-Host "Installing / refreshing Let's Encrypt for $Domain (DNS must point to this VM)..." -ForegroundColor Cyan
    $email = $ContactEmail -replace "'", "'\''"
    $d = $Domain -replace "'", "'\''"
    # Single-line remote command so gcloud ssh on Windows does not drop newlines.
    $remote = "set -e; sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d '$d' --non-interactive --agree-tos --email '$email' --redirect && sudo nginx -t && sudo systemctl reload nginx && sudo certbot certificates"
    Invoke-GceSshCmd $remote
    exit $LASTEXITCODE
}

if ($Action -eq 'UploadCustom') {
    if (-not (Test-Path -LiteralPath $FullChainPath)) {
        Write-Host "FullChainPath not found: $FullChainPath" -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path -LiteralPath $PrivateKeyPath)) {
        Write-Host "PrivateKeyPath not found: $PrivateKeyPath" -ForegroundColor Red
        exit 1
    }
    Write-Host "Uploading PEM files to $InstanceName (overwrites /etc/nginx/ssl/hss.*)..." -ForegroundColor Cyan
    gcloud compute scp --project $Project --zone $Zone $FullChainPath "${InstanceName}:/tmp/hss-upload-fullchain.pem"
    if ($LASTEXITCODE -ne 0) { exit 1 }
    gcloud compute scp --project $Project --zone $Zone $PrivateKeyPath "${InstanceName}:/tmp/hss-upload-privkey.pem"
    if ($LASTEXITCODE -ne 0) { exit 1 }

    $remote = @'
set -e; sudo mkdir -p /etc/nginx/ssl; sudo install -m 644 /tmp/hss-upload-fullchain.pem /etc/nginx/ssl/hss.fullchain.pem; sudo install -m 600 /tmp/hss-upload-privkey.pem /etc/nginx/ssl/hss.privkey.pem; rm -f /tmp/hss-upload-fullchain.pem /tmp/hss-upload-privkey.pem; SITE=/etc/nginx/sites-available/hss-backend; sudo cp -a "$SITE" "${SITE}.bak.$(date +%s)"; sudo sed -i 's|^\s*ssl_certificate .*|    ssl_certificate /etc/nginx/ssl/hss.fullchain.pem;|' "$SITE"; sudo sed -i 's|^\s*ssl_certificate_key .*|    ssl_certificate_key /etc/nginx/ssl/hss.privkey.pem;|' "$SITE"; sudo nginx -t && sudo systemctl reload nginx; echo "Custom TLS active. Backup: ${SITE}.bak.*"
'@
    Invoke-GceSshCmd $remote
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Write-Host "Remote step failed. Restore backup on VM: sudo cp /etc/nginx/sites-available/hss-backend.bak.* ..." -ForegroundColor Yellow
    }
    exit $code
}
