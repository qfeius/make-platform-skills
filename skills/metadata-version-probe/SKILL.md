---
name: metadata-version-probe
description: Use only as a CI probe for make-platform-skills metadata validation. This intentionally invalid skill exists to confirm whether GitHub Actions rejects skill entries that omit metadata.version.
metadata:
  short-description: CI probe without metadata.version
---

<!--
  [INPUT]: 依赖 scripts/lint-skill-metadata.mjs 对 skills/*/SKILL.md 的 frontmatter 扫描。
  [OUTPUT]: 对外提供 metadata-version-probe 测试 skill 入口，故意不提供 metadata.version。
  [POS]: skills/metadata-version-probe 的 CI 探针，用于验证缺失 metadata.version 是否阻断 PR。
  [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->

# metadata-version-probe

Use this skill only to verify that repository CI rejects a skill entry without `metadata.version`.

Do not install or use this skill for real Make platform work.
