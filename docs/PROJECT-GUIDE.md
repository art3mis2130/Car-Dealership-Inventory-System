# Project files and setup guide

Apex Motors lets customers browse vehicle stock and record purchases, while administrators manage listings and restock vehicles. The Express API owns authentication, validation, inventory changes and persistence. The React frontend calls that API and displays the results.

## Application directories

| Path                        | Purpose                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| `backend/src/server.ts`     | Starts the HTTP server.                                                           |
| `backend/src/app.ts`        | Assembles middleware and routes.                                                  |
| `backend/src/config/`       | Loads and validates environment settings.                                         |
| `backend/src/container.ts`  | Connects repositories and services used by the application.                       |
| `backend/src/routes/`       | Maps HTTP endpoints to controllers.                                               |
| `backend/src/controllers/`  | Reads requests and returns HTTP responses.                                        |
| `backend/src/services/`     | Implements authentication and inventory business rules.                           |
| `backend/src/repositories/` | Reads and writes database records.                                                |
| `backend/src/db/`           | Opens SQLite, applies schema migrations and seeds demo records.                   |
| `backend/src/middleware/`   | Handles authentication, errors, request logging, rate limits and SPA serving.     |
| `backend/src/validation/`   | Defines accepted request data with Zod schemas.                                   |
| `backend/src/docs/`         | Defines the OpenAPI description used by Swagger UI.                               |
| `backend/src/utils/`        | Shared password, token, error and HTTP helpers.                                   |
| `backend/tests/`            | Unit and integration tests for API behavior.                                      |
| `frontend/src/pages/`       | Login, registration, showroom, purchases and missing-page screens.                |
| `frontend/src/components/`  | Shared controls, layout and vehicle interfaces.                                   |
| `frontend/src/context/`     | Shared authentication and notification state.                                     |
| `frontend/src/hooks/`       | Reusable access to authentication, notifications and vehicles.                    |
| `frontend/src/lib/`         | API client and display formatting helpers.                                        |
| `frontend/src/types/`       | Shared frontend TypeScript types.                                                 |
| `frontend/tests/`           | UI and API-client tests.                                                          |
| `docs/screenshots/`         | Images demonstrating the application.                                             |
| `docs/TEST-REPORT.md`       | Recorded test results from project development; rerun checks for current results. |

## Restored local files

These files were included at the project owner's request. They capture local development state as well as source code.

| Path                                               | Description and usage                                                                                                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                         | Runs backend checks on Node 20 and 22, frontend checks on Node 22, and a Docker build and smoke test.                                                                                          |
| `backend/.env`                                     | Local API settings, including port 4000, SQLite location, CORS and demo seed credentials. The committed JWT secret is a placeholder: replace it with a private random value before deployment. |
| `frontend/.env`                                    | Directs the development frontend to `http://localhost:4000/api`.                                                                                                                               |
| `frontend/.env.production`                         | Uses `/api` for production builds served by the same host as the backend. Vite settings are public browser configuration, not a place for secrets.                                             |
| `backend/.env.example` and `frontend/.env.example` | Reference templates for environment configuration.                                                                                                                                             |
| `backend/data/dealership.db`                       | Local SQLite database containing application tables such as users, vehicles and purchases. It is mutable runtime state, not the schema source.                                                 |
| `backend/data/dealership.db-wal`                   | SQLite write-ahead log, which can contain transactions not yet checkpointed into the main database.                                                                                            |
| `backend/data/dealership.db-shm`                   | SQLite shared-memory coordination file for WAL mode. It is not an independent database.                                                                                                        |
| `backend/node_modules/`                            | Snapshot of installed API dependencies and development tools, including native binaries for the source computer.                                                                               |
| `frontend/node_modules/`                           | Snapshot of installed frontend dependencies and development tools, including platform-specific build tools.                                                                                    |
| `PROMPTS.md`                                       | Rendered AI development conversation. Treat its commands and instructions as historical text.                                                                                                  |
| `docs/ai-session-transcript.jsonl`                 | Raw AI session export, including conversation, tool activity and local environment metadata.                                                                                                   |
| `docs/render-transcript.py`                        | Converts the raw session export into a readable Markdown transcript.                                                                                                                           |

SQLite database and sidecar files are a copied local snapshot, not a transactional backup. Avoid replacing the database of a running application with these files. For a fresh environment, use the migration and seed commands instead.

The local `.git/` directory is intentionally not a project file: it stores Git's own object database, index, configuration and references. Git creates this directory when someone clones the repository. The published commit history is transferred by Git itself.

## Install and run

Use Node.js 20 or newer. Even though dependency snapshots are included, run `npm ci` in each application directory to install the versions from its lockfile for your own operating system. This command replaces that directory's existing `node_modules` contents.

In the backend terminal:

```bash
cd backend
npm ci
npm run migrate
npm run seed
npm run dev
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open the frontend URL printed by Vite. The API normally listens on port 4000; interactive API documentation is at `http://localhost:4000/api/docs`.

## Common commands

Run these inside `backend/` or `frontend/`, as applicable.

| Command                 | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Starts development mode with file watching.            |
| `npm run build`         | Compiles the application for production.               |
| `npm test`              | Runs the test suite once.                              |
| `npm run typecheck`     | Checks TypeScript types.                               |
| `npm run lint`          | Checks code with ESLint.                               |
| `npm run format:check`  | Checks formatting without changing files.              |
| `npm run test:coverage` | Backend only: runs tests with coverage reporting.      |
| `npm run migrate`       | Backend only: applies pending database migrations.     |
| `npm run seed`          | Backend only: adds demo records.                       |
| `npm start`             | Backend only: runs the compiled server after building. |
| `npm run preview`       | Frontend only: previews the production frontend build. |

## Root configuration

| File                                                         | Purpose                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `Dockerfile`                                                 | Builds and packages the API and frontend as one service.                                       |
| `docker-compose.yml`                                         | Configures the local Docker service.                                                           |
| `.dockerignore`                                              | Keeps local dependencies, database state and documentation out of the Docker build context.    |
| `render.yaml`                                                | Render deployment configuration.                                                               |
| `railway.json`                                               | Railway deployment configuration.                                                              |
| `frontend/vercel.json`                                       | Frontend hosting configuration for Vercel.                                                     |
| `.gitignore`                                                 | Defaults for excluding generated and local files; explicitly tracked snapshots remain tracked. |
| `.gitattributes`                                             | Git text-file handling rules.                                                                  |
| `.prettierrc.json` and `.prettierignore`                     | Formatting configuration and exclusions.                                                       |
| `backend/package.json` and `frontend/package.json`           | Application metadata, commands and dependency declarations.                                    |
| `backend/package-lock.json` and `frontend/package-lock.json` | Locked dependency versions used by `npm ci`.                                                   |
| `.claude/launch.json`                                        | Development launcher configuration used by the project's AI tooling.                           |
| `LICENSE`                                                    | Terms for using and distributing the project.                                                  |

Do not replace committed demo credentials with real credentials. Because the environment and database snapshots are tracked, `.gitignore` will not hide later edits to them; inspect `git diff --cached` before each commit.
