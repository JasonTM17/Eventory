# Contributing to Eventory

## Workflow

1. Read the relevant phase in [`plans/20260801-eventory-platform`](./plans/20260801-eventory-platform/).
2. Keep file ownership and module boundaries explicit.
3. Implement a small logical slice with tests for happy and failure paths.
4. Run formatting, linting, type checking, and the narrowest relevant test suite.
5. Stage only intended files and run a secret scan before committing.

## Commit format

Use Conventional Commits with a focused scope, for example:

```text
feat(seating): add atomic redis seat holds
test(bookings): cover duplicate payment callbacks
docs(architecture): document payment confirmation sequence
```

Do not mix unrelated domains, generated files, or drive-by formatting in the same commit.

## Pull requests

Describe the behavior changed, the invariants protected, checks run, migration impact, and any follow-up work. A PR is not ready when tests are merely expected to pass; include fresh command output.

## Local services

Use Docker Compose for PostgreSQL, Redis, Mailpit, API, and web. `docker compose
up --build` is the full-stack smoke path; `docker compose up -d postgres redis
mailpit` is the lighter host-development path. Never use production credentials
locally or commit a local `.env` file.

Pull requests must pass the same format, lint, typecheck, Prisma migration,
API test, web build, audit, Compose validation, and image-build checks defined
in `.github/workflows/pull-request.yml`.

## Line endings

Text files are normalized and checked out as LF through `.gitattributes`, so
local formatting checks match Linux CI. A Windows checkout created before that
policy may still contain CRLF files after pulling the update. If
`pnpm format:check` reports widespread line-ending differences, keep any
uncommitted work and use a fresh clone or worktree at the current commit.
