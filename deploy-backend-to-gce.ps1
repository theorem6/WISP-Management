# Deploy Backend Services to GCE VM via gcloud
# DeployMethod: Upload = SCP local backend-services then run install+pm2. Git = clone/pull on server (HTTPS+token or SSH).
# GitHub token: use -GitHubToken, or set env GITHUB_TOKEN, or script reads default from scripts/deployment/update-backend-from-git.sh

param(
    [string]$InstanceName = "acs-hss-server",
    [string]$Zone = "us-central1-a",
    [string]$Project = "",
    [string]$BackendDir = "/opt/lte-pci-mapper/backend-services",
    [ValidateSet("Upload", "Git")]
    [string]$DeployMethod = "Upload",
    [string]$RepoPath = "",
    [string]$GitUrl = "git@github.com:theorem6/WISP-Management.git",
    [string]$GitHubToken = "",   # If set, Git deploy uses HTTPS with token (no SSH key on VM). Also from env GITHUB_TOKEN or update-backend-from-git.sh
    [switch]$SetupOnly = $false,
    [switch]$UseIapTunnel = $true,
    [switch]$SkipRemote = $false   # Upload only; run remote install from Cloud Shell or another machine
)

Write-Host "Deploying backend services to GCE ($DeployMethod)..." -ForegroundColor Green

$gcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudCmd) {
    Write-Host "gcloud CLI not found. Install Google Cloud SDK and try again." -ForegroundColor Red
    exit 1
}

if (-not $Project) {
    $Project = (gcloud config get-value project 2>$null).Trim()
}
if (-not $Project) {
    Write-Host "No GCP project set. Run: gcloud config set project <PROJECT_ID>" -ForegroundColor Red
    exit 1
}

if ($DeployMethod -eq "Git" -or $SetupOnly) {
    if (-not $RepoPath) { $RepoPath = "/opt/lte-pci-mapper" }
    $RepoPath = $RepoPath -replace '\\', '/'
    # Resolve GitHub token for HTTPS clone/pull (no SSH key on VM)
    if (-not $GitHubToken -and [System.Environment]::GetEnvironmentVariable('GITHUB_TOKEN')) {
        $GitHubToken = [System.Environment]::GetEnvironmentVariable('GITHUB_TOKEN')
    }
    # Token must be provided via -GitHubToken or env GITHUB_TOKEN (no default in repo)
    if (-not $GitHubToken) {
        $GitHubToken = [System.Environment]::GetEnvironmentVariable('GITHUB_TOKEN')
    }
    if ($GitHubToken) {
        $GitUrl = "https://$GitHubToken@github.com/theorem6/WISP-Management.git"
        Write-Host "Using GitHub token for Git (HTTPS)" -ForegroundColor Cyan
    } else {
        Write-Host "No GITHUB_TOKEN. Git deploy will use SSH (VM needs deploy key). Set env GITHUB_TOKEN for HTTPS." -ForegroundColor Yellow
    }
}
if ($SetupOnly) { $DeployMethod = "Git" }

$gcloudSshArgs = @($InstanceName, '--project', $Project, '--zone', $Zone)
$gcloudScpArgs = @('--recurse', '--project', $Project, '--zone', $Zone)
if ($UseIapTunnel) {
    $gcloudSshArgs += '--tunnel-through-iap'
    $gcloudScpArgs += '--tunnel-through-iap'
    Write-Host "Using IAP tunnel for SSH/SCP" -ForegroundColor Cyan
}
Write-Host "Project: $Project" -ForegroundColor Cyan
Write-Host "Instance: $InstanceName ($Zone)" -ForegroundColor Cyan
Write-Host "Target dir: $BackendDir" -ForegroundColor Cyan
if ($DeployMethod -eq "Git") {
    Write-Host "Repo path: $RepoPath" -ForegroundColor Cyan
    Write-Host "Git URL: $GitUrl" -ForegroundColor Cyan
}
if ($SetupOnly) { Write-Host "Setup only: ensuring git + SSH key on server, then exit." -ForegroundColor Yellow }

if ($SetupOnly) {
    $setupScript = @"
set -e
command -v git >/dev/null 2>&1 || (sudo apt-get update -qq && sudo apt-get install -y git)
mkdir -p ~/.ssh
[ -f ~/.ssh/id_ed25519 ] || [ -f ~/.ssh/id_rsa ] || ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -q
grep -q github.com ~/.ssh/known_hosts 2>/dev/null || ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts 2>/dev/null
echo "Add this deploy key to GitHub repo (Settings -> Deploy keys -> Add):"
cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub
"@
    $setupUnix = ($setupScript -replace "`r`n", "`n").TrimEnd() + "`n"
    $setupB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($setupUnix))
    gcloud compute ssh @gcloudSshArgs --command "echo $setupB64 | base64 -d | bash -s"
    if ($LASTEXITCODE -ne 0) { Write-Host "Setup failed." -ForegroundColor Red; exit 1 }
    Write-Host "Add the key above to theorem6/WISP-Management -> Settings -> Deploy keys, then run deploy again without -SetupOnly." -ForegroundColor Green
    exit 0
}

