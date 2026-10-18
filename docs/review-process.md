# Code review process

Every change goes through a pull request into `main` with CI green. Reviews work like this:

1. Codex (the OpenAI GitHub app) reviews each pull request automatically when it is opened. Ask it again with a
   comment `@codex review` after a batch of fixes, not after every small push: Codex has a usage allowance per
   window, and a review for each push uses it up.
2. When Codex answers with "You have reached your Codex usage limits", the workflow
   `.github/workflows/review-fallback.yml` runs a Claude review of that commit and posts it as a PR comment
   ("Claude review (fallback...)"). It runs only for that request.
3. The next `@codex review` goes to Codex again. When its window has reset it reviews; if not, Claude takes it again.
   Nothing needs to know the reset time.
4. A person can start a Claude review by hand: Actions, "Review fallback (Claude)", Run workflow, with the PR number.

Setup (once per repository, by a repository admin): add the secret `ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN`
(created with `claude setup-token`, which uses a Claude subscription instead of API billing). Without a secret the
workflow skips itself.

Limits to know:
- It only reviews pull requests from branches in this repository, never forks, because the review runs with a secret.
- Claude gets read-only tools (read, search and `git diff/log/show/status`), but it reads the pull request's own code,
  so a hostile PR author could try to steer the review. Authors are your own team; keep that in mind before using this
  on repositories open to outsiders.
- A Claude review of code that Claude wrote is a second pass, not an independent one. Keep a human look at migrations,
  permissions and anything touching tenant isolation.
- Reviews are posted as one PR comment, not as per-line threads; resolve findings by fixing them and replying.
