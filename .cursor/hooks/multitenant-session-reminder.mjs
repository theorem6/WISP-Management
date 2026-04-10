#!/usr/bin/env node
/**
 * Cursor project hook: sessionStart — fail-open.
 * Multitenant migration docs: docs/multitenant-fork/README.md
 * Single-tenant ops: docs/guides/SINGLE_TENANT_MODE.md
 */
async function main() {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
  }
  process.stdout.write(JSON.stringify({}));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
});
