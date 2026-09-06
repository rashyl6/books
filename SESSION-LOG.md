# Session log

What happened in this repo, entry by entry. Each one is written by
`tools/save.sh` at the moment the work was pushed — so this file is the part of
a Claude session that outlives the session. When a cloud environment gets
deleted the transcript goes with it; this does not.

Read it here on github.com, or rendered together with the commit history at
[rashyl6.github.io/books/status.html](https://rashyl6.github.io/books/status.html).

<!-- log -->

### 2026-09-06 12:37 UTC · main

Add Stop hook: auto-commit and push at the end of every turn

- `.claude/settings.json`

### 2026-09-06 12:21 UTC · main

Document the Stop hook as opt-in with its exact config

- `README.md`

### 2026-09-06 12:21 UTC · main

Read the session log from the GitHub API to dodge CDN staleness

- `status.html`

### 2026-09-06 12:20 UTC · main

Fall back to HTTPS when the SSH remote is read-only

- `tools/save.sh`

### 2026-09-06 12:19 UTC · main

Add remote-session workflow: save.sh, session log, status page

- `README.md`
- `status.html`
- `tools/save.sh`
