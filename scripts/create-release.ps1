# Create a GitHub release for the given tag.
# Prerequisites: GitHub CLI installed (winget install GitHub.cli), and logged in: gh auth login
# Usage: .\scripts\create-release.ps1 [tag]   e.g.  .\scripts\create-release.ps1 v1.0.0

param(
    [Parameter(Position = 0)]
    [string] $Tag = "v1.0.0"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$repoRoot\.git")) { $repoRoot = (Get-Location).Path }

$notesFile = Join-Path $repoRoot "RELEASE_NOTES_$Tag.md"
if (-not (Test-Path $notesFile)) {
    $notesFile = $null
}

# Refresh PATH so gh is found after winget install
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Push-Location $repoRoot
try {
    & gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Not logged in to GitHub. Run once: gh auth login" -ForegroundColor Yellow
        exit 1
    }
    $title = "$Tag - First release"
    if ($Tag -ne "v1.0.0") { $title = "Release $Tag" }
    $args = @("release", "create", $Tag, "--title", $title)
    if ($notesFile) { $args += "--notes-file", $notesFile }
    & gh @args
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Release created: https://github.com/theorem6/WISP-Management/releases/tag/$Tag" -ForegroundColor Green
    }
} finally {
    Pop-Location
}
