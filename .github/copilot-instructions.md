# Copilot Instructions for Job Tracker

## Build, Test, and Lint Commands

### Building
- **Full build:** `npm run build` - Cleans dist, compiles TypeScript, and copies assets
- **Dev start (with source maps):** `npm run start:dev` - Run the compiled server with debugging support

### Testing
- **All tests:** `npm run test` - Runs both unit and integration tests
- **Unit tests only:** `npm run test:unit` 
- **Integration tests only:** `npm run test:integration`
- **Single test file:** `npm run test:unit -- path/to/test.spec.ts`
- **Watch mode:** `npm run test:unit -- --watch`

### Linting and Formatting
- **Format check:** `npm run format` - Check code formatting with Prettier
- **Fix formatting:** `npm run format:fix` - Apply Prettier formatting
- **Lint check:** `npm run lint` - Run ESLint checks
- **Fix linting issues:** `npm run lint:fix` - Auto-fix ESLint issues
- **Lint OpenAPI spec:** `npm run lint:openapi` - Validate OpenAPI3 specification
- **Note:** `npm run prelint` runs `npm run format` before linting; `npm run prelint:fix` runs `npm run format:fix` before lint:fix

## High-Level Architecture

### Overview
Job Tracker is an Express.js service that tracks the state of raster jobs and tasks. External services notify Job Tracker of completed tasks, and Job Tracker orchestrates subsequent tasks, updates job progress, and handles job failures.

### Key Layers

1. **Controllers (`src/tasks/controllers/`)** - Handle HTTP requests; inject dependencies and delegate business logic
2. **Managers (`src/tasks/models/`)** - Core business logic; manage state transitions and orchestration
3. **Handlers (`src/tasks/handlers/`)** - Strategy pattern for different job types (ingestion, export, seed); inherit from `BaseJobHandler`
4. **Rules (`src/tasks/rules/`)** - Validation and business rules applied during task processing
5. **Utils (`src/utils/`)** - Shared utilities for job/task operations
6. **Routes (`src/tasks/routes/`)** - Express route definitions

### Dependency Injection
Uses **tsyringe** with a singleton pattern via `DependencyContainer`. Key patterns:

- Services are registered as `Symbol` keys in `src/common/constants.ts` under the `SERVICES` object
- Dependencies are registered in `src/containerConfig.ts` via the `registerExternalValues()` function
- Controllers and managers use `@injectable()` decorators and `@inject()` for constructor injection
- The DI container is initialized at startup (`src/index.ts`) and passed through the app

### Error Handling
- Custom error types in `src/common/errors.ts` (e.g., `IrrelevantOperationStatusError`)
- Controllers catch errors and map domain errors to appropriate HTTP status codes
- The error handler middleware (from `@map-colonies/error-express-handler`) processes errors and returns consistent responses

### Configuration
- Uses the `config` npm package for environment-based configuration
- Config files in `config/` directory (default.json, production.json, test.json, etc.)
- Environment variables defined in `custom-environment-variables.json` override config file values
- Loaded at runtime via `import config from 'config'`

### Logging and Tracing
- Logger service injected as `SERVICES.LOGGER` (from `@map-colonies/js-logger`)
- Tracing initialized via `src/common/tracing.ts` (OpenTelemetry)
- Certain routes ignored from tracing (metrics, docs) via `IGNORED_*_TRACE_ROUTES`

## Key Conventions

### File Organization
- TypeScript strict mode enabled; all files must have proper typing
- Source organized by feature (tasks) with internal structure: controllers, models (managers), handlers, routes, utils
- Integration and unit tests under `tests/integration/` and `tests/unit/` respectively
- Each test type has a separate Jest configuration (`jest.config.js`)

### Naming Patterns
- Service tokens use PascalCase with `Symbol()` in `SERVICES` constant
- Request handlers use `<Domain><Action>Handler` naming (e.g., `TaskNotificationHandler`)
- Handler classes use `<JobType>Handler` suffix (e.g., `IngestionHandler`, `ExportHandler`)
- Managers use `*Manager` suffix (e.g., `TasksManager`)

### Class Decorators and Patterns
- All injectable classes must use `@injectable()` decorator
- Constructor dependencies injected with `@inject(TokenOrKey)` decorator
- Handlers use the factory pattern: `JobHandlerFactory` resolves the appropriate handler based on job type
- Base classes like `BaseJobHandler` provide common functionality; handlers extend and override specific methods

### Error Handling
- Create custom error classes extending `Error` for domain-specific exceptions
- Map errors to HTTP status codes in controllers (use `http-status-codes` constants)
- Log errors with context (message, stack trace) before passing to error middleware

### Testing
- Unit tests for managers and business logic
- Integration tests for full request/response flows using `supertest`
- Mock HTTP calls with `nock` library
- Use `jest-openapi` for OpenAPI validation in tests
- Test files named `*.spec.ts` or `*.test.ts`

### TypeScript Configuration
- Multiple tsconfig files for different purposes:
  - `tsconfig.json` - Development
  - `tsconfig.build.json` - Production build (excludes tests)
  - `tsconfig.lint.json` - Linting
  - `tsconfig.test.json` - Tests
- Decorators and metadata emission enabled for tsyringe support

### Code Quality
- Prettier config via `@map-colonies/prettier-config` (no overrides)
- ESLint config extends `@map-colonies/eslint-config/jest` and `@map-colonies/eslint-config/ts-base`
- Pre-commit hooks run Prettier on staged files via husky
- Commit messages validated with commitlint using conventional changelog format

### API Documentation
- OpenAPI 3.0 specification in `openapi3.yaml` at repository root
- Linted with `redocly`; updated when endpoint changes occur
- Viewable via `/docs` endpoint (served by `@map-colonies/openapi-express-viewer`)

### Environment Variables
- Server port: `SERVER_PORT` (default 8080)
- Job Manager integration: `JOB_MANAGER_BASE_URL` (default localhost:8081)
- Job names (e.g., `JOB_DEFINITIONS_JOB_NEW`, `JOB_DEFINITIONS_JOB_UPDATE`)
- Task names (e.g., `JOB_DEFINITIONS_TASK_INIT`, `JOB_DEFINITIONS_TASK_MERGE`)
- HTTP retry settings: `HTTP_RETRY_ATTEMPTS`, `HTTP_RETRY_DELAY`, `HTTP_RETRY_RESET_TIMEOUT`
- Logging: `LOG_LEVEL`, `LOG_PRETTY_PRINT_ENABLED`
- Telemetry: `TELEMETRY_TRACING_ENABLED`, `TELEMETRY_METRICS_ENABLED` with corresponding URLs

### Dependencies
- **Framework:** Express.js
- **DI Container:** tsyringe with `reflect-metadata` for decorator support
- **HTTP Client/Retry:** Built-in with retry logic (not axios or node-fetch)
- **Validation:** `express-openapi-validator` for request/response validation against OpenAPI spec
- **Health Checks:** `@godaddy/terminus` for graceful shutdown
- **Telemetry:** OpenTelemetry (`@opentelemetry/api` and `@map-colonies/telemetry`)
- **Logging:** `@map-colonies/js-logger`
- **Model Types:** `@map-colonies/mc-model-types` (shared types for map-colonies ecosystem)

### Development Node Version
- Node.js >= 24.0.0 required (ES2021 target)