if ($DeployMethod -eq "Upload") {
    $backendPath = Join-Path $PSScriptRoot "backend-services"
    if (-not (Test-Path $backendPath)) {
        Write-Host "backend-services not found at $backendPath" -ForegroundColor Red
        exit 1
    }
    # Copy only backend runtime code: server, routes, models, config, middleware, services, utils, scripts, package files.
    # Exclude node_modules, .git, docs, and *.md so we deploy only what the API needs (scripts/ kept – iso-generation uses it).
    $tempDeploy = Join-Path $env:TEMP "backend-services-deploy-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
    New-Item -ItemType Directory -Path $tempDeploy -Force | Out-Null
    & robocopy "$backendPath" "$tempDeploy" /E /XD node_modules .git docs /XF *.md /NFL /NDL /NJH /NJS /NC /NS
    if ($LASTEXITCODE -ge 8) { Write-Host "robocopy failed." -ForegroundColor Red; exit 1 }
    Write-Host "Creating remote dir and uploading backend runtime only (no node_modules, docs, .md)..." -ForegroundColor Yellow
    gcloud compute ssh @gcloudSshArgs --command "mkdir -p /tmp/backend-services-deploy"
    if ($LASTEXITCODE -ne 0) { Write-Host "Failed to create remote dir." -ForegroundColor Red; Remove-Item -Recurse -Force $tempDeploy -ErrorAction SilentlyContinue; exit 1 }
    gcloud compute scp @gcloudScpArgs "$tempDeploy\*" "${InstanceName}:/tmp/backend-services-deploy/"
    $scpExit = $LASTEXITCODE
    Remove-Item -Recurse -Force $tempDeploy -ErrorAction SilentlyContinue
    if ($scpExit -ne 0) {
        Write-Host "Upload failed." -ForegroundColor Red
        exit 1
    }
    if ($SkipRemote) {
        Write-Host "Upload complete (SkipRemote). Run remote install from Cloud Shell or a machine where gcloud ssh works:" -ForegroundColor Green
        $tunnel = if ($UseIapTunnel) { " --tunnel-through-iap" } else { "" }
        Write-Host "  gcloud compute ssh $InstanceName --project=$Project --zone=$Zone$tunnel --command=`"cd $BackendDir && npm install --omit=dev && pm2 reload ecosystem.config.js && pm2 save`"" -ForegroundColor Cyan
        Write-Host "If this is the first upload, first move deploy dir: sudo mv $BackendDir ${BackendDir}.bak 2>/dev/null; sudo mv /tmp/backend-services-deploy $BackendDir; cp ${BackendDir}.bak/.env $BackendDir/.env 2>/dev/null" -ForegroundColor Gray
        exit 0
    }
}

# Run remote steps as separate short SSH commands (avoids plink/long-command issues on Windows)
Write-Host "Running remote install and pm2 (step-by-step)..." -ForegroundColor Yellow
$remoteFailed = $false
function Invoke-Remote {
    param([string]$Command)
    & gcloud compute ssh @gcloudSshArgs --command $Command
    if ($LASTEXITCODE -ne 0) { $script:remoteFailed = $true; return $false }
    return $true
}
if ($DeployMethod -eq "Git") {
    $gitUrlEscaped = $GitUrl -replace "'", "'\\''"
    if (-not (Invoke-Remote "test -d $RepoPath/.git 2>/dev/null || echo missing")) { $remoteFailed = $true }
    if (-not $remoteFailed -and -not (Invoke-Remote "cd $RepoPath && git remote set-url origin '$gitUrlEscaped' && git pull")) { $remoteFailed = $true }
    if (-not $remoteFailed) { Invoke-Remote "cd $BackendDir && npm install --omit=dev" | Out-Null }
    if (-not $remoteFailed) { Invoke-Remote "command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2" | Out-Null }
    if (-not $remoteFailed) { Invoke-Remote "cd $BackendDir && (pm2 reload ecosystem.config.js 2>/dev/null || pm2 start ecosystem.config.js)" | Out-Null }
    if (-not $remoteFailed) { Invoke-Remote "pm2 save" | Out-Null }
} else {
    # Upload: move /tmp/backend-services-deploy to BackendDir, preserve .env, npm install, pm2 reload
    $parentDir = $BackendDir -replace '/[^/]+$', ''
    if (-not (Invoke-Remote "sudo mkdir -p $parentDir 2>/dev/null; sudo chown -R `$USER:`$USER $parentDir 2>/dev/null; mv $BackendDir ${BackendDir}.bak 2>/dev/null; mv /tmp/backend-services-deploy $BackendDir")) {
        $remoteFailed = $true
    }
    if (-not $remoteFailed) {
        Invoke-Remote "test -f ${BackendDir}.bak/.env && cp ${BackendDir}.bak/.env $BackendDir/.env" | Out-Null
    }
    if (-not $remoteFailed) { Invoke-Remote "cd $BackendDir && npm install --omit=dev" | Out-Null }
    if (-not $remoteFailed) { Invoke-Remote "command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2" | Out-Null }
    if (-not $remoteFailed) { Invoke-Remote "cd $BackendDir && (pm2 reload ecosystem.config.js 2>/dev/null || pm2 start ecosystem.config.js)" | Out-Null }
    if (-not $remoteFailed) { Invoke-Remote "pm2 save" | Out-Null }
}
if ($remoteFailed) {
    Write-Host "Remote deploy step failed (SSH/plink may fail on this machine)." -ForegroundColor Red
    Write-Host "If files were uploaded, run the install manually (e.g. from Cloud Shell):" -ForegroundColor Yellow
    $tunnel = if ($UseIapTunnel) { " --tunnel-through-iap" } else { "" }
    Write-Host "  gcloud compute ssh $InstanceName --project=$Project --zone=$Zone$tunnel --command=`"cd $BackendDir && npm install --omit=dev && pm2 reload ecosystem.config.js && pm2 save`"" -ForegroundColor Cyan
    Write-Host "See DEPLOY_BACKEND_FALLBACK.md for full steps." -ForegroundColor Yellow
    exit 1
}

Write-Host "Backend deployment complete." -ForegroundColor Green
