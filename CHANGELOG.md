# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-15

### Added

- `-e, --edit` option to edit existing envs. It lists the envs found in the directory,
  lets you pick one with the arrow keys and then choose an action:
  - **Add variables**: appended to the end of each file, existing values are kept.
  - **Remove variables**: select one or more variables and confirm. They are removed
    from all files of the env (comments and other lines are kept).
  - **Rename a variable**: renamed in all files of the env, keeping its value.
    It refuses to rename onto a variable that already exists.
- Cancel with `Ctrl+C` at any prompt without changing any file.
- Unit tests for listing envs, reading variables, removing and renaming.

### Changed

- Added `@clack/prompts` as a dependency for the interactive selection.
- Minimum Node.js version raised from 18 to 20.12 (required by `@clack/prompts`).

## [0.1.0] - 2026-10-15

First functional release.

### Added

- Interactive CLI that asks which envs to create (comma separated) and generates
  `<name>.local.env`, `<name>.env` and `<name>.env.example` for each one.
- Prompt for the variable names of each env. The variables are written to all three
  files: empty values in `.env` and `.local.env`, and a default value (`changeme`)
  in `.env.example`.
- Existing files are never overwritten: only the missing variables are appended to the
  end of the file, and existing values are preserved.
- Automatic `.gitignore` update with the rule matching the chosen directory
  (`env/*.env`, or `*.env` with `--dir .`). `.env.example` files stay tracked.
- `-d, --dir <path>` option to choose the directory of the env files (default: `env`).
- `-a, --avoid` option to skip the variable names prompt (files are created empty).
- `-h, --help` option.
- Validation of variable names (letters, numbers and `_`, not starting with a number).
  Names are converted to uppercase.
- Unit tests with Vitest.

[Unreleased]: https://github.com/hoshisaiumia/humenv/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/hoshisaiumia/humenv/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hoshisaiumia/humenv/releases/tag/v0.1.0
