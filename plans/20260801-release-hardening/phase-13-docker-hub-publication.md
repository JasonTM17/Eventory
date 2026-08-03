---
phase: 13
title: Docker Hub image publication
status: pending
priority: P1
effort: '1-2h'
dependencies: [12]
---

# Phase 13: Docker Hub image publication

## Overview

Publish the verified API and web images to Docker Hub only after local quality
gates, code review, focused commits, pushed `main`, and green remote CI. Keep
semantic and immutable full-SHA tags aligned; record digests and provenance in
the release evidence without publishing private npm workspaces.

## Requirements

- Confirm Docker Hub authentication and the owner-approved namespace before a
  push; never print tokens or credentials.
- Build current `apps/api/Dockerfile` and `apps/web/Dockerfile` for the CI
  target platform with the public web API base configured explicitly.
- Tag both images with a release version and the exact verified `main` SHA.
- Push both tags to Docker Hub, inspect immutable digests, and run image
  inspect/smoke checks from the pushed references.
- Record image names, tags, digests, build inputs, and limitations in the
  release plan; do not claim a public deployment from registry publication.

## Validation

- `docker buildx build --platform linux/amd64` succeeds for API and web.
- Docker Hub manifests resolve for semantic and full-SHA tags.
- Pushed API/web images pass non-root/config and health/smoke checks that do
  not require production secrets.

## Rollback

Do not delete tags or overwrite immutable SHA tags. If a smoke check fails,
leave the published digest intact, document the failure, and publish a new
corrective SHA tag only after the same gates pass.
