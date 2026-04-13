---
name: makecli
description: Guidance for using makecli in this repo (flags, output formats, pagination, auth, and discovery). Use when asked to run or design makecli commands or interact with make platform via the makecli.
---

# Makecli usage
Use this skill when you need to run or design `makecli` commands for make platform.

## Command discovery
- Always use --help to discover commands and flags
  - makecli --help
  - makecli configure --help
  - makecli app --help
  - makecli entity --help
  - makecli relation --help
  - makecli schema --help
  - makecli apply --help

## Flag conventions
- Use explicit long flags (e.g., --app, --output).

## Output formats
- Use `--output json` when piped or non-interactive

## Authentication and defaults
Use `makecli configure verify --output=json!` to verify if token is configured.
