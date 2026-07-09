# metadata-version-probe/
> L2 | 父级: ../AGENTS.md

成员清单
SKILL.md: CI 探针 skill 入口，YAML frontmatter 故意省略 `metadata.version`，用于验证 metadata lint 是否阻断 PR。

架构边界: 本模块不是生产 skill；它只制造一个干净的 metadata 缺口，让 CI 结果成为唯一事实来源。
变更日志: 2026-07-09 创建缺失 `metadata.version` 的最小 skill 探针。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
