---
title: Where We Are & Next Steps (Priority)
description: Current state and prioritized next steps for WISPTools.
---

# Where We Are & Next Steps (Priority)

**Snapshot:** Current state and prioritized next steps for WISPTools.

---

## Where we are

### Deploy & infra
- **Frontend:** Firebase Hosting (wisptools-production.web.app). Deploy: `firebase deploy --only hosting:app` (after `npm run build` in Module_Manager).
- **Backend:** GCE VM `acs-hss-server` (us-central1-a). Deploy: `.\deploy-backend-to-gce.ps1 -DeployMethod Upload` (then run remote install+pm2 if script fails), or **Git:** `-DeployMethod Git` (script reads GitHub token from `scripts/deployment/update-backend-from-git.sh` and uses HTTPS). Set **API_BASE_URL** in backend env (see `backend-services/.env.example`) so deployment/TR-069 photo and firmware URLs use the correct public base URL when behind a load balancer or Cloud Run; see `DEPLOY_BACKEND_FALLBACK.md`.
- **Functions:** apiProxy, notifications, etc. Deploy: `firebase deploy --only functions`.
- **GitHub token:** Default token lives in `scripts/deployment/update-backend-from-git.sh`; deploy script uses it for Git deploy. **Security:** Token is in repo; prefer env `GITHUB_TOKEN` or a secret and remove default from file.

### App features (done)
- **Wizards:** Button (🧙) left of Settings on dashboard; no card; `/wizards` hub.
- **Notifications:** apiProxy path fix (`?path=` + `req.query.path`); 400 surfaced as Retry; loadError + Retry when empty; Escape closes panel.
- **GlobalSettings:** Backend `GET/PUT /api/tenant-settings`; frontend `tenantSettingsService`; ACS + company info sync to backend with localStorage fallback.
- **A11y:** Wizards/Settings `aria-label`; dashboard/admin cards `aria-label`; NotificationCenter Escape.
- **Plans, Deploy, Field app:** Plan overlays, deploy filter, notifications, My Projects, deployment notes, photos (GridFS/Storage). See PROJECT_WORKFLOW_STATUS.md.

### Known gaps / TODOs in code
- **CBRS config:** ✅ Encryption implemented via Firebase callables `saveCbrsConfigSecure` / `loadCbrsConfigSecure` (AES-256-GCM); set `CBRS_CONFIG_ENCRYPTION_KEY` in Functions config.
- **CPE performance:** ✅ Modal now calls `apiService.getDeviceParameters(deviceId)` and maps TR-069 params to metrics; falls back to device metrics on error.
- **ACS:** REFACTOR_SUMMARY – TODO: parameter editor.
- **Backend:** tr069 firmware upload “not yet implemented”; network CBRS import “not yet implemented”; epcMetrics TODO: integrate with monitoring.

### Repo name inconsistency
- **WISPTools:** `deploy-backend-to-gce.ps1`, docs use `theorem6/WISP-Management.git`.
- **lte-pci-mapper:** `scripts/deployment/update-backend-from-git.sh`, `setup-github-ssh.sh`, epc-checkin-agent, etc. use `theorem6/lte-pci-mapper.git`.
- If the repo was renamed to WISPTools, align `update-backend-from-git.sh` (and any other scripts that clone/pull) to `theorem6/WISP-Management.git`.

---

## Next steps (priority)

### P0 – Security & correctness ✅
1. **GitHub token:** Done. Removed hardcoded tokens from fix-git-repo.sh, debug-git-update.sh, epc-auto-update.js, distributed-epc-api.js. Use env `GITHUB_TOKEN` only.
2. **Repo URL alignment:** Done. Updated scripts and config to use `theorem6/WISP-Management.git` (epc-checkin-agent, deploy-monitoring-backend, config/app.js, distributed-epc, etc.).

### P1 – High value features ✅
3. **CBRS config encryption:** Done. Firebase callables encrypt/decrypt sensitive fields (AES-256-GCM); frontend uses callables with Firestore fallback.
4. **CPE performance API:** Done. CPEPerformanceModal calls getDeviceParameters and maps TR-069 params to performance data.

### P2 – UX & polish ✅
5. **Keyboard/focus:** Done. Focus trap and Tab cycle in GlobalSettings and NotificationCenter; Escape closes; panel gets role="dialog" and focus on open.
6. **Push/email on approval:** Done. `onNotificationCreated` sends SendGrid email and FCM push when a project_approved notification is created.

### P3 – Optional / later ✅
7. **ACS parameter editor:** Done. ParameterEditorModal in TR069Actions; Edit Parameters button; POST setParameterValues via /api/tr069/tasks.
8. **Backend TODOs:** Done. TR-069 firmware upload (multer, /api/tr069/firmware/upload + download); CBRS import (POST /api/network/import/cbrs); epcMetrics → incident creation for critical/high alerts; user activity logging (ActivityLog model, GET /api/users/:userId/activity); installation-doc notifications (submit → admins, approve → installer).
9. **Hardware module:** Clarify or relax EPC ID readonly if appropriate (optional).

---

## Quick reference

| Area            | Location / command |
|-----------------|--------------------|
| Frontend deploy | `Module_Manager`: `npm run build` → `firebase deploy --only hosting:app` |
| Backend deploy  | `.\deploy-backend-to-gce.ps1 -DeployMethod Upload` or `-DeployMethod Git` |
| GitHub token    | `scripts/deployment/update-backend-from-git.sh` (default); prefer `GITHUB_TOKEN` env |
| Enhancements    | `docs/ENHANCEMENTS.md` |
| Workflow status | `docs/PROJECT_WORKFLOW_STATUS.md` |
