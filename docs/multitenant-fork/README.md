# Multitenant fork (documentation hub)

This folder holds **migration and restoration** notes for operators who want a **separate codebase or branch** oriented toward multitenant SaaS again, while the default product line stays **single-tenant**.

## Contents

| Document | Purpose |
|----------|---------|
| [MULTITENANT_RESTORATION.md](./MULTITENANT_RESTORATION.md) | What to re-enable, env vars to clear, and rough order of work |
| [SINGLE_TENANT_MODE.md](../guides/SINGLE_TENANT_MODE.md) | How single-tenant mode works today (inverse checklist) |

## Git branch

A branch named **`multitenant-migration`** is created in this repo at the same commit as these docs. Use it as a stable pointer when you:

- Push to a **second remote** (e.g. `WISPTools-multitenant`) for long-lived multitenant work, or  
- Open PRs that should **not** land on your single-tenant `main` until you are ready.

Example:

```bash
git remote add multitenant git@github.com:YOUR_ORG/WISPTools-multitenant.git
git checkout multitenant-migration
git push -u multitenant multitenant-migration
```

You can merge or rebase from `main` periodically to pick up shared fixes.

## Cursor

Project hooks under `.cursor/hooks/` remind the agent where multitenant documentation lives. Adjust `.cursor/hooks.json` if you rename paths.
