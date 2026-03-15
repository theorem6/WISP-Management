# App Root and Build

The **Svelte app (WISP Management / wisptools.io UI) lives in `Module_Manager`**. That folder is the app root for build and dev.

- **Build (for Firebase Hosting):**  
  `cd Module_Manager && npm run build`  
  Output: `Module_Manager/build/client` (used by `firebase.json` hosting).

- **Dev:**  
  `cd Module_Manager && npm run dev`

- **Deploy app + Firestore indexes:**  
  From repo root, after building from Module_Manager:
  ```bash
  cd Module_Manager && npm run build
  cd .. && firebase deploy --only hosting:app,firestore:indexes
  ```

The repo root `vite.config.ts` only re-exports `Module_Manager/vite.config.ts` so tooling that starts from the repo root can resolve config without needing Svelte deps at root. The root `package.json` is for wisp-billing-service, not the Svelte app.
