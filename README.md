# Aidecis website

Dedicated repository for the public Aidecis website at www.aidecis.com. This repository is separate from aidecis-app, aidecis-crm-csm, and LIBI.

The root contains the current static-site baseline and the proposed 2026 transformation. The approved visual package, brand book, payoff, and five screen mockups are kept in docs/brand-refresh-2026/.

All website code changes go through a branch and pull request. Every merge to `main` publishes the static site to TransIP over SFTP; see [publishing](docs/publishing.md).

The public [status page](docs/status.md) is generated separately by GitHub Actions every 15 minutes. Preview it with `python3 scripts/status/render.py --sample`, then open `status/index.html`.
