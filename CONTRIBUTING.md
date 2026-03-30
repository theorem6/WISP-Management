# Contributing to WISP Management / wisptools.io

Thanks for helping improve **WISP Management**, the **wisptools.io** stack, and related repos.

## Ways to contribute

| Type | How |
|------|-----|
| **Bugs & features** | Open an [Issue](https://github.com/theorem6/WISP-Management/issues) with repro steps or a clear use case. |
| **Code & docs** | Open a **Pull Request** against `main` (or ask in an issue first for large changes). Keep commits focused; match existing style. |
| **Promote** | Star the repos, share [wisptools.io](https://wisptools.io), and follow **[docs/SHARE_AND_PROMOTE.md](docs/SHARE_AND_PROMOTE.md)** for posts and outreach templates. |

## Repository layout (where to edit)

| Area | Path |
|------|------|
| Web app | `Module_Manager/` (SvelteKit) |
| Node API | `backend-services/` |
| Firebase Functions | `functions/` |
| Static landing | `landing/` |
| Documentation | `docs/` |

## Guidelines

- **Security:** Do not open public issues for undisclosed vulnerabilities—use maintainer contact or GitHub **Security** advisories if enabled.
- **Licensing:** By contributing, you agree your contributions are under the same license as the project ([MIT](LICENSE) for this repo; see [docs/OPEN_SOURCE.md](docs/OPEN_SOURCE.md) for dependencies and copyleft notes).
- **GenieACS fork:** Changes specific to the GenieACS fork live under `genieacs-fork/`—see [genieacs-fork/CONTRIBUTING.md](genieacs-fork/CONTRIBUTING.md) when working there.

## Development

- Frontend: `cd Module_Manager && npm install && npm run dev`
- Backend: see [docs/deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md](docs/deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md) and `backend-services/.env.example`

Questions welcome in **Issues** for maintainers and the community to see.
