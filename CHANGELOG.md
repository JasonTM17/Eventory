# Changelog

All notable release changes are documented here. Eventory follows Semantic Versioning while the project remains in initial `0.x` development.

## [Unreleased]

## [0.1.2] - 2026-08-04

### Added

- MIT License coverage for the repository, workspace manifests, and OCI images.
- Cinema-style event discovery, showtime selection, auditorium seating, checkout, and branded ticket wallet.
- A 140-seat demo auditorium across ten database-backed rows with balanced aisles and live availability.
- Role-aware account navigation and safe post-authentication redirects.

### Changed

- Ticket passes now render the real API-signed QR payload in a responsive, branded admission layout.
- Discovery hides expired events and paginates live results while preserving search terms.
- All workspace manifests now publish the synchronized `0.1.2` release version.

### Fixed

- Poster artwork, long titles, ticket QR media, showtimes, and wallet content no longer overflow narrow screens.
- Re-seeding cinema inventory no longer resets seats that have already been sold.
- Anonymous seat holds redirect to sign-in, and failed sign-out attempts remain visible to the user.
- Pinned `fast-uri` to `3.1.5` to resolve its high-severity authority parsing advisory.

## [0.1.1] - 2026-08-03

### Added

- Paired Docker Hub and GitHub Container Registry publication from semantic release tags.
- OCI source, version, revision, provenance, and SBOM metadata for release images.
- Responsive layout regression coverage and verified before/after audit evidence.

### Fixed

- Narrow-screen overflow in organizer workspace forms, seat selection, hold actions, and checkout summaries.

## [0.1.0] - 2026-08-03

### Added

- Initial event discovery, organization, seating, booking, mock payment, ticket wallet, QR check-in, analytics, and admin flows.
- PostgreSQL/Redis/Mailpit Compose runtime, integration harness, observability profile, CI validation, runbooks, diagrams, and demo media.
- Private workspace package payload verification and first Docker Hub application images.

[0.1.2]: https://github.com/JasonTM17/Eventory/releases/tag/v0.1.2
[0.1.1]: https://github.com/JasonTM17/Eventory/releases/tag/v0.1.1
[0.1.0]: https://github.com/JasonTM17/Eventory/commit/d66e7b643bf603fdec2e2fb0486e5444f515df87
