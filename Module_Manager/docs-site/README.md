# WISP Management Documentation Site (Deprecated)

**Documentation is now integrated into the main app.** Do not deploy this VitePress site.

- **In-app docs:** Use **/docs** (Documentation home, Reference, Project Status) and **/help** (topic-based help) in the main WISP Management app.
- **Dashboard:** Click the 📖 Documentation button (next to Wizards and Settings) to open `/docs`.
- **Project Status:** `/docs/reference/project-status` summarizes where the project stands and next items.

This folder is kept for reference. Content from `reference/project-status.md` and the docs index has been migrated into the main app at `Module_Manager/src/routes/docs/` and `Module_Manager/src/lib/docs/`. The main app is the single source for in-app documentation; the repo `docs/` folder remains the source of truth for planning and status markdown.

## If you need to run this site locally

```bash
npm install
npm run dev
```

The Firebase Hosting target for this site has been removed; only the main app is deployed.
