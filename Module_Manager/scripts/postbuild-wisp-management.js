/**
 * Post-build: move Svelte app under /wisp-management and install landing at /
 * - build/client/ becomes the Firebase Hosting root
 * - build/client/index.html = landing page (wisptools.io/)
 * - build/client/wisp-management/* = WISP Management app (wisptools.io/wisp-management)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'build', 'client');
const wispDir = path.join(clientDir, 'wisp-management');
const landingSrc = path.join(__dirname, '..', 'static', 'landing.html');

if (!fs.existsSync(clientDir)) {
  console.error('✗ build/client not found. Run build first.');
  process.exit(1);
}

// Create wisp-management subdir
if (!fs.existsSync(wispDir)) {
  fs.mkdirSync(wispDir, { recursive: true });
}

// Move app entry and assets into wisp-management
const toMove = ['index.html', '_app', 'favicon.svg', 'wisptools-logo.svg'];
for (const name of toMove) {
  const src = path.join(clientDir, name);
  const dest = path.join(wispDir, name);
  if (fs.existsSync(src)) {
    if (fs.statSync(src).isDirectory()) {
      copyDir(src, dest);
      rmDir(src);
    } else {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    }
    console.log('  moved', name, '→ wisp-management/');
  }
}

// SPA fallback for app routes
const appIndex = path.join(wispDir, 'index.html');
if (fs.existsSync(appIndex)) {
  fs.copyFileSync(appIndex, path.join(wispDir, '404.html'));
  console.log('  created wisp-management/404.html');
}

// Install landing page and assets at root
if (!fs.existsSync(landingSrc)) {
  console.error('✗ static/landing.html not found.');
  process.exit(1);
}
fs.copyFileSync(landingSrc, path.join(clientDir, 'index.html'));
fs.copyFileSync(landingSrc, path.join(clientDir, '404.html'));
console.log('  installed landing page at index.html and 404.html');

const staticDir = path.join(__dirname, '..', 'static');
const landingCss = path.join(staticDir, 'landing.css');
const logo = path.join(staticDir, 'wisptools-logo.svg');
if (fs.existsSync(landingCss)) {
  fs.copyFileSync(landingCss, path.join(clientDir, 'landing.css'));
  console.log('  installed landing.css');
}
if (fs.existsSync(logo)) {
  fs.copyFileSync(logo, path.join(clientDir, 'logo.svg'));
  console.log('  installed logo.svg');
}

console.log('✓ Post-build complete: / = landing, /wisp-management = app');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function rmDir(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) rmDir(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}
