# Repository Guidelines

## Project Structure & Module Organization

- `server/` contains the FastAPI backend. Main API entrypoint: `server/app/main.py`.
- `interface/` contains the React + TypeScript frontend built with Vite.
- `db/` stores the portable SQLite seed database and ticket templates bundled into Windows builds.
- `tests/` contains backend unit tests. Frontend unit tests live next to utilities in `interface/src/utils/*.test.ts`.
- `launcher.py` starts the embedded backend, opens the browser UI, and handles Windows tray/runtime behavior.

## Build, Test, and Development Commands

- `node scripts/dev.mjs` starts local backend + frontend development flow.
- `cd interface && npm run build` builds the frontend into `interface/dist`.
- `cd interface && npm test` runs frontend Vitest tests.
- `.venv/bin/python -m pytest -q tests` runs backend tests.
- `powershell -ExecutionPolicy Bypass -File .\build_windows.ps1` builds the Windows executable.

## Coding Style & Naming Conventions

- Python follows PEP 8: 4-space indentation, snake_case for functions, PascalCase for classes.
- TypeScript/React uses PascalCase for components, camelCase for helpers/hooks, and co-located page/component files under `interface/src/`.
- Keep functions small, prefer explicit data mappers, and reuse shared helpers from `server/app/` and `interface/src/utils/`.

## Testing Guidelines

- Backend tests use `pytest`; frontend tests use `vitest`.
- Name backend files `tests/test_*.py`.
- Name frontend tests `*.test.ts` next to the tested utility/module.
- Add targeted unit tests for every parser, layout helper, and print/rendering rule change.

## Commit & Pull Request Guidelines

- Use short imperative commit messages, for example: `Fix ticket image update` or `Add report settings preview`.
- One logical change per commit.
- PRs should include: purpose, key files changed, test proof, and screenshots for UI changes.

## Windows Packaging Notes

- The app is portable first: runtime data should live near the executable when writable.
- If you change bundled defaults, verify `db/app.sqlite3`, `db/templates/`, and `build_windows.ps1` stay in sync.
