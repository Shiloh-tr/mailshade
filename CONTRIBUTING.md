# Contribution and delivery workflow

Every change must be made on a focused branch, reviewed through a pull request,
and squash-merged into `main`.

## Start a change

Begin from an up-to-date `main`:

```sh
git switch main
git pull --ff-only
git switch -c <type>/<short-description>
```

Allowed branch types are `feat`, `fix`, `chore`, `docs`, `refactor`, `test`,
`ci`, `build`, `perf`, and `hotfix`. Use lowercase words separated by hyphens,
such as `feat/outlook-profile` or `fix/gradient-sanitizer`.

## Record and verify the work

Use focused Conventional Commit messages:

```text
feat: add Outlook dark-mode profile
fix: preserve safe gradient fallbacks
docs: clarify Gmail capture requirements
```

Mailshade treats email-client behavior as measured data. Changes to a measured
profile should include:

1. A synthetic fixture that isolates the behavior.
2. Paired light and dark email-body captures from the same client, platform,
   and device combination.
3. Capture metadata: device model, viewport, OS version, email-client version,
   and date.
4. A holdout result demonstrating improvement on unseen emails.
5. Unit tests for the resulting profile branch.

Do not commit credentials, `.env` files, personal messages, complete inbox
screenshots, tracking URLs, captures, dependencies, or generated output.

Before pushing, run:

```sh
npm run lint
npm test
```

## Open and merge a pull request

Push the branch and open a pull request into `main`:

```sh
git push -u origin HEAD
```

The pull-request title must use Conventional Commit format because it becomes
the final squash commit message. Wait for both required checks:

- `CI / quality`
- `Repository policy / policy`

Merge with **Squash and merge** only. Afterward, update the local checkout and
delete the merged branch.

## Automatic version tags

After a pull request is squash-merged into `main`, the `Version tag` workflow
uses its title and body to create an annotated Semantic Version tag:

- `feat!:` or a `BREAKING CHANGE:` footer increments the major version.
- `feat:` increments the minor version.
- `fix:`, `perf:`, and `hotfix:` increment the patch version.
- `build:`, `chore:`, `ci:`, `docs:`, `refactor:`, and `test:` do not create a
  tag unless they declare a breaking change.

Scopes are supported, such as `feat(gmail-ios): add compositing anchors`. Tags
use `vMAJOR.MINOR.PATCH`. Git tags are the release source of truth; the workflow
does not update `package.json` or create GitHub Releases.

## GitHub repository settings

The canonical public repository is `Shiloh-tr/mailshade`. It allows only squash
merging and deletes merged branches automatically. A `main` ruleset requires a
pull request, resolved conversations, up-to-date branches, and the two checks
listed above; it also blocks force pushes and deletion without routine bypass.

GitHub CLI may retain multiple accounts. Before writing to this repository,
select and verify the owner account:

```sh
gh auth switch --hostname github.com --user Shiloh-tr
gh api user --jq .login
```

Publishing the repository does not deploy the Mailshade website. Application
hosting is a separate workflow and is intentionally out of scope.
