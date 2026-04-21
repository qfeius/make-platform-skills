# AI 变更记录

## 2026-04-21 00:03
- 变更摘要：更新 `makedsl` skill 与参考文档，补齐最新 Lookup 返回结构和 Relation 示例口径。
- 涉及文件/模块：`.gitignore`、`skills/makedsl/SKILL.md`、`skills/makedsl/references/DataAPIDesign.md`、`skills/makedsl/references/RelationDesign.md`、`docs/ai-changes.md`
- 关键逻辑/决策：文档改为以 `Make.Field.*` 命名展示字段类型，Lookup 返回值切到 `{entity, field, data[]}`；Relation 示例去掉旧 `transform` 片段；本次按用户要求直接提交，未处理 `SKILL.md` frontmatter 中 `version` 仍不被校验器接受的问题。

## 2026-04-20 12:09
- 变更摘要：将 `canvas-table-integration` skill 的目标包切换为 `@qfei-design/canvas-table`，并改为缺包时自动安装。
- 涉及文件/模块：`skills/canvas-table-integration/SKILL.md`、`README.md`、`docs/ai-changes.md`
- 关键逻辑/决策：按 `pnpm-lock.yaml`、`yarn.lock`、`package-lock.json` 识别包管理器；无锁文件时回退到 `npm install`，无 `package.json` 或安装失败则停止并报错。

## 2026-04-16 20:20
- 变更摘要：新增 `canvas-table-integration` skill 初稿，限定为 `@qfei/canvas-table` 的消费侧接入流程。
- 涉及文件/模块：`skills/canvas-table-integration/SKILL.md`、`README.md`、`docs/ai-changes.md`
- 关键逻辑/决策：skill 只负责消费侧接入，不包含 npm 配置、发包或库维护；优先读取已安装包中的 AI 文档，未安装时只提示用户先安装。
