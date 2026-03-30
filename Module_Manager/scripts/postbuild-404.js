/**
 * Copy index.html to 404.html for SPA fallback on Firebase Hosting (management site).
 * Ensures errorDocument and direct /path requests serve the app.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'build', 'client');
const indexPath = path.join(clientDir, 'index.html');
const notFoundPath = path.join(clientDir, '404.html');

if (!fs.existsSync(indexPath)) {
  console.error('✗ build/client/index.html not found. Run build first.');
  process.exit(1);
}
fs.copyFileSync(indexPath, notFoundPath);
console.log('  created 404.html for SPA fallback');
