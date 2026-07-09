---
name: skills-architecture-map
description: Do not use as a runtime skill. This file is the GEB L2 architecture map for the make-platform-skills skills directory and exists so agents can reconstruct local module boundaries.
metadata:
  version: 0.0.0
---

# skills/
> L2 | 父级: ../AGENTS.md

成员清单
.DS_Store: 历史遗留 macOS 元数据文件，不承载 skill 语义。
setup-make-poc.md: PoC 前置环境 skill，顶层 md 入口，覆盖 Node/pnpm/git/makecli 与登录校验。
canvas-table-integration/: CanvasTable 消费侧接入 skill，负责表格渲染、行头、编辑与字段展示规则。
make-app-auth/: Make App 认证 skill，负责统一登录、鉴权请求、401/403 与 logout 链路。
make-app-filter/: Make App 筛选 skill，负责 make-filter 接入、表头联动与 filter.expression 合同。
make-app-permission/: Make App 权限 skill，负责单应用权限、路由/按钮/字段权限与审计脚本。
make-app-runtime/: Make App 运行态 skill，负责 workspace、构建产物、端口与发布契约。
make-app-service/: Make App Service skill，负责 API 合同、Make adapter、代理接口与测试边界。
make-integration/: Make 集成 skill，负责票据/OCR 等 integration 能力的 makecli 调用。
makecli/: Make CLI skill，负责资源管理命令、登录、diff/apply 与记录操作。
makedsl/: Make DSL skill，负责 app/entity/relation/field 建模与 YAML 生成。
makeui/: Make App UI skill，负责 React/Vite 页面结构、组件组织、表单详情与视觉状态。
metadata-version-probe/: CI 探针 skill，故意缺少 `metadata.version` 以验证 GitHub Actions 是否拦截。

架构边界: 本目录只放 skill 语义实体；共享判据留在 `../scripts/`，路由说明留在 `../README.md`。
变更日志: 2026-07-09 新增 `metadata-version-probe/` 用于 metadata.version 缺失实验。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
