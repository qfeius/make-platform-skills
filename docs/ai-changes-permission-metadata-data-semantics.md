# 权限元数据与业务字段语义修正

## 2026-10-23
- 变更摘要：区分字段元数据权限与业务字段值权限，修正普通新建、读取、单条编辑和批量编辑。
- 涉及模块：`make-app-permission`、`make-app-actions`、README、审计与行为/跨技能契约测试。
- 关键决策：业务字段使用对应 `data.record.*.fieldAccess`；`meta.field.*` 仅表示元数据权限，保留独立表头授权。
- 状态约束：普通新建仅接受 `creatable|*`；保留审批启动配置例外和 Schema/提交白名单约束。
- 验证策略：先确认旧映射与批量覆盖缺口失败，再修正文档、审计与行为合同并运行仓库回归。
- 工作区：临时 worktree `/private/tmp/make-platform-skills-permission-semantics`；提交及远端保存后清理，保留功能分支。
