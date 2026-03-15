#!/usr/bin/env node
/**
 * Generates a secure INTERNAL_API_KEY and prints exact steps to set it
 * for the userTenants Cloud Function (via Firebase Secret Manager) and the backend.
 *
 * Run: node scripts/set-internal-api-key.js
 * Then follow the printed instructions.
 */

const crypto = require('crypto');
const key = crypto.randomBytes(32).toString('base64');

console.log(`
=== INTERNAL_API_KEY setup for /api/user-tenants ===

Use this key in BOTH steps below (same value).

Generated key (copy exactly):
${key}

--- Step 1: Set secret for Cloud Function (one-time) ---

From the project root (WISP Management repo), run:

  firebase functions:secrets:set INTERNAL_API_KEY

When prompted, paste this value:

  ${key}

Then deploy the userTenants function so it picks up the secret:

  firebase deploy --only functions:userTenants

--- Step 2: Backend (hss.wisptools.io) ---

Add to your backend environment (e.g. .env or systemd unit):

  INTERNAL_API_KEY=${key}

Then restart the backend.

--- After both are set ---

  GET https://wisptools.io/api/user-tenants/<userId> should return 200 with tenant list.
`);
