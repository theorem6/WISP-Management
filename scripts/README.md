# WISP Management (wisptools.io) Scripts

Scripts are organized for **Windows (PowerShell)** and **Linux (Bash)**. Use the appropriate script for your environment.

## Quick reference

| Task | Windows | Linux |
|------|---------|--------|
| **Full deploy** (Firebase + GCE) | Root: `deploy-all-complete.ps1` | `scripts/deployment/deploy-all.sh` |
| **Backend to GCE** | Root: `deploy-backend-to-gce.ps1` | `scripts/deployment/update-backend-from-git.sh` (on server) |
| **Firebase Hosting** | `firebase-deploy.ps1` or `firebase deploy --only hosting` | `firebase deploy --only hosting` |
| **Nginx API routing fix** | `scripts/fix-nginx-api-routing-on-gce.ps1` | `scripts/fix-nginx-api-routing.sh` (run on GCE) |
| **Firebase Admin on GCE** | `scripts/set-firebase-admin-on-gce.ps1` | — |
| **Internal API key on GCE** | `scripts/set-internal-api-key-on-gce.ps1` | — |

## Directory layout

- **`scripts/`** – Shared and Linux-oriented scripts (`.sh`, `.js`, `.ps1`).
- **`scripts/deployment/`** – Deployment and GCE automation (Deploy-All.ps1, deploy-*.sh, update-backend-from-git.sh).
- **Root `.ps1`** – Convenience wrappers; most call into `scripts/` or gcloud/firebase.

## Conventions

1. **No secrets in repo** – Use env vars (e.g. `GITHUB_TOKEN`, `REMOTE_AGENT_HOST`) or Firebase Secret Manager / GCP.
2. **GCE paths** – Default backend path on server is `/opt/lte-pci-mapper`; override with env if different.
3. **IAP** – Windows scripts use `--tunnel-through-iap` for gcloud SSH/SCP where required.

## Windows notes

- Requires **Google Cloud SDK** (`gcloud`) and **Firebase CLI** (`firebase`) for full deploy.
- Run PowerShell scripts from repo root: `.\deploy-all-complete.ps1`

## Linux / GCE notes

- On the GCE instance, run from repo root: `sudo bash scripts/deployment/update-backend-from-git.sh`
- Ensure `GITHUB_TOKEN` is set (in env or `/opt/lte-pci-mapper/.env`) for git pull.

## GitHub CLI and releases

- **Install (Windows):** `winget install GitHub.cli`
- **Log in once:** `gh auth login` (browser or token).
- **Create a release** (from repo root): `.\scripts\create-release.ps1 v1.0.0`  
  Uses `RELEASE_NOTES_v1.0.0.md` if present; otherwise run  
  `gh release create v1.0.0 --title "v1.0.0 - First release" --notes-file RELEASE_NOTES_v1.0.0.md`
