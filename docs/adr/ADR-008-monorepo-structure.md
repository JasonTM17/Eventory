# ADR-008: Use a pnpm and Turborepo monorepo

- Status: Accepted
- Date: 2026-08-01

## Context

Web, API, shared contracts, UI, and infrastructure scripts must evolve together while keeping build and test boundaries visible.

## Decision

Use pnpm workspaces with Turborepo task orchestration. Applications live under `apps/`; reusable contracts/config/UI under `packages/`; operational material under `infrastructure/`, `scripts/`, and `docs/`.

## Consequences

One lockfile and shared tooling make compatibility review easier. Package
direction is currently expressed through workspace manifests and review
conventions; lint does not yet enforce browser/server import boundaries.

## Alternatives considered

- Separate repositories: rejected for a portfolio system whose API and UI contracts change together.
- A single package: rejected because it hides ownership and makes CI scope less precise.
