# Portfolio and package scout — 2026-08-03

## Relevant files

- `README.md` — has two local runtime screenshots and truthful local/demo
  limits; no GIF or exported diagram.
- `assets/images/` — contains discovery and seat-map PNG evidence only.
- `docs/architecture/*.md` — current topology and lifecycle source material in
  Mermaid.
- `packages/config`, `packages/contracts`, `packages/ui` — compiled shared
  packages without `files` allow-lists; dry runs include `.turbo`, source, and
  TypeScript build metadata.
- `.github/workflows/main.yml` and `pull-request.yml` — run broad quality/image
  gates but do not check reusable-package payloads.
- `origin/main` — 17 commits behind local `main`; every listed branch tip is
  already an ancestor of local `main`.

## Decisions

- Use current-source isolated Compose capture for media; never use mockups.
- Use `assets/images/` for screenshots/GIF and `assets/diagrams/` for SVG/PNG.
- Keep workspace packages private; validate packaging only.
- Push only after local package/media/docs/review gates pass.

## Environment notes

- `agent-browser` is healthy.
- ImageMagick is available; FFmpeg and `rsvg-convert` are absent, so GIF/PNG
  conversion uses ImageMagick and its SVG renderer.
- GitHub authentication is active with repository and package-write scopes.

## Unresolved questions

- Public deployment URL and license remain owner decisions.
