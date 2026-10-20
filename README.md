# Aidecis website

Dedicated repository for the public Aidecis website at www.aidecis.com. This repository is separate from aidecis-app, aidecis-crm-csm, and LIBI.

The root contains the current static-site baseline and the proposed 2026 transformation. The approved visual package, brand book, payoff, and five screen mockups are kept in docs/brand-refresh-2026/.

All website code changes go through a branch and pull request. Every merge to `main` publishes the static site to TransIP over SFTP; see [publishing](docs/publishing.md).

The public [status page](docs/status.md) is generated separately by GitHub Actions every 15 minutes. Preview it with `python3 scripts/status/render.py --sample`, then open `status/index.html`.

## Static security scanning

The [Semgrep workflow](.github/workflows/semgrep.yml) runs on pull requests to `main`, pushes to `main`, and Mondays at 05:55 UTC. It uses the open-source engine and community packs `p/default`, `p/security-audit`, `p/secrets`, `p/javascript`, and `p/typescript`, without a Semgrep account or telemetry. The directories listed in [.semgrepignore](.semgrepignore) are excluded, including `assets` and `demo-v9.1`.

Findings appear in **Actions → Semgrep → scan → Scan with the community rules (all severities in the log)**. Pull requests report only findings introduced since the base commit; first-party scripts under `assets/` are scanned, only `assets/vendor/`, minified files and generated folders are ignored (`.semgrepignore`). ERROR findings fail the job; WARNING findings remain visible without blocking. Scanner or configuration failures also fail the job. Pushes to `main` and weekly runs scan the full repository within these exclusions and save `semgrep.sarif` and `semgrep.txt` in the run's **Artifacts** for 30 days, including when ERROR findings fail the job. The first push to `main` after merge should produce the first full-scan artifact; check that run to confirm it was uploaded.

The technical lead triages findings. Fix ERROR findings before merging, or document why each is a false positive. To suppress a false positive, add a rule-specific `# nosemgrep: rule-id` comment with a reason. Use the language's comment syntax, for example in JavaScript or TypeScript:

```javascript
// Reason this specific finding is a false positive.
// nosemgrep: rule-id
flaggedStatement();
```

Replace `rule-id` with the exact ID from the finding. Keep the reason next to the suppression and record a note for each suppressed ERROR in the pull request.
