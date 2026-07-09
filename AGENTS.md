# make-platform-skills - Make 平台 Agent Skill 仓库
Markdown + Node.js + GitHub Actions

<directory>
.github/ - CI 入口，PR 与 push 统一执行 skill metadata lint
docs/ - AI 变更记录，保存 skill 规则演进的语义相
scripts/ - 可执行契约检查，承载 metadata 与 UI/API 规则的机器相
skills/ - 可分发 skill 实体，每个目录或顶层 md 都是一个 skill 入口
</directory>

<config>
README.md - 安装方式、路由矩阵与可用 skill 总览
.github/workflows/skill-metadata-lint.yml - GitHub Actions 中运行 Node 24 metadata 校验
scripts/lint-skill-metadata.mjs - skill frontmatter 必填字段的唯一机器判据
</config>

架构决策: `skills/` 保存语义，`scripts/` 保存判据，CI 只执行判据；文档和代码必须同构。
开发规范: 新增或修改 skill 时同步 L2 `skills/AGENTS.md`，变更入口文件时同步文件头部契约。
变更日志: 2026-07-09 新增 GEB L1 地图，记录 skill metadata CI 探针实验。

法则: 极简·稳定·导航·版本精确
