---
phase: 13
title: Docker Hub image publication
status: completed
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

- [x] CI built both Dockerfiles for Linux AMD64 from the verified source SHA.
- [x] Docker Hub manifests resolve for semantic and full-SHA tags.
- [x] Pushed API/web images pass non-root/config and file smoke checks that do
      not require production secrets.

## Publication evidence

Source commit: `d66e7b643bf603fdec2e2fb0486e5444f515df87` from green GitHub
Actions run [30810707641](https://github.com/JasonTM17/Eventory/actions/runs/30810707641).

| Image                                  | Tags                                                    | Digest                                                                    |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `docker.io/nguyenson1710/eventory-api` | `0.1.0`, `sha-d66e7b643bf603fdec2e2fb0486e5444f515df87` | `sha256:a210cdc58aa3a4891f2e3d7bdb34863b2f1eb8094f01437e3e1b05f9ae376ea7` |
| `docker.io/nguyenson1710/eventory-web` | `0.1.0`, `sha-d66e7b643bf603fdec2e2fb0486e5444f515df87` | `sha256:fd0b7ee19c5022920f2391ef300771b495166ee48db8a788b212bbadfb5ead0c` |

The CI archives used for registry publication had SHA-256 checksums
`1E91F4317B862A23D96A3BA5D34874FA346C5BB2BB125ED483AB94E93BABC47B`
(API) and
`73897FA672842B768B1708223139C0D1B11DA239B358240CD63D6330DAB69D60`
(web). Registry inspect proved each tag pair resolves to one digest. Digest
smoke checks proved both images run as non-root and contain their expected
runtime entrypoint.

The web build uses the local-stack API URL. Registry publication does not claim
a hosted environment; a public deployment must rebuild the web image with its
actual API origin and provide reviewed production secrets.

## Rollback

Do not delete tags or overwrite immutable SHA tags. If a smoke check fails,
leave the published digest intact, document the failure, and publish a new
corrective SHA tag only after the same gates pass.
