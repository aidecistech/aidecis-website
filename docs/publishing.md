# Publishing the website

aidecis.com runs on TransIP web hosting. Every merge to `main` publishes it automatically over SFTP (`.github/workflows/publish.yml`), then checks that the live site serves exactly the files in `main`. The run fails if anything differs. Files that exist only on the server are never deleted.

What is published: the HTML pages, `robots.txt`, `sitemap.xml`, `assets/`, `demo/` and `demo-v9.1/`. Not published: `docs/`, `.github/`, `README.md`.

## One-time setup

1. **TransIP** (Neil): in the control panel, open web hosting for aidecis.com, then the SSH/SFTP settings. Switch SFTP on and set a password for the SFTP user. Note the **host name**, the **user name** and the folder that holds the site, usually `www`.
2. **GitHub, the password** (Neil): in aidecistech/aidecis-website, open **Settings → Secrets and variables → Actions → New repository secret**. Name it `TRANSIP_SFTP_PASSWORD` and paste the SFTP password. Nobody else ever sees it, including Claude.
3. **GitHub, the rest** (Claude, once Neil sends the host name and user name, which are not secret): set the repository variables `TRANSIP_SFTP_HOST`, `TRANSIP_SFTP_USER` and `TRANSIP_SFTP_PATH`, and `TRANSIP_SFTP_KNOWN_HOSTS`, which pins the server's host key so the workflow never talks to an impostor.
4. **First run:** Actions → *Publish website to TransIP* → Run workflow with **dry run** ticked. It lists what would be uploaded and changes nothing. Then run it once without dry run, or merge a pull request.

Until `TRANSIP_SFTP_HOST` is set, the workflow does nothing, so merging it changes nothing yet.

## Rolling back

- **A content change:** revert that pull request on GitHub. The revert is a merge to `main`, so the previous content is published the same way.
- **Directly to an earlier version:** Actions → *Publish website to TransIP* → Run workflow. Untick **dry run** and enter the earlier commit under **ref**. This publishes that commit's files and checks them, whatever the workflow's own history.
- Never roll back by reverting the publishing workflow itself: without it, nothing is published. Use the run above instead.
