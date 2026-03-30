# Open source & third-party software

This document records how **WISP Management** (wisptools.io) relates to open source and third-party software: our license, major dependencies, hosted services, and copyleft components operators may deploy alongside this codebase.

**Canonical project license:** [MIT License](../LICENSE) (theorem6, 2026).

**Related public repo:** [Bandwidth Test Manager](https://github.com/theorem6/Bandwidth-Test-Manager) — also MIT.

---

## 1. This repository (application source)

Original application code in this repo is released under the **MIT License** unless a file header states otherwise. See [LICENSE](../LICENSE).

### 1a. Verification: Open5GS, GenieACS, and Ookla (Speedtest)

| Upstream | Vendored in this repo? | What this repo contains instead |
|----------|------------------------|----------------------------------|
| **Open5GS** | **No.** There is no checked-in Open5GS core/C source tree. | Docs and **deployment UI** may emit **bash** that `git clone https://github.com/open5gs/open5gs` on a **target server** at install time. Compliance with **Open5GS** (GPL-2.0 / AGPL per component) is the **operator’s** responsibility when building and running that stack. |
| **GenieACS** | **No.** No copy of the GenieACS **server** codebase is included as a subtree. | **Original** TypeScript/JavaScript under e.g. `Module_Manager/src/lib/genieacs/` (NBI client, models, services) and Cloud Functions that **proxy** or read **MongoDB** collections in the shape GenieACS uses. Install helpers (e.g. `deploy/genieacs-install.js`) may **clone** [github.com/genieacs/genieacs](https://github.com/genieacs/genieacs) on a server. **AGPL-3.0** applies to **GenieACS** itself when you run or modify it as a network service. |
| **Ookla Speedtest** (speedtest.net CLI) | **No.** No Ookla **source** or embedded SDK. | **Bandwidth Test Manager** (sibling repo) installs the **official Speedtest CLI** via Ookla’s apt repo / [install.speedtest.net](https://install.speedtest.net/app/cli/); shell scripts call the `speedtest` **binary** (`-f json`). Use is subject to **Ookla’s EULA** (`speedtest --accept-license`). |

---

## 2. Copyleft / separate products (not MIT)

| Component | License | Notes |
|-----------|---------|--------|
| **GenieACS** (TR-069/ACS, when used) | [AGPL-3.0](https://github.com/genieacs/genieacs/blob/master/LICENSE) | Server-side network management. If you modify GenieACS and provide it as a network service, AGPL obligations may apply. See upstream project. |
| **Open5GS** / similar cores (when integrated) | GPL-2.0 / AGPL variants per component | Deployed by operators per vendor documentation. |

This repo’s **MIT** license does **not** apply to those upstream projects.

---

## 3. Hosted services & commercial APIs (terms of use, not SPDX)

Use is subject to each provider’s terms (not replaced by this MIT license):

| Service | Typical use in this stack |
|---------|---------------------------|
| **Google Firebase** (Auth, Hosting, Functions, Firestore, etc.) | [Firebase Terms](https://firebase.google.com/terms) |
| **MongoDB Atlas** | [Atlas Terms](https://www.mongodb.com/legal/terms-of-use) |
| **Esri ArcGIS** (Maps SDK for JavaScript, location services) | [Esri Terms of Use](https://www.esri.com/legal/terms/full-master-agreement) ; [ArcGIS API for JavaScript](https://developers.arcgis.com/javascript/latest/) |
| **Stripe** | [Stripe Services Agreement](https://stripe.com/legal/ssa) |
| **PayPal** (billing integration) | [PayPal Legal](https://www.paypal.com/us/legalhub/home) |
| **Google Fonts** (landing page) | Fonts served from Google; **DM Sans** under [SIL Open Font License 1.1](https://fonts.google.com/specimen/DM+Sans) |
| **placehold.co** (placeholder images on static landing) | Third-party image service; see [placehold.co](https://placehold.co/) |

---

## 4. Direct open-source dependencies (npm) by package

Below are **direct** `dependencies` from each app’s `package.json`. Transitive dependencies (hundreds of packages) are subject to their own licenses; most are **MIT**, **Apache-2.0**, **ISC**, or **BSD**-family. To list all production licenses locally:

```bash
cd Module_Manager && npx license-checker@25.0.1 --production --direct --csv
cd ../functions && npx license-checker@25.0.1 --production --direct --csv
cd ../backend-services && npx license-checker@25.0.1 --production --direct --csv
```

### Module Manager (SvelteKit app — `Module_Manager/`)

| Package | SPDX / notes |
|---------|----------------|
| `@arcgis/core` | Esri — **see [Esri terms](https://developers.arcgis.com/javascript/latest/)** (not a single SPDX; use complies with Esri developer agreement) |
| `@stripe/stripe-js` | MIT |
| `@sveltejs/adapter-node`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte` | MIT |
| `echarts` | Apache-2.0 |
| `express` | MIT |
| `firebase` (JS SDK) | Apache-2.0 |
| `leaflet` | BSD-2-Clause |
| `mongodb` (driver) | Apache-2.0 |
| `svelte` | MIT |
| `vis-network` | MIT / Apache-2.0 (dual; per [vis-network](https://github.com/visjs/vis-network)) |

### Firebase Cloud Functions (`functions/`)

| Package | SPDX / notes |
|---------|----------------|
| `axios` | MIT |
| `axios-retry` | Apache-2.0 |
| `cors` | MIT |
| `firebase-admin` | Apache-2.0 |
| `firebase-functions` | MIT |
| `mongodb` | Apache-2.0 |

### Backend API (`backend-services/`)

| Package | SPDX / notes |
|---------|----------------|
| `@paypal/checkout-server-sdk` | Apache-2.0 (PayPal SDK; also subject to PayPal terms) |
| `axios`, `axios-retry` | MIT / Apache-2.0 |
| `cors`, `express`, `multer` | MIT |
| `dotenv` | BSD-2-Clause |
| `firebase-admin` | Apache-2.0 |
| `mongodb`, `mongoose` | Apache-2.0 / MIT |
| `net-snmp` | MIT |
| `nodemailer` | MIT-0 |
| `ping` | MIT |

### Field app (`wisp-field-app/` — React Native)

| Package | SPDX / notes |
|---------|----------------|
| `react`, `react-native` | MIT |
| `@react-navigation/*` | MIT |
| `@react-native-firebase/*` | Apache-2.0 |
| `axios` | MIT |
| Other listed packages | Predominantly MIT; run `license-checker` in that directory for a full export. |

---

## 5. Tooling (build / dev only)

TypeScript, Vite, ESLint, Prettier (if used), and other **devDependencies** are used only during development and builds. They are not required to **run** the production app in the browser or on the server. Their licenses are typically MIT or Apache-2.0.

---

## 6. Updates

- Regenerate dependency trees after major `npm` upgrades.
- When adding a **copyleft** (GPL/AGPL) runtime dependency, update this file and **Legal** review is recommended.

---

**Last updated:** March 2026 (manual; verify with `license-checker` before releases).
