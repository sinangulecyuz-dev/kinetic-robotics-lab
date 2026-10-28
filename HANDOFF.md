# Kinetic — shared handoff

Codex and Claude Code work on this repository one after the other. This file is the record they share: where the work stands, what was decided, and what the last session did. The protocol for reading and updating it is in `AGENTS.md` under "Handoff between Codex and Claude Code".

Status words used below: **local** (changed in the working tree, not committed), **committed**, **pushed** (on `origin/main`), **deployed** (published to the ChatGPT Sites prototype). Pushing never deploys.

## Current state

Last verified 2026-10-28 by Claude Code. Verify again with Git before relying on it.

- Single branch `main`, kept equal to `origin/main` (check with `git status --short --branch`). Remote: `github.com/sinangulecyuz-dev/kinetic-robotics-lab`.
- Milestone 1 exists: a differential-drive rover with adjustable structure and payload, the ramp-balance experiment, the bounded pseudocode controller, and the local experiment notebook (browser localStorage key `kinetic-v1`). The README and `AGENTS.md` describe the physics boundaries.
- Verification on 2026-10-28: `npm test` 7/7 pass, `npm run check` passes.
- Hosting: the only deployment is the private ChatGPT Sites prototype (https://kinetic-robotics-lab.famousbadge2.chatgpt.site). It has not been updated from this repository, and the date it was last published is not recorded.
- Dev server: `npm run dev` listens on **127.0.0.1:5173 only**. Open http://127.0.0.1:5173. `http://localhost:5173` can fail when `localhost` resolves to IPv6 `::1` first (curl failed this way on 2026-10-28). If the port is busy (`EADDRINUSE`), a server from an earlier session is usually still running. Check it in PowerShell with `Get-NetTCPConnection -LocalPort 5173` before starting another one.

## Open items

- **Known issue, not fixed:** `scripts/serve.mjs` prints `http://localhost:5173`, and the README and `AGENTS.md` say the same, but the server binds `127.0.0.1` only. The owner has not asked for a fix.
- Roadmap: README, section "Next bricks" (physical validation of the rover comes first).

## Decisions

- One branch only: all work is committed on `main` and pushed there. No feature branches (owner's decision, 2026-10-28).
- Design skill: Emil Design Engineering, kept at `docs/design-engineering.md`. It is identical to the copy installed for Claude Code (`~/.claude/skills/emil-design-eng`) and the shared copy (`~/.agents/skills/emil-design-eng`).
- This file is the single shared record. Claude Code's project memory lives outside the repository, and Codex does not read it reliably. Anything the other tool needs goes here.

## Session log

Newest first. Keep about the last 10 entries. Fold older ones into "Current state" or "Decisions" instead of letting the file grow.

Entry template:

```md
### YYYY-MM-DD — Codex | Claude Code — short task name
- Changed: files, commit hashes
- Verified: commands actually run, with results (say what was not verified)
- Status: local | committed | pushed | deployed
- Next / open: what remains, decisions waiting for the owner
```

### 2026-10-28 — Claude Code — handoff setup

- Changed: added `HANDOFF.md`, a handoff section in `AGENTS.md`, a pointer line in `CLAUDE.md`, and one sentence in the README's "Continue in Codex or Claude Code" section.
- Verified: `npm test` 7/7, `npm run check` pass (no application code changed). The dev server was already running from an earlier session (`node scripts/serve.mjs`, PID 45760) and answered 200 on 127.0.0.1:5173. It was left running.
- Status: committed (`053be47`), fast-forwarded into `main`, and pushed. The temporary `chore/codex-handoff` branch was deleted locally and on GitHub.
- Next / open: development starts next.
