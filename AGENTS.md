# Mailshade Repository Instructions

## Default completion contract

Classify every request before acting:

- A read-only request, such as a question, explanation, review, audit,
  diagnosis, or status report, does not authorize repository changes or
  trigger delivery.
- A change request that creates, edits, moves, or deletes a repository file is
  a delivery request. The user does not need to separately ask to commit, push,
  open a pull request, or merge.
- If the user explicitly sets a boundary such as `local only`, `do not commit`,
  `do not push`, or `stop before merge`, follow that boundary instead.

For every delivery request, the work is not complete until Codex has:

1. Inspected the repository, branch, remote, GitHub authentication, and working
   tree; preserved unrelated user changes; and excluded credentials, captures,
   caches, generated output, and other out-of-scope files.
2. Switched GitHub CLI to `Shiloh-tr` and verified that exact login before any
   GitHub write. Never log out, overwrite, or otherwise disturb another stored
   GitHub account.
3. Started from an up-to-date `main` on a focused branch that follows
   `CONTRIBUTING.md`, or reused the current branch only when it represents the
   same focused change.
4. Implemented and reviewed the requested diff.
5. Run `npm run lint` and `npm test`.
6. Created a focused Conventional Commit, pushed the branch with local Git, and
   opened a ready pull request into `main` with authenticated `gh`.
7. Monitored `CI / quality` and `Repository policy / policy`, fixed failures on
   the same branch, and never bypassed or dismissed them.
8. Squash-merged only after all applicable checks succeeded, then verified the
   `Version tag` workflow when the pull-request type calls for a release.
9. Updated local `main`, removed the merged local branch, and reported the pull
   request, merge, checks, and resulting tag or intentional no-tag result.

Do not declare a delivery request complete merely because files were edited or
committed. Authentication failures, merge conflicts, persistent CI failures,
or uncertainty about unrelated work are blockers: investigate safe in-scope
remedies, but do not bypass the delivery flow or silently broaden scope.

## GitHub operations

- The canonical repository is `Shiloh-tr/mailshade`.
- Before every GitHub write, run
  `gh auth switch --hostname github.com --user Shiloh-tr` and verify
  `gh api user --jq .login` returns `Shiloh-tr`.
- Use local Git for repository and branch operations and authenticated `gh` for
  pull requests, checks, merges, workflows, releases, and GitHub API calls.
- GitHub native auto-merge is not the delivery gate. Wait actively for green
  checks, then merge with `gh pr merge --squash`.
- Website deployment is not part of this repository's delivery contract.
