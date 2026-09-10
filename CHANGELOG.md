# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the release process.

## [Unreleased]

### Changed

- Pre-commit hooks match GitHub practice: local file hygiene plus the same
  checks in CI, Conventional Commit messages, and PR-title validation for
  squash-merge.
- Commits and PRs reject `Co-authored-by` / `Co-committed-by` and known
  agent emails. Authorship is the maintainer only.

## [0.1.0] - 2026-09-10

First tagged product release.

### Added

- SemVer release process, `CHANGELOG.md`, and GitHub Release workflow on `v*` tags.
- MIT license.

### Changed

- Product demo GIFs live in `assets/demos/`. Unpublished working notes live in gitignored `docs/`.

[Unreleased]: https://github.com/SVamseekar/workforceguardai/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SVamseekar/workforceguardai/releases/tag/v0.1.0
