# Release Workflow

This document describes the release process for Android DevKit.

## Scope

Releases are driven from `main` and published from the VS Code extension package in `apps/extension`.

- Branch CI workflow: `.github/workflows/ci.yml`
- Tag publish workflow: `.github/workflows/publish.yml`
- Extension version source: `apps/extension/package.json`
- Release notes source: `CHANGELOG.md`

## Prerequisites

- `bun install`
- Push access to `main`
- `gh` authenticated for checking Actions runs
- Marketplace secrets configured in GitHub Actions:
  - `VSCE_PAT`
  - `OVSX_TOKEN`

## Release Checklist

1. Update release metadata.
2. Run a clean local build.
3. Run the full local test suite.
4. Commit and push the release changes to `main`.
5. Wait for the `CI` workflow on `main` to pass.
6. Create and push a `v*` tag on the verified `main` commit.
7. Verify the `Publish Extension` workflow completes successfully.
8. Optionally create a GitHub Release entry using the changelog section.

## Step 1: Update release metadata

For a new release such as `0.5.0`, update:

- `apps/extension/package.json`
- `CHANGELOG.md`
- `FEATURE_MATRIX.md`
- `ROADMAP.md`

Expected changelog shape:

- Keep `## [Unreleased]` at the top.
- Add a dated section like `## [0.5.0] - 2026-04-12` below it.
- Move the shipped items from unreleased notes into that version section.

Use commit history as a backstop before tagging to make sure the release notes include all shipped work.

Helpful command:

```bash
git log --oneline v0.4.0..HEAD
```

## Step 2: Run a clean local build

Run the workspace clean first:

```bash
bun run clean
```

Then build the monorepo from the root:

```bash
bun run build
```

Notes:

- The root build script is the source of truth for release verification.
- It builds all packages, the webviews, and the extension.
- The webview builds write into `apps/extension/dist/...`, so do not treat them as separately released artifacts.

## Step 3: Run the full local test suite

Run all tests from the repository root:

```bash
bun run test
```

This validates:

- package test suites
- extension tests
- packages with no tests still succeed because they use `--passWithNoTests`

## Step 4: Commit and push release changes

Commit the release metadata changes on `main`:

```bash
git add CHANGELOG.md FEATURE_MATRIX.md ROADMAP.md apps/extension/package.json
git commit -m "chore: release v0.5.0"
git push origin main
```

If release-blocking workflow fixes are needed after the release commit, push those to `main` before tagging. The tag should point to the final verified commit, not an earlier one.

## Step 5: Wait for branch CI

The `CI` workflow runs on pushes to `main` and pull requests.

Current jobs:

- `Build packages`
- `Build webview`
- `Build extension`
- `Type-check`
- `Lint`
- `Test`

Check runs with `gh`:

```bash
gh run list --workflow CI --branch main --limit 3
```

Check a specific run non-interactively:

```bash
gh api repos/pavi2410/android-devkit/actions/runs/<run-id> --jq '{status: .status, conclusion: .conclusion, name: .name, head_sha: .head_sha}'
```

Only tag after the `CI` run for the exact `main` head commit is `completed` with `success`.

## Step 6: Create and push the release tag

The publish workflow is triggered by tag pushes matching `v*`.

Lightweight tag:

```bash
git tag v0.5.0
git push origin v0.5.0
```

Annotated tag:

```bash
git tag -a v0.5.0 -m "v0.5.0"
git push origin v0.5.0
```

Either tag type is sufficient to trigger `.github/workflows/publish.yml`.

Before tagging, verify the tag does not already exist:

```bash
git tag --list 'v0.5.0'
git ls-remote --tags origin 'v0.5.0'
```

## Step 7: Verify publish workflow

The `Publish Extension` workflow runs on tag pushes and currently does the following:

1. Checks out the repository.
2. Installs Bun dependencies.
3. Builds all packages.
4. Builds the SDK Manager webview.
5. Packages the VSIX from `apps/extension`.
6. Publishes to VS Code Marketplace if `VSCE_PAT` is set.
7. Publishes to Open VSX if `OVSX_TOKEN` is set.

Check recent runs:

```bash
gh run list --limit 10 --json databaseId,headSha,status,conclusion,workflowName,displayTitle,event
```

Check the publish run directly:

```bash
gh api repos/pavi2410/android-devkit/actions/runs/<run-id> --jq '{status: .status, conclusion: .conclusion, name: .name, head_sha: .head_sha, event: .event}'
```

The release is complete when `Publish Extension` finishes successfully for the tagged commit.

## Optional: GitHub Release entry

After the publish workflow succeeds, you can create a GitHub Release for the tag and paste the matching changelog section as release notes.

## Failure handling

- If local build or test fails, fix the issue before pushing.
- If `CI` fails on `main`, fix it and retag only after the corrected commit passes.
- If the publish workflow fails, inspect the failing run, fix the issue on `main`, and create a new version tag instead of reusing a broken release version.

## Example command sequence

```bash
bun run clean
bun run build
bun run test

git add CHANGELOG.md FEATURE_MATRIX.md ROADMAP.md apps/extension/package.json
git commit -m "chore: release v0.5.0"
git push origin main

gh run list --workflow CI --branch main --limit 3

git tag v0.5.0
git push origin v0.5.0

gh run list --limit 10 --json databaseId,headSha,status,conclusion,workflowName,displayTitle,event
```